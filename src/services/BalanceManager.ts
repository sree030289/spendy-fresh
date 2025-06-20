// src/services/BalanceManager.ts - Unified Balance Management System

import { SplittingService, Friend, Group } from '@/services/firebase/splitting';

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
  private listeners = new Set<(balances: BalanceSummary) => void>();
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
    const wrappedCallback = (balances: BalanceSummary) => {
      callback(balances);
    };
    this.listeners.add(wrappedCallback);
    
    // Return unsubscribe function
    return () => this.listeners.delete(wrappedCallback);
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

  // Refresh balances from all sources
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

      // Process friend balances
      const friendUserIds = new Set<string>();
      for (const friend of friends) {
        if (friend.status === 'accepted' && Math.abs(friend.balance) > 0.01) {
          friendUserIds.add(friend.friendId);
          
          const detail: BalanceDetail = {
            userId: friend.friendId,
            name: friend.friendData.fullName,
            email: friend.friendData.email,
            avatar: friend.friendData.avatar,
            balance: friend.balance,
            source: 'friend',
            lastUpdated: friend.lastActivity || friend.createdAt
          };

          balanceDetails.push(detail);

          if (friend.balance > 0) {
            totalOwed += friend.balance;
          } else {
            totalOwing += Math.abs(friend.balance);
          }
        }
      }

      // Process group member balances (for non-friends only)
      for (const group of userGroups) {
        const userMember = group.members.find(member => member.userId === userId);
        if (!userMember) continue;

        for (const otherMember of group.members) {
          if (otherMember.userId === userId) continue;
          if (friendUserIds.has(otherMember.userId)) continue; // Skip friends

          // Calculate actual balance between users in this group
          const pairwiseBalance = await this.calculatePairwiseBalance(userId, otherMember.userId, group.id);
          
          if (Math.abs(pairwiseBalance) > 0.01) {
            // Check if user already exists from another group
            const existingIndex = balanceDetails.findIndex(detail => 
              detail.userId === otherMember.userId && detail.source === 'group'
            );

            if (existingIndex >= 0) {
              // Combine balances from multiple groups
              balanceDetails[existingIndex].balance += pairwiseBalance;
              balanceDetails[existingIndex].groupName += `, ${group.name}`;
            } else {
              const detail: BalanceDetail = {
                userId: otherMember.userId,
                name: otherMember.userData.fullName,
                email: otherMember.userData.email,
                avatar: otherMember.userData.avatar,
                balance: pairwiseBalance,
                source: 'group',
                groupName: group.name,
                groupId: group.id,
                lastUpdated: group.updatedAt
              };

              balanceDetails.push(detail);
            }

            if (pairwiseBalance > 0) {
              totalOwed += pairwiseBalance;
            } else {
              totalOwing += Math.abs(pairwiseBalance);
            }
          }
        }
      }

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

      // Notify all listeners
      this.notifyListeners(balanceSummary);

      console.log('✅ Unified balances refreshed:', {
        totalOwed,
        totalOwing,
        netBalance,
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

  // Calculate balance between two users in a specific group
  private async calculatePairwiseBalance(userId1: string, userId2: string, groupId: string): Promise<number> {
    try {
      const expenses = await SplittingService.getGroupExpenses(groupId);
      let balance = 0;

      expenses.forEach(expense => {
        // Case 1: userId1 paid, userId2 owes
        if (expense.paidBy === userId1) {
          const user2Split = expense.splitData.find(split => split.userId === userId2);
          if (user2Split && !user2Split.isPaid) {
            balance += user2Split.amount;
          }
        }
        
        // Case 2: userId2 paid, userId1 owes  
        if (expense.paidBy === userId2) {
          const user1Split = expense.splitData.find(split => split.userId === userId1);
          if (user1Split && !user1Split.isPaid) {
            balance -= user1Split.amount;
          }
        }
      });

      return parseFloat(balance.toFixed(2));
    } catch (error) {
      console.error('Calculate pairwise balance error:', error);
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

  // Notify all listeners
  private notifyListeners(balances: BalanceSummary): void {
    this.listeners.forEach(listener => {
      try {
        listener(balances);
      } catch (error) {
        console.error('Error in balance listener:', error);
      }
    });
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