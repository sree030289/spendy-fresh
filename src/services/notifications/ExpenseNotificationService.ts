// src/services/notifications/ExpenseNotificationService.ts
import AppNotificationService, { AppNotification } from './AppNotificationService';
import { GroupChatService } from '../firebase/GroupChatService';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  paidBy: string;
  paidByUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  splitAmong: Array<{
    userId: string;
    userData: {
      fullName: string;
      email: string;
      avatar?: string;
    };
    amount: number;
    percentage?: number;
  }>;
  receiptUrl?: string;
  notes?: string;
  tags?: string[];
  location?: string;
  date: Date;
  createdBy: string;
  createdByUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  createdAt: Date;
  editedBy?: string;
  editedByUserData?: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  editedAt?: Date;
  deletedBy?: string;
  deletedByUserData?: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  deletedAt?: Date;
  isDeleted?: boolean;
  canUndo?: boolean;
  undoExpiresAt?: Date;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  fromUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  toUserId: string;
  toUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  amount: number;
  currency: string;
  description?: string;
  settledBy: string;
  settledByUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  settledAt: Date;
  relatedExpenses?: string[];
}

export class ExpenseNotificationService {
  private static instance: ExpenseNotificationService;
  private appNotificationService: AppNotificationService;

  constructor() {
    this.appNotificationService = AppNotificationService.getInstance();
  }

  static getInstance(): ExpenseNotificationService {
    if (!ExpenseNotificationService.instance) {
      ExpenseNotificationService.instance = new ExpenseNotificationService();
    }
    return ExpenseNotificationService.instance;
  }

