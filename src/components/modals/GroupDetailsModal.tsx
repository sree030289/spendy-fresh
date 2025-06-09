// src/components/modals/GroupDetailsModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
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
  
  // Local state for group data to enable real-time updates
  const [localGroupData, setLocalGroupData] = useState<Group | null>(null);
  
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
      setGroupExpenses([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [localGroupData]);

  // Function to refresh group data
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
      // Fallback to prop data if API call fails
      setLocalGroupData(group);
    }
  }, [group]);

  // Sync local group data with prop changes
  useEffect(() => {
    if (group) {
      setLocalGroupData(group);
    }
  }, [group]);

  // Load fresh group data when modal becomes visible
  useEffect(() => {
    if (visible && group) {
      loadGroupData();
    }
  }, [visible, loadGroupData]);

  useEffect(() => {
    if (!visible || !localGroupData) {
      return undefined;
    }
    
    // Initial load
    loadGroupExpenses();
    
    // Set up a refresh interval to catch new expenses
    const refreshInterval = setInterval(() => {
      if (visible && localGroupData) {
        loadGroupExpenses();
      }
    }, 5000); // Refresh every 5 seconds when modal is open
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [visible, localGroupData?.id, loadGroupExpenses]);

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
                onGroupLeft?.(); // Call the callback to refresh the groups list
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
      // Update the group using SplittingService
      await SplittingService.updateMemberRole(localGroupData.id, userId, 'admin');
      
      Alert.alert('Success', 'Member has been made an admin');
      
      // Refresh local group data first, then parent
      await loadGroupData();
      onRefresh?.();
      await loadGroupExpenses();
    } catch (error: any) {
      console.error('Make admin error:', error);
      Alert.alert('Error', error.message || 'Failed to make member admin');
    }
  };

  // In src/components/modals/GroupDetailsModal.tsx
// Update handleRemoveAdmin function around line 220:

