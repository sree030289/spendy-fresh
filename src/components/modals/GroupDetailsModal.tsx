// src/components/modals/GroupDetailsModal.tsx
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { Group, Expense, SplittingService } from '@/services/firebase/splitting';
import ExpenseRefreshService from '@/services/expenseRefreshService';

import { User } from '@/types';

interface GroupDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  group: Group | null;
  currentUser: User | null;
  onAddExpense?: () => void;
  onOpenChat?: () => void;
}

export default function GroupDetailsModal({ 
  visible, 
  onClose, 
  group, 
  currentUser,
  onAddExpense,
  onOpenChat
}: GroupDetailsModalProps) {
  const { theme } = useTheme();
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

useEffect(() => {
  if (!visible || !group) return;
  
  // Initial load
  loadGroupExpenses();
  
  // Set up a refresh interval to catch new expenses
  const refreshInterval = setInterval(() => {
    if (visible && group) {
      loadGroupExpenses();
    }
  }, 5000); // Refresh every 5 seconds when modal is open
  
  return () => {
    clearInterval(refreshInterval);
  };
}, [visible, group?.id]);

useEffect(() => {
  if (!visible) return;
  
  const refreshService = ExpenseRefreshService.getInstance();
  const unsubscribe = refreshService.addListener(() => {
    console.log('Group details received expense refresh notification');
    if (group) {
      loadGroupExpenses();
    }
  });

  return unsubscribe;
}, [visible, group?.id]);

const handleRefresh = async () => {
  await loadGroupExpenses();
};
  
  const loadGroupExpenses = async () => {
  if (!group) return;
  
  setLoading(true);
  try {
    console.log('Loading expenses for group:', group.id);
    const expenses = await SplittingService.getGroupExpenses(group.id);
    console.log('Loaded expenses:', expenses.length);
    setGroupExpenses(expenses);
  } catch (error) {
    console.error('Load group expenses error:', error);
    setGroupExpenses([]); // Set empty array on error
  } finally {
    setLoading(false);
  }
};

  const handleShareInviteCode = async () => {
    if (!group) return;
    
    try {
      await Share.share({
        message: `Join "${group.name}" on Spendy! Use invite code: ${group.inviteCode}\n\nDownload Spendy: https://spendy.app/join/${group.inviteCode}`,
        title: `Join ${group.name} on Spendy`
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group?.name}"? You'll lose access to all group expenses and conversations.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              if (group && currentUser) {
                await SplittingService.leaveGroup(group.id, currentUser.id);
                Alert.alert('Left Group', `You have left "${group.name}"`);
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

  const renderMembersList = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Members ({group?.members.length})
      </Text>
      
      {group?.members.map((member) => (
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
          <View style={styles.memberBalance}>
            {member.balance === 0 ? (
              <Text style={[styles.balanceText, { color: theme.colors.textSecondary }]}>
                Settled
              </Text>
            ) : member.balance > 0 ? (
              <Text style={[styles.balanceText, { color: theme.colors.success }]}>
                +${Math.abs(member.balance).toFixed(2)}
              </Text>
            ) : (
              <Text style={[styles.balanceText, { color: theme.colors.error }]}>
                -${Math.abs(member.balance).toFixed(2)}
              </Text>
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
        <View key={expense.id} style={styles.expenseItem}>
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
          <View style={styles.expenseRight}>
            <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
              ${expense.amount.toFixed(2)}
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
        </View>
      ))
    )}
  </View>
);

  const renderGroupStats = () => (
    <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>
          ${group?.totalExpenses.toFixed(2)}
        </Text>
        <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
          Total Spent
        </Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>
          ${group ? (group.totalExpenses / group.members.length).toFixed(2) : '0.00'}
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

  if (!group) return null;

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
          <TouchableOpacity onPress={() => Alert.alert('Settings', 'Group settings coming soon')}>
            <Ionicons name="settings" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Group Info */}
          <View style={styles.groupInfo}>
            <Text style={styles.groupAvatar}>{group.avatar}</Text>
            <Text style={[styles.groupName, { color: theme.colors.text }]}>
              {group.name}
            </Text>
            {group.description && (
              <Text style={[styles.groupDescription, { color: theme.colors.textSecondary }]}>
                {group.description}
              </Text>
            )}
            <View style={styles.groupMeta}>
              <Text style={[styles.groupMetaText, { color: theme.colors.textSecondary }]}>
                Created {group.createdAt.toLocaleDateString()}
              </Text>
              <Text style={[styles.groupMetaText, { color: theme.colors.textSecondary }]}>
                Currency: {group.currency}
              </Text>
            </View>
          </View>

          {/* Group Stats */}
          {renderGroupStats()}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
  <TouchableOpacity
    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
    onPress={onAddExpense}
  >
    <Ionicons name="add-circle" size={20} color="white" />
    <Text style={styles.actionButtonText}>Add Expense</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.actionButton, { backgroundColor: theme.colors.secondary || '#6366F1' }]}
    onPress={onOpenChat}
  >
    <Ionicons name="chatbubble" size={20} color="white" />
    <Text style={styles.actionButtonText}>Group Chat</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.actionButton, 
      { 
        backgroundColor: theme.colors.background, 
        borderWidth: 2, 
        borderColor: theme.colors.primary 
      }
    ]}
    onPress={handleShareInviteCode}
  >
    <Ionicons name="share" size={20} color={theme.colors.primary} />
    <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
      Invite Friends
    </Text>
  </TouchableOpacity>
</View>

          {/* Invite Code */}
          <View style={[styles.inviteSection, { backgroundColor: theme.colors.surface }]}>
  <Text style={[styles.inviteSectionTitle, { color: theme.colors.text }]}>
    Group Invite Code
  </Text>
  <View style={[styles.inviteCodeContainer, { backgroundColor: theme.colors.background }]}>
    <Text style={[styles.inviteCode, { color: theme.colors.primary }]}>
      {group.inviteCode}
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
</View>

          {/* Members List */}
          {renderMembersList()}

          {/* Expenses List */}
          {renderExpensesList()}

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
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14, // Increased padding
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
    minHeight: 48, // Ensure minimum height
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center', // Center the text
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
});