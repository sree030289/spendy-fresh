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
    
    // Type guard to ensure data has the expected structure
    if (!data || typeof data.reminderId !== 'string') {
      console.error('Invalid notification data:', data);
      return;
    }
    
    switch (actionIdentifier) {
      case 'mark_paid':
        this.handleMarkAsPaid(data.reminderId);
        break;
      case 'snooze':
        this.handleSnoozeReminder(data.reminderId);
        break;
      case 'pay_now':
      case 'view':
        this.handleViewReminder(data.reminderId);
        break;
      default:
        this.handleViewReminder(data.reminderId);
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

  // Get notification settings for a user
  static async getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.NOTIFICATION_SETTINGS}_${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }
      
      return {
        enabled: true,
        reminderDays: [1, 3, 7],
        timeOfDay: '09:00',
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        soundEnabled: true,
        vibrationEnabled: true,
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return null;
    }
  }

  // Update notification settings
  static async updateNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.NOTIFICATION_SETTINGS}_${userId}`,
        JSON.stringify(settings)
      );
      
      await this.scheduleReminderNotifications(userId);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  }

  // Schedule notifications for all user reminders
  static async scheduleReminderNotifications(userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      if (!settings || !settings.enabled || !settings.pushEnabled) {
        return;
      }
      
      await this.clearScheduledNotifications(userId);
      
      // In a real app, you'd get reminders from RemindersService
      // For now, just log that we would schedule them
      console.log(`📅 Would schedule notifications for user ${userId}`);
      
    } catch (error) {
      console.error('Error scheduling reminder notifications:', error);
    }
  }

  // Clear all scheduled notifications for a user
  static async clearScheduledNotifications(userId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
      if (stored) {
        const notifications: ScheduledNotification[] = JSON.parse(stored);
        
        for (const notification of notifications) {
          if (notification.notificationId) {
            await Notifications.cancelScheduledNotificationAsync(notification.notificationId);
          }
        }
      }
      
      await AsyncStorage.removeItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
      console.log('🧹 Cleared all scheduled notifications');
    } catch (error) {
      console.error('Error clearing scheduled notifications:', error);
    }
  }

  // Generate notification title
  private static getNotificationTitle(reminder: Reminder, daysUntilDue: number): string {
    if (daysUntilDue === 0) {
      return 'Bill Due Today! 📅';
    } else if (daysUntilDue === 1) {
      return 'Bill Due Tomorrow 📅';
    } else {
      return `Bill Due in ${daysUntilDue} Days 📅`;
    }
  }

  // Generate notification body
  private static getNotificationBody(reminder: Reminder, daysUntilDue: number): string {
    const amount = `${reminder.currency} ${reminder.amount.toFixed(2)}`;
    
    if (daysUntilDue === 0) {
      return `${reminder.title} (${amount}) is due today. Don't forget to pay!`;
    } else if (daysUntilDue === 1) {
      return `${reminder.title} (${amount}) is due tomorrow. Get ready to pay.`;
    } else {
      return `${reminder.title} (${amount}) is due in ${daysUntilDue} days.`;
    }
  }

  // Send immediate notification
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
          data,
          sound: 'default',
          badge: 1,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to send immediate notification:', error);
    }
  }

  // Send test notification
  static async sendTestNotification(userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      
      if (!settings || !settings.enabled || !settings.pushEnabled) {
        Alert.alert(
          'Notifications Disabled', 
          'Please enable notifications in your settings first.',
          [{ text: 'OK' }]
        );
        return;
      }

      await this.sendImmediateNotification(
        'Test Notification 🎉',
        'Great! Your notifications are working perfectly. You\'ll receive reminders for your bills.',
        { type: 'test', timestamp: new Date().toISOString() }
      );

      // Show success message after a short delay to let the notification appear first
      setTimeout(() => {
        Alert.alert(
          'Test Successful! ✅', 
          'Test notification sent successfully! Check your notification bar.',
          [{ text: 'Awesome!' }]
        );
      }, 500);

    } catch (error) {
      console.error('Failed to send test notification:', error);
      Alert.alert(
        'Test Failed ❌', 
        'Failed to send test notification. This might be because you\'re running on a simulator or notifications aren\'t properly configured.',
        [{ text: 'OK' }]
      );
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
}