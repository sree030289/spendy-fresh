// src/services/notifications/SimpleNotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { CrossPlatformAlert } from '@/utils/alertUtils';

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

const STORAGE_KEYS = {
  PUSH_TOKEN: '@spendy_push_token',
  NOTIFICATION_PERMISSIONS: '@spendy_notification_permissions',
};

export class SimpleNotificationService {
  private static pushToken: string | null = null;
  private static notificationListener: any = null;
  private static responseListener: any = null;

  // Initialize notification service (simple version)
  static async initialize(): Promise<boolean> {
    try {
      console.log('🔔 Initializing simple notification service...');

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
        
        // Save push token to server
        try {
          const { ApiService } = await import('@/services/api/ApiService');
          const apiService = ApiService.getInstance();
          await apiService.savePushToken(token);
          console.log('✅ Push token saved to server');
        } catch (saveError) {
          console.error('❌ Failed to save push token to server:', saveError);
          // Don't fail initialization if token save fails
        }
      }

      // Set up listeners
      this.setupNotificationListeners();

      console.log('✅ Simple notification service initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize simple notification service:', error);
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
        CrossPlatformAlert.alert(
          'Notification Permission Required',
          'To receive friend request notifications, please enable notifications in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'OK', style: 'default' },
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
        projectId: '8ba655ab-7839-4196-9893-2a71413248ed', // Correct Expo project ID
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
    Notifications.setBadgeCountAsync(1);
    
    // Log notification for analytics
    console.log(`🔔 Notification: ${title} - ${body}`);
  }

  // Handle notification tap
  private static handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { notification } = response;
    const { data } = notification.request.content;

    console.log('🔗 Handling notification tap with data:', data);

    // Navigate to relevant screen based on notification data
    if (data?.type === 'friend_request') {
      // Navigate to friends tab when friend request notification is tapped
      console.log('🤝 Opening friends tab for friend request');
      
      // Store navigation intent for the app to pick up
      this.storeNavigationIntent({
        type: 'friend_request',
        action: 'view_friend_requests',
        friendRequestId: data.friendRequestId,
        senderId: data.senderId,
        senderName: data.senderName
      });
      
    } else if (data?.type === 'friend_accepted') {
      // Navigate to friends tab when friend accepts request
      console.log('🎉 Opening friends tab for accepted friend request');
      
      this.storeNavigationIntent({
        type: 'friend_request_accepted',
        action: 'view_friends',
        friendRequestId: data.friendRequestId,
        friendId: data.friendId,
        friendName: data.friendName
      });
      
    } else if (data?.type === 'friend_declined') {
      // Navigate to friends tab when friend declines request
      console.log('❌ Opening friends tab for declined friend request');
      
      this.storeNavigationIntent({
        type: 'friend_declined',
        action: 'view_friends',
        friendRequestId: data.friendRequestId,
        friendName: data.friendName
      });
    }
  }

  // Store navigation intent for app to handle when ready
  private static async storeNavigationIntent(intent: any): Promise<void> {
    try {
      await AsyncStorage.setItem('@navigation_intent', JSON.stringify({
        ...intent,
        timestamp: Date.now()
      }));
      console.log('💾 Navigation intent stored:', intent);
    } catch (error) {
      console.error('❌ Failed to store navigation intent:', error);
    }
  }

  // Get and clear navigation intent
  static async getAndClearNavigationIntent(): Promise<any | null> {
    try {
      const stored = await AsyncStorage.getItem('@navigation_intent');
      if (stored) {
        await AsyncStorage.removeItem('@navigation_intent');
        const intent = JSON.parse(stored);
        
        // Only return intents that are less than 30 seconds old to avoid stale navigations
        if (Date.now() - intent.timestamp < 30000) {
          console.log('🎯 Retrieved navigation intent:', intent);
          return intent;
        } else {
          console.log('⏰ Navigation intent expired, ignoring');
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get navigation intent:', error);
      return null;
    }
  }

  // Send immediate notification (for testing)
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

  // Get current push token
  static getCurrentPushToken(): string | null {
    return this.pushToken;
  }

  // Cleanup listeners
  static async cleanup(): Promise<void> {
    try {
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
      
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
      }

      console.log('🧹 Simple notification service cleanup completed');
    } catch (error) {
      console.error('❌ Failed to cleanup simple notification service:', error);
    }
  }
}
