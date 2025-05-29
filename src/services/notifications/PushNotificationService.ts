// src/services/notifications/PushNotificationService.ts
import { Platform, Alert, PermissionsAndroid } from 'react-native';

export interface PushNotificationData {
  type: 'friend_request' | 'expense_added' | 'payment_received' | 'group_invite' | 'expense_settled' | 'payment_reminder';
  title: string;
  body: string;
  data: {
    userId?: string;
    groupId?: string;
    expenseId?: string;
    friendRequestId?: string;
    paymentId?: string;
    [key: string]: any;
  };
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmToken: string | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  // Initialize push notifications (simplified version)
  async initialize(userId: string): Promise<void> {
    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Push notification permissions denied');
        return;
      }

      // For now, just log - in full implementation this would use Firebase Messaging
      console.log('Push notifications initialized for user:', userId);
      
      // TODO: Implement Firebase Cloud Messaging
      // const messaging = require('@react-native-firebase/messaging').default;
      // const token = await messaging().getToken();
      // this.fcmToken = token;
      
    } catch (error) {
      console.error('Push notification initialization error:', error);
    }
  }

  // Request notification permissions
  private async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true; // Android < 33 doesn't need explicit permission
      } else {
        // iOS - would use Firebase Messaging
        // const authStatus = await messaging().requestPermission();
        // return authStatus === messaging.AuthorizationStatus.AUTHORIZED;
        return true; // For now, assume granted
      }
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  // Send notification to specific user (simplified - would use Firebase Functions)
  static async sendNotificationToUser(
    targetUserId: string, 
    notification: PushNotificationData
  ): Promise<void> {
    try {
      // This would typically be called from Firebase Cloud Functions
      // For now, just log the notification
      console.log('Sending notification to user:', targetUserId, notification);
      
      // TODO: In production, this would:
      // 1. Get user's FCM token from Firestore
      // 2. Send push notification via Firebase Admin SDK
      // 3. Create notification record in Firestore
      
    } catch (error) {
      console.error('Send notification error:', error);
    }
  }

  // Send notification to group members (simplified)
  static async sendNotificationToGroup(
    groupId: string, 
    excludeUserId: string, 
    notification: PushNotificationData
  ): Promise<void> {
    try {
      console.log('Sending group notification:', { groupId, excludeUserId, notification });
      
      // TODO: In production, this would:
      // 1. Get group members from Firestore
      // 2. Get FCM tokens for all members except excludeUserId
      // 3. Send batch notifications via Firebase Admin SDK
      
    } catch (error) {
      console.error('Send group notification error:', error);
    }
  }

  // Predefined notification templates
  static createFriendRequestNotification(senderName: string, friendRequestId: string): PushNotificationData {
    return {
      type: 'friend_request',
      title: 'New Friend Request',
      body: `${senderName} wants to be your friend on Spendy`,
      data: { friendRequestId }
    };
  }

  static createExpenseAddedNotification(
    senderName: string, 
    amount: number, 
    currency: string, 
    description: string,
    expenseId: string,
    groupId: string
  ): PushNotificationData {
    return {
      type: 'expense_added',
      title: 'New Expense Added',
      body: `${senderName} added "${description}" for ${currency} ${amount}`,
      data: { expenseId, groupId }
    };
  }

  static createPaymentReceivedNotification(
    senderName: string, 
    amount: number, 
    currency: string,
    paymentId: string
  ): PushNotificationData {
    return {
      type: 'payment_received',
      title: 'Payment Received',
      body: `You received ${currency} ${amount} from ${senderName}`,
      data: { paymentId }
    };
  }

  static createGroupInviteNotification(
    senderName: string, 
    groupName: string, 
    groupId: string
  ): PushNotificationData {
    return {
      type: 'group_invite',
      title: 'Group Invitation',
      body: `${senderName} invited you to join "${groupName}"`,
      data: { groupId }
    };
  }

  static createPaymentReminderNotification(
    friendName: string, 
    amount: number, 
    currency: string,
    paymentId: string
  ): PushNotificationData {
    return {
      type: 'payment_reminder',
      title: 'Payment Reminder',
      body: `Don't forget to pay ${currency} ${amount} to ${friendName}`,
      data: { paymentId }
    };
  }

  // Get current FCM token
  getCurrentToken(): string | null {
    return this.fcmToken;
  }

  // Cleanup (if needed)
  cleanup(): void {
    console.log('Push notification service cleanup');
  }
}

export default PushNotificationService;