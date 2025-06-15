// src/services/NotificationManager.ts
import { PushNotificationService, PushNotificationData } from './notifications/PushNotificationService';
import { SplittingService } from './firebase/splitting';
import { Expense, Group, Friend } from './firebase/splitting';

/**
 * NotificationManager - Centralized manager for handling group activity notifications
 * 
 * This class provides:
 * - Automatic push notifications for expense and group activities
 * - Reactive notification triggers that integrate with existing service calls
 * - Deep linking support for notification actions
 * - Caching to prevent duplicate notifications
 */
export class NotificationManager {
  private static instance: NotificationManager;
  private pushService: PushNotificationService;
  private currentUserId: string | null = null;
  private notificationCache: Set<string> = new Set(); // Prevent duplicate notifications
  private cacheTimeout: number = 5000; // 5 seconds to prevent immediate duplicates

  private constructor() {
    this.pushService = PushNotificationService.getInstance();
  }

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Initialize the notification manager for a specific user
   */
  async initialize(userId: string): Promise<void> {
    try {
      this.currentUserId = userId;
      await this.pushService.initialize(userId);
      console.log('NotificationManager initialized for user:', userId);
    } catch (error) {
      console.error('NotificationManager initialization error:', error);
    }
  }

  /**
   * Generate a cache key for notification deduplication
   */
  private generateCacheKey(type: string, targetUserId: string, data: any): string {
    return `${type}_${targetUserId}_${JSON.stringify(data).slice(0, 50)}`;
  }

  /**
   * Check if notification was recently sent to prevent duplicates
   */
  private isRecentlySent(cacheKey: string): boolean {
    if (this.notificationCache.has(cacheKey)) {
      return true;
    }
    
    // Add to cache and remove after timeout
    this.notificationCache.add(cacheKey);
    setTimeout(() => {
      this.notificationCache.delete(cacheKey);
    }, this.cacheTimeout);
    
    return false;
  }

  /**
   * Send expense added notification to group members
   */
  async notifyExpenseAdded(expense: Expense, groupData: Group, excludeUserId: string): Promise<void> {
    try {
      if (!this.currentUserId) {
        console.warn('NotificationManager not initialized');
        return;
      }

      console.log('🔔 Sending expense added notifications for:', expense.description);

      // Get members to notify (exclude the person who added the expense)
      const membersToNotify = groupData.members.filter(member => 
        member.userId !== excludeUserId && member.isActive
      );

      for (const member of membersToNotify) {
        const cacheKey = this.generateCacheKey('expense_added', member.userId, {
          expenseId: expense.id,
          groupId: groupData.id
        });

        if (this.isRecentlySent(cacheKey)) {
          console.log('Skipping duplicate notification for member:', member.userId);
          continue;
        }

        // Create expense notification
        const notification = PushNotificationService.createExpenseAddedNotification(
          expense.paidByData.fullName,
          expense.amount,
          expense.currency,
          expense.description,
          expense.id,
          groupData.id,
          groupData.name,
          expense.paidByData.avatar
        );

        // Send notification
        await PushNotificationService.sendNotificationToUser(member.userId, notification);

        // Create in-app notification record
        await SplittingService.createNotification({
          userId: member.userId,
          type: 'expense_added',
          title: 'New Expense Added',
          message: `${expense.paidByData.fullName} added "${expense.description}" for ${expense.currency} ${expense.amount} in ${groupData.name}`,
          data: {
            expenseId: expense.id,
            groupId: groupData.id || expense.groupId, // Fallback to expense.groupId if groupData.id is undefined
            groupName: groupData.name,
            senderName: expense.paidByData.fullName,
            senderAvatar: expense.paidByData.avatar || '',
            amount: expense.amount,
            currency: expense.currency,
            description: expense.description,
            // Deep linking data
            navigationType: 'groupExpenseDetails',
            targetGroupId: groupData.id || expense.groupId,
            targetExpenseId: expense.id
          },
          isRead: false,
          createdAt: new Date()
        });
      }

      console.log(`✅ Sent expense notifications to ${membersToNotify.length} group members`);
    } catch (error) {
      console.error('❌ Error sending expense added notifications:', error);
    }
  }

  /**
   * Send group invitation notification to new member
   */
  async notifyGroupInvitation(groupData: Group, invitedUserId: string, inviterUserId: string): Promise<void> {
    try {
      if (!this.currentUserId) {
        console.warn('NotificationManager not initialized');
        return;
      }

      console.log('🔔 Sending group invitation notification');

      // Get inviter data
      const inviterMember = groupData.members.find(member => member.userId === inviterUserId);
      if (!inviterMember) {
        console.error('Inviter not found in group members');
        return;
      }

      const cacheKey = this.generateCacheKey('group_invite', invitedUserId, {
        groupId: groupData.id,
        inviterUserId
      });

      if (this.isRecentlySent(cacheKey)) {
        console.log('Skipping duplicate group invitation notification');
        return;
      }

      // Validate required data before creating notification
      const safeGroupData = {
        id: groupData.id || '',
        name: groupData.name || 'Unknown Group',
        inviteCode: groupData.inviteCode || '',
        description: groupData.description || ''
      };
      
      const safeInviterData = {
        fullName: inviterMember.userData.fullName || 'Unknown User',
        avatar: inviterMember.userData.avatar || ''
      };

      // Create group invitation notification
      const notification = PushNotificationService.createGroupInviteNotification(
        safeInviterData.fullName,
        safeGroupData.name,
        safeGroupData.id,
        safeGroupData.inviteCode,
        safeInviterData.avatar,
        safeGroupData.description
      );

      // Send push notification
      await PushNotificationService.sendNotificationToUser(invitedUserId, notification);

      // Create in-app notification record with validated data
      await SplittingService.createNotification({
        userId: invitedUserId,
        type: 'group_invite',
        title: 'Group Invitation',
        message: `${safeInviterData.fullName} invited you to join "${safeGroupData.name}"`,
        data: {
          groupId: safeGroupData.id,
          groupName: safeGroupData.name,
          inviteCode: safeGroupData.inviteCode,
          senderName: safeInviterData.fullName,
          senderAvatar: safeInviterData.avatar,
          groupDescription: safeGroupData.description,
          // Deep linking data
          navigationType: 'groupJoin',
          targetGroupId: groupData.id
        },
        isRead: false,
        createdAt: new Date()
      });

      console.log(`✅ Sent group invitation notification to user: ${invitedUserId}`);
    } catch (error) {
      console.error('❌ Error sending group invitation notification:', error);
    }
  }

