// src/screens/main/UnifiedSettlementScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useOverviewBalances, useFriendsBalances } from '@/hooks/useBalances';
import { SplittingService, Friend, Group } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';
import { friendsManager } from '@/services/FriendsManager';
import GroupBalanceOverviewModal from '@/components/modals/GroupBalanceOverviewModal';

interface BalanceEntry {
  id: string;
  type: 'friend' | 'group';
  userId: string;
  name: string;
  email: string;
  amount: number;
  isOwed: boolean; // true if they owe you, false if you owe them
  groupName?: string;
  groupId?: string;
  description: string;
  lastActivity?: Date;
  source?: 'friend' | 'group' | 'mixed';
}

interface UnifiedSettlementScreenProps {
  initialFilter?: 'all' | 'friends' | 'groups' | 'friend';
  initialGroupId?: string;
  initialFriendId?: string;
  onClose?: () => void;
}

export default function UnifiedSettlementScreen({
  initialFilter = 'all',
  initialGroupId = undefined,
  initialFriendId = undefined,
  onClose
}: UnifiedSettlementScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const overviewBalances = useOverviewBalances();
  const friendsBalances = useFriendsBalances();

  // State management
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId || null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [filteredBalances, setFilteredBalances] = useState<BalanceEntry[]>([]);
  const [summary, setSummary] = useState({
    totalOwed: 0,
    totalOwing: 0,
    netPosition: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showRemindModal, setShowRemindModal] = useState(false);
  const [showGroupBalanceOverview, setShowGroupBalanceOverview] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<BalanceEntry | null>(null);
  const [settlementNote, setSettlementNote] = useState('');
  const [settling, setSettling] = useState(false);
  const [sending, setSending] = useState(false);
  const [groupBalanceData, setGroupBalanceData] = useState<any>(null);

  // Data
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [user?.id]);

  // Additional effect to refresh balances after a short delay to ensure data is ready
  useEffect(() => {
    if (!user?.id) return;
    
    const timer = setTimeout(async () => {
      console.log('🔄 UnifiedSettlementScreen: Secondary balance refresh...');
      try {
        await Promise.all([
          overviewBalances.forceRefresh(),
          friendsBalances.forceRefresh()
        ]);
      } catch (error) {
        console.error('❌ Secondary refresh failed:', error);
      }
    }, 500); // 500ms delay to ensure screen is mounted
    
    return () => clearTimeout(timer);
  }, [user?.id]);

  // Filter balances when dependencies change
  useEffect(() => {
    filterAndCalculateBalances();
  }, [activeFilter, selectedGroupId, selectedFriendId, initialFriendId, user?.id]);

  const loadInitialData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      console.log('🔄 UnifiedSettlementScreen: Loading initial data and refreshing balances...');
      
      // Force refresh balance systems first to get latest data
      await Promise.all([
        overviewBalances.forceRefresh(),
        friendsBalances.forceRefresh()
      ]);
      
      // Load friends and groups
      const [friendsData, groupsData] = await Promise.all([
        friendsManager.getFriends(),
        SplittingService.getUserGroups(user.id)
      ]);
      
      setFriends(friendsData);
      setGroups(groupsData);
      
      console.log('✅ UnifiedSettlementScreen: Initial data loaded:', {
        friends: friendsData.length,
        groups: groupsData.length
      });
      
    } catch (error) {
      console.error('❌ Failed to load settlement data:', error);
      Alert.alert('Error', 'Failed to load settlement data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // DEBUG: Balance synchronization test function
  const testBalanceSync = async () => {
    try {
      console.log('🚀 TESTING: Balance synchronization...');
      Alert.alert('Debug', 'Starting balance synchronization test - check console logs');
      
      const groupId = 'xp8AhgtKjd9Wlwz5kq5T'; // Your "Months" group ID
      
      await SplittingService.synchronizeFriendBalancesWithExpenses(groupId);
      
      console.log('✅ Balance synchronization test completed!');
      Alert.alert('Success', 'Balance synchronization completed! Check console for details.');
      
      // Refresh to see updated balances
      await handleRefresh();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Balance sync test failed:', error);
      Alert.alert('Error', 'Balance sync test failed: ' + errorMessage);
    }
  };

  // Store all balances separately for stable counting
  const [allBalanceEntries, setAllBalanceEntries] = useState<BalanceEntry[]>([]);

  const filterAndCalculateBalances = useCallback(async () => {
    try {
      if (!user?.id) return;

      console.log('🔄 Filtering balances with:', {
        activeFilter,
        selectedGroupId,
        selectedFriendId,
        initialFriendId,
        overviewBalancesCount: overviewBalances.allBalances?.length || 0
      });

      let balanceEntries: BalanceEntry[] = [];
      
      // Get settlement-specific balances that include groups even for friends
      const settlementBalances = await overviewBalances.calculateSettlementBalances(user.id);
      
      console.log('📊 Settlement balances retrieved:', {
        total: settlementBalances.length,
        friends: settlementBalances.filter(b => b.source === 'friend').length,
        groups: settlementBalances.filter(b => b.source === 'group').length
      });
      
      // Convert settlement balance data to settlement entries and consolidate duplicates
      if (settlementBalances && Array.isArray(settlementBalances)) {
        const userBalanceMap = new Map<string, BalanceEntry>();
        
        settlementBalances
          .filter(balance => Math.abs(balance.balance || 0) > 0.01)
          .forEach(balance => {
            const userId = balance.userId;
            const amount = Math.abs(balance.balance || 0);
            const isOwed = (balance.balance || 0) > 0;
            
            if (userBalanceMap.has(userId)) {
              // Combine with existing entry
              const existing = userBalanceMap.get(userId)!;
              
              // For friend+group consolidation, don't add amounts - they represent the same debt
              // Just track that this person has both friend and group relationships
              // The settlement amount should be the total amount owed, not duplicated
              
              // If this is a group balance, add group info to description
              if (balance.source === 'group' && balance.groupName) {
                if (!existing.description.includes(balance.groupName)) {
                  existing.description = `Friend balance + Group: ${balance.groupName}`;
                }
                // Track group info for filtering
                if (!existing.groupId && balance.groupId) {
                  existing.groupId = balance.groupId;
                  existing.groupName = balance.groupName;
                }
                // For groups filter to work, set type to group when group is involved
                existing.type = 'group';
              }
              
              // Update source to mixed if combining friend + group
              if (existing.source !== balance.source) {
                existing.source = 'mixed';
              }
            } else {
              // Create new entry
              const entry: BalanceEntry = {
                id: `combined-${userId}`,
                type: balance.source === 'group' ? 'group' : 'friend',
                userId: userId,
                name: balance.name || 'Unknown',
                email: balance.email || '',
                amount: amount,
                isOwed: isOwed,
                groupName: balance.groupName,
                groupId: balance.groupId,
                description: balance.source === 'group' 
                  ? `Group: ${balance.groupName}` 
                  : 'Friend balance',
                source: balance.source
              };
              
              userBalanceMap.set(userId, entry);
            }
          });
        
        balanceEntries = Array.from(userBalanceMap.values());
      }

      console.log('📊 Generated consolidated balance entries:', balanceEntries.length);

      // Store all balances for stable counting
      setAllBalanceEntries(balanceEntries);

      // Apply filters for display
      let filtered = [...balanceEntries];
      
      if (activeFilter === 'friends') {
        // Include entries that are friends OR mixed entries (friend+group consolidations)
        filtered = filtered.filter(entry => 
          entry.type === 'friend' || 
          entry.source === 'mixed' ||
          (entry.source === 'friend')
        );
        
        // If specific friend selected, filter further
        if (selectedFriendId) {
          filtered = filtered.filter(entry => entry.userId === selectedFriendId);
        }
      } else if (activeFilter === 'groups') {
        // Include entries that are groups OR have group information (mixed entries)
        filtered = filtered.filter(entry => 
          entry.type === 'group' || 
          entry.source === 'group' || 
          (entry.source === 'mixed' && entry.groupId)
        );
        
        // If specific group selected, filter further
        if (selectedGroupId) {
          filtered = filtered.filter(entry => entry.groupId === selectedGroupId);
        }
      } else if (activeFilter === 'friend' && initialFriendId) {
        // Specific friend filter
        filtered = filtered.filter(entry => 
          entry.userId === initialFriendId
        );
      }

      // Sort by amount (largest first)
      filtered.sort((a, b) => b.amount - a.amount);

      // Calculate summary based on filtered results
      const totalOwed = filtered
        .filter(entry => entry.isOwed)
        .reduce((sum, entry) => sum + entry.amount, 0);
      
      const totalOwing = filtered
        .filter(entry => !entry.isOwed)
        .reduce((sum, entry) => sum + entry.amount, 0);

      setFilteredBalances(filtered);
      setSummary({
        totalOwed: parseFloat(totalOwed.toFixed(2)),
        totalOwing: parseFloat(totalOwing.toFixed(2)),
        netPosition: parseFloat((totalOwed - totalOwing).toFixed(2))
      });

      console.log('✅ Balance filtering completed:', {
        filtered: filtered.length,
        totalOwed,
        totalOwing
      });

    } catch (error) {
      console.error('❌ Filter balances error:', error);
      setAllBalanceEntries([]);
      setFilteredBalances([]);
      setSummary({ totalOwed: 0, totalOwing: 0, netPosition: 0 });
    }
  }, [activeFilter, selectedGroupId, selectedFriendId, initialFriendId, user?.id, overviewBalances.calculateSettlementBalances]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 UnifiedSettlementScreen: Force refresh initiated...');
      
      // Clear any cached balance data first
      setAllBalanceEntries([]);
      setFilteredBalances([]);
      
      await Promise.all([
        overviewBalances.forceRefresh(),
        friendsBalances.forceRefresh(),
        friendsManager.forceRefresh(),
        loadInitialData()
      ]);
      
      // Force re-filtering after data refresh
      setTimeout(() => {
        filterAndCalculateBalances();
      }, 500);
      
      console.log('✅ UnifiedSettlementScreen: Force refresh completed');
    } catch (error) {
      console.error('❌ Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAsPaid = (balance: BalanceEntry) => {
    setSelectedBalance(balance);
    setSettlementNote('');
    setShowSettleModal(true);
  };

  const handleRemind = (balance: BalanceEntry) => {
    setSelectedBalance(balance);
    setShowRemindModal(true);
  };

const confirmSettlement = async () => {
  if (!selectedBalance || !user?.id || settling) return;
  
  try {
    setSettling(true);
    
    console.log('🔄 ENHANCED: Processing settlement with full synchronization');
    console.log('Settlement details:', {
      from: selectedBalance.isOwed ? selectedBalance.userId : user.id,
      to: selectedBalance.isOwed ? user.id : selectedBalance.userId,
      amount: selectedBalance.amount,
      groupId: selectedBalance.groupId,
      type: selectedBalance.type
    });

    // Determine payment direction
    const fromUserId = selectedBalance.isOwed ? selectedBalance.userId : user.id;
    const toUserId = selectedBalance.isOwed ? user.id : selectedBalance.userId;
    
    // 🔥 Use the ENHANCED settlement method with full synchronization
    await SplittingService.markPaymentAsPaid(
      fromUserId,
      toUserId,
      selectedBalance.amount,
      selectedBalance.type === 'group' ? selectedBalance.groupId : undefined,
      settlementNote || 'Manual settlement via app'
    );

    console.log('✅ ENHANCED: Settlement recorded with full synchronization');
    
    // Close modal first
    setShowSettleModal(false);
    setSelectedBalance(null);
    setSettlementNote('');
    
    // Show success and refresh
    Alert.alert(
      'Settlement Recorded! 💰',
      `Payment of ${getCurrencySymbol(user.currency || 'USD')}${selectedBalance.amount.toFixed(2)} has been recorded and all balances updated.`,
      [{ text: 'OK' }]
    );
    
    // Force refresh all balance systems
    await handleRefresh();
    
    // Additional refresh after delay to ensure UI updates
    setTimeout(async () => {
      console.log('🔄 ENHANCED: Post-settlement secondary refresh...');
      await handleRefresh();
      await filterAndCalculateBalances();
    }, 1000);
    
  } catch (error: any) {
    console.error('❌ ENHANCED: Settlement error:', error);
    Alert.alert(
      'Settlement Failed',
      error.message || 'Failed to record settlement. Please try again.',
      [{ text: 'OK' }]
    );
  } finally {
    setSettling(false);
  }
};

  const sendReminder = async (method: 'sms' | 'email' | 'app') => {
    if (!selectedBalance || !user?.id || sending) return;
    
    try {
      setSending(true);
      
      const currencySymbol = getCurrencySymbol(user.currency || 'USD');
      const amount = selectedBalance.amount.toFixed(2);
      const owedText = selectedBalance.isOwed ? 'you owe me' : 'I owe you';
      
      const message = `Hi ${selectedBalance.name}! Just a friendly reminder about our ${currencySymbol}${amount} balance - ${owedText}. Thanks! 😊`;
      
      if (method === 'sms') {
        // Open SMS app
        const phoneNumber = selectedBalance.email; // In real app, you'd have phone number
        const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
        
        const canOpen = await Linking.canOpenURL(smsUrl);
        if (canOpen) {
          await Linking.openURL(smsUrl);
        } else {
          throw new Error('SMS not available on this device');
        }
        
      } else if (method === 'email') {
        // Open email app
        const subject = encodeURIComponent('Payment Reminder - Spendy');
        const body = encodeURIComponent(message);
        const emailUrl = `mailto:${selectedBalance.email}?subject=${subject}&body=${body}`;
        
        const canOpen = await Linking.canOpenURL(emailUrl);
        if (canOpen) {
          await Linking.openURL(emailUrl);
        } else {
          throw new Error('Email not available on this device');
        }
        
      } else if (method === 'app') {
        // Send app notification
        await SplittingService.createNotification({
          userId: selectedBalance.userId,
          type: 'payment_request',
          title: 'Payment Reminder',
          message: message,
          data: {
            fromUserId: user.id,
            amount: selectedBalance.amount,
            currency: user.currency || 'USD',
            reminderType: 'settlement'
          },
          isRead: false,
          createdAt: new Date()
        });
      }
      
      setShowRemindModal(false);
      setSelectedBalance(null);
      
      Alert.alert(
        'Reminder Sent! 📤',
        `${method.charAt(0).toUpperCase() + method.slice(1)} reminder sent to ${selectedBalance.name}!`,
        [{ text: 'OK' }]
      );
      
    } catch (error: any) {
      console.error('❌ Send reminder error:', error);
      Alert.alert(
        'Reminder Failed',
        error.message || `Failed to send ${method} reminder. Please try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      setSending(false);
    }
  };

  const renderFilterTabs = () => {
    // Calculate stable counts from all balance entries
    const allCount = allBalanceEntries.length;
    const friendsCount = allBalanceEntries.filter(b => 
      b.type === 'friend' || 
      b.source === 'mixed' || 
      b.source === 'friend'
    ).length;
    const groupsCount = allBalanceEntries.filter(b => 
      b.type === 'group' || 
      b.source === 'group' || 
      (b.source === 'mixed' && b.groupId)
    ).length;
    
    return (
      <View style={[styles.filterContainer, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            activeFilter === 'all' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => {
            setActiveFilter('all');
            setSelectedGroupId(null);
            setSelectedFriendId(null);
          }}
        >
          <Text style={[
            styles.filterTabText,
            { color: activeFilter === 'all' ? 'white' : theme.colors.text }
          ]}>
            All ({allCount})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterTab,
            activeFilter === 'friends' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => {
            setActiveFilter('friends');
            setSelectedGroupId(null);
            setSelectedFriendId(null);
          }}
        >
          <Text style={[
            styles.filterTabText,
            { color: activeFilter === 'friends' ? 'white' : theme.colors.text }
          ]}>
            Friends ({friendsCount})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterTab,
            activeFilter === 'groups' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => {
            setActiveFilter('groups');
            setSelectedGroupId(null);
            setSelectedFriendId(null);
          }}
        >
          <Text style={[
            styles.filterTabText,
            { color: activeFilter === 'groups' ? 'white' : theme.colors.text }
          ]}>
            Groups ({groupsCount})
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderGroupSelector = () => {
    if (activeFilter !== 'groups') return null;
    
    // Get available groups from all balance entries, not filtered ones
    const availableGroups = groups.filter(group => 
      allBalanceEntries.some(balance => balance.groupId === group.id)
    );
    
    if (availableGroups.length === 0) return null;
    
    return (
      <View style={[styles.groupSelectorContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.groupSelectorLabel, { color: theme.colors.text }]}>
          Select Group:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupSelector}>
          <TouchableOpacity
            style={[
              styles.groupChip,
              { borderColor: theme.colors.border },
              !selectedGroupId && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setSelectedGroupId(null)}
          >
            <Text style={[
              styles.groupChipText,
              { color: !selectedGroupId ? 'white' : theme.colors.text }
            ]}>
              All Groups ({availableGroups.length})
            </Text>
          </TouchableOpacity>
          
          {availableGroups.map(group => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupChip,
                { borderColor: theme.colors.border },
                selectedGroupId === group.id && { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setSelectedGroupId(group.id)}
            >
              <Text style={[
                styles.groupChipText,
                { color: selectedGroupId === group.id ? 'white' : theme.colors.text }
              ]}>
                {group.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Group Settlement Overview Button */}
        {selectedGroupId && (
          <TouchableOpacity
            style={[styles.groupOverviewBtn, { backgroundColor: theme.colors.primary }]}
            onPress={async () => {
              try {
                const selectedGroup = groups.find(g => g.id === selectedGroupId);
                if (selectedGroup) {
                  const balanceOverview = await SplittingService.getGroupBalanceOverview(selectedGroupId);
                  setGroupBalanceData(balanceOverview);
                  setShowGroupBalanceOverview(true);
                }
              } catch (error) {
                console.error('Failed to load group balance overview:', error);
                Alert.alert('Error', 'Failed to load settlement overview');
              }
            }}
          >
            <Ionicons name="analytics" size={16} color="white" />
            <Text style={styles.groupOverviewBtnText}>💰 Settlement Overview</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFriendSelector = () => {
    if (activeFilter !== 'friends') return null;
    
    // Get available friends from all balance entries, not filtered ones
    const availableFriends = friends.filter(friend => 
      allBalanceEntries.some(balance => 
        balance.userId === friend.friendId && 
        (balance.type === 'friend' || balance.source === 'friend' || balance.source === 'mixed')
      )
    );
    
    if (availableFriends.length === 0) return null;
    
    return (
      <View style={[styles.groupSelectorContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.groupSelectorLabel, { color: theme.colors.text }]}>
          Select Friend:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupSelector}>
          <TouchableOpacity
            style={[
              styles.groupChip,
              { borderColor: theme.colors.border },
              !selectedFriendId && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setSelectedFriendId(null)}
          >
            <Text style={[
              styles.groupChipText,
              { color: !selectedFriendId ? 'white' : theme.colors.text }
            ]}>
              All Friends ({availableFriends.length})
            </Text>
          </TouchableOpacity>
          
          {availableFriends.map(friend => (
            <TouchableOpacity
              key={friend.friendId}
              style={[
                styles.groupChip,
                { borderColor: theme.colors.border },
                selectedFriendId === friend.friendId && { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setSelectedFriendId(friend.friendId)}
            >
              <Text style={[
                styles.groupChipText,
                { color: selectedFriendId === friend.friendId ? 'white' : theme.colors.text }
              ]}>
                {friend.friendData.fullName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSummaryCard = () => (
    <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
        Settlement Summary
      </Text>
      
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
          You will receive
        </Text>
        <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
          {getCurrencySymbol(user?.currency || 'USD')}{summary.totalOwed.toFixed(2)}
        </Text>
      </View>
      
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
          You will pay
        </Text>
        <Text style={[styles.summaryValue, { color: theme.colors.error }]}>
          {getCurrencySymbol(user?.currency || 'USD')}{summary.totalOwing.toFixed(2)}
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
          {getCurrencySymbol(user?.currency || 'USD')}{Math.abs(summary.netPosition).toFixed(2)}
        </Text>
      </View>
    </View>
  );

  const renderBalanceCard = (balance: BalanceEntry) => (
    <View
      key={balance.id}
      style={[
        styles.balanceCard,
        { 
          backgroundColor: theme.colors.surface,
          borderLeftColor: balance.isOwed ? theme.colors.success : theme.colors.error,
          borderLeftWidth: 4
        }
      ]}
    >
      <View style={styles.balanceHeader}>
        <View style={styles.balanceInfo}>
          <View style={[styles.avatarContainer, { 
            backgroundColor: balance.type === 'friend' ? theme.colors.primary : theme.colors.secondary 
          }]}>
            <Text style={styles.avatarText}>
              {balance.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.balanceDetails}>
            <Text style={[styles.balanceName, { color: theme.colors.text }]}>
              {balance.name}
            </Text>
            <Text style={[styles.balanceDescription, { color: theme.colors.textSecondary }]}>
              {balance.description}
            </Text>
            {balance.groupName && (
              <Text style={[styles.balanceGroup, { color: theme.colors.primary }]}>
                📍 {balance.groupName}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.amountContainer}>
          <Text style={[
            styles.amountText,
            { color: balance.isOwed ? theme.colors.success : theme.colors.error }
          ]}>
            {balance.isOwed ? '+' : '-'}{getCurrencySymbol(user?.currency || 'USD')}{balance.amount.toFixed(2)}
          </Text>
          <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
            {balance.isOwed ? 'Owes you' : 'You owe'}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.remindButton, { backgroundColor: theme.colors.warning }]}
          onPress={() => handleRemind(balance)}
          disabled={sending}
        >
          <Ionicons name="notifications" size={16} color="white" />
          <Text style={styles.actionButtonText}>Remind</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.settleButton, 
            { backgroundColor: balance.isOwed ? theme.colors.success : theme.colors.error }
          ]}
          onPress={() => handleMarkAsPaid(balance)}
          disabled={settling}
        >
          <Ionicons name="checkmark-circle" size={16} color="white" />
          <Text style={styles.actionButtonText}>
            {settling ? 'Processing...' : 'Mark as Paid'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSettleModal = () => (
    <Modal
      visible={showSettleModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => !settling && setShowSettleModal(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity 
            onPress={() => !settling && setShowSettleModal(false)}
            disabled={settling}
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Record Settlement
          </Text>
          <View style={{ width: 24 }} />
        </View>
        
        {selectedBalance && (
          <ScrollView style={styles.modalContent}>
            <View style={[styles.modalSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>
                Settlement Details
              </Text>
              
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>
                  {selectedBalance.isOwed ? 'From' : 'To'}:
                </Text>
                <Text style={[styles.modalValue, { color: theme.colors.text }]}>
                  {selectedBalance.name}
                </Text>
              </View>
              
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>
                  Amount:
                </Text>
                <Text style={[styles.modalValue, { color: theme.colors.text }]}>
                  {getCurrencySymbol(user?.currency || 'USD')}{selectedBalance.amount.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>
                  Type:
                </Text>
                <Text style={[styles.modalValue, { color: theme.colors.text }]}>
                  {selectedBalance.type === 'friend' ? 'Friend Settlement' : 'Group Settlement'}
                </Text>
              </View>
            </View>
            
            <View style={[styles.modalSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>
                Add Note (Optional)
              </Text>
              <TextInput
                style={[styles.noteInput, { 
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.background
                }]}
                placeholder="e.g., Paid via cash, bank transfer, etc."
                placeholderTextColor={theme.colors.textSecondary}
                value={settlementNote}
                onChangeText={setSettlementNote}
                multiline
                numberOfLines={3}
                editable={!settling}
              />
            </View>
            
            <TouchableOpacity
              style={[
                styles.confirmButton, 
                { 
                  backgroundColor: settling ? theme.colors.textSecondary : theme.colors.primary,
                  opacity: settling ? 0.7 : 1
                }
              ]}
              onPress={confirmSettlement}
              disabled={settling}
            >
              {settling ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="checkmark-circle" size={20} color="white" />
              )}
              <Text style={styles.confirmButtonText}>
                {settling ? 'Recording Settlement...' : 'Confirm Settlement'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );

  const renderRemindModal = () => (
    <Modal
      visible={showRemindModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => !sending && setShowRemindModal(false)}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity 
            onPress={() => !sending && setShowRemindModal(false)}
            disabled={sending}
          >
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Send Reminder
          </Text>
          <View style={{ width: 24 }} />
        </View>
        
        {selectedBalance && (
          <ScrollView style={styles.modalContent}>
            <View style={[styles.modalSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>
                Remind {selectedBalance.name}
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                About {getCurrencySymbol(user?.currency || 'USD')}{selectedBalance.amount.toFixed(2)} {selectedBalance.isOwed ? 'they owe you' : 'you owe them'}
              </Text>
            </View>
            
            <View style={styles.reminderOptions}>
              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => sendReminder('sms')}
                disabled={sending}
              >
                <Ionicons name="chatbubble" size={24} color={theme.colors.primary} />
                <View style={styles.reminderOptionContent}>
                  <Text style={[styles.reminderOptionText, { color: theme.colors.text }]}>
                    Send SMS
                  </Text>
                  <Text style={[styles.reminderOptionSubtext, { color: theme.colors.textSecondary }]}>
                    Quick text message
                  </Text>
                </View>
                {sending && <ActivityIndicator size="small" color={theme.colors.primary} />}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => sendReminder('email')}
                disabled={sending}
              >
                <Ionicons name="mail" size={24} color={theme.colors.secondary} />
                <View style={styles.reminderOptionContent}>
                  <Text style={[styles.reminderOptionText, { color: theme.colors.text }]}>
                    Send Email
                  </Text>
                  <Text style={[styles.reminderOptionSubtext, { color: theme.colors.textSecondary }]}>
                    Detailed email reminder
                  </Text>
                </View>
                {sending && <ActivityIndicator size="small" color={theme.colors.secondary} />}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => sendReminder('app')}
                disabled={sending}
              >
                <Ionicons name="notifications" size={24} color={theme.colors.success} />
                <View style={styles.reminderOptionContent}>
                  <Text style={[styles.reminderOptionText, { color: theme.colors.text }]}>
                    App Notification
                  </Text>
                  <Text style={[styles.reminderOptionSubtext, { color: theme.colors.textSecondary }]}>
                    In-app notification
                  </Text>
                </View>
                {sending && <ActivityIndicator size="small" color={theme.colors.success} />}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
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
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Settlements
        </Text>
        
        {/* DEBUG BUTTON - Remove in production */}
        <TouchableOpacity 
          style={[styles.debugButton, { backgroundColor: '#ff6b6b', marginRight: 8 }]}
          onPress={testBalanceSync}
        >
          <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
            🔧 Fix
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Tabs */}
        {renderFilterTabs()}
        
        {/* Group Selector */}
        {renderGroupSelector()}
        
        {/* Friend Selector */}
        {renderFriendSelector()}
        
        {/* Summary Card */}
        {renderSummaryCard()}

        {/* Settlements List */}
        {filteredBalances.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              All Settled!
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No outstanding balances for the selected filter.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Outstanding Balances ({filteredBalances.length})
            </Text>
            {filteredBalances.map(renderBalanceCard)}
          </>
        )}

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            This screen shows all your outstanding balances. Use filters to view specific friends or groups. 
            Tap "Remind" to send payment reminders or "Mark as Paid" to record settlements.
          </Text>
        </View>
      </ScrollView>

      {/* Modals */}
      {renderSettleModal()}
      {renderRemindModal()}
      
      {/* Group Balance Overview Modal */}
      <GroupBalanceOverviewModal
        visible={showGroupBalanceOverview}
        onClose={() => setShowGroupBalanceOverview(false)}
        groupId={selectedGroupId || ''}
        groupName={groups.find(g => g.id === selectedGroupId)?.name || ''}
        currency={groups.find(g => g.id === selectedGroupId)?.currency || 'USD'}
        balanceData={groupBalanceData}
      />
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
  debugButton: {
    padding: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    marginVertical: 16,
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  groupSelectorContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  groupSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  groupSelector: {
    flexDirection: 'row',
  },
  groupChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  groupChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  groupOverviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  groupOverviewBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
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
  balanceCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
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
    fontWeight: 'bold',
  },
  balanceDetails: {
    flex: 1,
  },
  balanceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  balanceDescription: {
    fontSize: 12,
    marginBottom: 2,
  },
  balanceGroup: {
    fontSize: 12,
    fontWeight: '500',
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  remindButton: {
    flex: 0.4,
  },
  settleButton: {
    flex: 0.6,
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
  
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    flex: 1,
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reminderOptions: {
    gap: 16,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  reminderOptionContent: {
    flex: 1,
  },
  reminderOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  reminderOptionSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
});