import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Icon } from '../common/Icon';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { PersonalIncomeCategory, PersonalExpenseCategory, PaymentMethod } from '@/types/moneyManagement';

const { width: screenWidth } = Dimensions.get('window');

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
  { name: 'Salary', icon: '💰', color: '#22C55E' },
  { name: 'Freelance', icon: '💼', color: '#3B82F6' },
  { name: 'Business', icon: '🏢', color: '#8B5CF6' },
  { name: 'Investment', icon: '📈', color: '#06B6D4' },
  { name: 'Dividend', icon: '💎', color: '#F59E0B' },
  { name: 'Rental', icon: '🏠', color: '#EF4444' },
  { name: 'Bonus', icon: '🎉', color: '#10B981' },
  { name: 'Gift', icon: '🎁', color: '#EC4899' },
  { name: 'Cashback', icon: '💳', color: '#6366F1' },
  { name: 'Refund', icon: '↩️', color: '#84CC16' },
  { name: 'Side Hustle', icon: '🚀', color: '#F97316' },
  { name: 'Other', icon: '💵', color: '#6B7280' },
];

const EXPENSE_CATEGORIES: CategoryItem[] = [
  // Housing
  { name: 'Rent', icon: '🏠', color: '#EF4444' },
  { name: 'Mortgage', icon: '🏡', color: '#DC2626' },
  { name: 'Home Maintenance', icon: '🔧', color: '#B91C1C' },
  { name: 'Property Tax', icon: '🏛️', color: '#991B1B' },
  
  // Transportation
  { name: 'Car Payment', icon: '🚗', color: '#3B82F6' },
  { name: 'Car Insurance', icon: '🛡️', color: '#2563EB' },
  { name: 'Fuel', icon: '⛽', color: '#1D4ED8' },
  { name: 'Car Maintenance', icon: '🔧', color: '#1E40AF' },
  { name: 'Public Transport', icon: '🚌', color: '#1E3A8A' },
  { name: 'Uber/Taxi', icon: '🚖', color: '#312E81' },
  { name: 'Parking', icon: '🅿️', color: '#1E1B4B' },
  
  // Food & Dining
  { name: 'Groceries', icon: '🛒', color: '#10B981' },
  { name: 'Restaurant', icon: '🍽️', color: '#059669' },
  { name: 'Coffee', icon: '☕', color: '#047857' },
  { name: 'Online Food Delivery', icon: '🛵', color: '#065F46' },
  
  // Bills & Utilities
  { name: 'Electricity', icon: '⚡', color: '#F59E0B' },
  { name: 'Water', icon: '💧', color: '#D97706' },
  { name: 'Gas', icon: '🔥', color: '#B45309' },
  { name: 'Internet', icon: '📶', color: '#92400E' },
  { name: 'Mobile Bill', icon: '📱', color: '#78350F' },
  
  // Subscriptions
  { name: 'Netflix', icon: '📺', color: '#8B5CF6' },
  { name: 'Spotify', icon: '🎵', color: '#7C3AED' },
  { name: 'Amazon Prime', icon: '📦', color: '#6D28D9' },
  { name: 'App Store', icon: '📲', color: '#5B21B6' },
  { name: 'Gym Membership', icon: '💪', color: '#4C1D95' },
  { name: 'Other Subscriptions', icon: '📋', color: '#3730A3' },
  
  // Loans & EMIs
  { name: 'Home Loan EMI', icon: '🏦', color: '#DC2626' },
  { name: 'Car Loan EMI', icon: '🚙', color: '#B91C1C' },
  { name: 'Personal Loan EMI', icon: '💳', color: '#991B1B' },
  { name: 'Credit Card Bill', icon: '💎', color: '#7F1D1D' },
  
  // Shopping
  { name: 'Clothing', icon: '👕', color: '#EC4899' },
  { name: 'Electronics', icon: '📱', color: '#DB2777' },
  { name: 'Online Shopping', icon: '🛍️', color: '#BE185D' },
  
  // Health & Fitness
  { name: 'Medical', icon: '🏥', color: '#06B6D4' },
  { name: 'Pharmacy', icon: '💊', color: '#0891B2' },
  { name: 'Gym', icon: '🏋️', color: '#0E7490' },
  { name: 'Sports', icon: '⚽', color: '#155E75' },
  
  // Entertainment
  { name: 'Movies', icon: '🎬', color: '#84CC16' },
  { name: 'Games', icon: '🎮', color: '#65A30D' },
  { name: 'Events', icon: '🎪', color: '#4D7C0F' },
  
  // Travel
  { name: 'Flights', icon: '✈️', color: '#F97316' },
  { name: 'Hotels', icon: '🏨', color: '#EA580C' },
  { name: 'Vacation', icon: '🏖️', color: '#C2410C' },
  
  // Other
  { name: 'Other', icon: '💳', color: '#6B7280' },
];

const PAYMENT_METHODS: { name: PaymentMethod; icon: string; color: string }[] = [
  { name: 'Cash', icon: '💵', color: '#10B981' },
  { name: 'Debit Card', icon: '💳', color: '#3B82F6' },
  { name: 'Credit Card', icon: '💎', color: '#8B5CF6' },
  { name: 'Bank Transfer', icon: '🏦', color: '#06B6D4' },
  { name: 'UPI', icon: '📱', color: '#F59E0B' },
  { name: 'Digital Wallet', icon: '📲', color: '#EF4444' },
  { name: 'Check', icon: '📝', color: '#6B7280' },
  { name: 'Other', icon: '💼', color: '#84CC16' },
];

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  visible,
  onClose,
  onSubmit,
  editTransaction
}) => {
  const { theme } = useTheme();
  
  // Form state
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('Cash');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  
  // UI state
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

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
          <>
            {renderTypeSelector()}
            {renderAmountInput()}
          </>
        );
      case 2:
        return (
          <>
            {renderDescriptionInput()}
            {renderCategorySelector()}
          </>
        );
      case 3:
        return (
          <>
            {renderPaymentMethodSelector()}
            {renderDateSelector()}
          </>
        );
      case 4:
        return renderOptionalDetails();
      default:
        return null;
    }
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return amount && parseFloat(amount) > 0;
      case 2:
        return description.trim() && selectedCategory;
      case 3:
        return selectedPaymentMethod;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={handleClose}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              {editTransaction ? 'Edit Transaction' : 'Add Transaction'}
            </Text>
            
            <View style={{ width: 24 }} />
          </View>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4].map((step) => (
              <View
                key={step}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: step <= currentStep 
                      ? theme.colors.primary 
                      : theme.colors.border
                  }
                ]}
              />
            ))}
          </View>

          {/* Content */}
          <View style={styles.content}>
            {renderStepContent()}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
                onPress={() => setCurrentStep(currentStep - 1)}
              >
                <Icon name="back" size={20} color={theme.colors.text} />
                <Text style={[styles.backButtonText, { color: theme.colors.text }]}>
                  Back
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.nextButton,
                {
                  backgroundColor: canProceedToNextStep() 
                    ? theme.colors.primary 
                    : theme.colors.disabled,
                  flex: currentStep === 1 ? 1 : 0.7
                }
              ]}
              onPress={() => {
                if (currentStep === 4) {
                  handleSubmit();
                } else {
                  setCurrentStep(currentStep + 1);
                }
              }}
              disabled={!canProceedToNextStep() || loading}
            >
              <Text style={styles.nextButtonText}>
                {loading ? 'Saving...' : currentStep === 4 ? 'Save Transaction' : 'Next'}
              </Text>
              {currentStep < 4 && !loading && (
                <Icon name="forward" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
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