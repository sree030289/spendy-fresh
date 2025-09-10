// src/components/modals/ExpenseDetailModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import FullscreenModal from '@/components/common/FullscreenModal';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/common/Icon';
import { formatCurrency } from '@/utils/currency';
// Using flexible expense interface to work with both GroupExpense and local Expense interfaces
interface FlexibleExpense {
  id: string;
  title?: string;
  description: string;
  amount: number;
  groupId?: string;
  category: string;
  categoryIcon: string;
  paidBy: string;
  paidByData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  createdBy?: string;
  splitData?: Array<{
    userId: string;
    amount: number;
    isPaid: boolean;
  }>;
  splits?: Array<{
    userId: string;
    amount: number;
    isPaid: boolean;
  }>;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  isSettled?: boolean;
  currency?: string;
  splitType?: string;
  tags?: string[];
  receiptUrl?: string;
  notes?: string;
}

interface Friend {
  id: string;
  friendId?: string;
  name?: string;
  friendData?: {
    id: string;
    fullName: string; 
    email: string;
    avatar?: string;
  };
}

interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
}

interface ExpenseDetailModalProps {
  visible: boolean;
  onClose: () => void;
  expense: FlexibleExpense | null;
  onEdit?: (expense: FlexibleExpense) => void;
  groups?: Group[];
  friends?: Friend[];
  isEditable?: boolean; // Whether this expense can be edited (after last settlement)
}

export default function ExpenseDetailModal({
  visible,
  onClose,
  expense,
  onEdit,
  groups = [],
  friends = [],
  isEditable = true
}: ExpenseDetailModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();

  if (!expense) return null;

  const handleEdit = () => {
    if (!isEditable) {
      Alert.alert(
        'Cannot Edit',
        'This expense cannot be edited because it was created before the last settlement.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (onEdit) {
      onEdit(expense);
      onClose();
    }
  };

  const getGroupName = (groupId?: string) => {
    if (!groupId) return 'Personal';
    const group = groups.find(g => g.id === groupId);
    return group?.name || 'Unknown Group';
  };

  const getFriendName = (userId: string) => {
    // Check if it's the current user first
    if (userId === user?.id) {
      return user.fullName || 'You';
    }
    
    // Check if it's the paidBy user and use paidByData
    if (expense.paidBy === userId && expense.paidByData?.fullName) {
      return expense.paidByData.fullName;
    }
    
    // Check in friends list by friendId
    const friendById = friends.find(f => f.friendId === userId);
    if (friendById && friendById.friendData?.fullName) {
      return friendById.friendData.fullName;
    }
    
    // Check in friends list by id
    const friendByMainId = friends.find(f => f.id === userId);
    if (friendByMainId) {
      return friendByMainId.name || friendByMainId.friendData?.fullName || 'Friend';
    }
    
    // Check if userId matches any split user that might have embedded name data
    const splits = expense.splits || expense.splitData || [];
    const userSplit = splits.find(s => s.userId === userId);
    if (userSplit && (userSplit as any).userName) {
      return (userSplit as any).userName;
    }
    
    // Fallback - return partial ID for debugging
    return userId ? `User ${userId.substring(0, 8)}...` : 'Unknown User';
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatExpenseCurrency = (amount: number) => {
    // Use expense currency if available, fallback to user currency, then USD
    const currencyCode = expense.currency || user?.currency || 'USD';
    return formatCurrency(amount, currencyCode);
  };

  return (
    <FullscreenModal
      visible={visible}
      onClose={onClose}
      title="Expense Details"
    >
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header Info */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerRow}>
            <Icon name="receipt" size={24} color={theme.colors.primary} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {expense.description}
              </Text>
              <Text style={[styles.amount, { color: theme.colors.primary }]}>
                {formatExpenseCurrency(expense.amount)}
              </Text>
            </View>
          </View>
          <Text style={[styles.date, { color: theme.colors.textSecondary }]}>
            {formatDate(expense.date || expense.createdAt)}
          </Text>
        </View>

        {/* Transaction Info */}
        <View style={[styles.section, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Transaction Information
          </Text>
          
          <View style={styles.infoRow}>
            <Icon name="group" size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Group:
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {getGroupName(expense.groupId)}
            </Text>
          </View>

          {expense.createdBy && (
            <View style={styles.infoRow}>
              <Icon name="person" size={20} color={theme.colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                Created by:
              </Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {getFriendName(expense.createdBy)}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Icon name="card" size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Paid by:
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {getFriendName(expense.paidBy)}
            </Text>
          </View>

          {expense.category && (
            <View style={styles.infoRow}>
              <Icon name="tag" size={20} color={theme.colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                Category:
              </Text>
              <View style={styles.categoryContainer}>
                {expense.categoryIcon && (
                  <Icon name={expense.categoryIcon} size={16} color={theme.colors.primary} />
                )}
                <Text style={[styles.infoValue, { color: theme.colors.text, marginLeft: expense.categoryIcon ? 8 : 0 }]}>
                  {expense.category}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Split Details */}
        <View style={[styles.section, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Split Details
          </Text>
          
          {(() => {
            const splits = expense.splits || expense.splitData || [];
            return splits.length > 0 ? (
              splits.map((split, index) => (
                <View key={index} style={styles.splitRow}>
                  <View style={styles.splitInfo}>
                    <Icon name="person" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.splitName, { color: theme.colors.text }]}>
                      {getFriendName(split.userId)}
                    </Text>
                  </View>
                  <Text style={[styles.splitAmount, { color: theme.colors.primary }]}>
                    {formatExpenseCurrency(split.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.noSplits, { color: theme.colors.textSecondary }]}>
                No split information available
              </Text>
            );
          })()}
        </View>

      </ScrollView>

      {/* Edit Button */}
      <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.editButton,
            { backgroundColor: isEditable ? theme.colors.primary : theme.colors.disabled },
            !isEditable && styles.disabledButton
          ]}
          onPress={handleEdit}
          disabled={!isEditable}
        >
          <Icon name="edit" size={20} color="white" />
          <Text style={[
            styles.editButtonText,
            { opacity: isEditable ? 1 : 0.5 }
          ]}>
            Edit Expense
          </Text>
        </TouchableOpacity>
      </View>
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
  },
  date: {
    fontSize: 14,
    marginTop: 8,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    marginLeft: 8,
    minWidth: 90,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    flex: 1,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    marginBottom: 8,
  },
  splitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitName: {
    fontSize: 16,
    marginLeft: 8,
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  noSplits: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});