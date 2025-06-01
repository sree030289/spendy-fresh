// src/components/reminders/EditReminderModal.tsx
import React, { useState, useEffect } from 'react';
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
import CustomDateTimePicker from '@/components/common/DateTimePicker';
import { RemindersService } from '@/services/reminders/RemindersService';
import { Reminder, ReminderCategory, RecurringType } from '@/types/reminder';
import { formatCurrency } from '@/utils/currency';

interface EditReminderModalProps {
  visible: boolean;
  reminder: Reminder | null;
  onClose: () => void;
  onReminderUpdated: () => void;
}

export default function EditReminderModal({ 
  visible, 
  reminder, 
  onClose, 
  onReminderUpdated 
}: EditReminderModalProps) {
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
    notificationEnabled: true,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Simplify the useEffect and add dependency array to prevent unnecessary re-renders
  useEffect(() => {
    if (visible && reminder) {
      console.log('EditReminderModal: Initializing form data for reminder:', reminder.id);
      setFormData({
        title: reminder.title || '',
        description: reminder.description || '',
        amount: reminder.amount?.toString() || '',
        category: reminder.category || 'utilities',
        dueDate: reminder.dueDate ? new Date(reminder.dueDate) : new Date(),
        isRecurring: reminder.isRecurring || false,
        recurringType: reminder.recurringType || 'monthly',
        reminderDays: reminder.reminderDays || [1, 3],
        notificationEnabled: reminder.notificationEnabled !== false,
        notes: reminder.notes || '',
      });
      setErrors({});
      setHasChanges(false);
    }
  }, [visible, reminder?.id]); // Only depend on visible and reminder.id to prevent excessive re-renders

  // Reset form when modal is closed
  useEffect(() => {
    if (!visible) {
      setErrors({});
      setHasChanges(false);
      setLoading(false);
    }
  }, [visible]);

  // Early return with proper Modal structure to prevent React warning
  if (!reminder) {
    return (
      <Modal
        visible={false}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View />
      </Modal>
    );
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
      isValid = false;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
      isValid = false;
    }

    if (formData.dueDate < new Date() && reminder?.status !== 'paid') {
      newErrors.dueDate = 'Due date cannot be in the past';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!reminder || !validateForm()) return;

    if (!hasChanges) {
      Alert.alert('No Changes', 'No changes were made to save.');
      return;
    }

    setLoading(true);
    try {
      const updates: Partial<Reminder> = {
        title: formData.title.trim(),
        description: formData.description.trim() || '',
        amount: parseFloat(formData.amount),
        category: formData.category,
        dueDate: formData.dueDate,
        isRecurring: formData.isRecurring,
        ...(formData.isRecurring && { recurringType: formData.recurringType }),
        reminderDays: formData.reminderDays,
        notificationEnabled: formData.notificationEnabled,
        notes: formData.notes.trim() || '',
      };

      await RemindersService.updateReminder(reminder.id, updates);
      onReminderUpdated();
      Alert.alert('Success', 'Reminder updated successfully!');
    } catch (error) {
      console.error('Failed to update reminder:', error);
      Alert.alert('Error', 'Failed to update reminder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Your form change handlers...
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Check if there are changes compared to original reminder
      const hasChanged = 
        newData.title !== (reminder?.title || '') ||
        newData.description !== (reminder?.description || '') ||
        parseFloat(newData.amount) !== (reminder?.amount || 0) ||
        newData.category !== (reminder?.category || 'utilities') ||
        newData.dueDate.getTime() !== new Date(reminder?.dueDate || new Date()).getTime() ||
        newData.isRecurring !== (reminder?.isRecurring || false) ||
        newData.recurringType !== (reminder?.recurringType || 'monthly') ||
        JSON.stringify(newData.reminderDays) !== JSON.stringify(reminder?.reminderDays || [1, 3]) ||
        newData.notificationEnabled !== (reminder?.notificationEnabled !== false) ||
        newData.notes !== (reminder?.notes || '');
      
      setHasChanges(hasChanged);
      
      return newData;
    });
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Your existing modal content */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancelButton, { color: theme.colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Edit Reminder
          </Text>
          <TouchableOpacity 
            onPress={handleSave}
            disabled={loading || !hasChanges}
          >
            <Text style={[
              styles.saveButton, 
              { 
                color: (loading || !hasChanges) ? theme.colors.textSecondary : theme.colors.primary 
              }
            ]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rest of your form content... */}
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
                  // Only allow numbers and decimal point
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

          {/* Notification Settings */}
          <View style={styles.inputGroup}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={[styles.label, { color: theme.colors.text }]}>
                  Notifications
                </Text>
                <Text style={[styles.sublabel, { color: theme.colors.textSecondary }]}>
                  Get reminded before due date
                </Text>
              </View>
              <Switch
                value={formData.notificationEnabled}
                onValueChange={(value) => setFormData({ ...formData, notificationEnabled: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={formData.notificationEnabled ? 'white' : theme.colors.textSecondary}
              />
            </View>

            {formData.notificationEnabled && (
              <TouchableOpacity
                style={[
                  styles.selector,
                  styles.recurringSelector,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => setShowReminderDaysPicker(true)}
              >
                <Ionicons 
                  name="notifications-outline" 
                  size={20} 
                  color={theme.colors.textSecondary} 
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.selectorText, { color: theme.colors.text }]}>
                  {formData.reminderDays.length > 0 
                    ? `Remind ${formData.reminderDays.length} time${formData.reminderDays.length === 1 ? '' : 's'}`
                    : 'Set reminder schedule'
                  }
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Notes
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
              placeholder="Add any additional notes (optional)"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />
          </View>

          {/* Auto-detected Info */}
          {reminder.autoDetected && (
            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                  Auto-detected Bill
                </Text>
                <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                  This reminder was automatically created from your email
                  {reminder.emailSource && ` from ${reminder.emailSource}`}.
                </Text>
              </View>
            </View>
          )}

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
              {formData.notificationEnabled && formData.reminderDays.length > 0 && (
                <Text style={[styles.previewNotifications, { color: theme.colors.textSecondary }]}>
                  Reminders: {formData.reminderDays.map(d => `${d} day${d === 1 ? '' : 's'}`).join(', ')} before
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <Button
            title={hasChanges ? "Save Changes" : "No Changes"}
            onPress={handleSave}
            loading={loading}
            disabled={!hasChanges}
            style={styles.submitButton}
          />
        </View>
      </SafeAreaView>

      {/* Date Picker */}
      <CustomDateTimePicker
        visible={showDatePicker}
        value={formData.dueDate}
        mode="date"
        minimumDate={reminder.status === 'paid' ? undefined : new Date()}
        title="Select Due Date"
        onChange={(date) => setFormData({ ...formData, dueDate: date })}
        onClose={() => setShowDatePicker(false)}
      />

      <CategoryPicker />
      <RecurringPicker />
      <ReminderDaysPicker />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  changesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  changesText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
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
  previewNotifications: {
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
  doneText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pickerSubtitle: {
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    lineHeight: 20,
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
  reminderDayOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reminderDayLabel: {
    fontSize: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});