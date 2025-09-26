import { Request, Response } from 'express';
import { DatabaseService } from '../config/database';
import { AppError, NotFoundError, ValidationError } from '../middleware/error';
import { AuthenticatedRequest } from '../middleware/auth';
import { SMSService } from '../services/sms.service';
import { PushNotificationService } from '../services/push-notification.service';
import { 
  User, 
  COLLECTIONS,
  FRIEND_STATUS
} from '../types';

// Unified Invite Types
interface UnifiedInvite {
  id: string;
  inviterId: string;
  inviterData: {
    fullName: string;
    email: string;
    profilePicture?: string;
  };
  recipientUserId: string | null;
  recipientPhone: string;
  recipientEmail: string | null;
  status: 'PENDING' | 'SIGNUP_PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  type: 'SMS_REGISTERED_USER' | 'SMS_UNREGISTERED_USER' | 'EMAIL_REGISTERED_USER' | 'EMAIL_UNREGISTERED_USER';
  inviteToken: string;
  sentVia: 'SMS' | 'EMAIL' | 'PUSH' | 'QR';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  convertedFromPendingAt?: Date;
}

export class UnifiedInviteController {
  /**
   * Create a unified invite
   * POST /api/invites/unified
   */
  static async createUnifiedInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { recipientPhone, recipientEmail, message, sentVia, autoAccept } = req.body;
      const inviterId = req.user!.id;

      // Validation
      if (!recipientPhone && !recipientEmail) {
        throw new ValidationError('Either phone number or email is required');
      }

      if (!sentVia || !['SMS', 'EMAIL', 'PUSH', 'QR'].includes(sentVia)) {
        throw new ValidationError('Valid sentVia method is required');
      }

      // Get inviter data
      const inviter = await DatabaseService.getDocument(COLLECTIONS.USERS, inviterId) as User;
      if (!inviter) {
        throw new NotFoundError('Inviter not found');
      }

      // Check if recipient user exists
      let existingUser: User | null = null;
      if (recipientPhone) {
        const phoneUsers = await DatabaseService.queryDocuments(
          COLLECTIONS.USERS,
          { phoneNumber: recipientPhone }
        );
        existingUser = phoneUsers.length > 0 ? phoneUsers[0] as User : null;
      }

      if (!existingUser && recipientEmail) {
        const emailUsers = await DatabaseService.queryDocuments(
          COLLECTIONS.USERS,
          { email: recipientEmail }
        );
        existingUser = emailUsers.length > 0 ? emailUsers[0] as User : null;
      }

      let invite: Omit<UnifiedInvite, 'id'>;
      let isRegisteredUser = false;

      if (existingUser) {
        // Flow 1: Registered user
        isRegisteredUser = true;

        // Check friendship status
        const existingFriendship = await DatabaseService.queryDocumentsWithOr(
          COLLECTIONS.FRIENDS,
          [
            { userId: inviterId, friendId: existingUser.id, status: FRIEND_STATUS.ACCEPTED },
            { userId: existingUser.id, friendId: inviterId, status: FRIEND_STATUS.ACCEPTED }
          ]
        );

        if (existingFriendship.length > 0) {
          res.status(400).json({
            success: false,
            message: `You are already friends with ${existingUser.fullName}`,
            isRegisteredUser: true,
            friendshipStatus: 'already_friends'
          });
          return;
        }

        // Check pending requests
        const existingRequest = await DatabaseService.queryDocumentsWithOr(
          COLLECTIONS.FRIEND_REQUESTS,
          [
            { senderId: inviterId, recipientId: existingUser.id, status: FRIEND_STATUS.PENDING },
            { senderId: existingUser.id, recipientId: inviterId, status: FRIEND_STATUS.PENDING }
          ]
        );

        if (existingRequest.length > 0) {
          res.status(400).json({
            success: false,
            message: `Friend request already pending with ${existingUser.fullName}`,
            isRegisteredUser: true,
            friendshipStatus: 'request_pending'
          });
          return;
        }

        invite = {
          inviterId,
          inviterData: {
            fullName: inviter.fullName,
            email: inviter.email,
            profilePicture: inviter.profilePicture || inviter.profileImage
          },
          recipientUserId: existingUser.id,
          recipientPhone: recipientPhone || existingUser.phoneNumber || existingUser.mobile || '',
          recipientEmail: existingUser.email,
          status: 'PENDING',
          type: sentVia === 'SMS' ? 'SMS_REGISTERED_USER' : 'EMAIL_REGISTERED_USER',
          inviteToken: UnifiedInviteController.generateInviteToken(),
          sentVia,
          message: message || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };
      } else {
        // Flow 2: Unregistered user
        invite = {
          inviterId,
          inviterData: {
            fullName: inviter.fullName,
            email: inviter.email,
            profilePicture: inviter.profilePicture || inviter.profileImage
          },
          recipientUserId: null,
          recipientPhone: recipientPhone || '',
          recipientEmail: recipientEmail || null,
          status: 'SIGNUP_PENDING',
          type: sentVia === 'SMS' ? 'SMS_UNREGISTERED_USER' : 'EMAIL_UNREGISTERED_USER',
          inviteToken: UnifiedInviteController.generateSecureToken(),
          sentVia,
          message: message || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };
      }

