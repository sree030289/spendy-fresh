// src/components/modals/ExpenseDeletionModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { Expense, SplittingService } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';
import { User } from '@/types';

interface ExpenseDeletionModalProps {
  visible: boolean;
  onClose: () => void;
  expense: Expense | null;
  currentUser: User | null;
  onDeletionComplete: () => void;
  isUserAdmin?: boolean;
}

interface BalanceImpact {
  userId: string;
  userName: string;
  currentBalance: number;
  impactAmount: number;
  newBalance: number;
}

export default function ExpenseDeletionModal({
  visible,
  onClose,
  expense,
  currentUser,
  onDeletionComplete,
  isUserAdmin = false
}: ExpenseDeletionModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(1);
  const [balanceImpacts, setBalanceImpacts] = useState<BalanceImpact[]>([]);

  React.useEffect(() => {
    if (visible && expense) {
      calculateBalanceImpacts();
    }
  }, [visible, expense]);

  const calculateBalanceImpacts = async () => {
    if (!expense || !currentUser) return;

    try {
      // Get current group data to calculate impact
      const group = await SplittingService.getGroup(expense.groupId);
      if (!group) return;

      const impacts: BalanceImpact[] = [];

      // Calculate impact for each person involved in the expense
      for (const split of expense.splitData) {
        const member = group.members.find(m => m.userId === split.userId);
        if (member) {
          let impactAmount = 0;
          
          if (split.userId === expense.paidBy) {
            // Person who paid will lose the positive balance (money they're owed)
            impactAmount = -expense.amount + split.amount;
          } else {
            // Person who owes will lose the negative balance (debt relief)
            impactAmount = split.amount;
          }

          impacts.push({
            userId: split.userId,
            userName: split.userId === currentUser.id ? 'You' : member.userData.fullName,
            currentBalance: member.balance,
            impactAmount,
            newBalance: member.balance - impactAmount
          });
        }
      }

      setBalanceImpacts(impacts);
    } catch (error) {
      console.error('Calculate balance impacts error:', error);
    }
  };

  const canDeleteExpense = (): { canDelete: boolean; reason?: string } => {
    if (!expense || !currentUser) {
      return { canDelete: false, reason: 'Expense not found' };
    }

    // Only the person who paid or group admin can delete
    if (expense.paidBy !== currentUser.id && !isUserAdmin) {
      return { 
        canDelete: false, 
        reason: 'Only the person who paid for this expense or group admins can delete it' 
      };
    }

    // Check if expense has been partially settled
    const hasPartialPayments = expense.splitData.some(split => split.isPaid);
    if (hasPartialPayments) {
      return { 
        canDelete: false, 
        reason: 'Cannot delete expense with recorded payments. Please contact group members to resolve.' 
      };
    }

    // Check if expense is older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (expense.createdAt < thirtyDaysAgo && !isUserAdmin) {
      return { 
        canDelete: false, 
        reason: 'Cannot delete expenses older than 30 days. Contact a group admin.' 
      };
    }

    return { canDelete: true };
  };

  const handleDeleteExpense = async () => {
    if (!expense || !currentUser) return;

    const deleteCheck = canDeleteExpense();
    if (!deleteCheck.canDelete) {
      Alert.alert('Cannot Delete', deleteCheck.reason);
      return;
    }

    setLoading(true);
    try {
      await SplittingService.deleteExpense(expense.id, currentUser.id);

      // Send notification to group
      await SplittingService.sendGroupMessage({
        groupId: expense.groupId,
        userId: currentUser.id,
        userName: currentUser.fullName,
        message: `🗑️ Deleted expense: "${expense.description}" (${getCurrencySymbol(expense.currency)}${expense.amount.toFixed(2)})`,
        type: 'system'
      });

      Alert.alert(
        'Expense Deleted',
        'The expense has been deleted and all balances have been reversed.',
        [{ text: 'OK', onPress: () => {
          onDeletionComplete();
          onClose();
        }}]
      );

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete expense');
    } finally {
      setLoading(false);
    }
  };

  const renderBalanceImpact = (impact: BalanceImpact) => (
    <View key={impact.userId} style={[styles.impactItem, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.impactHeader}>
        <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.userAvatarText}>
            {impact.userName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.impactDetails}>
          <Text style={[styles.impactUserName, { color: theme.colors.text }]}>
            {impact.userName}
          </Text>
          <View style={styles.balanceRow}>
            <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
              Current: 
            </Text>
            <Text style={[
              styles.balanceValue,
              { color: impact.currentBalance >= 0 ? theme.colors.success : theme.colors.error }
            ]}>
              {getCurrencySymbol(expense?.currency || 'USD')}{Math.abs(impact.currentBalance).toFixed(2)}
              {impact.currentBalance >= 0 ? ' owed to them' : ' they owe'}
            </Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>
              After deletion: 
            </Text>
            <Text style={[
              styles.balanceValue,
              { color: impact.newBalance >= 0 ? theme.colors.success : theme.colors.error }
            ]}>
              {getCurrencySymbol(expense?.currency || 'USD')}{Math.abs(impact.newBalance).toFixed(2)}
              {impact.newBalance >= 0 ? ' owed to them' : ' they owe'}
            </Text>
          </View>
        </View>
      </View>
      <View style={[
        styles.impactBadge,
        { backgroundColor: impact.impactAmount > 0 ? theme.colors.success + '20' : theme.colors.error + '20' }
      ]}>
        <Text style={[
          styles.impactAmount,
          { color: impact.impactAmount > 0 ? theme.colors.success : theme.colors.error }
        ]}>
          {impact.impactAmount > 0 ? '+' : ''}{getCurrencySymbol(expense?.currency || 'USD')}{impact.impactAmount.toFixed(2)}
        </Text>
      </View>
    </View>
  );

  const renderConfirmationStep = () => {
    if (confirmationStep === 1) {
      return (
        <ScrollView style={styles.content}>
          {/* Warning Card */}
          <View style={[styles.warningCard, { backgroundColor: theme.colors.error + '10' }]}>
            <Ionicons name="warning" size={24} color={theme.colors.error} />
            <View style={styles.warningContent}>
              <Text style={[styles.warningTitle, { color: theme.colors.error }]}>
                Delete Expense
              </Text>
              <Text style={[styles.warningText, { color: theme.colors.textSecondary }]}>
                This action cannot be undone. All balances related to this expense will be reversed.
              </Text>
            </View>
          </View>

          {/* Expense Details */}
          <View style={[styles.expenseCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.expenseHeader}>
              <Text style={styles.expenseIcon}>{expense?.categoryIcon}</Text>
              <View style={styles.expenseInfo}>
                <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
                  {expense?.description}
                </Text>
                <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
                  {getCurrencySymbol(expense?.currency || 'USD')}{expense?.amount.toFixed(2)}
                </Text>
                <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
                  {expense?.date.toLocaleDateString()} • Paid by {expense?.paidByData.fullName}
                </Text>
              </View>
            </View>
          </View>

          {/* Deletion Rules */}
          <View style={[styles.rulesCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.rulesTitle, { color: theme.colors.text }]}>
              Deletion Rules
            </Text>
            <View style={styles.rulesList}>
              <View style={styles.ruleItem}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <Text style={[styles.ruleText, { color: theme.colors.textSecondary }]}>
                  All group member balances will be reversed
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <Text style={[styles.ruleText, { color: theme.colors.textSecondary }]}>
                  Friend balances will be adjusted accordingly
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <Text style={[styles.ruleText, { color: theme.colors.textSecondary }]}>
                  Group total expenses will be reduced
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
                <Text style={[styles.ruleText, { color: theme.colors.textSecondary }]}>
                  This action cannot be undone
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.content}>
        {/* Balance Impact */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Balance Impact ({balanceImpacts.length} people affected)
        </Text>
        
        <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
          Here's how deleting this expense will affect everyone's balances:
        </Text>

        {balanceImpacts.map(renderBalanceImpact)}

        {/* Final Warning */}
        <View style={[styles.finalWarning, { backgroundColor: theme.colors.error + '10' }]}>
          <Ionicons name="warning" size={20} color={theme.colors.error} />
          <Text style={[styles.finalWarningText, { color: theme.colors.error }]}>
            This will permanently delete the expense and reverse all associated balances.
          </Text>
        </View>
      </ScrollView>
    );
  };

  if (!expense) return null;

  const deleteCheck = canDeleteExpense();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Delete Expense
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressStep,
              { backgroundColor: theme.colors.primary }
            ]} />
            <View style={[
              styles.progressStep,
              { backgroundColor: confirmationStep === 2 ? theme.colors.primary : theme.colors.border }
            ]} />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
            Step {confirmationStep} of 2
          </Text>
        </View>

        {!deleteCheck.canDelete ? (
          <View style={styles.content}>
            <View style={[styles.blockedCard, { backgroundColor: theme.colors.error + '10' }]}>
              <Ionicons name="lock-closed" size={48} color={theme.colors.error} />
              <Text style={[styles.blockedTitle, { color: theme.colors.error }]}>
                Cannot Delete Expense
              </Text>
              <Text style={[styles.blockedReason, { color: theme.colors.textSecondary }]}>
                {deleteCheck.reason}
              </Text>
            </View>
          </View>
        ) : (
          renderConfirmationStep()
        )}

        {/* Footer */}
        {deleteCheck.canDelete && (
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <View style={styles.footerButtons}>
              {confirmationStep === 1 ? (
                <>
                  <Button
                    title="Cancel"
                    onPress={onClose}
                    variant="outline"
                    style={styles.footerButton}
                    disabled={loading}
                  />
                  <Button
                    title="Review Impact"
                    onPress={() => setConfirmationStep(2)}
                    style={styles.footerButton}
                    disabled={loading}
                  />
                </>
              ) : (
                <>
                  <Button
                    title="Back"
                    onPress={() => setConfirmationStep(1)}
                    variant="outline"
                    style={styles.footerButton}
                    disabled={loading}
                  />
                  <Button
                    title="Delete Expense"
                    onPress={handleDeleteExpense}
                    loading={loading}
                    style={StyleSheet.flatten([styles.footerButton, { backgroundColor: theme.colors.error }])}
                  />
                </>
              )}
            </View>
          </View>
        )}
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
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  progressStep: {
    width: 50,
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  warningCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  expenseCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  expenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 14,
  },
  rulesCard: {
    padding: 16,
    borderRadius: 12,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  rulesList: {
    gap: 8,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  impactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  impactDetails: {
    flex: 1,
  },
  impactUserName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  balanceLabel: {
    fontSize: 12,
    marginRight: 4,
  },
  balanceValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  impactAmount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  finalWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 12,
  },
  finalWarningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  blockedCard: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  blockedReason: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    borderTopWidth: 1,
    padding: 20,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
});