const handleRemoveAdmin = async (userId: string) => {
  if (!localGroupData || !currentUser || !isUserAdmin) return;
  
  const member = localGroupData.members.find(m => m.userId === userId);
  if (!member) return;
  
  // Check if member has pending balances
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
            
            // Refresh local group data first, then parent
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
    
    // Check if member has pending balances
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
              
              // Refresh local group data first, then parent
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
      
      // Refresh local group data first to update members list immediately
      await loadGroupData();
      // Then refresh parent and expenses
      onRefresh?.();
      await loadGroupExpenses();
      
      // Trigger expense refresh service to notify other components
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
        // For now, just show the share invite functionality
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
      // Refresh the expenses list
      await loadGroupExpenses();
    } catch (error) {
      console.error('Error after expense update:', error);
    }
  };

  const renderMembersList = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Members ({localGroupData?.members.length})
        </Text>
        {isUserAdmin && (
          <TouchableOpacity
            onPress={() => setShowAddMember(true)}
            style={styles.addMemberButton}
          >
            <Ionicons name="person-add" size={16} color={theme.colors.primary} />
            <Text style={[styles.addMemberText, { color: theme.colors.primary }]}>
              Add Member
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {localGroupData?.members.map((member) => (
        <View key={member.userId} style={styles.memberItem}>
          <View style={styles.memberLeft}>
            <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.memberAvatarText}>
                {member.userData.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.memberName, { color: theme.colors.text }]}>
                {member.userId === currentUser?.id ? 'You' : member.userData.fullName}
              </Text>
              <Text style={[styles.memberRole, { color: theme.colors.textSecondary }]}>
                {member.role === 'admin' ? '👑 Admin' : '👤 Member'}
              </Text>
            </View>
          </View>
          <View style={styles.memberActions}>
            <View style={styles.memberBalance}>
              {member.balance === 0 ? (
                <Text style={[styles.balanceText, { color: theme.colors.textSecondary }]}>
                  Settled
                </Text>
              ) : member.balance > 0 ? (
                <Text style={[styles.balanceText, { color: theme.colors.success }]}>
                  +{localGroupData?.currency === 'USD' ? '$' : localGroupData?.currency === 'EUR' ? '€' : localGroupData?.currency === 'INR' ? '₹' : localGroupData?.currency || '$'}{Math.abs(member.balance).toFixed(2)}
                </Text>
              ) : (
                <Text style={[styles.balanceText, { color: theme.colors.error }]}>
                  -{localGroupData?.currency === 'USD' ? '$' : localGroupData?.currency === 'EUR' ? '€' : localGroupData?.currency === 'INR' ? '₹' : localGroupData?.currency || '$'}{Math.abs(member.balance).toFixed(2)}
                </Text>
              )}
            </View>
            {isUserAdmin && member.userId !== currentUser?.id && (
              <TouchableOpacity
                onPress={() => setSelectedMemberForAction(member.userId)}
                style={styles.memberOptionsButton}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  );

const renderExpensesList = () => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Recent Expenses ({groupExpenses.length})
      </Text>
      <View style={styles.expensesActions}>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
        {groupExpenses.length > 0 && (
          <TouchableOpacity onPress={() => setShowGroupExpenseModal(true)}>
            <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>
              View All
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onAddExpense}>
          <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>
            Add New
          </Text>
        </TouchableOpacity>
      </View>
    </View>
    
    {loading ? (
      <View style={styles.loadingExpenses}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[{ color: theme.colors.textSecondary, marginLeft: 8 }]}>
          Loading expenses...
        </Text>
      </View>
    ) : groupExpenses.length === 0 ? (
      <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="receipt-outline" size={48} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
          No expenses yet
        </Text>
        <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
          Add your first expense to start tracking
        </Text>
      </View>
    ) : (
      groupExpenses.slice(0, 10).map((expense) => (
        <TouchableOpacity
          key={expense.id}
          style={styles.expenseItem}
          onPress={() => handleEditExpense(expense)}
        >
          <View style={styles.expenseLeft}>
            <Text style={styles.expenseIcon}>{expense.categoryIcon}</Text>
            <View>
              <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
                {expense.description}
              </Text>
              <Text style={[styles.expenseSubtitle, { color: theme.colors.textSecondary }]}>
                {expense.date.toLocaleDateString()} • {expense.paidByData.fullName}
              </Text>
            </View>
          </View>
          <View style={styles.expenseRight}>              <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
              {localGroupData?.currency === 'USD' ? '$' : localGroupData?.currency === 'EUR' ? '€' : localGroupData?.currency === 'INR' ? '₹' : localGroupData?.currency || '$'}{expense.amount.toFixed(2)}
            </Text>
            <View style={[
              styles.expenseStatus,
              { backgroundColor: expense.isSettled ? theme.colors.success + '20' : theme.colors.error + '20' }
            ]}>
              <Text style={[
                styles.expenseStatusText,
                { color: expense.isSettled ? theme.colors.success : theme.colors.error }
              ]}>
                {expense.isSettled ? 'Settled' : 'Pending'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))
    )}
  </View>
);
const renderExpenseCard = (expense: Expense) => (
  <TouchableOpacity style={styles.expenseCard}>
    {/* existing expense info */}
    {!expense.isSettled && (
      <Button
        title="Settle"
        onPress={() => {
          setSelectedExpense(expense);
          setShowSettlementModal(true);
        }}
      />
    )}
  </TouchableOpacity>
);

  const renderGroupStats = () => (
  <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>
        {getCurrencySymbol(localGroupData?.currency || 'AUD')}{localGroupData?.totalExpenses.toFixed(2)}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
        Total Spent
      </Text>
    </View>
    <View style={styles.statDivider} />
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>
        {getCurrencySymbol(localGroupData?.currency || 'AUD')}{localGroupData ? (localGroupData.totalExpenses / localGroupData.members.length).toFixed(2) : '0.00'}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
        Per Person
      </Text>
    </View>
    <View style={styles.statDivider} />
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>
        {groupExpenses.length}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
        Expenses
      </Text>
    </View>
  </View>
);

  if (!localGroupData) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Group Details
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Group Info - Fixed at top */}
          <View style={styles.groupInfo}>
            <Text style={styles.groupAvatar}>{localGroupData.avatar}</Text>
            <Text style={[styles.groupName, { color: theme.colors.text }]}>
              {localGroupData.name}
            </Text>
            {localGroupData.description && (
              <Text style={[styles.groupDescription, { color: theme.colors.textSecondary }]}>
                {localGroupData.description}
              </Text>
            )}
            <View style={styles.groupMeta}>
              <Text style={[styles.groupMetaText, { color: theme.colors.textSecondary }]}>
                Created {localGroupData.createdAt.toLocaleDateString()}
              </Text>
              <Text style={[styles.groupMetaText, { color: theme.colors.textSecondary }]}>
                Currency: {localGroupData.currency}
              </Text>
            </View>
          </View>

          {/* Group Stats - Fixed at top */}
          {renderGroupStats()}

          {/* Tab Navigation - Now below stats */}
          <View style={[styles.tabContainer, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'expenses' && { borderBottomColor: theme.colors.primary }
              ]}
              onPress={() => setActiveTab('expenses')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'expenses' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Expenses
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'members' && { borderBottomColor: theme.colors.primary }
              ]}
              onPress={() => setActiveTab('members')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'members' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Members
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'settings' && { borderBottomColor: theme.colors.primary }
              ]}
              onPress={() => setActiveTab('settings')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'settings' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Settings
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'expenses' && (
            <>
              {/* Expenses List */}
              {renderExpensesList()}
            </>
          )}

          {activeTab === 'members' && (
            <>
              {/* Members List */}
              {renderMembersList()}
            </>
          )}

          {activeTab === 'settings' && (
            <>
              {/* Invite Code */}
              <View style={[styles.inviteSection, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.inviteSectionTitle, { color: theme.colors.text }]}>
                  Group Invite Code
                </Text>
                <View style={[styles.inviteCodeContainer, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.inviteCode, { color: theme.colors.primary }]}>
                    {localGroupData.inviteCode}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      // Copy to clipboard functionality
                      Alert.alert('Copied!', 'Invite code copied to clipboard');
                    }}
                    style={{ padding: 8 }}
                  >
                    <Ionicons name="copy" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={[{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 8 }]}>
                  Share this code with friends to invite them to the group
                </Text>
                
                {/* QR Code Button */}
                <TouchableOpacity
                  style={[styles.qrButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => setShowQRModal(true)}
                >
                  <Ionicons name="qr-code" size={20} color="white" />
                  <Text style={[styles.qrButtonText, { color: 'white' }]}>
                    Show QR Code
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Danger Zone */}
              <View style={styles.dangerZone}>
                <TouchableOpacity
                  style={[styles.dangerButton, { borderColor: theme.colors.error }]}
                  onPress={handleLeaveGroup}
                >
                  <Ionicons name="exit" size={20} color={theme.colors.error} />
                  <Text style={[styles.dangerButtonText, { color: theme.colors.error }]}>
                    Leave Group
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      
      {/* Member Action Modal */}

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
                <Ionicons name="person-remove" size={20} color={theme.colors.error} />
                <Text style={[styles.actionModalOptionText, { color: theme.colors.error }]}>
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
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.addMemberModalContent, { backgroundColor: theme.colors.background }]}>
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
                {/* Invite from Contacts */}
                <View style={styles.inviteSection}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 8 }]}>
                    Invite New Users
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary, marginBottom: 16 }]}>
                    Invite friends who don't have the app yet
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.inviteContactsButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleInviteFromContacts}
                  >
                    <Ionicons name="person-add" size={20} color="white" />
                    <Text style={styles.inviteContactsButtonText}>
                      Invite from Contacts
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 16 }]}>
                  Your Friends
                </Text>
                
                {friends.filter(friend => 
                  friend.status === 'accepted' && 
                  !localGroupData?.members.some(member => member.userId === friend.friendId)
                ).length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                    <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
                    <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                      No friends to add
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
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
                        style={styles.friendItem}
                        onPress={() => handleAddFriendToGroup(friend.friendId)}
                      >
                        <View style={styles.friendLeft}>
                          <View style={[styles.friendAvatar, { backgroundColor: theme.colors.primary }]}>
                            <Text style={styles.friendAvatarText}>
                              {friend.friendData.fullName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={[styles.friendName, { color: theme.colors.text }]}>
                              {friend.friendData.fullName}
                            </Text>
                            <Text style={[styles.friendEmail, { color: theme.colors.textSecondary }]}>
                              {friend.friendData.email}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
                      </TouchableOpacity>
                    ))
                )}
              </ScrollView>
            </View>
          </View>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  groupInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  groupAvatar: {
    fontSize: 48,
    marginBottom: 12,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  groupDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  groupMeta: {
    alignItems: 'center',
    gap: 4,
  },
  groupMetaText: {
    fontSize: 14,
  },
statsCard: {
  flexDirection: 'row',
  padding: 16, // Reduced from 20
  borderRadius: 16,
  marginBottom: 24,
  alignItems: 'center',
  justifyContent: 'space-between',
},
statItem: {
  alignItems: 'center',
  flex: 1,
  minWidth: 0, // Allow flex shrinking
  paddingHorizontal: 8, // Add horizontal padding
},
statValue: {
  fontSize: 16, // Reduced from 18-20
  fontWeight: 'bold',
  marginBottom: 4,
  textAlign: 'center',
  //numberOfLines: 1, // Ensure single line
},
statLabel: {
  fontSize: 11, // Reduced from 12
  textAlign: 'center',
  //numberOfLines: 1, // Ensure single line
},
statDivider: {
  width: 1,
  height: 32, // Reduced from 40
  backgroundColor: '#E5E7EB',
  marginHorizontal: 8, // Reduced from 16
},
  inviteSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inviteSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  inviteCode: {
    fontSize: 20, // Reduced from 24
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
  },
  memberBalance: {
    alignItems: 'flex-end',
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  expenseCard: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  expenseSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 4,
  },
  expenseStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  dangerZone: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
   expensesActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshButton: {
    padding: 4,
  },
  loadingExpenses: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addMemberText: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberOptionsButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  qrButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionModalContent: {
    backgroundColor: 'white',
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
  addMemberModalContent: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
  },
  friendEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  inviteContactsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  inviteContactsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});