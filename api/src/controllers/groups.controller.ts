import { Request, Response } from 'express';
import { DatabaseService } from '../config/database';
import { AppError, NotFoundError, ValidationError } from '../middleware/error';
import { validateRequest } from '../middleware/validation';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  User, 
  Group, 
  GroupMember,
  Friend,
  Expense,
  COLLECTIONS,
  FRIEND_STATUS,
  GROUP_MEMBER_STATUS 
} from '../types';

export class GroupsController {
  /**
   * Create a new group
   * POST /api/groups
   */
  static async createGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, description, avatar, currency, settings, initialMembers } = req.body;
      const createdBy = req.user!.id;

      // Validate required fields
      if (!name) {
        throw new ValidationError('Group name is required');
      }

      // Generate invite code
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Create group
      const groupData: Omit<Group, 'id'> = {
        name,
        description: description || '',
        avatar: avatar || '',
        createdBy,
        members: [{
          userId: createdBy,
          userData: {
            fullName: req.user!.fullName,
            email: req.user!.email,
            avatar: req.user!.profileImage || req.user!.profilePicture
          },
          role: 'admin',
          balance: 0,
          joinedAt: new Date(),
          isActive: true
        }],
        totalExpenses: 0,
        currency: currency || req.user!.currency || 'AUD',
        isActive: true,
        inviteCode,
        settings: {
          allowMemberInvites: settings?.allowMemberInvites ?? true,
          requireApproval: settings?.requireApproval ?? false,
          currency: currency || req.user!.currency || 'AUD',
          approvalThreshold: settings?.approvalThreshold
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const groupId = await DatabaseService.createDocument(COLLECTIONS.GROUPS, groupData);

      // Add initial members if provided
      if (initialMembers && initialMembers.length > 0) {
        const memberPromises = initialMembers.map(async (memberId: string) => {
          // Verify member is a friend
          const friendship = await DatabaseService.queryDocuments(
            COLLECTIONS.FRIENDS,
            { userId: createdBy, friendId: memberId, status: FRIEND_STATUS.ACCEPTED }
          );

          if (friendship.length === 0) {
            throw new ValidationError(`User ${memberId} is not your friend`);
          }

          // Get member data
          const member = await DatabaseService.getDocument(COLLECTIONS.USERS, memberId) as User;
          if (!member) {
            throw new NotFoundError(`User ${memberId} not found`);
          }

          return {
            userId: memberId,
            userData: {
              fullName: member.fullName,
              email: member.email,
              avatar: member.profileImage || member.profilePicture
            },
            role: 'member' as const,
            balance: 0,
            joinedAt: new Date(),
            isActive: true
          };
        });

        const newMembers = await Promise.all(memberPromises);
        
        // Update group with new members
        const updatedGroup = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;
        updatedGroup.members = [...updatedGroup.members, ...newMembers];
        
        await DatabaseService.updateDocument(COLLECTIONS.GROUPS, groupId, {
          members: updatedGroup.members
        });
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId);

      res.status(201).json({
        success: true,
        message: 'Group created successfully',
        data: group
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's groups
   * GET /api/groups
   */
  static async getUserGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // Get all groups where user is a member
      const groups = await DatabaseService.queryDocuments(
        COLLECTIONS.GROUPS,
        { 'members.userId': userId, isActive: true }
      );

      res.json({
        success: true,
        message: 'Groups retrieved successfully',
        data: groups
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get group details
   * GET /api/groups/:groupId
   */
  static async getGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if user is a member
      const isMember = group.members.some(member => member.userId === userId && member.isActive);
      if (!isMember) {
        throw new ValidationError('You are not a member of this group');
      }

      // Get recent expenses
      const recentExpenses = await DatabaseService.queryDocuments(
        COLLECTIONS.EXPENSES,
        { groupId },
        { field: 'createdAt', direction: 'desc' },
        10
      );

      res.json({
        success: true,
        message: 'Group details retrieved successfully',
        data: {
          ...group,
          recentExpenses
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update group details
   * PUT /api/groups/:groupId
   */
  static async updateGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const { name, description, avatar, settings } = req.body;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if user is admin
      const userMember = group.members.find(member => member.userId === userId);
      if (!userMember || userMember.role !== 'admin') {
        throw new ValidationError('Only group admins can update group details');
      }

      const updateData: Partial<Group> = {
        updatedAt: new Date()
      };

      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (avatar !== undefined) updateData.avatar = avatar;
      if (settings) {
        updateData.settings = {
          ...group.settings,
          ...settings
        };
      }

      await DatabaseService.updateDocument(COLLECTIONS.GROUPS, groupId, updateData);

      const updatedGroup = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId);

      res.json({
        success: true,
        message: 'Group updated successfully',
        data: updatedGroup
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add member to group
   * POST /api/groups/:groupId/members
   */
  static async addMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const { userId: newMemberId, email, phoneNumber } = req.body;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      if (!newMemberId && !email && !phoneNumber) {
        throw new ValidationError('User ID, email, or phone number is required');
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if current user can add members
      const currentUserMember = group.members.find(member => member.userId === userId);
      if (!currentUserMember || (!group.settings.allowMemberInvites && currentUserMember.role !== 'admin')) {
        throw new ValidationError('You do not have permission to add members');
      }

      // Find the user to add
      let newMember: User;
      if (newMemberId) {
        newMember = await DatabaseService.getDocument(COLLECTIONS.USERS, newMemberId) as User;
      } else if (email) {
        const users = await DatabaseService.queryDocuments(COLLECTIONS.USERS, { email });
        if (users.length === 0) {
          throw new NotFoundError('User not found with this email');
        }
        newMember = users[0] as User;
      } else {
        const users = await DatabaseService.queryDocuments(COLLECTIONS.USERS, { phoneNumber });
        if (users.length === 0) {
          throw new NotFoundError('User not found with this phone number');
        }
        newMember = users[0] as User;
      }

      if (!newMember) {
        throw new NotFoundError('User not found');
      }

      // Check if user is already a member
      const existingMember = group.members.find(member => member.userId === newMember.id);
      if (existingMember) {
        if (existingMember.isActive) {
          throw new ValidationError('User is already a member of this group');
        } else {
          // Reactivate member
          existingMember.isActive = true;
          existingMember.joinedAt = new Date();
        }
      } else {
        // Check if users are friends
        const friendship = await DatabaseService.queryDocumentsWithOr(
          COLLECTIONS.FRIENDS,
          [
            { userId, friendId: newMember.id, status: FRIEND_STATUS.ACCEPTED },
            { userId: newMember.id, friendId: userId, status: FRIEND_STATUS.ACCEPTED }
          ]
        );

        if (friendship.length === 0) {
          throw new ValidationError('You can only add friends to groups');
        }

        // Add new member
        const newGroupMember: GroupMember = {
          userId: newMember.id,
          userData: {
            fullName: newMember.fullName,
            email: newMember.email,
            avatar: newMember.profileImage || newMember.profilePicture
          },
          role: 'member',
          balance: 0,
          joinedAt: new Date(),
          isActive: true
        };

        group.members.push(newGroupMember);
      }

      await DatabaseService.updateDocument(COLLECTIONS.GROUPS, groupId, {
        members: group.members,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Member added successfully',
        data: { memberName: newMember.fullName }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove member from group
   * DELETE /api/groups/:groupId/members/:memberId
   */
  static async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId, memberId } = req.params;
      const userId = req.user!.id;

      if (!groupId || !memberId) {
        throw new ValidationError('Group ID and Member ID are required');
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check permissions
      const currentUserMember = group.members.find(member => member.userId === userId);
      const targetMember = group.members.find(member => member.userId === memberId);

      if (!currentUserMember || !targetMember) {
        throw new NotFoundError('Member not found');
      }

      // Users can remove themselves, admins can remove anyone except other admins
      if (userId !== memberId && (currentUserMember.role !== 'admin' || targetMember.role === 'admin')) {
        throw new ValidationError('You do not have permission to remove this member');
      }

      // Check if member has pending balances
      if (targetMember.balance && Math.abs(targetMember.balance) > 0.01) {
        throw new ValidationError('Cannot remove member with pending balances. Please settle all expenses first.');
      }

      // Remove or deactivate member
      if (userId === memberId) {
        // User is leaving the group
        targetMember.isActive = false;
      } else {
        // Admin is removing member
        const memberIndex = group.members.findIndex(member => member.userId === memberId);
        group.members.splice(memberIndex, 1);
      }

      await DatabaseService.updateDocument(COLLECTIONS.GROUPS, groupId, {
        members: group.members,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: userId === memberId ? 'Left group successfully' : 'Member removed successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Join group by invite code
   * POST /api/groups/join
   */
  static async joinGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { inviteCode } = req.body;
      const userId = req.user!.id;

      if (!inviteCode) {
        throw new ValidationError('Invite code is required');
      }

      const groups = await DatabaseService.queryDocuments(
        COLLECTIONS.GROUPS,
        { inviteCode: inviteCode.toUpperCase(), isActive: true }
      );

      if (groups.length === 0) {
        throw new NotFoundError('Invalid invite code');
      }

      const group = groups[0] as Group;

      // Check if user is already a member
      const existingMember = group.members.find(member => member.userId === userId);
      if (existingMember && existingMember.isActive) {
        throw new ValidationError('You are already a member of this group');
      }

      const newMember: GroupMember = {
        userId,
        userData: {
          fullName: req.user!.fullName,
          email: req.user!.email,
          avatar: req.user!.profileImage || req.user!.profilePicture
        },
        role: 'member',
        balance: 0,
        joinedAt: new Date(),
        isActive: true
      };

      if (existingMember) {
        // Reactivate existing member
        existingMember.isActive = true;
        existingMember.joinedAt = new Date();
      } else {
        group.members.push(newMember);
      }

      await DatabaseService.updateDocument(COLLECTIONS.GROUPS, group.id, {
        members: group.members,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Joined group successfully',
        data: { groupName: group.name, groupId: group.id }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get group expenses
   * GET /api/groups/:groupId/expenses
   */
  static async getGroupExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if user is a member
      const isMember = group.members.some(member => member.userId === userId && member.isActive);
      if (!isMember) {
        throw new ValidationError('You are not a member of this group');
      }

      const expenses = await DatabaseService.queryDocuments(
        COLLECTIONS.EXPENSES,
        { groupId },
        { field: 'createdAt', direction: 'desc' },
        Number(limit)
      );

      res.json({
        success: true,
        message: 'Group expenses retrieved successfully',
        data: expenses
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get group balances
   * GET /api/groups/:groupId/balances
   */
  static async getGroupBalances(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if user is a member
      const isMember = group.members.some(member => member.userId === userId && member.isActive);
      if (!isMember) {
        throw new ValidationError('You are not a member of this group');
      }

      // Calculate balances from expenses
      const expenses = await DatabaseService.queryDocuments(
        COLLECTIONS.EXPENSES,
        { groupId, isSettled: false }
      );

      const balances: { [userId: string]: number } = {};
      
      // Initialize balances for all members
      group.members.forEach(member => {
        if (member.isActive) {
          balances[member.userId] = 0;
        }
      });

      // Calculate balances from expenses
      expenses.forEach((expense: any) => {
        const totalAmount = expense.amount;
        const payerId = expense.paidBy;

        // Add full amount to payer
        balances[payerId] = (balances[payerId] || 0) + totalAmount;

        // Subtract each participant's share
        expense.splits.forEach((split: any) => {
          balances[split.userId] = (balances[split.userId] || 0) - split.amount;
        });
      });

      // Format response with member details
      const memberBalances = group.members
        .filter(member => member.isActive)
        .map(member => ({
          userId: member.userId,
          userData: member.userData,
          balance: balances[member.userId] || 0
        }));

      res.json({
        success: true,
        message: 'Group balances retrieved successfully',
        data: memberBalances
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete group (admin only)
   * DELETE /api/groups/:groupId
   */
  static async deleteGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if user is the creator
      if (group.createdBy !== userId) {
        throw new ValidationError('Only the group creator can delete the group');
      }

      // Check if there are unsettled expenses
      const unsettledExpenses = await DatabaseService.queryDocuments(
        COLLECTIONS.EXPENSES,
        { groupId, isSettled: false }
      );

      if (unsettledExpenses.length > 0) {
        throw new ValidationError('Cannot delete group with unsettled expenses. Please settle all expenses first.');
      }

      // Soft delete the group
      await DatabaseService.updateDocument(COLLECTIONS.GROUPS, groupId, {
        isActive: false,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Group deleted successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate new invite code
   * POST /api/groups/:groupId/invite-code
   */
  static async generateInviteCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if user is admin
      const userMember = group.members.find(member => member.userId === userId);
      if (!userMember || userMember.role !== 'admin') {
        throw new ValidationError('Only group admins can generate invite codes');
      }

      const newInviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      await DatabaseService.updateDocument(COLLECTIONS.GROUPS, groupId, {
        inviteCode: newInviteCode,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'New invite code generated successfully',
        data: { inviteCode: newInviteCode }
      });
    } catch (error) {
      throw error;
    }
  }
}
