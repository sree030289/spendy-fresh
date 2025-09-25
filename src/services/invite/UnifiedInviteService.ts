import { ApiService } from '../api/ApiService';
import { PhoneNumberService } from './PhoneNumberService';
import { Linking } from 'react-native';

export interface UnifiedInviteRequest {
  fromUserId: string;
  fromUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  toContact: string; // email or phone
  contactType: 'email' | 'phone';
  method: 'email' | 'sms' | 'qr' | 'whatsapp';
  message?: string;
  inviteId?: string; // for QR tracking
}

export interface InviteStatus {
  id: string;
  fromUserId: string;
  toContact: string;
  contactType: 'email' | 'phone';
  method: 'email' | 'sms' | 'qr' | 'whatsapp';
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'accepted' | 'expired';
  trackingData: {
    sentAt?: Date;
    deliveredAt?: Date;
    openedAt?: Date;
    acceptedAt?: Date;
    smsDeliveryId?: string;
    errorMessage?: string;
  };
  toUserId?: string; // Set when user registers
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class UnifiedInviteService {
  private apiService: ApiService;
  private phoneService: PhoneNumberService;
  
  constructor() {
    this.apiService = ApiService.getInstance();
    this.phoneService = new PhoneNumberService();
  }

  // Check if user exists by email or phone
  private async checkUserRegistration(contact: string, type: 'email' | 'phone') {
    try {
      const normalizedContact = type === 'phone' 
        ? this.phoneService.normalizePhoneNumber(contact) 
        : contact.toLowerCase();
      
      const user = await this.apiService.getUserByContact(normalizedContact, type);
      
      return {
        isRegistered: !!user,
        userId: user?.id,
        userData: user
      };
    } catch (error) {
      console.log(`User lookup failed for ${contact}:`, error);
      return { isRegistered: false, userId: null, userData: null };
    }
  }

  // Main invite processing method
  async processInvite(request: UnifiedInviteRequest): Promise<{
    success: boolean;
    message: string;
    inviteId?: string;
    isNewUser?: boolean;
  }> {
    try {
      // 1. Validate and normalize contact information
      let normalizedContact: string;
      try {
        normalizedContact = request.contactType === 'phone' 
          ? this.phoneService.normalizePhoneNumber(request.toContact)
          : request.toContact.toLowerCase();
      } catch (error) {
        return {
          success: false,
          message: error.message || 'Invalid contact information'
        };
      }

      // 2. Check if user is already registered
      const { isRegistered, userId, userData } = await this.checkUserRegistration(
        normalizedContact, 
        request.contactType
      );

      // 3. Check existing friendship if user is registered
      if (isRegistered) {
        const friendshipStatus = await this.apiService.checkExistingFriendship(
          request.fromUserId, 
          userData.email
        );
        
        if (friendshipStatus.isFriend) {
          return {
            success: false,
            message: `You're already friends with ${userData.fullName}!`
          };
        }

        if (friendshipStatus.status === 'request_sent') {
          return {
            success: false,
            message: `You already sent a friend request to ${userData.fullName}.`
          };
        }

        if (friendshipStatus.status === 'request_received') {
          return {
            success: false,
            message: `${userData.fullName} already sent you a friend request. Check your notifications.`
          };
        }
      }

      // 4. Create invite record
      const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const invite: InviteStatus = {
        id: inviteId,
        fromUserId: request.fromUserId,
        toContact: normalizedContact,
        contactType: request.contactType,
        method: request.method,
        status: 'pending',
        trackingData: {},
        toUserId: isRegistered ? userId : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days
      };

      // 5. Store invite in database
      await this.apiService.createInvite(invite);

      // 6. Send invite based on user registration status
      if (isRegistered) {
        await this.sendToRegisteredUser(request, userData, invite);
        await this.updateInviteStatus(inviteId, 'sent');
        
        return {
          success: true,
          message: `Friend request sent to ${userData.fullName}! They'll receive both a push notification and ${request.method} message.`,
          inviteId,
          isNewUser: false
        };
      } else {
        await this.sendToUnregisteredUser(request, invite);
        await this.updateInviteStatus(inviteId, 'sent');
        
        return {
          success: true,
          message: `Invitation sent! They'll get a friend request automatically when they join Spendy.`,
          inviteId,
          isNewUser: true
        };
      }
    } catch (error) {
      console.error('Unified invite processing error:', error);
      return {
        success: false,
        message: error.message || 'Failed to process invite'
      };
    }
  }

  // Send to registered user (dual delivery)
  private async sendToRegisteredUser(
    request: UnifiedInviteRequest, 
    userData: any, 
    invite: InviteStatus
  ) {
    try {
      // Create friend request in database
      await this.apiService.sendFriendRequest(
        request.fromUserId,
        userData.email,
        `Added via ${request.method}`
      );

      // Send push notification
      await this.apiService.sendPushNotification(userData.id, {
        title: 'New Friend Request! 👋',
        body: `${request.fromUserData.fullName} wants to be your friend on Meet-n-Split`,
        data: {
          type: 'friend_request',
          inviteId: invite.id,
          senderId: request.fromUserId,
          method: request.method
        }
      });

      // Send backup SMS/Email
      if (request.method === 'sms' || request.method === 'whatsapp') {
        await this.sendSMSBackup(userData.phone || request.toContact, request, invite);
      } else if (request.method === 'email') {
        await this.sendEmailBackup(userData.email, request, invite);
      }
    } catch (error) {
      console.error('Failed to send to registered user:', error);
      throw error;
    }
  }

  // Send to unregistered user
  private async sendToUnregisteredUser(request: UnifiedInviteRequest, invite: InviteStatus) {
    const message = this.generateInviteMessage(request);
    
    try {
      switch (request.method) {
        case 'sms':
          await this.sendSMS(request.toContact, message, invite);
          break;
        case 'whatsapp':
          await this.sendWhatsApp(request.toContact, message, invite);
          break;
        case 'email':
          await this.sendEmail(request.toContact, message, invite);
          break;
      }
    } catch (error) {
      console.error(`Failed to send ${request.method} to unregistered user:`, error);
      throw error;
    }
  }

  // SMS sending with tracking
  private async sendSMS(phoneNumber: string, message: string, invite: InviteStatus) {
    try {
      const normalizedPhone = this.phoneService.normalizePhoneNumber(phoneNumber);
      
      // For React Native, we'll use Linking to open SMS app
      const smsUrl = `sms:${normalizedPhone}?body=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(smsUrl);
      
      if (canOpen) {
        await Linking.openURL(smsUrl);
        
        // Update tracking data
        await this.updateInviteTracking(invite.id, {
          sentAt: new Date()
        });
      } else {
        throw new Error('SMS not available on this device');
      }
    } catch (error) {
      await this.updateInviteTracking(invite.id, {
        errorMessage: error.message,
        sentAt: new Date()
      });
      throw error;
    }
  }

  // WhatsApp sending
  private async sendWhatsApp(phoneNumber: string, message: string, invite: InviteStatus) {
    try {
      const normalizedPhone = this.phoneService.normalizePhoneNumber(phoneNumber);
      const formattedNumber = normalizedPhone.replace('+', '');
      
      const whatsappUrl = `whatsapp://send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        
        // Update tracking data
        await this.updateInviteTracking(invite.id, {
          sentAt: new Date()
        });
      } else {
        // Fallback to web WhatsApp
        const webUrl = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
        
        await this.updateInviteTracking(invite.id, {
          sentAt: new Date()
        });
      }
    } catch (error) {
      await this.updateInviteTracking(invite.id, {
        errorMessage: error.message,
        sentAt: new Date()
      });
      throw error;
    }
  }

