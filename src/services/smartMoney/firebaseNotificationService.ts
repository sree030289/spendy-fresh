import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { 
  getMessaging, 
  getToken, 
  onMessage,
  MessagePayload 
} from 'firebase/messaging';
import { messaging } from '../firebase/config';

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

export interface NotificationData {
  title: string;
  body: string;
  data?: any;
  sound?: string;
  priority?: 'default' | 'high' | 'max';
  categoryId?: string;
}

export class FirebaseNotificationService {
  private static instance: FirebaseNotificationService;
  private expoPushToken: string | null = null;
  private fcmToken: string | null = null;
  
  static getInstance(): FirebaseNotificationService {
    if (!FirebaseNotificationService.instance) {
      FirebaseNotificationService.instance = new FirebaseNotificationService();
    }
    return FirebaseNotificationService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Setup notification categories
      await this.setupNotificationCategories();
      
      // Register for push notifications
      const token = await this.registerForPushNotifications();
      
      if (token) {
        console.log('✅ Push token obtained:', token);
        
        // Setup listeners
        this.setupNotificationListeners();
        
        // For web, setup FCM
        if (Platform.OS === 'web') {
          await this.setupWebNotifications();
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error);
      return false;
    }
  }

  private async setupNotificationCategories(): Promise<void> {
    // Define notification categories with actions
    await Notifications.setNotificationCategoryAsync('EXPENSE_REMINDER', [
      {
        identifier: 'ADD_EXPENSE',
        buttonTitle: 'Add Expense',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'DISMISS',
        buttonTitle: 'Dismiss',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('BILL_REMINDER', [
      {
        identifier: 'MARK_PAID',
        buttonTitle: 'Mark as Paid',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'SNOOZE',
        buttonTitle: 'Remind Tomorrow',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('SALARY_NOTIFICATION', [
      {
        identifier: 'ADD_INCOME',
        buttonTitle: 'Add Income',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);
  }

  private async registerForPushNotifications(): Promise<string | null> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Smart Money Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
        sound: 'default',
      });

      // High priority channel for bill reminders
      await Notifications.setNotificationChannelAsync('bill-reminders', {
        name: 'Bill Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ef4444',
        sound: 'default',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Failed to get push token for push notification!');
        return null;
      }
      
      // Get Expo push token
      this.expoPushToken = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId,
      })).data;
      
      console.log('📱 Expo Push Token:', this.expoPushToken);
      
      return this.expoPushToken;
    } else {
      console.log('❌ Must use physical device for Push Notifications');
      return null;
    }
  }

  private setupNotificationListeners(): void {
    // Handle notifications when app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('🔔 Notification received (foreground):', notification);
      this.handleNotificationReceived(notification);
    });

    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      this.handleNotificationResponse(response);
    });
  }

  private async setupWebNotifications(): Promise<void> {
    if (messaging) {
      try {
        // Request permission for web
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          // Get FCM token for web
          this.fcmToken = await getToken(messaging, {
            vapidKey: 'your-vapid-key-here' // Still need this for web FCM
          });
          
          console.log('🌐 FCM Token (web):', this.fcmToken);
          
          // Listen for foreground messages on web
          onMessage(messaging, (payload: MessagePayload) => {
            console.log('🔔 Foreground message (web):', payload);
            this.handleWebMessage(payload);
          });
        }
      } catch (error) {
        console.error('❌ Web notification setup failed:', error);
      }
    }
  }

  private handleNotificationReceived(notification: Notifications.Notification): void {
    // Custom handling for different notification types
    const data = notification.request.content.data;
    
    switch (data?.type) {
      case 'expense_reminder':
        // Track expense reminder received
        this.trackNotificationEvent('expense_reminder_received');
        break;
      case 'bill_reminder':
        // Update bill reminder status
        this.trackNotificationEvent('bill_reminder_received');
        break;
      case 'salary_notification':
        // Track salary notification
        this.trackNotificationEvent('salary_notification_received');
        break;
    }
  }

  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { notification, actionIdentifier } = response;
    const data = notification.request.content.data;

    switch (actionIdentifier) {
      case 'ADD_EXPENSE':
        // Navigate to add expense screen
        this.navigateToScreen('AddExpense');
        break;
      case 'MARK_PAID':
        // Mark bill as paid
        this.markBillAsPaid(data.reminderId as string);
        break;
      case 'ADD_INCOME':
        // Navigate to add income screen
        this.navigateToScreen('AddIncome');
        break;
      case 'SNOOZE':
        // Snooze reminder for 24 hours
        this.snoozeReminder(data.reminderId as string, 24);
        break;
      default:
        // Default tap - open relevant screen
        this.handleDefaultTap(data);
    }
  }

  private handleWebMessage(payload: MessagePayload): void {
    // Show custom notification on web
    if (payload.notification) {
      new Notification(payload.notification.title || 'Smart Money', {
        body: payload.notification.body,
        icon: payload.notification.icon || '/icon.png',
        tag: payload.data?.type,
        data: payload.data
      });
    }
  }

  // Send immediate local notification
  async sendLocalNotification(notificationData: NotificationData): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data || {},
          sound: notificationData.sound || 'default',
          priority: notificationData.priority || 'high',
          categoryIdentifier: notificationData.categoryId,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('❌ Failed to send local notification:', error);
    }
  }

  // Schedule notification for specific time
  async scheduleNotification(
    notificationData: NotificationData,
    triggerDate: Date
  ): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data || {},
          sound: notificationData.sound || 'default',
          priority: notificationData.priority || 'high',
          categoryIdentifier: notificationData.categoryId,
        },
        trigger: {
          type: 'date',
          date: triggerDate,
        },
      });
      
      console.log('⏰ Scheduled notification:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Failed to schedule notification:', error);
      return null;
    }
  }

  // Schedule daily expense reminder
  async scheduleDailyExpenseReminder(): Promise<void> {
    // Cancel existing daily reminders
    await this.cancelNotificationsByTag('daily-expense');
    
    // Schedule for 8 PM daily
    const trigger = {
      hour: 20,
      minute: 0,
      repeats: true,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Daily Expense Check',
        body: 'Don\'t forget to log your expenses for today!',
        data: {
          type: 'expense_reminder',
          screen: 'AddExpense',
          tag: 'daily-expense'
        },
        categoryIdentifier: 'EXPENSE_REMINDER',
      },
      trigger,
    });
  }

  // Schedule bill reminder
  async scheduleBillReminder(reminder: any): Promise<string | null> {
    const dueDate = new Date(reminder.dueDate);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 1); // 1 day before
    reminderDate.setHours(9, 0, 0, 0); // 9 AM

    if (reminderDate <= new Date()) {
      return null; // Don't schedule past reminders
    }

    return await this.scheduleNotification({
      title: `📋 Payment Due Tomorrow`,
      body: `${reminder.title}: $${reminder.amount.toFixed(2)}`,
      data: {
        type: 'bill_reminder',
        reminderId: reminder.id,
        screen: 'Reminders'
      },
      categoryId: 'BILL_REMINDER',
      priority: reminder.priority === 'high' ? 'max' : 'high'
    }, reminderDate);
  }

  // Schedule salary notification
  async scheduleSalaryNotification(salaryDate: Date): Promise<string | null> {
    const nextSalary = new Date(salaryDate);
    nextSalary.setMonth(nextSalary.getMonth() + 1);
    nextSalary.setHours(9, 0, 0, 0); // 9 AM

    return await this.scheduleNotification({
      title: '💸 Salary Day!',
      body: 'Your salary should be credited today. Add it to your income!',
      data: {
        type: 'salary_notification',
        screen: 'AddIncome'
      },
      categoryId: 'SALARY_NOTIFICATION',
      priority: 'high'
    }, nextSalary);
  }

  // Schedule weekly analytics
  async scheduleWeeklyAnalytics(): Promise<void> {
    const trigger = {
      type: 'calendar' as const,
      weekday: 1, // Sunday
      hour: 10,
      minute: 0,
      repeats: true,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Weekly Financial Summary',
        body: 'Check out your weekly spending analysis and insights!',
        data: {
          type: 'weekly_analytics',
          screen: 'Analytics'
        },
      },
      trigger,
    });
  }

  // Cancel notifications by tag
  async cancelNotificationsByTag(tag: string): Promise<void> {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.tag === tag) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  }

  // Get push token for server storage
  getPushToken(): string | null {
    return this.expoPushToken || this.fcmToken;
  }

  // Save token to server
  async saveTokenToServer(userId: string): Promise<void> {
    const token = this.getPushToken();
    
    if (token) {
      try {
        await fetch('https://your-api.com/api/notifications/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            token,
            platform: Platform.OS,
            deviceInfo: {
              brand: Device.brand,
              model: Device.modelName,
              osVersion: Device.osVersion,
            }
          }),
        });
      } catch (error) {
        console.error('❌ Failed to save token to server:', error);
      }
    }
  }

  // Helper methods
  private navigateToScreen(screen: string): void {
    // Implement navigation logic based on your navigation setup
    console.log(`🧭 Navigate to: ${screen}`);
  }

  private markBillAsPaid(reminderId: string): void {
    // Implement mark as paid logic
    console.log(`✅ Mark bill as paid: ${reminderId}`);
  }

  private snoozeReminder(reminderId: string, hours: number): void {
    // Implement snooze logic
    console.log(`😴 Snooze reminder ${reminderId} for ${hours} hours`);
  }

  private handleDefaultTap(data: any): void {
    // Handle default notification tap
    if (data?.screen) {
      this.navigateToScreen(data.screen);
    }
  }

  private trackNotificationEvent(event: string): void {
    // Track notification events for analytics
    console.log(`📈 Track event: ${event}`);
  }
}
