// src/services/NotificationService.ts
import { db, messaging } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'reminder' | 'overdue' | 'payment_confirmation' | 'sync' | 'system';
  priority: 'low' | 'medium' | 'high';
  isRead: boolean;
  reminderId?: string;
  actionUrl?: string;
  data?: any;
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PushNotificationData {
  title: string;
  body: string;
  data?: { [key: string]: string };
  token?: string;
  topic?: string;
}

export class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Send immediate app notification
  async sendAppNotification(
    userId: string,
    title: string,
    message: string,
    type: AppNotification['type'] = 'system',
    options: Partial<AppNotification> = {}
  ): Promise<string> {
    try {
      const notification: Omit<AppNotification, 'id'> = {
        userId,
        title,
        message,
        type,
        priority: options.priority || 'medium',
        isRead: false,
        reminderId: options.reminderId,
        actionUrl: options.actionUrl,
        data: options.data || {},
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await db.collection('appNotifications').add(notification);
      
      // Also try to send push notification if user has FCM token
      await this.sendPushNotificationToUser(userId, {
        title,
        body: message,
        data: {
          type,
          notificationId: docRef.id,
          reminderId: options.reminderId || '',
          actionUrl: options.actionUrl || ''
        }
      });

      console.log(`✅ App notification sent to user ${userId}: ${title}`);
      return docRef.id;

    } catch (error) {
      console.error('❌ Failed to send app notification:', error);
      throw error;
    }
  }

  // Send push notification to specific user
  async sendPushNotificationToUser(
    userId: string, 
    notification: PushNotificationData
  ): Promise<boolean> {
    try {
      // Get user's FCM tokens
      const tokensQuery = await db.collection('fcmTokens')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();

      if (tokensQuery.empty) {
        console.log(`No FCM tokens found for user ${userId}`);
        return false;
      }

      const tokens = tokensQuery.docs.map(doc => doc.data().token);
      
      // Send to all user's devices
      const multicastMessage = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        tokens
      };

      const response = await messaging.sendMulticast(multicastMessage);
      
      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.warn(`Failed to send to token ${tokens[idx]}:`, resp.error);
          }
        });

        // Remove invalid tokens
        await this.removeInvalidTokens(failedTokens);
      }

      console.log(`✅ Push notification sent to ${response.successCount}/${tokens.length} devices for user ${userId}`);
      return response.successCount > 0;

    } catch (error) {
      console.error('❌ Failed to send push notification:', error);
      return false;
    }
  }

  // Register FCM token for user
  async registerFCMToken(userId: string, token: string, deviceInfo?: any): Promise<void> {
    try {
      // Check if token already exists
      const existingQuery = await db.collection('fcmTokens')
        .where('token', '==', token)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        // Update existing token
        const doc = existingQuery.docs[0];
        await doc.ref.update({
          userId,
          isActive: true,
          deviceInfo: deviceInfo || {},
          lastUsed: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        // Create new token record
        await db.collection('fcmTokens').add({
          userId,
          token,
          isActive: true,
          deviceInfo: deviceInfo || {},
          registeredAt: FieldValue.serverTimestamp(),
          lastUsed: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      console.log(`✅ FCM token registered for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to register FCM token:', error);
      throw error;
    }
  }

  // Remove FCM token
  async removeFCMToken(token: string): Promise<void> {
    try {
      const tokenQuery = await db.collection('fcmTokens')
        .where('token', '==', token)
        .limit(1)
        .get();

      if (!tokenQuery.empty) {
        await tokenQuery.docs[0].ref.update({
          isActive: false,
          deactivatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      console.log(`✅ FCM token removed: ${token}`);
    } catch (error) {
      console.error('❌ Failed to remove FCM token:', error);
      throw error;
    }
  }

  // Get user's notifications
  async getUserNotifications(
    userId: string, 
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: AppNotification['type'];
    } = {}
  ): Promise<{
    notifications: AppNotification[];
    total: number;
    unreadCount: number;
  }> {
    try {
      let query = db.collection('appNotifications')
        .where('userId', '==', userId);

      if (options.unreadOnly) {
        query = query.where('isRead', '==', false);
      }

      if (options.type) {
        query = query.where('type', '==', options.type);
      }

      query = query.orderBy('createdAt', 'desc');

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      const notifications: AppNotification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
        readAt: doc.data().readAt?.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      } as AppNotification));

      // Get total and unread counts
      const totalQuery = await db.collection('appNotifications')
        .where('userId', '==', userId)
        .get();
      
      const unreadQuery = await db.collection('appNotifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      return {
        notifications,
        total: totalQuery.size,
        unreadCount: unreadQuery.size
      };

    } catch (error) {
      console.error('❌ Failed to get user notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notificationRef = db.collection('appNotifications').doc(notificationId);
      const notification = await notificationRef.get();

      if (!notification.exists) {
        throw new Error('Notification not found');
      }

      const notificationData = notification.data();
      if (notificationData?.userId !== userId) {
        throw new Error('Unauthorized access to notification');
      }

      await notificationRef.update({
        isRead: true,
        readAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`✅ Notification ${notificationId} marked as read for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for user
  async markAllNotificationsAsRead(userId: string): Promise<number> {
    try {
      const unreadQuery = await db.collection('appNotifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      if (unreadQuery.empty) {
        return 0;
      }

      const batch = db.batch();
      unreadQuery.docs.forEach(doc => {
        batch.update(doc.ref, {
          isRead: true,
          readAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      
      console.log(`✅ Marked ${unreadQuery.size} notifications as read for user ${userId}`);
      return unreadQuery.size;

    } catch (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const notificationRef = db.collection('appNotifications').doc(notificationId);
      const notification = await notificationRef.get();

      if (!notification.exists) {
        throw new Error('Notification not found');
      }

      const notificationData = notification.data();
      if (notificationData?.userId !== userId) {
        throw new Error('Unauthorized access to notification');
      }

      await notificationRef.delete();
      
      console.log(`✅ Notification ${notificationId} deleted for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to delete notification:', error);
      throw error;
    }
  }

  // Schedule reminder notifications
  async scheduleReminderNotifications(
    userId: string,
    reminderId: string,
    reminder: {
      title: string;
      amount: number;
      currency: string;
      dueDate: Date;
      reminderDays: number[];
    }
  ): Promise<void> {
    try {
      const { title, amount, currency, dueDate, reminderDays } = reminder;
      const now = new Date();

      // Schedule notifications for each reminder day
      for (const daysBefore of reminderDays) {
        const notificationDate = new Date(dueDate.getTime() - daysBefore * 24 * 60 * 60 * 1000);
        
        if (notificationDate > now) {
          const notificationTitle = daysBefore === 0 
            ? '💸 Payment Due Today!' 
            : `🔔 Payment Due in ${daysBefore} day${daysBefore === 1 ? '' : 's'}`;
          
          const notificationMessage = `${title} - ${currency} ${amount.toFixed(2)}`;

          await db.collection('scheduledNotifications').add({
            userId,
            reminderId,
            type: 'reminder',
            title: notificationTitle,
            message: notificationMessage,
            scheduledFor: notificationDate,
            status: 'scheduled',
            reminderData: {
              title,
              amount,
              currency,
              dueDate: dueDate.toISOString(),
              daysBefore
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      // Schedule overdue notification for day after due date
      const overdueDate = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000);
      if (overdueDate > now) {
        await db.collection('scheduledNotifications').add({
          userId,
          reminderId,
          type: 'overdue',
          title: '⚠️ Payment Overdue!',
          message: `${title} was due yesterday - ${currency} ${amount.toFixed(2)}`,
          scheduledFor: overdueDate,
          status: 'scheduled',
          reminderData: {
            title,
            amount,
            currency,
            dueDate: dueDate.toISOString(),
            daysBefore: -1
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      console.log(`✅ Scheduled ${reminderDays.length + 1} notifications for reminder: ${title}`);
    } catch (error) {
      console.error('❌ Failed to schedule reminder notifications:', error);
      throw error;
    }
  }

  // Cancel scheduled notifications for reminder
  async cancelReminderNotifications(reminderId: string): Promise<void> {
    try {
      const scheduledQuery = await db.collection('scheduledNotifications')
        .where('reminderId', '==', reminderId)
        .where('status', '==', 'scheduled')
        .get();

      if (scheduledQuery.empty) {
        return;
      }

      const batch = db.batch();
      scheduledQuery.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'cancelled',
          cancelledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      
      console.log(`✅ Cancelled ${scheduledQuery.size} scheduled notifications for reminder ${reminderId}`);
    } catch (error) {
      console.error('❌ Failed to cancel reminder notifications:', error);
      throw error;
    }
  }

  // Process due notifications (called by scheduled job)
  async processDueNotifications(): Promise<number> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const dueNotificationsQuery = await db.collection('scheduledNotifications')
        .where('status', '==', 'scheduled')
        .where('scheduledFor', '<=', now)
        .where('scheduledFor', '>=', fiveMinutesAgo) // Prevent processing old notifications
        .get();

      if (dueNotificationsQuery.empty) {
        return 0;
      }

      let processedCount = 0;
      const batch = db.batch();

      for (const doc of dueNotificationsQuery.docs) {
        const notification = doc.data();
        
        try {
          // Send app notification
          await this.sendAppNotification(
            notification.userId,
            notification.title,
            notification.message,
            notification.type,
            {
              priority: notification.type === 'overdue' ? 'high' : 'medium',
              reminderId: notification.reminderId,
              data: notification.reminderData
            }
          );

          // Mark as sent
          batch.update(doc.ref, {
            status: 'sent',
            sentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });

          processedCount++;
        } catch (error) {
          console.error(`Failed to send notification ${doc.id}:`, error);
          
          // Mark as failed
          batch.update(doc.ref, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      await batch.commit();
      
      console.log(`✅ Processed ${processedCount} due notifications`);
      return processedCount;

    } catch (error) {
      console.error('❌ Failed to process due notifications:', error);
      throw error;
    }
  }

  // Clean up old notifications (called by scheduled job)
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldNotificationsQuery = await db.collection('appNotifications')
        .where('createdAt', '<', cutoffDate)
        .limit(500) // Process in batches
        .get();

      if (oldNotificationsQuery.empty) {
        return 0;
      }

      const batch = db.batch();
      oldNotificationsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      
      console.log(`✅ Cleaned up ${oldNotificationsQuery.size} old notifications`);
      return oldNotificationsQuery.size;

    } catch (error) {
      console.error('❌ Failed to cleanup old notifications:', error);
      throw error;
    }
  }

  // Private helper methods
  private async removeInvalidTokens(tokens: string[]): Promise<void> {
    try {
      const batch = db.batch();
      
      for (const token of tokens) {
        const tokenQuery = await db.collection('fcmTokens')
          .where('token', '==', token)
          .limit(1)
          .get();

        if (!tokenQuery.empty) {
          batch.update(tokenQuery.docs[0].ref, {
            isActive: false,
            deactivatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      await batch.commit();
      console.log(`✅ Removed ${tokens.length} invalid FCM tokens`);
    } catch (error) {
      console.error('❌ Failed to remove invalid tokens:', error);
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();