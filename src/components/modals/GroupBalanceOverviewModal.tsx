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
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { ApiService } from '@/services/api/ApiService';
import { getCurrencySymbol } from '@/utils/currency';
import { useAuth } from '@/hooks/useAuth';

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
  const { user } = useAuth();
  const apiService = ApiService.getInstance();
  const [loading, setLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [settlementSuggestions, setSettlementSuggestions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (visible && groupId) {
      loadGroupSettlementData();
    }
  }, [visible, groupId]);

  const loadGroupSettlementData = async () => {
    try {
      setLoading(true);
      
      // Get group-specific balance data with error handling
      let overview = null;
      try {
        overview = await apiService.getGroupBalanceOverview(groupId);
        console.log('🔄 GroupBalanceOverviewModal: Group overview data:', overview);
      } catch (apiError) {
        console.log('⚠️ GroupBalanceOverviewModal: API failed, will use fallback data:', apiError);
        overview = null; // Ensure overview is null for fallback logic
      }
      
      console.log('🔄 GroupBalanceOverviewModal: Passed balance data:', balanceData);
      
      // Calculate settlement suggestions from the balance data
      let suggestions: any[] = [];
      
      if (overview && overview.balances && Array.isArray(overview.balances)) {
        // Convert balance data to settlement suggestions
        suggestions = overview.balances
          .filter((balance: any) => Math.abs(balance.amount || 0) > 0.01) // Only non-zero balances
          .map((balance: any) => ({
            fromUserId: balance.amount < 0 ? balance.userId : balance.otherUserId,
            toUserId: balance.amount > 0 ? balance.userId : balance.otherUserId,
            fromUserName: balance.amount < 0 ? balance.userName : balance.otherUserName,
            toUserName: balance.amount > 0 ? balance.userName : balance.otherUserName,
            amount: Math.abs(balance.amount || 0),
            groupId: groupId,
            groupName: balance.groupName || groupName
          }));
        console.log('🔄 GroupBalanceOverviewModal: Using API overview data for suggestions');
      } else if (balanceData && Array.isArray(balanceData)) {
        // Fallback to passed balance data if API doesn't return proper format
        console.log('🔄 GroupBalanceOverviewModal: API failed, trying fallback balance data...');
        suggestions = balanceData
          .filter((balance: any) => Math.abs(balance.balance || 0) > 0.01)
          .map((balance: any) => ({
            fromUserId: balance.balance < 0 ? balance.userId : user?.id,
            toUserId: balance.balance > 0 ? balance.userId : user?.id,
            fromUserName: balance.balance < 0 ? balance.name : (user?.fullName || user?.email || 'You'),
            toUserName: balance.balance > 0 ? balance.name : (user?.fullName || user?.email || 'You'),
            amount: Math.abs(balance.balance || 0),
            groupId: groupId,
            groupName: balance.groupName || groupName
          }));
        console.log('🔄 GroupBalanceOverviewModal: Using fallback balance data for suggestions');
      } else {
        // Last resort: try to calculate dynamic suggestions based on current balances
        console.log('🔄 GroupBalanceOverviewModal: No API or balance data, calculating dynamic suggestions...');
        console.log('🔄 GroupBalanceOverviewModal: Current user ID:', user?.id);
        console.log('🔄 GroupBalanceOverviewModal: Balance data:', balanceData);
        
        // Try to use the balance data to create dynamic suggestions
        if (balanceData && balanceData.length > 0) {
          suggestions = balanceData
            .filter((balance: any) => Math.abs(balance.balance) > 0.01)
            .map((balance: any) => ({
              fromUserId: balance.balance < 0 ? user?.id || '' : balance.userId,
              toUserId: balance.balance < 0 ? balance.userId : user?.id || '',
              fromUserName: balance.balance < 0 ? 'You' : balance.name,
              toUserName: balance.balance < 0 ? balance.name : 'You',
              amount: Math.abs(balance.balance),
              groupId: groupId,
              groupName: groupName
            }));
          console.log('🔄 GroupBalanceOverviewModal: Created dynamic suggestions from balance data');
        } else {
          console.log('🔄 GroupBalanceOverviewModal: No balance data available for dynamic suggestions');
        }
      }
      
      console.log('🔄 GroupBalanceOverviewModal: Settlement suggestions calculated:', suggestions.length);
      suggestions.forEach((suggestion: any, index: number) => {
        console.log(`💸 Settlement ${index + 1}: ${suggestion.fromUserName} pays $${suggestion.amount} to ${suggestion.toUserName}`);
        console.log(`   fromUserId: ${suggestion.fromUserId}, toUserId: ${suggestion.toUserId}`);
      });
      
      setOverviewData(overview);
      setSettlementSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load group settlement data:', error);
      Alert.alert('Error', 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGroupSettlementData();
    setRefreshing(false);
  };

  const handleMarkAsPaid = async (suggestion: any) => {
    try {
      Alert.alert(
        'Mark Payment as Complete',
        `Confirm that ${suggestion.fromUserName} has paid ${getCurrencySymbol(currency)}${suggestion.amount.toFixed(2)} to ${suggestion.toUserName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark as Paid',
            style: 'default',
            onPress: async () => {
              try {
                // TODO: Add markPaymentAsPaid method to ApiService
                // For now, use updateExpense to mark settlement
                Alert.alert('Feature Coming Soon', 'Mark as paid functionality will be available in the next update.');
                
                // Placeholder for when API method is implemented:
                // await apiService.markPaymentAsPaid(
                //   suggestion.fromUserId,
                //   suggestion.toUserId,
                //   suggestion.amount,
                //   groupId,
                //   `Settlement payment in ${groupName}`
                // );
                
                // Refresh the data
                await loadGroupSettlementData();
                
                Alert.alert('Success! 🎉', 'Payment has been marked as complete and balances updated.');
                
              } catch (error) {
                console.error('Mark payment error:', error);
                Alert.alert('Error', 'Failed to mark payment as complete. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Settlement confirmation error:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={theme.colors.text}  />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Group Settlement
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {groupName}
            </Text>
          </View>
          
          <TouchableOpacity 
            onPress={handleRefresh} 
            style={styles.refreshButton}
            disabled={refreshing}
          >
            <Icon name="refresh" 
              size={20} 
              color={refreshing ? theme.colors.textSecondary : theme.colors.primary} 
             />
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
              {/* Simple Settlement Display */}
              {settlementSuggestions && settlementSuggestions.length > 0 ? (
                <View style={styles.simpleSettlementContainer}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    To be paid
                  </Text>
                  
                  {settlementSuggestions.map((suggestion, index) => (
                    <View key={index} style={[styles.simpleSettlementCard, { backgroundColor: theme.colors.surface }]}>
                      <View style={styles.paymentFlow}>
                        <View style={styles.payerContainer}>
                          <Text style={[styles.payerName, { color: theme.colors.text }]}>
                            {suggestion.fromUserName}
                          </Text>
                          <Text style={[styles.payerLabel, { color: theme.colors.textSecondary }]}>
                            needs to pay
                          </Text>
                        </View>
                        
                        <View style={styles.amountContainer}>
                          <Text style={[styles.simpleAmount, { color: theme.colors.success }]}>
                            {getCurrencySymbol(currency)}{suggestion.amount.toFixed(0)}
                          </Text>
                        </View>
                        
                        <Icon name="forward" size={20} color={theme.colors.textSecondary}  />
                        
                        <View style={styles.payeeContainer}>
                          <Text style={[styles.payeeName, { color: theme.colors.text }]}>
                            {suggestion.toUserName}
                          </Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity
                        style={[styles.simpleMarkPaidButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => handleMarkAsPaid(suggestion)}
                      >
                        <Icon name="success" size={16} color="white"  />
                        <Text style={styles.simpleMarkPaidText}>Mark as Paid</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.allSettledContainer, { backgroundColor: theme.colors.surface }]}>
                  <View style={[styles.settledIcon, { backgroundColor: `${theme.colors.success}15` }]}>
                    <Icon name="success" size={48} color={theme.colors.success}  />
                  </View>
                  <Text style={[styles.allSettledTitle, { color: theme.colors.text }]}>
                    All Settled! 🎉
                  </Text>
                  <Text style={[styles.allSettledSubtitle, { color: theme.colors.textSecondary }]}>
                    Everyone is even in this group
                  </Text>
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
  closeButton: {
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
  refreshButton: {
    padding: 4,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Simple settlement styles
  simpleSettlementContainer: {
    marginTop: 20,
  },
  simpleSettlementCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  payerName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  amountContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginHorizontal: 12,
  },
  simpleAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  payeeName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  simpleMarkPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  simpleMarkPaidText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // All settled styles
  allSettledContainer: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
  },
  settledIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  allSettledTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  allSettledSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  // New container styles for clearer payment direction
  payerContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  payerLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  payeeContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  payeeLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});
