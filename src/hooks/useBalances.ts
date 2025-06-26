// src/hooks/useBalances.ts - COMPLETE FIXED VERSION with proper friend categorization
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { SplittingService, Friend } from '@/services/firebase/splitting';

// Interfaces for UnifiedSettlementService
interface BalanceDetail {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  balance: number;
  source: 'friend' | 'group' | 'mixed';
  groupName?: string;
  groupId?: string;
  lastUpdated: Date;
  breakdown?: {
    fromFriendships: number;
    fromGroups: { [groupId: string]: { groupName: string; balance: number } };
  };
}

interface BalanceSummary {
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  details: BalanceDetail[];
  lastUpdated: Date;
}

// Unified Settlement Service embedded in this file
class UnifiedSettlementService {
  /**
   * Calculate comprehensive balances - SINGLE SOURCE OF TRUTH
   */
  static async calculateUserBalances(userId: string): Promise<BalanceSummary> {
    try {
      console.log('🔄 Calculating UNIFIED balances for user:', userId);

      // Get all relationships and group data
      const [friends, userGroups] = await Promise.all([
        SplittingService.getFriends(userId),
        SplittingService.getUserGroups(userId)
      ]);

      const balanceMap = new Map<string, BalanceDetail>();
      let totalOwed = 0;
      let totalOwing = 0;

      // PHASE 1: Process direct friendships
      console.log(`Processing ${friends.length} friendships`);
      for (const friend of friends) {
        if (friend.status === 'accepted' && Math.abs(friend.balance) > 0.01) {
          const balance: BalanceDetail = {
            userId: friend.friendId,
            name: friend.friendData.fullName,
            email: friend.friendData.email,
            avatar: friend.friendData.avatar,
            balance: friend.balance, // Direct from friendship
            source: 'friend',
            lastUpdated: friend.lastActivity || friend.createdAt,
            breakdown: {
              fromFriendships: friend.balance,
              fromGroups: {}
            }
          };

          balanceMap.set(friend.friendId, balance);

          if (friend.balance > 0) {
            totalOwed += friend.balance;
          } else {
            totalOwing += Math.abs(friend.balance);
          }
        }
      }

      // PHASE 2: Process group relationships
      const friendUserIds = new Set(friends.map(f => f.friendId));
      const allGroupMembersMap = new Map<string, { name: string; email: string; avatar?: string; groups: Array<{id: string; name: string}> }>();
      
      console.log(`Processing ${userGroups.length} groups`);

      // First pass: collect all group members
      for (const group of userGroups) {
        for (const member of group.members) {
          if (member.userId === userId) continue;
          
          if (!allGroupMembersMap.has(member.userId)) {
            allGroupMembersMap.set(member.userId, {
              name: member.userData.fullName,
              email: member.userData.email,
              avatar: member.userData.avatar,
              groups: []
            });
          }
          
          allGroupMembersMap.get(member.userId)!.groups.push({
            id: group.id,
            name: group.name
          });
        }
      }

      // Second pass: calculate balances for each group member
      for (const group of userGroups) {
        console.log(`Processing group: ${group.name} with ${group.members.length} members`);
        
        for (const member of group.members) {
          if (member.userId === userId) continue;

          // Calculate actual pairwise balance in this group
          const groupBalance = await this.calculateGroupPairwiseBalance(
            userId, 
            member.userId, 
            group.id
          );

          console.log(`Balance between ${userId} and ${member.userId} in ${group.name}: ${groupBalance}`);

          const existingBalance = balanceMap.get(member.userId);

          if (existingBalance) {
            // User is both friend AND group member - combine balances
            const oldNetBalance = existingBalance.balance;
            existingBalance.balance += groupBalance;
            existingBalance.source = 'mixed';
            existingBalance.breakdown!.fromGroups[group.id] = {
              groupName: group.name,
              balance: groupBalance
            };

            // Update totals (remove old, add new)
            if (Math.abs(oldNetBalance) > 0.01) {
              if (oldNetBalance > 0) totalOwed -= oldNetBalance;
              else totalOwing -= Math.abs(oldNetBalance);
            }

            if (Math.abs(existingBalance.balance) > 0.01) {
              if (existingBalance.balance > 0) totalOwed += existingBalance.balance;
              else totalOwing += Math.abs(existingBalance.balance);
            }

          } else {
            // User is ONLY in groups (not a direct friend)
            const memberInfo = allGroupMembersMap.get(member.userId)!;
            const existingGroupBalance = balanceMap.get(member.userId);
            
            if (existingGroupBalance) {
              // Member already exists from another group, update balance
              const oldBalance = existingGroupBalance.balance;
              existingGroupBalance.balance += groupBalance;
              existingGroupBalance.breakdown!.fromGroups[group.id] = {
                groupName: group.name,
                balance: groupBalance
              };
              
              // Update totals
              if (Math.abs(oldBalance) > 0.01) {
                if (oldBalance > 0) totalOwed -= oldBalance;
                else totalOwing -= Math.abs(oldBalance);
              }

              if (Math.abs(existingGroupBalance.balance) > 0.01) {
                if (existingGroupBalance.balance > 0) totalOwed += existingGroupBalance.balance;
                else totalOwing += Math.abs(existingGroupBalance.balance);
              }
            } else {
              // New group-only member
              const balance: BalanceDetail = {
                userId: member.userId,
                name: memberInfo.name,
                email: memberInfo.email,
                avatar: memberInfo.avatar,
                balance: groupBalance,
                source: 'group',
                groupName: group.name,
                groupId: group.id,
                lastUpdated: new Date(),
                breakdown: {
                  fromFriendships: 0,
                  fromGroups: {
                    [group.id]: {
                      groupName: group.name,
                      balance: groupBalance
                    }
                  }
                }
              };

              balanceMap.set(member.userId, balance);

              // Update totals for new group balances (only if significant)
              if (Math.abs(groupBalance) > 0.01) {
                if (groupBalance > 0) {
                  totalOwed += groupBalance;
                } else {
                  totalOwing += Math.abs(groupBalance);
                }
              }
            }
          }
        }
      }

      const netBalance = totalOwed - totalOwing;
      const balanceDetails = Array.from(balanceMap.values());

      const result = {
        totalOwed: parseFloat(totalOwed.toFixed(2)),
        totalOwing: parseFloat(totalOwing.toFixed(2)),
        netBalance: parseFloat(netBalance.toFixed(2)),
        details: balanceDetails,
        lastUpdated: new Date()
      };

      console.log('✅ UNIFIED balance calculation complete:', {
        totalOwed: result.totalOwed,
        totalOwing: result.totalOwing,
        netBalance: result.netBalance,
        relationships: balanceDetails.length
      });

      return result;

    } catch (error) {
      console.error('❌ Calculate unified balances error:', error);
      return {
        totalOwed: 0,
        totalOwing: 0,
        netBalance: 0,
        details: [],
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Calculate precise group pairwise balance - MATCHES YOUR MANUAL CALCULATION
   */
static async calculateGroupPairwiseBalance(
  userId1: string, 
  userId2: string, 
  groupId: string
): Promise<number> {
  try {
    console.log(`\n🔍 === DETAILED BALANCE CALCULATION ===`);
    console.log(`👤 User1 (You): ${userId1}`);
    console.log(`👤 User2 (Them): ${userId2}`);
    console.log(`🏢 Group: ${groupId}`);
    
    const expenses = await SplittingService.getGroupExpenses(groupId);
    console.log(`📋 Total expenses found: ${expenses.length}`);
    
    let balance = 0;
    let expenseCount = 0;

    expenses.forEach((expense, index) => {
      // Skip settlement transactions
      if (expense.isSettlementTransaction) {
        console.log(`⏭️  Expense ${index + 1}: SKIPPED (settlement) - ${expense.description}`);
        return;
      }

      expenseCount++;
      console.log(`\n💰 Expense ${expenseCount}: "${expense.description}"`);
      console.log(`💵 Amount: ${expense.amount}`);
      console.log(`💳 Paid by: ${expense.paidBy}`);
      console.log(`📊 Split data:`, expense.splitData.map(s => `${s.userId}: ${s.amount} (paid: ${s.isPaid})`));

      let expenseBalance = 0;

      // Case 1: userId1 paid, userId2 has a split
      if (expense.paidBy === userId1) {
        const user2Split = expense.splitData.find(split => split.userId === userId2);
        if (user2Split) {
          if (!user2Split.isPaid) {
            console.log(`➕ User2 owes User1: ${user2Split.amount} (UNPAID)`);
            expenseBalance += user2Split.amount;
          } else {
            console.log(`✅ User2 split: ${user2Split.amount} (ALREADY PAID)`);
          }
        } else {
          console.log(`❌ User2 not involved in this expense`);
        }
      }
      
      // Case 2: userId2 paid, userId1 has a split
      else if (expense.paidBy === userId2) {
        const user1Split = expense.splitData.find(split => split.userId === userId1);
        if (user1Split) {
          if (!user1Split.isPaid) {
            console.log(`➖ User1 owes User2: ${user1Split.amount} (UNPAID)`);
            expenseBalance -= user1Split.amount;
          } else {
            console.log(`✅ User1 split: ${user1Split.amount} (ALREADY PAID)`);
          }
        } else {
          console.log(`❌ User1 not involved in this expense`);
        }
      }
      
      // Case 3: Someone else paid
      else {
        console.log(`👥 Someone else paid (${expense.paidBy}) - no direct balance impact`);
      }

      balance += expenseBalance;
      console.log(`📊 Expense balance: ${expenseBalance}`);
      console.log(`📊 Running total: ${balance}`);
    });

    const finalBalance = parseFloat(balance.toFixed(2));
    console.log(`\n✅ === FINAL RESULT ===`);
    console.log(`🔢 Final balance: ${finalBalance}`);
    console.log(`💭 Interpretation: ${finalBalance > 0 ? 'User2 owes User1' : finalBalance < 0 ? 'User1 owes User2' : 'No balance'}`);
    console.log(`===============================\n`);
    
    return finalBalance;
  } catch (error) {
    console.error('❌ Calculate group pairwise balance error:', error);
    return 0;
  }
}

  /**
   * Verify manual calculation logic - FOR TESTING
   */
  static verifyManualCalculation(): {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
  } {
    console.log('🧮 Verifying manual calculation logic...');

    let balances = { A: 0, B: 0, C: 0, D: 0, E: 0 };

    // Transaction 1: A pays 1000, split equally among all 5
    const split1 = 1000 / 5; // 200 each
    balances.A += 1000 - split1; // A gets back 800
    balances.B -= split1; // B owes 200
    balances.C -= split1; // C owes 200
    balances.D -= split1; // D owes 200
    balances.E -= split1; // E owes 200

    console.log('After transaction 1:', { ...balances });

    // Transaction 2: C pays 1500, split equally among all 5
    const split2 = 1500 / 5; // 300 each
    balances.A -= split2; // A owes 300 more
    balances.B -= split2; // B owes 300 more
    balances.C += 1500 - split2; // C gets back 1200
    balances.D -= split2; // D owes 300 more
    balances.E -= split2; // E owes 300 more

    console.log('After transaction 2:', { ...balances });

    // Transaction 3: B pays 300, split among A, B, D only
    const split3 = 300 / 3; // 100 each
    balances.A -= split3; // A owes 100 more
    balances.B += 300 - split3; // B gets back 200
    balances.D -= split3; // D owes 100 more

    console.log('After transaction 3:', { ...balances });

    // Transaction 4: C pays 900, split among A, C, D only
    const split4 = 900 / 3; // 300 each
    balances.A -= split4; // A owes 300 more
    balances.C += 900 - split4; // C gets back 600
    balances.D -= split4; // D owes 300 more

    console.log('After transaction 4:', { ...balances });

    // Round to 2 decimal places
    Object.keys(balances).forEach(key => {
      balances[key as keyof typeof balances] = parseFloat(balances[key as keyof typeof balances].toFixed(2));
    });

    console.log('✅ Final manual calculation:', balances);
    console.log('Expected: A=100, B=-300, C=1600, D=-900, E=-500');
    
    return balances;
  }
}

export const useBalances = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<BalanceSummary | null>(null);
  const [friendsData, setFriendsData] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (force: boolean = false) => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 useBalances: Refreshing with UnifiedSettlementService');
      
      // Load friends data and balances in parallel
      const [freshBalances, friendsResult] = await Promise.all([
        UnifiedSettlementService.calculateUserBalances(user.id),
        SplittingService.getFriends(user.id)
      ]);
      
      setBalances(freshBalances);
      setFriendsData(friendsResult);
      
      console.log('✅ useBalances: Refresh complete:', {
        totalOwed: freshBalances.totalOwed,
        totalOwing: freshBalances.totalOwing,
        netBalance: freshBalances.netBalance,
        detailCount: freshBalances.details.length,
        friendsCount: friendsResult.length
      });
      
    } catch (err) {
      console.error('❌ useBalances: Error refreshing balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to load balances');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const forceRefresh = useCallback(() => refresh(true), [refresh]);

  const notifyChange = useCallback(() => {
    console.log('🔔 useBalances: Balance change notification received');
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) {
      setBalances(null);
      setFriendsData([]);
      setIsLoading(false);
      return;
    }

    console.log('🚀 useBalances: Initial load for user:', user.id);
    refresh();
  }, [user?.id, refresh]);

  // FIXED: Format balances for display with proper friend categorization
  const friends = balances?.details.filter(detail => {
    // Check if this person is actually a friend (not just a group member)
    const isFriend = friendsData.some(friend => 
      friend.friendId === detail.userId && friend.status === 'accepted'
    );
    return isFriend; // Only include actual friends, regardless of source
  }) || [];
  
  const groupMembers = balances?.details.filter(detail => {
    // Check if this person is NOT a friend but is in groups
    const isFriend = friendsData.some(friend => 
      friend.friendId === detail.userId && friend.status === 'accepted'
    );
    return !isFriend && (detail.source === 'group' || detail.source === 'mixed');
  }) || [];
  
  const allBalances = balances?.details.map(detail => ({
    userId: detail.userId,
    name: detail.name,
    email: detail.email,
    balance: detail.balance,
    source: detail.source,
    groupName: detail.groupName,
    groupId: detail.groupId
  })) || [];

  // Debug log current state
  useEffect(() => {
    if (balances && friendsData.length > 0) {
      console.log('📊 useBalances: Current state:', {
        totalOwed: balances.totalOwed,
        totalOwing: balances.totalOwing,
        netBalance: balances.netBalance,
        friendCount: friends.length,
        groupMemberCount: groupMembers.length,
        totalRelationships: allBalances.length,
        friendsDataCount: friendsData.length
      });
      console.log('📊 useBalances: Friends breakdown:', friends.map(f => ({
        name: f.name,
        balance: f.balance,
        source: f.source
      })));
      console.log('📊 useBalances: Group members breakdown:', groupMembers.map(g => ({
        name: g.name,
        balance: g.balance,
        source: g.source,
        groupName: g.groupName
      })));
    }
  }, [balances, friends.length, groupMembers.length, allBalances.length, friendsData.length]);

  return {
    // Core balance data
    balances,
    isLoading,
    error,
    
    // Summary totals
    totalOwed: balances?.totalOwed ?? 0,
    totalOwing: balances?.totalOwing ?? 0,
    netBalance: balances?.netBalance ?? 0,
    
    // Categorized balances - FIXED with proper friend categorization
    friendBalances: friends,
    groupMemberBalances: groupMembers,
    allBalances,
    
    // Additional data for components
    friendsData, // So components can access friends data for proper categorization
    
    // Actions
    refresh: () => refresh(false),
    forceRefresh,
    notifyChange,
    
    // Status flags
    isEmpty: allBalances.length === 0,
    hasPositiveBalance: (balances?.totalOwed ?? 0) > 0,
    hasNegativeBalance: (balances?.totalOwing ?? 0) > 0,
    
    // Utilities for testing
    verifyCalculation: UnifiedSettlementService.verifyManualCalculation,
    calculateGroupBalance: UnifiedSettlementService.calculateGroupPairwiseBalance
  };
};

// Export specialized hooks for different components
export const useOverviewBalances = () => {
  const baseBalances = useBalances();
  
  return {
    ...baseBalances,
    // Add any overview-specific formatting here
  };
};

export const useFriendsBalances = () => {
  const baseBalances = useBalances();
  
  return {
    ...baseBalances,
    // Add any friends-specific formatting here
  };
};

export default useBalances;