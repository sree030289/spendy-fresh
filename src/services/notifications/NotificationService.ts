// src/services/notifications/NotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { Reminder } from '@/types/reminder';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationSettings {
  enabled: boolean;
  reminderDays: number[];
  timeOfDay: string; // "09:00" format
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
  type: 'due_soon' | 'overdue' | 'payment_confirmation';
  title: string;
  body: string;
  data: any;
}

const STORAGE_KEYS = {
  NOTIFICATION_SETTINGS: '@spendy_notification_settings',
  PUSH_TOKEN: '@spendy_push_token',
  SCHEDULED_NOTIFICATIONS: '@spendy_scheduled_notifications',
  NOTIFICATION_PERMISSIONS: '@spendy_notification_permissions',
};

const BACKGROUND_TASK_NAME = 'REMINDER_NOTIFICATIONS';

// Register background task for notifications
TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }

  try {
    console.log('🔔 Running background notification check...');
    await NotificationService.checkAndSendDueReminders();
  } catch (backgroundError) {
    console.error('Background notification check failed:', backgroundError);
  }
});

export class NotificationService {
  private static pushToken: string | null = null;
  private static notificationListener: any = null;
  private static responseListener: any = null;

  // Initialize notification service
  static async initialize(): Promise<boolean> {
    try {
      console.log('🔔 Initializing notification service...');

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('⚠️ Notification permissions not granted');
        return false;
      }

      // Get push token
      const token = await this.getPushToken();
      if (token) {
        console.log('✅ Push token obtained');
        this.pushToken = token;
      }

      // Set up listeners
      this.setupNotificationListeners();

      // Register background task
      await this.registerBackgroundTask();

      console.log('✅ Notification service initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
      return false;
    }
  }

