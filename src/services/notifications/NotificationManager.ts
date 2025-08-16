// src/services/notifications/NotificationManager.ts
import AppNotificationService from './AppNotificationService';
import FriendNotificationService from './FriendNotificationService';
import GroupNotificationService from './GroupNotificationService';
import ExpenseNotificationService from './ExpenseNotificationService';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

interface DeepLinkData {
  type: 'friend_request' | 'group_invite' | 'expense_view' | 'group_view';
  id: string;
  [key: string]: any;
}

export class NotificationManager {
  private static instance: NotificationManager;
  private appNotificationService: AppNotificationService;
  private friendNotificationService: FriendNotificationService;
  private groupNotificationService: GroupNotificationService;
  private expenseNotificationService: ExpenseNotificationService;
  private navigationCallback?: (route: string, params?: any) => void;

  constructor() {
    this.appNotificationService = AppNotificationService.getInstance();
    this.friendNotificationService = FriendNotificationService.getInstance();
    this.groupNotificationService = GroupNotificationService.getInstance();
    this.expenseNotificationService = ExpenseNotificationService.getInstance();
  }

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  // Initialize the notification system
  async initialize(userId: string, navigationCallback?: (route: string, params?: any) => void): Promise<void> {
    try {
      console.log('🚀 NotificationManager: Initializing for user:', userId);
      
      // Store navigation callback
      this.navigationCallback = navigationCallback;

      // Initialize app notification service
      await this.appNotificationService.initialize();

      // Set up deep linking
      this.setupDeepLinking();

      // Set up notification listeners
      this.setupNotificationListeners(userId);

      console.log('✅ NotificationManager: Initialized successfully');
    } catch (error) {
      console.error('❌ NotificationManager: Initialization failed:', error);
      throw error;
    }
  }

