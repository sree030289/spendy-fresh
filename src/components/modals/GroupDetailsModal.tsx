// src/components/modals/GroupDetailsModal.tsx - REDESIGNED VERSION
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  TextInput,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import useBalances from '@/hooks/useBalances';
import { Button } from '@/components/common/Button';
import { Group, Expense, Friend } from '@/services/firebase/splitting-disabled';
import ExpenseRefreshService from '@/services/expenseRefreshService';
import * as Contacts from 'expo-contacts';
import { ApiService } from '@/services/api/ApiService';
import QRCodeModal from './QRCodeModal';
import EditExpenseModal from './EditExpenseModal';
import ExpenseModal from './ExpenseModal';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { getCurrencySymbol } from '@/utils/currency';
import { formatTimestamp } from '@/utils/timestamp';
import { CrossPlatformAlert } from '@/utils/alertUtils';
import { safeGetTime } from '@/utils/timestamp';
import { User } from '@/types';
import ExpenseSettlementModal from './ExpenseSettlementModal';
import SimpleExpenseListModal from './SimpleExpenseListModal';
import { SubscriptionHelper } from '@/utils/SubscriptionHelper';
import { ExportService } from '@/services/ExportService';
import ExportModal from './ExportModal';

const { width, height } = Dimensions.get('window');

