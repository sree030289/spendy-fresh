// src/components/reminders/AddReminderModal.tsx - Fixed with proper imports
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { CustomDateTimePicker } from '@/components/common/DateTimePicker'; // Use named import
import { RemindersService } from '@/services/reminders/RemindersService';
import { ReminderCategory, RecurringType } from '@/types/reminder';
import { formatCurrency } from '@/utils/currency';

interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onReminderAdded: () => void;
}

const CATEGORIES: Array<{ id: ReminderCategory; label: string; icon: string; color: string }> = [
  { id: 'utilities', label: 'Utilities', icon: 'flash-outline', color: '#F59E0B' },
  { id: 'entertainment', label: 'Entertainment', icon: 'play-outline', color: '#8B5CF6' },
  { id: 'finance', label: 'Finance', icon: 'card-outline', color: '#EF4444' },
  { id: 'insurance', label: 'Insurance', icon: 'shield-outline', color: '#10B981' },
  { id: 'subscription', label: 'Subscription', icon: 'repeat-outline', color: '#3B82F6' },
  { id: 'rent', label: 'Rent', icon: 'home-outline', color: '#F97316' },
  { id: 'food', label: 'Food', icon: 'restaurant-outline', color: '#EC4899' },
  { id: 'transport', label: 'Transport', icon: 'car-outline', color: '#06B6D4' },
  { id: 'health', label: 'Health', icon: 'medical-outline', color: '#84CC16' },
  { id: 'education', label: 'Education', icon: 'school-outline', color: '#6366F1' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-outline', color: '#F472B6' },
  { id: 'other', label: 'Other', icon: 'ellipse-outline', color: '#6B7280' },
];

const RECURRING_OPTIONS: Array<{ id: RecurringType; label: string; description: string }> = [
  { id: 'weekly', label: 'Weekly', description: 'Every 7 days' },
  { id: 'biweekly', label: 'Bi-weekly', description: 'Every 14 days' },
  { id: 'monthly', label: 'Monthly', description: 'Every month' },
  { id: 'quarterly', label: 'Quarterly', description: 'Every 3 months' },
  { id: 'yearly', label: 'Yearly', description: 'Every year' },
];

export default function AddReminderModal({ visible, onClose, onReminderAdded }: AddReminderModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    category: 'utilities' as ReminderCategory,
    dueDate: new Date(),
    isRecurring: false,
    recurringType: 'monthly' as RecurringType,
    reminderDays: [1, 3],
  });
  
  const [errors, setErrors] = useState({
    title: '',
    amount: '',
    dueDate: '',
  });

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showRecurringPicker, setShowRecurringPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const validateForm = (): boolean => {
    const newErrors = { title: '', amount: '', dueDate: '' };
    let isValid = true;

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
      isValid = false;
    }

    const amount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amount) || amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
      isValid = false;
    }

    if (formData.dueDate < new Date()) {
      newErrors.dueDate = 'Due date cannot be in the past';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await RemindersService.createReminder(user?.id || '', {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        amount: parseFloat(formData.amount),
        currency: user?.currency || 'USD',
        category: formData.category,
        dueDate: formData.dueDate,
        status: 'upcoming',
        isRecurring: formData.isRecurring,
        recurringType: formData.isRecurring ? formData.recurringType : undefined,
        reminderDays: formData.reminderDays,
        notificationEnabled: true,
        autoDetected: false,
      });

      Alert.alert('Success', 'Reminder created successfully!');
      onReminderAdded();
      onClose();
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to create reminder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      amount: '',
      category: 'utilities',
      dueDate: new Date(),
      isRecurring: false,
      recurringType: 'monthly',
      reminderDays: [1, 3],
    });
    setErrors({ title: '', amount: '', dueDate: '' });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const selectedCategory = CATEGORIES.find(cat => cat.id === formData.category) || CATEGORIES[0];

  const CategoryPicker = () => (
    <Modal
      visible={showCategoryPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCategoryPicker(false)}
    >
      <SafeAreaView style={[styles.pickerContainer, { backgroundColor: theme.colors.background }]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>
            Select Category
          </Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.pickerOptions}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.pickerOption, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                setFormData({ ...formData, category: category.id });
                setShowCategoryPicker(false);
              }}
            >
              <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                <Ionicons name={category.icon as any} size={20} color="white" />
              </View>
              <Text style={[styles.pickerOptionText, { color: theme.colors.text }]}>
                {category.label}
              </Text>
              {formData.category === category.id && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const RecurringPicker = () => (
    <Modal
      visible={showRecurringPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowRecurringPicker(false)}
    >
      <SafeAreaView style={[styles.pickerContainer, { backgroundColor: theme.colors.background }]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setShowRecurringPicker(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>
            Recurring Frequency
          </Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.pickerOptions}>
          {RECURRING_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.pickerOption, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                setFormData({ ...formData, recurringType: option.id });
                setShowRecurringPicker(false);
              }}
            >
              <View style={styles.recurringContent}>
                <Text style={[styles.pickerOptionText, { color: theme.colors.text }]}>
                  {option.label}
                </Text>
                <Text style={[styles.pickerOptionDescription, { color: theme.colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
              {formData.recurringType === option.id && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, { color: theme.colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Add Reminder
            </Text>
            
            <TouchableOpacity 
              onPress={handleSubmit} 
              style={styles.headerButton}
              disabled={loading}
            >
              <Text style={[styles.headerButtonText, { 
                color: loading ? theme.colors.textSecondary : theme.colors.primary 
              }]}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Title *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: errors.title ? theme.colors.error : theme.colors.border,
                    color: theme.colors.text,
                  }
                ]}
                placeholder="Enter reminder title"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.title}
                onChangeText={(text) => {
                  setFormData({ ...formData, title: text });
                  if (errors.title) setErrors({ ...errors, title: '' });
                }}
                returnKeyType="next"
              />
              {errors.title ? (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.title}
                </Text>
              ) : null}
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  }
                ]}
                placeholder="Add a description (optional)"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={3}
                returnKeyType="next"
              />
            </View>

            {/* Amount */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Amount *
              </Text>
              <View style={styles.amountContainer}>
                <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>
                  {user?.currency || 'USD'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.amountInput,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: errors.amount ? theme.colors.error : theme.colors.border,
                      color: theme.colors.text,
                    }
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.amount}
                  onChangeText={(text) => {
                    const numericText = text.replace(/[^0-9.]/g, '');
                    setFormData({ ...formData, amount: numericText });
                    if (errors.amount) setErrors({ ...errors, amount: '' });
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>
              {errors.amount ? (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.amount}
                </Text>
              ) : null}
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Category
              </Text>
              <TouchableOpacity
                style={[
                  styles.selector,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => setShowCategoryPicker(true)}
              >
                <View style={[styles.categoryIcon, { backgroundColor: selectedCategory.color }]}>
                  <Ionicons name={selectedCategory.icon as any} size={16} color="white" />
                </View>
                <Text style={[styles.selectorText, { color: theme.colors.text }]}>
                  {selectedCategory.label}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Due Date */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Due Date *
              </Text>
              <TouchableOpacity
                style={[
                  styles.selector,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: errors.dueDate ? theme.colors.error : theme.colors.border,
                  }
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons 
                  name="calendar-outline" 
                  size={20} 
                  color={theme.colors.textSecondary} 
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.selectorText, { color: theme.colors.text }]}>
                  {formatDate(formData.dueDate)}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              {errors.dueDate ? (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.dueDate}
                </Text>
              ) : null}
            </View>

            {/* Recurring */}
            <View style={styles.inputGroup}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Recurring Bill
                  </Text>
                  <Text style={[styles.sublabel, { color: theme.colors.textSecondary }]}>
                    This bill repeats regularly
                  </Text>
                </View>
                <Switch
                  value={formData.isRecurring}
                  onValueChange={(value) => setFormData({ ...formData, isRecurring: value })}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={formData.isRecurring ? 'white' : theme.colors.textSecondary}
                />
              </View>
              
              {formData.isRecurring && (
                <TouchableOpacity
                  style={[
                    styles.selector,
                    styles.recurringSelector,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    }
                  ]}
                  onPress={() => setShowRecurringPicker(true)}
                >
                  <Ionicons 
                    name="repeat-outline" 
                    size={20} 
                    color={theme.colors.textSecondary} 
                    style={{ marginRight: 12 }}
                  />
                  <Text style={[styles.selectorText, { color: theme.colors.text }]}>
                    {RECURRING_OPTIONS.find(opt => opt.id === formData.recurringType)?.label || 'Monthly'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Preview */}
            <View style={[styles.previewCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.previewTitle, { color: theme.colors.text }]}>
                Preview
              </Text>
              <View style={styles.previewContent}>
                <View style={styles.previewRow}>
                  <Ionicons name={selectedCategory.icon as any} size={20} color={selectedCategory.color} />
                  <Text style={[styles.previewText, { color: theme.colors.text }]}>
                    {formData.title || 'Reminder Title'}
                  </Text>
                  <Text style={[styles.previewAmount, { color: theme.colors.primary }]}>
                    {formData.amount ? formatCurrency(parseFloat(formData.amount) || 0, user?.currency || 'USD') : '$0.00'}
                  </Text>
                </View>
                <Text style={[styles.previewDate, { color: theme.colors.textSecondary }]}>
                  Due: {formatDate(formData.dueDate)}
                  {formData.isRecurring && ` • Repeats ${formData.recurringType}`}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.footer}>
            <Button
              title="Create Reminder"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Date Picker */}
        <CustomDateTimePicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onChange={(date) => setFormData({ ...formData, dueDate: date })}
          value={formData.dueDate}
          mode="date"
          minimumDate={new Date()}
          title="Select Due Date"
        />

        <CategoryPicker />
        <RecurringPicker />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginTop: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 14,
    marginTop: 2,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
  },
  recurringSelector: {
    marginTop: 12,
  },
  categoryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
  },
  previewCard: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewContent: {
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  previewAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewDate: {
    fontSize: 14,
    marginLeft: 32,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    marginBottom: 8,
  },
  pickerContainer: {
    flex: 1,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pickerOptions: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  pickerOptionText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  recurringContent: {
    flex: 1,
    marginLeft: 12,
  },
  pickerOptionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
});