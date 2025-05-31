// src/services/notifications/RealNotificationService.ts
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { RemindersService } from '../reminders/RemindersService';
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
}

interface ScheduledNotification {
  id: string;
  reminderId: string;
  scheduledFor: Date;
  type: 'due_soon' | 'overdue' | 'daily_summary';
  title: string;
  body: string;
  data?: any;
  notificationId?: string; // Expo notification identifier
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
  }),
});

export class RealNotificationService {
  private static pushToken: string | null = null;
  
  // Initialize notification system
  static async initialize(): Promise<boolean> {
    try {
      console.log('🔔 Initializing notification service...');
      
      // Check if device supports notifications
      if (!Device.isDevice) {
        console.log('⚠️ Notifications only work on physical devices');
        return false;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return false;
      }

      // Get push token for remote notifications
      await this.registerForPushNotifications();

      // Set notification categories for actions
      await this.setupNotificationCategories();

      // Set up notification handlers
      this.setupNotificationHandlers();

      console.log('✅ Notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error);
      return false;
    }
  }

  // Register for push notifications and get token
  private static async registerForPushNotifications(): Promise<string | null> {
    try {
      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || 'your-project-id',
      });
      
      this.pushToken = tokenData.data;
      
      // Store token locally
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, this.pushToken);
      
      console.log('📱 Push token obtained:', this.pushToken.substring(0, 50) + '...');
      return this.pushToken;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
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
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📩 Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Handle notification tapped/clicked
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      this.handleNotificationResponse(response);
    });
  }

  // Handle notification received while app is in foreground
  private static handleNotificationReceived(notification: Notifications.Notification): void {
    const { data } = notification.request.content;
    
    // Update badge count
    this.updateBadgeCount();
    
    // Log for analytics
    console.log('Notification received in foreground:', data);
  }

  // Handle notification response (tapped/action)
  private static handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { notification, actionIdentifier } = response;
    const { data } = notification.request.content;
    
    console.log('Notification response:', { actionIdentifier, data });
    
    // Handle different actions
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
        // Default tap - navigate to reminders screen
        this.handleViewReminder(data.reminderId);
        break;
    }
  }

  // Handle mark as paid action
  private static async handleMarkAsPaid(reminderId: string): Promise<void> {
    try {
      await RemindersService.markAsPaid(reminderId);
      
      // Show success notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Payment Recorded',
          body: 'Bill marked as paid successfully!',
          sound: 'default',
        },
        trigger: null, // Immediate
      });
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      Alert.alert('Error', 'Failed to mark bill as paid');
    }
  }

  // Handle snooze reminder action
  private static async handleSnoozeReminder(reminderId: string): Promise<void> {
    try {
      // Snooze for 1 day
      const snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + 1);
      
      await RemindersService.updateReminder(reminderId, {
        dueDate: snoozeDate,
      });
      
      // Show confirmation
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
    // This would typically navigate to the reminder details
    // For now, we'll just log it
    console.log('Navigate to reminder:', reminderId);
    
    // In a real app, you'd use navigation:
    // NavigationService.navigate('ReminderDetails', { reminderId });
  }

  // Get notification settings for a user
  static async getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.NOTIFICATION_SETTINGS}_${userId}`);
      if (stored) {
        return JSON.parse(stored);
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
      
      // Reschedule notifications with new settings
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
      
      // Clear existing scheduled notifications
      await this.clearScheduledNotifications(userId);
      
      // Get all upcoming reminders
      const reminders = await RemindersService.getReminders(userId);
      const upcomingReminders = reminders.filter(r => r.status === 'upcoming');
      
      const notifications: ScheduledNotification[] = [];
      
      for (const reminder of upcomingReminders) {
        // Schedule notifications for each reminder day setting
        for (const days of settings.reminderDays) {
          const notificationDate = new Date(reminder.dueDate);
          notificationDate.setDate(notificationDate.getDate() - days);
          
          // Set notification time
          const [hours, minutes] = settings.timeOfDay.split(':').map(Number);
          notificationDate.setHours(hours, minutes, 0, 0);
          
          // Only schedule future notifications
          if (notificationDate > new Date()) {
            const notification: ScheduledNotification = {
              id: `${reminder.id}_${days}d`,
              reminderId: reminder.id,
              scheduledFor: notificationDate,
              type: 'due_soon',
              title: this.getNotificationTitle(reminder, days),
              body: this.getNotificationBody(reminder, days),
              data: {
                reminderId: reminder.id,
                daysUntilDue: days,
                amount: reminder.amount,
                currency: reminder.currency,
              },
            };
            
            // Schedule with Expo Notifications
            const notificationId = await this.scheduleNotification(notification, settings);
            notification.notificationId = notificationId;
            
            notifications.push(notification);
          }
        }
        
        // Schedule overdue notification (1 day after due date)
        const overdueDate = new Date(reminder.dueDate);
        overdueDate.setDate(overdueDate.getDate() + 1);
        overdueDate.setHours(9, 0, 0, 0); // 9 AM
        
        if (overdueDate > new Date()) {
          const overdueNotification: ScheduledNotification = {
            id: `${reminder.id}_overdue`,
            reminderId: reminder.id,
            scheduledFor: overdueDate,
            type: 'overdue',
            title: 'Overdue Payment!',
            body: `${reminder.title} was due yesterday. Pay now to avoid late fees.`,
            data: {
              reminderId: reminder.id,
              isOverdue: true,
              amount: reminder.amount,
              currency: reminder.currency,
            },
          };
          
          const notificationId = await this.scheduleNotification(overdueNotification, settings, 'overdue_bill');
          overdueNotification.notificationId = notificationId;
          
          notifications.push(overdueNotification);
        }
      }
      
      // Store scheduled notifications
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`,
        JSON.stringify(notifications)
      );
      
      console.log(`📅 Scheduled ${notifications.length} notifications for user ${userId}`);
      
    } catch (error) {
      console.error('Error scheduling reminder notifications:', error);
    }
  }

  // Schedule individual notification with Expo Notifications
  private static async scheduleNotification(
    notification: ScheduledNotification, 
    settings: NotificationSettings,
    categoryIdentifier: string = 'bill_reminder'
  ): Promise<string> {
    try {
      const trigger = {
        date: notification.scheduledFor,
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: settings.soundEnabled ? 'default' : undefined,
          categoryIdentifier,
          badge: 1,
        },
        trigger,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  // Clear all scheduled notifications for a user
  static async clearScheduledNotifications(userId: string): Promise<void> {
    try {
      // Get stored notifications
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
      if (stored) {
        const notifications: ScheduledNotification[] = JSON.parse(stored);
        
        // Cancel each notification
        for (const notification of notifications) {
          if (notification.notificationId) {
            await Notifications.cancelScheduledNotificationAsync(notification.notificationId);
          }
        }
      }
      
      // Clear storage
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
        trigger: null, // Immediate
      });
    } catch (error) {
      console.error('Failed to send immediate notification:', error);
    }
  }
}