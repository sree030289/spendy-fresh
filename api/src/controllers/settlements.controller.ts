// src/controllers/settlements.controller.ts
import { Request, Response } from 'express';
import { DatabaseService, COLLECTIONS } from '../config/database';
import { AppError, NotFoundError, ValidationError } from '../middleware/error';
import { AuthenticatedRequest } from '../middleware/auth';
import { User, Group } from '../types';

export class SettlementsController {
  /**
   * Record a settlement between two users
   * POST /api/settlements
   */
  static async recordSettlement(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { fromUserId, toUserId, amount, groupId, note } = req.body;
      const settledBy = req.user!.id;

      // Validate required fields
      if (!fromUserId || !toUserId || !amount || !groupId) {
        throw new ValidationError('From user, to user, amount, and group ID are required');
      }

      if (amount <= 0) {
        throw new ValidationError('Settlement amount must be greater than zero');
      }

      // Get group details
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;
      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if settler is a member of the group
      const isSettlerMember = group.members.some(member => member.userId === settledBy && member.isActive);
      if (!isSettlerMember) {
        throw new ValidationError('You are not a member of this group');
      }

      // Check if both users are members of the group
      const isFromUserMember = group.members.some(member => member.userId === fromUserId && member.isActive);
      const isToUserMember = group.members.some(member => member.userId === toUserId && member.isActive);

      if (!isFromUserMember || !isToUserMember) {
        throw new ValidationError('Both users must be members of the group');
      }

      // Get user data for the settlement record
      const fromUser = await DatabaseService.getDocument(COLLECTIONS.USERS, fromUserId) as User;
      const toUser = await DatabaseService.getDocument(COLLECTIONS.USERS, toUserId) as User;
      const settlerUser = await DatabaseService.getDocument(COLLECTIONS.USERS, settledBy) as User;

      if (!fromUser || !toUser || !settlerUser) {
        throw new NotFoundError('One or more users not found');
      }

      // Create settlement record
      const settlementData = {
        groupId,
        fromUserId,
        fromUserData: {
          fullName: fromUser.fullName,
          email: fromUser.email,
          avatar: fromUser.profileImage || fromUser.profilePicture
        },
        toUserId,
        toUserData: {
          fullName: toUser.fullName,
          email: toUser.email,
          avatar: toUser.profileImage || toUser.profilePicture
        },
        amount,
        currency: group.currency,
        description: note || `Settlement from ${fromUser.fullName} to ${toUser.fullName}`,
        settledBy,
        settledByUserData: {
          fullName: settlerUser.fullName,
          email: settlerUser.email,
          avatar: settlerUser.profileImage || settlerUser.profilePicture
        },
        settledAt: new Date(),
        status: 'completed'
      };

      const settlementId = await DatabaseService.createDocument(COLLECTIONS.SETTLEMENTS, settlementData);

      res.status(201).json({
        success: true,
        message: 'Debt settled successfully',
        data: {
          id: settlementId,
          ...settlementData
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get settlements for a group
   * GET /api/settlements/group/:groupId
   */
  static async getGroupSettlements(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      // Check if user is a member of the group
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;
      if (!group) {
        throw new NotFoundError('Group not found');
      }

      const isMember = group.members.some(member => member.userId === userId && member.isActive);
      if (!isMember) {
        throw new ValidationError('You are not a member of this group');
      }

      // Get settlements for the group
      const settlements = await DatabaseService.queryDocuments(
        COLLECTIONS.SETTLEMENTS,
        { groupId },
        { field: 'settledAt', direction: 'desc' }
      );

      res.json({
        success: true,
        message: 'Group settlements retrieved successfully',
        data: settlements
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get settlement history for a group
   * GET /api/settlements/history/:groupId
   */
  static async getSettlementHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const userId = req.user!.id;
      const { limit = 50, page = 1 } = req.query;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      // Check if user is a member of the group
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;
      if (!group) {
        throw new NotFoundError('Group not found');
      }

      const isMember = group.members.some(member => member.userId === userId && member.isActive);
      if (!isMember) {
        throw new ValidationError('You are not a member of this group');
      }

      // Get paginated settlement history
      const settlements = await DatabaseService.queryDocuments(
        COLLECTIONS.SETTLEMENTS,
        { groupId },
        { field: 'settledAt', direction: 'desc' },
        Number(limit)
      );

      res.json({
        success: true,
        message: 'Settlement history retrieved successfully',
        data: settlements
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's settlement statistics
   * GET /api/settlements/stats
   */
  static async getSettlementStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { groupId } = req.query;

      let query: any = {
        $or: [
          { fromUserId: userId },
          { toUserId: userId },
          { settledBy: userId }
        ]
      };

      if (groupId) {
        query.groupId = groupId;
      }

      const settlements = await DatabaseService.queryDocuments(COLLECTIONS.SETTLEMENTS, query);

      // Calculate statistics
      const stats = {
        totalSettlements: settlements.length,
        totalAmountSettled: settlements.reduce((sum: number, settlement: any) => sum + settlement.amount, 0),
        settlementsAsPayee: settlements.filter((s: any) => s.toUserId === userId).length,
        settlementsAsPayer: settlements.filter((s: any) => s.fromUserId === userId).length,
        settlementsInitiated: settlements.filter((s: any) => s.settledBy === userId).length
      };

      res.json({
        success: true,
        message: 'Settlement statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      throw error;
    }
  }
}
