// src/services/notifications/RealNotificationService.ts
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Reminder } from '@/types/reminder';

interface NotificationSettings {
  enabled: boolean;
  reminderDays: number[];
  timeOfDay: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

interface ScheduledNotification {
  id: string;
  reminderId: string;
  scheduledFor: Date;
  type: 'due_soon' | 'overdue' | 'daily_summary';
  title: string;
  body: string;
  data?: any;
  notificationId?: string;
}

const STORAGE_KEYS = {
  NOTIFICATION_SETTINGS: '@spendy_notification_settings',
  SCHEDULED_NOTIFICATIONS: '@spendy_scheduled_notifications',
  PUSH_TOKEN: '@spendy_push_token',
  LAST_NOTIFICATION_CHECK: '@spendy_last_notification_check',
};

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class RealNotificationService {
  private static pushToken: string | null = null;
  
  // Initialize notification system
  static async initialize(): Promise<boolean> {
    try {
      console.log('🔔 Initializing notification service...');
      
      if (!Device.isDevice) {
        console.log('⚠️ Running on simulator - using demo mode for notifications');
        // On simulator, we'll still set up the service but skip real push tokens
        await this.registerForPushNotifications();
        await this.setupNotificationCategories();
        this.setupNotificationHandlers();
        console.log('✅ Notification service initialized in demo mode');
        return true;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Notification permissions not granted');
        Alert.alert(
          'Notifications Disabled',
          'To receive bill reminders, please enable notifications in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }

      await this.registerForPushNotifications();
      await this.setupNotificationCategories();
      this.setupNotificationHandlers();

      console.log('✅ Notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error);
      console.log('🔄 Falling back to demo mode...');
      
      // Fallback to demo mode
      try {
        await this.registerForPushNotifications();
        await this.setupNotificationCategories();
        this.setupNotificationHandlers();
        console.log('✅ Notification service initialized in fallback demo mode');
        return true;
      } catch (fallbackError) {
        console.error('❌ Even fallback initialization failed:', fallbackError);
        return false;
      }
    }
  }

  // Register for push notifications and get token
  private static async registerForPushNotifications(): Promise<string | null> {
    try {
      // For demo purposes, we'll skip getting the actual push token
      // In production, you'd need a real Expo project ID
      console.log('📱 Simulating push token registration (demo mode)');
      
      // Generate a mock token for demo purposes
      const mockToken = `ExponentPushToken[demo-${Math.random().toString(36).substr(2, 20)}]`;
      this.pushToken = mockToken;
      
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, this.pushToken);
      
      console.log('📱 Mock push token generated for demo:', this.pushToken.substring(0, 30) + '...');
      return this.pushToken;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  // **MISSING METHOD ADDED** - Register token with backend
  static async registerTokenWithBackend(userId: string): Promise<void> {
    try {
      if (!this.pushToken) {
        await this.registerForPushNotifications();
      }
      
      if (this.pushToken) {
        // Store token associated with user
        await AsyncStorage.setItem(`${STORAGE_KEYS.PUSH_TOKEN}_${userId}`, this.pushToken);
        console.log(`✅ Registered push token for user ${userId}`);
        
        // In a real app, you'd send this to your backend:
        // await fetch('/api/users/register-push-token', {
        //   method: 'POST',
        //   body: JSON.stringify({ userId, token: this.pushToken })
        // });
      }
    } catch (error) {
      console.error('Failed to register token with backend:', error);
      throw error;
    }
  }

  // **MISSING METHOD ADDED** - Schedule reminder notification (singular)
  static async scheduleReminderNotification(reminder: Reminder, userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      if (!settings || !settings.enabled || !settings.pushEnabled) {
        return;
      }

      // Schedule notifications for each reminder day
      for (const days of settings.reminderDays) {
        const notificationDate = new Date(reminder.dueDate);
        notificationDate.setDate(notificationDate.getDate() - days);
        
        const [hours, minutes] = settings.timeOfDay.split(':').map(Number);
        notificationDate.setHours(hours, minutes, 0, 0);
        
        if (notificationDate > new Date()) {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: this.getNotificationTitle(reminder, days),
              body: this.getNotificationBody(reminder, days),
              data: {
                reminderId: reminder.id,
                daysUntilDue: days,
                amount: reminder.amount,
                currency: reminder.currency,
              },
              sound: settings.soundEnabled ? 'default' : undefined,
              categoryIdentifier: 'bill_reminder',
              badge: 1,
            },
            trigger: { 
              type: SchedulableTriggerInputTypes.DATE,
              date: notificationDate 
            },
          });
          
          console.log(`🔔 Scheduled notification for ${reminder.title} - ${days} days before`);
        }
      }
    } catch (error) {
      console.error('Failed to schedule reminder notification:', error);
    }
  }

  // **MISSING METHOD ADDED** - Cancel reminder notifications
  static async cancelReminderNotifications(reminderId: string, userId: string): Promise<void> {
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      
      const toCancel = allScheduled.filter(notification => 
        notification.content.data?.reminderId === reminderId
      );

      for (const notification of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log(`🔕 Cancelled notification: ${notification.identifier}`);
      }
    } catch (error) {
      console.error('Failed to cancel reminder notifications:', error);
    }
  }