  // Send expense added notification
  async sendExpenseAddedNotification(
    expense: Expense,
    groupName: string,
    groupMembers: Array<{ userId: string; userData: { fullName: string; email: string; avatar?: string; }}>
  ): Promise<void> {
    try {
      console.log('💰 Sending expense added notifications for:', expense.description);

      // Send notification to all group members (including the creator for confirmation)
      const memberPromises = groupMembers.map(member => {
        const isCreator = member.userId === expense.createdBy;
        const isPayer = member.userId === expense.paidBy;
        const isInvolved = expense.splitAmong.some(split => split.userId === member.userId);
        
        let message = '';
        if (isCreator) {
          message = `You added "${expense.description}" (${expense.currency}${expense.amount}) to "${groupName}"`;
        } else if (isPayer && isInvolved) {
          message = `${expense.createdByUserData.fullName} added "${expense.description}" (${expense.currency}${expense.amount}) - You paid and owe part of it`;
        } else if (isPayer) {
          message = `${expense.createdByUserData.fullName} added "${expense.description}" (${expense.currency}${expense.amount}) - You paid for it`;
        } else if (isInvolved) {
          const splitInfo = expense.splitAmong.find(split => split.userId === member.userId);
          message = `${expense.createdByUserData.fullName} added "${expense.description}" (${expense.currency}${expense.amount}) - You owe ${expense.currency}${splitInfo?.amount || 0}`;
        } else {
          message = `${expense.createdByUserData.fullName} added "${expense.description}" (${expense.currency}${expense.amount}) to "${groupName}"`;
        }

        const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
          userId: member.userId,
          type: 'expense_added',
          title: '💰 New Expense Added',
          message,
          data: {
            groupId: expense.groupId,
            groupName,
            expenseId: expense.id,
            expenseDescription: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            paidBy: expense.paidByUserData.fullName,
            expenseAddedBy: expense.createdByUserData.fullName,
            navigationType: 'expenseDetails'
          },
          isRead: false
        };

        return this.appNotificationService.sendNotification(notification);
      });

      await Promise.all(memberPromises);

      // Send colored system message to group chat
      const splitAmongNames = expense.splitAmong
        .map(split => split.userData.fullName)
        .join(', ');

      await GroupChatService.sendGroupMessage({
        groupId: expense.groupId,
        userId: expense.createdBy,
        userName: expense.createdByUserData.fullName,
        message: `💰 Added expense: "${expense.description}" - ${expense.currency}${expense.amount}\n👤 Paid by: ${expense.paidByUserData.fullName}\n👥 Split among: ${splitAmongNames}`,
        type: 'expense',
        expenseData: {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          currency: expense.currency
        }
      });

      console.log('✅ Expense added notifications sent');
    } catch (error) {
      console.error('❌ Failed to send expense added notifications:', error);
      throw error;
    }
  }

  // Send expense edited notification
  async sendExpenseEditedNotification(
    expense: Expense,
    groupName: string,
    groupMembers: Array<{ userId: string; userData: { fullName: string; email: string; avatar?: string; }}>,
    editedFields: string[]
  ): Promise<void> {
    try {
      console.log('✏️ Sending expense edited notifications for:', expense.description);

      const changesText = editedFields.length > 0 
        ? ` (Changed: ${editedFields.join(', ')})`
        : '';

      // Send notification to all group members
      const memberPromises = groupMembers.map(member => {
        const isEditor = member.userId === expense.editedBy;
        
        const message = isEditor
          ? `You edited "${expense.description}" in "${groupName}"${changesText}`
          : `${expense.editedByUserData?.fullName} edited "${expense.description}" in "${groupName}"${changesText}`;

        const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
          userId: member.userId,
          type: 'expense_edited',
          title: '✏️ Expense Updated',
          message,
          data: {
            groupId: expense.groupId,
            groupName,
            expenseId: expense.id,
            expenseDescription: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            editedBy: expense.editedByUserData?.fullName,
            editedFields,
            navigationType: 'expenseDetails'
          },
          isRead: false
        };

        return this.appNotificationService.sendNotification(notification);
      });

      await Promise.all(memberPromises);

      // Send colored system message to group chat
      await GroupChatService.sendGroupMessage({
        groupId: expense.groupId,
        userId: expense.editedBy || expense.createdBy,
        userName: expense.editedByUserData?.fullName || expense.createdByUserData.fullName,
        message: `✏️ Edited expense: "${expense.description}" - ${expense.currency}${expense.amount}${changesText}`,
        type: 'expense',
        expenseData: {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          currency: expense.currency
        }
      });

      console.log('✅ Expense edited notifications sent');
    } catch (error) {
      console.error('❌ Failed to send expense edited notifications:', error);
      throw error;
    }
  }

  // Send expense deleted notification
  async sendExpenseDeletedNotification(
    expense: Expense,
    groupName: string,
    groupMembers: Array<{ userId: string; userData: { fullName: string; email: string; avatar?: string; }}>,
    canUndo: boolean = true,
    undoTimeLimit: number = 30000 // 30 seconds
  ): Promise<void> {
    try {
      console.log('🗑️ Sending expense deleted notifications for:', expense.description);

      // Send notification to all group members
      const memberPromises = groupMembers.map(member => {
        const isDeleter = member.userId === expense.deletedBy;
        
        const message = isDeleter
          ? `You deleted "${expense.description}" from "${groupName}"`
          : `${expense.deletedByUserData?.fullName} deleted "${expense.description}" from "${groupName}"`;

        const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
          userId: member.userId,
          type: 'expense_deleted',
          title: '🗑️ Expense Deleted',
          message: canUndo ? `${message} (Tap to undo)` : message,
          data: {
            groupId: expense.groupId,
            groupName,
            expenseId: expense.id,
            expenseDescription: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            deletedBy: expense.deletedByUserData?.fullName,
            canUndo,
            undoTimeLimit,
            navigationType: 'groupExpenses'
          },
          isRead: false,
          expiresAt: canUndo ? new Date(Date.now() + undoTimeLimit) : undefined
        };

        return this.appNotificationService.sendNotification(notification);
      });

      await Promise.all(memberPromises);

      // Send colored system message to group chat
      await GroupChatService.sendGroupMessage({
        groupId: expense.groupId,
        userId: expense.deletedBy || expense.createdBy,
        userName: expense.deletedByUserData?.fullName || expense.createdByUserData.fullName,
        message: `🗑️ Deleted expense: "${expense.description}" - ${expense.currency}${expense.amount}${canUndo ? ' (Can be undone)' : ''}`,
        type: 'expense',
        expenseData: {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          currency: expense.currency
        }
      });

      console.log('✅ Expense deleted notifications sent');
    } catch (error) {
      console.error('❌ Failed to send expense deleted notifications:', error);
      throw error;
    }
  }

  // Send settlement notification
  async sendSettlementNotification(
    settlement: Settlement,
    groupName: string,
    groupMembers: Array<{ userId: string; userData: { fullName: string; email: string; avatar?: string; }}>
  ): Promise<void> {
    try {
      console.log('💸 Sending settlement notifications');

      // Send notification to all group members
      const memberPromises = groupMembers.map(member => {
        const isSettler = member.userId === settlement.settledBy;
        const isFromUser = member.userId === settlement.fromUserId;
        const isToUser = member.userId === settlement.toUserId;

        let message = '';
        if (isSettler && isFromUser) {
          message = `You marked ${settlement.currency}${settlement.amount} as paid to ${settlement.toUserData.fullName}`;
        } else if (isSettler && isToUser) {
          message = `You marked ${settlement.currency}${settlement.amount} as received from ${settlement.fromUserData.fullName}`;
        } else if (isFromUser) {
          message = `${settlement.settledByUserData.fullName} marked ${settlement.currency}${settlement.amount} as paid by you to ${settlement.toUserData.fullName}`;
        } else if (isToUser) {
          message = `${settlement.settledByUserData.fullName} marked ${settlement.currency}${settlement.amount} as paid by ${settlement.fromUserData.fullName} to you`;
        } else {
          message = `${settlement.settledByUserData.fullName} marked ${settlement.currency}${settlement.amount} as paid: ${settlement.fromUserData.fullName} → ${settlement.toUserData.fullName}`;
        }

        const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
          userId: member.userId,
          type: 'expense_settled',
          title: '💸 Payment Settled',
          message,
          data: {
            groupId: settlement.groupId,
            groupName,
            amount: settlement.amount,
            currency: settlement.currency,
            paidBy: settlement.fromUserData.fullName,
            paidTo: settlement.toUserData.fullName,
            settledBy: settlement.settledByUserData.fullName,
            navigationType: 'groupExpenses'
          },
          isRead: false
        };

        return this.appNotificationService.sendNotification(notification);
      });

      await Promise.all(memberPromises);

      // Send colored system message to group chat
      await GroupChatService.sendGroupMessage({
        groupId: settlement.groupId,
        userId: settlement.settledBy,
        userName: settlement.settledByUserData.fullName,
        message: `💸 Settlement marked: ${settlement.fromUserData.fullName} paid ${settlement.currency}${settlement.amount} to ${settlement.toUserData.fullName}`,
        type: 'system'
      });

      console.log('✅ Settlement notifications sent');
    } catch (error) {
      console.error('❌ Failed to send settlement notifications:', error);
      throw error;
    }
  }

  // Undo expense deletion
  async undoExpenseDeletion(expenseId: string, userId: string): Promise<boolean> {
    try {
      console.log('↩️ Undoing expense deletion:', expenseId);

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/expenses/${expenseId}/undo`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ userId, action: 'undo_delete' })
      });

      if (response.ok) {
        const restoredExpense = await response.json();
        
        // Send notification about restoration
        // You might want to implement this based on your needs
        
        console.log('✅ Expense deletion undone successfully');
        return true;
      } else {
        console.error('❌ Failed to undo expense deletion:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to undo expense deletion:', error);
      return false;
    }
  }

  // Get group members helper
  async getGroupMembers(groupId: string): Promise<Array<{ userId: string; userData: { fullName: string; email: string; avatar?: string; }}>> {
    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        return [];
      }

      const groupData = groupDoc.data();
      return groupData.members || [];
    } catch (error) {
      console.error('❌ Failed to get group members:', error);
      return [];
    }
  }

  // Get auth token (implement based on your auth system)
  private async getAuthToken(): Promise<string> {
    // This should get the current user's auth token
    // Implementation depends on your authentication system
    return ''; // Replace with actual token retrieval
  }
}

export default ExpenseNotificationService;
