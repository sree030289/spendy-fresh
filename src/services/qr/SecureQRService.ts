// src/services/qr/SecureQRService.ts
import { ApiService } from '@/services/api/ApiService';
import { Linking, Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CrossPlatformAlert } from '@/utils/alertUtils';

// Rate limiting constants
const QR_RATE_LIMIT = 10; // Max 10 QRs per hour
const QR_RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

export interface FriendInviteQR {
  type: 'friend_invite';
  version: '2.0';
  inviterId: string;
  inviterData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  inviteId: string; // Unique invite ID for tracking
  timestamp: number;
  expiresAt: number;
  signature: string; // Security signature
}

export interface GroupInviteQR {
  type: 'group_invite';
  version: '2.0';
  groupId: string;
  inviteCode: string;
  groupData: {
    name: string;
    avatar: string;
    memberCount: number;
  };
  inviterId: string;
  inviteId: string;
  timestamp: number;
  expiresAt: number;
  signature: string;
}

export type QRData = FriendInviteQR | GroupInviteQR;

export interface QRProcessResult {
  success: boolean;
  message: string;
  data?: any;
  shouldShowModal?: boolean;
  navigationAction?: {
    type: 'group_details' | 'friend_requests';
    groupId?: string;
  };
}

export class SecureQRService {
  private static instance: SecureQRService;
  private static readonly STORAGE_KEY = 'qr_generation_history';
  private static readonly APP_SECRET = 'spendy_qr_v2_secret'; // In production, use env var

  static getInstance(): SecureQRService {
    if (!SecureQRService.instance) {
      SecureQRService.instance = new SecureQRService();
    }
    return SecureQRService.instance;
  }