  // Setup notification categories with actions
  private static async setupNotificationCategories(): Promise<void> {
    try {
      await Notifications.setNotificationCategoryAsync('bill_reminder', [
        {
          identifier: 'mark_paid',
          buttonTitle: 'Mark as Paid',
          options: {
            isDestructive: false,
            isAuthenticationRequired: true,
          },
        },
        {
          identifier: 'snooze',
          buttonTitle: 'Remind Later',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'view',
          buttonTitle: 'View Details',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
            opensAppToForeground: true,
          },
        },
      ]);

      await Notifications.setNotificationCategoryAsync('overdue_bill', [
        {
          identifier: 'pay_now',
          buttonTitle: 'Pay Now',
          options: {
            isDestructive: false,
            isAuthenticationRequired: true,
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'mark_paid',
          buttonTitle: 'Mark as Paid',
          options: {
            isDestructive: false,
            isAuthenticationRequired: true,
          },
        },
      ]);

      // **NEW** Friend request notification category
      await Notifications.setNotificationCategoryAsync('friend_request', [
        {
          identifier: 'accept_friend',
          buttonTitle: 'Accept',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'decline_friend',
          buttonTitle: 'Decline',
          options: {
            isDestructive: true,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'view_request',
          buttonTitle: 'View',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
            opensAppToForeground: true,
          },
        },
      ]);

      // **NEW** Group invitation notification category
      await Notifications.setNotificationCategoryAsync('group_invitation', [
        {
          identifier: 'join_group',
          buttonTitle: 'Join',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'decline_invite',
          buttonTitle: 'Decline',
          options: {
            isDestructive: true,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'view_group',
          buttonTitle: 'View',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
            opensAppToForeground: true,
          },
        },
      ]);

      // **NEW** Expense notification category
      await Notifications.setNotificationCategoryAsync('expense_notification', [
        {
          identifier: 'view_expense',
          buttonTitle: 'View',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'split_expense',
          buttonTitle: 'Split',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
            opensAppToForeground: true,
          },
        },
      ]);

      // **NEW** General notification category for other app notifications
      await Notifications.setNotificationCategoryAsync('app_notification', [
        {
          identifier: 'view_notification',
          buttonTitle: 'View',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'dismiss',
          buttonTitle: 'Dismiss',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
      ]);

      console.log('✅ Notification categories set up successfully');
    } catch (error) {
      console.error('Failed to setup notification categories:', error);
    }
  }

