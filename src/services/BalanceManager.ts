// src/services/BalanceManager.ts - FIXED Unified Balance Management System

import { SplittingService, Friend, Group, Expense } from '@/services/firebase/splitting';

export interface BalanceDetail {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  balance: number; // Positive = they owe you, Negative = you owe them
  source: 'friend' | 'group';
  groupName?: string;
  groupId?: string;
  lastUpdated: Date;
}

export interface BalanceSummary {
  totalOwed: number;    // Total amount others owe you
  totalOwing: number;   // Total amount you owe others
  netBalance: number;   // Net balance (positive = you're owed, negative = you owe)
  details: BalanceDetail[];
  lastUpdated: Date;
}

export interface BalanceDisplayConfig {
  showZeroBalances: boolean;
  sortBy: 'amount' | 'name' | 'date';
  sortOrder: 'asc' | 'desc';
  groupSeparately: boolean;
}

class BalanceManager {
  private static instance: BalanceManager;
  private balanceCache = new Map<string, BalanceSummary>();
  private listeners = new Map<string, Set<(balances: BalanceSummary) => void>>();
  private refreshTimeout: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  static getInstance(): BalanceManager {
    if (!BalanceManager.instance) {
      BalanceManager.instance = new BalanceManager();
    }
    return BalanceManager.instance;
  }

