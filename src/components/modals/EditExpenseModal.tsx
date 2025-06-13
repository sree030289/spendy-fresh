// src/components/modals/EditExpenseModal.tsx - FIXED VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { Friend, Group, Expense, SplittingService } from '@/services/firebase/splitting';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { getCurrencySymbol } from '@/utils/currency';
import ExpenseDeletionModal from './ExpenseDeletionModal';

interface EditExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (expenseData: any) => void;
  expense: Expense | null;
  onExpenseDeleted?: () => void;
  isUserAdmin?: boolean;
  groups?: Group[];
}

const EXPENSE_CATEGORIES = [
  { id: 'settlement', name: 'Settlement', icon: '💸', isSpecial: true },
  { id: 'food', name: 'Food & Dining', icon: '🍽️' },
  { id: 'transport', name: 'Transportation', icon: '🚗' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'shopping', name: 'Shopping', icon: '🛒' },
  { id: 'utilities', name: 'Utilities', icon: '⚡' },
  { id: 'housing', name: 'Housing', icon: '🏠' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'other', name: 'Other', icon: '💰' },
];

export default function EditExpenseModal({ 
  visible, 
  onClose, 
  onSubmit, 
  expense,
  onExpenseDeleted,
  isUserAdmin = false,
  groups = []
}: EditExpenseModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [activeStep, setActiveStep] = useState<'details' | 'split' | 'review'>('details');
  const [loading, setLoading] = useState(false);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // Use ref to track if we've initialized the form to prevent step resetting
  const isInitialized = useRef(false);
  const currentExpenseId = useRef<string | null>(null);
  
  // Form data - exactly like AddExpenseModal
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType, setSplitType] = useState<'equal' | 'custom' | 'percentage'>('equal');
  const [splitData, setSplitData] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Errors
  const [errors, setErrors] = useState<any>({});

  // Initialize form with expense data - FIXED: Only when expense changes or modal opens
  useEffect(() => {
    if (expense && visible && (!isInitialized.current || currentExpenseId.current !== expense.id)) {
      console.log('Initializing edit form with expense:', expense);
      
      // Find the group from groups prop
      const group = groups.find(g => g.id === expense.groupId);
      setSelectedGroup(group || null);
      console.log('Found group for expense:', group?.name || 'Not found');
      
      // Set basic fields
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setNotes(expense.notes || '');
      setPaidBy(expense.paidBy);
      setSplitType(expense.splitType);
      setExpenseDate(expense.date);
      
      // Set category
      const category = EXPENSE_CATEGORIES.find(cat => cat.id === expense.category);
      if (category) {
        setSelectedCategory(category);
      } else {
        setSelectedCategory(EXPENSE_CATEGORIES[0]);
      }
      
      // Initialize split data with group members
      if (group) {
        const activeMembers = group.members.filter(member => member.isActive);
        console.log('Active members found:', activeMembers.length);
        
        // Create enhanced split data with proper member info
        const enhancedSplitData = expense.splitData.map(split => {
          const member = activeMembers.find(m => m.userId === split.userId);
          console.log(`Processing split for ${split.userId}:`, member?.userData.fullName || 'Unknown');
          
          return {
            userId: split.userId,
            userData: member?.userData || {
              fullName: split.userId === user?.id ? 'You' : 'Unknown User',
              email: '',
              avatar: ''
            },
            amount: split.amount,
            percentage: split.percentage || ((split.amount / expense.amount) * 100),
            isIncluded: true,
            isPaid: split.isPaid || false,
            paidAt: split.paidAt
          };
        });
        
        // Add any missing group members who weren't in the original split
        activeMembers.forEach(member => {
          if (!enhancedSplitData.find(split => split.userId === member.userId)) {
            enhancedSplitData.push({
              userId: member.userId,
              userData: member.userData,
              amount: 0,
              percentage: 0,
              isIncluded: false,
              isPaid: false
            });
          }
        });
        
        setSplitData(enhancedSplitData);
        console.log('Enhanced split data set:', enhancedSplitData.length, 'entries');
      }
      
      // Reset step and errors only on initial load
      setActiveStep('details');
      setErrors({});
      setShowSuccessMessage(false);
      
      // Mark as initialized and track current expense
      isInitialized.current = true;
      currentExpenseId.current = expense.id;
    }
  }, [expense?.id, visible]); // FIXED: Only depend on expense ID and visibility

  // Reset initialization when modal closes
  useEffect(() => {
    if (!visible) {
      isInitialized.current = false;
      currentExpenseId.current = null;
      setShowSuccessMessage(false);
    }
  }, [visible]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setSelectedCategory(EXPENSE_CATEGORIES[0]);
    setSelectedGroup(null);
    setPaidBy(user?.id || '');
    setSplitType('equal');
    setSplitData([]);
    setNotes('');
    setExpenseDate(new Date());
    setErrors({});
    setActiveStep('details');
    setShowSuccessMessage(false);
    isInitialized.current = false;
    currentExpenseId.current = null;
  };

  const initializeSplitData = () => {
    if (!selectedGroup || !amount) return;
    
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return;

    const activeMembers = selectedGroup.members.filter(member => member.isActive);
    const equalShare = numericAmount / activeMembers.length;

    // If we already have split data, update amounts. Otherwise create new.
    if (splitData.length > 0) {
      const updatedSplitData = splitData.map(split => {
        if (split.isIncluded) {
          return {
            ...split,
            amount: splitType === 'equal' ? equalShare : split.amount,
            percentage: splitType === 'percentage' ? (100 / activeMembers.length) : ((split.amount / numericAmount) * 100)
          };
        }
        return split;
      });
      setSplitData(updatedSplitData);
    } else {
      const initialSplitData = activeMembers.map(member => ({
        userId: member.userId,
        userData: member.userData,
        amount: splitType === 'equal' ? equalShare : 0,
        percentage: splitType === 'percentage' ? (100 / activeMembers.length) : 0,
        isIncluded: true,
        isPaid: false
      }));
      setSplitData(initialSplitData);
    }
  };

  const validateStep = (step: string): boolean => {
    const newErrors: any = {};

    if (step === 'details') {
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
    }

    if (step === 'split') {
      const totalAmount = parseFloat(amount);
      const splitTotal = splitData.reduce((sum, split) => sum + (split.isIncluded ? split.amount : 0), 0);
      
      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        newErrors.split = `Split amounts must equal exactly ${getCurrencySymbol(user?.currency || 'USD')}${totalAmount.toFixed(2)}. Current total: ${getCurrencySymbol(user?.currency || 'USD')}${splitTotal.toFixed(2)}`;
      }
      
      if (splitData.filter(split => split.isIncluded).length === 0) {
        newErrors.split = 'At least one person must be included in the split';
      }
      
      if (splitType === 'percentage') {
        const totalPercentage = splitData.reduce((sum, split) => sum + (split.isIncluded ? split.percentage : 0), 0);
        if (Math.abs(totalPercentage - 100) > 0.1) {
          newErrors.split = `Percentages must total exactly 100%. Current total: ${totalPercentage.toFixed(1)}%`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 'details' && validateStep('details')) {
      initializeSplitData();
      setActiveStep('split');
    } else if (activeStep === 'split' && validateStep('split')) {
      setActiveStep('review');
    }
  };

  const handleBack = () => {
    if (activeStep === 'split') {
      setActiveStep('details');
    } else if (activeStep === 'review') {
      setActiveStep('split');
    }
  };

  const handleSubmit = async () => {
    if (!validateStep('split') || !expense || !user?.id) return;

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
        paidBy,
        splitType,
        splitData: splitData.filter(split => split.isIncluded).map(split => ({
          userId: split.userId,
          amount: split.amount,
          percentage: split.percentage,
          isPaid: split.isPaid || false,
          ...(split.paidAt ? { paidAt: split.paidAt } : {})
        })),
        notes: notes.trim(),
        tags: expense.tags || [],
        expenseDate,
      };

      console.log('Submitting updated expense:', expenseData);
      await onSubmit(expenseData);
      
      // FIXED: Show success message instead of immediately closing
      setShowSuccessMessage(true);
      
      // Close modal after showing success message
      setTimeout(() => {
        resetForm();
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Update expense error:', error);
      Alert.alert('Error', error.message || 'Failed to update expense. Please try again.');
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

  const updateSplitPercentage = (userId: string, percentage: number) => {
    const totalAmount = parseFloat(amount);
    const newAmount = (totalAmount * percentage) / 100;
    
    setSplitData(prev => prev.map(split => 
      split.userId === userId 
        ? { ...split, percentage, amount: newAmount }
        : split
    ));
  };

  const toggleSplitInclusion = (userId: string) => {
    setSplitData(prev => {
      const updated = prev.map(split => 
        split.userId === userId 
          ? { ...split, isIncluded: !split.isIncluded }
          : split
      );
      
      // Auto-recalculate after toggle
      const totalAmount = parseFloat(amount);
      const includedMembers = updated.filter(split => split.isIncluded);
      
      if (includedMembers.length > 0 && totalAmount > 0) {
        if (splitType === 'equal') {
          const equalShare = totalAmount / includedMembers.length;
          return updated.map(split => 
            split.isIncluded 
              ? { ...split, amount: equalShare, percentage: (equalShare / totalAmount) * 100 }
              : { ...split, amount: 0, percentage: 0 }
          );
        } else if (splitType === 'percentage') {
          const equalPercentage = 100 / includedMembers.length;
          const equalAmount = totalAmount / includedMembers.length;
          return updated.map(split => 
            split.isIncluded 
              ? { ...split, percentage: equalPercentage, amount: equalAmount }
              : { ...split, percentage: 0, amount: 0 }
          );
        }
      }
      
      return updated;
    });
  };

  const recalculateEqual = () => {
    const totalAmount = parseFloat(amount);
    const includedMembers = splitData.filter(split => split.isIncluded);
    if (includedMembers.length === 0 || totalAmount <= 0) return;

    const equalShare = totalAmount / includedMembers.length;
    
    setSplitData(prev => prev.map(split => 
      split.isIncluded 
        ? { ...split, amount: equalShare, percentage: (equalShare / totalAmount) * 100 }
        : { ...split, amount: 0, percentage: 0 }
    ));
  };

  const handleSwipe = (event: any) => {
    if (isSwipeActive) return;
    
    const { translationX, state } = event.nativeEvent;
    
    if (state === State.END) {
      const swipeThreshold = 120;
      const velocity = Math.abs(event.nativeEvent.velocityX);
      
      if (Math.abs(translationX) > swipeThreshold && velocity > 500) {
        setIsSwipeActive(true);
        
        if (translationX > 0 && activeStep !== 'details') {
          handleBack();
        } else if (translationX < 0 && activeStep !== 'review') {
          handleNext();
        }
        
        setTimeout(() => setIsSwipeActive(false), 500);
      }
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['details', 'split', 'review'].map((step, index) => (
        <View key={step} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            {
              backgroundColor: 
                activeStep === step 
                  ? theme.colors.primary 
                  : index < ['details', 'split', 'review'].indexOf(activeStep)
                    ? theme.colors.success
                    : theme.colors.border
            }
          ]}>
            <Text style={[
              styles.stepNumber,
              {
                color: 
                  activeStep === step || index < ['details', 'split', 'review'].indexOf(activeStep)
                    ? 'white'
                    : theme.colors.textSecondary
              }
            ]}>
              {index + 1}
            </Text>
          </View>
          <Text style={[
            styles.stepLabel,
            { color: activeStep === step ? theme.colors.primary : theme.colors.textSecondary }
          ]}>
            {step.charAt(0).toUpperCase() + step.slice(1)}
          </Text>
        </View>
      ))}
    </View>
  );

  // FIXED: Success message component
  const renderSuccessMessage = () => (
    <View style={[styles.successContainer, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.successCard, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.successIcon, { backgroundColor: theme.colors.success + '20' }]}>
          <Ionicons name="checkmark-circle" size={60} color={theme.colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: theme.colors.text }]}>
          Expense Updated!
        </Text>
        <Text style={[styles.successMessage, { color: theme.colors.textSecondary }]}>
          Your expense has been successfully updated and all members have been notified.
        </Text>
      </View>
    </View>
  );

  const renderDetailsStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      {/* Description */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>What was this expense for? *</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: errors.description ? theme.colors.error : theme.colors.border,
              color: theme.colors.text,
            }
          ]}
          placeholder="e.g. Dinner at restaurant"
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
            {getCurrencySymbol(user?.currency || 'USD')}
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

      {/* Date */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Date</Text>
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
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={[styles.dateText, { color: theme.colors.text }]}>
            {expenseDate.toLocaleDateString()}
          </Text>
          <TouchableOpacity onPress={() => setShowDatePicker(!showDatePicker)}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
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

      {/* Group Display (Read-only since we're editing) */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Group</Text>
        <View style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.groupDisplay}>
            <Text style={styles.groupIcon}>{selectedGroup?.avatar}</Text>
            <View>
              <Text style={[styles.groupName, { color: theme.colors.text }]}>
                {selectedGroup?.name || 'Unknown Group'}
              </Text>
              <Text style={[styles.groupMembers, { color: theme.colors.textSecondary }]}>
                {selectedGroup?.members.length || 0} members
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Paid By */}
      {selectedGroup && (
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Paid by</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.memberList}>
              {selectedGroup.members.filter(member => member.isActive).map((member) => (
                <TouchableOpacity
                  key={member.userId}
                  style={[
                    styles.memberItem,
                    paidBy === member.userId && [
                      styles.selectedMember,
                      { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                    ]
                  ]}
                  onPress={() => setPaidBy(member.userId)}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.memberAvatarText}>
                      {member.userData.fullName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[
                    styles.memberName,
                    {
                      color: paidBy === member.userId 
                        ? theme.colors.primary 
                        : theme.colors.text
                    }
                  ]}>
                    {member.userId === user?.id ? 'You' : member.userData.fullName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Notes */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Notes (Optional)</Text>
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
          placeholder="Add any additional notes..."
          placeholderTextColor={theme.colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          maxLength={500}
        />
      </View>
    </ScrollView>
  );

  const renderSplitStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      {/* Split Type */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>How to split?</Text>
        <View style={styles.splitTypeContainer}>
          <TouchableOpacity
            style={[
              styles.splitTypeOption,
              splitType === 'equal' && [styles.selectedSplitType, { backgroundColor: theme.colors.primary + '20' }]
            ]}
            onPress={() => {
              setSplitType('equal');
              recalculateEqual();
            }}
          >
            <Ionicons
              name="people"
              size={24}
              color={splitType === 'equal' ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[
              styles.splitTypeText,
              { color: splitType === 'equal' ? theme.colors.primary : theme.colors.textSecondary }
            ]}>
              Split Equally
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.splitTypeOption,
              splitType === 'custom' && [styles.selectedSplitType, { backgroundColor: theme.colors.primary + '20' }]
            ]}
            onPress={() => setSplitType('custom')}
          >
            <Ionicons
              name="calculator"
              size={24}
              color={splitType === 'custom' ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[
              styles.splitTypeText,
              { color: splitType === 'custom' ? theme.colors.primary : theme.colors.textSecondary }
            ]}>
              Custom Amounts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.splitTypeOption,
              splitType === 'percentage' && [styles.selectedSplitType, { backgroundColor: theme.colors.primary + '20' }]
            ]}
            onPress={() => setSplitType('percentage')}
          >
            <Ionicons
              name="pie-chart"
              size={24}
              color={splitType === 'percentage' ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[
              styles.splitTypeText,
              { color: splitType === 'percentage' ? theme.colors.primary : theme.colors.textSecondary }
            ]}>
              By Percentage
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Split Details */}
      <View style={styles.inputContainer}>
        <View style={styles.splitHeader}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
            Split Details ({splitData.filter(s => s.isIncluded).length} people)
          </Text>
          {splitType === 'equal' && (
            <TouchableOpacity onPress={recalculateEqual}>
              <Text style={[styles.recalculateText, { color: theme.colors.primary }]}>
                Recalculate
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {splitData.map((split) => (
          <View key={split.userId} style={[styles.splitItem, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.splitItemLeft}>
              <TouchableOpacity
                style={styles.splitCheckbox}
                onPress={() => toggleSplitInclusion(split.userId)}
              >
                <View style={[
                  styles.checkbox,
                  split.isIncluded && [styles.checkedBox, { backgroundColor: theme.colors.primary }]
                ]}>
                  {split.isIncluded && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
              
              </TouchableOpacity>
              
              <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.memberAvatarText}>
                  {split.userData?.fullName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              
              <View>
                <Text style={[styles.splitMemberName, { color: theme.colors.text }]}>
                  {split.userId === user?.id ? 'You' : (split.userData?.fullName || 'Unknown User')}
                </Text>
                <Text style={[styles.splitMemberEmail, { color: theme.colors.textSecondary }]}>
                  {split.userData?.email || ''}
                </Text>
              </View>
            </View>

            {split.isIncluded && (
              <View style={styles.splitItemRight}>
                {splitType === 'custom' && (
                  <TextInput
                    style={[styles.splitAmountInput, { color: theme.colors.text }]}
                    value={split.amount.toFixed(2)}
                    onChangeText={(text) => {
                      const newAmount = parseFloat(text) || 0;
                      updateSplitAmount(split.userId, newAmount);
                    }}
                    keyboardType="decimal-pad"
                  />
                )}
                {splitType === 'percentage' && (
                  <View style={styles.percentageContainer}>
                    <TextInput
                      style={[styles.splitPercentageInput, { color: theme.colors.text }]}
                      value={(split.percentage || 0).toFixed(1)}
                      onChangeText={(text) => {
                        const newPercentage = parseFloat(text) || 0;
                        updateSplitPercentage(split.userId, newPercentage);
                      }}
                      keyboardType="decimal-pad"
                    />
                    <Text style={[styles.percentageSymbol, { color: theme.colors.textSecondary }]}>%</Text>
                  </View>
                )}
                {splitType === 'equal' && (
                  <Text style={[styles.splitAmount, { color: theme.colors.text }]}>
                    {getCurrencySymbol(user?.currency || 'USD')}{split.amount.toFixed(2)}
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}

        {errors.split && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errors.split}
          </Text>
        )}

        {/* Split Summary */}
        <View style={[styles.splitSummary, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Total Amount
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {getCurrencySymbol(user?.currency || 'USD')}{parseFloat(amount).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Split Total
            </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {getCurrencySymbol(user?.currency || 'USD')}{splitData.reduce((sum, split) => sum + (split.isIncluded ? split.amount : 0), 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Difference
            </Text>
            <Text style={[
              styles.summaryValue,
              {
                color: Math.abs(splitData.reduce((sum, split) => sum + (split.isIncluded ? split.amount : 0), 0) - parseFloat(amount)) < 0.01
                  ? theme.colors.success
                  : theme.colors.error
              }
            ]}>
              {getCurrencySymbol(user?.currency || 'USD')}{Math.abs(splitData.reduce((sum, split) => sum + (split.isIncluded ? split.amount : 0), 0) - parseFloat(amount)).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderReviewStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <View style={[styles.reviewCard, { backgroundColor: theme.colors.surface }]}>
        {/* Expense Details */}
        <View style={styles.reviewSection}>
          <Text style={[styles.reviewSectionTitle, { color: theme.colors.text }]}>Expense Details</Text>
          
          <View style={styles.reviewItem}>
            <Text style={[styles.reviewLabel, { color: theme.colors.textSecondary }]}>Description</Text>
            <Text style={[styles.reviewValue, { color: theme.colors.text }]}>{description}</Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={[styles.reviewLabel, { color: theme.colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.reviewValue, { color: theme.colors.text }]}>
              {getCurrencySymbol(user?.currency || 'USD')}{parseFloat(amount).toFixed(2)} {user?.currency}
            </Text>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={[styles.reviewLabel, { color: theme.colors.textSecondary }]}>Category</Text>
            <View style={styles.reviewCategoryValue}>
              <Text style={styles.reviewCategoryIcon}>{selectedCategory.icon}</Text>
              <Text style={[styles.reviewValue, { color: theme.colors.text }]}>{selectedCategory.name}</Text>
            </View>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={[styles.reviewLabel, { color: theme.colors.textSecondary }]}>Group</Text>
            <View style={styles.reviewCategoryValue}>
              <Text style={styles.reviewCategoryIcon}>{selectedGroup?.avatar}</Text>
              <Text style={[styles.reviewValue, { color: theme.colors.text }]}>{selectedGroup?.name}</Text>
            </View>
          </View>
          
          <View style={styles.reviewItem}>
            <Text style={[styles.reviewLabel, { color: theme.colors.textSecondary }]}>Paid by</Text>
            <Text style={[styles.reviewValue, { color: theme.colors.text }]}>
              {paidBy === user?.id ? 'You' : selectedGroup?.members.find(m => m.userId === paidBy)?.userData.fullName || 'Unknown'}
            </Text>
          </View>
          
          {notes.trim() && (
            <View style={styles.reviewItem}>
              <Text style={[styles.reviewLabel, { color: theme.colors.textSecondary }]}>Notes</Text>
              <Text style={[styles.reviewValue, { color: theme.colors.text }]}>{notes}</Text>
            </View>
          )}
        </View>

        {/* Split Details */}
        <View style={styles.reviewSection}>
          <Text style={[styles.reviewSectionTitle, { color: theme.colors.text }]}>
            Split Details ({splitType})
          </Text>
          
          {splitData.filter(split => split.isIncluded).map((split) => (
            <View key={split.userId} style={styles.reviewSplitItem}>
              <View style={styles.reviewSplitLeft}>
                <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.memberAvatarText}>
                    {split.userData?.fullName?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <Text style={[styles.reviewSplitName, { color: theme.colors.text }]}>
                  {split.userId === user?.id ? 'You' : (split.userData?.fullName || 'Unknown User')}
                </Text>
              </View>
              <View style={styles.reviewSplitRight}>
                <Text style={[styles.reviewSplitAmount, { color: theme.colors.text }]}>
                  {getCurrencySymbol(user?.currency || 'USD')}{split.amount.toFixed(2)}
                </Text>
                {splitType === 'percentage' && (
                  <Text style={[styles.reviewSplitPercentage, { color: theme.colors.textSecondary }]}>
                    ({(split.percentage || 0).toFixed(1)}%)
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  if (!expense) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Show success message overlay when expense is updated */}
        {showSuccessMessage && renderSuccessMessage()}
        
        {/* Normal modal content */}
        {!showSuccessMessage && (
          <>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <TouchableOpacity onPress={onClose} disabled={loading}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                Edit Expense
              </Text>
              <TouchableOpacity 
                onPress={() => setShowDeleteModal(true)}
                style={styles.deleteButton}
              >
                <Ionicons name="trash" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            </View>

            {/* Step Indicator */}
            {renderStepIndicator()}

            {/* Step Content */}
            <PanGestureHandler onGestureEvent={handleSwipe}>
              <View style={styles.content}>
                {activeStep === 'details' && renderDetailsStep()}
                {activeStep === 'split' && renderSplitStep()}
                {activeStep === 'review' && renderReviewStep()}
              </View>
            </PanGestureHandler>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
              <View style={styles.footerButtons}>
                {activeStep !== 'details' && (
                  <Button
                    title="Back"
                    onPress={handleBack}
                    variant="outline"
                    style={styles.footerButton}
                    disabled={loading}
                  />
                )}
                
                {activeStep === 'review' ? (
                  <Button
                    title="Update Expense"
                    onPress={handleSubmit}
                    loading={loading}
                    style={StyleSheet.flatten([styles.footerButton, activeStep === 'review' && styles.fullWidthButton])}
                  />
                ) : (
                  <Button
                    title="Next"
                    onPress={handleNext}
                    style={StyleSheet.flatten([styles.footerButton, activeStep === 'details' && styles.fullWidthButton])}
                    disabled={loading}
                  />
                )}
              </View>
            </View>
          </>
        )}
      </SafeAreaView>

      {/* Delete Modal */}
      <ExpenseDeletionModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        expense={expense}
        currentUser={user}
        onDeletionComplete={() => {
          onClose();
          onExpenseDeleted?.();
        }}
        isUserAdmin={isUserAdmin}
      />
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
  deleteButton: {
    padding: 8,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 20,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  stepContent: {
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  groupDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
  },
  groupMembers: {
    fontSize: 12,
    marginTop: 2,
  },
  memberList: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  memberItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 80,
  },
  selectedMember: {
    borderWidth: 2,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  splitTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  splitTypeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedSplitType: {
    borderWidth: 2,
  },
  splitTypeText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recalculateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  splitItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  splitCheckbox: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    borderColor: 'transparent',
  },
  splitMemberName: {
    fontSize: 14,
    fontWeight: '500',
  },
  splitMemberEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  splitItemRight: {
    alignItems: 'flex-end',
  },
  splitAmountInput: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 80,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitPercentageInput: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 60,
  },
  percentageSymbol: {
    fontSize: 16,
    marginLeft: 2,
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  splitSummary: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  reviewCard: {
    borderRadius: 12,
    padding: 20,
  },
  reviewSection: {
    marginBottom: 24,
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  reviewItem: {
    marginBottom: 12,
  },
  reviewLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  reviewCategoryValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewCategoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  reviewSplitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  reviewSplitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewSplitName: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
  reviewSplitRight: {
    alignItems: 'flex-end',
  },
  reviewSplitAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewSplitPercentage: {
    fontSize: 12,
    marginTop: 2,
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
  fullWidthButton: {
    flex: 1,
  },
  // FIXED: Success message styles
  successContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successCard: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 20,
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});    