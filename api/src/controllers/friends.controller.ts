import { Request, Response } from 'express';
import { DatabaseService } from '../config/database';
import { AppError, NotFoundError, ValidationError } from '../middleware/error';
import { validateRequest } from '../middleware/validation';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  User, 
  Friend, 
  FriendRequest, 
  Group,
  Expense,
  COLLECTIONS,
  FRIEND_STATUS,
  GROUP_MEMBER_STATUS 
} from '../types';

export class FriendsController {
  /**
   * Send a friend request
   * POST /api/friends/request
   */
  static async sendFriendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { recipientEmail, recipientPhoneNumber, message } = req.body;
      const senderId = req.user!.id;

      // Validate input
      if (!recipientEmail && !recipientPhoneNumber) {
        throw new ValidationError('Either email or phone number is required');
      }

      // Find recipient user
      let recipients;
      if (recipientEmail) {
        recipients = await DatabaseService.queryDocuments(
          COLLECTIONS.USERS, 
          { email: recipientEmail }
        );
      } else {
        recipients = await DatabaseService.queryDocuments(
          COLLECTIONS.USERS, 
          { phoneNumber: recipientPhoneNumber }
        );
      }

      if (recipients.length === 0) {
        throw new NotFoundError('User not found');
      }

      const recipient = recipients[0] as User;

      // Check if users are already friends
      const existingFriendship = await DatabaseService.queryDocumentsWithOr(
        COLLECTIONS.FRIENDS,
        [
          { userId: senderId, friendId: recipient.id },
          { userId: recipient.id, friendId: senderId }
        ]
      );

      if (existingFriendship.length > 0) {
        throw new ValidationError('Users are already friends or have a pending request');
      }

      // Check if there's already a pending request
      const existingRequest = await DatabaseService.queryDocumentsWithOr(
        COLLECTIONS.FRIEND_REQUESTS,
        [
          { senderId, recipientId: recipient.id, status: FRIEND_STATUS.PENDING },
          { senderId: recipient.id, recipientId: senderId, status: FRIEND_STATUS.PENDING }
        ]
      );

      if (existingRequest.length > 0) {
        throw new ValidationError('Friend request already exists');
      }