  // Email sending
  private async sendEmail(email: string, message: string, invite: InviteStatus) {
    try {
      // Use existing email service
      await this.apiService.sendEmailInvite({
        to: email,
        subject: 'Join me on Meet-n-Split!',
        body: message,
        inviteId: invite.id
      });

      await this.updateInviteTracking(invite.id, {
        sentAt: new Date()
      });
    } catch (error) {
      await this.updateInviteTracking(invite.id, {
        errorMessage: error.message,
        sentAt: new Date()
      });
      throw error;
    }
  }

  // SMS backup for registered users
  private async sendSMSBackup(phoneNumber: string, request: UnifiedInviteRequest, invite: InviteStatus) {
    const backupMessage = `🤝 ${request.fromUserData.fullName} sent you a friend request on Meet-n-Split!\n\nCheck your notifications in the app to accept.`;
    
    try {
      await this.sendSMS(phoneNumber, backupMessage, invite);
    } catch (error) {
      console.log('SMS backup failed:', error);
      // Don't throw error for backup failures
    }
  }

  // Email backup for registered users
  private async sendEmailBackup(email: string, request: UnifiedInviteRequest, invite: InviteStatus) {
    const backupMessage = `🤝 ${request.fromUserData.fullName} sent you a friend request on Meet-n-Split!\n\nCheck your notifications in the app to accept.`;
    
    try {
      await this.sendEmail(email, backupMessage, invite);
    } catch (error) {
      console.log('Email backup failed:', error);
      // Don't throw error for backup failures
    }
  }

