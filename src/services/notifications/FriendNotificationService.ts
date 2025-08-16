// src/services/notifications/FriendNotificationService.ts
import AppNotificationService, { AppNotification } from './AppNotificationService';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface FriendRequest {
  id?: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  fromUserAvatar?: string;
  toUserEmail?: string;
  toUserPhone?: string;
  status: 'pending' | 'accepted' | 'declined';
  inviteMethod: 'email' | 'phone' | 'qr' | 'username';
  message?: string;
  createdAt: Date;
  respondedAt?: Date;
}

export class FriendNotificationService {
  private static instance: FriendNotificationService;
  private appNotificationService: AppNotificationService;

  constructor() {
    this.appNotificationService = AppNotificationService.getInstance();
  }

  static getInstance(): FriendNotificationService {
    if (!FriendNotificationService.instance) {
      FriendNotificationService.instance = new FriendNotificationService();
    }
    return FriendNotificationService.instance;
  }

  // Send friend request notification
  async sendFriendRequestNotification(
    friendRequest: FriendRequest,
    isNewUser: boolean = false
  ): Promise<void> {
    try {
      console.log('📤 Sending friend request notification:', friendRequest);

      const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
        userId: friendRequest.toUserId,
        type: 'friend_request',
        title: '🤝 New Friend Request',
        message: `${friendRequest.fromUserName} wants to be your friend on Spendy`,
        data: {
          friendRequestId: friendRequest.id,
          friendId: friendRequest.fromUserId,
          friendName: friendRequest.fromUserName,
          friendEmail: friendRequest.fromUserEmail,
          friendAvatar: friendRequest.fromUserAvatar,
          navigationType: 'friends',
          isNewUser
        },
        isRead: false
      };

      await this.appNotificationService.sendNotification(notification);

      // Also send email/SMS if user is not in app or new user
      if (isNewUser) {
        await this.sendExternalInvite(friendRequest);
      }

      console.log('✅ Friend request notification sent');
    } catch (error) {
      console.error('❌ Failed to send friend request notification:', error);
      throw error;
    }
  }

  // Send friend request accepted notification
  async sendFriendRequestAcceptedNotification(
    friendRequest: FriendRequest,
    acceptedByUserName: string
  ): Promise<void> {
    try {
      console.log('🎉 Sending friend request accepted notification');

      const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
        userId: friendRequest.fromUserId,
        type: 'friend_accepted',
        title: '🎉 Friend Request Accepted',
        message: `${acceptedByUserName} accepted your friend request! You're now friends on Spendy.`,
        data: {
          friendId: friendRequest.toUserId,
          friendName: acceptedByUserName,
          navigationType: 'friends'
        },
        isRead: false
      };

      await this.appNotificationService.sendNotification(notification);

      // Update friend request status
      if (friendRequest.id) {
        await updateDoc(doc(db, 'friendRequests', friendRequest.id), {
          status: 'accepted',
          respondedAt: serverTimestamp()
        });
      }

      console.log('✅ Friend request accepted notification sent');
    } catch (error) {
      console.error('❌ Failed to send friend request accepted notification:', error);
      throw error;
    }
  }

  // Send friend request declined notification
  async sendFriendRequestDeclinedNotification(
    friendRequest: FriendRequest,
    declinedByUserName: string
  ): Promise<void> {
    try {
      console.log('❌ Sending friend request declined notification');

      const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
        userId: friendRequest.fromUserId,
        type: 'friend_declined',
        title: '❌ Friend Request Declined',
        message: `${declinedByUserName} declined your friend request.`,
        data: {
          friendId: friendRequest.toUserId,
          friendName: declinedByUserName,
          navigationType: 'friends'
        },
        isRead: false
      };

      await this.appNotificationService.sendNotification(notification);

      // Update friend request status
      if (friendRequest.id) {
        await updateDoc(doc(db, 'friendRequests', friendRequest.id), {
          status: 'declined',
          respondedAt: serverTimestamp()
        });
      }

      console.log('✅ Friend request declined notification sent');
    } catch (error) {
      console.error('❌ Failed to send friend request declined notification:', error);
      throw error;
    }
  }

  // Send friend removed notification
  async sendFriendRemovedNotification(
    removedUserId: string,
    removedByUserId: string,
    removedByUserName: string,
    isBlocked: boolean = false
  ): Promise<void> {
    try {
      console.log('🚫 Sending friend removed notification');

      const action = isBlocked ? 'blocked' : 'removed';
      const title = isBlocked ? '🚫 You were blocked' : '💔 Friendship ended';
      const message = isBlocked 
        ? `${removedByUserName} has blocked you on Spendy.`
        : `${removedByUserName} is no longer your friend on Spendy.`;

      const notification: Omit<AppNotification, 'id' | 'createdAt'> = {
        userId: removedUserId,
        type: 'friend_removed',
        title,
        message,
        data: {
          friendId: removedByUserId,
          friendName: removedByUserName,
          action,
          navigationType: 'friends'
        },
        isRead: false
      };

      await this.appNotificationService.sendNotification(notification);

      console.log('✅ Friend removed notification sent');
    } catch (error) {
      console.error('❌ Failed to send friend removed notification:', error);
      throw error;
    }
  }

  // Send external invite (email/SMS) for new users
  private async sendExternalInvite(friendRequest: FriendRequest): Promise<void> {
    try {
      console.log('📧 Sending external invite for new user');

      const inviteData = {
        type: 'friend_invite',
        fromUserName: friendRequest.fromUserName,
        fromUserEmail: friendRequest.fromUserEmail,
        toUserEmail: friendRequest.toUserEmail,
        toUserPhone: friendRequest.toUserPhone,
        inviteMethod: friendRequest.inviteMethod,
        message: friendRequest.message,
        deepLink: this.generateDeepLink(friendRequest),
        appStoreLink: this.getAppStoreLink(),
        friendRequestId: friendRequest.id
      };

      // Call your email/SMS service API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/invites/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteData)
      });

      if (response.ok) {
        console.log('✅ External invite sent');
      } else {
        console.error('❌ Failed to send external invite:', await response.text());
      }
    } catch (error) {
      console.error('❌ Failed to send external invite:', error);
    }
  }

  // Generate deep link for friend request
  private generateDeepLink(friendRequest: FriendRequest): string {
    const baseUrl = 'https://spendy.app'; // Your app's universal link domain
    return `${baseUrl}/friend-request/${friendRequest.id}`;
  }

  // Get app store link
  private getAppStoreLink(): string {
    return 'https://apps.apple.com/app/spendy'; // Replace with your actual App Store link
  }

  // Handle friend request from deep link
  async handleFriendRequestFromDeepLink(
    friendRequestId: string,
    userId: string
  ): Promise<FriendRequest | null> {
    try {
      console.log('🔗 Handling friend request from deep link:', friendRequestId);

      const friendRequestDoc = await getDoc(doc(db, 'friendRequests', friendRequestId));
      if (!friendRequestDoc.exists()) {
        console.error('Friend request not found');
        return null;
      }

      const friendRequest = {
        id: friendRequestDoc.id,
        ...friendRequestDoc.data(),
        createdAt: friendRequestDoc.data().createdAt?.toDate() || new Date(),
        respondedAt: friendRequestDoc.data().respondedAt?.toDate()
      } as FriendRequest;

      // Verify this request is for the current user
      if (friendRequest.toUserId !== userId) {
        console.error('Friend request not for current user');
        return null;
      }

      // Check if already responded
      if (friendRequest.status !== 'pending') {
        console.log('Friend request already responded to');
        return friendRequest;
      }

      return friendRequest;
    } catch (error) {
      console.error('❌ Failed to handle friend request from deep link:', error);
      return null;
    }
  }

  // Accept friend request
  async acceptFriendRequest(friendRequestId: string, userId: string): Promise<boolean> {
    try {
      console.log('✅ Accepting friend request:', friendRequestId);

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/friends/requests/${friendRequestId}/accept`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        console.log('✅ Friend request accepted successfully');
        return true;
      } else {
        console.error('❌ Failed to accept friend request:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to accept friend request:', error);
      return false;
    }
  }

  // Decline friend request
  async declineFriendRequest(friendRequestId: string, userId: string): Promise<boolean> {
    try {
      console.log('❌ Declining friend request:', friendRequestId);

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/friends/requests/${friendRequestId}/decline`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        console.log('✅ Friend request declined successfully');
        return true;
      } else {
        console.error('❌ Failed to decline friend request:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to decline friend request:', error);
      return false;
    }
  }

  // Get auth token (implement based on your auth system)
  private async getAuthToken(): Promise<string> {
    // This should get the current user's auth token
    // Implementation depends on your authentication system
    return ''; // Replace with actual token retrieval
  }
}

export default FriendNotificationService;
