// src/screens/main/UnifiedSettlementScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { CrossPlatformAlert } from '@/utils/alertUtils';
import { useAuth } from '@/hooks/useAuth';
import { useBalances, UnifiedSettlementService } from '@/hooks/useBalances';
import { useSharedBalances } from '@/hooks/useSharedBalances';
import { getCurrencySymbol } from '@/utils/currency';
import { ApiService } from '@/services/api/ApiService';

// Define local interfaces to avoid external dependencies
interface Group {
  id: string;
  name: string;
  members: Array<{
    userId: string;
    userData: {
      fullName: string;
      email: string;
    };
  }>;
}

interface SettlementSuggestion {
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  toUserName: string;
  amount: number;
  groupId: string;
  groupName: string;
}

interface UnifiedSettlementScreenProps {
  // Entry modes
  mode: 'group-specific' | 'group-selector';
  groupId?: string; // Required when mode is 'group-specific'
  groupName?: string; // Required when mode is 'group-specific'
  onClose?: () => void;
}

export default function UnifiedSettlementScreen({
  mode,
  groupId,
  groupName,
  onClose
}: UnifiedSettlementScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { calculateSettlementBalances } = useBalances();
  const sharedBalances = useSharedBalances();

  // Debug props
  console.log('🔧 UnifiedSettlementScreen props:', { mode, groupId, groupName });

  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    mode === 'group-specific' ? groupId || null : null
  );
  const [selectedGroupName, setSelectedGroupName] = useState<string>(
    mode === 'group-specific' ? groupName || '' : ''
  );
  const [settlementSuggestions, setSettlementSuggestions] = useState<SettlementSuggestion[]>([]);
  const [groupMembers, setGroupMembers] = useState<Group['members']>([]);
  const [recordingPayment, setRecordingPayment] = useState(false);

  console.log('🔧 State after initialization:', { 
    mode, 
    selectedGroupId, 
    selectedGroupName,
    loading 
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [user?.id]);

  // Load settlement data when group is selected
  useEffect(() => {
    if (selectedGroupId) {
      loadGroupSettlements(selectedGroupId);
    }
  }, [selectedGroupId]);

  const loadInitialData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      console.log('🔄 Loading initial data for mode:', mode);
      
      // If in group-specific mode, we already have the group info, skip loading all groups
      if (mode === 'group-specific') {
        console.log('🎯 Group-specific mode: skipping group loading, going direct to settlement');
        // We already have selectedGroupId and selectedGroupName from props
        // The useEffect for selectedGroupId will trigger loadGroupSettlements
        return;
      }
      
      // Only load all groups if in group-selector mode
      const apiService = ApiService.getInstance();
      const userGroups = await apiService.getUserGroups();
      setGroups(userGroups);
      
      console.log('📋 Loaded user groups for selector mode:', userGroups.length);
      
    } catch (error) {
      console.error('❌ Failed to load settlement data:', error);
      CrossPlatformAlert.alert('Error', 'Failed to load settlement data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupSettlements = async (targetGroupId: string) => {
    try {
      setLoading(true);
      
      console.log('🔄 Loading settlements for group:', targetGroupId);
      
      // First, get group details to fetch member information for name mapping
      const apiService = ApiService.getInstance();
      let groupData: Group | null = null;
      
      try {
        groupData = await apiService.getGroup(targetGroupId);
        if (groupData?.members) {
          setGroupMembers(groupData.members);
          console.log('👥 Loaded group members for name mapping:', groupData.members.length);
        }
      } catch (groupError) {
        console.log('⚠️ Failed to load group data for name mapping:', groupError);
      }
      
      // Get group settlement suggestions using the new unified balance calculation
      let suggestions: SettlementSuggestion[] = [];
      
      try {
        // For group-specific mode, use the backend settlement endpoint to get ALL settlements
        if (targetGroupId) {
          console.log('🎯 Getting all group settlements from backend for group:', targetGroupId);
          
          try {
            const apiService = ApiService.getInstance();
            const settlementResponse = await apiService.getGroupSettlements(targetGroupId);
            console.log('🏦 Backend settlement response:', settlementResponse);
            
            if (settlementResponse?.settlements && Array.isArray(settlementResponse.settlements)) {
              // Convert backend settlement format to UI format
              suggestions = settlementResponse.settlements.map((settlement: any) => {
                // Backend format: { from: debtorId, to: creditorId, amount: number }
                // UI format needs user names, so we need to get them from group members
                return {
                  fromUserId: settlement.from,
                  toUserId: settlement.to,
                  fromUserName: getUserNameFromId(settlement.from, groupData?.members) || settlement.from,
                  toUserName: getUserNameFromId(settlement.to, groupData?.members) || settlement.to,
                  amount: settlement.amount,
                  groupId: targetGroupId,
                  groupName: groupName || 'Unknown Group'
                };
              });
              
              console.log('💰 Backend settlements converted to UI format:', suggestions);
            } else {
              console.log('⚠️ Backend returned no settlements or invalid format');
              suggestions = [];
            }
          } catch (backendError) {
            console.log('⚠️ Backend settlement call failed, falling back to client calculation:', backendError);
            // Fallback to client-side calculation if backend fails
            suggestions = await calculateClientSideSettlements(targetGroupId, groupData?.members);
          }
        } else {
          // For user-wide mode, use the existing client-side calculation
          suggestions = await calculateClientSideSettlements();
        }
      } catch (error) {
        console.error('❌ Settlement calculation failed:', error);
        suggestions = [];
      }
      
      console.log('💰 Final settlement suggestions:', suggestions.length, suggestions);
      setSettlementSuggestions(suggestions);
    } catch (error) {
      console.error('❌ Failed to load group settlements:', error);
      setSettlementSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get user name from user ID with group member data
  const getUserNameFromId = (userId: string, members?: Group['members']): string | null => {
    // Check if it's the current user
    if (userId === user?.id) {
      return user.fullName || 'You';
    }
    
    // Look up the user in the group members data
    if (members) {
      const member = members.find(member => member.userId === userId);
      if (member?.userData?.fullName) {
        return member.userData.fullName;
      }
    }
    
    // If not found, return null to use userId as fallback
    return null;
  };

  // Client-side settlement calculation (existing logic)
  const calculateClientSideSettlements = async (groupId?: string, members?: Group['members']): Promise<SettlementSuggestion[]> => {
    if (!user?.id) {
      console.log('❌ No user ID available for settlement calculation');
      return [];
    }
    
    const settlementBalances = await calculateSettlementBalances(user.id);
    console.log('💰 Settlement balances from unified service:', settlementBalances);
    
    // Convert settlement balances to settlement suggestions
    // Filter for the specific group if provided
    const groupSpecificBalances = groupId 
      ? settlementBalances.filter(balance => balance.groupId === groupId)
      : settlementBalances;
    
    // FIXED: Correct the direction mapping
    // Positive balance means the other person owes the current user (they should pay)
    // Negative balance means the current user owes the other person (current user should pay)
    return groupSpecificBalances
      .filter(balance => Math.abs(balance.balance) > 0.01)
      .map(balance => ({
        fromUserId: balance.balance > 0 ? balance.userId : user.id,  // Fixed: Positive = they owe you = they pay
        toUserId: balance.balance > 0 ? user.id : balance.userId,     // Fixed: Positive = you receive
        fromUserName: balance.balance > 0 ? (getUserNameFromId(balance.userId, members) || balance.name) : (user.fullName || 'You'),
        toUserName: balance.balance > 0 ? (user.fullName || 'You') : (getUserNameFromId(balance.userId, members) || balance.name),
        amount: Math.abs(balance.balance),
        groupId: balance.groupId || groupId || '',
        groupName: balance.groupName || groupName || 'Unknown Group'
      }));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Clear cache and force refresh balances when manually refreshing
    console.log('🧹 Manual refresh: Clearing balance cache...');
    UnifiedSettlementService.clearBalanceCache();
    await sharedBalances.forceRefresh();
    
    await loadInitialData();
    setRefreshing(false);
  };

  const handleGroupSelect = (group: Group) => {
    setSelectedGroupId(group.id);
    setSelectedGroupName(group.name);
  };

  const handleBackToGroupSelection = () => {
    setSelectedGroupId(null);
    setSelectedGroupName('');
    setSettlementSuggestions([]);
  };

  const handleMarkAsPaid = async (suggestion: SettlementSuggestion) => {
    if (!user?.id) {
      CrossPlatformAlert.alert('Error', 'User not logged in. Please try again.');
      return;
    }

    // Verify user is involved in this settlement
    if (user.id !== suggestion.fromUserId && user.id !== suggestion.toUserId) {
      CrossPlatformAlert.alert('Error', 'You can only mark payments that involve you.');
      return;
    }

    try {
      CrossPlatformAlert.alert(
        'Mark Payment as Complete',
        `Confirm that ${suggestion.fromUserName} has paid ${getCurrencySymbol('USD')}${suggestion.amount.toFixed(2)} to ${suggestion.toUserName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark as Paid',
            style: 'default',
            onPress: async () => {
              try {
                setRecordingPayment(true);
                console.log('💰 Recording settlement payment:', suggestion);
                
                // Record the settlement payment via API
                const apiService = ApiService.getInstance();
                await apiService.recordSettlement({
                  fromUserId: suggestion.fromUserId,
                  toUserId: suggestion.toUserId,
                  amount: suggestion.amount,
                  groupId: suggestion.groupId,
                  note: `Settlement payment: ${suggestion.fromUserName} → ${suggestion.toUserName}`
                });
                
                console.log('✅ Settlement payment recorded successfully');
                
                // CRITICAL: Clear balance cache and force refresh to reflect settlement
                console.log('🧹 Clearing balance cache after settlement...');
                UnifiedSettlementService.clearBalanceCache();
                
                // Force refresh shared balances to update all UI components
                console.log('🔄 Force refreshing shared balances...');
                await sharedBalances.forceRefresh();
                
                CrossPlatformAlert.alert(
                  'Payment Recorded',
                  `Successfully recorded ${suggestion.fromUserName}'s payment of ${getCurrencySymbol('USD')}${suggestion.amount.toFixed(2)} to ${suggestion.toUserName}.`,
                  [{ text: 'OK' }]
                );
                
                // Refresh the settlements to reflect the updated calculations
                if (selectedGroupId) {
                  console.log('🔄 Refreshing settlements after payment recording...');
                  await loadGroupSettlements(selectedGroupId);
                }
                
              } catch (error) {
                console.error('❌ Record settlement payment error:', error);
                
                // Show specific error message if available
                const errorMessage = (error as any)?.response?.data?.message || 
                                   (error as any)?.message || 
                                   'Failed to record payment. Please try again.';
                
                CrossPlatformAlert.alert('Error', `Failed to record payment: ${errorMessage}`);
              } finally {
                setRecordingPayment(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Settlement confirmation error:', error);
      CrossPlatformAlert.alert('Error', 'Unable to process payment confirmation. Please try again.');
    }
  };

  // Render group selection screen
  const renderGroupSelection = () => (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Select a Group to Settle
      </Text>
      
      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="people" size={64} color={theme.colors.textSecondary}  />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No Groups Found
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            You haven't joined any groups yet.
          </Text>
        </View>
      ) : (
        groups.map(group => (
          <TouchableOpacity
            key={group.id}
            style={[styles.groupCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => handleGroupSelect(group)}
          >
            <View style={styles.groupInfo}>
              <View style={[styles.groupIcon, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.groupIconText}>
                  {group.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.groupDetails}>
                <Text style={[styles.groupName, { color: theme.colors.text }]}>
                  {group.name}
                </Text>
                <Text style={[styles.groupSubtitle, { color: theme.colors.textSecondary }]}>
                  {group.members?.length || 0} members • {getCurrencySymbol('USD')}
                </Text>
              </View>
            </View>
            
            <Icon name="forward" size={20} color={theme.colors.textSecondary}  />
          </TouchableOpacity>
        ))
      )}
      
      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
        <Icon name="information" size={20} color={theme.colors.primary}  />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Select a group to view optimized settlement suggestions. Each group's settlements are calculated independently.
        </Text>
      </View>
    </ScrollView>
  );

  // Render settlement suggestions for selected group
  const renderSettlementSuggestions = () => (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Settlement Plan
      </Text>
      <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
        {selectedGroupName}
      </Text>
      
      {settlementSuggestions.length === 0 ? (
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
      ) : (
        <>
          {settlementSuggestions.map((suggestion, index) => (
            <View key={index} style={[styles.settlementCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.settlementFlow}>
                <View style={styles.payerContainer}>
                  <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.userAvatarText}>
                      {suggestion.fromUserName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.colors.text }]}>
                      {suggestion.fromUserName}
                    </Text>
                    <Text style={[styles.userAction, { color: theme.colors.textSecondary }]}>
                      pays
                    </Text>
                  </View>
                </View>
                
                <View style={styles.amountContainer}>
                  <Text style={[styles.amount, { color: theme.colors.success }]}>
                    {getCurrencySymbol('USD')}{suggestion.amount.toFixed(0)}
                  </Text>
                </View>
                
                <Icon name="forward" size={20} color={theme.colors.textSecondary}  />
                
                <View style={styles.payeeContainer}>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.colors.text }]}>
                      {suggestion.toUserName}
                    </Text>
                    <Text style={[styles.userAction, { color: theme.colors.textSecondary }]}>
                      receives
                    </Text>
                  </View>
                  <View style={[styles.userAvatar, { backgroundColor: theme.colors.secondary }]}>
                    <Text style={styles.userAvatarText}>
                      {suggestion.toUserName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.markPaidButton, 
                  { backgroundColor: theme.colors.primary },
                  recordingPayment && { opacity: 0.6 }
                ]}
                onPress={() => handleMarkAsPaid(suggestion)}
                disabled={recordingPayment}
              >
                {recordingPayment ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Icon name="success" size={16} color="white"  />
                )}
                <Text style={styles.markPaidText}>
                  {recordingPayment ? 'Recording...' : 'Mark as Paid'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          
          {/* Settlement Info */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
            <Icon name="information" size={20} color={theme.colors.primary}  />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              This is the optimized settlement plan for {selectedGroupName}. 
              Complete these payments to settle all balances in this group.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  if (loading) {
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        {(onClose || (mode === 'group-selector' && selectedGroupId)) && (
          <TouchableOpacity 
            onPress={selectedGroupId && mode === 'group-selector' ? handleBackToGroupSelection : onClose} 
            style={styles.backButton}
          >
            <Icon name="back" size={24} color={theme.colors.text}  />
          </TouchableOpacity>
        )}
        
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {selectedGroupId ? 'Group Settlement' : 'Settlements'}
        </Text>
        
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color={theme.colors.primary}  />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {selectedGroupId ? renderSettlementSuggestions() : renderGroupSelection()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  
  // Group Selection Styles
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupIconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  groupSubtitle: {
    fontSize: 12,
  },
  
  // Settlement Suggestions Styles
  settlementCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settlementFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  payerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  payeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  userAction: {
    fontSize: 12,
    marginTop: 2,
  },
  amountContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 12,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  markPaidText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Empty States
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
  
  // Info Card
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
