// src/services/notifications/PushNotificationService.ts
import { Platform, Alert, PermissionsAndroid } from 'react-native';

export interface PushNotificationData {
  type: 'friend_request' | 'expense_added' | 'payment_received' | 'group_invite' | 'expense_settled' | 'payment_reminder' | 'payment_request';
  title: string;
  body: string;
  data: {
    userId?: string;
    groupId?: string;
    groupName?: string;
    expenseId?: string;
    friendRequestId?: string;
    paymentId?: string;
    senderName?: string;
    senderEmail?: string;
    senderAvatar?: string;
    message?: string;
    inviteCode?: string;
    groupDescription?: string;
    amount?: number;
    currency?: string;
    description?: string;
    actions?: Array<{
      id: string;
      title: string;
      destructive: boolean;
    }>;
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
  static createFriendRequestNotification(
    senderName: string, 
    senderEmail: string,
    friendRequestId: string,
    senderAvatar?: string,
    message?: string
  ): PushNotificationData {
    return {
      type: 'friend_request',
      title: 'New Friend Request',
      body: `${senderName} wants to be your friend on Spendy`,
      data: { 
        friendRequestId,
        senderName,
        senderEmail,
        senderAvatar,
        message: message || `${senderName} wants to be your friend`,
        // Action buttons for interactive notifications
        actions: [
          {
            id: 'accept_friend',
            title: 'Accept',
            destructive: false
          },
          {
            id: 'decline_friend', 
            title: 'Decline',
            destructive: true
          },
          {
            id: 'view_request',
            title: 'View',
            destructive: false
          }
        ]
      }
    };
  }

  static createExpenseAddedNotification(
    senderName: string, 
    amount: number, 
    currency: string, 
    description: string,
    expenseId: string,
    groupId: string,
    groupName: string,
    senderAvatar?: string
  ): PushNotificationData {
    return {
      type: 'expense_added',
      title: 'New Expense Added',
      body: `${senderName} added "${description}" for ${currency} ${amount} in ${groupName}`,
      data: { 
        expenseId, 
        groupId,
        groupName,
        senderName,
        senderAvatar,
        amount,
        currency,
        description,
        // Action buttons for interactive notifications
        actions: [
          {
            id: 'view_expense',
            title: 'View',
            destructive: false
          },
          {
            id: 'split_expense',
            title: 'Split',
            destructive: false
          }
        ]
      }
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
    groupId: string,
    inviteCode: string,
    senderAvatar?: string,
    groupDescription?: string
  ): PushNotificationData {
    return {
      type: 'group_invite',
      title: 'Group Invitation',
      body: `${senderName} invited you to join "${groupName}"`,
      data: { 
        groupId,
        groupName,
        inviteCode,
        senderName,
        senderAvatar,
        groupDescription,
        // Action buttons for interactive notifications
        actions: [
          {
            id: 'join_group',
            title: 'Join',
            destructive: false
          },
          {
            id: 'decline_invite',
            title: 'Decline',
            destructive: true
          },
          {
            id: 'view_group',
            title: 'View Details',
            destructive: false
          }
        ]
      }
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

  static createExpenseSettledNotification(
    senderName: string, 
    amount: number, 
    currency: string, 
    description: string,
    expenseId: string,
    groupId?: string,
    groupName?: string,
    senderAvatar?: string
  ): PushNotificationData {
    const bodyText = groupName 
      ? `${senderName} settled ${currency} ${amount} for "${description}" in ${groupName}`
      : `${senderName} settled ${currency} ${amount} for "${description}"`;
      
    return {
      type: 'expense_settled',
      title: 'Payment Settled',
      body: bodyText,
      data: { 
        expenseId, 
        groupId,
        groupName,
        senderName,
        senderAvatar,
        amount,
        currency,
        description,
        // Action buttons for interactive notifications
        actions: [
          {
            id: 'view_settlement',
            title: 'View',
            destructive: false
          },
          {
            id: 'thank_sender',
            title: 'Thank',
            destructive: false
          }
        ]
      }
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