const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./firebase-admin-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Initialize Expo SDK
const expo = new Expo();

class NotificationSender {
  async sendToUser(userId, notification) {
    try {
      // Get user's tokens from database
      const userTokens = await this.getUserTokens(userId);
      
      const promises = [];
      
      for (const tokenData of userTokens) {
        if (tokenData.platform === 'expo') {
          promises.push(this.sendExpoNotification(tokenData.token, notification));
        } else if (tokenData.platform === 'fcm') {
          promises.push(this.sendFCMNotification(tokenData.token, notification));
        }
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async sendExpoNotification(token, notification) {
    if (!Expo.isExpoPushToken(token)) {
      console.error('Invalid Expo push token:', token);
      return;
    }

    const message = {
      to: token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      priority: 'high',
      channelId: notification.channelId || 'default',
    };

    try {
      const ticket = await expo.sendPushNotificationsAsync([message]);
      console.log('Expo notification sent:', ticket);
      
      // Handle ticket errors
      if (ticket[0].status === 'error') {
        console.error('Expo notification error:', ticket[0].message);
      }
    } catch (error) {
      console.error('Expo notification failed:', error);
    }
  }

  async sendFCMNotification(token, notification) {
    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: notification.channelId || 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('FCM notification sent:', response);
    } catch (error) {
      console.error('FCM notification failed:', error);
    }
  }

  async getUserTokens(userId) {
    // Get from your database
    // Return array of { token, platform }
    return [];
  }

  // Bulk notification methods
  async sendBulkNotifications(notifications) {
    const expoMessages = [];
    const fcmMessages = [];

    for (const notif of notifications) {
      if (Expo.isExpoPushToken(notif.token)) {
        expoMessages.push({
          to: notif.token,
          title: notif.title,
          body: notif.body,
          data: notif.data,
        });
      } else {
        fcmMessages.push({
          token: notif.token,
          notification: {
            title: notif.title,
            body: notif.body,
          },
          data: notif.data,
        });
      }
    }

    // Send Expo notifications in chunks
    const expoChunks = expo.chunkPushNotifications(expoMessages);
    for (const chunk of expoChunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }

    // Send FCM notifications
    if (fcmMessages.length > 0) {
      await admin.messaging().sendAll(fcmMessages);
    }
  }
}

module.exports = NotificationSender;