  // Setup notification event handlers
  private static setupNotificationHandlers(): void {
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📩 Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      this.handleNotificationResponse(response);
    });
  }

  // Handle notification received while app is in foreground
  private static handleNotificationReceived(notification: Notifications.Notification): void {
    const { data } = notification.request.content;
    this.updateBadgeCount();
    console.log('Notification received in foreground:', data);
  }

  // Handle notification response (tapped/action)
  private static handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { notification, actionIdentifier } = response;
    const { data } = notification.request.content;
    
    console.log('Notification response:', { actionIdentifier, data });
    
    // Handle different types of notification actions
    switch (actionIdentifier) {
      // **EXISTING** Bill reminder actions
      case 'mark_paid':
        if (data && typeof data.reminderId === 'string') {
          this.handleMarkAsPaid(data.reminderId);
        }
        break;
      case 'snooze':
        if (data && typeof data.reminderId === 'string') {
          this.handleSnoozeReminder(data.reminderId);
        }
        break;
      case 'pay_now':
      case 'view':
        if (data && typeof data.reminderId === 'string') {
          this.handleViewReminder(data.reminderId);
        }
        break;

      // **NEW** Friend request actions
      case 'accept_friend':
        if (data && typeof data.friendRequestId === 'string') {
          this.handleAcceptFriendRequest(
            data.friendRequestId, 
            typeof data.senderName === 'string' ? data.senderName : undefined
          );
        }
        break;
      case 'decline_friend':
        if (data && typeof data.friendRequestId === 'string') {
          this.handleDeclineFriendRequest(
            data.friendRequestId, 
            typeof data.senderName === 'string' ? data.senderName : undefined
          );
        }
        break;
      case 'view_request':
        if (data && typeof data.friendRequestId === 'string') {
          this.handleViewFriendRequest(data.friendRequestId);
        }
        break;

      // **NEW** Group invitation actions
      case 'join_group':
        if (data && typeof data.inviteCode === 'string') {
          this.handleJoinGroup(
            data.inviteCode,
            typeof data.groupName === 'string' ? data.groupName : undefined,
            typeof data.senderName === 'string' ? data.senderName : undefined
          );
        }
        break;
      case 'decline_invite':
        if (data) {
          this.handleDeclineGroupInvite(
            typeof data.groupName === 'string' ? data.groupName : undefined,
            typeof data.senderName === 'string' ? data.senderName : undefined
          );
        }
        break;
      case 'view_group':
        if (data && typeof data.groupId === 'string') {
          this.handleViewGroup(data.groupId);
        }
        break;

      // **NEW** Expense notification actions
      case 'view_expense':
        if (data && typeof data.expenseId === 'string') {
          this.handleViewExpense(
            data.expenseId,
            typeof data.groupId === 'string' ? data.groupId : undefined
          );
        }
        break;
      case 'split_expense':
        if (data && typeof data.expenseId === 'string') {
          this.handleSplitExpense(
            data.expenseId,
            typeof data.groupId === 'string' ? data.groupId : undefined
          );
        }
        break;

      // **NEW** General app notification actions
      case 'view_notification':
        this.handleViewNotification(data);
        break;
      case 'dismiss':
        console.log('Notification dismissed');
        break;

      // Default case - typically means user tapped the notification itself
      default:
        this.handleDefaultNotificationTap(data);
        break;
    }
  }

  // Handle mark as paid action
  private static async handleMarkAsPaid(reminderId: string): Promise<void> {
    try {
      // This would call your RemindersService
      console.log('Marking reminder as paid:', reminderId);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Payment Recorded',
          body: 'Bill marked as paid successfully!',
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      Alert.alert('Error', 'Failed to mark bill as paid');
    }
  }

  // Handle snooze reminder action
  private static async handleSnoozeReminder(reminderId: string): Promise<void> {
    try {
      console.log('Snoozing reminder:', reminderId);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Reminder Snoozed',
          body: 'You\'ll be reminded again tomorrow',
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to snooze reminder:', error);
    }
  }

  // Handle view reminder action
  private static handleViewReminder(reminderId: string): void {
    console.log('Navigate to reminder:', reminderId);
  }

  // **NEW** Group invitation notification handlers
  private static async handleJoinGroup(inviteCode: string, groupName?: string, senderName?: string): Promise<void> {
    try {
      console.log('Joining group with invite code:', inviteCode);
      
      // Get current user to pass as parameter
      const { AuthService } = await import('@/services/firebase/auth');
      const currentUser = await AuthService.getCurrentUser();
      
      if (!currentUser) {
        console.error('No current user found');
        Alert.alert('Error', 'Please log in to join the group.');
        return;
      }
      
      // Import and use SplittingService to join the group
      const { SplittingService } = await import('@/services/firebase/splitting');
      await SplittingService.joinGroupByInviteCode(inviteCode, currentUser.id);
      
      // Show success notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Successfully Joined Group! 🎉',
          body: groupName ? `Welcome to ${groupName}!` : 'You have successfully joined the group!',
          sound: 'default',
        },
        trigger: null,
      });
      
      // Trigger app navigation to the group
      this.triggerAppNavigation({ 
        type: 'group_joined', 
        inviteCode,
        groupName,
        senderName
      });
      
    } catch (error) {
      console.error('Failed to join group:', error);
      Alert.alert('Error', 'Failed to join group. Please try again.');
    }
  }

  private static async handleDeclineGroupInvite(groupName?: string, senderName?: string): Promise<void> {
    try {
      console.log('Declining group invitation');
      
      // Show confirmation notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Group Invitation Declined',
          body: groupName ? `Declined invitation to ${groupName}` : 'Group invitation declined',
          sound: 'default',
        },
        trigger: null,
      });
      
    } catch (error) {
      console.error('Failed to decline group invitation:', error);
    }
  }

  private static handleViewGroup(groupId: string): void {
    console.log('Viewing group:', groupId);
    
    // Trigger app navigation to show group details
    this.triggerAppNavigation({ 
      type: 'group_details', 
      groupId,
      action: 'view'
    });
  }

  // **NEW** Expense notification handlers
  private static handleViewExpense(expenseId: string, groupId?: string): void {
    console.log('Viewing expense:', expenseId);
    
    // Trigger app navigation to show expense details
    this.triggerAppNavigation({ 
      type: 'expense_details', 
      expenseId,
      groupId,
      action: 'view'
    });
  }

  private static handleSplitExpense(expenseId: string, groupId?: string): void {
    console.log('Splitting expense:', expenseId);
    
    // Trigger app navigation to split expense
    this.triggerAppNavigation({ 
      type: 'split_expense', 
      expenseId,
      groupId,
      action: 'split'
    });
  }

  // **NEW** Friend request notification handlers
  private static async handleAcceptFriendRequest(friendRequestId: string, senderName?: string): Promise<void> {
    try {
      console.log('Accepting friend request:', friendRequestId);
      
      // Import and use SplittingService to accept the friend request
      const { SplittingService } = await import('@/services/firebase/splitting');
      await SplittingService.acceptFriendRequest(friendRequestId);
      
      // Show success notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Friend Request Accepted! 🎉',
          body: senderName ? `You are now friends with ${senderName}` : 'Friend request accepted successfully!',
          sound: 'default',
        },
        trigger: null,
      });
      
      // Trigger app navigation to friends screen
      this.triggerAppNavigation({ type: 'friend_request_accepted', friendRequestId });
      
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  }

  private static async handleDeclineFriendRequest(friendRequestId: string, senderName?: string): Promise<void> {
    try {
      console.log('Declining friend request:', friendRequestId);
      
      // Import and use SplittingService to decline the friend request
      const { SplittingService } = await import('@/services/firebase/splitting');
      await SplittingService.declineFriendRequest(friendRequestId);
      
      // Show confirmation notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Friend Request Declined',
          body: senderName ? `Declined friend request from ${senderName}` : 'Friend request declined',
          sound: 'default',
        },
        trigger: null,
      });
      
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  }

  private static handleViewFriendRequest(friendRequestId: string): void {
    console.log('Viewing friend request:', friendRequestId);
    
    // Trigger app navigation to show friend request modal
    this.triggerAppNavigation({ 
      type: 'friend_request', 
      friendRequestId,
      action: 'view'
    });
  }

  // **NEW** General notification handlers
  private static handleViewNotification(data: any): void {
    console.log('Viewing notification:', data);
    
    // Navigate based on notification type
    if (data?.type) {
      this.triggerAppNavigation(data);
    }
  }

  private static handleDefaultNotificationTap(data: any): void {
    console.log('Default notification tap:', data);
    
    // Handle notification tap based on data type
    if (data?.friendRequestId) {
      this.handleViewFriendRequest(data.friendRequestId);
    } else if (data?.reminderId) {
      this.handleViewReminder(data.reminderId);
    } else {
      this.triggerAppNavigation(data);
    }
  }

  // **NEW** App navigation trigger (for deep linking from notifications)
  private static triggerAppNavigation(data: any): void {
    console.log('Triggering app navigation:', data);
    
    // In a real implementation, this would use a navigation service or event emitter
    // to communicate with the app's navigation system
    
    // For now, we'll store the navigation intent and let the app pick it up
    this.setNavigationIntent(data);
  }

  // **NEW** Store navigation intent for app to pick up
  private static async setNavigationIntent(data: any): Promise<void> {
    try {
      await AsyncStorage.setItem('@notification_navigation_intent', JSON.stringify(data));
      console.log('Navigation intent stored:', data);
    } catch (error) {
      console.error('Failed to store navigation intent:', error);
    }
  }

  // **NEW** Get and clear navigation intent
  static async getAndClearNavigationIntent(): Promise<any | null> {
    try {
      const intent = await AsyncStorage.getItem('@notification_navigation_intent');
      if (intent) {
        await AsyncStorage.removeItem('@notification_navigation_intent');
        return JSON.parse(intent);
      }
      return null;
    } catch (error) {
      console.error('Failed to get navigation intent:', error);
      return null;
    }
  }

  // **NEW** Send friend request notification
  static async sendFriendRequestNotification(
    targetUserId: string,
    senderName: string,
    senderUserId: string,
    friendRequestId: string
  ): Promise<void> {
    try {
      console.log('Sending friend request notification to:', targetUserId);
      
      // In production, this would send a push notification via your backend
      // For demo purposes, we'll schedule a local notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Friend Request',
          body: `${senderName} wants to be your friend on Spendy`,
          data: {
            type: 'friend_request',
            friendRequestId,
            senderUserId,
            senderName,
          },
          sound: 'default',
          categoryIdentifier: 'friend_request',
          badge: 1,
        },
        trigger: null, // Immediate notification
      });
      
      console.log('✅ Friend request notification sent');
    } catch (error) {
      console.error('Failed to send friend request notification:', error);
    }
  }

  // Update app badge count
  static async updateBadgeCount(): Promise<void> {
    try {
      // In a real app, you'd get the count from RemindersService
      // For now, just set to 0
      await Notifications.setBadgeCountAsync(0);
      console.log('📱 Updated badge count');
    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  }

  // Get notification statistics
  static async getNotificationStats(userId: string): Promise<{
    totalScheduled: number;
    totalSent: number;
    lastSent: Date | null;
    permissionStatus: string;
    pushToken: string | null;
  }> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      
      return {
        totalScheduled: 0,
        totalSent: 0,
        lastSent: null,
        permissionStatus: status,
        pushToken: this.pushToken,
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return {
        totalScheduled: 0,
        totalSent: 0,
        lastSent: null,
        permissionStatus: 'undetermined',
        pushToken: null,
      };
    }
  }

  // Background notification check
  static async backgroundNotificationCheck(): Promise<void> {
    try {
      console.log('🔍 Background notification check...');
      // Implementation for background tasks
    } catch (error) {
      console.error('Background notification check failed:', error);
    }
  }

  // Cleanup
  static async cleanup(): Promise<void> {
    try {
      console.log('🧹 Notification service cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup notification service:', error);
    }
  }

  // **NEW** Helper methods for notification content
  private static async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem(`notification_settings_${userId}`);
      if (settings) {
        return JSON.parse(settings);
      }
      
      // Return default settings
      return {
        enabled: true,
        reminderDays: [1, 3, 7],
        timeOfDay: '09:00',
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        soundEnabled: true,
        vibrationEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return {
        enabled: true,
        reminderDays: [1, 3, 7],
        timeOfDay: '09:00',
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        soundEnabled: true,
        vibrationEnabled: true
      };
    }
  }

  private static getNotificationTitle(reminder: Reminder, days: number): string {
    if (days <= 0) {
      return `📋 ${reminder.title} - Due Today!`;
    } else if (days === 1) {
      return `📋 ${reminder.title} - Due Tomorrow`;
    } else {
      return `📋 ${reminder.title} - Due in ${days} days`;
    }
  }

  private static getNotificationBody(reminder: Reminder, days: number): string {
    let urgencyText = '';
    if (days <= 0) {
      urgencyText = 'This reminder is due today! ';
    } else if (days === 1) {
      urgencyText = 'This reminder is due tomorrow. ';
    } else {
      urgencyText = `This reminder is due in ${days} days. `;
    }
    
    return `${urgencyText}${reminder.description || 'Tap to view details.'}`;
  }
}