import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../common/Icon';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { PersonalIncomeCategory, PersonalExpenseCategory, PaymentMethod } from '@/types/moneyManagement';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  editTransaction?: any;
}

interface CategoryItem {
  name: string;
  icon: string;
  color: string;
}

const INCOME_CATEGORIES: CategoryItem[] = [
  { name: 'Salary', icon: '💰', color: '#10B981' },
  { name: 'Freelance', icon: '💼', color: '#3B82F6' },
  { name: 'Business', icon: '🏢', color: '#8B5CF6' },
  { name: 'Investment', icon: '📈', color: '#06B6D4' },
  { name: 'Bonus', icon: '🎉', color: '#10B981' },
  { name: 'Gift', icon: '🎁', color: '#EC4899' },
  { name: 'Other', icon: '💵', color: '#6B7280' },
];

const EXPENSE_CATEGORIES: CategoryItem[] = [
  { name: 'Food', icon: '🍽️', color: '#EF4444' },
  { name: 'Transport', icon: '🚗', color: '#3B82F6' },
  { name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { name: 'Bills', icon: '📋', color: '#F59E0B' },
  { name: 'Healthcare', icon: '🏥', color: '#06B6D4' },
  { name: 'Entertainment', icon: '🎬', color: '#84CC16' },
  { name: 'Education', icon: '📚', color: '#8B5CF6' },
  { name: 'Travel', icon: '✈️', color: '#F97316' },
  { name: 'Other', icon: '💳', color: '#6B7280' },
];

const PAYMENT_METHODS: { name: PaymentMethod; icon: string; color: string }[] = [
  { name: 'Cash', icon: '💵', color: '#10B981' },
  { name: 'Debit Card', icon: '💳', color: '#3B82F6' },
  { name: 'Credit Card', icon: '💎', color: '#8B5CF6' },
  { name: 'UPI', icon: '📱', color: '#F59E0B' },
  { name: 'Bank Transfer', icon: '🏦', color: '#06B6D4' },
];

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  visible,
  onClose,
  onSubmit,
  editTransaction
}) => {
  const { theme } = useTheme();
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  
  // Form state
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('Cash');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Animate modal appearance
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Initialize form with edit data
  useEffect(() => {
    if (editTransaction) {
      setTransactionType(editTransaction.type);
      setAmount(editTransaction.amount.toString());
      setDescription(editTransaction.description);
      setSelectedCategory(editTransaction.category);
      setSelectedPaymentMethod(editTransaction.paymentMethod || 'Cash');
      setDate(new Date(editTransaction.date));
      setNotes(editTransaction.notes || '');
    }
  }, [editTransaction]);

  const resetForm = () => {
    setTransactionType('expense');
    setAmount('');
    setDescription('');
    setSelectedCategory('');
    setSelectedPaymentMethod('Cash');
    setDate(new Date());
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }
    
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return false;
    }
    
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const transactionData = {
        type: transactionType,
        amount: parseFloat(amount),
        description: description.trim(),
        category: selectedCategory,
        paymentMethod: selectedPaymentMethod,
        date: date.toISOString(),
        notes: notes.trim() || undefined,
      };
      
      await onSubmit(transactionData);
      handleClose();
    } catch (error) {
      console.error('Error submitting transaction:', error);
      Alert.alert('Error', 'Failed to save transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCategories = () => {
    return transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.overlayBackground, 
            { opacity: overlayOpacity }
          ]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={handleClose}
            activeOpacity={1}
          />
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={transactionType === 'income' ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
            style={styles.modalHeader}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={handleClose}
              >
                <Icon name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>
                {editTransaction ? 'Edit Transaction' : 'Add Transaction'}
              </Text>
              
              <View style={{ width: 40 }} />
            </View>
          </LinearGradient>

          <ScrollView 
            style={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Transaction Type Toggle */}
            <View style={styles.section}>
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    transactionType === 'expense' && styles.activeTypeButton,
                    { backgroundColor: transactionType === 'expense' ? '#EF4444' : '#F3F4F6' }
                  ]}
                  onPress={() => setTransactionType('expense')}
                >
                  <Text style={[
                    styles.typeButtonText,
                    { color: transactionType === 'expense' ? '#FFFFFF' : '#6B7280' }
                  ]}>
                    💸 Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    transactionType === 'income' && styles.activeTypeButton,
                    { backgroundColor: transactionType === 'income' ? '#10B981' : '#F3F4F6' }
                  ]}
                  onPress={() => setTransactionType('income')}
                >
                  <Text style={[
                    styles.typeButtonText,
                    { color: transactionType === 'income' ? '#FFFFFF' : '#6B7280' }
                  ]}>
                    💰 Income
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount Input */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Amount</Text>
              <View style={[styles.amountContainer, { borderColor: theme.colors.border }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.text }]}>$</Text>
                <TextInput
                  style={[styles.amountInput, { color: theme.colors.text }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Description Input */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Description</Text>
              <TextInput
                style={[
                  styles.descriptionInput,
                  { 
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text
                  }
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="What was this for?"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {getCategories().map((category, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.categoryItem,
                      selectedCategory === category.name && styles.selectedCategory,
                      { backgroundColor: selectedCategory === category.name ? category.color : theme.colors.surface }
                    ]}
                    onPress={() => setSelectedCategory(category.name)}
                  >
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                    <Text style={[
                      styles.categoryText,
                      { color: selectedCategory === category.name ? '#FFFFFF' : theme.colors.text }
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quick Options */}
            <View style={styles.quickOptions}>
              {/* Payment Method */}
              <TouchableOpacity
                style={[styles.quickOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  const currentIndex = PAYMENT_METHODS.findIndex(p => p.name === selectedPaymentMethod);
                  const nextIndex = (currentIndex + 1) % PAYMENT_METHODS.length;
                  setSelectedPaymentMethod(PAYMENT_METHODS[nextIndex].name);
                }}
              >
                <Text style={styles.quickOptionIcon}>
                  {PAYMENT_METHODS.find(p => p.name === selectedPaymentMethod)?.icon || '💳'}
                </Text>
                <Text style={[styles.quickOptionText, { color: theme.colors.text }]}>
                  {selectedPaymentMethod}
                </Text>
              </TouchableOpacity>

              {/* Date */}
              <TouchableOpacity
                style={[styles.quickOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.quickOptionIcon}>📅</Text>
                <Text style={[styles.quickOptionText, { color: theme.colors.text }]}>
                  {date.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              {/* Notes */}
              <TouchableOpacity
                style={[styles.quickOption, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  Alert.prompt(
                    'Add Notes',
                    'Any additional notes for this transaction?',
                    (text) => setNotes(text || ''),
                    'plain-text',
                    notes
                  );
                }}
              >
                <Text style={styles.quickOptionIcon}>📝</Text>
                <Text style={[styles.quickOptionText, { color: theme.colors.text }]}>
                  {notes ? 'Notes added' : 'Add notes'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: (!amount || !description || !selectedCategory || loading) 
                    ? theme.colors.disabled 
                    : (transactionType === 'income' ? '#10B981' : '#EF4444')
                }
              ]}
              onPress={handleSubmit}
              disabled={!amount || !description || !selectedCategory || loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Saving...' : (editTransaction ? 'Update Transaction' : 'Add Transaction')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date Picker */}
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDate(selectedDate);
                }
              }}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  modalContainer: {
    height: screenHeight * 0.9,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  modalHeader: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827',
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTypeButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
  },
  descriptionInput: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  categoryItem: {
    width: '30%',
    margin: '1.5%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCategory: {
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickOptionIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  quickOptionText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AddTransactionModal;