  // Add a listener for balance updates
  addListener(userId: string, callback: (balances: BalanceSummary) => void): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        userListeners.delete(callback);
        if (userListeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  // Get cached balances or fetch fresh ones
  async getBalances(userId: string, forceRefresh: boolean = false): Promise<BalanceSummary> {
    const cached = this.balanceCache.get(userId);
    
    // Return cached if available and not forcing refresh
    if (cached && !forceRefresh && this.isCacheValid(cached)) {
      return cached;
    }

    return this.refreshBalances(userId);
  }

  // FIXED: Single source of truth balance calculation
  async refreshBalances(userId: string): Promise<BalanceSummary> {
    if (this.isRefreshing) {
      // Return cached if refresh is in progress
      const cached = this.balanceCache.get(userId);
      if (cached) return cached;
    }

    this.isRefreshing = true;

    try {
      console.log('🔄 Refreshing unified balances for user:', userId);

      // Get all data sources in parallel
      const [friends, userGroups] = await Promise.all([
        SplittingService.getFriends(userId),
        SplittingService.getUserGroups(userId)
      ]);

      const balanceDetails: BalanceDetail[] = [];
      let totalOwed = 0;
      let totalOwing = 0;

      // PHASE 1: Process friend balances (these are already calculated correctly)
      const friendUserIds = new Set<string>();
      for (const friend of friends) {
        if (friend.status === 'accepted' && Math.abs(friend.balance) > 0.01) {
          friendUserIds.add(friend.friendId);
          
          const detail: BalanceDetail = {
            userId: friend.friendId,
            name: friend.friendData.fullName,
            email: friend.friendData.email,
            avatar: friend.friendData.avatar,
            balance: friend.balance, // This is correct from the friend relationship
            source: 'friend',
            lastUpdated: friend.lastActivity || friend.createdAt
          };

          balanceDetails.push(detail);

          // FIXED: Correct balance interpretation
          if (friend.balance > 0) {
            totalOwed += friend.balance; // Friend owes you
          } else {
            totalOwing += Math.abs(friend.balance); // You owe friend
          }
        }
      }

      console.log(`✅ Processed ${friendUserIds.size} friend balances`);

      // PHASE 2: Process group member balances (for non-friends only)
      const groupMemberBalances = new Map<string, {
        userId: string;
        name: string;
        email: string;
        avatar?: string;
        balance: number;
        groupNames: string[];
        groupIds: string[];
      }>();

      for (const group of userGroups) {
        console.log(`🔍 Processing group: ${group.name} with ${group.members.length} members`);
        
        for (const otherMember of group.members) {
          if (otherMember.userId === userId) continue; // Skip self
          if (friendUserIds.has(otherMember.userId)) continue; // Skip friends (already counted)

          // Calculate actual balance between users in this specific group
          const pairwiseBalance = await this.calculatePairwiseGroupBalance(userId, otherMember.userId, group.id);
          
          console.log(`Balance between ${userId} and ${otherMember.userId} in ${group.name}: ${pairwiseBalance}`);
          
          if (Math.abs(pairwiseBalance) > 0.01) {
            const existingBalance = groupMemberBalances.get(otherMember.userId);
            
            if (existingBalance) {
              // User appears in multiple groups - combine balances
              existingBalance.balance += pairwiseBalance;
              existingBalance.groupNames.push(group.name);
              existingBalance.groupIds.push(group.id);
            } else {
              // New group member
              groupMemberBalances.set(otherMember.userId, {
                userId: otherMember.userId,
                name: otherMember.userData.fullName,
                email: otherMember.userData.email,
                avatar: otherMember.userData.avatar,
                balance: pairwiseBalance,
                groupNames: [group.name],
                groupIds: [group.id]
              });
            }
          }
        }
      }

      // Convert group member balances to balance details
      for (const memberBalance of groupMemberBalances.values()) {
        const detail: BalanceDetail = {
          userId: memberBalance.userId,
          name: memberBalance.name,
          email: memberBalance.email,
          avatar: memberBalance.avatar,
          balance: memberBalance.balance,
          source: 'group',
          groupName: memberBalance.groupNames.join(', '),
          groupId: memberBalance.groupIds[0], // Use first group ID
          lastUpdated: new Date()
        };

        balanceDetails.push(detail);

        // Add to totals
        if (memberBalance.balance > 0) {
          totalOwed += memberBalance.balance;
        } else {
          totalOwing += Math.abs(memberBalance.balance);
        }
      }

      console.log(`✅ Processed ${groupMemberBalances.size} group member balances`);

      const netBalance = totalOwed - totalOwing;
      const balanceSummary: BalanceSummary = {
        totalOwed: parseFloat(totalOwed.toFixed(2)),
        totalOwing: parseFloat(totalOwing.toFixed(2)),
        netBalance: parseFloat(netBalance.toFixed(2)),
        details: balanceDetails,
        lastUpdated: new Date()
      };

      // Cache the result
      this.balanceCache.set(userId, balanceSummary);

      // Notify all listeners for this user
      this.notifyUserListeners(userId, balanceSummary);

      console.log('✅ Unified balances refreshed:', {
        totalOwed: balanceSummary.totalOwed,
        totalOwing: balanceSummary.totalOwing,
        netBalance: balanceSummary.netBalance,
        detailCount: balanceDetails.length
      });

      return balanceSummary;

    } catch (error) {
      console.error('❌ Error refreshing unified balances:', error);
      
      // Return cached data or empty state on error
      const cached = this.balanceCache.get(userId);
      if (cached) return cached;

      return {
        totalOwed: 0,
        totalOwing: 0,
        netBalance: 0,
        details: [],
        lastUpdated: new Date()
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  // FIXED: Accurate pairwise balance calculation for group members
  private async calculatePairwiseGroupBalance(userId1: string, userId2: string, groupId: string): Promise<number> {
    try {
      const expenses = await SplittingService.getGroupExpenses(groupId);
      let balance = 0;

      expenses.forEach(expense => {
        // Case 1: userId1 paid, userId2 has a split
        if (expense.paidBy === userId1) {
          const user2Split = expense.splitData.find(split => split.userId === userId2);
          if (user2Split && !user2Split.isPaid) {
            balance += user2Split.amount; // userId2 owes userId1
          }
        }
        
        // Case 2: userId2 paid, userId1 has a split
        if (expense.paidBy === userId2) {
          const user1Split = expense.splitData.find(split => split.userId === userId1);
          if (user1Split && !user1Split.isPaid) {
            balance -= user1Split.amount; // userId1 owes userId2
          }
        }
      });

      return parseFloat(balance.toFixed(2));
    } catch (error) {
      console.error('Calculate pairwise group balance error:', error);
      return 0;
    }
  }

  // Format balances for display with configuration
  formatBalancesForDisplay(
    balances: BalanceSummary, 
    config: BalanceDisplayConfig = {
      showZeroBalances: false,
      sortBy: 'amount',
      sortOrder: 'desc',
      groupSeparately: false
    }
  ): {
    friends: BalanceDetail[];
    groupMembers: BalanceDetail[];
    combined: BalanceDetail[];
  } {
    let details = [...balances.details];

    // Filter zero balances if configured
    if (!config.showZeroBalances) {
      details = details.filter(detail => Math.abs(detail.balance) > 0.01);
    }

    // Sort based on configuration
    details.sort((a, b) => {
      let comparison = 0;
      
      switch (config.sortBy) {
        case 'amount':
          comparison = Math.abs(b.balance) - Math.abs(a.balance);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = b.lastUpdated.getTime() - a.lastUpdated.getTime();
          break;
      }

      return config.sortOrder === 'desc' ? comparison : -comparison;
    });

    if (config.groupSeparately) {
      const friends = details.filter(detail => detail.source === 'friend');
      const groupMembers = details.filter(detail => detail.source === 'group');
      
      return { friends, groupMembers, combined: details };
    }

    return { friends: [], groupMembers: [], combined: details };
  }

  // Get formatted display strings for balances
  getBalanceDisplayText(balance: number, currency: string = 'USD'): {
    text: string;
    color: 'positive' | 'negative' | 'neutral';
    symbol: string;
  } {
    const absBalance = Math.abs(balance);
    
    if (absBalance < 0.01) {
      return {
        text: 'Settled up',
        color: 'neutral',
        symbol: '✓'
      };
    }

    if (balance > 0) {
      return {
        text: `Owes you $${absBalance.toFixed(2)}`,
        color: 'positive',
        symbol: '+'
      };
    }

    return {
      text: `You owe $${absBalance.toFixed(2)}`,
      color: 'negative', 
      symbol: '-'
    };
  }

  // Debounced refresh to prevent excessive calls
  scheduleRefresh(userId: string, delay: number = 1000): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    this.refreshTimeout = setTimeout(() => {
      this.refreshBalances(userId);
    }, delay);
  }

  // Notify balance change (call this when expenses/groups/friends change)
  notifyBalanceChange(userId: string): void {
    this.scheduleRefresh(userId, 500);
  }

  // Clear cache for user
  clearCache(userId: string): void {
    this.balanceCache.delete(userId);
  }

  // Check if cached data is still valid (5 minutes)
  private isCacheValid(balances: BalanceSummary): boolean {
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - balances.lastUpdated.getTime() < fiveMinutes;
  }

  // Notify listeners for specific user
  private notifyUserListeners(userId: string, balances: BalanceSummary): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.forEach(listener => {
        try {
          listener(balances);
        } catch (error) {
          console.error('Error in balance listener:', error);
        }
      });
    }
  }

  // Cleanup
  dispose(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.listeners.clear();
    this.balanceCache.clear();
  }
}

export default BalanceManager;