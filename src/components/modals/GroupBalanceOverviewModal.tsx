import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { SplittingService } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';

const { width, height } = Dimensions.get('window');

interface GroupBalanceOverviewModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  currency: string;
  balanceData?: any;
}

export default function GroupBalanceOverviewModal({
  visible,
  onClose,
  groupId,
  groupName,
  currency,
  balanceData
}: GroupBalanceOverviewModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [settlementSuggestions, setSettlementSuggestions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'relationships' | 'suggestions'>('relationships');

  useEffect(() => {
    if (visible && groupId) {
      loadBalanceOverview();
    }
  }, [visible, groupId]);

  const loadBalanceOverview = async () => {
    try {
      setLoading(true);
      
      // Use provided balance data or fetch fresh data
      const overview = balanceData || await SplittingService.getGroupBalanceOverview(groupId);
      const suggestions = await SplittingService.getGroupSettlementSuggestions(groupId);
      
      setOverviewData(overview);
      setSettlementSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load balance overview:', error);
      Alert.alert('Error', 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  };

  const handleSettlement = async (fromUserId: string, toUserId: string, amount: number) => {
    try {
      Alert.alert(
        'Confirm Settlement',
        `Mark ${getCurrencySymbol(currency)}${amount.toFixed(2)} as paid?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              try {
                // Analyze impact first
                const impact = await SplittingService.analyzeCrossGroupSettlementImpact(
                  fromUserId,
                  toUserId,
                  amount
                );
                
                Alert.alert(
                  'Settlement Impact',
                  impact.summary,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Proceed',
                      onPress: async () => {
                        await SplittingService.markPaymentAsPaid(
                          fromUserId,
                          toUserId,
                          amount,
                          groupId,
                          `Settlement in ${groupName}`
                        );
                        
                        // Refresh data
                        await loadBalanceOverview();
                        Alert.alert('Success', 'Settlement recorded successfully!');
                      }
                    }
                  ]
                );
              } catch (error) {
                console.error('Settlement error:', error);
                Alert.alert('Error', 'Failed to process settlement');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Settlement confirmation error:', error);
    }
  };

  const renderRelationshipCard = (relationship: any, index: number) => (
    <View key={index} style={[styles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.relationshipHeader}>
        <View style={styles.memberInfo}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>
              {relationship.memberName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.memberName, { color: theme.colors.text }]}>
              {relationship.memberName}
            </Text>
            <Text style={[styles.memberEmail, { color: theme.colors.textSecondary }]}>
              {relationship.memberEmail}
            </Text>
          </View>
        </View>
        
        <View style={styles.balanceContainer}>
          <Text style={[
            styles.balanceAmount,
            { color: relationship.balance > 0 ? '#10B981' : relationship.balance < 0 ? '#EF4444' : theme.colors.textSecondary }
          ]}>
            {relationship.balance > 0 ? '+' : ''}
            {getCurrencySymbol(currency)}{Math.abs(relationship.balance).toFixed(2)}
          </Text>
          <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
            {relationship.balance > 0 ? 'You are owed' : relationship.balance < 0 ? 'You owe' : 'Settled'}
          </Text>
        </View>
      </View>
      
      <View style={styles.relationshipDetails}>
        <Text style={[styles.otherMemberTitle, { color: theme.colors.text }]}>
          vs {relationship.otherMemberName}:
        </Text>
        <Text style={[
          styles.relationshipBalance,
          { color: relationship.balance > 0 ? '#10B981' : relationship.balance < 0 ? '#EF4444' : theme.colors.textSecondary }
        ]}>
          {relationship.balance > 0 
            ? `${relationship.otherMemberName} owes you ${getCurrencySymbol(currency)}${Math.abs(relationship.balance).toFixed(2)}`
            : relationship.balance < 0 
            ? `You owe ${relationship.otherMemberName} ${getCurrencySymbol(currency)}${Math.abs(relationship.balance).toFixed(2)}`
            : 'All settled up! 🎉'
          }
        </Text>
      </View>
    </View>
  );

  const renderSettlementSuggestion = (suggestion: any, index: number) => (
    <View key={index} style={[styles.suggestionCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.suggestionHeader}>
        <View style={styles.suggestionInfo}>
          <Text style={[styles.suggestionText, { color: theme.colors.text }]}>
            {suggestion.fromUserName} pays {suggestion.toUserName}
          </Text>
          <Text style={[styles.suggestionAmount, { color: theme.colors.primary }]}>
            {getCurrencySymbol(currency)}{suggestion.amount.toFixed(2)}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.settleBtn, { backgroundColor: theme.colors.primary }]}
          onPress={() => handleSettlement(suggestion.fromUserId, suggestion.toUserId, suggestion.amount)}
        >
          <Text style={styles.settleBtnText}>Mark as Paid</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Settlement Overview
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {groupName}
            </Text>
          </View>
          
          <TouchableOpacity onPress={loadBalanceOverview} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        {overviewData && (
          <View style={[styles.summaryContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Total Group Debt
              </Text>
              <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                {getCurrencySymbol(currency)}{overviewData.totalGroupDebt?.toFixed(2) || '0.00'}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Total Group Credit
              </Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                {getCurrencySymbol(currency)}{overviewData.totalGroupCredit?.toFixed(2) || '0.00'}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Status
              </Text>
              <Text style={[
                styles.summaryValue, 
                { color: overviewData.isBalanced ? '#10B981' : '#F59E0B' }
              ]}>
                {overviewData.isBalanced ? '✅ Balanced' : '⚖️ Needs Settlement'}
              </Text>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'relationships' && { borderBottomColor: theme.colors.primary }]}
            onPress={() => setActiveTab('relationships')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'relationships' ? theme.colors.primary : theme.colors.textSecondary }
            ]}>
              All Relationships
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'suggestions' && { borderBottomColor: theme.colors.primary }]}
            onPress={() => setActiveTab('suggestions')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'suggestions' ? theme.colors.primary : theme.colors.textSecondary }
            ]}>
              Settlement Suggestions ({settlementSuggestions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Loading settlement data...
              </Text>
            </View>
          ) : (
            <>
              {activeTab === 'relationships' && (
                <View style={styles.relationshipsContainer}>
                  {overviewData?.memberRelationships?.length > 0 ? (
                    overviewData.memberRelationships.map((relationship: any, index: number) => 
                      renderRelationshipCard(relationship, index)
                    )
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>🤝</Text>
                      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                        All Settled Up!
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                        No outstanding balances in this group
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'suggestions' && (
                <View style={styles.suggestionsContainer}>
                  {settlementSuggestions.length > 0 ? (
                    <>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                        💡 Optimal Settlement Plan
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                        These {settlementSuggestions.length} payment(s) will settle all debts in the group
                      </Text>
                      
                      {settlementSuggestions.map((suggestion, index) => 
                        renderSettlementSuggestion(suggestion, index)
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>✅</Text>
                      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                        All Settled!
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                        No settlements needed in this group
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
  },
  refreshBtn: {
    padding: 4,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  relationshipsContainer: {
    gap: 16,
  },
  relationshipCard: {
    borderRadius: 12,
    padding: 16,
  },
  relationshipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  balanceLabel: {
    fontSize: 12,
  },
  relationshipDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  otherMemberTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  relationshipBalance: {
    fontSize: 14,
  },
  suggestionsContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  suggestionCard: {
    borderRadius: 12,
    padding: 16,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  suggestionAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  settleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  settleBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
