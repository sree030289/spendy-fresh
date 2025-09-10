// src/services/notifications/RealNotificationService.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Reminder } from '@/types/reminder';
import { CrossPlatformAlert } from '@/utils/alertUtils';

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
  private static fcmService: FCMService | null = null;
  
  // Initialize notification system
  static async initialize(userId?: string): Promise<boolean> {
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
        CrossPlatformAlert.alert(
          'Notifications Disabled',
          'To receive bill reminders, please enable notifications in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Initialize FCM if userId is provided
      if (userId) {
        this.fcmService = FCMService.getInstance();
        const fcmInitialized = await this.fcmService.initialize(userId);
        if (fcmInitialized) {
          console.log('✅ FCM service initialized');
        } else {
          console.log('⚠️ FCM service failed to initialize, continuing with local notifications');
        }
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
      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.log('📱 Push notifications are not supported on simulators');
        return null;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permissions not granted');
        return null;
      }

      // Get Expo push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.external?.expoProjectId || '8ba655ab-7839-4196-9893-2a71413248ed',
      });
      
      this.pushToken = token.data;
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, this.pushToken);
      
      console.log('✅ Push token obtained:', this.pushToken);
      return this.pushToken;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  // Force refresh push token (useful for fixing stale tokens)
  static async refreshPushToken(userId: string): Promise<void> {
    console.log('🔄 Refreshing push token...');
    this.pushToken = null; // Clear cached token
    await this.registerTokenWithBackend(userId);
  }

  // **MISSING METHOD ADDED** - Register token with backend
  static async registerTokenWithBackend(userId: string): Promise<void> {
    try {
      if (!this.pushToken) {
        await this.registerForPushNotifications();
      }
      
      if (this.pushToken) {
        // Store token associated with user locally
        await AsyncStorage.setItem(`${STORAGE_KEYS.PUSH_TOKEN}_${userId}`, this.pushToken);
        console.log(`✅ Registered push token for user ${userId}`);
        
        // Send token to backend server with retry mechanism
        await this.savePushTokenWithRetry(this.pushToken);
      }
    } catch (error) {
      console.error('Failed to register token with backend:', error);
      throw error;
    }
  }

  // **NEW** - Save push token with retry mechanism to handle auth timing issues
  private static async savePushTokenWithRetry(pushToken: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`💾 Saving push token to server (attempt ${attempt}/${maxRetries})`);
        const ApiService = (await import('@/services/api/ApiService')).ApiService;
        const apiService = ApiService.getInstance();
        
        // Check if ApiService has auth token before making request
        const hasToken = await this.checkApiServiceAuth(apiService);
        if (!hasToken && attempt < maxRetries) {
          console.log(`⏳ Auth token not ready yet, waiting before retry (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Progressive delay
          continue;
        }
        
        await apiService.savePushToken(pushToken);
        console.log('✅ Push token saved to server');
        return; // Success - exit retry loop
        
      } catch (serverError) {
        console.error(`❌ Failed to save push token to server (attempt ${attempt}/${maxRetries}):`, serverError);
        
        if (attempt === maxRetries) {
          console.log('⚠️ Push token save failed after all retries, but continuing app initialization');
          // Don't throw error - push token save is non-critical
          return;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // **NEW** - Check if ApiService has auth token set
  private static async checkApiServiceAuth(apiService: any): Promise<boolean> {
    try {
      // Try to check if the service has an auth token by calling a lightweight endpoint
      // This is better than checking private properties
      const authToken = await AsyncStorage.getItem('@spendy_auth_token');
      return !!authToken;
    } catch (error) {
      return false;
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
      // Skip notification categories on web as they're not supported
      if (Platform.OS === 'web') {
        console.log('🔔 Skipping notification categories setup on web platform');
        return;
      }
      
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
    console.log('📩 Notification received in foreground:', data);
    
    // For friend requests, immediately trigger the navigation
    if (data && data.type === 'friend_request') {
      console.log('🤝 Friend request notification received - triggering modal');
      this.triggerAppNavigation(data);
    }
    
    // For balance-affecting notifications, trigger balance refresh
    if (data && this.isBalanceAffectingNotification(data.type)) {
      console.log('💰 Balance-affecting notification received - triggering refresh');
      this.triggerBalanceRefresh();
    }
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
    
    // For balance-affecting notification actions, also trigger refresh
    if (this.isBalanceAffectingAction(actionIdentifier) || this.isBalanceAffectingNotification(data?.type)) {
      console.log('💰 Balance-affecting action performed - triggering refresh');
      this.triggerBalanceRefresh();
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
      CrossPlatformAlert.alert('Error', 'Failed to mark bill as paid');
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
        CrossPlatformAlert.alert('Error', 'Please log in to join the group.');
        return;
      }
      
      // Import and use SplittingService to join the group
      const { SplittingService } = await import('@/services/firebase/splitting-disabled');
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
      CrossPlatformAlert.alert('Error', 'Failed to join group. Please try again.');
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
      const { SplittingService } = await import('@/services/firebase/splitting-disabled');
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
      CrossPlatformAlert.alert('Error', 'Failed to accept friend request');
    }
  }

  private static async handleDeclineFriendRequest(friendRequestId: string, senderName?: string): Promise<void> {
    try {
      console.log('Declining friend request:', friendRequestId);
      
      // Import and use SplittingService to decline the friend request
      const { SplittingService } = await import('@/services/firebase/splitting-disabled');
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
      CrossPlatformAlert.alert('Error', 'Failed to decline friend request');
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
    
    // Store the navigation intent for the app to pick up
    this.setNavigationIntent(data);
    
    // Also try to trigger immediate navigation if app is in foreground
    this.triggerImmediateNavigation(data);
  }

  // **NEW** Add navigation response listener method for external use
  static addNotificationResponseListener(handler: (response: any) => void): any {
    return Notifications.addNotificationResponseReceivedListener(handler);
  }

  // **NEW** Try to trigger immediate navigation (used by App.tsx)
  private static triggerImmediateNavigation(data: any): void {
    // This will be picked up by the notification handler in App.tsx
    // The data contains deepLink information for PushNotificationManager
    console.log('📱 Immediate navigation trigger for deep link data:', data);
    
    // Use React Native DeviceEventEmitter instead of CustomEvent
    try {
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('notificationNavigation', data);
    } catch (error) {
      console.log('DeviceEventEmitter not available, relying on setNavigationIntent');
    }
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
    friendRequestId: string,
    senderEmail?: string,
    senderAvatar?: string
  ): Promise<void> {
    try {
      console.log('🔔 RealNotificationService - Sending friend request notification');
      console.log('🎯 Target User ID:', targetUserId);
      console.log('👤 Sender Name:', senderName);
      console.log('👤 Sender User ID:', senderUserId);
      console.log('📋 Friend Request ID:', friendRequestId);
      
      // In production, this would send a push notification via your backend
      // For demo purposes, we'll schedule a local notification
      const notificationContent = {
        title: 'New Friend Request',
        body: `${senderName} wants to be your friend on Spendy`,
        data: {
          type: 'friend_request',
          friendRequestId,
          fromUserId: senderUserId,
          senderUserId,
          senderName,
          senderEmail: senderEmail || '',
          senderAvatar: senderAvatar || '',
          message: `${senderName} wants to be your friend on Spendy`
        },
        sound: 'default',
        categoryIdentifier: 'friend_request',
        badge: 1,
      };
      
      console.log('📱 Scheduling local notification with content:', notificationContent);
      
      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Immediate notification
      });
      
      console.log('✅ Friend request notification sent successfully!');
      console.log('⚠️  NOTE: This is a LOCAL notification - it will appear on THIS device only.');
      console.log('⚠️  In production, this should be sent via FCM/APNS to the target user\'s device.');
      
    } catch (error) {
      console.error('❌ Failed to send friend request notification:', error);
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
      if (this.fcmService) {
        await this.fcmService.clearFCMData();
      }
      console.log('🧹 Notification service cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup notification service:', error);
    }
  }

  // **NEW** FCM Integration Methods

  /**
   * Get FCM token for current user
   */
  static async getFCMToken(): Promise<string | null> {
    try {
      if (this.fcmService) {
        return await this.fcmService.getToken();
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get FCM token:', error);
      return null;
    }
  }

  /**
   * Subscribe to group notifications via FCM topic
   */
  static async subscribeToGroup(groupId: string): Promise<void> {
    try {
      if (this.fcmService) {
        await this.fcmService.subscribeToTopic(`group_${groupId}`);
        console.log(`✅ Subscribed to group notifications: ${groupId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to subscribe to group ${groupId}:`, error);
    }
  }

  /**
   * Unsubscribe from group notifications
   */
  static async unsubscribeFromGroup(groupId: string): Promise<void> {
    try {
      if (this.fcmService) {
        await this.fcmService.unsubscribeFromTopic(`group_${groupId}`);
        console.log(`✅ Unsubscribed from group notifications: ${groupId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to unsubscribe from group ${groupId}:`, error);
    }
  }

  /**
   * Check for pending FCM actions and handle them
   */
  static async handlePendingFCMActions(): Promise<void> {
    try {
      const pendingAction = await FCMService.getPendingAction();
      if (pendingAction) {
        console.log('📋 Handling pending FCM action:', pendingAction.type);
        this.triggerAppNavigation(pendingAction);
      }
    } catch (error) {
      console.error('❌ Error handling pending FCM actions:', error);
    }
  }

  /**
   * Send real push notification to specific user (via backend)
   */
  static async sendPushNotificationToUser(
    targetUserId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      // This would call your backend API which then sends via FCM
      const response = await fetch('/api/notifications/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId,
          notification: {
            title,
            body,
            data: data || {}
          }
        })
      });

      if (response.ok) {
        console.log('✅ Push notification sent to user:', targetUserId);
      } else {
        console.error('❌ Failed to send push notification:', response.status);
      }
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
    }
  }

  /**
   * Send push notification to group (via FCM topic)
   */
  static async sendPushNotificationToGroup(
    groupId: string,
    title: string,
    body: string,
    data?: any,
    excludeUserId?: string
  ): Promise<void> {
    try {
      // This would call your backend API which then sends to FCM topic
      const response = await fetch('/api/notifications/send-group-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId,
          excludeUserId,
          notification: {
            title,
            body,
            data: data || {}
          }
        })
      });

      if (response.ok) {
        console.log('✅ Group push notification sent:', groupId);
      } else {
        console.error('❌ Failed to send group push notification:', response.status);
      }
    } catch (error) {
      console.error('❌ Error sending group push notification:', error);
    }
  }

  /**
   * Check if FCM is available and properly configured
   */
  static async isFCMAvailable(): Promise<boolean> {
    try {
      return await FCMService.isAvailable();
    } catch (error) {
      console.error('❌ Error checking FCM availability:', error);
      return false;
    }
  }

  // **PUBLIC** Get notification settings for user
  static async getNotificationSettings(userId: string): Promise<NotificationSettings> {
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

  // **PUBLIC** Update notification settings for user
  static async updateNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(`notification_settings_${userId}`, JSON.stringify(settings));
      console.log('✅ Notification settings updated for user:', userId);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      throw error;
    }
  }

  // **PUBLIC** Send test notification
  static async sendTestNotification(userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      
      if (!settings.enabled || !settings.pushEnabled) {
        CrossPlatformAlert.alert('Notifications Disabled', 'Please enable notifications in your settings first.');
        return;
      }

      await this.sendImmediateNotification(
        'Test Notification',
        'This is a test notification from Spendy. Your notifications are working perfectly!',
        { type: 'test' }
      );

      CrossPlatformAlert.alert('Test Sent', 'Test notification sent successfully!');
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      CrossPlatformAlert.alert('Test Failed', 'Failed to send test notification. Please check your notification settings.');
    }
  }

  // **PUBLIC** Send immediate notification
  static async sendImmediateNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          badge: 1,
          // Use consistent notification styling
          color: '#10B981',
          categoryIdentifier: data?.type || 'app_notification',
        },
        trigger: null, // Immediate notification
      });

      console.log(`🔔 Sent immediate notification: ${title}`);
    } catch (error) {
      console.error('❌ Failed to send immediate notification:', error);
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

  // **NEW** Check if notification type affects balances
  private static isBalanceAffectingNotification(type: string): boolean {
    const balanceAffectingTypes = [
      'expense_added',
      'expense_edited', 
      'expense_deleted',
      'expense_settled',
      'payment_confirmed',
      'payment_reminder',
      'group_created',
      'group_member_added',
      'group_member_removed',
      'friend_request_accepted'
    ];
    
    return balanceAffectingTypes.includes(type);
  }

  // **NEW** Check if notification action affects balances
  private static isBalanceAffectingAction(actionIdentifier: string): boolean {
    const balanceAffectingActions = [
      'mark_paid',
      'pay_now',
      'accept_friend',
      'join_group'
    ];
    
    return balanceAffectingActions.includes(actionIdentifier);
  }

  // **NEW** Trigger balance refresh across the app
  private static async triggerBalanceRefresh(): Promise<void> {
    try {
      console.log('💰 Triggering balance refresh...');
      
      // Clear settlement cache to ensure fresh calculations
      try {
        const { UnifiedSettlementService } = await import('@/hooks/useBalances');
        UnifiedSettlementService.clearBalanceCache();
        console.log('🧹 Settlement cache cleared');
      } catch (cacheError) {
        console.log('ℹ️ Settlement cache clear skipped (service not available)');
      }
      
      // Emit a custom event for balance refresh
      try {
        const { DeviceEventEmitter } = require('react-native');
        DeviceEventEmitter.emit('balanceRefreshRequired');
      } catch (error) {
        console.log('DeviceEventEmitter not available for balance refresh event');
      }
      
      // Store a flag in AsyncStorage for components to pick up
      await AsyncStorage.setItem('@balance_refresh_required', Date.now().toString());
      
      console.log('✅ Balance refresh triggered with cache clearing');
    } catch (error) {
      console.error('❌ Error triggering balance refresh:', error);
    }
  }
}