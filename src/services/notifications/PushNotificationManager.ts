// src/services/notifications/PushNotificationManager.ts
import * as Notifications from 'expo-notifications';
import { ApiService } from '@/services/api/ApiService';

export interface DeepLinkData {
  screen: string;
  params?: Record<string, any>;
}

export interface PushNotificationData {
  type: 'friend_request' | 'friend_response' | 'group_created' | 'expense_added' | 'payment_reminder' | 'friend_removed' | 'payment_confirmed' | 'daily_reminder';
  title: string;
  message: string;
  deepLink: DeepLinkData;
  additionalData?: Record<string, any>;
}

export class PushNotificationManager {
  private static instance: PushNotificationManager;
  private apiService: ApiService;

  private constructor() {
    this.apiService = ApiService.getInstance();
  }

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  // 1. Friend Invite Notification
  async sendFriendInviteNotification(toUserId: string, fromUserName: string): Promise<void> {
    const notificationData: PushNotificationData = {
      type: 'friend_request',
      title: '🤝 New Friend Request',
      message: `${fromUserName} wants to be your friend on Spendy!`,
      deepLink: {
        screen: 'FriendRequestModal',
        params: { autoOpen: true }
      },
      additionalData: {
        fromUserName
      }
    };

    await this.sendNotification(toUserId, notificationData);
  }

  // 2. Friend Request Response Notification
  async sendFriendResponseNotification(toUserId: string, fromUserName: string, accepted: boolean): Promise<void> {
    const notificationData: PushNotificationData = {
      type: 'friend_response',
      title: accepted ? '🎉 Friend Request Accepted' : '❌ Friend Request Declined',
      message: accepted 
        ? `${fromUserName} accepted your friend request!`
        : `${fromUserName} declined your friend request.`,
      deepLink: {
        screen: 'MainTabs',
        params: { 
          initialTab: 'Split',
          openFriendsTab: true 
        }
      },
      additionalData: {
        fromUserName,
        accepted
      }
    };

    await this.sendNotification(toUserId, notificationData);
  }

  // 3. Group Created Notification
  async sendGroupCreatedNotification(memberUserIds: string[], groupName: string, groupId: string, creatorName: string): Promise<void> {
    const notificationData: PushNotificationData = {
      type: 'group_created',
      title: '👥 Added to Group',
      message: `${creatorName} added you to "${groupName}" group`,
      deepLink: {
        screen: 'GroupDetailsModal',
        params: { 
          groupId,
          autoOpen: true
        }
      },
      additionalData: {
        groupName,
        groupId,
        creatorName
      }
    };

    // Send to all members except creator
    for (const userId of memberUserIds) {
      await this.sendNotification(userId, notificationData);
    }
  }

  // 4. Expense Added Notification
  async sendExpenseAddedNotification(memberUserIds: string[], expenseDescription: string, amount: number, currency: string, groupName: string, groupId: string, addedByName: string): Promise<void> {
    const notificationData: PushNotificationData = {
      type: 'expense_added',
      title: '💰 New Expense Added',
      message: `${addedByName} added "${expenseDescription}" (${currency}${amount.toFixed(2)}) to ${groupName}`,
      deepLink: {
        screen: 'GroupDetailsModal',
        params: { 
          groupId,
          autoOpen: true
        }
      },
      additionalData: {
        expenseDescription,
        amount,
        currency,
        groupName,
        groupId,
        addedByName
      }
    };

    // Send to all members except the one who added the expense
    for (const userId of memberUserIds) {
      await this.sendNotification(userId, notificationData);
    }
  }

  // 5. Payment Reminder Notification (already implemented, enhancing with deep link)
  async sendPaymentReminderNotification(toUserId: string, fromUserName: string, amount: number, currency: string, groupId?: string): Promise<void> {
    const notificationData: PushNotificationData = {
      type: 'payment_reminder',
      title: '💸 Payment Reminder',
      message: `${fromUserName} is reminding you about a payment of ${currency}${amount}`,
      deepLink: {
        screen: 'SettlementModal',
        params: { 
          groupId,
          autoOpen: true,
          highlightUser: toUserId
        }
      },
      additionalData: {
        fromUserName,
        amount,
        currency,
        groupId
      }
    };

    await this.sendNotification(toUserId, notificationData);
  }

