import { PhoneNumberService } from './PhoneNumberService';
import { ApiService } from '../api/ApiService';
import { 
  UnifiedInvite, 
  InviteCreationRequest, 
  InviteResponse, 
  PendingInviteCheckResult, 
  User 
} from '../../types';

export class UnifiedInviteService {
  private static instance: UnifiedInviteService;
  private apiService: ApiService;

  private constructor() {
    this.apiService = ApiService.getInstance();
  }

  static getInstance(): UnifiedInviteService {
    if (!UnifiedInviteService.instance) {
      UnifiedInviteService.instance = new UnifiedInviteService();
    }
    return UnifiedInviteService.instance;
  }

  /**
   * Create a unified invite (handles both registered and unregistered users)
   */
  async createInvite(request: InviteCreationRequest): Promise<InviteResponse> {
    try {
      console.log('🚀 Creating unified invite:', request);

      // Validate input
      if (!request.recipientPhone && !request.recipientEmail) {
        throw new Error('Either phone number or email is required');
      }

      // For SMS invites, country code is required
      if (request.recipientPhone && !request.countryCode) {
        throw new Error('Country code is required for SMS invites');
      }

      // Normalize phone number if provided
      let normalizedPhone: string | null = null;
      if (request.recipientPhone) {
        try {
          normalizedPhone = PhoneNumberService.normalize(
            request.recipientPhone, 
            request.countryCode as any
          );
          console.log('📱 Normalized phone:', normalizedPhone);
        } catch (error) {
          throw new Error(`Invalid phone number: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Check if user exists in database
      const existingUser = await this.findUserByContact(
        normalizedPhone, 
        request.recipientEmail || null
      );

      if (existingUser) {
        // Flow 1: SMS Invite to REGISTERED USER
        return await this.createRegisteredUserInvite(
          request, 
          existingUser, 
          normalizedPhone
        );
      } else {
        // Flow 2: SMS Invite to UNREGISTERED USER
        return await this.createUnregisteredUserInvite(
          request, 
          normalizedPhone
        );
      }
    } catch (error) {
      console.error('❌ Create invite error:', error);
      return {
        success: false,
        isRegisteredUser: false,
        message: error instanceof Error ? error.message : 'Failed to create invite'
      };
    }
  }

  /**
   * Flow 1: Create invite for registered user
   */
  private async createRegisteredUserInvite(
    request: InviteCreationRequest,
    existingUser: User,
    normalizedPhone: string | null
  ): Promise<InviteResponse> {
    console.log('👤 Creating invite for registered user:', existingUser.id);

    // Check friendship status
    const friendshipStatus = await this.checkFriendshipStatus(
      request.inviterId,
      existingUser.email
    );

    if (friendshipStatus !== 'no_relationship') {
      return {
        success: false,
        isRegisteredUser: true,
        friendshipStatus: friendshipStatus as 'already_friends' | 'request_pending' | 'request_received' | 'no_relationship',
        message: this.getFriendshipStatusMessage(friendshipStatus, existingUser.fullName)
      };
    }

    // Create invite for registered user
    const inviteData: Omit<UnifiedInvite, 'id'> = {
      inviterId: request.inviterId,
      inviterData: await this.getInviterData(request.inviterId),
      recipientUserId: existingUser.id,
      recipientPhone: normalizedPhone || existingUser.mobile || existingUser.phoneNumber || '',
      recipientEmail: existingUser.email,
      status: 'PENDING',
      type: request.sentVia === 'SMS' ? 'SMS_REGISTERED_USER' : 'EMAIL_REGISTERED_USER',
      inviteToken: this.generateInviteToken(),
      sentVia: request.sentVia,
      message: request.message || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const inviteId = await this.saveInvite(inviteData);
    const invite = { ...inviteData, id: inviteId };

    // Send dual notifications for registered users
    await this.sendRegisteredUserNotifications(invite, existingUser);

    return {
      success: true,
      invite,
      isRegisteredUser: true,
      friendshipStatus: 'no_relationship',
      message: `Invite sent to ${existingUser.fullName}`
    };
  }

  /**
   * Flow 2: Create invite for unregistered user
   */
  private async createUnregisteredUserInvite(
    request: InviteCreationRequest,
    normalizedPhone: string | null
  ): Promise<InviteResponse> {
    console.log('📱 Creating invite for unregistered user');

    const inviteData: Omit<UnifiedInvite, 'id'> = {
      inviterId: request.inviterId,
      inviterData: await this.getInviterData(request.inviterId),
      recipientUserId: null,
      recipientPhone: normalizedPhone || '',
      recipientEmail: request.recipientEmail || null,
      status: 'SIGNUP_PENDING',
      type: request.sentVia === 'SMS' ? 'SMS_UNREGISTERED_USER' : 'EMAIL_UNREGISTERED_USER',
      inviteToken: this.generateSecureToken(),
      sentVia: request.sentVia,
      message: request.message || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const inviteId = await this.saveInvite(inviteData);
    const invite = { ...inviteData, id: inviteId };

    // Send signup invitation
    await this.sendUnregisteredUserInvitation(invite);

    return {
      success: true,
      invite,
      isRegisteredUser: false,
      message: `Signup invitation sent to ${normalizedPhone || request.recipientEmail}`
    };
  }

  /**
   * Check for pending invites during user registration
   */
  async checkPendingInvitesOnRegistration(
    newUserId: string, 
    phoneNumber: string, 
    email: string
  ): Promise<PendingInviteCheckResult> {
    try {
      console.log('🔍 Checking pending invites for new user:', { newUserId, phoneNumber, email });

      const normalizedPhone = PhoneNumberService.normalize(phoneNumber);
      
      // Find pending invites by phone and email
      const pendingInvites = await this.findPendingInvites(normalizedPhone, email);
      
      if (pendingInvites.length === 0) {
        return {
          hasPendingInvites: false,
          invites: [],
          autoAcceptedCount: 0,
          newFriendships: []
        };
      }

      console.log(`✅ Found ${pendingInvites.length} pending invites`);

      // Convert pending invites
      const results = await Promise.all(
        pendingInvites.map(invite => this.convertPendingInvite(invite, newUserId, email))
      );

      const autoAcceptedCount = results.filter(r => r.autoAccepted).length;
      const newFriendships = results
        .filter(r => r.autoAccepted)
        .map(r => r.invite.inviterId);

      return {
        hasPendingInvites: true,
        invites: results.map(r => r.invite),
        autoAcceptedCount,
        newFriendships
      };
    } catch (error) {
      console.error('❌ Check pending invites error:', error);
      return {
        hasPendingInvites: false,
        invites: [],
        autoAcceptedCount: 0,
        newFriendships: []
      };
    }
  }

  /**
   * Convert pending invite when user registers
   */
  private async convertPendingInvite(
    invite: UnifiedInvite,
    newUserId: string,
    email: string
  ): Promise<{ invite: UnifiedInvite; autoAccepted: boolean }> {
    console.log('🔄 Converting pending invite:', invite.id);

    const updatedInvite: UnifiedInvite = {
      ...invite,
      recipientUserId: newUserId,
      recipientEmail: email,
      status: 'ACCEPTED', // Auto-accept for better UX
      type: invite.sentVia === 'SMS' ? 'SMS_REGISTERED_USER' : 'EMAIL_REGISTERED_USER',
      updatedAt: new Date(),
      acceptedAt: new Date(),
      convertedFromPendingAt: new Date()
    };

    // Update invite in database
    await this.updateInvite(updatedInvite);

    // Create friendship
    await this.createFriendship(invite.inviterId, newUserId);

    // Send notifications
    await this.sendConversionNotifications(updatedInvite, newUserId);

    return {
      invite: updatedInvite,
      autoAccepted: true
    };
  }

  /**
   * Accept an invite
   */
  async acceptInvite(inviteId: string, userId: string): Promise<boolean> {
    try {
      const invite = await this.getInviteById(inviteId);
      if (!invite) {
        throw new Error('Invite not found');
      }

      if (invite.recipientUserId !== userId) {
        throw new Error('Unauthorized to accept this invite');
      }

      if (invite.status !== 'PENDING') {
        throw new Error('Invite is not in pending status');
      }

      // Update invite status
      const updatedInvite: UnifiedInvite = {
        ...invite,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        updatedAt: new Date()
      };

      await this.updateInvite(updatedInvite);

      // Create friendship
      await this.createFriendship(invite.inviterId, userId);

      // Send acceptance notification
      await this.sendAcceptanceNotification(updatedInvite);

      return true;
    } catch (error) {
      console.error('❌ Accept invite error:', error);
      return false;
    }
  }

  /**
   * Decline an invite
   */
  async declineInvite(inviteId: string, userId: string): Promise<boolean> {
    try {
      const invite = await this.getInviteById(inviteId);
      if (!invite || invite.recipientUserId !== userId) {
        return false;
      }

      const updatedInvite: UnifiedInvite = {
        ...invite,
        status: 'DECLINED',
        updatedAt: new Date()
      };

      await this.updateInvite(updatedInvite);
      return true;
    } catch (error) {
      console.error('❌ Decline invite error:', error);
      return false;
    }
  }

  // Helper methods
  private async findUserByContact(phone: string | null, email: string | null): Promise<User | null> {
    try {
      if (phone) {
        const userByPhone = await this.apiService.request('GET', `/users/search?phone=${encodeURIComponent(phone)}`);
        if (userByPhone && userByPhone.length > 0) {
          return userByPhone[0];
        }
      }

      if (email) {
        const userByEmail = await this.apiService.request('GET', `/users/search?email=${encodeURIComponent(email)}`);
        if (userByEmail && userByEmail.length > 0) {
          return userByEmail[0];
        }
      }

      return null;
    } catch (error) {
      console.error('Find user by contact error:', error);
      return null;
    }
  }

  private async checkFriendshipStatus(userId: string, recipientEmail: string): Promise<string> {
    try {
      const result = await this.apiService.checkExistingFriendship(userId, recipientEmail);
      return result.status || 'no_relationship';
    } catch (error) {
      console.error('Check friendship status error:', error);
      return 'no_relationship';
    }
  }

  private getFriendshipStatusMessage(status: string, name: string): string {
    switch (status) {
      case 'already_friends':
        return `You are already friends with ${name}`;
      case 'request_pending':
        return `Friend request already sent to ${name}`;
      case 'request_received':
        return `${name} already sent you a friend request`;
      default:
        return 'Unknown friendship status';
    }
  }

  private async getInviterData(inviterId: string) {
    try {
      const user = await this.apiService.getUserProfile(inviterId);
      return {
        fullName: user.fullName || 'Unknown User',
        email: user.email || '',
        profilePicture: user.profilePicture || user.profileImage || ''
      };
    } catch (error) {
      console.error('Get inviter data error:', error);
      return {
        fullName: 'Unknown User',
        email: '',
        profilePicture: ''
      };
    }
  }

  private generateInviteToken(): string {
    return `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSecureToken(): string {
    return `secure_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  private async saveInvite(inviteData: Omit<UnifiedInvite, 'id'>): Promise<string> {
    try {
      const result = await this.apiService.request('POST', '/invites', inviteData);
      return result.id;
    } catch (error) {
      console.error('Save invite error:', error);
      throw new Error('Failed to save invite');
    }
  }

  private async updateInvite(invite: UnifiedInvite): Promise<void> {
    try {
      await this.apiService.request('PUT', `/invites/${invite.id}`, invite);
    } catch (error) {
      console.error('Update invite error:', error);
      throw new Error('Failed to update invite');
    }
  }

  private async getInviteById(inviteId: string): Promise<UnifiedInvite | null> {
    try {
      return await this.apiService.request('GET', `/invites/${inviteId}`);
    } catch (error) {
      console.error('Get invite by ID error:', error);
      return null;
    }
  }

  private async findPendingInvites(phone: string, email: string): Promise<UnifiedInvite[]> {
    try {
      const result = await this.apiService.request('GET', `/invites/pending?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`);
      return result || [];
    } catch (error) {
      console.error('Find pending invites error:', error);
      return [];
    }
  }

  private async createFriendship(userId1: string, userId2: string): Promise<void> {
    try {
      await this.apiService.request('POST', '/friends/create', {
        userId1,
        userId2
      });
    } catch (error) {
      console.error('Create friendship error:', error);
      throw new Error('Failed to create friendship');
    }
  }

  private async sendRegisteredUserNotifications(invite: UnifiedInvite, user: User): Promise<void> {
    try {
      // Send push notification (primary)
      if (user.id) {
        await this.apiService.sendPushNotification(user.id, {
          title: 'New Friend Request! 👋',
          body: `${invite.inviterData.fullName} wants to connect with you`,
          data: {
            type: 'friend_request',
            inviteId: invite.id,
            deepLink: `spendy://invite/${invite.id}`
          }
        });
      }

      // Send SMS (fallback)
      if (invite.sentVia === 'SMS' && invite.recipientPhone) {
        // TODO: Implement SMS service call
        console.log('📱 Would send SMS to:', invite.recipientPhone);
      }
    } catch (error) {
      console.error('Send registered user notifications error:', error);
    }
  }