// Expense categories for icon lookup
const EXPENSE_CATEGORIES = [
  { id: 'all', name: 'All Categories', icon: '📋', color: '#B0004F' },
  { id: 'food', name: 'Food', icon: '🍕', color: '#F59E0B' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#3B82F6' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#B0004F' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { id: 'utilities', name: 'Utilities', icon: '⚡', color: '#F59E0B' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#EF4444' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#06B6D4' },
  { id: 'settlement', name: 'Settlement', icon: '💸', color: '#10B981' },
  { id: 'other', name: 'Other', icon: '📝', color: '#6B7280' },
];

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
  initialTab?: 'expenses' | 'members' | 'settings';
  onOpenSettlement?: (config: { filter: 'groups'; groupId: string }) => void;
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
  friends = [],
  initialTab = 'expenses',
  onOpenSettlement
}: GroupDetailsModalProps) {
  const { theme } = useTheme();
  const { calculateGroupBalance } = useBalances();
  
  // Initialize API service
  const apiService = ApiService.getInstance();
  
  // Helper function to get category icon
  const getCategoryIcon = (categoryId: string) => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === categoryId)?.icon || '💰';
  };
  
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'members' | 'settings'>(initialTab);
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
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Member balances state
  const [memberBalances, setMemberBalances] = useState<Map<string, number>>(new Map());
  const [renderKey, setRenderKey] = useState(0);
  
  // Local state for group data to enable real-time updates
  const [localGroupData, setLocalGroupData] = useState<Group | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Calculate total expenses
  const totalExpenses = groupExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const perPersonAmount = localGroupData && localGroupData.members && localGroupData.members.length > 0 ? totalExpenses / localGroupData.members.length : 0;
  const subscriptionHelper = SubscriptionHelper.getInstance();

  const isUserAdmin = localGroupData?.members?.find(member => 
    member.userId === currentUser?.id
  )?.role === 'admin';

  const isGroupCreator = localGroupData?.createdBy === currentUser?.id;

  // Check if user is the only active member left in the group
  const activeMembers = localGroupData?.members?.filter(member => member.isActive !== false) || [];
  const isOnlyMemberLeft = activeMembers.length === 1 && activeMembers[0]?.userId === currentUser?.id;

  const loadGroupExpenses = useCallback(async () => {
    if (!localGroupData) return;
    
    setLoading(true);
    try {
      console.log('Loading expenses for group:', localGroupData.id);
      const expenses = await apiService.getGroupExpenses(localGroupData.id);
      console.log('Loaded expenses:', expenses?.length || 0);
      
      // Process and validate expense data
      const processedExpenses = Array.isArray(expenses) ? expenses.map(expense => ({
        ...expense,
        amount: typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount) || 0,
        date: expense.date || new Date().toISOString(),
      })) : [];
      
      console.log('Processed expenses:', processedExpenses);
      if (processedExpenses.length > 0) {
        console.log('First expense sample:', {
          id: processedExpenses[0].id,
          description: processedExpenses[0].description,
          amount: processedExpenses[0].amount,
          date: processedExpenses[0].date,
          paidBy: processedExpenses[0].paidBy,
          paidByData: processedExpenses[0].paidByData
        });
      }
      setGroupExpenses(processedExpenses);
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
      console.log('🔄 Loading fresh group data for:', group.id);
      
      // Force a complete fresh API call by creating a new ApiService instance
      const freshApiService = ApiService.getInstance();
      const freshGroupData = await freshApiService.getGroup(group.id);
      
      if (freshGroupData) {
        // Ensure members array exists and is valid
        if (!freshGroupData.members || !Array.isArray(freshGroupData.members)) {
          console.log('⚠️ API response missing members array, setting empty array');
          freshGroupData.members = [];
        }
        
        console.log('📥 Fresh data received:', {
          id: freshGroupData.id,
          name: freshGroupData.name,
          memberCount: freshGroupData.members.length,
          members: freshGroupData.members.map((m: any) => ({
            userId: m.userId,
            fullName: m.userData?.fullName,
            isActive: m.isActive
          }))
        });
        
        // Force re-render by setting to null first, then the new data
        setLocalGroupData(null);
        
        // Use setTimeout to ensure state update happens in next tick
        setTimeout(() => {
          setLocalGroupData(freshGroupData);
          console.log('✅ Updated local group data with', freshGroupData.members.length, 'members');
          
          // Force recalculation of member balances
          setMemberBalances(new Map());
          
          // Force component re-render with new key
          setRenderKey(prev => prev + 1);
        }, 50);
      }
    } catch (error) {
      console.error('❌ Load group data error:', error);
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
    console.log('👥 Group has', (localGroupData.members || []).length, 'members');
    
    const newBalances = new Map<string, number>();
    
    for (const member of (localGroupData.members || [])) {
      if (member.userId === currentUser.id) {
        // Current user's balance is always 0 from their own perspective
        newBalances.set(member.userId, 0);
        console.log(`⏭️  Current user (${member.userData?.fullName || 'Unknown'}): 0`);
        continue;
      }
      
      try {
        console.log(`🔍 Calculating balance with ${member.userData?.fullName || 'Unknown'} (${member.userId})`);
        const balance = await calculateGroupBalance(currentUser.id, member.userId, localGroupData.id);
        newBalances.set(member.userId, balance);
        console.log(`💰 Balance with ${member.userData?.fullName || 'Unknown'}: ${balance}`);
        console.log(`🔍 Balance calculation details:`, {
          currentUserId: currentUser.id,
          targetUserId: member.userId,
          groupId: localGroupData.id,
          calculatedBalance: balance
        });
      } catch (error) {
        console.error(`❌ Error calculating balance with ${member.userData?.fullName || 'Unknown'}:`, error);
        newBalances.set(member.userId, 0);
        console.log(`⚠️  Defaulting balance with ${member.userData?.fullName || 'Unknown'} to 0`);
      }
    }
    
    console.log('🔄 Setting new member balances...');
    setMemberBalances(newBalances);
    console.log('✅ Member balances calculated');
    console.log('🔍 Final calculated balances:');
    for (const [userId, balance] of newBalances.entries()) {
      const member = (localGroupData.members || []).find(m => m.userId === userId);
      const name = member?.userData?.fullName || userId;
      console.log(`   ${name}: ${balance}`);
    }
    
    // Remove forced re-render to reduce unnecessary refreshing
  }, [localGroupData, currentUser?.id, calculateGroupBalance]);

  // Sync local group data with prop changes
  useEffect(() => {
    console.log('📊 GroupDetailsModal: group prop changed:', {
      groupName: group?.name,
      groupId: group?.id,
      hasGroup: !!group,
      groupKeys: group ? Object.keys(group) : []
    });
    if (group) {
      // Ensure the group has an id field
      if (!group.id) {
        console.error('❌ Group prop is missing id field:', group);
      }
      setLocalGroupData(group);
      console.log('✅ GroupDetailsModal: localGroupData set with id:', group.id);
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
    
    // Only load data when modal becomes visible or group changes
    loadGroupExpenses();
    calculateMemberBalances();
    
    // Remove automatic refresh interval to prevent constant refreshing
    // Users can manually refresh using the refresh button if needed
    
  }, [visible, localGroupData?.id]); // Removed function dependencies to prevent excessive re-renders

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
  }, [visible, localGroupData?.id]); // Removed loadGroupExpenses dependency

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
    // If user is the only active member left, redirect to delete group
    if (isOnlyMemberLeft) {
      handleDeleteGroup();
      return;
    }

    CrossPlatformAlert.alert(
      'Leave Group',
      `Are you sure you want to leave "${localGroupData?.name}"? You'll lose access to all group expenses and conversations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              if (localGroupData && localGroupData.id && currentUser && currentUser.id) {
                console.log('🚪 Leaving group:', {
                  groupId: localGroupData.id,
                  groupName: localGroupData.name,
                  userId: currentUser.id,
                  userEmail: currentUser.email
                });
                await apiService.leaveGroup(localGroupData.id, currentUser.id);
                CrossPlatformAlert.alert('Left Group', `You have left "${localGroupData.name}"`);
                onGroupLeft?.();
                onClose();
              } else if (group && group.id && currentUser && currentUser.id) {
                // Fallback to original group prop if localGroupData.id is missing
                console.log('🚪 Leaving group (fallback to group prop):', {
                  groupId: group.id,
                  groupName: group.name,
                  userId: currentUser.id,
                  userEmail: currentUser.email
                });
                await apiService.leaveGroup(group.id, currentUser.id);
                CrossPlatformAlert.alert('Left Group', `You have left "${group.name}"`);
                onGroupLeft?.();
                onClose();
              } else {
                console.error('❌ Cannot leave group - missing data:', {
                  hasGroupData: !!localGroupData,
                  groupId: localGroupData?.id,
                  groupName: localGroupData?.name,
                  groupKeys: localGroupData ? Object.keys(localGroupData) : [],
                  hasOriginalGroup: !!group,
                  originalGroupId: group?.id,
                  originalGroupKeys: group ? Object.keys(group) : [],
                  hasCurrentUser: !!currentUser,
                  userId: currentUser?.id,
                  fullGroupData: localGroupData
                });
                CrossPlatformAlert.alert('Error', 'Unable to leave group. Missing group or user information.');
              }
            } catch (error: any) {
              console.error('❌ Leave group error:', error);
              CrossPlatformAlert.alert('Error', error.message || 'Failed to leave group');
            }
          }
        }
      ]
    );
  };

  const handleDeleteGroup = () => {
    const groupName = localGroupData?.name || group?.name || 'this group';
    const alertTitle = isOnlyMemberLeft ? 'Delete Group' : 'Delete Group';
    const alertMessage = isOnlyMemberLeft 
      ? `You are the only member left in "${groupName}". The group will be permanently deleted. This action cannot be undone.`
      : `Are you sure you want to permanently delete "${groupName}"? This action cannot be undone and will remove all expenses and data for all members.`;

    CrossPlatformAlert.alert(
      alertTitle,
      alertMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const groupToDelete = localGroupData || group;
              if (groupToDelete && groupToDelete.id && currentUser && currentUser.id) {
                console.log('🗑️ Deleting group:', {
                  groupId: groupToDelete.id,
                  groupName: groupToDelete.name,
                  userId: currentUser.id,
                  userEmail: currentUser.email,
                  isOnlyMemberLeft,
                  activeMembers: activeMembers.length
                });
                
                try {
                  await apiService.deleteGroup(groupToDelete.id);
                  CrossPlatformAlert.alert('Group Deleted', `"${groupToDelete.name}" has been permanently deleted.`);
                } catch (deleteError: any) {
                  console.error('❌ Delete group API error:', deleteError);
                  
                  // Handle specific error cases
                  if (deleteError.message?.includes('404') || deleteError.message?.includes('not found')) {
                    // Group might already be deleted - treat as success
                    console.log('ℹ️ Group already deleted or not found, treating as success');
                    CrossPlatformAlert.alert('Group Removed', `"${groupToDelete.name}" has been removed.`);
                  } else {
                    // For other errors, re-throw to be handled by outer catch
                    throw deleteError;
                  }
                }
                
                onGroupLeft?.();
                onClose();
              } else {
                console.error('❌ Cannot delete group - missing data:', {
                  hasGroupData: !!localGroupData,
                  groupId: localGroupData?.id,
                  hasOriginalGroup: !!group,
                  originalGroupId: group?.id,
                  hasCurrentUser: !!currentUser,
                  userId: currentUser?.id
                });
                CrossPlatformAlert.alert('Error', 'Unable to delete group. Missing group or user information.');
              }
            } catch (error: any) {
              console.error('❌ Delete group error:', error);
              CrossPlatformAlert.alert('Error', error.message || 'Failed to delete group');
            }
          }
        }
      ]
    );
  };

  const handleExportGroup = async () => {
    if (!localGroupData || !currentUser) return;
    
    try {
      // Check if user has export access
      const hasAccess = await subscriptionHelper.checkExportAccess(currentUser.id);
      if (!hasAccess) {
        return; // SubscriptionHelper will show the subscription modal
      }
      
      setShowExportModal(true);
    } catch (error) {
      console.error('Export group error:', error);
      CrossPlatformAlert.alert('Error', 'Failed to access export feature');
    }
  };

  const handleExportComplete = async (format: 'csv' | 'pdf') => {
    try {
      if (!localGroupData) return;
      
      await ExportService.exportGroupData(localGroupData, format);
      CrossPlatformAlert.alert('Export Complete! 📄', `Group data exported as ${format.toUpperCase()} file`);
      setShowExportModal(false);
      
    } catch (error: any) {
      console.error('Export error:', error);
      CrossPlatformAlert.alert('Export Failed', error.message || 'Failed to export group data');
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    if (!localGroupData || !currentUser || !isUserAdmin) return;
    
    try {
      await apiService.updateMemberRole(localGroupData.id, userId, 'admin');
      CrossPlatformAlert.alert('Success', 'Member has been made an admin');
      await loadGroupData();
      onRefresh?.();
      await loadGroupExpenses();
    } catch (error: any) {
      console.error('Make admin error:', error);
      CrossPlatformAlert.alert('Error', error.message || 'Failed to make member admin');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!localGroupData || !currentUser || !isUserAdmin) return;
    
    const member = (localGroupData.members || []).find(m => m.userId === userId);
    if (!member) return;
    
    if (member.balance !== 0) {
      CrossPlatformAlert.alert(
        'Cannot Remove Admin',
        `${member.userData?.fullName || 'This member'} has pending balances (${member.balance > 0 ? 'owes' : 'is owed'} ${getCurrencySymbol(localGroupData?.currency || 'USD')}${Math.abs(member.balance).toFixed(2)}). Please settle all expenses before removing admin privileges.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    CrossPlatformAlert.alert(
      'Remove Admin Privileges',
      `Remove admin privileges from ${member.userData?.fullName || 'this member'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Admin',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.updateMemberRole(localGroupData.id, userId, 'member');
              CrossPlatformAlert.alert('Success', 'Admin privileges removed');
              await loadGroupData();
              onRefresh?.();
              await loadGroupExpenses();
            } catch (error: any) {
              console.error('Remove admin error:', error);
              CrossPlatformAlert.alert('Error', error.message || 'Failed to remove admin privileges');
            }
          }
        }
      ]
    );
  };

  const handleRemoveMember = async (userId: string) => {
    console.log('🔄 handleRemoveMember called with userId:', userId);
    console.log('🔍 Debug info:', {
      hasGroupData: !!localGroupData,
      hasCurrentUser: !!currentUser,
      isUserAdmin,
      currentUserId: currentUser?.id
    });
    
    if (!localGroupData || !currentUser || !isUserAdmin) {
      console.log('❌ Early return due to missing data or not admin');
      return;
    }
    
    const member = (localGroupData.members || []).find(m => m.userId === userId);
    console.log('👤 Found member:', member);
    if (!member) {
      console.log('❌ Member not found');
      return;
    }
    
    console.log('💰 Member balance:', member.balance);
    if (member.balance !== 0) {
      console.log('❌ Cannot remove member - has pending balance:', member.balance);
      CrossPlatformAlert.alert(
        'Cannot Remove Member',
        `${member.userData?.fullName || 'This member'} has pending balances. Please settle all expenses before removing them from the group.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    console.log('✅ Member balance is 0 - showing confirmation dialog');
    CrossPlatformAlert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.userData?.fullName || 'this member'} from the group?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('🚫 User cancelled member removal')
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('�️ Starting member removal for userId:', userId, 'from group:', localGroupData.id);
              console.log('🔄 Clearing local state and forcing refresh...');
              
              // Clear state immediately 
              setLocalGroupData(null);
              setRenderKey(prev => prev + 1);
              
              // Create new API service instance to bypass any caching
              const freshApiService = new ApiService();
              await freshApiService.removeMemberFromGroup(localGroupData.id, userId);
              console.log('� API Response - Member removed successfully');
              
              // Force complete refresh with timeout
              setTimeout(async () => {
                console.log('🎯 Force refreshing with fresh data...');
                await loadGroupData();
                onRefresh?.();
                setRenderKey(prev => prev + 1);
                console.log('✅ Group refresh completed with renderKey:', renderKey + 1);
              }, 500);
              
              CrossPlatformAlert.alert('Success', 'Member has been removed from the group');
            } catch (error: any) {
              console.error('❌ Remove member error:', error);
              CrossPlatformAlert.alert('Error', error.message || 'Failed to remove member');
            }
          }
        }
      ]
    );
  };

  const handleAddFriendToGroup = async (friendId: string) => {
    if (!localGroupData || !currentUser) return;
    
    try {
      await apiService.addGroupMember(localGroupData.id, friendId, 'member');
      CrossPlatformAlert.alert('Success', 'Friend has been added to the group');
      setShowAddMember(false);
      await loadGroupData();
      onRefresh?.();
      await loadGroupExpenses();
      
      const refreshService = ExpenseRefreshService.getInstance();
      refreshService.notifyExpenseAdded();
      
    } catch (error: any) {
      console.error('Add friend to group error:', error);
      CrossPlatformAlert.alert('Error', error.message || 'Failed to add friend to group');
    }
  };

  const handleAddPendingFriendToGroup = async (friend: Friend) => {
    if (!localGroupData || !currentUser) return;
    
    CrossPlatformAlert.alert(
      'Add Pending Friend',
      `${friend.friendData?.fullName || friend.friendData?.email || 'This friend'} hasn't accepted your friend request yet. They will be added to the group once they accept the friend request.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Anyway',
          onPress: async () => {
            try {
              // Add them to the group even though they're pending
              await apiService.addGroupMember(localGroupData.id, friend.friendId, 'member');
              CrossPlatformAlert.alert('Success', `${friend.friendData?.fullName || friend.friendData?.email || 'Friend'} has been added to the group. They'll see it once they accept your friend request.`);
              setShowAddMember(false);
              await loadGroupData();
              onRefresh?.();
              await loadGroupExpenses();
              
              const refreshService = ExpenseRefreshService.getInstance();
              refreshService.notifyExpenseAdded();
              
            } catch (error: any) {
              console.error('Add pending friend to group error:', error);
              CrossPlatformAlert.alert('Error', error.message || 'Failed to add friend to group');
            }
          }
        }
      ]
    );
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
    const updatedTime = safeGetTime(expense.updatedAt);
    const createdTime = safeGetTime(expense.createdAt);
    const timeDiff = hasUpdated && updatedTime && createdTime ? Math.abs(updatedTime - createdTime) : 0;
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
            <Text style={styles.expenseIconText}>{getCategoryIcon(expense.category)}</Text>
          </View>
          <View style={styles.expenseDetails}>
            <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
              {expense.description}
            </Text>
            <View style={styles.expenseMeta}>
              <Text style={[styles.expenseMetaText, { color: theme.colors.textSecondary }]}>
                {formatTimestamp(expense.date, 'Unknown Date')} • {(() => {
                  // Try to get user name from expense.paidByData first, then from group members
                  if (expense.paidByData?.fullName) {
                    return expense.paidByData.fullName;
                  }
                  if (expense.paidBy && localGroupData?.members) {
                    const member = (localGroupData.members || []).find(m => m.userId === expense.paidBy);
                    if (member?.userData?.fullName) return member.userData.fullName;
                  }
                  return 'Unknown User';
                })()}
              </Text>
              {isEdited && (
                <View style={[styles.editedBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Icon name="edit" size={10} color="#D97706"  />
                  <Text style={[styles.editedText, { color: '#D97706' }]}>Edited</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
            {getCurrencySymbol(localGroupData?.currency || 'USD')}{
              isNaN(expense.amount) ? '0.00' : (expense.amount || 0).toFixed(2)
            }
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMemberCard = (member: any, index: number) => {
    // Safety check for member object
    if (!member || !member.userId) {
      console.warn('⚠️ renderMemberCard: Invalid member data:', member);
      return null;
    }
    
    // Get calculated balance from our state instead of member.balance
    const calculatedBalance = memberBalances.get(member.userId) || 0;
    console.log(`🎨 Rendering member card for ${member.userData?.fullName || 'Unknown'}: balance = ${calculatedBalance}`);
    console.log('👤 Member data structure:', {
      userId: member.userId,
      userData: member.userData,
      role: member.role,
      isActive: member.isActive
    });
    
    // For current user, always show settled
    const isCurrentUser = member.userId === currentUser?.id;
    
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
              {(() => {
                const name = member.userData?.fullName || member.userData?.email || 'U';
                console.log('🔤 Member avatar name:', name, 'for member:', member.userId);
                return name.charAt(0).toUpperCase();
              })()}
            </Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: theme.colors.text }]}>
              {isCurrentUser ? 'You' : (member.userData?.fullName || 'Unknown')}
            </Text>
            <View style={styles.memberRole}>
              <Text style={[styles.memberRoleText, { color: theme.colors.textSecondary }]}>
                {member.role === 'admin' ? '👑 Admin' : '👤 Member'}
              </Text>
            </View>
          </View>
          <View style={styles.memberBalance}>
            {isCurrentUser ? (
              // Current user always shows settled since we calculate from their perspective
              <>
                <Text style={[styles.balanceAmount, { color: theme.colors.textSecondary }]}>
                  {getCurrencySymbol(localGroupData?.currency || 'USD')}0.00
                </Text>
                <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
                  Settled
                </Text>
              </>
            ) : Math.abs(calculatedBalance) < 0.01 ? (
              // Other members with no balance
              <>
                <Text style={[styles.balanceAmount, { color: theme.colors.textSecondary }]}>
                  {getCurrencySymbol(localGroupData?.currency || 'USD')}0.00
                </Text>
                <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
                  Settled
                </Text>
              </>
            ) : calculatedBalance > 0 ? (
              // Positive balance: this member owes the current user
              <>
                <Text style={[styles.balanceAmount, styles.balancePositive]}>
                  +{getCurrencySymbol(localGroupData?.currency || 'USD')}{Math.abs(calculatedBalance).toFixed(2)}
                </Text>
                <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
                  Owes you
                </Text>
              </>
            ) : (
              // Negative balance: current user owes this member
              <>
                <Text style={[styles.balanceAmount, styles.balanceNegative]}>
                  {getCurrencySymbol(localGroupData?.currency || 'USD')}{Math.abs(calculatedBalance).toFixed(2)}
                </Text>
                <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
                  You owe
                </Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading state if visible but no data yet
  if (visible && !localGroupData) {
    console.log('⏳ GroupDetailsModal: Showing loading state');
    return (
      <View style={[styles.fullScreenContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.loadingContainer, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
          <TouchableOpacity 
            style={[styles.backBtn, { position: 'absolute', top: 60, left: 20, backgroundColor: theme.colors.surface }]}
            onPress={onClose}
          >
            <Icon name="back" size={20} color={theme.colors.text}  />
          </TouchableOpacity>
          
          {loadingTimeout ? (
            <>
              <Icon name="warning" size={48} color={theme.colors.error}  />
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
    );
  }

  // Don't render anything if not visible or no group data
  if (!visible || !localGroupData) {
    console.log('❌ GroupDetailsModal: Not rendering - visible:', visible, 'localGroupData:', !!localGroupData);
    return null;
  }

  return (
    <View style={[styles.fullScreenContainer, { backgroundColor: theme.colors.background }]}>
      <View 
        style={[
          styles.modalContent, 
          { 
            backgroundColor: theme.colors.background
          }
        ]}
      >
        {/* Header with Gradient */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={onClose}
          >
            <Icon name="back" size={20} color="white"  />
          </TouchableOpacity>
          
          {/* Settle Button - Top Right */}
          <TouchableOpacity 
            style={styles.settleBtn}
            onPress={() => {
              if (onOpenSettlement && localGroupData?.id) {
                onClose();
                // Small delay to allow modal to close before opening settlement
                setTimeout(() => {
                  onOpenSettlement({
                    filter: 'groups',
                    groupId: localGroupData.id
                  });
                }, 100);
              }
            }}
          >
            <Icon name="receipt" size={18} color="white"  />
            <Text style={styles.settleBtnText}>Settle</Text>
          </TouchableOpacity>
          
          <View style={styles.groupHeader}>
            <View style={styles.groupAvatar}>
              <Text style={styles.groupAvatarText}>{localGroupData.avatar || '🏢'}</Text>
            </View>
            <Text style={styles.groupName}>{localGroupData.name}</Text>
            {localGroupData.description && (
              <Text style={styles.groupDescription}>{localGroupData.description}</Text>
            )}
            
            <View style={styles.groupBadges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  📅 {formatTimestamp(localGroupData.createdAt, 'Recently')}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>💰 {localGroupData.currency}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>👥 {(localGroupData.members || []).length} members</Text>
              </View>
            </View>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {getCurrencySymbol(localGroupData?.currency || 'USD')}{isNaN(totalExpenses) ? '0.00' : totalExpenses.toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {getCurrencySymbol(localGroupData?.currency || 'USD')}{isNaN(perPersonAmount) ? '0.00' : perPersonAmount.toFixed(2)}
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
                      <Icon name="refresh" size={16} color={theme.colors.primary}  />
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
                ) : (Array.isArray(groupExpenses) ? groupExpenses : []).length === 0 ? (
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
                  (Array.isArray(groupExpenses) ? groupExpenses : []).slice(0, 10).map((expense, index) => renderExpenseCard(expense, index))
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
                
                {(() => {
                  console.log('🎨 Rendering members tab with data:', {
                    groupId: localGroupData?.id,
                    groupName: localGroupData?.name,
                    memberCount: localGroupData?.members?.length || 0,
                    members: localGroupData?.members?.map(m => ({
                      userId: m.userId,
                      fullName: m.userData?.fullName,
                      isActive: m.isActive
                    })) || [],
                    renderKey: renderKey
                  });
                  
                  // Additional debugging
                  const membersArray = localGroupData?.members && Array.isArray(localGroupData.members) ? localGroupData.members : [];
                  console.log('🔍 Members array processing:', {
                    hasLocalGroupData: !!localGroupData,
                    hasMembersProperty: !!localGroupData?.members,
                    isArray: Array.isArray(localGroupData?.members),
                    arrayLength: membersArray.length,
                    rawMembersData: localGroupData?.members
                  });
                  
                  return null;
                })()}
                
                {(localGroupData?.members && Array.isArray(localGroupData.members) ? localGroupData.members : []).map((member, index) => {
                  console.log(`🔄 Processing member ${index}:`, {
                    member,
                    hasUserId: !!member?.userId,
                    userData: member?.userData
                  });
                  
                  // Safety check for member data
                  if (!member || !member.userId) {
                    console.warn('⚠️ Invalid member data at index:', index, member);
                    return null;
                  }
                  return renderMemberCard(member, index);
                })}
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
                      onPress={() => CrossPlatformAlert.alert('Copied!', 'Invite code copied to clipboard')}
                    >
                      <Icon name="copy" size={16} color={theme.colors.textSecondary}  />
                      <Text style={[styles.secondaryBtnText, { color: theme.colors.textSecondary }]}>
                        Copy Code
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => setShowQRModal(true)}
                    >
                      <Icon name="qrCode" size={16} color="white"  />
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
                    <Icon name="share" size={20} color={theme.colors.textSecondary}  />
                    <Text style={[styles.actionRowText, { color: theme.colors.text }]}>
                      Share Invite Link
                    </Text>
                    <Icon name="forward" size={16} color={theme.colors.textSecondary}  />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={handleExportGroup}
                  >
                    <Icon name="download" size={20} color={theme.colors.textSecondary}  />
                    <Text style={[styles.actionRowText, { color: theme.colors.text }]}>
                      Export Group Data
                    </Text>
                    <Icon name="forward" size={16} color={theme.colors.textSecondary}  />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.dangerSection}>
                  {isOnlyMemberLeft || isGroupCreator ? (
                    <TouchableOpacity
                      style={[styles.dangerBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                      onPress={handleDeleteGroup}
                    >
                      <Icon name="trash" size={20} color="#DC2626"  />
                      <Text style={[styles.dangerBtnText, { color: '#DC2626' }]}>
                        Delete Group
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.dangerBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                      onPress={handleLeaveGroup}
                    >
                      <Icon name="exit" size={20} color="#DC2626" />
                      <Text style={[styles.dangerBtnText, { color: '#DC2626' }]}>
                        Leave Group
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      
      {/* All Modals */}
      {selectedMemberForAction && (
        <View style={styles.modalOverlay}>
          <View style={[styles.actionModalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.actionModalTitle, { color: theme.colors.text }]}>
              Member Actions
            </Text>
            
            {(() => {
              const member = (localGroupData?.members || []).find(m => m.userId === selectedMemberForAction);
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
                    <Icon 
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
                    <Icon name="person-remove" size={20} color="#DC2626" />
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
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <SafeAreaView style={[styles.addMemberModal, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setShowAddMember(false)}>
              <Icon name="close" size={24} color={theme.colors.text}  />
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
                onPress={handleShareInviteCode}
              >
                <Icon name="person-add" size={20} color="white" />
                <Text style={styles.inviteContactsBtnText}>
                  Share Group Invite
                </Text>
              </TouchableOpacity>
            </View>

            {/* Accepted Friends Section */}
            {friends.filter(friend => 
              friend.status === 'accepted' && 
              !localGroupData?.members.some(member => member.userId === friend.friendId)
            ).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>
                  Your Friends
                </Text>
                
                {friends
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
                            {(() => {
                              const name = friend.friendData?.fullName || friend.friendData?.email || 'U';
                              console.log('🔤 Friend avatar name:', name, 'for friend:', friend.friendId);
                              return name.charAt(0).toUpperCase();
                            })()}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={[styles.memberName, { color: theme.colors.text }]}>
                            {friend.friendData?.fullName || friend.friendData?.email || 'Unknown Friend'}
                          </Text>
                          <Text style={[styles.friendEmail, { color: theme.colors.textSecondary }]}>
                            {friend.friendData?.email || 'No email'}
                          </Text>
                        </View>
                        <Icon name="add-circle" size={24} color={theme.colors.primary} />
                      </View>
                    </TouchableOpacity>
                  ))}
              </>
            )}

            {/* Pending Friends Section - Only users already on Spendy */}
            {friends.filter(friend => 
              (friend.status === 'pending' || friend.status === 'invited') && 
              !friend.isNewUser &&
              !localGroupData?.members.some(member => member.userId === friend.friendId)
            ).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 24 }]}>
                  Pending Friend Requests
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
                  Friends on Spendy who haven't accepted your request yet
                </Text>
                
                {friends
                  .filter(friend => 
                    (friend.status === 'pending' || friend.status === 'invited') && 
                    !friend.isNewUser &&
                    !localGroupData?.members.some(member => member.userId === friend.friendId)
                  )
                  .map((friend) => (
                    <TouchableOpacity
                      key={friend.id}
                      style={[styles.card, { backgroundColor: theme.colors.surface }]}
                      onPress={() => handleAddPendingFriendToGroup(friend)}
                    >
                      <View style={styles.friendRow}>
                        <View style={[styles.memberAvatar, { backgroundColor: theme.colors.warning }]}>
                          <Text style={styles.memberAvatarText}>
                            {(() => {
                              const name = friend.friendData?.fullName || friend.friendData?.email || 'U';
                              console.log('🔤 Pending friend avatar name:', name, 'for friend:', friend.friendId);
                              return name.charAt(0).toUpperCase();
                            })()}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={[styles.memberName, { color: theme.colors.text }]}>
                            {friend.friendData?.fullName || friend.friendData?.email || 'Unknown Friend'}
                          </Text>
                          <Text style={[styles.friendEmail, { color: theme.colors.textSecondary }]}>
                            {friend.friendData?.email || 'No email'}
                          </Text>
                          <View style={styles.statusIndicator}>
                            <Icon name="time" size={12} color={theme.colors.warning}  />
                            <Text style={[styles.statusText, { color: theme.colors.warning }]}>
                              Friend request pending
                            </Text>
                          </View>
                        </View>
                        <Icon name="add-circle" size={24} color={theme.colors.warning} />
                      </View>
                    </TouchableOpacity>
                  ))}
              </>
            )}

            {/* Empty State */}
            {friends.filter(friend => 
              (friend.status === 'accepted' || 
               (friend.status === 'pending' || friend.status === 'invited') && !friend.isNewUser) &&
              !localGroupData?.members.some(member => member.userId === friend.friendId)
            ).length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  No friends available to add
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  Invite new users to Spendy or accept pending friend requests to add them to groups
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
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
        initialGroupId={expenseListGroupId}
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
        onSettlementComplete={async () => {
          await loadGroupExpenses();
          await calculateMemberBalances(); // Refresh member balances after settlement
          // Also trigger parent refresh if available
          onRefresh?.();
        }}
      />

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        group={localGroupData}
        currentUserId={currentUser?.id || ''}
        onExportComplete={handleExportComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
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
    paddingTop: 60, // Increased to avoid status bar overlap
    paddingHorizontal: 24,
    paddingBottom: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  backBtn: {
    position: 'absolute',
    top: 35, // Moved down to avoid status bar overlap
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  settleBtn: {
    position: 'absolute',
    top: 35, // Same position as back button
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    gap: 6,
  },
  settleBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
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
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});