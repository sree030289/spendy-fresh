// src/hooks/useBalances.ts - COMPLETE SELF-CONTAINED VERSION
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { ApiService } from '@/services/api/ApiService';

// Define Friend interface locally to avoid external dependencies
interface Friend {
  id: string;
  userId: string;
  friendId: string;
  friendData: {
    id: string;
    fullName: string;
    email: string;
    mobile?: string;
    avatar?: string;
    profilePicture?: string;
  };
  status: 'pending' | 'accepted' | 'blocked' | 'invited';
  balance: number;
  lastActivity: Date;
  createdAt: Date;
}

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
      const apiService = ApiService.getInstance();
      const [friends, userGroups] = await Promise.all([
        apiService.getFriends(),
        apiService.getUserGroups()
      ]);

      // Ensure we have arrays to work with
      const safeFriends = Array.isArray(friends) ? friends : [];
      const safeGroups = Array.isArray(userGroups) ? userGroups : [];

      const balanceMap = new Map<string, BalanceDetail>();
      let totalOwed = 0;
      let totalOwing = 0;

      // PHASE 1: Process direct friendships
      console.log(`Processing ${safeFriends.length} friendships`);
      for (const friend of safeFriends) {
        if (friend.status === 'accepted' && Math.abs(friend.balance) > 0.01) {
          const balance: BalanceDetail = {
            userId: friend.friendId,
            name: friend.friendData.fullName,
            email: friend.friendData.email,
            avatar: friend.friendData.avatar,
            balance: friend.balance, // Direct from friendship (includes group expenses)
            source: 'friend',
            lastUpdated: friend.lastActivity || friend.createdAt,
            breakdown: {
              fromFriendships: friend.balance, // This already includes group expenses
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

      // OPTIMIZED PHASE 2: Process group relationships with caching
      const friendUserIds = new Set(safeFriends.map(f => f.friendId));
      const allGroupMembersMap = new Map<string, { name: string; email: string; avatar?: string; groups: Array<{id: string; name: string}> }>();
      
      console.log(`Processing ${safeGroups.length} groups (optimized)`);

      // OPTIMIZED: Single pass collection with early filtering
      const relevantGroups = safeGroups.filter(group => group.members.length > 1);
      for (const group of relevantGroups) {
        const relevantMembers = group.members.filter((member: any) => 
          (member.userId || member.id) !== userId
        );
        
        for (const member of relevantMembers) {
          const memberId = member.userId || member.id;
          if (!allGroupMembersMap.has(memberId)) {
            allGroupMembersMap.set(memberId, {
              name: member.userData?.fullName || member.fullName || member.name || 'Unknown',
              email: member.userData?.email || member.email || '',
              avatar: member.userData?.avatar || member.avatar || '',
              groups: []
            });
          }
          
          allGroupMembersMap.get(memberId)!.groups.push({
            id: group.id,
            name: group.name
          });
        }
      }

      // OPTIMIZED: Batch process group balance calculations
      const groupCalculationPromises = [];
      
      for (const group of relevantGroups) {
        console.log(`Processing group: ${group.name} with ${group.members.length} members`);
        
        const nonFriendMembers = group.members.filter((member: any) => {
          const memberId = member.userId || member.id;
          return memberId !== userId && !friendUserIds.has(memberId);
        });
        
        // Process non-friend members in batches
        for (const member of nonFriendMembers) {
          const memberId = member.userId || member.id;
          
          groupCalculationPromises.push(
            this.calculateGroupPairwiseBalance(userId, memberId, group.id)
              .then(groupBalance => ({ memberId, groupBalance, group, member }))
              .catch(error => {
                console.error(`Error calculating balance for ${group.name}:`, error);
                return { memberId, groupBalance: 0, group, member };
              })
          );
        }
      }
      
      // Process all group calculations in parallel with concurrency limit
      const CONCURRENCY_LIMIT = 5;
      const results = [];
      for (let i = 0; i < groupCalculationPromises.length; i += CONCURRENCY_LIMIT) {
        const batch = groupCalculationPromises.slice(i, i + CONCURRENCY_LIMIT);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
      }
      
      // Process the results
      for (const { memberId, groupBalance, group } of results) {

        if (Math.abs(groupBalance) < 0.01) continue;
        
        const existingBalance = balanceMap.get(memberId);
          if (existingBalance) {
            // User is BOTH a friend AND in groups with this person
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
          const memberInfo = allGroupMembersMap.get(memberId);
          if (!memberInfo) {
            console.warn(`Member info not found for userId: ${memberId}`);
            continue;
          }
          const existingGroupBalance = balanceMap.get(memberId);
            
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
                userId: memberId,
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

              balanceMap.set(memberId, balance);

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
    
    // Use API service instead of Firebase for consistency
    const apiService = ApiService.getInstance();
    
    // CRITICAL FIX: Use backend settlement calculation that accounts for settlement records
    // Instead of doing frontend calculation with only expenses
    try {
      console.log(`🔄 Using backend settlement calculation (includes settlement records)...`);
      const settlementData = await apiService.getGroupSettlements(groupId);
      
      if (settlementData?.settlements && Array.isArray(settlementData.settlements)) {
        // Find the settlement that involves both users
        const relevantSettlement = settlementData.settlements.find((settlement: any) => 
          (settlement.from === userId1 && settlement.to === userId2) ||
          (settlement.from === userId2 && settlement.to === userId1)
        );
        
        if (relevantSettlement) {
          // Return the balance from backend calculation (which includes settlement records)
          const balance = relevantSettlement.from === userId1 ? relevantSettlement.amount : -relevantSettlement.amount;
          console.log(`💰 Backend settlement balance: ${balance}`);
          console.log(`💭 Interpretation: ${balance > 0 ? 'User2 owes User1' : balance < 0 ? 'User1 owes User2' : 'No balance'}`);
          console.log(`===============================\n`);
          return balance;
        } else {
          console.log(`✅ No settlement needed between these users`);
          console.log(`===============================\n`);
          return 0;
        }
      } else {
        console.log(`✅ No settlements found - balance should be 0`);
        console.log(`===============================\n`);
        return 0;
      }
    } catch (error) {
      console.error('❌ Failed to get settlement data from backend, falling back to frontend calculation:', error);
      
      // Fallback to frontend calculation if backend fails
      return this.calculateGroupPairwiseBalanceFrontend(userId1, userId2, groupId);
    }
  } catch (error) {
    console.error('❌ Calculate group pairwise balance error:', error);
    return 0;
  }
}

/**
 * Frontend fallback calculation (original logic)
 */
static async calculateGroupPairwiseBalanceFrontend(
  userId1: string, 
  userId2: string, 
  groupId: string
): Promise<number> {
  try {
    console.log(`\n🔍 === FRONTEND FALLBACK BALANCE CALCULATION ===`);
    console.log(`👤 User1 (You): ${userId1}`);
    console.log(`👤 User2 (Them): ${userId2}`);
    console.log(`🏢 Group: ${groupId}`);
    
    // Use API service instead of Firebase for consistency
    const apiService = ApiService.getInstance();
    
    // Get group data and expenses
    const [group, expenses] = await Promise.all([
      apiService.getGroup(groupId),
      apiService.getGroupExpenses(groupId)
    ]);
    
    console.log(`👥 Group has ${group.members.length} members`);
    
    if (expenses.length === 0) {
      console.log(`✅ No expenses found - balance should be 0`);
      return 0;
    }
    
    let balance = 0;
    let expenseCount = 0;

    expenses.forEach((expense, index) => {
      console.log(`\n🔍 RAW EXPENSE ${index + 1} DATA:`, {
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        paidBy: expense.paidBy,
        splitType: expense.splitType,
        splitData: expense.splitData,
        splitDetails: (expense as any).splitDetails,
        splits: (expense as any).splits,
        members: (expense as any).members,
        participants: (expense as any).participants,
        // Let's see ALL properties
        allProperties: Object.keys(expense),
        fullExpenseObject: expense
      });
      
      // Skip settlement transactions
      if (expense.isSettlementTransaction) {
        console.log(`⏭️  Expense ${index + 1}: SKIPPED (settlement) - ${expense.description}`);
        return;
      }

      expenseCount++;
      console.log(`\n💰 Expense ${expenseCount}: "${expense.description}"`);
      console.log(`💵 Amount: ${expense.amount}`);
      console.log(`💳 Paid by: ${expense.paidBy}`);
      
      // Handle both splitData and splitDetails property names for compatibility
      // Prioritize 'splits' first since that's what Firebase functions store
      const splits = (expense as any).splits || expense.splitDetails || expense.splitData || [];
      
      // Let's log what split-related properties exist
      console.log(`🔍 Split properties check:`, {
        hasSplitData: !!expense.splitData,
        hasSplitDetails: !!expense.splitDetails,
        hasSplits: !!(expense as any).splits,
        hasMembers: !!(expense as any).members,
        hasParticipants: !!(expense as any).participants,
        splitDataValue: expense.splitData,
        splitDetailsValue: expense.splitDetails,
        splitsValue: (expense as any).splits,
        splitType: expense.splitType,
        actualSplitsUsed: splits,
        actualSplitsLength: splits?.length || 0
      });
      
      // Handle expenses without split details - need to determine actual participants
      if (!splits || !Array.isArray(splits) || splits.length === 0) {
        console.log(`⚠️  Expense has no split data - determining participants: ${expense.description}`);
        
        // For equal split expenses without split data, we need to determine who was actually involved
        if (expense.splitType === 'equal' || !expense.splitType) {
          console.log(`🎯 Equal split expense without split details: ${expense.description}`);
          
          // For equal split without splitData, use the current group member count
          // This assumes all current members were involved in the expense
          let actualParticipantCount = group.members.length;
          console.log(`👥 Using group member count for participant count: ${actualParticipantCount}`);
          
          const shareAmount = parseFloat((expense.amount / actualParticipantCount).toFixed(2));
          
          let expenseBalance = 0;
          
          if (expense.paidBy === userId1) {
            // User1 paid - User2 owes their share
            console.log(`➕ User2 owes User1 (equal split ${actualParticipantCount}-way): ${shareAmount}`);
            expenseBalance += shareAmount;
          } else if (expense.paidBy === userId2) {
            // User2 paid - User1 owes their share
            console.log(`➖ User1 owes User2 (equal split ${actualParticipantCount}-way): ${shareAmount}`);
            expenseBalance -= shareAmount;
          } else {
            // Someone else paid - both users owe their share to that person
            // In pairwise calculation, this doesn't affect User1 vs User2 balance
            console.log(`👥 Third party paid - no net impact on User1 vs User2 balance`);
            expenseBalance = 0;
          }
          
          balance += expenseBalance;
          console.log(`📊 Equal split expense balance: ${expenseBalance}`);
          console.log(`📊 Running total: ${balance}`);
          return; // Continue to next expense
          
        } else if (expense.splitType === 'custom') {
          console.log(`🎯 Custom split expense without split details: ${expense.description}`);
          
          // For custom split without split details, treat as equal split
          // This is a reasonable fallback assumption
          console.log(`💡 Treating custom split as equal split due to missing splitData`);
          
          let actualParticipantCount = group.members.length;
          console.log(`👥 Using group member count for participant count: ${actualParticipantCount}`);
          
          const shareAmount = parseFloat((expense.amount / actualParticipantCount).toFixed(2));
          
          let expenseBalance = 0;
          
          if (expense.paidBy === userId1) {
            // User1 paid - User2 owes their share
            console.log(`➕ User2 owes User1 (custom→equal split ${actualParticipantCount}-way): ${shareAmount}`);
            expenseBalance += shareAmount;
          } else if (expense.paidBy === userId2) {
            // User2 paid - User1 owes their share
            console.log(`➖ User1 owes User2 (custom→equal split ${actualParticipantCount}-way): ${shareAmount}`);
            expenseBalance -= shareAmount;
          } else {
            // Someone else paid - both users owe their share to that person
            // In pairwise calculation, this doesn't affect User1 vs User2 balance
            console.log(`👥 Third party paid - no net impact on User1 vs User2 balance`);
            expenseBalance = 0;
          }
          
          balance += expenseBalance;
          console.log(`📊 Custom split expense balance: ${expenseBalance}`);
          console.log(`📊 Running total: ${balance}`);
          return;
          
        } else {
          console.log(`⚠️  Unknown split type: ${expense.splitType} - skipping expense`);
          return; // Skip unknown split types
        }
      }
      
      console.log(`📊 Split data:`, splits.map((s: any) => `${s.userId}: ${s.amount} (paid: ${s.isPaid || s.isSettled || false})`));

      let expenseBalance = 0;

      // Case 1: userId1 paid, userId2 has a split
      if (expense.paidBy === userId1) {
        const user2Split = splits.find((split: any) => split.userId === userId2);
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
        const user1Split = splits.find((split: any) => split.userId === userId1);
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
   * Calculate settlement-specific balance entries - includes groups even for friends
   * This is different from calculateUserBalances which avoids double-counting
   */
  static async calculateSettlementBalances(userId: string): Promise<BalanceDetail[]> {
    try {
      console.log('🔄 Calculating SETTLEMENT balances for user:', userId);

      // Get all relationships and group data
      const apiService = ApiService.getInstance();
      const [friends, userGroups] = await Promise.all([
        apiService.getFriends(),
        apiService.getUserGroups()
      ]);

      // Ensure we have arrays to work with
      const safeFriends = Array.isArray(friends) ? friends : [];
      const safeGroups = Array.isArray(userGroups) ? userGroups : [];

      const balanceMap = new Map<string, BalanceDetail>();

      // PHASE 1: Process direct friendships
      console.log(`Processing ${safeFriends.length} friendships for settlement`);
      for (const friend of safeFriends) {
        if (friend.status === 'accepted' && Math.abs(friend.balance) > 0.01) {
          const balance: BalanceDetail = {
            userId: friend.friendId,
            name: friend.friendData.fullName,
            email: friend.friendData.email,
            avatar: friend.friendData.avatar,
            balance: friend.balance,
            source: 'friend',
            lastUpdated: friend.lastActivity || friend.createdAt,
            breakdown: {
              fromFriendships: friend.balance,
              fromGroups: {}
            }
          };

          balanceMap.set(`friend-${friend.friendId}`, balance);
        }
      }

      // PHASE 2: Process ALL group relationships (including friends)
      console.log(`Processing ${safeGroups.length} groups for settlement`);
      
      for (const group of safeGroups) {
        console.log(`Processing settlement balances for group: ${group.name} with ${group.members.length} members`);
        
        for (const member of group.members) {
          if (member.userId === userId) continue;

          // Calculate group balance for ALL members (including friends)
          const groupBalance = await UnifiedSettlementService.calculateGroupPairwiseBalance(
            userId, 
            member.userId, 
            group.id
          );

          if (Math.abs(groupBalance) > 0.01) {
            // Create a separate group balance entry
            const groupBalanceEntry: BalanceDetail = {
              userId: member.userId,
              name: member.userData?.fullName || member.fullName || member.name || 'Unknown',
              email: member.userData?.email || member.email || '',
              avatar: member.userData?.avatar || member.avatar || '',
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

            // Use unique key for group balances
            balanceMap.set(`group-${group.id}-${member.userId}`, groupBalanceEntry);
            
            console.log(`💰 Settlement: ${member.userData?.fullName || member.fullName || 'Unknown'} in ${group.name}: ${groupBalance}`);
          }
        }
      }

      const balanceDetails = Array.from(balanceMap.values());

      console.log('✅ SETTLEMENT balance calculation complete:', {
        totalEntries: balanceDetails.length,
        friendEntries: balanceDetails.filter(b => b.source === 'friend').length,
        groupEntries: balanceDetails.filter(b => b.source === 'group').length
      });

      return balanceDetails;

    } catch (error) {
      console.error('❌ Calculate settlement balances error:', error);
      return [];
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

  // OPTIMIZED: Add caching and debouncing to prevent excessive API calls
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const CACHE_DURATION = 30000; // 30 seconds cache
  
  const refresh = useCallback(async (force: boolean = false) => {
    if (!user?.id) return;
    
    // Check if we should skip refresh due to caching
    const now = Date.now();
    if (!force && (now - lastRefreshTime) < CACHE_DURATION) {
      console.log('⏭️ useBalances: Skipping refresh due to cache');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 useBalances: Refreshing with UnifiedSettlementService');
      
      // Load friends data and balances in parallel
      const apiService = ApiService.getInstance();
      const [freshBalances, friendsResult] = await Promise.all([
        UnifiedSettlementService.calculateUserBalances(user.id),
        apiService.getFriends()
      ]);
      
      setBalances(freshBalances);
      setFriendsData(friendsResult);
      setLastRefreshTime(now);
      
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
  }, [user?.id, lastRefreshTime]);

  const forceRefresh = useCallback(() => refresh(true), [refresh]);

  const notifyChange = useCallback(() => {
    console.log('🔔 useBalances: Balance change notification received');
    refresh();
  }, [refresh]);

  // Register as listener for balance change notifications
  useEffect(() => {
    const ExpenseRefreshService = require('@/services/expenseRefreshService').default;
    const refreshService = ExpenseRefreshService.getInstance();
    
    // Register this hook as a listener for balance changes
    const unsubscribe = refreshService.addListener(notifyChange);
    
    console.log('📡 useBalances: Registered for balance change notifications');
    
    // Cleanup listener on unmount
    return () => {
      console.log('📡 useBalances: Unregistered from balance change notifications');
      unsubscribe();
    };
  }, [notifyChange]);

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

  // OPTIMIZED: Memoize expensive filtering operations with better performance
  const friendIds = useMemo(() => new Set(
    friendsData
      .filter(friend => friend.status === 'accepted')
      .map(friend => friend.friendId)
  ), [friendsData]);
  
  const friends = useMemo(() => {
    if (!balances?.details) return [];
    return balances.details.filter(detail => friendIds.has(detail.userId));
  }, [balances?.details, friendIds]);
  
  const groupMembers = useMemo(() => {
    if (!balances?.details) return [];
    return balances.details.filter(detail => 
      !friendIds.has(detail.userId) && (detail.source === 'group' || detail.source === 'mixed')
    );
  }, [balances?.details, friendIds]);
  
  const allBalances = useMemo(() => {
    if (!balances?.details) return [];
    return balances.details.map(detail => ({
      userId: detail.userId,
      name: detail.name,
      email: detail.email,
      balance: detail.balance,
      source: detail.source,
      groupName: detail.groupName,
      groupId: detail.groupId,
      breakdown: detail.breakdown
    }));
  }, [balances?.details]);

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

  return useMemo(() => ({
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
    calculateGroupBalance: UnifiedSettlementService.calculateGroupPairwiseBalance,
    calculateSettlementBalances: UnifiedSettlementService.calculateSettlementBalances
  }), [
    balances,
    isLoading,
    error,
    friends,
    groupMembers,
    allBalances,
    friendsData,
    refresh,
    forceRefresh,
    notifyChange
  ]);
};

// REMOVED: Specialized hooks moved to end of file to prevent duplicate exports

// PERFORMANCE FIX: Create a singleton instance to prevent multiple calculations
let balanceHookInstance: any = null;
let balanceHookSubscribers = 0;

// Export specialized hooks for different components
export const useOverviewBalances = () => {
  // Use the same base instance to prevent duplicate calculations
  const baseBalances = useBalances();
  
  return useMemo(() => ({
    ...baseBalances,
    // Add any overview-specific formatting here
  }), [baseBalances]);
};

export const useFriendsBalances = () => {
  // Use the same base instance to prevent duplicate calculations
  const baseBalances = useBalances();
  
  return useMemo(() => ({
    ...baseBalances,
    // Add any friends-specific formatting here
  }), [baseBalances]);
};

export default useBalances;

// Export UnifiedSettlementService for external use
export { UnifiedSettlementService };