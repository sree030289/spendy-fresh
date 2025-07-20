// Fixed GroupSettlementModal.tsx - Remove duplicate sections and simplify

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useBalances } from '@/hooks/useBalances';
import { SplittingService } from '@/services/firebase/splitting';
import { Button } from '@/components/common/Button';
import { getCurrencySymbol } from '@/utils/currency';

interface DirectSettlement {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  type: 'friend_direct' | 'group_settlement' | 'mixed_settlement';
  description: string;
}

interface GroupSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string | null;
  userCurrency: string;
  currentUserId: string;
  onRefresh?: () => void;
  onSettlementSuccess?: (title: string, message: string) => void;
}

export default function GroupSettlementModal({
  visible,
  onClose,
  groupId,
  userCurrency,
  currentUserId,
  onRefresh,
  onSettlementSuccess
}: GroupSettlementModalProps) {
  const { theme } = useTheme();
  const { allBalances, calculateGroupBalance, refresh: refreshBalances, forceRefresh } = useBalances();
  
  const [settlements, setSettlements] = useState<{
    allSettlements: DirectSettlement[];
    summary: { totalToReceive: number; totalToPay: number; netPosition: number };
  }>({
    allSettlements: [],
    summary: { totalToReceive: 0, totalToPay: 0, netPosition: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [processingSettlement, setProcessingSettlement] = useState<string | null>(null);
  const [groupData, setGroupData] = useState<any>(null);

  useEffect(() => {
    if (visible && currentUserId) {
      loadSettlements();
    }
  }, [visible, currentUserId, groupId]);

  const loadSettlements = async () => {
    setLoading(true);
    try {
      console.log('🔄 Loading settlement instructions for user:', currentUserId, 'groupId:', groupId);
      
      if (groupId) {
        await loadGroupSpecificSettlements();
      } else {
        await loadGlobalSettlements();
      }
      
    } catch (error) {
      console.error('❌ Failed to load settlement instructions:', error);
      Alert.alert('Error', 'Failed to load settlement information');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupSpecificSettlements = async () => {
    if (!groupId || !calculateGroupBalance) return;

    console.log('📍 Loading GROUP-SPECIFIC settlements for group:', groupId);

    const group = await SplittingService.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    setGroupData(group);

    const allSettlements: DirectSettlement[] = [];
    let totalToReceive = 0;
    let totalToPay = 0;

    // Calculate settlements between ALL group members using GROUP-SPECIFIC balances ONLY
    for (let i = 0; i < group.members.length; i++) {
      for (let j = i + 1; j < group.members.length; j++) {
        const member1 = group.members[i];
        const member2 = group.members[j];
        
        // ALWAYS use group-specific balance calculation
        const pairwiseBalance = await calculateGroupBalance(member1.userId, member2.userId, groupId);

        console.log(`🔍 ${member1.userData.fullName} vs ${member2.userData.fullName} = ${pairwiseBalance} (GROUP-SPECIFIC ONLY)`);

        if (Math.abs(pairwiseBalance) > 0.01) {
          const settlement: DirectSettlement = {
            fromUserId: pairwiseBalance > 0 ? member2.userId : member1.userId,
            fromUserName: pairwiseBalance > 0 ? member2.userData.fullName : member1.userData.fullName,
            toUserId: pairwiseBalance > 0 ? member1.userId : member2.userId,
            toUserName: pairwiseBalance > 0 ? member1.userData.fullName : member2.userData.fullName,
            amount: Math.abs(pairwiseBalance),
            type: 'group_settlement', // Changed to group-specific
            description: `Group settlement: ${group.name}`
          };

          allSettlements.push(settlement);

          // Track current user's totals
          if (settlement.fromUserId === currentUserId) {
            totalToPay += settlement.amount;
          } else if (settlement.toUserId === currentUserId) {
            totalToReceive += settlement.amount;
          }
        }
      }
    }

    // Sort by amount (largest first)
    allSettlements.sort((a, b) => b.amount - a.amount);

    setSettlements({
      allSettlements,
      summary: {
        totalToReceive: parseFloat(totalToReceive.toFixed(2)),
        totalToPay: parseFloat(totalToPay.toFixed(2)),
        netPosition: parseFloat((totalToReceive - totalToPay).toFixed(2))
      }
    });

    console.log('✅ Group settlements loaded:', allSettlements.length, 'settlements');
  };  const loadGlobalSettlements = async () => {
    console.log('🌍 Loading GLOBAL settlements');

    const allSettlements: DirectSettlement[] = [];
    let totalToReceive = 0;
    let totalToPay = 0;

    for (const balance of allBalances) {
      if (Math.abs(balance.balance) <= 0.01) continue;

      if (balance.balance > 0) {
        // They owe you
        allSettlements.push({
          fromUserId: balance.userId,
          fromUserName: balance.name,
          toUserId: currentUserId,
          toUserName: 'You',
          amount: balance.balance,
          type: balance.source === 'friend' ? 'friend_direct' : 
                balance.source === 'group' ? 'group_settlement' : 'mixed_settlement',
          description: balance.source === 'friend' ? 'Direct friendship balance' :
                      balance.source === 'group' ? `Group expenses from: ${balance.groupName}` :
                      'Combined: friendship + groups'
        });
        totalToReceive += balance.balance;
      } else {
        // You owe them
        allSettlements.push({
          fromUserId: currentUserId,
          fromUserName: 'You',
          toUserId: balance.userId,
          toUserName: balance.name,
          amount: Math.abs(balance.balance),
          type: balance.source === 'friend' ? 'friend_direct' : 
                balance.source === 'group' ? 'group_settlement' : 'mixed_settlement',
          description: balance.source === 'friend' ? 'Direct friendship balance' :
                      balance.source === 'group' ? `Group expenses from: ${balance.groupName}` :
                      'Combined: friendship + groups'
        });
        totalToPay += Math.abs(balance.balance);
      }
    }

    // Sort by amount (largest first)
    allSettlements.sort((a, b) => b.amount - a.amount);

    setSettlements({
      allSettlements,
      summary: {
        totalToReceive: parseFloat(totalToReceive.toFixed(2)),
        totalToPay: parseFloat(totalToPay.toFixed(2)),
        netPosition: parseFloat((totalToReceive - totalToPay).toFixed(2))
      }
    });

    console.log('✅ Global settlements loaded');
  };

  const handleSettlement = async (settlement: DirectSettlement) => {
    const settlementKey = `${settlement.fromUserId}-${settlement.toUserId}`;
    setProcessingSettlement(settlementKey);

    try {
      console.log('🔄 Processing settlement:', settlement);
      
      await SplittingService.markPaymentAsPaid(
        settlement.fromUserId,
        settlement.toUserId,
        settlement.amount,
        groupId || undefined,
        `Settlement: ${settlement.description}`
      );

      console.log('✅ Settlement processed, refreshing balances...');
      
      // Force immediate refresh of balance systems
      await forceRefresh();
      
      // Also trigger any parent refresh callbacks
      onRefresh?.();
      
      // Notify ExpenseRefreshService to trigger UI updates across all components
      const ExpenseRefreshService = require('@/services/expenseRefreshService').default;
      const refreshService = ExpenseRefreshService.getInstance();
      refreshService.notifyExpenseAdded();
      
      // Wait a moment for balances to update, then reload settlements
      await new Promise(resolve => setTimeout(resolve, 1200));
      await loadSettlements();
      
      // Close modal after everything is updated
      onClose();
      
      // Show full screen success animation
      setTimeout(() => {
        if (onSettlementSuccess) {
          onSettlementSuccess(
            'Payment Recorded! 💰',
            `Settlement of ${getCurrencySymbol(userCurrency)}${settlement.amount.toFixed(2)} has been recorded successfully!`
          );
        } else {
          Alert.alert('Success', 'Payment marked as paid successfully!');
        }
      }, 200);
      
    } catch (error: any) {
      console.error('❌ Settlement processing error:', error);
      Alert.alert('Error', error.message || 'Failed to process settlement');
    } finally {
      setProcessingSettlement(null);
    }
  };

  const confirmSettlement = (settlement: DirectSettlement) => {
    const isCurrentUserPaying = settlement.fromUserId === currentUserId;
    
    let message = '';
    if (isCurrentUserPaying) {
      message = `Mark your payment of ${userCurrency} ${settlement.amount.toFixed(2)} to ${settlement.toUserName} as paid?`;
    } else {
      message = `Mark ${settlement.fromUserName}'s payment of ${userCurrency} ${settlement.amount.toFixed(2)} to you as paid?`;
    }

    Alert.alert('Confirm Settlement', message, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Mark as Paid', 
        onPress: () => handleSettlement(settlement)
      }
    ]);
  };

  const renderSettlement = (settlement: DirectSettlement, index: number) => {
    const settlementKey = `${settlement.fromUserId}-${settlement.toUserId}`;
    const isProcessing = processingSettlement === settlementKey;
    const isCurrentUserInvolved = settlement.fromUserId === currentUserId || settlement.toUserId === currentUserId;

    return (
      <View key={index} style={[styles.settlementCard, { 
        backgroundColor: theme.colors.surface,
        borderColor: isCurrentUserInvolved ? theme.colors.primary : theme.colors.border,
        borderWidth: 1,
        opacity: !isCurrentUserInvolved ? 0.7 : 1
      }]}>
        <View style={styles.settlementHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.userAvatar, { 
              backgroundColor: settlement.fromUserId === currentUserId ? theme.colors.error : theme.colors.primary 
            }]}>
              <Text style={styles.userAvatarText}>
                {settlement.fromUserName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {settlement.fromUserId === currentUserId ? 'You' : settlement.fromUserName}
            </Text>
          </View>

          <View style={styles.arrowContainer}>
            <Ionicons 
              name="arrow-forward" 
              size={20} 
              color={settlement.fromUserId === currentUserId ? theme.colors.error : theme.colors.success} 
            />
            <Text style={[styles.amountText, { 
              color: settlement.fromUserId === currentUserId ? theme.colors.error : theme.colors.success 
            }]}>
              {getCurrencySymbol(userCurrency)} {settlement.amount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <View style={[styles.userAvatar, { 
              backgroundColor: settlement.toUserId === currentUserId ? theme.colors.success : theme.colors.primary 
            }]}>
              <Text style={styles.userAvatarText}>
                {settlement.toUserName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {settlement.toUserId === currentUserId ? 'You' : settlement.toUserName}
            </Text>
          </View>
        </View>

        <View style={styles.settlementDetails}>
          <Text style={[styles.settlementDescription, { color: theme.colors.textSecondary }]}>
            {settlement.description}
          </Text>
          <Text style={[styles.settlementType, { color: theme.colors.textSecondary }]}>
            Type: {settlement.type.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {/* Only show settlement button for current user's settlements */}
        {isCurrentUserInvolved && (
          <TouchableOpacity
            style={[styles.settleButton, { 
              backgroundColor: settlement.fromUserId === currentUserId ? theme.colors.error : theme.colors.success,
              opacity: isProcessing ? 0.6 : 1
            }]}
            onPress={() => confirmSettlement(settlement)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="white" />
                <Text style={styles.settleButtonText}>Mark as Paid</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const hasSettlements = settlements.allSettlements.length > 0;
  const isGroupSpecific = !!groupId;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {isGroupSpecific ? `${groupData?.name || 'Group'} Settlement` : 'All Settlements'}
          </Text>
          <TouchableOpacity onPress={loadSettlements} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Calculating settlement instructions...
              </Text>
            </View>
          ) : !hasSettlements ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                All Settled!
              </Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {isGroupSpecific 
                  ? `No outstanding balances in ${groupData?.name || 'this group'}.`
                  : 'No outstanding balances need to be settled.'
                }
              </Text>
            </View>
          ) : (
            <>
              {/* Summary Card */}
              <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
                  {isGroupSpecific ? `${groupData?.name || 'Group'} Summary` : 'Settlement Summary'}
                </Text>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                    You will receive
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
                    {getCurrencySymbol(userCurrency)}{settlements.summary.totalToReceive.toFixed(2)}
                  </Text>
                </View>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                    You will pay
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.colors.error }]}>
                    {getCurrencySymbol(userCurrency)}{settlements.summary.totalToPay.toFixed(2)}
                  </Text>
                </View>
                
                <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabelBold, { color: theme.colors.text }]}>
                    Net Position
                  </Text>
                  <Text style={[styles.summaryValueBold, { 
                    color: settlements.summary.netPosition >= 0 ? theme.colors.success : theme.colors.error 
                  }]}>
                    {settlements.summary.netPosition >= 0 ? '+' : ''}
                    {getCurrencySymbol(userCurrency)}{Math.abs(settlements.summary.netPosition).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* All Settlements - Single Section */}
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                All Settlements ({settlements.allSettlements.length})
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
                {isGroupSpecific
                  ? `Complete overview of who owes whom in ${groupData?.name || 'this group'}`
                  : 'All your outstanding balances across friends and groups'
                }
              </Text>
              {settlements.allSettlements.map((settlement, index) => 
                renderSettlement(settlement, index)
              )}
            </>
          )}

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              {isGroupSpecific
                ? `These settlements are specific to the ${groupData?.name || 'group'} and show balances between group members only.`
                : 'These settlement instructions show all your balances across friends and groups.'
              }
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryValueBold: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  settlementCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  settlementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  arrowContainer: {
    alignItems: 'center',
    flex: 1,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  settlementDetails: {
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  settlementDescription: {
    fontSize: 14,
    marginBottom: 4,
    textAlign: 'center',
  },
  settlementType: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  settleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});