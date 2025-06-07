// src/components/modals/ExpenseSettlementModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { Expense, ExpenseSplit, SplittingService } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';
import { User } from '@/types';

interface ExpenseSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  expense: Expense | null;
  currentUser: User | null;
  onSettlementComplete: () => void;
}

interface SettlementItem {
  userId: string;
  userName: string;
  userEmail: string;
  amountOwed: number;
  amountToPay: number;
  isSettled: boolean;
  settlementMethod?: 'cash' | 'bank' | 'venmo' | 'paypal' | 'other';
  settlementNote?: string;
  settlementDate?: Date;
}

export default function ExpenseSettlementModal({
  visible,
  onClose,
  expense,
  currentUser,
  onSettlementComplete
}: ExpenseSettlementModalProps) {
  const { theme } = useTheme();
  const [settlementItems, setSettlementItems] = useState<SettlementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [settlementMethod, setSettlementMethod] = useState<'cash' | 'bank' | 'venmo' | 'paypal' | 'other'>('cash');
  const [settlementNote, setSettlementNote] = useState('');
  const [activeSettlement, setActiveSettlement] = useState<string | null>(null);

  useEffect(() => {
    if (visible && expense && currentUser) {
      initializeSettlementItems();
    }
  }, [visible, expense, currentUser]);

  const initializeSettlementItems = () => {
    if (!expense || !currentUser) return;

    // Create settlement items for each person who owes money
    const items: SettlementItem[] = expense.splitData
      .filter(split => split.userId !== expense.paidBy && !split.isPaid)
      .map(split => ({
        userId: split.userId,
        userName: getUserName(split.userId),
        userEmail: getUserEmail(split.userId),
        amountOwed: split.amount,
        amountToPay: split.amount,
        isSettled: split.isPaid,
        settlementMethod: 'cash',
        settlementNote: '',
        settlementDate: undefined
      }));

    setSettlementItems(items);
  };

  const getUserName = (userId: string): string => {
    if (userId === currentUser?.id) return 'You';
    if (userId === expense?.paidBy) return expense.paidByData.fullName;
    // Try to get from group members or friends
    return 'Unknown User';
  };

  const getUserEmail = (userId: string): string => {
    if (userId === currentUser?.id) return currentUser.email;
    if (userId === expense?.paidBy) return expense.paidByData.email;
    return '';
  };

  const updateSettlementAmount = (userId: string, amount: number) => {
    setSettlementItems(prev => prev.map(item =>
      item.userId === userId
        ? { ...item, amountToPay: Math.min(amount, item.amountOwed) }
        : item
    ));
  };

  const toggleUserSettlement = (userId: string) => {
    setSettlementItems(prev => prev.map(item =>
      item.userId === userId
        ? { 
            ...item, 
            isSettled: !item.isSettled,
            amountToPay: !item.isSettled ? item.amountOwed : 0,
            settlementMethod: !item.isSettled ? settlementMethod : undefined,
            settlementNote: !item.isSettled ? settlementNote : '',
            settlementDate: !item.isSettled ? new Date() : undefined
          }
        : item
    ));
  };

  const handlePartialSettlement = async () => {
    if (!expense || !currentUser) return;

    const settledItems = settlementItems.filter(item => item.isSettled && item.amountToPay > 0);
    
    if (settledItems.length === 0) {
      Alert.alert('No Settlements', 'Please mark at least one person as settled.');
      return;
    }

    setLoading(true);
    try {
      // Update the expense split data
      const updatedSplitData = expense.splitData.map(split => {
        const settlementItem = settledItems.find(item => item.userId === split.userId);
        if (settlementItem) {
          return {
            ...split,
            isPaid: split.amount === settlementItem.amountToPay,
            paidAt: new Date()
          };
        }
        return split;
      });

      // Check if expense is fully settled
      const isFullySettled = updatedSplitData.every(split => 
        split.userId === expense.paidBy || split.isPaid
      );

      await SplittingService.updateExpenseSettlement(expense.id, {
        splitData: updatedSplitData,
        isSettled: isFullySettled,
        lastSettlementDate: new Date()
      });

      // Create settlement notifications
      for (const item of settledItems) {
        await SplittingService.createNotification({
          userId: expense.paidBy,
          type: 'payment_received',
          title: 'Payment Received',
          message: `${item.userName} paid $${item.amountToPay.toFixed(2)} for "${expense.description}"`,
          data: {
            expenseId: expense.id,
            fromUserId: item.userId,
            amount: item.amountToPay,
            method: item.settlementMethod
          },
          isRead: false,
          createdAt: new Date()
        });

        await SplittingService.createNotification({
          userId: item.userId,
          type: 'expense_settled',
          title: 'Payment Confirmed',
          message: `Your payment of $${item.amountToPay.toFixed(2)} for "${expense.description}" has been confirmed`,
          data: {
            expenseId: expense.id,
            amount: item.amountToPay,
            method: item.settlementMethod
          },
          isRead: false,
          createdAt: new Date()
        });
      }

      // Add settlement message to group chat
      const settlementMessage = settledItems.length === 1
        ? `${settledItems[0].userName} settled $${settledItems[0].amountToPay.toFixed(2)}`
        : `${settledItems.length} members settled payments`;

      await SplittingService.sendGroupMessage({
        groupId: expense.groupId,
        userId: currentUser.id,
        userName: currentUser.fullName,
        message: `💰 ${settlementMessage} for "${expense.description}"`,
        type: 'system'
      });

      Alert.alert(
        'Settlement Recorded',
        isFullySettled 
          ? 'Expense has been fully settled!' 
          : 'Partial settlement recorded successfully.',
        [{ text: 'OK', onPress: () => {
          onSettlementComplete();
          onClose();
        }}]
      );

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkFullySettled = async () => {
    if (!expense) return;

    Alert.alert(
      'Mark as Fully Settled',
      'This will mark the entire expense as settled. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const updatedSplitData = expense.splitData.map(split => ({
                ...split,
                isPaid: true,
                paidAt: new Date()
              }));

              await SplittingService.updateExpenseSettlement(expense.id, {
                splitData: updatedSplitData,
                isSettled: true,
                lastSettlementDate: new Date()
              });

              await SplittingService.sendGroupMessage({
                groupId: expense.groupId,
                userId: currentUser!.id,
                userName: currentUser!.fullName,
                message: `✅ Marked "${expense.description}" as fully settled`,
                type: 'system'
              });

              Alert.alert('Success', 'Expense marked as fully settled!', [
                { text: 'OK', onPress: () => {
                  onSettlementComplete();
                  onClose();
                }}
              ]);

            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to mark as settled');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderSettlementItem = (item: SettlementItem) => (
    <View key={item.userId} style={[styles.settlementItem, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.settlementHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.userAvatarText}>
              {item.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {item.userName}
            </Text>
            <Text style={[styles.owedAmount, { color: theme.colors.error }]}>
              Owes {getCurrencySymbol(expense?.currency || 'USD')}{item.amountOwed.toFixed(2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.settlementToggle,
            item.isSettled && { backgroundColor: theme.colors.success }
          ]}
          onPress={() => toggleUserSettlement(item.userId)}
        >
          <Ionicons 
            name={item.isSettled ? "checkmark" : "time"} 
            size={20} 
            color={item.isSettled ? "white" : theme.colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      {item.isSettled && (
        <View style={styles.settlementDetails}>
          <View style={styles.amountInput}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Amount Paid</Text>
            <View style={styles.amountContainer}>
              <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>
                {getCurrencySymbol(expense?.currency || 'USD')}
              </Text>
              <TextInput
                style={[styles.amountTextInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                value={item.amountToPay.toFixed(2)}
                onChangeText={(text) => updateSettlementAmount(item.userId, parseFloat(text) || 0)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.methodSelection}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Payment Method</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.methodOptions}>
                {(['cash', 'bank', 'venmo', 'paypal', 'other'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.methodOption,
                      item.settlementMethod === method && { backgroundColor: theme.colors.primary + '20' }
                    ]}
                    onPress={() => {
                      setSettlementItems(prev => prev.map(prevItem =>
                        prevItem.userId === item.userId
                          ? { ...prevItem, settlementMethod: method }
                          : prevItem
                      ));
                    }}
                  >
                    <Text style={[
                      styles.methodText,
                      { color: item.settlementMethod === method ? theme.colors.primary : theme.colors.textSecondary }
                    ]}>
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );

  if (!expense) return null;

  const totalOwed = settlementItems.reduce((sum, item) => sum + item.amountOwed, 0);
  const totalToPay = settlementItems.reduce((sum, item) => sum + (item.isSettled ? item.amountToPay : 0), 0);
  const hasSettlements = settlementItems.some(item => item.isSettled);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Settle Expense
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Expense Info */}
        <View style={[styles.expenseInfo, { backgroundColor: theme.colors.surface }]}>
          <Text style={styles.expenseIcon}>{expense.categoryIcon}</Text>
          <View style={styles.expenseDetails}>
            <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
              {expense.description}
            </Text>
            <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
              {getCurrencySymbol(expense.currency)}{expense.amount.toFixed(2)}
            </Text>
            <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
              {expense.date.toLocaleDateString()} • Paid by {expense.paidByData.fullName}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Settlement Summary */}
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Settlement Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Total Outstanding</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.error }]}>
                {getCurrencySymbol(expense.currency)}{totalOwed.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>To be Settled</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
                {getCurrencySymbol(expense.currency)}{totalToPay.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabelBold, { color: theme.colors.text }]}>Remaining</Text>
              <Text style={[styles.summaryValueBold, { color: theme.colors.text }]}>
                {getCurrencySymbol(expense.currency)}{(totalOwed - totalToPay).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Settlement Items */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Who's Paying? ({settlementItems.length} people)
          </Text>

          {settlementItems.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>All Settled!</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                This expense has been fully settled.
              </Text>
            </View>
          ) : (
            settlementItems.map(renderSettlementItem)
          )}

          {/* Settlement Note */}
          {hasSettlements && (
            <View style={[styles.noteSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Settlement Note (Optional)</Text>
              <TextInput
                style={[styles.noteInput, { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text 
                }]}
                placeholder="Add a note about this settlement..."
                placeholderTextColor={theme.colors.textSecondary}
                value={settlementNote}
                onChangeText={setSettlementNote}
                multiline
                numberOfLines={3}
              />
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {settlementItems.length > 0 && (
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <View style={styles.footerButtons}>
              <Button
                title="Mark All Settled"
                onPress={handleMarkFullySettled}
                variant="outline"
                style={styles.footerButton}
                disabled={loading}
              />
              <Button
                title={hasSettlements ? "Record Settlements" : "No Settlements"}
                onPress={handlePartialSettlement}
                loading={loading}
                disabled={!hasSettlements}
                style={styles.footerButton}
              />
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
  expenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  expenseIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  expenseDetails: {
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
  content: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settlementItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settlementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
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
  userName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  owedAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  settlementToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  settlementDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  amountInput: {
    marginBottom: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  amountTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  methodSelection: {
    marginBottom: 16,
  },
  methodOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  methodOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  methodText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noteSection: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
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