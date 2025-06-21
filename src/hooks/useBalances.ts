// STEP 1: First, create src/hooks/useBalances.ts with this exact code:

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { SplittingService } from '@/services/firebase/splitting';

interface BalanceDetail {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  balance: number;
  source: 'friend' | 'group';
  groupName?: string;
  groupId?: string;
  lastUpdated: Date;
}

interface BalanceSummary {
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  details: BalanceDetail[];
  lastUpdated: Date;
}

export const useBalances = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<BalanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateUnifiedBalances = async (userId: string): Promise<BalanceSummary> => {
    try {
      console.log('🔄 Calculating unified balances for user:', userId);

      // Get friends and groups
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
          
          balanceDetails.push({
            userId: friend.friendId,
            name: friend.friendData.fullName,
            email: friend.friendData.email,
            avatar: friend.friendData.avatar,
            balance: friend.balance,
            source: 'friend',
            lastUpdated: friend.lastActivity || friend.createdAt
          });

          if (friend.balance > 0) {
            totalOwed += friend.balance;
          } else {
            totalOwing += Math.abs(friend.balance);
          }
        }
      }

      // Process group member balances (for non-friends only)
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
        for (const otherMember of group.members) {
          if (otherMember.userId === userId) continue;
          if (friendUserIds.has(otherMember.userId)) continue;

          // Calculate pairwise balance in this group
          const expenses = await SplittingService.getGroupExpenses(group.id);
          let balance = 0;

          expenses.forEach(expense => {
            if (expense.paidBy === userId) {
              const user2Split = expense.splitData.find(split => split.userId === otherMember.userId);
              if (user2Split && !user2Split.isPaid) {
                balance += user2Split.amount;
              }
            }
            
            if (expense.paidBy === otherMember.userId) {
              const user1Split = expense.splitData.find(split => split.userId === userId);
              if (user1Split && !user1Split.isPaid) {
                balance -= user1Split.amount;
              }
            }
          });

          if (Math.abs(balance) > 0.01) {
            const existingBalance = groupMemberBalances.get(otherMember.userId);
            
            if (existingBalance) {
              existingBalance.balance += balance;
              existingBalance.groupNames.push(group.name);
              existingBalance.groupIds.push(group.id);
            } else {
              groupMemberBalances.set(otherMember.userId, {
                userId: otherMember.userId,
                name: otherMember.userData.fullName,
                email: otherMember.userData.email,
                avatar: otherMember.userData.avatar,
                balance: balance,
                groupNames: [group.name],
                groupIds: [group.id]
              });
            }
          }
        }
      }

      // Convert group member balances to balance details
      for (const memberBalance of groupMemberBalances.values()) {
        balanceDetails.push({
          userId: memberBalance.userId,
          name: memberBalance.name,
          email: memberBalance.email,
          avatar: memberBalance.avatar,
          balance: memberBalance.balance,
          source: 'group',
          groupName: memberBalance.groupNames.join(', '),
          groupId: memberBalance.groupIds[0],
          lastUpdated: new Date()
        });

        if (memberBalance.balance > 0) {
          totalOwed += memberBalance.balance;
        } else {
          totalOwing += Math.abs(memberBalance.balance);
        }
      }

      const result = {
        totalOwed: parseFloat(totalOwed.toFixed(2)),
        totalOwing: parseFloat(totalOwing.toFixed(2)),
        netBalance: parseFloat((totalOwed - totalOwing).toFixed(2)),
        details: balanceDetails,
        lastUpdated: new Date()
      };

      console.log('✅ Unified balances calculated:', result);
      return result;

    } catch (error) {
      console.error('❌ Error calculating unified balances:', error);
      return {
        totalOwed: 0,
        totalOwing: 0,
        netBalance: 0,
        details: [],
        lastUpdated: new Date()
      };
    }
  };

  const refresh = useCallback(async (force: boolean = false) => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const freshBalances = await calculateUnifiedBalances(user.id);
      setBalances(freshBalances);
      
    } catch (err) {
      console.error('Error refreshing balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to load balances');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const forceRefresh = useCallback(() => refresh(true), [refresh]);

  const notifyChange = useCallback(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) {
      setBalances(null);
      setIsLoading(false);
      return;
    }

    refresh();
  }, [user?.id, refresh]);

  // Format balances for display
  const friends = balances?.details.filter(detail => detail.source === 'friend') || [];
  const groupMembers = balances?.details.filter(detail => detail.source === 'group') || [];
  const allBalances = balances?.details || [];

  return {
    balances,
    isLoading,
    error,
    totalOwed: balances?.totalOwed ?? 0,
    totalOwing: balances?.totalOwing ?? 0,
    netBalance: balances?.netBalance ?? 0,
    friendBalances: friends,
    groupMemberBalances: groupMembers,
    allBalances,
    refresh: () => refresh(false),
    forceRefresh,
    notifyChange,
    isEmpty: allBalances.length === 0,
    hasPositiveBalance: (balances?.totalOwed ?? 0) > 0,
    hasNegativeBalance: (balances?.totalOwing ?? 0) > 0
  };
};

export const useOverviewBalances = () => useBalances();
export const useFriendsBalances = () => useBalances();

export default useBalances;