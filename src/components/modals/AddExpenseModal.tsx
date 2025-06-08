// src/components/modals/AddExpenseModal.tsx
import React, { useState, useEffect } from 'react';
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
import { Friend, Group } from '@/services/firebase/splitting';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { getCurrencySymbol } from '@/utils/currency';
import ReceiptScannerModal from './ReceiptScannerModal';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (expenseData: any) => void;
  groups: Group[];
  friends: Friend[];
  preSelectedGroup?: Group | null; // Add this prop

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

export default function AddExpenseModal({ visible, onClose, onSubmit, groups, friends,preSelectedGroup }: AddExpenseModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState<'details' | 'split' | 'review'>('details');
  const [loading, setLoading] = useState(false);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  // Form data
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
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);

  // Errors
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (visible) {
      resetForm();
      if (user) {
        setPaidBy(user.id);
      }
      // Set pre-selected group if provided
      if (preSelectedGroup) {
        setSelectedGroup(preSelectedGroup);
      }
    }
  }, [visible, user, preSelectedGroup]);

  useEffect(() => {
    if (selectedGroup) {
      // Initialize split data when group is selected
      initializeSplitData();
    }
  }, [selectedGroup, amount]);

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
  };

  const initializeSplitData = () => {
    if (!selectedGroup || !amount) return;
    
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return;

    const members = selectedGroup.members.filter(member => member.isActive);
    const equalShare = numericAmount / members.length;

    const initialSplitData = members.map(member => ({
      userId: member.userId,
      userData: member.userData,
      amount: splitType === 'equal' ? equalShare : 0,
      percentage: splitType === 'percentage' ? (100 / members.length) : 0,
      isIncluded: true,
    }));

    setSplitData(initialSplitData);
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
      
      // Strict validation - no difference allowed
      if (Math.abs(splitTotal - totalAmount) > 0.001) {
        newErrors.split = `Split amounts must equal exactly ${getCurrencySymbol(user?.currency || 'USD')}${totalAmount.toFixed(2)}. Current total: ${getCurrencySymbol(user?.currency || 'USD')}${splitTotal.toFixed(2)}`;
      }
      
      if (splitData.filter(split => split.isIncluded).length === 0) {
        newErrors.split = 'At least one person must be included in the split';
      }
      
      // Additional validation for percentage splits
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
    if (!validateStep('split')) return;

    setLoading(true);
    try {
      const expenseData = {
        description: description.trim(),
        amount: parseFloat(amount),
        currency: user?.currency || 'AUD',
        category: selectedCategory.id,
        categoryIcon: selectedCategory.icon,
        groupId: selectedGroup?.id,
        paidBy,
        splitType,
        splitData: splitData.filter(split => split.isIncluded).map(split => ({
          userId: split.userId,
          amount: split.amount,
          percentage: split.percentage,
          isPaid: false,
        })),
        notes: notes.trim(),
        tags: [],
        expenseDate,
      };

      await onSubmit(expenseData);
      resetForm();
    } catch (error) {
      // Error handled in parent component
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
    setSplitData(prev => prev.map(split => 
      split.userId === userId 
        ? { ...split, isIncluded: !split.isIncluded }
        : split
    ));
  };

  const recalculateEqual = () => {
    const totalAmount = parseFloat(amount);
    const includedMembers = splitData.filter(split => split.isIncluded);
    if (includedMembers.length === 0) return;

    const equalShare = totalAmount / includedMembers.length;
    
    setSplitData(prev => prev.map(split => 
      split.isIncluded 
        ? { ...split, amount: equalShare, percentage: (equalShare / totalAmount) * 100 }
        : split
    ));
  };

  const handleReceiptData = (receiptData: any) => {
    // Auto-populate form with receipt data
    if (receiptData.merchant) {
      setDescription(receiptData.merchant);
    }
    if (receiptData.total) {
      setAmount(receiptData.total.toString());
    }
    if (receiptData.date) {
      setExpenseDate(new Date(receiptData.date));
    }
    // Set appropriate category based on merchant or items
    if (receiptData.merchant) {
      // Simple logic to categorize based on merchant name
      const merchantLower = receiptData.merchant.toLowerCase();
      if (merchantLower.includes('restaurant') || merchantLower.includes('cafe') || merchantLower.includes('food')) {
        setSelectedCategory(EXPENSE_CATEGORIES.find(cat => cat.id === 'food') || EXPENSE_CATEGORIES[0]);
      } else if (merchantLower.includes('gas') || merchantLower.includes('fuel') || merchantLower.includes('uber') || merchantLower.includes('taxi')) {
        setSelectedCategory(EXPENSE_CATEGORIES.find(cat => cat.id === 'transport') || EXPENSE_CATEGORIES[0]);
      } else if (merchantLower.includes('store') || merchantLower.includes('market') || merchantLower.includes('shop')) {
        setSelectedCategory(EXPENSE_CATEGORIES.find(cat => cat.id === 'shopping') || EXPENSE_CATEGORIES[0]);
      }
    }
    setShowReceiptScanner(false);
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

  const handleSwipe = (event: any) => {
  if (isSwipeActive) return; // Prevent multiple rapid swipes
  
  const { translationX, state } = event.nativeEvent;
  
  if (state === State.END) {
    const swipeThreshold = 120; // Increased threshold
    const velocity = Math.abs(event.nativeEvent.velocityX);
    
    if (Math.abs(translationX) > swipeThreshold && velocity > 500) {
      setIsSwipeActive(true);
      
      if (translationX > 0 && activeStep !== 'details') {
        // Swipe right - go back
        handleBack();
      } else if (translationX < 0 && activeStep !== 'review') {
        // Swipe left - go forward
        handleNext();
      }
      
      // Reset swipe active after delay
      setTimeout(() => setIsSwipeActive(false), 500);
    }
  }
};

  const renderDetailsStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      {/* Receipt Scanner */}
      <TouchableOpacity
        style={[styles.receiptScannerButton, { 
          borderColor: theme.colors.primary, 
          backgroundColor: theme.colors.primary + '10' 
        }]}
        onPress={() => setShowReceiptScanner(true)}
      >
        <Ionicons name="camera" size={24} color={theme.colors.primary} />
        <View style={styles.receiptScannerTextContainer}>
          <Text style={[styles.receiptScannerTitle, { color: theme.colors.primary }]}>
            Scan Receipt
          </Text>
          <Text style={[styles.receiptScannerSubtitle, { color: theme.colors.textSecondary }]}>
            Auto-fill expense details from receipt
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
      </TouchableOpacity>

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

      {/* Group Selection */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Group *</Text>
        {groups.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              No groups available
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              Create a group first to add expenses
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
                  <Text style={[styles.groupMembers, { color: theme.colors.textSecondary }]}>
                    {group.members.length} members
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
                  {split.userData.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              
              <View>
                <Text style={[styles.splitMemberName, { color: theme.colors.text }]}>
                  {split.userId === user?.id ? 'You' : split.userData.fullName}
                </Text>
                <Text style={[styles.splitMemberEmail, { color: theme.colors.textSecondary }]}>
                  {split.userData.email}
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
                      value={split.percentage.toFixed(1)}
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
              {paidBy === user?.id ? 'You' : selectedGroup?.members.find(m => m.userId === paidBy)?.userData.fullName}
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
                    {split.userData.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.reviewSplitName, { color: theme.colors.text }]}>
                  {split.userId === user?.id ? 'You' : split.userData.fullName}
                </Text>
              </View>
              <View style={styles.reviewSplitRight}>
                <Text style={[styles.reviewSplitAmount, { color: theme.colors.text }]}>
                {getCurrencySymbol(user?.currency || 'USD')}{split.amount.toFixed(2)}
              </Text>
                {splitType === 'percentage' && (
                  <Text style={[styles.reviewSplitPercentage, { color: theme.colors.textSecondary }]}>
                    ({split.percentage.toFixed(1)}%)
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Receipt Scanner Button */}
        <TouchableOpacity
          style={[styles.receiptButton, { borderColor: theme.colors.border }]}
          onPress={() => {
            Alert.alert(
              'Receipt Scanner',
              'This feature allows you to scan receipts and automatically extract expense details.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Scanner', onPress: () => console.log('Open receipt scanner') }
              ]
            );
          }}
        >
          <Ionicons name="camera" size={24} color={theme.colors.primary} />
          <Text style={[styles.receiptButtonText, { color: theme.colors.primary }]}>
            Attach Receipt (Optional)
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add Expense</Text>
          <View style={{ width: 24 }} />
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
                title="Add Expense"
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
      </SafeAreaView>

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        visible={showReceiptScanner}
        onClose={() => setShowReceiptScanner(false)}
        onReceiptProcessed={handleReceiptData}
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
  receiptScannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  receiptScannerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  receiptScannerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  receiptScannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
    marginBottom: 2,
  },
  groupMembers: {
    fontSize: 12,
    textAlign: 'center',
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
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
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
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: 16,
  },
  receiptButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
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
});