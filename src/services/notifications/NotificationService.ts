// src/services/notifications/NotificationService.ts
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RemindersService } from '../reminders/RemindersService';
import { Reminder } from '@/types/reminder';

interface NotificationSettings {
  enabled: boolean;
  reminderDays: number[]; // Days before due date to notify
  timeOfDay: string; // Time to send notifications (HH:MM format)
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

interface ScheduledNotification {
  id: string;
  reminderId: string;
  scheduledFor: Date;
  type: 'due_soon' | 'overdue' | 'daily_summary';
  title: string;
  body: string;
  data?: any;
}

const STORAGE_KEYS = {
  NOTIFICATION_SETTINGS: '@spendy_notification_settings',
  SCHEDULED_NOTIFICATIONS: '@spendy_scheduled_notifications',
  LAST_NOTIFICATION_CHECK: '@spendy_last_notification_check',
};

export class NotificationService {
  
  // Initialize notification permissions and settings
  static async initialize(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // Request iOS permissions
        // In a real app, you'd use expo-notifications or react-native-permissions
        console.log('📱 iOS notification permissions requested');
      } else if (Platform.OS === 'android') {
        // Request Android permissions
        console.log('📱 Android notification permissions requested');
      }
      
      // Set default settings if not exist
      const settings = await this.getNotificationSettings('default');
      if (!settings) {
        await this.updateNotificationSettings('default', {
          enabled: true,
          reminderDays: [1, 3, 7], // 1, 3, and 7 days before due
          timeOfDay: '09:00', // 9 AM
          pushEnabled: true,
          emailEnabled: false,
          smsEnabled: false,
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }
  
  // Get notification settings for a user
  static async getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.NOTIFICATION_SETTINGS}_${userId}`);
      return stored ? JSON.parse(stored) : null;
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
      if (!settings || !settings.enabled) {
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
            
            notifications.push(notification);
          }
        }
        
        // Schedule overdue notification (1 day after due date)
        const overdueDate = new Date(reminder.dueDate);
        overdueDate.setDate(overdueDate.getDate() + 1);
        
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
  
  // Clear all scheduled notifications for a user
  static async clearScheduledNotifications(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
    } catch (error) {
      console.error('Error clearing scheduled notifications:', error);
    }
  }
  
  // Check for due notifications and trigger them
  static async checkAndTriggerNotifications(userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      if (!settings || !settings.enabled) {
        return;
      }
      
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
      if (!stored) return;
      
      const notifications: ScheduledNotification[] = JSON.parse(stored);
      const now = new Date();
      
      const dueNotifications = notifications.filter(n => new Date(n.scheduledFor) <= now);
      
      for (const notification of dueNotifications) {
        await this.triggerNotification(notification, settings);
      }
      
      // Remove triggered notifications
      const remainingNotifications = notifications.filter(n => new Date(n.scheduledFor) > now);
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`,
        JSON.stringify(remainingNotifications)
      );
      