  private async sendUnregisteredUserInvitation(invite: UnifiedInvite): Promise<void> {
    try {
      if (invite.sentVia === 'SMS' && invite.recipientPhone) {
        // TODO: Implement SMS service call
        const message = `${invite.inviterData.fullName} invited you to Meet-n-Split! Join now: https://meetnsplit.com/signup?invite=${invite.inviteToken}`;
        console.log('📱 Would send SMS signup invitation:', message);
      }
    } catch (error) {
      console.error('Send unregistered user invitation error:', error);
    }
  }

  private async sendConversionNotifications(invite: UnifiedInvite, newUserId: string): Promise<void> {
    try {
      // Notify original inviter
      await this.apiService.sendPushNotification(invite.inviterId, {
        title: 'Great news! 🎉',
        body: `Your friend joined Meet-n-Split and you're now connected!`,
        data: {
          type: 'friend_joined',
          userId: newUserId
        }
      });

      // Welcome new user
      await this.apiService.sendPushNotification(newUserId, {
        title: 'Welcome to Meet-n-Split! 👋',
        body: `${invite.inviterData.fullName} is now your friend. Start splitting expenses!`,
        data: {
          type: 'welcome_with_friend',
          friendId: invite.inviterId
        }
      });
    } catch (error) {
      console.error('Send conversion notifications error:', error);
    }
  }

  private async sendAcceptanceNotification(invite: UnifiedInvite): Promise<void> {
    try {
      await this.apiService.sendPushNotification(invite.inviterId, {
        title: 'Friend Request Accepted! 🎉',
        body: `You're now friends and can start splitting expenses!`,
        data: {
          type: 'friend_accepted',
          userId: invite.recipientUserId
        }
      });
    } catch (error) {
      console.error('Send acceptance notification error:', error);
    }
  }
}
