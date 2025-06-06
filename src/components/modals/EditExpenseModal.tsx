import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { getCurrencySymbol } from '../../utils/currency';
import { Expense, ExpenseSplit, SplittingService } from '../../services/firebase/splitting';
import ExpenseRefreshService from '../../services/expenseRefreshService';
interface EditExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (expenseData: any) => Promise<void>;
  expense: Expense | null;
}

const expenseCategories = [
  { id: 'food', name: 'Food & Dining', icon: '🍕' },
  { id: 'transport', name: 'Transportation', icon: '🚗' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'other', name: 'Other', icon: '📝' },
];

export default function EditExpenseModal({ 
  visible, 
  onClose, 
  onSubmit, 
  expense 
}: EditExpenseModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(expenseCategories[0]);
  const [notes, setNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [splitData, setSplitData] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expense && visible) {
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setNotes(expense.notes || '');
      setSplitData(expense.splitData);
      setExpenseDate(new Date(expense.createdAt));
      
      const category = expenseCategories.find(cat => cat.id === expense.category);
      if (category) {
        setSelectedCategory(category);
      }
    }
  }, [expense, visible]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setNotes('');
    setSplitData([]);
    setSelectedCategory(expenseCategories[0]);
    setExpenseDate(new Date());
  };

const handleSubmit = async () => {
  if (!expense || !user?.id) return;

  if (!description.trim()) {
    Alert.alert('Missing Information', 'Please enter a description');
    return;
  }

  if (!amount || parseFloat(amount) <= 0) {
    Alert.alert('Invalid Amount', 'Please enter a valid amount');
    return;
  }

  setLoading(true);
  try {
    const expenseData = {
      id: expense.id,
      description: description.trim(),
      amount: parseFloat(amount),
      currency: user?.currency || 'AUD',
      category: selectedCategory.id,
      categoryIcon: selectedCategory.icon,
      groupId: expense.groupId,
      paidBy: expense.paidBy,
      splitType: expense.splitType,
      splitData: splitData.map(split => ({
        userId: split.userId,
        amount: split.amount,
        percentage: split.percentage,
        isPaid: split.isPaid,
      })),
      notes: notes.trim(),
      tags: expense.tags || [],
      expenseDate,
    };

    // Use the SplittingService updateExpense method
    await SplittingService.updateExpense(expenseData);
    
    Alert.alert('Success', 'Expense updated successfully!');
    resetForm();
    onClose(); // Close the modal
    
    // Notify expense refresh service
    ExpenseRefreshService.getInstance().notifyExpenseAdded();
    
  } catch (error) {
    console.error('Update expense error:', error);
    Alert.alert('Error', 'Failed to update expense. Please try again.');
  } finally {
    setLoading(false);
  }
};

  const updateSplitAmount = (userId: string, newAmount: number) => {
    setSplitData(prev => prev.map(split => 
      split.userId === userId 
        ? { ...split, amount: newAmount }
        : split
    ));
  };

  const recalculateEqual = () => {
    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount) || splitData.length === 0) return;

    const equalShare = totalAmount / splitData.length;
    setSplitData(prev => prev.map(split => ({
      ...split,
      amount: equalShare,
      percentage: 100 / splitData.length
    })));
  };

  useEffect(() => {
    if (amount && splitData.length > 0) {
      recalculateEqual();
    }
  }, [amount]);

  if (!expense) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Edit Expense
            </Text>
            <TouchableOpacity 
              onPress={handleSubmit} 
              style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Basic Info */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Expense Details
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border 
                  }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What was this expense for?"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Amount</Text>
                <View style={styles.amountContainer}>
                  <Text style={[styles.currencySymbol, { color: theme.colors.text }]}>
                    {getCurrencySymbol(user?.currency || 'USD')}
                  </Text>
                  <TextInput
                    style={[styles.amountInput, { 
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      borderColor: theme.colors.border 
                    }]}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Date */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Date</Text>
                <TouchableOpacity
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={[styles.dateText, { color: theme.colors.text }]}>
                    {expenseDate.toLocaleDateString()}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={expenseDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setExpenseDate(selectedDate);
                      }
                    }}
                    maximumDate={new Date()}
                  />
                )}
              </View>
            </View>

            {/* Category Selection */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
                {expenseCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      selectedCategory.id === category.id && [
                        styles.selectedCategory,
                        { backgroundColor: theme.colors.primary + '20' }
                      ]
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text style={[
                      styles.categoryName,
                      { color: theme.colors.text },
                      selectedCategory.id === category.id && { color: theme.colors.primary }
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Split Details */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Split Details
              </Text>
              {splitData.map((split, index) => (
                <View key={split.userId} style={styles.splitItem}>
                  <View style={styles.splitLeft}>
                    <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.memberAvatarText}>
                        {index === 0 ? 'Y' : `M${index}`}
                      </Text>
                    </View>
                    <Text style={[styles.memberName, { color: theme.colors.text }]}>
                      {split.userId === expense.paidBy ? 'You' : `Member ${index}`}
                    </Text>
                  </View>
                  <View style={styles.splitRight}>
                    <TextInput
                      style={[styles.splitAmountInput, { 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        borderColor: theme.colors.border 
                      }]}
                      value={split.amount.toFixed(2)}
                      onChangeText={(value) => updateSplitAmount(split.userId, parseFloat(value) || 0)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Notes */}
            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Notes (Optional)
              </Text>
              <TextInput
                style={[styles.notesInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: theme.colors.border 
                }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any additional notes..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  dateText: {
    fontSize: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
  },
  categoryButton: {
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  selectedCategory: {
    borderWidth: 2,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 10,
    textAlign: 'center',
  },
  splitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  splitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
  },
  splitRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitAmountInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    textAlign: 'right',
    minWidth: 80,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