  // Generate Friend Invite QR
  async generateFriendInviteQR(
    inviterId: string,
    inviterData: { fullName: string; email: string; avatar?: string }
  ): Promise<string> {
    await this.checkRateLimit(inviterId);

    const inviteId = `friend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const expiresAt = timestamp + (7 * 24 * 60 * 60 * 1000); // 7 days

    const qrData: FriendInviteQR = {
      type: 'friend_invite',
      version: '2.0',
      inviterId,
      inviterData,
      inviteId,
      timestamp,
      expiresAt,
      signature: this.generateSignature({ inviterId, inviteId, timestamp, expiresAt })
    };

    const encodedQR = this.encodeQRData(qrData);
    await this.logQRGeneration(inviterId, 'friend_invite', inviteId);
    
    return encodedQR;
  }

  // Generate Group Invite QR
  async generateGroupInviteQR(
    groupId: string,
    inviteCode: string,
    groupData: { name: string; avatar: string; memberCount: number },
    inviterId: string
  ): Promise<string> {
    await this.checkRateLimit(inviterId);

    const inviteId = `group_${groupId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const expiresAt = timestamp + (30 * 24 * 60 * 60 * 1000); // 30 days

    const qrData: GroupInviteQR = {
      type: 'group_invite',
      version: '2.0',
      groupId,
      inviteCode,
      groupData,
      inviterId,
      inviteId,
      timestamp,
      expiresAt,
      signature: this.generateSignature({ groupId, inviteCode, inviterId, inviteId, timestamp, expiresAt })
    };

    const encodedQR = this.encodeQRData(qrData);
    await this.logQRGeneration(inviterId, 'group_invite', inviteId);
    
    return encodedQR;
  }

  // Encode QR data to URL
  private encodeQRData(qrData: QRData): string {
    try {
      const jsonString = JSON.stringify(qrData);
      const base64Data = btoa(encodeURIComponent(jsonString));
      
      // Create both deep link and universal link
      const deepLink = `spendy://qr?data=${base64Data}`;
      
      // In production, this would be your actual domain
      const universalLink = `https://spendy.app/qr?data=${base64Data}`;
      
      // For now, return deep link - we'll implement universal link fallback
      return deepLink;
    } catch (error) {
      console.error('QR encode error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  // Decode QR data from URL
  private decodeQRData(qrString: string): QRData {
    try {
      let encodedData: string;
      
      // Handle both deep links and universal links
      if (qrString.startsWith('spendy://qr?data=')) {
        encodedData = qrString.replace('spendy://qr?data=', '');
      } else if (qrString.includes('spendy.app/qr?data=')) {
        encodedData = qrString.split('data=')[1];
      } else {
        throw new Error('Invalid QR code format');
      }

      const jsonString = decodeURIComponent(atob(encodedData));
      const qrData: QRData = JSON.parse(jsonString);

      // Validate version
      if (qrData.version !== '2.0') {
        throw new Error('Unsupported QR code version');
      }

      // Check expiry
      if (Date.now() > qrData.expiresAt) {
        throw new Error('QR code has expired');
      }

      // Verify signature
      if (!this.verifySignature(qrData)) {
        throw new Error('Invalid QR code signature');
      }

      return qrData;
    } catch (error) {
      console.error('QR decode error:', error);
      throw new Error('Invalid or corrupted QR code');
    }
  }

  // Process scanned QR code
  async processScannedQR(qrString: string, currentUserId: string): Promise<QRProcessResult> {
    try {
      const qrData = this.decodeQRData(qrString);

      switch (qrData.type) {
        case 'friend_invite':
          return await this.processFriendInviteQR(qrData, currentUserId);
        case 'group_invite':
          return await this.processGroupInviteQR(qrData, currentUserId);
        default:
          throw new Error('Unknown QR code type');
      }
    } catch (error: any) {
      console.error('Process QR error:', error);
      return {
        success: false,
        message: error.message || 'Failed to process QR code'
      };
    }
  }

  // Process Friend Invite QR
  private async processFriendInviteQR(qrData: FriendInviteQR, currentUserId: string): Promise<QRProcessResult> {
    // Can't add yourself
    if (qrData.inviterId === currentUserId) {
      return {
        success: false,
        message: "You can't add yourself as a friend!"
      };
    }

    const apiService = ApiService.getInstance();

    try {
      // Check existing friendship status
      const existingStatus = await apiService.checkExistingFriendship(currentUserId, qrData.inviterData.email);
      
      if (existingStatus === 'accepted') {
        return {
          success: false,
          message: `You're already friends with ${qrData.inviterData.fullName}!`
        };
      }

      if (existingStatus === 'request_sent') {
        return {
          success: false,
          message: `You already sent a friend request to ${qrData.inviterData.fullName}. Please wait for their response.`
        };
      }

      if (existingStatus === 'request_received') {
        return {
          success: false,
          message: `${qrData.inviterData.fullName} already sent you a friend request. Check your notifications to accept it.`
        };
      }

      // Send friend request with QR tracking
      const result = await apiService.sendFriendRequestWithQR(
        currentUserId,
        qrData.inviterId,
        qrData.inviterData.email,
        qrData.inviteId,
        'Added via QR code scan'
      );

      // Send push notification to inviter
      await this.sendFriendInviteNotification(qrData.inviterId, currentUserId, qrData.inviteId);

      return {
        success: true,
        message: result.isNewUser 
          ? `Invitation saved! ${qrData.inviterData.fullName} will get your friend request when they join Spendy.`
          : `Friend request sent to ${qrData.inviterData.fullName}! They'll receive a notification.`,
        shouldShowModal: false
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to send friend request'
      };
    }
  }

  // Process Group Invite QR
  private async processGroupInviteQR(qrData: GroupInviteQR, currentUserId: string): Promise<QRProcessResult> {
    const apiService = ApiService.getInstance();

    try {
      // Join group using invite code
      const groupId = await apiService.joinGroupByInviteCode(qrData.inviteCode, currentUserId);

      // Send notification to group members about new join
      await this.sendGroupJoinNotification(qrData.groupId, currentUserId, qrData.inviterId);

      return {
        success: true,
        message: `Welcome to "${qrData.groupData.name}"!`,
        shouldShowModal: true,
        navigationAction: {
          type: 'group_details',
          groupId: groupId
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to join group'
      };
    }
  }

  // Send push notification for friend invite
  private async sendFriendInviteNotification(inviterId: string, requesterId: string, inviteId: string): Promise<void> {
    try {
      const apiService = ApiService.getInstance();
      
      // Get requester data for notification
      const requesterData = await apiService.getUserProfile(requesterId);
      
      const notificationData = {
        type: 'friend_request_received',
        senderId: requesterId,
        senderName: requesterData.fullName,
        senderEmail: requesterData.email,
        inviteId: inviteId,
        action: 'friend_request_qr',
        deepLink: `spendy://friend_request?inviteId=${inviteId}&senderId=${requesterId}`
      };

      await apiService.sendPushNotification(inviterId, {
        title: 'New Friend Request! 👋',
        body: `${requesterData.fullName} wants to be your friend on Spendy`,
        data: notificationData
      });
    } catch (error) {
      console.error('Failed to send friend invite notification:', error);
      // Don't throw - notification failure shouldn't fail the invite
    }
  }

  // Send push notification for group join
  private async sendGroupJoinNotification(groupId: string, newMemberId: string, inviterId: string): Promise<void> {
    try {
      const apiService = ApiService.getInstance();
      
      // Get new member data
      const newMemberData = await apiService.getUserProfile(newMemberId);
      const groupData = await apiService.getGroup(groupId);
      
      const notificationData = {
        type: 'group_member_joined',
        groupId: groupId,
        groupName: groupData.name,
        newMemberName: newMemberData.fullName,
        deepLink: `spendy://group?id=${groupId}`
      };

      // Notify all group members except the new member
      const members = groupData.members.filter((m: any) => m.userId !== newMemberId);
      
      for (const member of members) {
        await apiService.sendPushNotification(member.userId, {
          title: `${groupData.name}`,
          body: `${newMemberData.fullName} joined the group!`,
          data: notificationData
        });
      }
    } catch (error) {
      console.error('Failed to send group join notification:', error);
    }
  }

  // Rate limiting check
  private async checkRateLimit(userId: string): Promise<void> {
    try {
      const historyKey = `${this.constructor.name}_${userId}`;
      const history = await AsyncStorage.getItem(historyKey);
      const qrHistory: number[] = history ? JSON.parse(history) : [];

      const now = Date.now();
      const windowStart = now - QR_RATE_WINDOW;
      
      // Filter to only recent generations
      const recentGenerations = qrHistory.filter(timestamp => timestamp > windowStart);

      if (recentGenerations.length >= QR_RATE_LIMIT) {
        throw new Error(`Rate limit exceeded. You can only generate ${QR_RATE_LIMIT} QR codes per hour.`);
      }

      // Add current generation and save
      recentGenerations.push(now);
      await AsyncStorage.setItem(historyKey, JSON.stringify(recentGenerations));
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rate limit')) {
        throw error;
      }
      // If storage fails, don't block QR generation
      console.warn('Rate limit check failed:', error);
    }
  }

  // Generate security signature
  private generateSignature(data: any): string {
    const dataString = JSON.stringify(data);
    // Simple hash - in production use proper HMAC
    const hash = btoa(dataString + this.constructor.name + SecureQRService.APP_SECRET);
    return hash.substring(0, 16);
  }

  // Verify security signature
  private verifySignature(qrData: QRData): boolean {
    const { signature, ...dataWithoutSignature } = qrData;
    const expectedSignature = this.generateSignature(dataWithoutSignature);
    return signature === expectedSignature;
  }

  // Log QR generation for analytics
  private async logQRGeneration(userId: string, type: string, inviteId: string): Promise<void> {
    try {
      console.log('QR Generated:', { userId, type, inviteId, timestamp: Date.now() });
      // In production, send to analytics service
    } catch (error) {
      console.warn('Failed to log QR generation:', error);
    }
  }

  // Share QR code
  async shareQRCode(qrUrl: string, type: 'friend' | 'group', targetName: string): Promise<void> {
    try {
      const shareMessage = type === 'friend' 
        ? `Add me as a friend on Spendy! Tap this link: ${qrUrl}`
        : `Join "${targetName}" group on Spendy! Tap this link: ${qrUrl}`;

      await Share.share({
        title: type === 'friend' ? 'Add me on Spendy!' : `Join ${targetName}`,
        message: shareMessage,
        url: qrUrl
      });
    } catch (error) {
      console.error('Share QR error:', error);
      throw new Error('Failed to share QR code');
    }
  }

  // Handle non-app users (fallback to app store)
  static handleNonAppUser(qrUrl: string): void {
    const appStoreUrl = Platform.select({
      ios: 'https://apps.apple.com/app/spendy/id123456789',
      android: 'https://play.google.com/store/apps/details?id=com.svaag.spendy'
    });

    if (appStoreUrl) {
      CrossPlatformAlert.alert(
        'Download Spendy',
        'You need to install Spendy app to accept this invitation.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Download', 
            onPress: () => Linking.openURL(appStoreUrl) 
          }
        ]
      );
    }
  }
}