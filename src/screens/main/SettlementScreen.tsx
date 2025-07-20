import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useOverviewBalances, useFriendsBalances } from '@/hooks/useBalances';
import { SplittingService } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';
import ManualSettlementModal from '@/components/modals/ManualSettlementModal';
import GroupSettlementModal from '@/components/modals/GroupSettlementModal';
import SuccessAnimationModal from '@/components/modals/SuccessAnimationModal';

interface SettlementEntry {
  id: string;
  type: 'friend' | 'group';
  name: string;
  userId?: string;
  groupId?: string;
  amount: number;
  description: string;
  isOwed: boolean; // true if they owe you, false if you owe them
}

export default function SettlementScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const overviewBalances = useOverviewBalances();
  const friendsBalances = useFriendsBalances();

  const [settlements, setSettlements] = useState<SettlementEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalOwed: 0,
    totalOwing: 0,
    netPosition: 0
  });

  // Modal states
  const [showManualSettlement, setShowManualSettlement] = useState(false);
  const [showGroupSettlement, setShowGroupSettlement] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

  // Load settlements when balances change
  useEffect(() => {
    if (!loading && (overviewBalances.allBalances.length > 0 || friendsBalances.allBalances.length > 0)) {
      loadSettlements();
    }
  }, [overviewBalances.totalOwed, overviewBalances.totalOwing, friendsBalances.totalOwed, friendsBalances.totalOwing, loading]);

  const loadSettlements = async () => {
    try {
      const settlementEntries: SettlementEntry[] = [];
      let totalOwed = 0;
      let totalOwing = 0;

      // Use the unified balance data from overviewBalances
      if (overviewBalances.allBalances && Array.isArray(overviewBalances.allBalances)) {
        for (const balance of overviewBalances.allBalances) {
          if (!balance || Math.abs(balance.balance || 0) <= 0.01) continue;

          const isOwed = (balance.balance || 0) > 0;
          const amount = Math.abs(balance.balance || 0);

          settlementEntries.push({
            id: `${balance.source}-${balance.userId}${balance.groupId ? `-${balance.groupId}` : ''}`,
            type: balance.source === 'group' ? 'group' : 'friend',
            name: balance.name || 'Unknown',
            userId: balance.source === 'friend' ? balance.userId : undefined,
            groupId: balance.source === 'group' ? balance.groupId : undefined,
            amount,
            description: balance.source === 'group' ? `Group: ${balance.groupName}` : 'Friend balance',
            isOwed
          });

          if (isOwed) {
            totalOwed += amount;
          } else {
            totalOwing += amount;
          }
        }
      }

      // Sort by amount (largest first)
      settlementEntries.sort((a, b) => b.amount - a.amount);

      setSettlements(settlementEntries);
      setSummary({
        totalOwed: parseFloat(totalOwed.toFixed(2)),
        totalOwing: parseFloat(totalOwing.toFixed(2)),
        netPosition: parseFloat((totalOwed - totalOwing).toFixed(2))
      });

      setLoading(false);

    } catch (error) {
      console.error('❌ Failed to load settlements:', error);
      // Set empty state on error
      setSettlements([]);
      setSummary({
        totalOwed: 0,
        totalOwing: 0,
        netPosition: 0
      });
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        overviewBalances.forceRefresh(),
        friendsBalances.forceRefresh()
      ]);
    } catch (error) {
      console.error('Failed to refresh settlements:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFriendSettlement = async (friendId: string, amount: number, type: 'pay' | 'request', description?: string) => {
    try {
      await SplittingService.markPaymentAsPaid(
        type === 'pay' ? user!.id : friendId,
        type === 'pay' ? friendId : user!.id,
        amount,
        undefined,
        description || 'Manual settlement'
      );

      // Force refresh both balance systems
      await Promise.all([
        overviewBalances.forceRefresh(),
        friendsBalances.forceRefresh()
      ]);
      
      setShowSuccessAnimation(true);
      setSuccessMessage({
        title: 'Settlement Recorded! 💰',
        message: `Payment of ${getCurrencySymbol(user?.currency || 'USD')}${amount.toFixed(2)} has been recorded successfully!`
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record settlement');
    }
  };

  const handleSettlementPress = (settlement: SettlementEntry) => {
    if (settlement.type === 'friend') {
      // Open friend settlement modal
      const friendData = overviewBalances.allBalances.find((b: any) => b.userId === settlement.userId);
      if (friendData) {
        setSelectedFriend({
          friendId: settlement.userId,
          friendData: { fullName: settlement.name },
          balance: settlement.isOwed ? settlement.amount : -settlement.amount
        });
        setShowManualSettlement(true);
      }
    } else {
      // Open group settlement modal
      setSelectedGroupId(settlement.groupId!);
      setShowGroupSettlement(true);
    }
  };

  const renderSettlementCard = (settlement: SettlementEntry) => {
    const currencySymbol = getCurrencySymbol(user?.currency || 'USD');
    
    return (
      <TouchableOpacity
        key={settlement.id}
        style={[
          styles.settlementCard,
          { 
            backgroundColor: theme.colors.surface,
            borderLeftColor: settlement.isOwed ? theme.colors.success : theme.colors.error,
            borderLeftWidth: 4
          }
        ]}
        onPress={() => handleSettlementPress(settlement)}
      >
        <View style={styles.settlementHeader}>
          <View style={styles.settlementInfo}>
            <View style={[styles.typeIcon, { 
              backgroundColor: settlement.type === 'friend' ? theme.colors.primary : theme.colors.secondary 
            }]}>
              <Ionicons 
                name={settlement.type === 'friend' ? 'person' : 'people'} 
                size={20} 
                color="white" 
              />
            </View>
            <View style={styles.settlementDetails}>
              <Text style={[styles.settlementName, { color: theme.colors.text }]}>
                {settlement.name}
              </Text>
              <Text style={[styles.settlementDescription, { color: theme.colors.textSecondary }]}>
                {settlement.description}
              </Text>
            </View>
          </View>
          
          <View style={styles.amountContainer}>
            <Text style={[
              styles.amountText,
              { color: settlement.isOwed ? theme.colors.success : theme.colors.error }
            ]}>
              {settlement.isOwed ? '+' : '-'}{currencySymbol}{settlement.amount.toFixed(2)}
            </Text>
            <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
              {settlement.isOwed ? 'Owes you' : 'You owe'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.settleButton,
            { backgroundColor: settlement.isOwed ? theme.colors.success : theme.colors.error }
          ]}
          onPress={() => handleSettlementPress(settlement)}
        >
          <Ionicons name="checkmark-circle" size={18} color="white" />
          <Text style={styles.settleButtonText}>
            {settlement.type === 'friend' ? 'Settle' : 'View Group'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (overviewBalances.isLoading || friendsBalances.isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading settlements...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currencySymbol = getCurrencySymbol(user?.currency || 'USD');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Settlements
        </Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading settlements...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
            Settlement Summary
          </Text>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              You will receive
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
              {currencySymbol}{summary.totalOwed.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              You will pay
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.error }]}>
              {currencySymbol}{summary.totalOwing.toFixed(2)}
            </Text>
          </View>
          
          <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabelBold, { color: theme.colors.text }]}>
              Net Position
            </Text>
            <Text style={[styles.summaryValueBold, { 
              color: summary.netPosition >= 0 ? theme.colors.success : theme.colors.error 
            }]}>
              {summary.netPosition >= 0 ? '+' : ''}
              {currencySymbol}{Math.abs(summary.netPosition).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Settlements List */}
        {settlements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              All Settled!
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No outstanding balances need to be settled.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Outstanding Balances ({settlements.length})
            </Text>
            {settlements.map(renderSettlementCard)}
          </>
        )}

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            This overview shows all your outstanding balances. Friend balances are separate from group balances. 
            Tap any item to settle that specific balance.
          </Text>
        </View>
      </ScrollView>
      )}

      {/* Modals */}
      <ManualSettlementModal
        visible={showManualSettlement}
        onClose={() => setShowManualSettlement(false)}
        friend={selectedFriend}
        userCurrency={user?.currency || 'USD'}
        onSettlement={handleFriendSettlement}
      />

      <GroupSettlementModal
        visible={showGroupSettlement}
        onClose={() => setShowGroupSettlement(false)}
        groupId={selectedGroupId}
        userCurrency={user?.currency || 'USD'}
        currentUserId={user?.id || ''}
        onRefresh={async () => {
          await Promise.all([
            overviewBalances.forceRefresh(),
            friendsBalances.forceRefresh()
          ]);
        }}
        onSettlementSuccess={(title: string, message: string) => {
          setSuccessMessage({ title, message });
          setShowSuccessAnimation(true);
        }}
      />

      <SuccessAnimationModal
        visible={showSuccessAnimation}
        onClose={() => setShowSuccessAnimation(false)}
        title={successMessage.title}
        message={successMessage.message}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 8,
  },
  settlementCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  settlementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settlementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settlementDetails: {
    flex: 1,
  },
  settlementName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settlementDescription: {
    fontSize: 12,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  amountLabel: {
    fontSize: 12,
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  settleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
