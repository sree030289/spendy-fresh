import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reminder: ReminderData) => void;
}

interface ReminderData {
  title: string;
  amount: number;
  dueDate: Date;
  category: string;
  isRecurring: boolean;
  notificationEnabled: boolean;
  reminderDays: number[];
}

export default function AddReminderModal({ visible, onClose, onSubmit }: AddReminderModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [category, setCategory] = useState('Bills');
  const [isRecurring, setIsRecurring] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const categories = ['Bills', 'Subscriptions', 'Insurance', 'Loans', 'Utilities', 'Other'];

  const handleSubmit = () => {
    if (!title || !amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const reminderData: ReminderData = {
      title: title.trim(),
      amount: numericAmount,
      dueDate,
      category,
      isRecurring,
      notificationEnabled,
      reminderDays: [3, 1], // 3 days and 1 day before
    };

    onSubmit(reminderData);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setDueDate(new Date());
    setCategory('Bills');
    setIsRecurring(false);
    setNotificationEnabled(true);
  };

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <BlurView intensity={100} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Reminder</Text>
            <TouchableOpacity onPress={handleSubmit} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Electric Bill"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Amount *</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Due Date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color="#10B981" />
              <Text style={styles.dateText}>{dueDate.toLocaleDateString()}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    category === cat && styles.categoryButtonTextActive,
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.toggleSection}>
            <TouchableOpacity
              style={styles.toggleContainer}
              onPress={() => setIsRecurring(!isRecurring)}
            >
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Recurring Reminder</Text>
                <Text style={styles.toggleSubtitle}>Repeats monthly</Text>
              </View>
              <View style={[styles.toggle, isRecurring && styles.toggleActive]}>
                <View style={[styles.toggleKnob, isRecurring && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleSection}>
            <TouchableOpacity
              style={styles.toggleContainer}
              onPress={() => setNotificationEnabled(!notificationEnabled)}
            >
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Notifications</Text>
                <Text style={styles.toggleSubtitle}>Get reminded before due date</Text>
              </View>
              <View style={[styles.toggle, notificationEnabled && styles.toggleActive]}>
                <View style={[styles.toggleKnob, notificationEnabled && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                setDueDate(selectedDate);
              }
            }}
          />
        )}
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#10B981',
    borderRadius: 20,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    padding: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#1F2937',
  },
  categoryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#10B981',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  toggleSection: {
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#10B981',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  // Bank connection styles
  description: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bankItemSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  bankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankLogo: {
    fontSize: 24,
    marginRight: 12,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  connectButton: {
    marginTop: 20,
    borderRadius: 12,
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  // Transaction details styles
  transactionHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  transactionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  transactionEmoji: {
    fontSize: 32,
  },
  transactionAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  transactionDate: {
    fontSize: 16,
    color: '#6B7280',
  },
  detailsGrid: {
    marginBottom: 24,
  },
  detailItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
  },
  detailInput: {
    fontSize: 16,
    color: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
  },
  tagsSection: {
    marginBottom: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#EBF8FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#1E40AF',
  },
  aiInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  aiText: {
    fontSize: 14,
    color: '#166534',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
});