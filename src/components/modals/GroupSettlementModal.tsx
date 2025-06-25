// src/components/modals/GroupSettlementModal.tsx - GROUP-SPECIFIC VERSION
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
  groupId: string | null; // If null, show global settlements. If groupId, show group-specific
  userCurrency: string;
  currentUserId: string;
  onRefresh?: () => void;
}

export default function GroupSettlementModal({
  visible,
  onClose,
  groupId,
  userCurrency,
  currentUserId,
  onRefresh
}: GroupSettlementModalProps) {
  const { theme } = useTheme();
  const { allBalances, calculateGroupBalance, refresh: refreshBalances } = useBalances();
  
  const [settlements, setSettlements] = useState<{
    youWillReceive: DirectSettlement[];
    youWillPay: DirectSettlement[];
    summary: { totalToReceive: number; totalToPay: number; netPosition: number };
  }>({
    youWillReceive: [],
    youWillPay: [],
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
        // GROUP-SPECIFIC SETTLEMENTS
        await loadGroupSpecificSettlements();
      } else {
        // GLOBAL SETTLEMENTS (all relationships)
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

    // Get group data
    const group = await SplittingService.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    setGroupData(group);

    const youWillReceive: DirectSettlement[] = [];
    const youWillPay: DirectSettlement[] = [];
    let totalToReceive = 0;
    let totalToPay = 0;

    // Calculate pairwise balances with each group member
    for (const member of group.members) {
      if (member.userId === currentUserId) continue;

      const pairwiseBalance = await calculateGroupBalance(currentUserId, member.userId, groupId);
      
      console.log(`Group balance: ${currentUserId} vs ${member.userId} = ${pairwiseBalance}`);

      if (Math.abs(pairwiseBalance) > 0.01) {
        if (pairwiseBalance > 0) {
          // They owe you
          youWillReceive.push({
            fromUserId: member.userId,
            fromUserName: member.userData.fullName,
            toUserId: currentUserId,
            toUserName: 'You',
            amount: pairwiseBalance,
            type: 'group_settlement',
            description: `Group expenses from: ${group.name}`
          });
          totalToReceive += pairwiseBalance;
        } else {
          // You owe them
          youWillPay.push({
            fromUserId: currentUserId,
            fromUserName: 'You',
            toUserId: member.userId,
            toUserName: member.userData.fullName,
            amount: Math.abs(pairwiseBalance),
            type: 'group_settlement',
            description: `Group expenses from: ${group.name}`
          });
          totalToPay += Math.abs(pairwiseBalance);
        }
      }
    }

    // Sort by amount (largest first)
    youWillReceive.sort((a, b) => b.amount - a.amount);
    youWillPay.sort((a, b) => b.amount - a.amount);

    setSettlements({
      youWillReceive,
      youWillPay,
      summary: {
        totalToReceive: parseFloat(totalToReceive.toFixed(2)),
        totalToPay: parseFloat(totalToPay.toFixed(2)),
        netPosition: parseFloat((totalToReceive - totalToPay).toFixed(2))
      }
    });

    console.log('✅ Group-specific settlements loaded:', {
      groupName: group.name,
      toReceive: youWillReceive.length,
      toPay: youWillPay.length,
      netPosition: (totalToReceive - totalToPay).toFixed(2)
    });
  };

  const loadGlobalSettlements = async () => {
    console.log('🌍 Loading GLOBAL settlements (all relationships)');

    const youWillReceive: DirectSettlement[] = [];
    const youWillPay: DirectSettlement[] = [];
    let totalToReceive = 0;
    let totalToPay = 0;

    for (const balance of allBalances) {
      if (Math.abs(balance.balance) <= 0.01) continue;

      if (balance.balance > 0) {
        // They owe you
        youWillReceive.push({
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
        youWillPay.push({
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
    youWillReceive.sort((a, b) => b.amount - a.amount);
    youWillPay.sort((a, b) => b.amount - a.amount);

    setSettlements({
      youWillReceive,
      youWillPay,
      summary: {
        totalToReceive: parseFloat(totalToReceive.toFixed(2)),
        totalToPay: parseFloat(totalToPay.toFixed(2)),
        netPosition: parseFloat((totalToReceive - totalToPay).toFixed(2))
      }
    });

    console.log('✅ Global settlements loaded:', {
      toReceive: youWillReceive.length,
      toPay: youWillPay.length,
      netPosition: (totalToReceive - totalToPay).toFixed(2)
    });
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

      Alert.alert('Success', 'Payment marked as paid successfully!');
      
      // Refresh settlement data
      await loadSettlements();
      
      // Refresh the unified balance system
      refreshBalances();
      
      // Notify parent to refresh
      onRefresh?.();
      
    } catch (error: any) {
      console.error('❌ Settlement processing error:', error);
      Alert.alert('Error', error.message || 'Failed to process settlement');
    } finally {
      setProcessingSettlement(null);
    }
  };

  const confirmSettlement = (settlement: DirectSettlement) => {
    const isCurrentUserPaying = settlement.fromUserId === currentUserId;
    
    let title = 'Confirm Settlement';
    let message = `Mark payment of ${userCurrency} ${settlement.amount.toFixed(2)} from ${settlement.fromUserName} to ${settlement.toUserName} as paid?`;
    
    if (isCurrentUserPaying) {
      message = `Mark your payment of ${userCurrency} ${settlement.amount.toFixed(2)} to ${settlement.toUserName} as paid?`;
    } else {
      message = `Mark ${settlement.fromUserName}'s payment of ${userCurrency} ${settlement.amount.toFixed(2)} to you as paid?`;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Mark as Paid', 
        onPress: () => handleSettlement(settlement)
      }
    ]);
  };

  const renderSettlement = (settlement: DirectSettlement, index: number, isReceiving: boolean) => {
    const settlementKey = `${settlement.fromUserId}-${settlement.toUserId}`;
    const isProcessing = processingSettlement === settlementKey;
    const isCurrentUserInvolved = settlement.fromUserId === currentUserId || settlement.toUserId === currentUserId;

    return (
      <View key={index} style={[styles.settlementCard, { 
        backgroundColor: theme.colors.surface,
        borderColor: isCurrentUserInvolved ? theme.colors.primary : theme.colors.border,
        borderWidth: 1
      }]}>
        <View style={styles.settlementHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.userAvatar, { 
              backgroundColor: isReceiving ? theme.colors.success : theme.colors.primary 
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
              color={isReceiving ? theme.colors.success : theme.colors.error} 
            />
            <Text style={[styles.amountText, { 
              color: isReceiving ? theme.colors.success : theme.colors.error 
            }]}>
              {userCurrency} {settlement.amount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <View style={[styles.userAvatar, { 
              backgroundColor: isReceiving ? theme.colors.primary : theme.colors.success 
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

        <TouchableOpacity
          style={[styles.settleButton, { 
            backgroundColor: isReceiving ? theme.colors.success : theme.colors.primary,
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
      </View>
    );
  };

  const hasSettlements = settlements.youWillReceive.length > 0 || settlements.youWillPay.length > 0;
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

              {/* You Will Receive */}
              {settlements.youWillReceive.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    You Will Receive ({settlements.youWillReceive.length})
                  </Text>
                  {settlements.youWillReceive.map((settlement, index) => 
                    renderSettlement(settlement, index, true)
                  )}
                </>
              )}

              {/* You Will Pay */}
              {settlements.youWillPay.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    You Will Pay ({settlements.youWillPay.length})
                  </Text>
                  {settlements.youWillPay.map((settlement, index) => 
                    renderSettlement(settlement, index, false)
                  )}
                </>
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
    marginBottom: 16,
    marginTop: 8,
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