  // Setup deep linking
  private setupDeepLinking(): void {
    // Handle incoming deep links when app is already open
    Linking.addEventListener('url', (event) => {
      this.handleDeepLink(event.url);
    });

    // Handle deep link when app is opened from closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        this.handleDeepLink(url);
      }
    });
  }

  // Handle deep link navigation
  private async handleDeepLink(url: string): Promise<void> {
    try {
      console.log('🔗 Handling deep link:', url);

      const parsed = Linking.parse(url);
      const { hostname, path, queryParams } = parsed;

      switch (hostname) {
        case 'friend-request':
          await this.handleFriendRequestDeepLink(path?.split('/')[1] || '', queryParams);
          break;
        case 'group':
          await this.handleGroupDeepLink(path?.split('/')[1] || '', queryParams);
          break;
        case 'expense':
          await this.handleExpenseDeepLink(path?.split('/')[1] || '', queryParams);
          break;
        case 'split':
          this.handleSplitTabDeepLink(path || '', queryParams);
          break;
        default:
          console.log('🔍 Unknown deep link type:', hostname);
          break;
      }
    } catch (error) {
      console.error('❌ Failed to handle deep link:', error);
    }
  }

  // Handle friend request deep link
  private async handleFriendRequestDeepLink(friendRequestId: string, params: any): Promise<void> {
    try {
      console.log('🤝 Handling friend request deep link:', friendRequestId);

      if (this.navigationCallback) {
        // Navigate to friend request modal
        this.navigationCallback('FriendRequestModal', {
          friendRequestId,
          fromDeepLink: true
        });
      }
    } catch (error) {
      console.error('❌ Failed to handle friend request deep link:', error);
    }
  }

  // Handle group deep link
  private async handleGroupDeepLink(groupId: string, params: any): Promise<void> {
    try {
      console.log('👥 Handling group deep link:', groupId);

      const section = params.section || 'overview';

      if (this.navigationCallback) {
        switch (section) {
          case 'chat':
            this.navigationCallback('GroupChatModal', { groupId });
            break;
          case 'members':
            this.navigationCallback('GroupMembersModal', { groupId });
            break;
          case 'expenses':
            this.navigationCallback('GroupExpensesModal', { groupId });
            break;
          default:
            this.navigationCallback('GroupDetailsModal', { groupId });
            break;
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle group deep link:', error);
    }
  }

  // Handle expense deep link
  private async handleExpenseDeepLink(expenseId: string, params: any): Promise<void> {
    try {
      console.log('💰 Handling expense deep link:', expenseId);

      if (this.navigationCallback) {
        this.navigationCallback('ExpenseDetailsModal', {
          expenseId,
          groupId: params.groupId,
          canEdit: params.canEdit === 'true',
          canUndo: params.canUndo === 'true'
        });
      }
    } catch (error) {
      console.error('❌ Failed to handle expense deep link:', error);
    }
  }

  // Handle split tab deep link
  private handleSplitTabDeepLink(path: string, params: any): void {
    try {
      console.log('📱 Handling split tab deep link:', path);

      if (this.navigationCallback) {
        const sections = path.split('/').filter(Boolean);
        
        switch (sections[0]) {
          case 'friends':
            this.navigationCallback('SplitScreen', { initialTab: 'friends' });
            break;
          case 'group':
            if (sections[1]) {
              this.navigationCallback('GroupDetailsModal', { groupId: sections[1] });
            } else {
              this.navigationCallback('SplitScreen', { initialTab: 'groups' });
            }
            break;
          default:
            this.navigationCallback('SplitScreen', {});
            break;
        }
      }
    } catch (error) {
      console.error('❌ Failed to handle split tab deep link:', error);
    }
  }

  // Setup notification listeners
  private setupNotificationListeners(userId: string): void {
    // Listen to real-time notifications
    this.appNotificationService.onUserNotifications(userId, (notifications) => {
      console.log('🔔 Received notifications update:', notifications.length);
      
      // Update app badge
      this.updateAppBadge(notifications.length);
      
      // Handle any immediate actions needed
      notifications.forEach(notification => {
        this.handleNotificationReceived(notification);
      });
    });
  }

  // Handle notification received
  private handleNotificationReceived(notification: any): void {
    try {
      console.log('📬 Notification received:', notification.type);

      // You can add custom logic here for different notification types
      switch (notification.type) {
        case 'friend_request':
          // Maybe show an in-app banner
          break;
        case 'expense_added':
          // Update any cached data
          break;
        // Add more cases as needed
      }
    } catch (error) {
      console.error('❌ Failed to handle notification received:', error);
    }
  }

  // Update app badge
  private updateAppBadge(count: number): void {
    try {
      if (Platform.OS === 'ios') {
        // Set iOS badge count
        // This would typically use Expo Notifications.setBadgeCountAsync
      }
    } catch (error) {
      console.error('❌ Failed to update app badge:', error);
    }
  }

  // Public methods to send notifications

  // Friend-related notifications
  async sendFriendRequest(friendRequestData: any): Promise<void> {
    return this.friendNotificationService.sendFriendRequestNotification(
      friendRequestData,
      friendRequestData.isNewUser
    );
  }

  async sendFriendRequestAccepted(friendRequest: any, acceptedByUserName: string): Promise<void> {
    return this.friendNotificationService.sendFriendRequestAcceptedNotification(
      friendRequest,
      acceptedByUserName
    );
  }

  async sendFriendRequestDeclined(friendRequest: any, declinedByUserName: string): Promise<void> {
    return this.friendNotificationService.sendFriendRequestDeclinedNotification(
      friendRequest,
      declinedByUserName
    );
  }

  async sendFriendRemoved(removedUserId: string, removedByUserId: string, removedByUserName: string, isBlocked: boolean = false): Promise<void> {
    return this.friendNotificationService.sendFriendRemovedNotification(
      removedUserId,
      removedByUserId,
      removedByUserName,
      isBlocked
    );
  }

  // Group-related notifications
  async sendGroupCreated(group: any, createdByUserName: string): Promise<void> {
    return this.groupNotificationService.sendGroupCreatedNotification(group, createdByUserName);
  }

  async sendGroupMemberAdded(group: any, newMember: any, addedByUserId: string, addedByUserName: string): Promise<void> {
    return this.groupNotificationService.sendGroupMemberAddedNotification(
      group,
      newMember,
      addedByUserId,
      addedByUserName
    );
  }

  async sendAdminChanged(group: any, targetMember: any, changedByUserId: string, changedByUserName: string, isPromoted: boolean): Promise<void> {
    return this.groupNotificationService.sendAdminChangedNotification(
      group,
      targetMember,
      changedByUserId,
      changedByUserName,
      isPromoted
    );
  }

  async sendMemberRemoved(group: any, removedMember: any, removedByUserId: string, removedByUserName: string): Promise<void> {
    return this.groupNotificationService.sendMemberRemovedNotification(
      group,
      removedMember,
      removedByUserId,
      removedByUserName
    );
  }

  async sendQRInviteAccepted(group: any, newMember: any, inviteCode: string): Promise<void> {
    return this.groupNotificationService.sendQRInviteAcceptedNotification(
      group,
      newMember,
      inviteCode
    );
  }

  // Expense-related notifications
  async sendExpenseAdded(expense: any, groupName: string, groupMembers: any[]): Promise<void> {
    return this.expenseNotificationService.sendExpenseAddedNotification(
      expense,
      groupName,
      groupMembers
    );
  }

  async sendExpenseEdited(expense: any, groupName: string, groupMembers: any[], editedFields: string[]): Promise<void> {
    return this.expenseNotificationService.sendExpenseEditedNotification(
      expense,
      groupName,
      groupMembers,
      editedFields
    );
  }

  async sendExpenseDeleted(expense: any, groupName: string, groupMembers: any[], canUndo: boolean = true, undoTimeLimit: number = 30000): Promise<void> {
    return this.expenseNotificationService.sendExpenseDeletedNotification(
      expense,
      groupName,
      groupMembers,
      canUndo,
      undoTimeLimit
    );
  }

  async sendSettlement(settlement: any, groupName: string, groupMembers: any[]): Promise<void> {
    return this.expenseNotificationService.sendSettlementNotification(
      settlement,
      groupName,
      groupMembers
    );
  }

  // Utility methods
  async markNotificationAsRead(notificationId: string): Promise<void> {
    return this.appNotificationService.markAsRead(notificationId);
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<any[]> {
    return this.appNotificationService.getUserNotifications(userId, limit);
  }

  async cleanupOldNotifications(userId: string, daysOld: number = 30): Promise<void> {
    return this.appNotificationService.cleanupOldNotifications(userId, daysOld);
  }
}

export default NotificationManager;
