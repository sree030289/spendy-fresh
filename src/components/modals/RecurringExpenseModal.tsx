// src/components/modals/RecurringExpenseModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';
import { RecurringExpense, SplittingService, Group } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';
import { User } from '@/types';

interface RecurringExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (recurringData: any) => void;
  groups: Group[];
  currentUser: User | null;
  editingRecurring?: RecurringExpense | null;
}

const EXPENSE_CATEGORIES = [
  { id: 'housing', name: 'Rent/Mortgage', icon: '🏠' },
  { id: 'utilities', name: 'Utilities', icon: '⚡' },
  { id: 'transport', name: 'Transportation', icon: '🚗' },
  { id: 'food', name: 'Groceries', icon: '🛒' },
  { id: 'entertainment', name: 'Subscriptions', icon: '📺' },
  { id: 'healthcare', name: 'Insurance', icon: '🏥' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'other', name: 'Other', icon: '💰' },
];

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly', description: 'Every 7 days' },
  { value: 'monthly', label: 'Monthly', description: 'Every month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly', description: 'Every year' },
];

export default function RecurringExpenseModal({
  visible,
  onClose,
  onSubmit,
  groups,
  currentUser,
  editingRecurring
}: RecurringExpenseModalProps) {
  const { theme } = useTheme();
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [maxOccurrences, setMaxOccurrences] = useState<number | null>(null);
  const [hasMaxOccurrences, setHasMaxOccurrences] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (visible) {
      if (editingRecurring) {
        // Populate form for editing
        setTemplateName(editingRecurring.templateName);
        setDescription(editingRecurring.description);
        setAmount(editingRecurring.amount.toString());
        setSelectedCategory(EXPENSE_CATEGORIES.find(cat => cat.id === editingRecurring.category) || EXPENSE_CATEGORIES[0]);
        setSelectedGroup(groups.find(g => g.id === editingRecurring.groupId) || null);
        setFrequency(editingRecurring.frequency);
        setStartDate(editingRecurring.startDate);
        setEndDate(editingRecurring.endDate || null);
        setHasEndDate(!!editingRecurring.endDate);
        setMaxOccurrences(editingRecurring.maxOccurrences || null);
        setHasMaxOccurrences(!!editingRecurring.maxOccurrences);
      } else {
        resetForm();
      }
    }
  }, [visible, editingRecurring, groups]);

  const resetForm = () => {
    setTemplateName('');
    setDescription('');
    setAmount('');
    setSelectedCategory(EXPENSE_CATEGORIES[0]);
    setSelectedGroup(null);
    setFrequency('monthly');
    setStartDate(new Date());
    setEndDate(null);
    setHasEndDate(false);
    setMaxOccurrences(null);
    setHasMaxOccurrences(false);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: any = {};

    if (!templateName.trim()) {
      newErrors.templateName = 'Template name is required';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!selectedGroup) {
      newErrors.group = 'Please select a group';
    }

    if (hasEndDate && endDate && endDate <= startDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    if (hasMaxOccurrences && (!maxOccurrences || maxOccurrences <= 0)) {
      newErrors.maxOccurrences = 'Please enter a valid number of occurrences';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateNextDueDate = (start: Date, freq: string): Date => {
    const next = new Date(start);
    switch (freq) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  };

  const getEstimatedTotal = (): number => {
    const numericAmount = parseFloat(amount) || 0;
    if (hasMaxOccurrences && maxOccurrences) {
      return numericAmount * maxOccurrences;
    }
    if (hasEndDate && endDate) {
      // Calculate occurrences between start and end date
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let occurrences = 0;
      switch (frequency) {
        case 'weekly':
          occurrences = Math.ceil(diffDays / 7);
          break;
        case 'monthly':
          occurrences = Math.ceil(diffDays / 30);
          break;
        case 'quarterly':
          occurrences = Math.ceil(diffDays / 90);
          break;
        case 'yearly':
          occurrences = Math.ceil(diffDays / 365);
          break;
      }
      return numericAmount * occurrences;
    }
    
    // Default to 12 occurrences for estimation
    return numericAmount * 12;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !currentUser || !selectedGroup) return;

    setLoading(true);
    try {
      // Calculate next due date
      const nextDueDate = frequency === 'weekly' && startDate.getTime() > Date.now() 
        ? startDate 
        : calculateNextDueDate(startDate, frequency);

      // Initialize split data with equal split for all active group members
      const activeMembers = selectedGroup.members.filter(member => member.isActive);
      const equalShare = parseFloat(amount) / activeMembers.length;

      const splitData = activeMembers.map(member => ({
        userId: member.userId,
        amount: equalShare,
        percentage: 100 / activeMembers.length,
        isPaid: false
      }));

      const recurringData = {
        templateName: templateName.trim(),
        description: description.trim(),
        amount: parseFloat(amount),
        currency: currentUser.currency || 'USD',
        category: selectedCategory.id,
        categoryIcon: selectedCategory.icon,
        groupId: selectedGroup.id,
        paidBy: currentUser.id,
        splitType: 'equal' as const,
        splitData,
        frequency,
        startDate,
        endDate: hasEndDate ? endDate : undefined,
        nextDueDate,
        maxOccurrences: hasMaxOccurrences ? maxOccurrences : undefined,
        isActive: true,
        createdBy: currentUser.id
      };

      await onSubmit(recurringData);
      resetForm();
      onClose();

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create recurring expense');
    } finally {
      setLoading(false);
    }
  };

  const renderFrequencyOption = (option: typeof FREQUENCY_OPTIONS[0]) => (
    <TouchableOpacity
      key={option.value}
      style={[
        styles.frequencyOption,
        frequency === option.value && [
          styles.selectedFrequency,
          { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
        ]
      ]}
      onPress={() => setFrequency(option.value as any)}
    >
      <Text style={[
        styles.frequencyLabel,
        { color: frequency === option.value ? theme.colors.primary : theme.colors.text }
      ]}>
        {option.label}
      </Text>
      <Text style={[
        styles.frequencyDescription,
        { color: frequency === option.value ? theme.colors.primary : theme.colors.textSecondary }
      ]}>
        {option.description}
      </Text>
    </TouchableOpacity>
  );

  const renderPreview = () => {
    const nextDue = calculateNextDueDate(startDate, frequency);
    const estimatedTotal = getEstimatedTotal();

    return (
      <View style={[styles.previewCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.previewTitle, { color: theme.colors.text }]}>
          Preview
        </Text>
        
        <View style={styles.previewRow}>
          <Text style={[styles.previewLabel, { color: theme.colors.textSecondary }]}>Next Due</Text>
          <Text style={[styles.previewValue, { color: theme.colors.text }]}>
            {nextDue.toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.previewRow}>
          <Text style={[styles.previewLabel, { color: theme.colors.textSecondary }]}>Amount Each Time</Text>
          <Text style={[styles.previewValue, { color: theme.colors.text }]}>
            {getCurrencySymbol(currentUser?.currency || 'USD')}{parseFloat(amount || '0').toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.previewRow}>
          <Text style={[styles.previewLabel, { color: theme.colors.textSecondary }]}>Estimated Total</Text>
          <Text style={[styles.previewValue, { color: theme.colors.primary }]}>
            {getCurrencySymbol(currentUser?.currency || 'USD')}{estimatedTotal.toFixed(2)}
          </Text>
        </View>
        
        {hasMaxOccurrences && maxOccurrences && (
          <View style={styles.previewRow}>
            <Text style={[styles.previewLabel, { color: theme.colors.textSecondary }]}>Total Occurrences</Text>
            <Text style={[styles.previewValue, { color: theme.colors.text }]}>
              {maxOccurrences} times
            </Text>
          </View>
        )}
        
        {hasEndDate && endDate && (
          <View style={styles.previewRow}>
            <Text style={[styles.previewLabel, { color: theme.colors.textSecondary }]}>Ends On</Text>
            <Text style={[styles.previewValue, { color: theme.colors.text }]}>
              {endDate.toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {editingRecurring ? 'Edit Recurring' : 'Create Recurring Expense'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Template Name */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Template Name *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.templateName ? theme.colors.error : theme.colors.border,
                  color: theme.colors.text,
                }
              ]}
              placeholder="e.g., Monthly Rent, Weekly Groceries"
              placeholderTextColor={theme.colors.textSecondary}
              value={templateName}
              onChangeText={(text) => {
                setTemplateName(text);
                if (errors.templateName) setErrors((prev: any) => ({ ...prev, templateName: '' }));
              }}
              maxLength={50}
            />
            {errors.templateName && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.templateName}
              </Text>
            )}
          </View>

          {/* Description */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: errors.description ? theme.colors.error : theme.colors.border,
                  color: theme.colors.text,
                }
              ]}
              placeholder="What is this recurring expense for?"
              placeholderTextColor={theme.colors.textSecondary}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (errors.description) setErrors((prev: any) => ({ ...prev, description: '' }));
              }}
              maxLength={100}
            />
            {errors.description && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.description}
              </Text>
            )}
          </View>

          {/* Amount */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Amount *</Text>
            <View style={styles.amountInputContainer}>
              <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>
                {getCurrencySymbol(currentUser?.currency || 'USD')}
              </Text>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: errors.amount ? theme.colors.error : theme.colors.border,
                    color: theme.colors.text,
                  }
                ]}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textSecondary}
                value={amount}
                onChangeText={(text) => {
                  setAmount(text);
                  if (errors.amount) setErrors((prev: any) => ({ ...prev, amount: '' }));
                }}
                keyboardType="decimal-pad"
              />
            </View>
            {errors.amount && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.amount}
              </Text>
            )}
          </View>

          {/* Category */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryList}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryItem,
                      selectedCategory.id === category.id && [
                        styles.selectedCategory,
                        { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                      ]
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text style={[
                      styles.categoryName,
                      {
                        color: selectedCategory.id === category.id 
                          ? theme.colors.primary 
                          : theme.colors.textSecondary
                      }
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Group Selection */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Group *</Text>
            {groups.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                  No groups available
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.groupList}>
                  {groups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupItem,
                        selectedGroup?.id === group.id && [
                          styles.selectedGroup,
                          { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                        ]
                      ]}
                      onPress={() => setSelectedGroup(group)}
                    >
                      <Text style={styles.groupIcon}>{group.avatar}</Text>
                      <Text style={[
                        styles.groupName,
                        {
                          color: selectedGroup?.id === group.id 
                            ? theme.colors.primary 
                            : theme.colors.text
                        }
                      ]}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
            {errors.group && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.group}
              </Text>
            )}
          </View>

          {/* Frequency */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Frequency</Text>
            <View style={styles.frequencyGrid}>
              {FREQUENCY_OPTIONS.map(renderFrequencyOption)}
            </View>
          </View>

          {/* Start Date */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Start Date</Text>
            <TouchableOpacity
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }
              ]}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={[styles.dateText, { color: theme.colors.text }]}>
                {startDate.toLocaleDateString()}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowStartDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setStartDate(selectedDate);
                  }
                }}
                minimumDate={new Date()}
              />
            )}
          </View>

          {/* End Conditions */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>End Condition (Optional)</Text>
            
            {/* End Date Option */}
            <TouchableOpacity
              style={[
                styles.endConditionOption,
                hasEndDate && [styles.selectedEndCondition, { backgroundColor: theme.colors.primary + '20' }]
              ]}
              onPress={() => {
                setHasEndDate(!hasEndDate);
                if (hasEndDate) {
                  setEndDate(null);
                  setHasMaxOccurrences(false);
                  setMaxOccurrences(null);
                }
              }}
            >
              <View style={styles.endConditionLeft}>
                <Ionicons
                  name={hasEndDate ? "checkbox" : "square-outline"}
                  size={20}
                  color={hasEndDate ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text style={[
                  styles.endConditionText,
                  { color: hasEndDate ? theme.colors.primary : theme.colors.text }
                ]}>
                  End on specific date
                </Text>
              </View>
            </TouchableOpacity>

            {hasEndDate && (
              <TouchableOpacity
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: errors.endDate ? theme.colors.error : theme.colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 8,
                  }
                ]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={[styles.dateText, { color: theme.colors.text }]}>
                  {endDate ? endDate.toLocaleDateString() : 'Select end date'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}

            {showEndDatePicker && (
              <DateTimePicker
                value={endDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setEndDate(selectedDate);
                  }
                }}
                minimumDate={startDate}
              />
            )}

            {/* Max Occurrences Option */}
            <TouchableOpacity
              style={[
                styles.endConditionOption,
                hasMaxOccurrences && [styles.selectedEndCondition, { backgroundColor: theme.colors.primary + '20' }]
              ]}
              onPress={() => {
                setHasMaxOccurrences(!hasMaxOccurrences);
                if (hasMaxOccurrences) {
                  setMaxOccurrences(null);
                  setHasEndDate(false);
                  setEndDate(null);
                }
              }}
            >
              <View style={styles.endConditionLeft}>
                <Ionicons
                  name={hasMaxOccurrences ? "checkbox" : "square-outline"}
                  size={20}
                  color={hasMaxOccurrences ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text style={[
                  styles.endConditionText,
                  { color: hasMaxOccurrences ? theme.colors.primary : theme.colors.text }
                ]}>
                  Limit number of occurrences
                </Text>
              </View>
            </TouchableOpacity>

            {hasMaxOccurrences && (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: errors.maxOccurrences ? theme.colors.error : theme.colors.border,
                    color: theme.colors.text,
                    marginTop: 8,
                  }
                ]}
                placeholder="e.g., 12 (for 12 months)"
                placeholderTextColor={theme.colors.textSecondary}
                value={maxOccurrences?.toString() || ''}
                onChangeText={(text) => {
                  setMaxOccurrences(parseInt(text) || null);
                  if (errors.maxOccurrences) setErrors((prev: any) => ({ ...prev, maxOccurrences: '' }));
                }}
                keyboardType="number-pad"
              />
            )}

            {errors.endDate && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.endDate}
              </Text>
            )}
            {errors.maxOccurrences && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.maxOccurrences}
              </Text>
            )}
          </View>

          {/* Preview */}
          {amount && selectedGroup && renderPreview()}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Button
            title={editingRecurring ? 'Update Recurring Expense' : 'Create Recurring Expense'}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
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
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  dateText: {
    fontSize: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    marginTop: 6,
  },
  categoryList: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  categoryItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
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
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  groupList: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  groupItem: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 120,
  },
  selectedGroup: {
    borderWidth: 2,
  },
  groupIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  frequencyGrid: {
    gap: 8,
  },
  frequencyOption: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFrequency: {
    borderWidth: 2,
  },
  frequencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  frequencyDescription: {
    fontSize: 14,
  },
  endConditionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedEndCondition: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  endConditionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  endConditionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  previewLabel: {
    fontSize: 14,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
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
  footer: {
    borderTopWidth: 1,
    padding: 20,
  },
  submitButton: {
    width: '100%',
  },
});