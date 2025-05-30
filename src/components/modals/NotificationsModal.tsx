// Create new file: src/components/modals/NotificationsModal.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { Notification } from '@/services/firebase/splitting';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToNotification: (notification: Notification) => void;
  loading?: boolean;
}

export default function NotificationsModal({
  visible,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateToNotification,
  loading = false
}: NotificationsModalProps) {
  const { theme } = useTheme();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return 'person-add';
      case 'expense_added':
        return 'receipt';
      case 'payment_received':
        return 'card';
      case 'group_invite':
        return 'people';
      case 'group_message':
        return 'chatbubble';
      default:
        return 'notifications';
    }
  };

  const formatNotificationTime = (date: Date | any): string => {
    // Handle Firestore timestamp conversion
    let actualDate: Date;
    if (date && typeof date.toDate === 'function') {
      actualDate = date.toDate(); // Firestore Timestamp
    } else if (date instanceof Date) {
      actualDate = date;
    } else if (date && typeof date === 'string') {
      actualDate = new Date(date);
    } else {
      return 'Unknown time';
    }

    const now = new Date();
    const diffInHours = (now.getTime() - actualDate.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 0 ? 'now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return 'yesterday';
      if (diffInDays < 7) return `${diffInDays}d ago`;
      return actualDate.toLocaleDateString();
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read first
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    
    // Close the notifications modal
    onClose();
    
    // Navigate to the appropriate screen
    onNavigateToNotification(notification);
  };

  const renderNotification = (notification: Notification) => (
    <TouchableOpacity
      key={notification.id}
      style={[
        styles.notificationItem,
        { backgroundColor: theme.colors.surface }
      ]}
      onPress={() => handleNotificationPress(notification)}
    >
      <View style={styles.notificationIcon}>
        <Ionicons
          name={getNotificationIcon(notification.type) as any}
          size={20}
          color={theme.colors.primary}
        />
      </View>
      
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, { color: theme.colors.text }]}>
          {notification.title}
        </Text>
        <Text style={[styles.notificationMessage, { color: theme.colors.textSecondary }]}>
          {notification.message}
        </Text>
        <Text style={[styles.notificationTime, { color: theme.colors.textSecondary }]}>
          {formatNotificationTime(notification.createdAt)}
        </Text>
      </View>
      
      {!notification.isRead && (
        <View style={[styles.unreadIndicator, { backgroundColor: theme.colors.primary }]} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Notifications
          </Text>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={onMarkAllAsRead}>
              <Text style={[styles.markAllText, { color: theme.colors.primary }]}>
                Mark All Read
              </Text>
            </TouchableOpacity>
          )}
          {notifications.length === 0 && <View style={{ width: 24 }} />}
        </View>

        {/* Notifications List */}
        <ScrollView contentContainerStyle={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Loading notifications...
              </Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No Notifications
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                You're all caught up! New notifications will appear here.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </Text>
              {notifications.map(renderNotification)}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    position: 'relative',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 16,
    right: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});