  // 6. Friend Removed Notification
  async sendFriendRemovedNotification(toUserId: string, removedByName: string): Promise<void> {
    const notificationData: PushNotificationData = {
      type: 'friend_removed',
      title: '👋 Friend Removed',
      message: `${removedByName} removed you from their friends list`,
      deepLink: {
        screen: 'MainTabs',
        params: { 
          initialTab: 'Split',
          openFriendsTab: true 
        }
      },
      additionalData: {
        removedByName
      }
    };

    await this.sendNotification(toUserId, notificationData);
  }

  // 7. Mark as Paid Notification
  async sendPaymentConfirmedNotification(userIds: string[], paidByName: string, receivedByName: string, amount: number, currency: string, groupName?: string): Promise<void> {
    for (const userId of userIds) {
      const notificationData: PushNotificationData = {
        type: 'payment_confirmed',
        title: '✅ Payment Confirmed',
        message: `${paidByName} paid ${currency}${amount} to ${receivedByName}${groupName ? ` in ${groupName}` : ''}`,
        deepLink: {
          screen: 'SettlementModal',
          params: { 
            autoOpen: true,
            openHistoryTab: true
          }
        },
        additionalData: {
          paidByName,
          receivedByName,
          amount,
          currency,
          groupName
        }
      };

      await this.sendNotification(userId, notificationData);
    }
  }

  // 8. Daily Expense Reminder
  async sendDailyExpenseReminder(userId: string): Promise<void> {
    const notificationData: PushNotificationData = {
      type: 'daily_reminder',
      title: '💰 Daily Expense Check',
      message: "Don't forget to log your expenses for today!",
      deepLink: {
        screen: 'MainTabs',
        params: { 
          initialTab: 'Split' // Overview tab
        }
      },
      additionalData: {
        reminderType: 'daily_expenses'
      }
    };

    await this.sendNotification(userId, notificationData);
  }

  // Core notification sending method
  private async sendNotification(userId: string, notificationData: PushNotificationData): Promise<void> {
    try {
      // Send notification via API
      await this.apiService.createNotification({
        userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: {
          deepLink: notificationData.deepLink,
          ...notificationData.additionalData
        }
      });

      console.log(`📱 Sent ${notificationData.type} notification to user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send ${notificationData.type} notification:`, error);
    }
  }

  // Deep link handler for when notifications are tapped
  static handleNotificationTap(notificationData: any, navigation: any): void {
    const deepLink = notificationData?.deepLink;
    if (!deepLink) return;

    console.log('🔗 Handling notification deep link:', deepLink);

    try {
      switch (deepLink.screen) {
        case 'FriendRequestModal':
          // Navigate to main screen with friend requests trigger
          navigation.navigate('Main', { 
            openFriendRequests: true
          });
          break;

        case 'MainTabs':
          // Navigate to main screen with specific tab/action
          const { initialTab, openFriendsTab } = deepLink.params || {};
          navigation.navigate('Main', {
            initialTab: initialTab || 'Split',
            openFriendsTab: openFriendsTab || false
          });
          break;

        case 'GroupDetailsModal':
          // Navigate to main screen and open group details
          const { groupId } = deepLink.params || {};
          navigation.navigate('Main', { 
            openGroupDetails: true,
            groupId 
          });
          break;

        case 'SettlementModal':
          // Navigate to main screen and open settlement modal
          const { groupId: settlementGroupId, highlightUser, openHistoryTab } = deepLink.params || {};
          navigation.navigate('Main', { 
            openSettlement: true,
            groupId: settlementGroupId,
            highlightUser,
            openHistoryTab
          });
          break;

        default:
          // Default case: just navigate to main screen
          console.warn('Unknown deep link screen:', deepLink.screen, '- navigating to Main');
          navigation.navigate('Main', deepLink.params || {});
      }
      
      console.log('✅ Successfully handled deep link navigation');
    } catch (error) {
      console.error('❌ Error handling deep link navigation:', error);
      // Fallback: just navigate to main screen
      navigation.navigate('Main');
    }
  }
}