      // Create friend request
      const friendRequest: Omit<FriendRequest, 'id'> = {
        senderId,
        recipientId: recipient.id,
        senderName: req.user!.fullName,
        recipientName: recipient.fullName,
        message: message || '',
        status: FRIEND_STATUS.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const requestId = await DatabaseService.createDocument(
        COLLECTIONS.FRIEND_REQUESTS,
        friendRequest
      );

      res.status(201).json({
        success: true,
        message: 'Friend request sent successfully',
        data: { requestId, recipientName: recipient.fullName }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Accept a friend request
   * POST /api/friends/accept/:requestId
   */
  static async acceptFriendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const userId = req.user!.id;

      if (!requestId) {
        throw new ValidationError('Request ID is required');
      }

      // Get friend request
      const request = await DatabaseService.getDocument(
        COLLECTIONS.FRIEND_REQUESTS,
        requestId
      ) as FriendRequest;

      if (!request) {
        throw new NotFoundError('Friend request not found');
      }

      if (request.recipientId !== userId) {
        throw new ValidationError('You can only accept requests sent to you');
      }

      if (request.status !== FRIEND_STATUS.PENDING) {
        throw new ValidationError('Request is no longer pending');
      }

      // Create friendship records
      const friendship1: Omit<Friend, 'id'> = {
        userId: request.senderId,
        friendId: request.recipientId,
        friendName: request.recipientName,
        status: FRIEND_STATUS.ACCEPTED,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const friendship2: Omit<Friend, 'id'> = {
        userId: request.recipientId,
        friendId: request.senderId,
        friendName: request.senderName,
        status: FRIEND_STATUS.ACCEPTED,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Update request status
      const updatedRequest = {
        ...request,
        status: FRIEND_STATUS.ACCEPTED,
        updatedAt: new Date()
      };

      // Perform batch operation
      await Promise.all([
        DatabaseService.createDocument(COLLECTIONS.FRIENDS, friendship1),
        DatabaseService.createDocument(COLLECTIONS.FRIENDS, friendship2),
        DatabaseService.updateDocument(COLLECTIONS.FRIEND_REQUESTS, requestId, updatedRequest)
      ]);

      res.json({
        success: true,
        message: 'Friend request accepted successfully',
        data: { friendName: request.senderName }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reject a friend request
   * POST /api/friends/reject/:requestId
   */
  static async rejectFriendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const userId = req.user!.id;

      if (!requestId) {
        throw new ValidationError('Request ID is required');
      }

      const request = await DatabaseService.getDocument(
        COLLECTIONS.FRIEND_REQUESTS,
        requestId
      ) as FriendRequest;

      if (!request) {
        throw new NotFoundError('Friend request not found');
      }

      if (request.recipientId !== userId) {
        throw new ValidationError('You can only reject requests sent to you');
      }

      if (request.status !== FRIEND_STATUS.PENDING) {
        throw new ValidationError('Request is no longer pending');
      }

      // Update request status
      await DatabaseService.updateDocument(
        COLLECTIONS.FRIEND_REQUESTS,
        requestId,
        {
          status: FRIEND_STATUS.REJECTED,
          updatedAt: new Date()
        }
      );

      res.json({
        success: true,
        message: 'Friend request rejected successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all friends for a user
   * GET /api/friends
   */
  static async getFriends(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const friendships = await DatabaseService.queryDocuments(
        COLLECTIONS.FRIENDS,
        { userId, status: FRIEND_STATUS.ACCEPTED }
      );

      // Enrich with friend user details
      const enrichedFriends = await Promise.all(
        friendships.map(async (friendship: any) => {
          try {
            const friendUser = await DatabaseService.getDocument(
              COLLECTIONS.USERS,
              friendship.friendId
            ) as User;

            return {
              ...friendship,
              friendData: friendUser ? {
                id: friendUser.id,
                fullName: friendUser.fullName,
                email: friendUser.email,
                mobile: friendUser.mobile || friendUser.phoneNumber,
                avatar: friendUser.profileImage || friendUser.profilePicture
              } : null
            };
          } catch (error) {
            console.error(`Error enriching friend ${friendship.friendId}:`, error);
            return friendship; // Return original friendship if enrichment fails
          }
        })
      );

      res.json({
        success: true,
        message: 'Friends retrieved successfully',
        data: enrichedFriends
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pending friend requests (sent and received)
   * GET /api/friends/requests
   */
  static async getFriendRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const [sentRequests, receivedRequests] = await Promise.all([
        DatabaseService.queryDocuments(
          COLLECTIONS.FRIEND_REQUESTS,
          { senderId: userId, status: FRIEND_STATUS.PENDING }
        ),
        DatabaseService.queryDocuments(
          COLLECTIONS.FRIEND_REQUESTS,
          { recipientId: userId, status: FRIEND_STATUS.PENDING }
        )
      ]);

      res.json({
        success: true,
        message: 'Friend requests retrieved successfully',
        data: {
          sent: sentRequests,
          received: receivedRequests
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove a friend
   * DELETE /api/friends/:friendId
   */
  static async removeFriend(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { friendId } = req.params;
      const userId = req.user!.id;

      if (!friendId) {
        throw new ValidationError('Friend ID is required');
      }

      // Find friendship records
      const friendships = await DatabaseService.queryDocumentsWithOr(
        COLLECTIONS.FRIENDS,
        [
          { userId, friendId },
          { userId: friendId, friendId: userId }
        ]
      );

      if (friendships.length === 0) {
        throw new NotFoundError('Friendship not found');
      }

      // Check for shared groups or pending expenses
      const sharedGroups = await DatabaseService.queryDocuments(
        COLLECTIONS.GROUPS,
        { 'members.userId': { $in: [userId, friendId] }, status: 'active' }
      );

      if (sharedGroups.length > 0) {
        throw new ValidationError('Cannot remove friend while you have shared groups. Please settle all expenses first.');
      }

      // Remove friendship records
      const deletePromises = friendships.map((friendship: any) =>
        DatabaseService.deleteDocument(COLLECTIONS.FRIENDS, friendship.id)
      );

      await Promise.all(deletePromises);

      res.json({
        success: true,
        message: 'Friend removed successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search for users to add as friends
   * GET /api/friends/search?query=email_or_phone
   */
  static async searchUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query } = req.query;
      const userId = req.user!.id;

      if (!query || typeof query !== 'string') {
        throw new ValidationError('Search query is required');
      }

      // Search by email or phone
      const [emailResults, phoneResults] = await Promise.all([
        DatabaseService.queryDocuments(
          COLLECTIONS.USERS,
          { email: { $regex: query } }
        ),
        DatabaseService.queryDocuments(
          COLLECTIONS.USERS,
          { phoneNumber: { $regex: query } }
        )
      ]);

      const users = [...emailResults, ...phoneResults]
        .filter((user: any, index: number, arr: any[]) => 
          arr.findIndex((u: any) => u.id === user.id) === index
        )
        .filter((user: any) => user.id !== userId);

      // Filter out already connected users
      const existingConnections = await DatabaseService.queryDocuments(
        COLLECTIONS.FRIENDS,
        { userId }
      );

      const connectedIds = existingConnections.map((f: any) => f.friendId);
      
      const pendingRequests = await DatabaseService.queryDocumentsWithOr(
        COLLECTIONS.FRIEND_REQUESTS,
        [
          { senderId: userId, status: FRIEND_STATUS.PENDING },
          { recipientId: userId, status: FRIEND_STATUS.PENDING }
        ]
      );

      const pendingIds = pendingRequests.flatMap((r: any) => [r.senderId, r.recipientId]);
      const excludeIds = [...connectedIds, ...pendingIds, userId];

      const availableUsers = users
        .filter((user: any) => !excludeIds.includes(user.id))
        .map((user: any) => ({
          id: user.id,
          name: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber || user.mobile,
          profileImage: user.profileImage || user.profilePicture
        }));

      res.json({
        success: true,
        message: 'Users found successfully',
        data: availableUsers
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get friend profile details
   * GET /api/friends/:friendId/profile
   */
  static async getFriendProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { friendId } = req.params;
      const userId = req.user!.id;

      if (!friendId) {
        throw new ValidationError('Friend ID is required');
      }

      // Verify friendship exists
      const friendship = await DatabaseService.queryDocuments(
        COLLECTIONS.FRIENDS,
        { userId, friendId, status: FRIEND_STATUS.ACCEPTED }
      );

      if (friendship.length === 0) {
        throw new NotFoundError('Friend not found');
      }

      // Get friend details
      const friend = await DatabaseService.getDocument(
        COLLECTIONS.USERS,
        friendId
      ) as User;

      if (!friend) {
        throw new NotFoundError('User not found');
      }

      // Get shared groups
      const sharedGroups = await DatabaseService.queryDocuments(
        COLLECTIONS.GROUPS,
        { 'members.userId': { $in: [userId, friendId] }, status: 'active' }
      );

      // Calculate balance between users
      const expenseQueries = await Promise.all([
        DatabaseService.queryDocuments(
          COLLECTIONS.EXPENSES,
          { payerId: userId, 'participants.userId': friendId, status: 'active' }
        ),
        DatabaseService.queryDocuments(
          COLLECTIONS.EXPENSES,
          { payerId: friendId, 'participants.userId': userId, status: 'active' }
        )
      ]);

      const expenses = [...expenseQueries[0], ...expenseQueries[1]];

      let balance = 0;
      expenses.forEach((expense: any) => {
        if (expense.payerId === userId) {
          const participant = expense.participants.find((p: any) => p.userId === friendId);
          if (participant) {
            balance += participant.amount;
          }
        } else {
          const participant = expense.participants.find((p: any) => p.userId === userId);
          if (participant) {
            balance -= participant.amount;
          }
        }
      });

      res.json({
        success: true,
        message: 'Friend profile retrieved successfully',
        data: {
          id: friend.id,
          name: friend.fullName,
          email: friend.email,
          profileImage: friend.profileImage || friend.profilePicture,
          joinedAt: friend.createdAt,
          sharedGroups: sharedGroups.length,
          balance,
          friendshipDate: friendship[0].createdAt
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get friendship statistics
   * GET /api/friends/stats
   */
  static async getFriendStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const [friends, sentRequests, receivedRequests] = await Promise.all([
        DatabaseService.queryDocuments(
          COLLECTIONS.FRIENDS,
          { userId, status: FRIEND_STATUS.ACCEPTED }
        ),
        DatabaseService.queryDocuments(
          COLLECTIONS.FRIEND_REQUESTS,
          { senderId: userId, status: FRIEND_STATUS.PENDING }
        ),
        DatabaseService.queryDocuments(
          COLLECTIONS.FRIEND_REQUESTS,
          { recipientId: userId, status: FRIEND_STATUS.PENDING }
        )
      ]);

      res.json({
        success: true,
        message: 'Friend statistics retrieved successfully',
        data: {
          totalFriends: friends.length,
          pendingSent: sentRequests.length,
          pendingReceived: receivedRequests.length
        }
      });
    } catch (error) {
      throw error;
    }
  }
}