  // Generate appropriate invite message
  private generateInviteMessage(request: UnifiedInviteRequest): string {
    const senderName = request.fromUserData.fullName;
    const baseUrl = 'https://meetnsplit.com';
    
    return `Hi! 👋 ${senderName} invited you to join Meet-n-Split - the smart way to split expenses with friends! 💰\n\nJoin now: ${baseUrl}/register?invite=${request.fromUserId}\nDownload app: ${baseUrl}/download\n\n✨ Split bills, track expenses, settle up easily!`;
  }

  // Update invite status
  async updateInviteStatus(inviteId: string, status: InviteStatus['status']) {
    try {
      await this.apiService.updateInvite(inviteId, { 
        status, 
        updatedAt: new Date() 
      });
    } catch (error) {
      console.error('Failed to update invite status:', error);
    }
  }

  // Update tracking data
  async updateInviteTracking(inviteId: string, trackingData: Partial<InviteStatus['trackingData']>) {
    try {
      await this.apiService.updateInviteTracking(inviteId, trackingData);
    } catch (error) {
      console.error('Failed to update invite tracking:', error);
    }
  }

  // Handle user registration - check for pending invites
  async handleUserRegistration(newUser: { 
    id: string; 
    email: string; 
    phone?: string; 
    fullName: string; 
  }): Promise<{
    pendingInvites: InviteStatus[];
    friendRequestsCreated: number;
  }> {
    try {
      // Check for pending invites by email
      const emailInvites = await this.apiService.getPendingInvites(
        newUser.email.toLowerCase(), 
        'email'
      );
      
      // Check for pending invites by phone (if provided)
      const phoneInvites = newUser.phone ? 
        await this.apiService.getPendingInvites(
          this.phoneService.normalizePhoneNumber(newUser.phone), 
          'phone'
        ) : [];
      
      const allPendingInvites = [...emailInvites, ...phoneInvites];
      let friendRequestsCreated = 0;
      
      for (const invite of allPendingInvites) {
        try {
          // Convert pending invite to active friend request
          await this.apiService.sendFriendRequest(
            invite.fromUserId,
            newUser.email,
            `Converted from ${invite.method} invite`
          );

          // Update invite status
          await this.updateInviteStatus(invite.id, 'accepted');
          await this.apiService.updateInvite(invite.id, { toUserId: newUser.id });

          // Notify original sender
          await this.notifySenderOfAcceptance(invite.fromUserId, newUser, invite);
          
          friendRequestsCreated++;
        } catch (error) {
          console.error(`Failed to convert invite ${invite.id}:`, error);
        }
      }

      return {
        pendingInvites: allPendingInvites,
        friendRequestsCreated
      };
    } catch (error) {
      console.error('Registration invite check failed:', error);
      return { pendingInvites: [], friendRequestsCreated: 0 };
    }
  }

  // Notify sender that user joined
  private async notifySenderOfAcceptance(
    senderId: string, 
    newUser: any, 
    invite: InviteStatus
  ) {
    try {
      await this.apiService.sendPushNotification(senderId, {
        title: '🎉 Your Friend Joined!',
        body: `${newUser.fullName} joined Meet-n-Split and got your friend request!`,
        data: {
          type: 'friend_joined',
          inviteId: invite.id,
          newUserId: newUser.id,
          method: invite.method
        }
      });
    } catch (error) {
      console.error('Failed to notify sender of acceptance:', error);
    }
  }

  // Get pending invites for a user
  async getPendingInvitesForUser(userId: string): Promise<InviteStatus[]> {
    try {
      return await this.apiService.getPendingInvitesForUser(userId);
    } catch (error) {
      console.error('Failed to get pending invites:', error);
      return [];
    }
  }

  // Cancel/expire an invite
  async cancelInvite(inviteId: string, userId: string): Promise<boolean> {
    try {
      await this.apiService.cancelInvite(inviteId, userId);
      return true;
    } catch (error) {
      console.error('Failed to cancel invite:', error);
      return false;
    }
  }
}