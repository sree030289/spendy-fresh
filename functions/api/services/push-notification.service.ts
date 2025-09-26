import { messaging } from '../config/firebase';

/**
 * Push Notification Service for unified invites
 * 
 * Handles push notifications for registered users via Firebase Cloud Messaging (FCM)
 */

export interface PushNotification {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  badge?: number;
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class PushNotificationService {
  /**
   * Send push notification to a single device
   */
  static async sendToDevice(notification: PushNotification): Promise<PushResult> {
    try {
      const message = {
        token: notification.token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: notification.data || {},
        android: {
          notification: {
            sound: 'default',
            priority: 'high' as const,
            badge: notification.badge
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: notification.badge
            }
          }
        }
      };

      const response = await messaging.send(message);
      
      return {
        success: true,
        messageId: response
      };
    } catch (error) {
      console.error('Push notification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown push notification error'
      };
    }
  }

  /**
   * Send friend invite notification to registered user
   */
  static async sendFriendInviteNotification(data: {
    recipientToken: string;
    inviterName: string;
    inviterProfilePicture?: string;
    inviteId: string;
  }): Promise<PushResult> {
    return await PushNotificationService.sendToDevice({
      token: data.recipientToken,
      title: 'Friend Request',
      body: `${data.inviterName} sent you a friend request!`,
      imageUrl: data.inviterProfilePicture,
      data: {
        type: 'friend_invite',
        inviteId: data.inviteId,
        inviterName: data.inviterName,
        action: 'open_invite'
      },
      badge: 1
    });
  }

  /**
   * Send friend request accepted notification
   */
  static async sendAcceptedNotification(data: {
    recipientToken: string;
    accepterName: string;
    accepterProfilePicture?: string;
  }): Promise<PushResult> {
    return await PushNotificationService.sendToDevice({
      token: data.recipientToken,
      title: 'Friend Request Accepted',
      body: `${data.accepterName} accepted your friend request!`,
      imageUrl: data.accepterProfilePicture,
      data: {
        type: 'friend_accepted',
        accepterName: data.accepterName,
        action: 'open_friends'
      },
      badge: 1
    });
  }

  /**
   * Send welcome notification for auto-accepted invites
   */
  static async sendWelcomeNotification(data: {
    recipientToken: string;
    friendCount: number;
    friendNames: string[];
  }): Promise<PushResult> {
    let body: string;
    
    if (data.friendCount === 1) {
      body = `Welcome to Spendy! ${data.friendNames[0]} is now your friend.`;
    } else {
      const namesList = data.friendNames.slice(0, 2).join(', ');
      const remaining = data.friendCount - 2;
      const friendsText = remaining > 0 ? `${namesList} and ${remaining} others` : namesList;
      body = `Welcome to Spendy! ${friendsText} are now your friends.`;
    }

    return await PushNotificationService.sendToDevice({
      token: data.recipientToken,
      title: 'Welcome to Spendy!',
      body,
      data: {
        type: 'welcome',
        friendCount: data.friendCount.toString(),
        action: 'open_friends'
      },
      badge: data.friendCount
    });
  }

  /**
   * Send notification to multiple devices
   */
  static async sendToMultipleDevices(
    tokens: string[],
    notification: Omit<PushNotification, 'token'>
  ): Promise<{ successCount: number; failureCount: number; results: PushResult[] }> {
    const promises = tokens.map(token => 
      PushNotificationService.sendToDevice({ ...notification, token })
    );

    const results = await Promise.all(promises);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return {
      successCount,
      failureCount,
      results
    };
  }

  /**
   * Validate push token format
   */
  static validatePushToken(token: string): boolean {
    // Basic validation - FCM tokens are typically 140+ characters
    return token && token.length > 100 && /^[A-Za-z0-9_-]+$/.test(token.replace(/:/g, ''));
  }

  /**
   * Subscribe token to a topic (for broadcast notifications)
   */
  static async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await messaging.subscribeToTopic(tokens, topic);
      console.log(`Subscribed ${tokens.length} tokens to topic: ${topic}`);
    } catch (error) {
      console.error('Topic subscription error:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe token from a topic
   */
  static async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await messaging.unsubscribeFromTopic(tokens, topic);
      console.log(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
    } catch (error) {
      console.error('Topic unsubscription error:', error);
      throw error;
    }
  }
}