  /**
   * Send payment settlement notification
   */
  async notifyPaymentSettled(
    fromUserId: string, 
    toUserId: string, 
    amount: number, 
    currency: string, 
    description: string,
    settlementId: string,
    groupId?: string,
    groupName?: string
  ): Promise<void> {
    try {
      if (!this.currentUserId) {
        console.warn('NotificationManager not initialized');
        return;
      }

      console.log('🔔 Sending payment settlement notifications');

      // Get user data
      const [fromUserData, toUserData] = await Promise.all([
        SplittingService.getUserById(fromUserId),
        SplittingService.getUserById(toUserId)
      ]);

      if (!fromUserData || !toUserData) {
        console.error('User data not found for settlement notification');
        return;
      }

      const cacheKey = this.generateCacheKey('payment_settled', toUserId, {
        fromUserId,
        amount,
        settlementId
      });

      if (this.isRecentlySent(cacheKey)) {
        console.log('Skipping duplicate payment settlement notification');
        return;
      }

      // Create payment settlement notification
      const notification = PushNotificationService.createExpenseSettledNotification(
        fromUserData.fullName,
        amount,
        currency,
        description,
        '', // expenseId not needed for settlement
        groupId,
        groupName,
        fromUserData.profilePicture
      );

      // Send push notification
      await PushNotificationService.sendNotificationToUser(toUserId, notification);

      // Create in-app notification record
      await SplittingService.createNotification({
        userId: toUserId,
        type: 'expense_settled',
        title: 'Payment Received',
        message: `${fromUserData.fullName} marked a payment of ${currency} ${amount} as paid`,
        data: {
          settlementId,
          fromUserId,
          amount,
          currency,
          description,
          groupId,
          groupName,
          // Deep linking data
          navigationType: 'settlementDetails',
          targetSettlementId: settlementId
        },
        isRead: false,
        createdAt: new Date()
      });

      console.log(`✅ Sent payment settlement notification to user: ${toUserId}`);
    } catch (error) {
      console.error('❌ Error sending payment settlement notification:', error);
    }
  }

  /**
   * Handle notification click and provide deep linking navigation data
   */
  handleNotificationClick(notificationData: PushNotificationData): NavigationAction | null {
    try {
      const { type, data } = notificationData;

      switch (type) {
        case 'expense_added':
          return {
            action: 'navigate',
            screen: 'Groups', // Navigate to Groups tab instead
            params: {
              groupId: data.groupId,
              initialTab: 'expenses',
              highlightExpenseId: data.expenseId
            }
          };

        case 'group_invite':
          return {
            action: 'navigate',
            screen: 'GroupJoin',
            params: {
              inviteCode: data.inviteCode,
              groupId: data.groupId,
              previewMode: true
            }
          };

        case 'expense_settled':
          if (data.groupId) {
            return {
              action: 'navigate',
              screen: 'Groups', // Navigate to Groups tab instead
              params: {
                groupId: data.groupId,
                initialTab: 'settlements',
                highlightSettlementId: data.settlementId
              }
            };
          } else {
            return {
              action: 'navigate',
              screen: 'FriendDetails',
              params: {
                friendId: data.fromUserId,
                initialTab: 'settlements'
              }
            };
          }

        case 'payment_received':
          return {
            action: 'navigate',
            screen: 'PaymentHistory',
            params: {
              highlightPaymentId: data.paymentId
            }
          };

        default:
          console.log('Unknown notification type for deep linking:', type);
          return {
            action: 'navigate',
            screen: 'Notifications',
            params: {}
          };
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      return null;
    }
  }

  /**
   * Send batch notifications to group members (useful for multiple operations)
   */
  async notifyGroupMembers(
    groupId: string, 
    excludeUserId: string, 
    notification: PushNotificationData
  ): Promise<void> {
    try {
      if (!this.currentUserId) {
        console.warn('NotificationManager not initialized');
        return;
      }

      await PushNotificationService.sendNotificationToGroup(groupId, excludeUserId, notification);
      console.log(`✅ Sent batch notification to group: ${groupId}`);
    } catch (error) {
      console.error('❌ Error sending batch group notifications:', error);
    }
  }

  /**
   * Clear notification cache (useful for testing or manual cache clearing)
   */
  clearCache(): void {
    this.notificationCache.clear();
    console.log('NotificationManager cache cleared');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.currentUserId = null;
    this.notificationCache.clear();
    this.pushService.cleanup();
    console.log('NotificationManager cleanup completed');
  }
}

// Navigation action interface for deep linking
export interface NavigationAction {
  action: 'navigate' | 'modal' | 'alert';
  screen: string;
  params: Record<string, any>;
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance();
export default NotificationManager;