      // Save invite
      const inviteId = await DatabaseService.createDocument(COLLECTIONS.UNIFIED_INVITES, invite);
      const savedInvite = { ...invite, id: inviteId };

      // TODO: Send notifications (push for registered, SMS/email for unregistered)
      await UnifiedInviteController.sendInviteNotifications(savedInvite, existingUser);

      res.status(201).json({
        success: true,
        message: isRegisteredUser ? 
          `Invite sent to ${existingUser!.fullName}` : 
          `Signup invitation sent to ${recipientPhone || recipientEmail}`,
        invite: savedInvite,
        isRegisteredUser,
        friendshipStatus: 'no_relationship'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get invite by ID
   * GET /api/invites/unified/:inviteId
   */
  static async getUnifiedInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { inviteId } = req.params;
      const userId = req.user!.id;

      const invite = await DatabaseService.getDocument(COLLECTIONS.UNIFIED_INVITES, inviteId) as UnifiedInvite;
      if (!invite) {
        throw new NotFoundError('Invite not found');
      }

      // Check if user has permission to view this invite
      if (invite.inviterId !== userId && invite.recipientUserId !== userId) {
        throw new AppError('Unauthorized to view this invite', 403, 'UNAUTHORIZED');
      }

      res.json({
        success: true,
        message: 'Invite retrieved successfully',
        invite
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Accept a unified invite
   * POST /api/invites/unified/:inviteId/accept
   */
  static async acceptUnifiedInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { inviteId } = req.params;
      const userId = req.user!.id;

      const invite = await DatabaseService.getDocument(COLLECTIONS.UNIFIED_INVITES, inviteId) as UnifiedInvite;
      if (!invite) {
        throw new NotFoundError('Invite not found');
      }

      if (invite.recipientUserId !== userId) {
        throw new AppError('Unauthorized to accept this invite', 403, 'UNAUTHORIZED');
      }

      if (invite.status !== 'PENDING') {
        throw new ValidationError('Invite is not in pending status');
      }

      if (new Date() > invite.expiresAt) {
        throw new ValidationError('Invite has expired');
      }

      // Update invite status
      const updatedInvite: UnifiedInvite = {
        ...invite,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        updatedAt: new Date()
      };

      await DatabaseService.updateDocument(COLLECTIONS.UNIFIED_INVITES, inviteId, updatedInvite);

      // Create friendship
      await UnifiedInviteController.createFriendship(invite.inviterId, userId);

      // Send acceptance notification
      await UnifiedInviteController.sendAcceptanceNotification(updatedInvite);

      res.json({
        success: true,
        message: 'Invite accepted successfully',
        invite: updatedInvite
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Decline a unified invite
   * POST /api/invites/unified/:inviteId/decline
   */
  static async declineUnifiedInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { inviteId } = req.params;
      const userId = req.user!.id;

      const invite = await DatabaseService.getDocument(COLLECTIONS.UNIFIED_INVITES, inviteId) as UnifiedInvite;
      if (!invite) {
        throw new NotFoundError('Invite not found');
      }

      if (invite.recipientUserId !== userId) {
        throw new AppError('Unauthorized to decline this invite', 403, 'UNAUTHORIZED');
      }

      if (invite.status !== 'PENDING') {
        throw new ValidationError('Invite is not in pending status');
      }

      // Update invite status
      const updatedInvite: UnifiedInvite = {
        ...invite,
        status: 'DECLINED',
        updatedAt: new Date()
      };

      await DatabaseService.updateDocument(COLLECTIONS.UNIFIED_INVITES, inviteId, updatedInvite);

      res.json({
        success: true,
        message: 'Invite declined successfully',
        invite: updatedInvite
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find pending invites by phone and email
   * GET /api/invites/unified/pending?phone=...&email=...
   */
  static async findPendingInvites(req: Request, res: Response): Promise<void> {
    try {
      const { phone, email } = req.query;

      if (!phone && !email) {
        throw new ValidationError('Either phone or email parameter is required');
      }

      const queries: any[] = [];

      if (phone) {
        queries.push(
          { recipientPhone: phone, status: 'SIGNUP_PENDING' },
          { recipientPhone: phone, status: 'PENDING' }
        );
      }

      if (email) {
        queries.push(
          { recipientEmail: email, status: 'SIGNUP_PENDING' },
          { recipientEmail: email, status: 'PENDING' }
        );
      }

      const invites = await DatabaseService.queryDocumentsWithOr(
        COLLECTIONS.UNIFIED_INVITES,
        queries
      );

      res.json({
        success: true,
        message: 'Pending invites retrieved successfully',
        invites: invites.filter(invite => new Date() <= new Date(invite.expiresAt))
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check for pending invites during registration
   * POST /api/invites/unified/check-registration
   */
  static async checkRegistrationInvites(req: Request, res: Response): Promise<void> {
    try {
      const { userId, phoneNumber, email } = req.body;

      if (!userId || !phoneNumber || !email) {
        throw new ValidationError('userId, phoneNumber, and email are required');
      }

      // Find pending invites
      const pendingInvites = await DatabaseService.queryDocumentsWithOr(
        COLLECTIONS.UNIFIED_INVITES,
        [
          { recipientPhone: phoneNumber, status: 'SIGNUP_PENDING' },
          { recipientEmail: email, status: 'SIGNUP_PENDING' }
        ]
      );

      const validInvites = pendingInvites.filter(invite => 
        new Date() <= new Date(invite.expiresAt)
      );

      if (validInvites.length === 0) {
        res.json({
          success: true,
          message: 'No pending invites found',
          hasPendingInvites: false,
          invites: [],
          autoAcceptedCount: 0,
          newFriendships: []
        });
        return;
      }

      // Convert pending invites
      const results = await Promise.all(
        validInvites.map(invite => 
          UnifiedInviteController.convertPendingInvite(invite, userId, email)
        )
      );

      const autoAcceptedCount = results.filter(r => r.success).length;
      const newFriendships = results
        .filter(r => r.success)
        .map(r => r.invite.inviterId);

      // Send welcome notifications
      if (autoAcceptedCount > 0) {
        await UnifiedInviteController.sendRegistrationWelcomeNotifications(
          userId, 
          results.filter(r => r.success).map(r => r.invite)
        );
      }

      res.json({
        success: true,
        message: `Converted ${autoAcceptedCount} pending invites`,
        hasPendingInvites: true,
        invites: results.map(r => r.invite),
        autoAcceptedCount,
        newFriendships
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search users by contact (phone/email)
   * GET /api/users/search-contact?q=...
   */
  static async searchUsersByContact(req: Request, res: Response): Promise<void> {
    try {
      const { q: query } = req.query;

      if (!query || typeof query !== 'string') {
        throw new ValidationError('Search query is required');
      }

      const isPhone = query.includes('+') || /^\d/.test(query);
      const isEmail = query.includes('@');

      let users: any[] = [];

      if (isPhone) {
        users = await DatabaseService.queryDocuments(
          COLLECTIONS.USERS,
          { phoneNumber: query }
        );
      } else if (isEmail) {
        users = await DatabaseService.queryDocuments(
          COLLECTIONS.USERS,
          { email: query }
        );
      }

      // Remove sensitive data
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber || user.mobile,
        profilePicture: user.profilePicture || user.profileImage
      }));

      res.json({
        success: true,
        message: 'Users found',
        users: sanitizedUsers
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create friendship between two users
   * POST /api/friends/create-friendship
   */
  static async createFriendshipEndpoint(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId1, userId2 } = req.body;

      if (!userId1 || !userId2) {
        throw new ValidationError('Both userId1 and userId2 are required');
      }

      if (userId1 === userId2) {
        throw new ValidationError('Cannot create friendship with yourself');
      }

      // Check if friendship already exists
      const existingFriendship = await DatabaseService.queryDocumentsWithOr(
        COLLECTIONS.FRIENDS,
        [
          { userId: userId1, friendId: userId2 },
          { userId: userId2, friendId: userId1 }
        ]
      );

      if (existingFriendship.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Friendship already exists'
        });
        return;
      }

      await UnifiedInviteController.createFriendship(userId1, userId2);

      res.json({
        success: true,
        message: 'Friendship created successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  // Helper methods
  private static generateInviteToken(): string {
    return `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateSecureToken(): string {
    return `secure_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  private static async createFriendship(userId1: string, userId2: string): Promise<void> {
    // Create bidirectional friendship records
    const friendshipData1 = {
      userId: userId1,
      friendId: userId2,
      status: FRIEND_STATUS.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const friendshipData2 = {
      userId: userId2,
      friendId: userId1,
      status: FRIEND_STATUS.ACCEPTED,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await Promise.all([
      DatabaseService.createDocument(COLLECTIONS.FRIENDS, friendshipData1),
      DatabaseService.createDocument(COLLECTIONS.FRIENDS, friendshipData2)
    ]);
  }

  private static async convertPendingInvite(
    invite: UnifiedInvite, 
    newUserId: string, 
    email: string
  ): Promise<{ success: boolean; invite: UnifiedInvite }> {
    try {
      const updatedInvite: UnifiedInvite = {
        ...invite,
        recipientUserId: newUserId,
        recipientEmail: email,
        status: 'ACCEPTED',
        type: invite.sentVia === 'SMS' ? 'SMS_REGISTERED_USER' : 'EMAIL_REGISTERED_USER',
        updatedAt: new Date(),
        acceptedAt: new Date(),
        convertedFromPendingAt: new Date()
      };

      await DatabaseService.updateDocument(COLLECTIONS.UNIFIED_INVITES, invite.id, updatedInvite);
      await UnifiedInviteController.createFriendship(invite.inviterId, newUserId);

      return { success: true, invite: updatedInvite };
    } catch (error) {
      console.error('Convert pending invite error:', error);
      return { success: false, invite };
    }
  }

  private static async sendInviteNotifications(invite: UnifiedInvite, existingUser?: User | null): Promise<void> {
    try {
      if (existingUser) {
        // Send push notification to registered user
        if (existingUser.pushToken && invite.sentVia === 'PUSH') {
          await PushNotificationService.sendFriendInviteNotification({
            recipientToken: existingUser.pushToken,
            inviterName: invite.inviterData.fullName,
            inviterProfilePicture: invite.inviterData.profilePicture,
            inviteId: invite.id
          });
        }

        // Send SMS to registered user
        if (invite.sentVia === 'SMS') {
          await SMSService.sendRegisteredUserInvite({
            recipientPhone: invite.recipientPhone,
            inviterName: invite.inviterData.fullName,
            inviteId: invite.id
          });
        }
      } else {
        // Send SMS to unregistered user
        if (invite.sentVia === 'SMS') {
          await SMSService.sendUnregisteredUserInvite({
            recipientPhone: invite.recipientPhone,
            inviterName: invite.inviterData.fullName,
            inviteToken: invite.inviteToken
          });
        }
      }

      console.log('📧 Invite notifications sent:', {
        inviteId: invite.id,
        isRegistered: !!existingUser,
        sentVia: invite.sentVia
      });
    } catch (error) {
      console.error('Error sending invite notifications:', error);
      // Don't throw - notification failure shouldn't break invite creation
    }
  }

  private static async sendAcceptanceNotification(invite: UnifiedInvite): Promise<void> {
    try {
      // Get the inviter user to send them notification
      const inviter = await DatabaseService.getDocument(COLLECTIONS.USERS, invite.inviterId) as User;
      const recipient = await DatabaseService.getDocument(COLLECTIONS.USERS, invite.recipientUserId!) as User;
      
      if (!inviter || !recipient) return;

      // Send push notification if inviter has push token
      if (inviter.pushToken) {
        await PushNotificationService.sendAcceptedNotification({
          recipientToken: inviter.pushToken,
          accepterName: recipient.fullName,
          accepterProfilePicture: recipient.profilePicture || recipient.profileImage
        });
      }

      // Send SMS notification
      const inviterPhone = inviter.phoneNumber || inviter.mobile;
      if (inviterPhone) {
        await SMSService.sendAcceptedNotification({
          recipientPhone: inviterPhone,
          accepterName: recipient.fullName
        });
      }

      console.log('🎉 Acceptance notification sent for invite:', invite.id);
    } catch (error) {
      console.error('Error sending acceptance notification:', error);
    }
  }

  private static async sendRegistrationWelcomeNotifications(userId: string, invites: UnifiedInvite[]): Promise<void> {
    try {
      const newUser = await DatabaseService.getDocument(COLLECTIONS.USERS, userId) as User;
      if (!newUser) return;

      const friendNames = invites.map(invite => invite.inviterData.fullName);
      
      // Send push notification if user has push token
      if (newUser.pushToken) {
        await PushNotificationService.sendWelcomeNotification({
          recipientToken: newUser.pushToken,
          friendCount: invites.length,
          friendNames
        });
      }

      // Send SMS welcome notification
      const userPhone = newUser.phoneNumber || newUser.mobile;
      if (userPhone) {
        await SMSService.sendWelcomeNotification({
          recipientPhone: userPhone,
          friendCount: invites.length,
          friendNames
        });
      }

      console.log('🎉 Welcome notifications sent:', {
        userId,
        inviteCount: invites.length
      });
    } catch (error) {
      console.error('Error sending welcome notifications:', error);
    }
  }
}