      // Update last check time
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_NOTIFICATION_CHECK, now.toISOString());
      
    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  }
  
  // Trigger a specific notification
  private static async triggerNotification(
    notification: ScheduledNotification,
    settings: NotificationSettings
  ): Promise<void> {
    try {
      if (settings.pushEnabled) {
        // In a real app, you'd use expo-notifications or @react-native-community/push-notification-ios
        // For demo, we'll show an alert
        Alert.alert(
          notification.title,
          notification.body,
          [
            { text: 'Dismiss', style: 'cancel' },
            { 
              text: 'View', 
              onPress: () => {
                // Navigate to reminder details
                console.log('Navigate to reminder:', notification.reminderId);
              }
            }
          ]
        );
      }
      
      console.log(`🔔 Triggered notification: ${notification.title}`);
      
    } catch (error) {
      console.error('Error triggering notification:', error);
    }
  }
  
  // Generate notification title based on reminder and days until due
  private static getNotificationTitle(reminder: Reminder, daysUntilDue: number): string {
    if (daysUntilDue === 0) {
      return 'Bill Due Today!';
    } else if (daysUntilDue === 1) {
      return 'Bill Due Tomorrow';
    } else {
      return `Bill Due in ${daysUntilDue} Days`;
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
  
  // Send daily summary notification
  static async sendDailySummary(userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      if (!settings || !settings.enabled) return;
      
      // Get reminders due today and overdue
      const dueTodayReminders = await RemindersService.getRemindersDueSoon(userId, 0);
      const overdueReminders = await RemindersService.getOverdueReminders(userId);
      
      if (dueTodayReminders.length === 0 && overdueReminders.length === 0) {
        return; // No summary needed
      }
      
      let title = 'Daily Bill Summary';
      let body = '';
      
      if (dueTodayReminders.length > 0) {
        body += `${dueTodayReminders.length} bill${dueTodayReminders.length === 1 ? '' : 's'} due today. `;
      }
      
      if (overdueReminders.length > 0) {
        body += `${overdueReminders.length} overdue bill${overdueReminders.length === 1 ? '' : 's'}.`;
      }
      
      const summaryNotification: ScheduledNotification = {
        id: `daily_summary_${new Date().toDateString()}`,
        reminderId: 'summary',
        scheduledFor: new Date(),
        type: 'daily_summary',
        title,
        body: body.trim(),
        data: {
          dueTodayCount: dueTodayReminders.length,
          overdueCount: overdueReminders.length,
        },
      };
      
      await this.triggerNotification(summaryNotification, settings);
      
    } catch (error) {
      console.error('Error sending daily summary:', error);
    }
  }
  
  // Test notification (for development/settings)
  static async sendTestNotification(userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      if (!settings) return;
      
      const testNotification: ScheduledNotification = {
        id: 'test_notification',
        reminderId: 'test',
        scheduledFor: new Date(),
        type: 'due_soon',
        title: 'Test Notification',
        body: 'This is a test notification from Spendy. Your notifications are working!',
        data: { isTest: true },
      };
      
      await this.triggerNotification(testNotification, settings);
      
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }
  
  // Schedule notification for a specific reminder (used when creating/updating reminders)
  static async scheduleReminderNotification(reminder: Reminder, userId: string): Promise<void> {
    try {
      const settings = await this.getNotificationSettings(userId);
      if (!settings || !settings.enabled || reminder.status !== 'upcoming') {
        return;
      }
      
      // Get existing notifications
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
      const existingNotifications: ScheduledNotification[] = stored ? JSON.parse(stored) : [];
      
      // Remove existing notifications for this reminder
      const filteredNotifications = existingNotifications.filter(n => n.reminderId !== reminder.id);
      
      // Add new notifications for this reminder
      const newNotifications: ScheduledNotification[] = [];
      
      for (const days of settings.reminderDays) {
        const notificationDate = new Date(reminder.dueDate);
        notificationDate.setDate(notificationDate.getDate() - days);
        
        if (notificationDate > new Date()) {
          newNotifications.push({
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
          });
        }
      }
      
      // Save updated notifications
      const allNotifications = [...filteredNotifications, ...newNotifications];
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`,
        JSON.stringify(allNotifications)
      );
      
    } catch (error) {
      console.error('Error scheduling reminder notification:', error);
    }
  }
  
  // Cancel notifications for a specific reminder (used when deleting/paying reminders)
  static async cancelReminderNotifications(reminderId: string, userId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
      if (!stored) return;
      
      const notifications: ScheduledNotification[] = JSON.parse(stored);
      const filteredNotifications = notifications.filter(n => n.reminderId !== reminderId);
      
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`,
        JSON.stringify(filteredNotifications)
      );
      
    } catch (error) {
      console.error('Error canceling reminder notifications:', error);
    }
  }
  
  // Get notification statistics
  static async getNotificationStats(userId: string): Promise<{
    totalScheduled: number;
    dueSoon: number;
    overdue: number;
    lastCheck: Date | null;
  }> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.SCHEDULED_NOTIFICATIONS}_${userId}`);
      const notifications: ScheduledNotification[] = stored ? JSON.parse(stored) : [];
      
      const lastCheckStored = await AsyncStorage.getItem(STORAGE_KEYS.LAST_NOTIFICATION_CHECK);
      const lastCheck = lastCheckStored ? new Date(lastCheckStored) : null;
      
      const dueSoon = notifications.filter(n => n.type === 'due_soon').length;
      const overdue = notifications.filter(n => n.type === 'overdue').length;
      
      return {
        totalScheduled: notifications.length,
        dueSoon,
        overdue,
        lastCheck,
      };
      
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        totalScheduled: 0,
        dueSoon: 0,
        overdue: 0,
        lastCheck: null,
      };
    }
  }
  
  // Background task to check notifications (would be called by a background service)
  static async backgroundNotificationCheck(): Promise<void> {
    try {
      // In a real app, you'd get all user IDs who have notifications enabled
      // For demo, we'll use a mock user ID
      const mockUserId = 'mock-123';
      await this.checkAndTriggerNotifications(mockUserId);
    } catch (error) {
      console.error('Background notification check failed:', error);
    }
  }
}