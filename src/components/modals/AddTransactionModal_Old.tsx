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
  { name: 'Gift', icon: '�', color: '#EC4899' },
  { name: 'Other', icon: '💵', color: '#6B7280' },
];

const EXPENSE_CATEGORIES: CategoryItem[] = [
  { name: 'Food', icon: '�️', color: '#EF4444' },
  { name: 'Transport', icon: '�', color: '#3B82F6' },
  { name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { name: 'Bills', icon: '�', color: '#F59E0B' },
  { name: 'Healthcare', icon: '🏥', color: '#06B6D4' },
  { name: 'Entertainment', icon: '�', color: '#84CC16' },
  { name: 'Education', icon: '📚', color: '#8B5CF6' },
  { name: 'Travel', icon: '✈️', color: '#F97316' },
  { name: 'Other', icon: '💳', color: '#6B7280' },
];

const PAYMENT_METHODS: { name: PaymentMethod; icon: string; color: string }[] = [
  { name: 'Cash', icon: '�', color: '#10B981' },
  { name: 'Debit Card', icon: '💳', color: '#3B82F6' },
  { name: 'Credit Card', icon: '�', color: '#8B5CF6' },
  { name: 'UPI', icon: '�', color: '#F59E0B' },
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

  // Initialize form with edit data
  useEffect(() => {
    if (editTransaction) {
      setTransactionType(editTransaction.type);
      setAmount(editTransaction.amount.toString());
      setDescription(editTransaction.description);
      setSelectedCategory(editTransaction.category);
      setSubcategory(editTransaction.subcategory || '');
      setSelectedPaymentMethod(editTransaction.paymentMethod || 'Cash');
      setDate(new Date(editTransaction.date));
      setNotes(editTransaction.notes || '');
      setTags(editTransaction.tags || []);
      setIsRecurring(editTransaction.isRecurring || false);
    }
  }, [editTransaction]);

  const resetForm = () => {
    setTransactionType('expense');
    setAmount('');
    setDescription('');
    setSelectedCategory('');
    setSubcategory('');
    setSelectedPaymentMethod('Cash');
    setDate(new Date());
    setNotes('');
    setTags([]);
    setNewTag('');
    setIsRecurring(false);
    setCurrentStep(1);
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
        subcategory: subcategory.trim() || undefined,
        paymentMethod: selectedPaymentMethod,
        date: date.toISOString(),
        notes: notes.trim() || undefined,
        tags,
        isRecurring,
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

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const getCategories = () => {
    return transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  };

  const renderTypeSelector = () => (
    <View style={styles.typeSelectorContainer}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        What type of transaction?
      </Text>
      
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            transactionType === 'income' && [styles.activeTypeButton, { backgroundColor: theme.colors.success }],
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
          ]}
          onPress={() => {
            setTransactionType('income');
            setSelectedCategory('');
          }}
        >
          <Text style={styles.typeButtonIcon}>💰</Text>
          <Text style={[
            styles.typeButtonText,
            { color: transactionType === 'income' ? 'white' : theme.colors.text }
          ]}>
            Income
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.typeButton,
            transactionType === 'expense' && [styles.activeTypeButton, { backgroundColor: theme.colors.error }],
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
          ]}
          onPress={() => {
            setTransactionType('expense');
            setSelectedCategory('');
          }}
        >
          <Text style={styles.typeButtonIcon}>💳</Text>
          <Text style={[
            styles.typeButtonText,
            { color: transactionType === 'expense' ? 'white' : theme.colors.text }
          ]}>
            Expense
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAmountInput = () => (
    <View style={styles.amountContainer}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Enter amount
      </Text>
      
      <View style={[styles.amountInputContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.currencySymbol, { color: theme.colors.text }]}>$</Text>
        <TextInput
          style={[styles.amountInput, { color: theme.colors.text }]}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="numeric"
          autoFocus
        />
      </View>
    </View>
  );

  const renderDescriptionInput = () => (
    <View style={styles.descriptionContainer}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        What's this for?
      </Text>
      
      <TextInput
        style={[
          styles.descriptionInput,
          { 
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            borderColor: theme.colors.border
          }
        ]}
        value={description}
        onChangeText={setDescription}
        placeholder={transactionType === 'income' ? 'e.g., Monthly salary' : 'e.g., Weekly groceries'}
        placeholderTextColor={theme.colors.textSecondary}
        multiline
      />
    </View>
  );

  const renderCategorySelector = () => (
    <View style={styles.categoryContainer}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Choose category
      </Text>
      
      <ScrollView 
        style={styles.categoryGrid}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.categoryRow}>
          {getCategories().map((category, index) => (
            <TouchableOpacity
              key={category.name}
              style={[
                styles.categoryButton,
                selectedCategory === category.name && [
                  styles.selectedCategoryButton,
                  { backgroundColor: category.color }
                ],
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
              ]}
              onPress={() => setSelectedCategory(category.name)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={[
                styles.categoryText,
                { 
                  color: selectedCategory === category.name 
                    ? 'white' 
                    : theme.colors.text 
                }
              ]} numberOfLines={1}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderPaymentMethodSelector = () => (
    <View style={styles.paymentContainer}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Payment method
      </Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.paymentMethodScroll}
      >
        {PAYMENT_METHODS.map((method) => (
          <TouchableOpacity
            key={method.name}
            style={[
              styles.paymentMethodButton,
              selectedPaymentMethod === method.name && [
                styles.selectedPaymentMethod,
                { backgroundColor: method.color }
              ],
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
            ]}
            onPress={() => setSelectedPaymentMethod(method.name)}
          >
            <Text style={styles.paymentMethodIcon}>{method.icon}</Text>
            <Text style={[
              styles.paymentMethodText,
              { 
                color: selectedPaymentMethod === method.name 
                  ? 'white' 
                  : theme.colors.text 
              }
            ]}>
              {method.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderDateSelector = () => (
    <View style={styles.dateContainer}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        When did this happen?
      </Text>
      
      <TouchableOpacity
        style={[
          styles.dateButton,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
        ]}
        onPress={() => setShowDatePicker(true)}
      >
        <Icon name="calendar" size={24} color={theme.colors.primary} />
        <Text style={[styles.dateText, { color: theme.colors.text }]}>
          {date.toLocaleDateString('en-US', { 
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </Text>
        <Icon name="arrowDown" size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>
      
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setDate(selectedDate);
            }
          }}
        />
      )}
    </View>
  );

  const renderOptionalDetails = () => (
    <ScrollView style={styles.optionalContainer}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Additional details (optional)
      </Text>
      
      {/* Subcategory */}
      <View style={styles.optionalField}>
        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
          Subcategory
        </Text>
        <TextInput
          style={[
            styles.optionalInput,
            { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.border
            }
          ]}
          value={subcategory}
          onChangeText={setSubcategory}
          placeholder="e.g., Office lunch, Gas bill"
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>
      
      {/* Notes */}
      <View style={styles.optionalField}>
        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
          Notes
        </Text>
        <TextInput
          style={[
            styles.notesInput,
            { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.border
            }
          ]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional notes..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={3}
        />
      </View>
      
      {/* Tags */}
      <View style={styles.optionalField}>
        <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
          Tags
        </Text>
        <View style={styles.tagsContainer}>
          {tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.tagText}>{tag}</Text>
              <TouchableOpacity onPress={() => removeTag(tag)}>
                <Icon name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={styles.addTagContainer}>
          <TextInput
            style={[
              styles.tagInput,
              { 
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }
            ]}
            value={newTag}
            onChangeText={setNewTag}
            placeholder="Add a tag..."
            placeholderTextColor={theme.colors.textSecondary}
            onSubmitEditing={addTag}
          />
          <TouchableOpacity
            style={[styles.addTagButton, { backgroundColor: theme.colors.primary }]}
            onPress={addTag}
          >
            <Icon name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Recurring toggle */}
      <View style={styles.optionalField}>
        <TouchableOpacity
          style={styles.recurringToggle}
          onPress={() => setIsRecurring(!isRecurring)}
        >
          <View style={styles.recurringContent}>
            <Icon name="refresh" size={24} color={theme.colors.primary} />
            <View style={styles.recurringText}>
              <Text style={[styles.recurringTitle, { color: theme.colors.text }]}>
                Recurring Transaction
              </Text>
              <Text style={[styles.recurringSubtitle, { color: theme.colors.textSecondary }]}>
                This happens regularly
              </Text>
            </View>
          </View>
          <View style={[
            styles.recurringSwitch,
            { backgroundColor: isRecurring ? theme.colors.primary : theme.colors.border }
          ]}>
            <View style={[
              styles.recurringSwitchThumb,
              { 
                backgroundColor: 'white',
                transform: [{ translateX: isRecurring ? 20 : 2 }]
              }
            ]} />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderTypeSelector()}
            {renderAmountInput()}
            {renderDescriptionInput()}
          </ScrollView>
        );
      case 2:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderCategorySelector()}
          </ScrollView>
        );
      case 3:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderPaymentMethodSelector()}
            {renderDateSelector()}
            {renderOptionalDetails()}
          </ScrollView>
        );
      default:
        return null;
    }
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return amount && parseFloat(amount) > 0 && description.trim();
      case 2:
        return selectedCategory;
      case 3:
        return selectedPaymentMethod;
      default:
        return false;
    }
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
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <LinearGradient
            colors={transactionType === 'income' ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
            style={styles.modalGradient}
          >
            {/* Enhanced Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={handleClose}
              >
                <Icon name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              
              <View style={styles.headerContent}>
                <Text style={styles.modalTitle}>
                  {editTransaction ? 'Edit Transaction' : 'New Transaction'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Step {currentStep} of 3
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.helpButton}
                onPress={() => Alert.alert('Help', 'Fill in the transaction details step by step')}
              >
                <Icon name="help" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Enhanced Progress Indicator */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    { 
                      width: `${(currentStep / 3) * 100}%`,
                      backgroundColor: '#FFFFFF'
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {currentStep === 1 ? 'Basic Info' : currentStep === 2 ? 'Category & Payment' : 'Additional Details'}
              </Text>
            </View>
          </LinearGradient>

          {/* Enhanced Content Area */}
          <View style={styles.contentArea}>
            <ScrollView 
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContentContainer}
            >
              {renderStepContent()}
            </ScrollView>

            {/* Enhanced Footer */}
            <View style={styles.footerContainer}>
              <View style={styles.navigationButtons}>
                {currentStep > 1 && (
                  <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
                    onPress={() => setCurrentStep(currentStep - 1)}
                  >
                    <Icon name="back" size={20} color={theme.colors.text} />
                    <Text style={[styles.buttonText, { color: theme.colors.text }]}>
                      Back
                    </Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: canProceedToNextStep() 
                        ? (transactionType === 'income' ? '#10B981' : '#EF4444')
                        : theme.colors.disabled,
                      flex: currentStep === 1 ? 1 : 0.7
                    }
                  ]}
                  onPress={() => {
                    if (currentStep === 3) {
                      handleSubmit();
                    } else {
                      setCurrentStep(currentStep + 1);
                    }
                  }}
                  disabled={!canProceedToNextStep() || loading}
                >
                  <Text style={styles.primaryButtonText}>
                    {loading ? 'Saving...' : currentStep === 3 ? 'Save Transaction' : 'Continue'}
                  </Text>
                  {!loading && (
                    <Icon 
                      name={currentStep === 3 ? 'checkmark' : 'forward'} 
                      size={20} 
                      color="#FFFFFF" 
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContainer: {
    height: screenHeight * 0.9,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  modalGradient: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  footerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Existing styles for content
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  typeSelectorContainer: {
    marginBottom: 32,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 16,
  },
  typeButton: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  activeTypeButton: {
    borderColor: 'transparent',
  },
  typeButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountContainer: {
    alignItems: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: 'bold',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  descriptionContainer: {
    marginBottom: 32,
  },
  descriptionInput: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flex: 1,
  },
  categoryGrid: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 100,
  },
  categoryButton: {
    width: (screenWidth - 64) / 3,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  selectedCategoryButton: {
    borderColor: 'transparent',
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  paymentContainer: {
    marginBottom: 32,
  },
  paymentMethodScroll: {
    marginTop: 16,
  },
  paymentMethodButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  selectedPaymentMethod: {
    borderColor: 'transparent',
  },
  paymentMethodIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateContainer: {
    marginBottom: 32,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  optionalContainer: {
    flex: 1,
  },
  optionalField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  optionalInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  notesInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  addTagContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  addTagButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  recurringContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recurringText: {
    marginLeft: 12,
  },
  recurringTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  recurringSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  recurringSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  recurringSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 4,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddTransactionModal;