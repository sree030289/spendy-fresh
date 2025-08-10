import { Request, Response } from 'express';
import { DatabaseService } from '../config/database';
import { AppError, NotFoundError, ValidationError } from '../middleware/error';
import { validateRequest } from '../middleware/validation';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  User, 
  Group, 
  Expense,
  ExpenseSplit,
  COLLECTIONS,
  FRIEND_STATUS 
} from '../types';

export class ExpensesController {
  /**
   * Create a new expense
   * POST /api/expenses
   */
  static async createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        groupId,
        description,
        amount,
        currency,
        category,
        categoryIcon,
        splitType,
        splits,
        date,
        receiptUrl,
        notes
      } = req.body;
      const paidBy = req.user!.id;

      // Validate required fields
      if (!groupId || !description || !amount || !splits || splits.length === 0) {
        throw new ValidationError('Group ID, description, amount, and splits are required');
      }

      if (amount <= 0) {
        throw new ValidationError('Amount must be greater than 0');
      }

      // Get group and verify membership
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId) as Group;
      if (!group) {
        throw new NotFoundError('Group not found');
      }

      const payerMember = group.members.find(member => member.userId === paidBy && member.isActive);
      if (!payerMember) {
        throw new ValidationError('You are not a member of this group');
      }

      // Validate splits
      const totalSplitAmount = splits.reduce((sum: number, split: any) => sum + split.amount, 0);
      if (Math.abs(totalSplitAmount - amount) > 0.01) {
        throw new ValidationError('Split amounts must equal the total expense amount');
      }

      // Verify all split users are group members
      const memberIds = group.members.filter(m => m.isActive).map(m => m.userId);
      for (const split of splits) {
        if (!memberIds.includes(split.userId)) {
          throw new ValidationError(`User ${split.userId} is not a member of this group`);
        }
      }

      // Get user data for splits
      const splitUserIds = splits.map((split: any) => split.userId);
      const splitUsers = await Promise.all(
        splitUserIds.map(async (userId: string) => {
          const user = await DatabaseService.getDocument(COLLECTIONS.USERS, userId) as User;
          return user;
        })
      );

      // Build expense splits with user data
      const expenseSplits: ExpenseSplit[] = splits.map((split: any) => {
        const user = splitUsers.find(u => u.id === split.userId);
        if (!user) {
          throw new NotFoundError(`User ${split.userId} not found`);
        }

        return {
          userId: split.userId,
          userData: {
            fullName: user.fullName,
            email: user.email,
            avatar: user.profileImage || user.profilePicture
          },
          amount: split.amount,
          percentage: splitType === 'percentage' ? split.percentage : undefined,
          isPaid: split.userId === paidBy, // Payer is automatically marked as paid
          paidAt: split.userId === paidBy ? new Date() : undefined
        };
      });

      // Get payer data
      const payer = await DatabaseService.getDocument(COLLECTIONS.USERS, paidBy) as User;

      // Create expense
      const expenseData: Omit<Expense, 'id'> = {
        groupId,
        description,
        amount,
        currency: currency || group.currency,
        category: category || 'general',
        categoryIcon: categoryIcon || '💳',
        paidBy,
        paidByData: {
          fullName: payer.fullName,
          email: payer.email,
          avatar: payer.profileImage || payer.profilePicture
        },
        splitType: splitType || 'equal',
        splits: expenseSplits,
        date: date ? new Date(date) : new Date(),
        receiptUrl,
        notes,
        isSettled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const expenseId = await DatabaseService.createDocument(COLLECTIONS.EXPENSES, expenseData);

      // Update group total expenses
      await DatabaseService.updateDocument(COLLECTIONS.GROUPS, groupId, {
        totalExpenses: group.totalExpenses + amount,
        updatedAt: new Date()
      });

      const expense = await DatabaseService.getDocument(COLLECTIONS.EXPENSES, expenseId);

      res.status(201).json({
        success: true,
        message: 'Expense created successfully',
        data: expense
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get expenses for a group
   * GET /api/expenses?groupId=xxx
   */
  static async getExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId, page = 1, limit = 20, category, settled } = req.query;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      // Verify user is member of group
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId as string) as Group;
      if (!group) {
        throw new NotFoundError('Group not found');
      }

      const isMember = group.members.some(member => member.userId === userId && member.isActive);
      if (!isMember) {
        throw new ValidationError('You are not a member of this group');
      }

      // Build query filters
      const filters: Record<string, any> = { groupId };
      if (category) filters.category = category;
      if (settled !== undefined) filters.isSettled = settled === 'true';

      const expenses = await DatabaseService.queryDocuments(
        COLLECTIONS.EXPENSES,
        filters,
        { field: 'date', direction: 'desc' },
        Number(limit)
      );

      res.json({
        success: true,
        message: 'Expenses retrieved successfully',
        data: expenses
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get expense details
   * GET /api/expenses/:expenseId
   */
  static async getExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { expenseId } = req.params;
      const userId = req.user!.id;

      if (!expenseId) {
        throw new ValidationError('Expense ID is required');
      }

      const expense = await DatabaseService.getDocument(COLLECTIONS.EXPENSES, expenseId) as Expense;
      if (!expense) {
        throw new NotFoundError('Expense not found');
      }

      // Verify user has access to this expense
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, expense.groupId) as Group;
      if (!group) {
        throw new NotFoundError('Group not found');
      }

      const isMember = group.members.some(member => member.userId === userId && member.isActive);
      if (!isMember) {
        throw new ValidationError('You do not have access to this expense');
      }

      res.json({
        success: true,
        message: 'Expense details retrieved successfully',
        data: expense
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an expense
   * PUT /api/expenses/:expenseId
   */
  static async updateExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { expenseId } = req.params;
      const {
        description,
        amount,
        currency,
        category,
        categoryIcon,
        splitType,
        splits,
        date,
        receiptUrl,
        notes
      } = req.body;
      const userId = req.user!.id;

      if (!expenseId) {
        throw new ValidationError('Expense ID is required');
      }

      const expense = await DatabaseService.getDocument(COLLECTIONS.EXPENSES, expenseId) as Expense;
      if (!expense) {
        throw new NotFoundError('Expense not found');
      }

      // Only the person who paid can edit the expense
      if (expense.paidBy !== userId) {
        throw new ValidationError('Only the person who paid can edit this expense');
      }

      if (expense.isSettled) {
        throw new ValidationError('Cannot edit a settled expense');
      }

      // Get group for validation
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, expense.groupId) as Group;
      if (!group) {
        throw new NotFoundError('Group not found');
      }

      const updateData: Partial<Expense> = {
        updatedAt: new Date()
      };

      if (description) updateData.description = description;
      if (currency) updateData.currency = currency;
      if (category) updateData.category = category;
      if (categoryIcon) updateData.categoryIcon = categoryIcon;
      if (date) updateData.date = new Date(date);
      if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;
      if (notes !== undefined) updateData.notes = notes;

      // Handle amount and splits update
      if (amount && splits) {
        if (amount <= 0) {
          throw new ValidationError('Amount must be greater than 0');
        }

        const totalSplitAmount = splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        if (Math.abs(totalSplitAmount - amount) > 0.01) {
          throw new ValidationError('Split amounts must equal the total expense amount');
        }

        // Get user data for new splits
        const splitUserIds = splits.map((split: any) => split.userId);
        const splitUsers = await Promise.all(
          splitUserIds.map(async (userId: string) => {
            const user = await DatabaseService.getDocument(COLLECTIONS.USERS, userId) as User;
            return user;
          })
        );

        const newSplits: ExpenseSplit[] = splits.map((split: any) => {
          const user = splitUsers.find(u => u.id === split.userId);
          if (!user) {
            throw new NotFoundError(`User ${split.userId} not found`);
          }

          // Preserve payment status from original splits if user exists
          const originalSplit = expense.splits.find(s => s.userId === split.userId);

          return {
            userId: split.userId,
            userData: {
              fullName: user.fullName,
              email: user.email,
              avatar: user.profileImage || user.profilePicture
            },
            amount: split.amount,
            percentage: splitType === 'percentage' ? split.percentage : undefined,
            isPaid: originalSplit ? originalSplit.isPaid : split.userId === expense.paidBy,
            paidAt: originalSplit?.paidAt
          };
        });

        updateData.amount = amount;
        updateData.splits = newSplits;
        updateData.splitType = splitType || expense.splitType;

        // Update group total if amount changed
        if (amount !== expense.amount) {
          const difference = amount - expense.amount;
          await DatabaseService.updateDocument(COLLECTIONS.GROUPS, expense.groupId, {
            totalExpenses: group.totalExpenses + difference,
            updatedAt: new Date()
          });
        }
      }

      await DatabaseService.updateDocument(COLLECTIONS.EXPENSES, expenseId, updateData);

      const updatedExpense = await DatabaseService.getDocument(COLLECTIONS.EXPENSES, expenseId);

      res.json({
        success: true,
        message: 'Expense updated successfully',
        data: updatedExpense
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete an expense
   * DELETE /api/expenses/:expenseId
   */
  static async deleteExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { expenseId } = req.params;
      const userId = req.user!.id;

      if (!expenseId) {
        throw new ValidationError('Expense ID is required');
      }

      const expense = await DatabaseService.getDocument(COLLECTIONS.EXPENSES, expenseId) as Expense;
      if (!expense) {
        throw new NotFoundError('Expense not found');
      }

      // Only the person who paid can delete the expense
      if (expense.paidBy !== userId) {
        throw new ValidationError('Only the person who paid can delete this expense');
      }

      if (expense.isSettled) {
        throw new ValidationError('Cannot delete a settled expense');
      }

      // Update group total expenses
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, expense.groupId) as Group;
      if (group) {
        await DatabaseService.updateDocument(COLLECTIONS.GROUPS, expense.groupId, {
          totalExpenses: Math.max(0, group.totalExpenses - expense.amount),
          updatedAt: new Date()
        });
      }

      await DatabaseService.deleteDocument(COLLECTIONS.EXPENSES, expenseId);

      res.json({
        success: true,
        message: 'Expense deleted successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark expense split as paid
   * POST /api/expenses/:expenseId/pay
   */
  static async markSplitPaid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { expenseId } = req.params;
      const { userId: splitUserId } = req.body;
      const userId = req.user!.id;

      if (!expenseId) {
        throw new ValidationError('Expense ID is required');
      }

      const expense = await DatabaseService.getDocument(COLLECTIONS.EXPENSES, expenseId) as Expense;
      if (!expense) {
        throw new NotFoundError('Expense not found');
      }

      // Users can mark their own splits as paid, or the payer can mark others as paid
      const targetUserId = splitUserId || userId;
      if (targetUserId !== userId && expense.paidBy !== userId) {
        throw new ValidationError('You can only mark your own expenses as paid, or mark others as paid if you are the payer');
      }

      // Find the split to update
      const splitIndex = expense.splits.findIndex(split => split.userId === targetUserId);
      if (splitIndex === -1) {
        throw new NotFoundError('Split not found for this user');
      }

      if (expense.splits[splitIndex].isPaid) {
        throw new ValidationError('This split is already marked as paid');
      }

      // Update the split
      expense.splits[splitIndex].isPaid = true;
      expense.splits[splitIndex].paidAt = new Date();

      // Check if all splits are paid
      const allPaid = expense.splits.every(split => split.isPaid);

      await DatabaseService.updateDocument(COLLECTIONS.EXPENSES, expenseId, {
        splits: expense.splits,
        isSettled: allPaid,
        settledAt: allPaid ? new Date() : undefined,
        updatedAt: new Date()
      });

      const updatedExpense = await DatabaseService.getDocument(COLLECTIONS.EXPENSES, expenseId);

      res.json({
        success: true,
        message: allPaid ? 'Expense fully settled!' : 'Split marked as paid',
        data: updatedExpense
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's expenses across all groups
   * GET /api/expenses/user
   */
  static async getUserExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, settled, type } = req.query;
      const userId = req.user!.id;

      let expenses: any[] = [];

      if (!type || type === 'paid') {
        // Expenses user paid for
        const paidExpenses = await DatabaseService.queryDocuments(
          COLLECTIONS.EXPENSES,
          { paidBy: userId },
          { field: 'date', direction: 'desc' },
          Number(limit)
        );
        expenses = [...expenses, ...paidExpenses.map((exp: any) => ({ ...exp, type: 'paid' }))];
      }

      if (!type || type === 'owes') {
        // Expenses user owes money for
        const owedExpenses = await DatabaseService.queryDocuments(
          COLLECTIONS.EXPENSES,
          { 'splits.userId': userId },
          { field: 'date', direction: 'desc' },
          Number(limit)
        );
        
        const filteredOwedExpenses = owedExpenses
          .filter((exp: any) => exp.paidBy !== userId) // Exclude expenses they paid for
          .map((exp: any) => ({ ...exp, type: 'owes' }));
        
        expenses = [...expenses, ...filteredOwedExpenses];
      }

      // Filter by settled status if specified
      if (settled !== undefined) {
        const isSettled = settled === 'true';
        expenses = expenses.filter(exp => exp.isSettled === isSettled);
      }

      // Sort by date and apply limit
      expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      expenses = expenses.slice(0, Number(limit));

      res.json({
        success: true,
        message: 'User expenses retrieved successfully',
        data: expenses
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get expense categories
   * GET /api/expenses/categories
   */
  static async getExpenseCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const categories = [
        { name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B' },
        { name: 'Transportation', icon: '🚗', color: '#4ECDC4' },
        { name: 'Shopping', icon: '🛍️', color: '#45B7D1' },
        { name: 'Entertainment', icon: '🎬', color: '#FFA07A' },
        { name: 'Bills & Utilities', icon: '💡', color: '#98D8C8' },
        { name: 'Healthcare', icon: '⚕️', color: '#F06292' },
        { name: 'Education', icon: '📚', color: '#AED581' },
        { name: 'Travel', icon: '✈️', color: '#FFD54F' },
        { name: 'Groceries', icon: '🛒', color: '#81C784' },
        { name: 'Gas & Fuel', icon: '⛽', color: '#FFB74D' },
        { name: 'Home & Garden', icon: '🏠', color: '#A1C4FD' },
        { name: 'Personal Care', icon: '💄', color: '#F8BBD9' },
        { name: 'Gifts', icon: '🎁', color: '#D1C4E9' },
        { name: 'Sports & Fitness', icon: '🏋️', color: '#C8E6C9' },
        { name: 'Technology', icon: '💻', color: '#B39DDB' },
        { name: 'Other', icon: '💳', color: '#E0E0E0' }
      ];

      res.json({
        success: true,
        message: 'Expense categories retrieved successfully',
        data: categories
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get expense statistics
   * GET /api/expenses/stats?groupId=xxx
   */
  static async getExpenseStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId, period = 'month' } = req.query;
      const userId = req.user!.id;

      if (!groupId) {
        throw new ValidationError('Group ID is required');
      }

      // Verify user is member of group
      const group = await DatabaseService.getDocument(COLLECTIONS.GROUPS, groupId as string) as Group;
      if (!group) {
        throw new NotFoundError('Group not found');
      }

      const isMember = group.members.some(member => member.userId === userId && member.isActive);
      if (!isMember) {
        throw new ValidationError('You are not a member of this group');
      }

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Get expenses for the period
      const expenses = await DatabaseService.queryDocuments(
        COLLECTIONS.EXPENSES,
        { groupId, date: { $gte: startDate } }
      );

      // Calculate statistics
      const totalExpenses = expenses.length;
      const totalAmount = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
      const settledExpenses = expenses.filter((exp: any) => exp.isSettled).length;
      const userPaidExpenses = expenses.filter((exp: any) => exp.paidBy === userId);
      const userPaidAmount = userPaidExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

      // Category breakdown
      const categoryStats: { [key: string]: { count: number; amount: number } } = {};
      expenses.forEach((exp: any) => {
        const category = exp.category || 'Other';
        if (!categoryStats[category]) {
          categoryStats[category] = { count: 0, amount: 0 };
        }
        categoryStats[category].count++;
        categoryStats[category].amount += exp.amount;
      });

      res.json({
        success: true,
        message: 'Expense statistics retrieved successfully',
        data: {
          period,
          totalExpenses,
          totalAmount,
          settledExpenses,
          settlementRate: totalExpenses > 0 ? (settledExpenses / totalExpenses) * 100 : 0,
          userPaidExpenses: userPaidExpenses.length,
          userPaidAmount,
          categoryBreakdown: categoryStats
        }
      });
    } catch (error) {
      throw error;
    }
  }
}
