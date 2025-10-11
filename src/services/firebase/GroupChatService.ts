import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDoc,
  setDoc,
  increment
} from 'firebase/firestore';
import { db } from './config';

// Chat Message Interface
export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'expense' | 'system' | 'settlement';
  expenseData?: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    isEdit?: boolean;
  };
  settlementData?: {
    fromUserName: string;
    toUserName: string;
    amount: number;
    currency: string;
  };
}

// Notification interface
interface Notification {
  id?: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: Date;
}

// Group interface
interface Group {
  id: string;
  name: string;
  members: Array<{
    userId: string;
    userData: {
      fullName: string;
      email: string;
      avatar?: string;
    };
  }>;
}

export class GroupChatService {
  // Send a group message
  static async sendGroupMessage(messageData: {
    groupId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    message: string;
    type: 'message' | 'expense' | 'system' | 'settlement';
    expenseData?: any;
    settlementData?: any;
  }): Promise<string> {
    try {
      console.log('📨 GroupChatService: Sending group message:', messageData.message);
      
      const chatMessage = {
        ...messageData,
        userAvatar: messageData.userAvatar || '',
        timestamp: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'groupMessages'), chatMessage);
      console.log('✅ GroupChatService: Message sent with ID:', docRef.id);
      
      // Update group's last activity
      await updateDoc(doc(db, 'groups', messageData.groupId), {
        updatedAt: serverTimestamp()
      });

      // Send notifications to group members (except sender)
      if (messageData.type === 'message') {
        await this.sendChatNotificationToGroupMembers(
          messageData.groupId,
          messageData.userId,
          messageData.userName,
          messageData.message
        );
      }
      
      return docRef.id;
    } catch (error) {
      console.error('❌ GroupChatService: Send group message error:', error);
      throw error;
    }
  }

  // Send notifications to group members
  private static async sendChatNotificationToGroupMembers(
    groupId: string,
    senderUserId: string,
    senderName: string,
    message: string
  ): Promise<void> {
    try {
      console.log('📢 GroupChatService: Sending notifications to group members');
      
      // Get group data to find all members
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        console.warn('Group not found for notifications');
        return;
      }
      
      const groupData = groupDoc.data() as Group;
      
      // Send notification to all members except sender
      const notificationPromises = groupData.members
        .filter(member => member.userId !== senderUserId)
        .map(member => 
          this.createNotification({
            userId: member.userId,
            type: 'group_message',
            title: `${senderName} in ${groupData.name}`,
            message: message.length > 50 ? `${message.substring(0, 50)}...` : message,
            data: { 
              groupId,
              groupName: groupData.name,
              senderId: senderUserId,
              senderName,
              navigationType: 'groupChat'
            },
            isRead: false,
            createdAt: new Date()
          })
        );
      
      await Promise.all(notificationPromises);
      console.log('✅ GroupChatService: Notifications sent to group members');
      
    } catch (error) {
      console.error('❌ GroupChatService: Send chat notification error:', error);
    }
  }

  // Create notification
  private static async createNotification(notificationData: Omit<Notification, 'id'>): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), notificationData);
    } catch (error) {
      console.error('❌ GroupChatService: Create notification error:', error);
    }
  }

  // Get group messages
  static async getGroupMessages(groupId: string, limitCount: number = 50): Promise<ChatMessage[]> {
    try {
      console.log('📥 GroupChatService: Getting group messages for:', groupId);
      
      const messagesQuery = query(
        collection(db, 'groupMessages'),
        where('groupId', '==', groupId),
        orderBy('timestamp', 'asc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(messagesQuery);
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as ChatMessage[];
      
      console.log(`✅ GroupChatService: Retrieved ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error('❌ GroupChatService: Get group messages error:', error);
      return [];
    }
  }

  // Listen to group messages in real-time
  static onGroupMessages(groupId: string, callback: (messages: ChatMessage[]) => void): () => void {
    console.log('👂 GroupChatService: Setting up real-time listener for group:', groupId);

    const messagesQuery = query(
      collection(db, 'groupMessages'),
      where('groupId', '==', groupId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    return onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as ChatMessage[];

      console.log(`🔄 GroupChatService: Real-time update - ${messages.length} messages`);
      callback(messages);
    }, (error) => {
      console.error('❌ GroupChatService: Message listener error:', error);
    });
  }

  // Get unread message count for a user in a group
  static async getUnreadMessageCount(groupId: string, userId: string): Promise<number> {
    try {
      const userReadDoc = await getDoc(doc(db, 'groupMessageReads', `${groupId}_${userId}`));
      if (!userReadDoc.exists()) {
        // No read timestamp, count all messages from others
        const allMessagesQuery = query(
          collection(db, 'groupMessages'),
          where('groupId', '==', groupId)
        );
        const snapshot = await getDocs(allMessagesQuery);
        // Filter out own messages client-side
        return snapshot.docs.filter(d => d.data().userId !== userId).length;
      }

      const lastReadTimestamp = userReadDoc.data()?.lastReadTimestamp?.toDate() || new Date(0);

      // Query messages after last read (without userId filter to avoid composite index)
      const unreadQuery = query(
        collection(db, 'groupMessages'),
        where('groupId', '==', groupId),
        where('timestamp', '>', lastReadTimestamp)
      );

      const snapshot = await getDocs(unreadQuery);
      // Filter out own messages client-side
      return snapshot.docs.filter(d => d.data().userId !== userId).length;
    } catch (error) {
      console.error('❌ GroupChatService: Get unread count error:', error);
      return 0;
    }
  }

  // Mark messages as read for a user in a group
  static async markMessagesAsRead(groupId: string, userId: string): Promise<void> {
    try {
      await setDoc(doc(db, 'groupMessageReads', `${groupId}_${userId}`), {
        groupId,
        userId,
        lastReadTimestamp: serverTimestamp()
      }, { merge: true });
      console.log('✅ GroupChatService: Messages marked as read');
    } catch (error) {
      console.error('❌ GroupChatService: Mark as read error:', error);
    }
  }

  // Listen to unread count for a user in a group
  static onUnreadCount(groupId: string, userId: string, callback: (count: number) => void): () => void {
    console.log('👂 GroupChatService: Setting up unread count listener');

    return onSnapshot(doc(db, 'groupMessageReads', `${groupId}_${userId}`), async () => {
      const count = await this.getUnreadMessageCount(groupId, userId);
      callback(count);
    }, (error) => {
      console.error('❌ GroupChatService: Unread count listener error:', error);
    });
  }

  // Create system message for expense addition
  static async createExpenseAddedMessage(
    groupId: string,
    userId: string,
    userName: string,
    expenseData: {
      id: string;
      description: string;
      amount: number;
      currency: string;
      splitType: 'equal' | 'custom';
      expenseDate?: Date;
    }
  ): Promise<void> {
    try {
      await this.sendGroupMessage({
        groupId,
        userId,
        userName,
        message: `Added expense: ${expenseData.description}`,
        type: 'expense',
        expenseData: {
          ...expenseData,
          expenseDate: expenseData.expenseDate ? expenseData.expenseDate.toISOString() : undefined,
          isEdit: false
        }
      });
    } catch (error) {
      console.error('❌ GroupChatService: Create expense added message error:', error);
    }
  }

  // Create system message for expense edit
  static async createExpenseEditedMessage(
    groupId: string,
    userId: string,
    userName: string,
    expenseData: {
      id: string;
      description: string;
      amount: number;
      currency: string;
      splitType: 'equal' | 'custom';
      expenseDate?: Date;
    }
  ): Promise<void> {
    try {
      await this.sendGroupMessage({
        groupId,
        userId,
        userName,
        message: `Edited expense: ${expenseData.description}`,
        type: 'expense',
        expenseData: {
          ...expenseData,
          expenseDate: expenseData.expenseDate ? expenseData.expenseDate.toISOString() : undefined,
          isEdit: true
        }
      });
    } catch (error) {
      console.error('❌ GroupChatService: Create expense edited message error:', error);
    }
  }

  // Create system message for user added to group
  static async createUserAddedMessage(
    groupId: string,
    addedByUserId: string,
    addedByUserName: string,
    addedUserId: string,
    addedUserName: string
  ): Promise<void> {
    try {
      await this.sendGroupMessage({
        groupId,
        userId: addedByUserId,
        userName: 'System',
        message: `${addedByUserName} added ${addedUserName} to the group`,
        type: 'system'
      });
    } catch (error) {
      console.error('❌ GroupChatService: Create user added message error:', error);
    }
  }

  // Create system message for user joining via invite code
  static async createUserJoinedMessage(
    groupId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    try {
      await this.sendGroupMessage({
        groupId,
        userId,
        userName: 'System',
        message: `${userName} joined the group`,
        type: 'system'
      });
    } catch (error) {
      console.error('❌ GroupChatService: Create user joined message error:', error);
    }
  }
}
