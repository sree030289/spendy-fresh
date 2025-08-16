/**
 * Simple Notification Test Component
 * Add this to any screen to test if notifications are being created
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: any;
  isRead: boolean;
}

export const NotificationTester: React.FC<{ userId: string }> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Test function to check notifications via API
    const checkNotifications = async () => {
      try {
        const response = await fetch('https://spendyapi-2fy22mkg6q-uc.a.run.app/notifications', {
          headers: {
            'Authorization': `Bearer YOUR_TOKEN_HERE` // Replace with actual token
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    checkNotifications();
    // Check every 30 seconds
    const interval = setInterval(checkNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📬 Notifications ({notifications.length})</Text>
      <ScrollView style={styles.scrollView}>
        {notifications.length === 0 ? (
          <Text style={styles.noNotifications}>No notifications yet</Text>
        ) : (
          notifications.map((notification) => (
            <View key={notification.id} style={[
              styles.notificationItem,
              !notification.isRead && styles.unread
            ]}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              <Text style={styles.notificationTime}>
                {notification.createdAt?.toDate?.()?.toLocaleString() || 'Recent'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  scrollView: {
    maxHeight: 200,
  },
  noNotifications: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  notificationItem: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ddd',
  },
  unread: {
    borderLeftColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  notificationTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 10,
    color: '#666',
  },
});