  // Request notification permissions
  static async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.warn('⚠️ Notifications not supported on simulator');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Notification Permission Required',
          'To receive bill reminders, please enable notifications in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Notifications.openSettings?.() },
          ]
        );
        return false;
      }

      // Store permission status
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSIONS, 'granted');
      return true;

    } catch (error) {
      console.error('❌ Failed to request notification permissions:', error);
      return false;
    }
  }

  // Get push notification token
  static async getPushToken(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.warn('⚠️ Push tokens not available on simulator');
        return null;
      }

      // Check if we have a stored token
      const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      if (storedToken) {
        this.pushToken = storedToken;
        return storedToken;
      }

      // Get new token
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: '576826934856', // Replace with your Expo project ID
      })).data;

      // Store token
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
      this.pushToken = token;

      console.log('📱 Push token obtained:', token.substring(0, 20) + '...');
      return token;

    } catch (error) {
      console.error('❌ Failed to get push token:', error);
      return null;
    }
  }

  // Setup notification listeners
  static setupNotificationListeners(): void {
    // Listener for when notification is received while app is running
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      this.handleNotificationResponse(response);
    });
  }

  // Handle notification received
  private static handleNotificationReceived(notification: Notifications.Notification): void {
    const { title, body, data } = notification.request.content;
    
    // Update app badge count
    this.updateBadgeCount();
    
    // Log notification for analytics
    console.log(`🔔 Notification: ${title} - ${body}`);
  }

  // Handle notification tap
  private static handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { notification } = response;
    const { data } = notification.request.content;

    // Navigate to relevant screen based on notification data
    if (data?.reminderId) {
      // In a real app, you'd use navigation to go to reminder details
      console.log('🔗 Opening reminder:', data.reminderId);
    }
  }

  // Register background task
  private static async registerBackgroundTask(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        // iOS background tasks
        await Notifications.registerTaskAsync(BACKGROUND_TASK_NAME);
      } else {
        // Android uses different background processing
        console.log('📱 Android background notifications handled differently');
      }
    } catch (error) {
      console.error('❌ Failed to register background task:', error);
    }
  }

  // Get notification settings for user
  static async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.NOTIFICATION_SETTINGS}_${userId}`);
      
      if (stored) {
        return JSON.parse(stored);
      }

      // Default settings
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
      console.error('❌ Failed to get notification settings:', error);
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
    }
  }

  // Update notification settings
  static async updateNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.NOTIFICATION_SETTINGS}_${userId}`,
        JSON.stringify(settings)
      );

      // Reschedule all notifications with new settings
      await this.rescheduleAllNotifications(userId);

      console.log('✅ Notification settings updated');
    } catch (error) {
      console.error('❌ Failed to update notification settings:', error);
      throw error;
    }
  }

  // Schedule reminder notifications
  static async scheduleReminderNotifications(userId: string, reminder: Reminder): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      
      if (!settings.enabled || !settings.pushEnabled) {
        console.log('🔕 Notifications disabled for user');
        return;
      }

      const scheduledNotifications: ScheduledNotification[] = [];

      // Schedule notifications for each reminder day
      for (const days of settings.reminderDays) {
        const notificationDate = new Date(reminder.dueDate);
        notificationDate.setDate(notificationDate.getDate() - days);

        // Set time of day
        const [hours, minutes] = settings.timeOfDay.split(':').map(Number);
        notificationDate.setHours(hours, minutes, 0, 0);

        // Don't schedule if date is in the past
        if (notificationDate <= new Date()) {
          continue;
        }

        // Check quiet hours
        if (this.isQuietTime(notificationDate, settings)) {
          continue;
        }

        const notificationId = `reminder-${reminder.id}-${days}d`;
        
        const scheduledNotification: ScheduledNotification = {
          id: notificationId,
          reminderId: reminder.id,
          scheduledFor: notificationDate,
          type: 'due_soon',
          title: this.getReminderNotificationTitle(reminder, days),
          body: this.getReminderNotificationBody(reminder, days),
          data: {
            reminderId: reminder.id,
            type: 'reminder',
            daysUntilDue: days,
          },
        };

        // Schedule the notification
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId,
          content: {
            title: scheduledNotification.title,
            body: scheduledNotification.body,
            data: scheduledNotification.data,
            sound: settings.soundEnabled ? 'default' : false,
            badge: 1,
          },
          trigger: {
            date: notificationDate,
          },
        });

        scheduledNotifications.push(scheduledNotification);
        console.log(`🔔 Scheduled notification for ${reminder.title} - ${days} days before`);
      }

      // Store scheduled notifications
      await this.storeScheduledNotifications(userId, scheduledNotifications);

    } catch (error) {
      console.error('❌ Failed to schedule reminder notifications:', error);
    }
  }

  // Cancel reminder notifications
  static async cancelReminderNotifications(reminderId: string): Promise<void> {
    try {
      // Get all scheduled notifications
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      
      // Find notifications for this reminder
      const toCancel = allScheduled.filter(notification => 
        notification.identifier.startsWith(`reminder-${reminderId}`)
      );

      // Cancel each notification
      for (const notification of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log(`🔕 Cancelled notification: ${notification.identifier}`);
      }

    } catch (error) {
      console.error('❌ Failed to cancel reminder notifications:', error);
    }
  }

  // Send immediate notification
  static async sendImmediateNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      await Notifications.presentNotificationAsync({
        title,
        body,
        data: data || {},
        sound: true,
        badge: 1,
      });

      console.log(`🔔 Sent immediate notification: ${title}`);
    } catch (error) {
      console.error('❌ Failed to send immediate notification:', error);
    }
  }

  // Send test notification
  static async sendTestNotification(userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      
      if (!settings.enabled || !settings.pushEnabled) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in your settings first.');
        return;
      }

      await this.sendImmediateNotification(
        'Test Notification',
        'This is a test notification from Spendy. Your notifications are working perfectly!',
        { type: 'test' }
      );

      Alert.alert('Test Sent', 'Test notification sent successfully!');
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      Alert.alert('Test Failed', 'Failed to send test notification. Please check your notification settings.');
    }
  }

  // Check and send due reminders (called by background task)
  static async checkAndSendDueReminders(): Promise<void> {
    try {
      console.log('🔍 Checking for due reminders...');

      // This would typically get all users, but for demo we'll use a mock user
      const userId = 'mock-123'; // In production, iterate through all users
      
      // Get user's reminders (this would come from your RemindersService)
      const { RemindersService } = require('@/services/reminders/RemindersService');
      const reminders = await RemindersService.getReminders(userId);
      
      const settings = await this.getNotificationSettings(userId);
      if (!settings.enabled) return;

      const now = new Date();
      let sentCount = 0;

      for (const reminder of reminders) {
        if (reminder.status === 'paid') continue;

        const dueDate = new Date(reminder.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Check if we should send a notification
        if (settings.reminderDays.includes(daysUntilDue)) {
          // Check if we already sent this notification today
          const lastSent = await this.getLastNotificationTime(reminder.id, daysUntilDue);
          const today = new Date().toDateString();
          
          if (lastSent?.toDateString() !== today) {
            await this.sendReminderNotification(reminder, daysUntilDue);
            await this.setLastNotificationTime(reminder.id, daysUntilDue, now);
            sentCount++;
          }
        }

        // Send overdue notification
        if (daysUntilDue < 0 && reminder.status === 'upcoming') {
          const daysPastDue = Math.abs(daysUntilDue);
          await this.sendOverdueNotification(reminder, daysPastDue);
          sentCount++;
        }
      }

      if (sentCount > 0) {
        console.log(`🔔 Sent ${sentCount} reminder notifications`);
      }

    } catch (error) {
      console.error('❌ Failed to check due reminders:', error);
    }
  }

  // Send reminder notification
  private static async sendReminderNotification(reminder: Reminder, daysUntilDue: number): Promise<void> {
    const title = this.getReminderNotificationTitle(reminder, daysUntilDue);
    const body = this.getReminderNotificationBody(reminder, daysUntilDue);

    await this.sendImmediateNotification(title, body, {
      reminderId: reminder.id,
      type: 'reminder',
      daysUntilDue,
    });
  }

  // Send overdue notification
  private static async sendOverdueNotification(reminder: Reminder, daysPastDue: number): Promise<void> {
    const title = '⚠️ Bill Overdue';
    const body = `${reminder.title} was due ${daysPastDue} day${daysPastDue === 1 ? '' : 's'} ago ($${reminder.amount})`;

    await this.sendImmediateNotification(title, body, {
      reminderId: reminder.id,
      type: 'overdue',
      daysPastDue,
    });
  }

  // Get reminder notification title
  private static getReminderNotificationTitle(reminder: Reminder, daysUntilDue: number): string {
    if (daysUntilDue === 0) {
      return '🔔 Bill Due Today';
    } else if (daysUntilDue === 1) {
      return '⏰ Bill Due Tomorrow';
    } else {
      return `📅 Bill Due in ${daysUntilDue} Days`;
    }
  }

  // Get reminder notification body
  private static getReminderNotificationBody(reminder: Reminder, daysUntilDue: number): string {
    const amount = `${reminder.amount.toFixed(2)}`;
    
    if (daysUntilDue === 0) {
      return `${reminder.title} is due today (${amount})`;
    } else if (daysUntilDue === 1) {
      return `${reminder.title} is due tomorrow (${amount})`;
    } else {
      return `${reminder.title} is due in ${daysUntilDue} days (${amount})`;
    }
  }

  // Check if current time is in quiet hours
  private static isQuietTime(date: Date, settings: NotificationSettings): boolean {
    if (!settings.quietHoursStart || !settings.quietHoursEnd) {
      return false;
    }

    const hour = date.getHours();
    const [startHour] = settings.quietHoursStart.split(':').map(Number);
    const [endHour] = settings.quietHoursEnd.split(':').map(Number);

    if (startHour < endHour) {
      return hour >= startHour && hour < endHour;
    } else {
      // Quiet hours span midnight
      return hour >= startHour || hour < endHour;
    }
  }

  // Store scheduled notifications
  private static async storeScheduledNotifications(userId: string, notifications: ScheduledNotification[]): Promise<void> {
    try {
      const existing = await this.getStoredScheduledNotifications(userId);
      const updated = [...existing, ...notifications];
      
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('❌ Failed to store scheduled notifications:', error);
    }
  }

  // Get stored scheduled notifications
  private static async getStoredScheduledNotifications(userId: string): Promise<ScheduledNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get stored scheduled notifications:', error);
      return [];
    }
  }

  // Get last notification time for a reminder
  private static async getLastNotificationTime(reminderId: string, daysUntilDue: number): Promise<Date | null> {
    try {
      const key = `@spendy_last_notification_${reminderId}_${daysUntilDue}`;
      const stored = await AsyncStorage.getItem(key);
      return stored ? new Date(stored) : null;
    } catch (error) {
      console.error('❌ Failed to get last notification time:', error);
      return null;
    }
  }

  // Set last notification time for a reminder
  private static async setLastNotificationTime(reminderId: string, daysUntilDue: number, time: Date): Promise<void> {
    try {
      const key = `@spendy_last_notification_${reminderId}_${daysUntilDue}`;
      await AsyncStorage.setItem(key, time.toISOString());
    } catch (error) {
      console.error('❌ Failed to set last notification time:', error);
    }
  }

  // Reschedule all notifications for a user
  private static async rescheduleAllNotifications(userId: string): Promise<void> {
    try {
      console.log('🔄 Rescheduling all notifications...');

      // Cancel all existing notifications for this user
      await this.cancelAllUserNotifications(userId);

      // Get all reminders for the user
      const { RemindersService } = require('@/services/reminders/RemindersService');
      const reminders = await RemindersService.getReminders(userId);

      // Schedule notifications for each reminder
      for (const reminder of reminders) {
        if (reminder.status !== 'paid') {
          await this.scheduleReminderNotifications(userId, reminder);
        }
      }

      console.log('✅ All notifications rescheduled');
    } catch (error) {
      console.error('❌ Failed to reschedule notifications:', error);
    }
  }

  // Cancel all notifications for a user
  private static async cancelAllUserNotifications(userId: string): Promise<void> {
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      
      // Cancel all notifications (in a real app, you'd filter by user)
      for (const notification of allScheduled) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      // Clear stored notifications
      await AsyncStorage.removeItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);

      console.log('🔕 Cancelled all user notifications');
    } catch (error) {
      console.error('❌ Failed to cancel all user notifications:', error);
    }
  }

  // Update app badge count
  static async updateBadgeCount(): Promise<void> {
    try {
      // Get count of due/overdue reminders
      const userId = 'mock-123'; // In production, get current user
      const { RemindersService } = require('@/services/reminders/RemindersService');
      const reminders = await RemindersService.getReminders(userId);
      
      const now = new Date();
      const dueCount = reminders.filter(reminder => {
        if (reminder.status === 'paid') return false;
        return new Date(reminder.dueDate) <= now;
      }).length;

      await Notifications.setBadgeCountAsync(dueCount);
      console.log(`📱 Updated badge count: ${dueCount}`);
    } catch (error) {
      console.error('❌ Failed to update badge count:', error);
    }
  }

  // Clear all notifications
  static async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
      console.log('🧹 Cleared all notifications');
    } catch (error) {
      console.error('❌ Failed to clear notifications:', error);
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
      const scheduled = await this.getStoredScheduledNotifications(userId);
      const { status } = await Notifications.getPermissionsAsync();
      
      return {
        totalScheduled: scheduled.length,
        totalSent: 0, // Would track this in production
        lastSent: null, // Would track this in production
        permissionStatus: status,
        pushToken: this.pushToken,
      };
    } catch (error) {
      console.error('❌ Failed to get notification stats:', error);
      return {
        totalScheduled: 0,
        totalSent: 0,
        lastSent: null,
        permissionStatus: 'undetermined',
        pushToken: null,
      };
    }
  }

  // Send payment confirmation notification
  static async sendPaymentConfirmation(reminder: Reminder, amount: number): Promise<void> {
    try {
      const title = '✅ Payment Confirmed';
      const body = `${reminder.title} payment of ${amount.toFixed(2)} has been confirmed`;

      await this.sendImmediateNotification(title, body, {
        reminderId: reminder.id,
        type: 'payment_confirmation',
        amount,
      });

      // Cancel any pending notifications for this reminder
      await this.cancelReminderNotifications(reminder.id);

      console.log(`✅ Sent payment confirmation for ${reminder.title}`);
    } catch (error) {
      console.error('❌ Failed to send payment confirmation:', error);
    }
  }

  // Send weekly summary notification
  static async sendWeeklySummary(userId: string): Promise<void> {
    try {
      const { RemindersService } = require('@/services/reminders/RemindersService');
      const reminders = await RemindersService.getReminders(userId);
      
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const upcomingThisWeek = reminders.filter(reminder => {
        if (reminder.status === 'paid') return false;
        const dueDate = new Date(reminder.dueDate);
        return dueDate >= now && dueDate <= nextWeek;
      });

      if (upcomingThisWeek.length === 0) {
        return;
      }

      const totalAmount = upcomingThisWeek.reduce((sum, r) => sum + r.amount, 0);
      
      const title = '📊 Weekly Bills Summary';
      const body = `You have ${upcomingThisWeek.length} bills due this week (Total: ${totalAmount.toFixed(2)})`;

      await this.sendImmediateNotification(title, body, {
        type: 'weekly_summary',
        count: upcomingThisWeek.length,
        totalAmount,
      });

      console.log(`📊 Sent weekly summary: ${upcomingThisWeek.length} bills`);
    } catch (error) {
      console.error('❌ Failed to send weekly summary:', error);
    }
  }

  // Cleanup expired notifications
  static async cleanupExpiredNotifications(userId: string): Promise<void> {
    try {
      const stored = await this.getStoredScheduledNotifications(userId);
      const now = new Date();
      
      const active = stored.filter(notification => 
        new Date(notification.scheduledFor) > now
      );

      if (active.length !== stored.length) {
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`,
          JSON.stringify(active)
        );
        
        console.log(`🧹 Cleaned up ${stored.length - active.length} expired notifications`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup expired notifications:', error);
    }
  }

  // Handle app state changes
  static async handleAppStateChange(nextAppState: string): Promise<void> {
    try {
      if (nextAppState === 'active') {
        // App became active - update badge count and check for due reminders
        await this.updateBadgeCount();
        await this.checkAndSendDueReminders();
      } else if (nextAppState === 'background') {
        // App went to background - cleanup and prepare for background tasks
        await this.cleanupExpiredNotifications('mock-123'); // Use current user ID
      }
    } catch (error) {
      console.error('❌ Failed to handle app state change:', error);
    }
  }

  // Cleanup on app termination
  static async cleanup(): Promise<void> {
    try {
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
      
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
      }

      console.log('🧹 Notification service cleanup completed');
    } catch (error) {
      console.error('❌ Failed to cleanup notification service:', error);
    }
  }

  // Get notification history (for analytics)
  static async getNotificationHistory(userId: string, days: number = 30): Promise<Array<{
    date: Date;
    type: string;
    title: string;
    body: string;
    opened: boolean;
  }>> {
    try {
      // In production, this would query a backend service
      // For now, return mock data
      return [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000),
          type: 'reminder',
          title: '🔔 Bill Due Tomorrow',
          body: 'Netflix Subscription is due tomorrow ($15.99)',
          opened: true,
        },
        {
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          type: 'reminder',
          title: '📅 Bill Due in 3 Days',
          body: 'Electricity Bill is due in 3 days ($127.45)',
          opened: false,
        },
      ];
    } catch (error) {
      console.error('❌ Failed to get notification history:', error);
      return [];
    }
  }

  // Export notification settings (for backup)
  static async exportSettings(userId: string): Promise<string> {
    try {
      const settings = await this.getNotificationSettings(userId);
      const scheduled = await this.getStoredScheduledNotifications(userId);
      const stats = await this.getNotificationStats(userId);

      const exportData = {
        settings,
        scheduled,
        stats,
        exportDate: new Date().toISOString(),
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('❌ Failed to export notification settings:', error);
      throw error;
    }
  }

  // Import notification settings (for restore)
  static async importSettings(userId: string, data: string): Promise<void> {
    try {
      const importData = JSON.parse(data);
      
      if (importData.settings) {
        await this.updateNotificationSettings(userId, importData.settings);
      }

      console.log('✅ Notification settings imported successfully');
    } catch (error) {
      console.error('❌ Failed to import notification settings:', error);
      throw error;
    }
  }
}