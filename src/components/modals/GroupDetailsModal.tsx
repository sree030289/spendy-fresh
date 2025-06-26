// src/components/modals/GroupDetailsModal.tsx - REDESIGNED VERSION
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  TextInput,
  Linking,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import useBalances from '@/hooks/useBalances';
import { Button } from '@/components/common/Button';
import { Group, Expense, SplittingService, Friend } from '@/services/firebase/splitting';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import ExpenseRefreshService from '@/services/expenseRefreshService';
import * as Contacts from 'expo-contacts';
import QRCodeModal from './QRCodeModal';
import EditExpenseModal from './EditExpenseModal';
import ExpenseModal from './ExpenseModal';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { getCurrencySymbol } from '@/utils/currency';
import { User } from '@/types';
import ExpenseSettlementModal from './ExpenseSettlementModal';
import SimpleExpenseListModal from './SimpleExpenseListModal';

const { width, height } = Dimensions.get('window');

interface GroupDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  group: Group | null;
  currentUser: User | null;
  onAddExpense?: () => void;
  onOpenChat?: () => void;
  onGroupLeft?: () => void;
  onEditExpense?: (expense: Expense) => void;
  onRefresh?: () => void;
  friends?: Friend[];
}

export default function GroupDetailsModal({ 
  visible, 
  onClose, 
  group, 
  currentUser,
  onAddExpense,
  onOpenChat,
  onGroupLeft,
  onEditExpense,
  onRefresh,
  friends = []
}: GroupDetailsModalProps) {
  const { theme } = useTheme();
  const { calculateGroupBalance } = useBalances();
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'members' | 'settings'>('expenses');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showInviteContact, setShowInviteContact] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedMemberForAction, setSelectedMemberForAction] = useState<string | null>(null);
  const [showGroupExpenseModal, setShowGroupExpenseModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showSimpleExpenseList, setShowSimpleExpenseList] = useState(false);
  const [expenseListGroupId, setExpenseListGroupId] = useState<string | undefined>(undefined);
  const [expenseListTitle, setExpenseListTitle] = useState('All Expenses');
  
  // Member balances state
  const [memberBalances, setMemberBalances] = useState<Map<string, number>>(new Map());
  const [renderKey, setRenderKey] = useState(0);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Local state for group data to enable real-time updates
  const [localGroupData, setLocalGroupData] = useState<Group | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const isUserAdmin = localGroupData?.members?.find(member => 
    member.userId === currentUser?.id
  )?.role === 'admin';

  const loadGroupExpenses = useCallback(async () => {
    if (!localGroupData) return;
    
    setLoading(true);
    try {
      console.log('Loading expenses for group:', localGroupData.id);
      const expenses = await SplittingService.getGroupExpenses(localGroupData.id);
      console.log('Loaded expenses:', expenses.length);
      setGroupExpenses(expenses);
    } catch (error) {
      console.error('Load group expenses error:', error);
      setGroupExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [localGroupData]);

  const loadGroupData = useCallback(async () => {
    if (!group?.id) return;
    
    try {
      console.log('Loading fresh group data for:', group.id);
      const freshGroupData = await SplittingService.getGroup(group.id);
      if (freshGroupData) {
        setLocalGroupData(freshGroupData);
        console.log('Updated local group data with', freshGroupData.members.length, 'members');
      }
    } catch (error) {
      console.error('Load group data error:', error);
      setLocalGroupData(group);
    }
  }, [group]);

  // Calculate member balances from current user's perspective
  const calculateMemberBalances = useCallback(async () => {
    if (!localGroupData || !currentUser?.id || !calculateGroupBalance) {
      console.log('❌ calculateMemberBalances: Missing prerequisites');
      console.log('  localGroupData:', !!localGroupData);
      console.log('  currentUser.id:', !!currentUser?.id);
      console.log('  calculateGroupBalance:', !!calculateGroupBalance);
      return;
    }
    
    console.log('🔄 Calculating member balances for group:', localGroupData.name);
    console.log('👥 Group has', localGroupData.members.length, 'members');
    
    const newBalances = new Map<string, number>();
    
    for (const member of localGroupData.members) {
      if (member.userId === currentUser.id) {
        // Current user's balance is always 0 from their own perspective
        newBalances.set(member.userId, 0);
        console.log(`⏭️  Current user (${member.userData.fullName}): 0`);
        continue;
      }
      
      try {
        console.log(`🔍 Calculating balance with ${member.userData.fullName} (${member.userId})`);
        const balance = await calculateGroupBalance(currentUser.id, member.userId, localGroupData.id);
        newBalances.set(member.userId, balance);
        console.log(`💰 Balance with ${member.userData.fullName}: ${balance}`);
      } catch (error) {
        console.error(`❌ Error calculating balance with ${member.userData.fullName}:`, error);
        newBalances.set(member.userId, 0);
        console.log(`⚠️  Defaulting balance with ${member.userData.fullName} to 0`);
      }
    }
    
    console.log('🔄 Setting new member balances...');
    setMemberBalances(newBalances);
    console.log('✅ Member balances calculated');
    console.log('🔍 Final calculated balances:');
    for (const [userId, balance] of newBalances.entries()) {
      const member = localGroupData.members.find(m => m.userId === userId);
      const name = member?.userData.fullName || userId;
      console.log(`   ${name}: ${balance}`);
    }
    
    // Force a re-render by updating a dummy state to ensure UI updates
    setRenderKey(prev => prev + 1);
  }, [localGroupData, currentUser?.id, calculateGroupBalance]);

  // Animation effects
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  // Sync local group data with prop changes
  useEffect(() => {
    console.log('📊 GroupDetailsModal: group prop changed:', group?.name, group?.id);
    if (group) {
      setLocalGroupData(group);
      console.log('✅ GroupDetailsModal: localGroupData set');
    }
  }, [group]);

  useEffect(() => {
    if (visible && group) {
      loadGroupData();
    }
  }, [visible, loadGroupData]);

  useEffect(() => {
    if (!visible || !localGroupData) {
      return undefined;
    }
    
    loadGroupExpenses();
    calculateMemberBalances(); // Add balance calculation
    
    const refreshInterval = setInterval(() => {
      if (visible && localGroupData) {
        loadGroupExpenses();
        calculateMemberBalances();
      }
    }, 5000);
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [visible, localGroupData?.id, loadGroupExpenses, calculateMemberBalances]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    
    const refreshService = ExpenseRefreshService.getInstance();
    const unsubscribe = refreshService.addListener(() => {
      console.log('Group details received expense refresh notification');
      if (localGroupData) {
        loadGroupExpenses();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visible, localGroupData?.id, loadGroupExpenses]);

  // Add timeout effect to prevent modal from getting stuck in loading state
  useEffect(() => {
    if (!visible || localGroupData) {
      setLoadingTimeout(false);
      return;
    }

    const timeout = setTimeout(() => {
      if (!localGroupData) {
        setLoadingTimeout(true);
        console.warn('GroupDetailsModal: Loading timeout reached');
      }
    }, 5000); // 5 second timeout

    return () => {
      clearTimeout(timeout);
    };
  }, [visible, localGroupData]);

  const handleRefresh = async () => {
    await loadGroupExpenses();
  };

  const handleShareInviteCode = async () => {
    if (!localGroupData) return;
    
    try {
      await Share.share({
        message: `Join "${localGroupData.name}" on Spendy! Use invite code: ${localGroupData.inviteCode}\n\nDownload Spendy: https://spendy.app/join/${localGroupData.inviteCode}`,
        title: `Join ${localGroupData.name} on Spendy`
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${localGroupData?.name}"? You'll lose access to all group expenses and conversations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              if (localGroupData && currentUser) {
                await SplittingService.leaveGroup(localGroupData.id, currentUser.id);
                Alert.alert('Left Group', `You have left "${localGroupData.name}"`);
                onGroupLeft?.();
                onClose();
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave group');
            }
          }
        }
      ]
    );
  };

  const handleMakeAdmin = async (userId: string) => {
    if (!localGroupData || !currentUser || !isUserAdmin) return;
    
    try {
      await SplittingService.updateMemberRole(localGroupData.id, userId, 'admin');
      Alert.alert('Success', 'Member has been made an admin');
      await loadGroupData();
      onRefresh?.();
      await loadGroupExpenses();
    } catch (error: any) {
      console.error('Make admin error:', error);
      Alert.alert('Error', error.message || 'Failed to make member admin');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!localGroupData || !currentUser || !isUserAdmin) return;
    
    const member = localGroupData.members.find(m => m.userId === userId);
    if (!member) return;
    
    if (member.balance !== 0) {
      Alert.alert(
        'Cannot Remove Admin',
        `${member.userData.fullName} has pending balances (${member.balance > 0 ? 'owes' : 'is owed'} ${getCurrencySymbol(localGroupData.currency)}${Math.abs(member.balance).toFixed(2)}). Please settle all expenses before removing admin privileges.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    Alert.alert(
      'Remove Admin Privileges',
      `Remove admin privileges from ${member.userData.fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Admin',
          style: 'destructive',
          onPress: async () => {
            try {
              await SplittingService.updateMemberRole(localGroupData.id, userId, 'member');
              Alert.alert('Success', 'Admin privileges removed');
              await loadGroupData();
              onRefresh?.();
              await loadGroupExpenses();
            } catch (error: any) {
              console.error('Remove admin error:', error);
              Alert.alert('Error', error.message || 'Failed to remove admin privileges');
            }
          }
        }
      ]
    );
  };

  const handleRemoveMember = async (userId: string) => {
    if (!localGroupData || !currentUser || !isUserAdmin) return;
    
    const member = localGroupData.members.find(m => m.userId === userId);
    if (!member) return;
    
    if (member.balance !== 0) {
      Alert.alert(
        'Cannot Remove Member',
        `${member.userData.fullName} has pending balances. Please settle all expenses before removing them from the group.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.userData.fullName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await SplittingService.removeMemberFromGroup(localGroupData.id, userId);
              Alert.alert('Success', 'Member has been removed from the group');
              await loadGroupData();
              onRefresh?.();
              await loadGroupExpenses();
            } catch (error: any) {
              console.error('Remove member error:', error);
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          }
        }
      ]
    );
  };

  const handleAddFriendToGroup = async (friendId: string) => {
    if (!localGroupData || !currentUser) return;
    
    try {
      await SplittingService.addGroupMember(localGroupData.id, friendId);
      Alert.alert('Success', 'Friend has been added to the group');
      setShowAddMember(false);
      await loadGroupData();
      onRefresh?.();
      await loadGroupExpenses();
      
      const refreshService = ExpenseRefreshService.getInstance();
      refreshService.notifyExpenseAdded();
      
    } catch (error: any) {
      console.error('Add friend to group error:', error);
      Alert.alert('Error', error.message || 'Failed to add friend to group');
    }
  };

  const handleInviteFromContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to contacts to invite friends.'
        );
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      if (data.length > 0) {
        await handleShareInviteCode();
      } else {
        Alert.alert('No Contacts', 'No contacts found on your device.');
      }
    } catch (error) {
      console.error('Error accessing contacts:', error);
      Alert.alert('Error', 'Failed to access contacts. Please try again.');
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowEditExpense(true);
  };

  const handleExpenseUpdated = async (expenseData: any) => {
    try {
      setShowEditExpense(false);
      setSelectedExpense(null);
      await loadGroupExpenses();
    } catch (error) {
      console.error('Error after expense update:', error);
    }
  };

  const renderExpenseCard = (expense: Expense, index: number) => {
    const hasUpdated = expense.updatedAt && expense.createdAt;
    const timeDiff = hasUpdated ? Math.abs(expense.updatedAt.getTime() - expense.createdAt.getTime()) : 0;
    const isEdited = hasUpdated && timeDiff > 1000;

    return (
      <TouchableOpacity
        key={expense.id}
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        onPress={() => handleEditExpense(expense)}
        activeOpacity={0.7}
      >
        <View style={styles.expenseRow}>
          <View style={[styles.expenseIcon, { backgroundColor: theme.colors.background }]}>
            <Text style={styles.expenseIconText}>{expense.categoryIcon}</Text>
          </View>
          <View style={styles.expenseDetails}>
            <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
              {expense.description}
            </Text>
            <View style={styles.expenseMeta}>
              <Text style={[styles.expenseMetaText, { color: theme.colors.textSecondary }]}>
                {expense.date.toLocaleDateString()} • {expense.paidByData?.fullName || 'Unknown'}
              </Text>
              {isEdited && (
                <View style={[styles.editedBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="create" size={10} color="#D97706" />
                  <Text style={[styles.editedText, { color: '#D97706' }]}>Edited</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
            {getCurrencySymbol(localGroupData?.currency || 'USD')}{expense.amount.toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMemberCard = (member: any, index: number) => {
    // Get calculated balance from our state instead of member.balance
    const calculatedBalance = memberBalances.get(member.userId) || 0;
    console.log(`🎨 Rendering member card for ${member.userData.fullName}: balance = ${calculatedBalance}`);
    
    return (
      <TouchableOpacity
        key={member.userId}
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        onPress={() => isUserAdmin && member.userId !== currentUser?.id ? setSelectedMemberForAction(member.userId) : null}
        activeOpacity={isUserAdmin && member.userId !== currentUser?.id ? 0.7 : 1}
      >
        <View style={styles.memberRow}>
          <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.memberAvatarText}>
              {member.userData.fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: theme.colors.text }]}>
              {member.userId === currentUser?.id ? 'You' : member.userData.fullName}
            </Text>
            <View style={styles.memberRole}>
              <Text style={[styles.memberRoleText, { color: theme.colors.textSecondary }]}>
                {member.role === 'admin' ? '👑 Admin' : '👤 Member'}
              </Text>
            </View>
          </View>
          <View style={styles.memberBalance}>
            {Math.abs(calculatedBalance) < 0.01 ? (
              <>
                <Text style={[styles.balanceAmount, { color: theme.colors.textSecondary }]}>
                  $0.00
                </Text>
                <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
                  Settled
                </Text>
              </>
            ) : calculatedBalance > 0 ? (
              <>
                <Text style={[styles.balanceAmount, styles.balancePositive]}>
                  +{getCurrencySymbol(localGroupData?.currency || 'USD')}{Math.abs(calculatedBalance).toFixed(2)}
                </Text>
                <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
                  Owed to you
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.balanceAmount, styles.balanceNegative]}>
                  -{getCurrencySymbol(localGroupData?.currency || 'USD')}{Math.abs(calculatedBalance).toFixed(2)}
                </Text>
                <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
                  Owes
                </Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading state if modal is visible but no data yet
  if (visible && !localGroupData) {
    console.log('⏳ GroupDetailsModal: Showing loading state');
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', minHeight: 300 }]}>
            <TouchableOpacity 
              style={[styles.closeBtn, { position: 'absolute', top: 20, right: 20, backgroundColor: theme.colors.surface }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            
            {loadingTimeout ? (
              <>
                <Ionicons name="warning" size={48} color={theme.colors.error} />
                <Text style={[styles.loadingText, { color: theme.colors.text, marginTop: 16, textAlign: 'center' }]}>
                  Failed to load group details
                </Text>
                <TouchableOpacity 
                  style={[styles.retryButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
                  onPress={() => {
                    setLoadingTimeout(false);
                    if (group) {
                      setLocalGroupData(group);
                    }
                  }}
                >
                  <Text style={[styles.retryButtonText, { color: 'white' }]}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.text, marginTop: 16 }]}>Loading group details...</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // Don't render anything if modal is not visible or no group data
  if (!visible || !localGroupData) {
    console.log('❌ GroupDetailsModal: Not rendering - visible:', visible, 'localGroupData:', !!localGroupData);
    return null;
  }

  const slideTransform = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.colors.background }]}>
        <Animated.View 
          style={[
            styles.modalContent, 
            { 
              backgroundColor: theme.colors.background,
              transform: [{ translateY: slideTransform }],
              opacity: fadeAnim
            }
          ]}
        >
          {/* Header with Gradient */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.closeBtn}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
            
            <View style={styles.groupHeader}>
              <View style={styles.groupAvatar}>
                <Text style={styles.groupAvatarText}>{localGroupData.avatar}</Text>
              </View>
              <Text style={styles.groupName}>{localGroupData.name}</Text>
              {localGroupData.description && (
                <Text style={styles.groupDescription}>{localGroupData.description}</Text>
              )}
              
              <View style={styles.groupBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    📅 {localGroupData.createdAt.toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>💰 {localGroupData.currency}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>👥 {localGroupData.members.length} members</Text>
                </View>
              </View>
              
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {getCurrencySymbol(localGroupData.currency)}{localGroupData.totalExpenses.toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>Total Spent</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {getCurrencySymbol(localGroupData.currency)}{(localGroupData.totalExpenses / localGroupData.members.length).toFixed(2)}
                  </Text>
                  <Text style={styles.statLabel}>Per Person</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{groupExpenses.length}</Text>
                  <Text style={styles.statLabel}>Expenses</Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Content */}
          <View style={[styles.content, { backgroundColor: theme.colors.background }]}>
            {/* Tabs */}
            <View style={[styles.tabs, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              {['expenses', 'members', 'settings'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    activeTab === tab && { borderBottomColor: theme.colors.primary }
                  ]}
                  onPress={() => setActiveTab(tab as any)}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === tab ? theme.colors.primary : theme.colors.textSecondary }
                  ]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Tab Content */}
            <ScrollView 
              style={{ maxHeight: height * 0.6 }}
              contentContainerStyle={styles.tabContent} 
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'expenses' && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                      Recent Expenses
                    </Text>
                    <View style={styles.headerActions}>
                      <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
                        <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                      </TouchableOpacity>
                      {groupExpenses.length > 0 && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                          onPress={() => {
                            setExpenseListGroupId(localGroupData?.id);
                            setExpenseListTitle(`${localGroupData?.name} Expenses`);
                            setShowSimpleExpenseList(true);
                          }}
                        >
                          <Text style={styles.actionBtnText}>View All</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={onAddExpense}
                      >
                        <Text style={styles.actionBtnText}>+ Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                        Loading expenses...
                      </Text>
                    </View>
                  ) : groupExpenses.length === 0 ? (
                    <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                      <Text style={styles.emptyIcon}>📋</Text>
                      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                        No expenses yet
                      </Text>
                      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                        Add your first expense to start tracking
                      </Text>
                    </View>
                  ) : (
                    groupExpenses.slice(0, 10).map((expense, index) => renderExpenseCard(expense, index))
                  )}
                </View>
              )}
              
              {activeTab === 'members' && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                      Group Members
                    </Text>
                    {isUserAdmin && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={() => setShowAddMember(true)}
                      >
                        <Text style={styles.actionBtnText}>+ Add Member</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {localGroupData.members.map((member, index) => renderMemberCard(member, index))}
                </View>
              )}
              
              {activeTab === 'settings' && (
                <View>
                  <View style={[styles.settingsSection, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.settingsTitle, { color: theme.colors.text }]}>
                      Invite Friends
                    </Text>
                    <View style={[styles.inviteCodeDisplay, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                      <Text style={[styles.inviteCode, { color: theme.colors.primary }]}>
                        {localGroupData.inviteCode}
                      </Text>
                      <Text style={[styles.inviteHint, { color: theme.colors.textSecondary }]}>
                        Share this code to invite friends
                      </Text>
                    </View>
                    <View style={styles.buttonGroup}>
                      <TouchableOpacity
                        style={[styles.secondaryBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                        onPress={() => Alert.alert('Copied!', 'Invite code copied to clipboard')}
                      >
                        <Ionicons name="copy" size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.secondaryBtnText, { color: theme.colors.textSecondary }]}>
                          Copy Code
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={() => setShowQRModal(true)}
                      >
                        <Ionicons name="qr-code" size={16} color="white" />
                        <Text style={styles.primaryBtnText}>QR Code</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={[styles.settingsSection, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.settingsTitle, { color: theme.colors.text }]}>
                      Group Actions
                    </Text>
                    <TouchableOpacity
                      style={[styles.actionRow, { borderBottomColor: theme.colors.border }]}
                      onPress={handleShareInviteCode}
                    >
                      <Ionicons name="share" size={20} color={theme.colors.textSecondary} />
                      <Text style={[styles.actionRowText, { color: theme.colors.text }]}>
                        Share Invite Link
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionRow}
                      onPress={() => Alert.alert('Export', 'Feature coming soon!')}
                    >
                      <Ionicons name="download" size={20} color={theme.colors.textSecondary} />
                      <Text style={[styles.actionRowText, { color: theme.colors.text }]}>
                        Export Group Data
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.dangerSection}>
                    <TouchableOpacity
                      style={[styles.dangerBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                      onPress={handleLeaveGroup}
                    >
                      <Ionicons name="exit" size={20} color="#DC2626" />
                      <Text style={[styles.dangerBtnText, { color: '#DC2626' }]}>
                        Leave Group
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </SafeAreaView>
      
      {/* All Modals */}
      {selectedMemberForAction && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.actionModalContent, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.actionModalTitle, { color: theme.colors.text }]}>
                Member Actions
              </Text>
              
              {(() => {
                const member = localGroupData?.members.find(m => m.userId === selectedMemberForAction);
                return member ? (
                  <>
                    <TouchableOpacity
                      style={styles.actionModalOption}
                      onPress={() => {
                        setSelectedMemberForAction(null);
                        if (member.role === 'admin') {
                          handleRemoveAdmin(selectedMemberForAction);
                        } else {
                          handleMakeAdmin(selectedMemberForAction);
                        }
                      }}
                    >
                      <Ionicons 
                        name={member.role === 'admin' ? 'person-remove' : 'ribbon'} 
                        size={20} 
                        color={theme.colors.primary} 
                      />
                      <Text style={[styles.actionModalOptionText, { color: theme.colors.text }]}>
                        {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.actionModalOption}
                      onPress={() => {
                        setSelectedMemberForAction(null);
                        handleRemoveMember(selectedMemberForAction);
                      }}
                    >
                      <Ionicons name="person-remove" size={20} color="#DC2626" />
                      <Text style={[styles.actionModalOptionText, { color: '#DC2626' }]}>
                        Remove from Group
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null;
              })()}
              
              <TouchableOpacity
                style={[styles.actionModalOption, styles.cancelOption]}
                onPress={() => setSelectedMemberForAction(null)}
              >
                <Text style={[styles.actionModalOptionText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={[styles.addMemberModal, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <TouchableOpacity onPress={() => setShowAddMember(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>
                Add Member
              </Text>
              <View style={{ width: 24 }} />
            </View>
            
            <ScrollView style={styles.addMemberContent}>
              <View style={[styles.inviteSection, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Invite New Users
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  Invite friends who don't have the app yet
                </Text>
                
                <TouchableOpacity
                  style={[styles.inviteContactsBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleInviteFromContacts}
                >
                  <Ionicons name="person-add" size={20} color="white" />
                  <Text style={styles.inviteContactsBtnText}>
                    Invite from Contacts
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>
                Your Friends
              </Text>
              
              {friends.filter(friend => 
                friend.status === 'accepted' && 
                !localGroupData?.members.some(member => member.userId === friend.friendId)
              ).length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                    No friends to add
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                    All your friends are already in this group
                  </Text>
                </View>
              ) : (
                friends
                  .filter(friend => 
                    friend.status === 'accepted' && 
                    !localGroupData?.members.some(member => member.userId === friend.friendId)
                  )
                  .map((friend) => (
                    <TouchableOpacity
                      key={friend.id}
                      style={[styles.card, { backgroundColor: theme.colors.surface }]}
                      onPress={() => handleAddFriendToGroup(friend.friendId)}
                    >
                      <View style={styles.friendRow}>
                        <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.memberAvatarText}>
                            {friend.friendData.fullName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={[styles.memberName, { color: theme.colors.text }]}>
                            {friend.friendData.fullName}
                          </Text>
                          <Text style={[styles.friendEmail, { color: theme.colors.textSecondary }]}>
                            {friend.friendData.email}
                          </Text>
                        </View>
                        <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <QRCodeModal
          visible={showQRModal}
          onClose={() => setShowQRModal(false)}
          user={currentUser}
          selectedGroup={localGroupData}
        />
      )}

      {/* Edit Expense Modal */}
      {showEditExpense && selectedExpense && (
        <EditExpenseModal
          visible={showEditExpense}
          onClose={() => setShowEditExpense(false)}
          expense={selectedExpense}
          onSubmit={handleExpenseUpdated}
          groups={[localGroupData]}
        />
      )}

      {/* Group Expense Modal */}
      {showGroupExpenseModal && (
        <ExpenseModal
          visible={showGroupExpenseModal}
          onClose={() => setShowGroupExpenseModal(false)}
          groupId={localGroupData?.id}
        />
      )}

      {/* Simple Expense List Modal */}
      <SimpleExpenseListModal
        visible={showSimpleExpenseList}
        onClose={() => setShowSimpleExpenseList(false)}
        groupId={expenseListGroupId}
        title={expenseListTitle}
        onExpensePress={(expense) => {
          setShowSimpleExpenseList(false);
          handleEditExpense(expense);
        }}
      />

      {/* Settlement Modal */}
      <ExpenseSettlementModal
        visible={showSettlementModal}
        onClose={() => setShowSettlementModal(false)}
        expense={selectedExpense}
        currentUser={currentUser}
        onSettlementComplete={loadGroupExpenses}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: '#667eea',
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  groupHeader: {
    alignItems: 'center',
    zIndex: 2,
  },
  groupAvatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  groupAvatarText: {
    fontSize: 28,
  },
  groupName: {
    color: 'white',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  groupDescription: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  groupBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    backgroundColor: 'white',
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
    fontWeight: '600',
  },
  tabContent: {
    padding: 24,
    flexGrow: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  expenseIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  expenseIconText: {
    fontSize: 20,
  },
  expenseDetails: {
    flex: 1,
    minWidth: 0,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseMetaText: {
    fontSize: 13,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  editedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  editedText: {
    fontSize: 10,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberRoleText: {
    fontSize: 13,
  },
  memberBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  balancePositive: {
    color: '#059669',
  },
  balanceNegative: {
    color: '#DC2626',
  },
  balanceLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsSection: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  inviteCodeDisplay: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'Monaco',
    marginBottom: 8,
  },
  inviteHint: {
    fontSize: 13,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  actionRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  dangerSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  dangerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerBtnText: {
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    padding: 60,
    borderRadius: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.6,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionModalContent: {
    borderRadius: 12,
    padding: 20,
    minWidth: 280,
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  actionModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  actionModalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelOption: {
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  addMemberModal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addMemberContent: {
    flex: 1,
    padding: 20,
  },
  inviteSection: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  inviteContactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  inviteContactsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  friendEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});