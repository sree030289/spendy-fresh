// src/services/notifications/AppNotificationService.ts
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
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

// Enhanced notification interface
export interface AppNotification {
  id?: string;
  userId: string;
  type: 'friend_request' | 'friend_request_reminder' | 'friend_accepted' | 'friend_declined' | 'friend_removed' | 
        'group_created' | 'group_member_added' | 'group_admin_changed' | 'group_member_removed' |
        'expense_added' | 'expense_edited' | 'expense_deleted' | 'expense_settled' |
        'group_message' | 'system';
  title: string;
  message: string;
  data: {
    // Friend-related data
    friendRequestId?: string;
    friendId?: string;
    friendName?: string;
    friendEmail?: string;
    friendAvatar?: string;
    
    // Group-related data
    groupId?: string;
    groupName?: string;
    groupAvatar?: string;
    groupAddedBy?: string;
    removedBy?: string;
    adminChangedBy?: string;
    
    // Expense-related data
    expenseId?: string;
    expenseDescription?: string;
    amount?: number;
    currency?: string;
    paidBy?: string;
    paidTo?: string;
    expenseAddedBy?: string;
    editedBy?: string;
    deletedBy?: string;
    settledBy?: string;
    
    // Navigation data
    navigationType?: 'friends' | 'group' | 'groupChat' | 'groupMembers' | 'expenseDetails' | 'groupExpenses';
    tabToNavigate?: string;
    modalToShow?: string;
    
    // Action data
    canUndo?: boolean;
    undoTimeLimit?: number;
    
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export class AppNotificationService {
  private static instance: AppNotificationService;

  static getInstance(): AppNotificationService {
    if (!AppNotificationService.instance) {
      AppNotificationService.instance = new AppNotificationService();
    }
    return AppNotificationService.instance;
  }

  // Initialize notification system
  async initialize(): Promise<void> {
    try {
      console.log('🔔 AppNotificationService: Initializing...');
      
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Notification permissions not granted');
        return;
      }

      // Configure notification categories
      await this.setupNotificationCategories();
      
      // Set up notification handlers
      this.setupNotificationHandlers();
      
      console.log('✅ AppNotificationService: Initialized successfully');
    } catch (error) {
      console.error('❌ AppNotificationService: Initialization failed:', error);
    }
  }

  // Setup notification categories with actions
  private async setupNotificationCategories(): Promise<void> {
    try {
      // Friend request category
      await Notifications.setNotificationCategoryAsync('friend_request', [
        {
          identifier: 'accept_friend',
          buttonTitle: 'Accept',
          options: { opensAppToForeground: true }
        },
        {
          identifier: 'decline_friend',
          buttonTitle: 'Decline',
          options: { opensAppToForeground: false }
        }
      ]);

      // Group notification category
      await Notifications.setNotificationCategoryAsync('group_notification', [
        {
          identifier: 'view_group',
          buttonTitle: 'View Group',
          options: { opensAppToForeground: true }
        }
      ]);

      // Expense notification category
      await Notifications.setNotificationCategoryAsync('expense_notification', [
        {
          identifier: 'view_expense',
          buttonTitle: 'View Details',
          options: { opensAppToForeground: true }
        },
        {
          identifier: 'undo_action',
          buttonTitle: 'Undo',
          options: { opensAppToForeground: true }
        }
      ]);

      console.log('✅ AppNotificationService: Notification categories set up');
    } catch (error) {
      console.error('❌ AppNotificationService: Failed to setup categories:', error);
    }
  }

  // Setup notification handlers
  private setupNotificationHandlers(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📱 Notification received in foreground:', notification);
      // Show in-app notification or update badge
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      this.handleNotificationTap(response);
    });
  }

  // Handle notification tap and navigation
  private async handleNotificationTap(response: Notifications.NotificationResponse): Promise<void> {
    try {
      const { notification, actionIdentifier } = response;
      const data = notification.request.content.data as AppNotification['data'];
      
      console.log('🔄 Handling notification tap:', { actionIdentifier, data });

      // Handle specific actions
      switch (actionIdentifier) {
        case 'accept_friend':
          if (data.friendRequestId) {
            await this.handleAcceptFriendRequest(data.friendRequestId);
          }
          break;
          
        case 'decline_friend':
          if (data.friendRequestId) {
            await this.handleDeclineFriendRequest(data.friendRequestId);
          }
          break;
          
        case 'view_group':
          this.navigateToGroup(data.groupId);
          break;
          
        case 'view_expense':
          this.navigateToExpense(data.expenseId, data.groupId);
          break;
          
        case 'undo_action':
          await this.handleUndoAction(data);
          break;
          
        default:
          // Default tap action - navigate based on type
          this.navigateBasedOnType(data);
          break;
      }
    } catch (error) {
      console.error('❌ AppNotificationService: Failed to handle notification tap:', error);
    }
  }

  // Navigate based on notification type
  private navigateBasedOnType(data: AppNotification['data']): void {
    switch (data.navigationType) {
      case 'friends':
        this.navigateToFriends();
        break;
      case 'group':
        this.navigateToGroup(data.groupId);
        break;
      case 'groupChat':
        this.navigateToGroupChat(data.groupId);
        break;
      case 'groupMembers':
        this.navigateToGroupMembers(data.groupId);
        break;
      case 'expenseDetails':
        this.navigateToExpense(data.expenseId, data.groupId);
        break;
      case 'groupExpenses':
        this.navigateToGroupExpenses(data.groupId);
        break;
      default:
        console.log('🔍 No specific navigation for type:', data.navigationType);
        break;
    }
  }

  // Navigation methods (these will use your app's navigation system)
  private navigateToFriends(): void {
    // Navigate to Split tab -> Friends section
    Linking.openURL('spendy://split/friends');
  }

  private navigateToGroup(groupId?: string): void {
    if (groupId) {
      Linking.openURL(`spendy://split/group/${groupId}`);
    }
  }

  private navigateToGroupChat(groupId?: string): void {
    if (groupId) {
      Linking.openURL(`spendy://split/group/${groupId}/chat`);
    }
  }

  private navigateToGroupMembers(groupId?: string): void {
    if (groupId) {
      Linking.openURL(`spendy://split/group/${groupId}/members`);
    }
  }

  private navigateToExpense(expenseId?: string, groupId?: string): void {
    if (expenseId && groupId) {
      Linking.openURL(`spendy://split/group/${groupId}/expense/${expenseId}`);
    }
  }

  private navigateToGroupExpenses(groupId?: string): void {
    if (groupId) {
      Linking.openURL(`spendy://split/group/${groupId}/expenses`);
    }
  }

  // Friend request handlers
  private async handleAcceptFriendRequest(friendRequestId: string): Promise<void> {
    try {
      console.log('🤝 Accepting friend request:', friendRequestId);
      // Call your API to accept friend request
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/friends/requests/${friendRequestId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        console.log('✅ Friend request accepted');
        this.navigateToFriends();
      }
    } catch (error) {
      console.error('❌ Failed to accept friend request:', error);
    }
  }

  private async handleDeclineFriendRequest(friendRequestId: string): Promise<void> {
    try {
      console.log('❌ Declining friend request:', friendRequestId);
      // Call your API to decline friend request
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/friends/requests/${friendRequestId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        console.log('✅ Friend request declined');
      }
    } catch (error) {
      console.error('❌ Failed to decline friend request:', error);
    }
  }

  // Undo action handler
  private async handleUndoAction(data: AppNotification['data']): Promise<void> {
    try {
      console.log('↩️ Handling undo action:', data);
      
      if (data.expenseId && data.canUndo) {
        // Call undo API based on the original action
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/expenses/${data.expenseId}/undo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          console.log('✅ Undo action completed');
          this.navigateToGroupExpenses(data.groupId);
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle undo action:', error);
    }
  }

  // Send notification to user
  async sendNotification(notification: Omit<AppNotification, 'id' | 'createdAt'>): Promise<string> {
    try {
      console.log('📤 Sending notification:', notification.title);
      
      const notificationData: Omit<AppNotification, 'id'> = {
        ...notification,
        createdAt: new Date()
      };
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'appNotifications'), {
        ...notificationData,
        createdAt: serverTimestamp()
      });
      
      // Send push notification
      await this.sendPushNotification(notification);
      
      console.log('✅ Notification sent with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      throw error;
    }
  }

  // Send push notification
  private async sendPushNotification(notification: Omit<AppNotification, 'id' | 'createdAt'>): Promise<void> {
    try {
      const categoryId = this.getCategoryForNotificationType(notification.type);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: notification.data,
          categoryIdentifier: categoryId,
          sound: true,
          badge: 1
        },
        trigger: null // Send immediately
      });
      
      console.log('✅ Push notification sent');
    } catch (error) {
      console.error('❌ Failed to send push notification:', error);
    }
  }

  // Get notification category for type
  private getCategoryForNotificationType(type: AppNotification['type']): string {
    switch (type) {
      case 'friend_request':
      case 'friend_request_reminder':
        return 'friend_request';
      case 'group_created':
      case 'group_member_added':
      case 'group_admin_changed':
      case 'group_member_removed':
        return 'group_notification';
      case 'expense_added':
      case 'expense_edited':
      case 'expense_deleted':
      case 'expense_settled':
        return 'expense_notification';
      default:
        return 'default';
    }
  }

  // Get user notifications
  async getUserNotifications(userId: string, limitCount: number = 50): Promise<AppNotification[]> {
    try {
      const notificationsQuery = query(
        collection(db, 'appNotifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(notificationsQuery);
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as AppNotification[];
      
      return notifications;
    } catch (error) {
      console.error('❌ Failed to get user notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'appNotifications', notificationId), {
        isRead: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
    }
  }

  // Listen to user notifications in real-time
  onUserNotifications(userId: string, callback: (notifications: AppNotification[]) => void): () => void {
    const notificationsQuery = query(
      collection(db, 'appNotifications'),
      where('userId', '==', userId),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    return onSnapshot(notificationsQuery, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as AppNotification[];
      
      callback(notifications);
    });
  }

  // Clean up old notifications
  async cleanupOldNotifications(userId: string, daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const oldNotificationsQuery = query(
        collection(db, 'appNotifications'),
        where('userId', '==', userId),
        where('createdAt', '<', cutoffDate)
      );
      
      const snapshot = await getDocs(oldNotificationsQuery);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      console.log(`✅ Cleaned up ${snapshot.docs.length} old notifications`);
    } catch (error) {
      console.error('❌ Failed to cleanup old notifications:', error);
    }
  }
}

export default AppNotificationService;
