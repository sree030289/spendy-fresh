// Complete src/components/modals/AddExpenseModal.tsx with validation and fixed custom split
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Keyboard,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { Icon } from '../common/Icon';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import FullscreenModal from '@/components/common/FullscreenModal';
import { Friend, Group } from '@/services/firebase/splitting-disabled';
import DatePickerCalendarModal from './DatePickerCalendarModal';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { getCurrencySymbol } from '@/utils/currency';
import * as ImagePicker from 'expo-image-picker';
import { useRobustReceiptScanner } from '@/services/useRobustReceiptScanner';
import { SubscriptionHelper } from '@/utils/SubscriptionHelper';

// Helper function to get active member count
const getActiveMemberCount = (members: any[]): number => {
  if (!members || !Array.isArray(members)) return 0;
  return members.filter(member => member.isActive !== false).length;
};

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (expenseData: any) => void;
  groups?: Group[];
  friends?: Friend[];
  preSelectedGroup?: Group | null;
}

const EXPENSE_CATEGORIES = [
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

export default function AddExpenseModal({ 
  visible, 
  onClose, 
  onSubmit, 
  groups = [], 
  friends = [], 
  preSelectedGroup 
}: AddExpenseModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState<'details' | 'split' | 'review'>('details');
  const [loading, setLoading] = useState(false);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  
  // Ref for scrolling to Notes section
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Safety checks for props
  const safeGroups = Array.isArray(groups) ? groups : [];
  const safeFriends = Array.isArray(friends) ? friends : [];
  
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

  // Local input states to prevent clearing while typing
  const [localSplitInputs, setLocalSplitInputs] = useState<{[key: string]: string}>({});

  // Track which fields have been manually edited (for smart auto-adjustment)
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  // Receipt scanning
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptScanComplete, setReceiptScanComplete] = useState(false);
  
  // Use robust receipt scanner
  const { scanReceipt, isProcessing: isProcessingReceipt } = useRobustReceiptScanner();

  // Errors
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (visible) {
      resetForm();
      if (preSelectedGroup) {
        setSelectedGroup(preSelectedGroup);
      }
    }
  }, [visible, preSelectedGroup]);

  useEffect(() => {
    if (selectedGroup) {
      initializeSplitData();
    }
  }, [selectedGroup, amount]);

  // Debug logging for paidBy changes
  useEffect(() => {
    console.log('🔍 PAID BY CHANGED:', paidBy);
  }, [paidBy]);

  const resetForm = () => {
    console.log('🔍 RESET FORM called, setting paidBy to:', user?.id || '');
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
    setEditedFields(new Set()); // Clear edited fields tracking
    
    // Reset local input states
    setLocalSplitInputs({});
    
    // Reset receipt scanning
    setReceiptImage(null);
    setReceiptScanComplete(false);
  };

const initializeSplitData = () => {
  if (!selectedGroup || !amount) return;
  
  // Safety check for members array
  if (!Array.isArray(selectedGroup.members)) {
    console.log('⚠️  selectedGroup.members is not an array:', selectedGroup.members);
    return;
  }
  
  console.log('🔍 DEBUGGING SPLIT DATA');
  console.log('selectedGroup.members:', selectedGroup.members.length);
  console.log('selectedGroup.members details:', selectedGroup.members.map(m => ({
    userId: m.userId,
    name: m.userData?.fullName || 'Unknown',
    isActive: m.isActive
  })));
  
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) return;

  const members = selectedGroup.members.filter(member => member.isActive);
  console.log('🔍 Active members after filter:', members.length);
  console.log('🔍 Active members details:', members.map(m => ({
    userId: m.userId,
    name: m.userData?.fullName || 'Unknown',
    isActive: m.isActive
  })));

  const equalShare = numericAmount / members.length;

  const initialSplitData = members.map(member => ({
    userId: member.userId,
    userData: member.userData || { fullName: 'Unknown' },
    amount: splitType === 'equal' ? equalShare : 0,
    percentage: splitType === 'percentage' ? (100 / members.length) : 0,
    isIncluded: true,
  }));

  console.log('🔍 Final split data:', initialSplitData.map(s => ({
    userId: s.userId,
    name: s.userData?.fullName || 'Unknown',
    amount: s.amount,
    isIncluded: s.isIncluded
  })));

  setSplitData(initialSplitData);
};

  const validateStep = (step: string): boolean => {
    const newErrors: any = {};
    const errorMessages: string[] = [];

    if (step === 'details') {
      if (!description.trim()) {
        newErrors.description = 'Description is required';
        errorMessages.push('• Description is required');
      }
      if (!amount.trim()) {
        newErrors.amount = 'Amount is required';
        errorMessages.push('• Amount is required');
      } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        newErrors.amount = 'Please enter a valid amount';
        errorMessages.push('• Please enter a valid amount');
      }
      if (!selectedGroup) {
        newErrors.group = 'Please select a group';
        errorMessages.push('• Please select a group');
      }
    }

    if (step === 'split') {
      const totalAmount = parseFloat(amount);
      const splitTotal = splitData.reduce((sum, split) => sum + (split.isIncluded ? split.amount : 0), 0);
      
      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        newErrors.split = `Split amounts must equal exactly ${getCurrencySymbol(user?.currency || 'USD')}${totalAmount.toFixed(2)}. Current total: ${getCurrencySymbol(user?.currency || 'USD')}${splitTotal.toFixed(2)}`;
        errorMessages.push(`• Split amounts must equal ${getCurrencySymbol(user?.currency || 'USD')}${totalAmount.toFixed(2)}`);
      }
      
      if (splitData.filter(split => split.isIncluded).length === 0) {
        newErrors.split = 'At least one person must be included in the split';
        errorMessages.push('• At least one person must be included in the split');
      }
      
      if (splitType === 'percentage') {
        const totalPercentage = splitData.reduce((sum, split) => sum + (split.isIncluded ? split.percentage : 0), 0);
        if (Math.abs(totalPercentage - 100) > 0.1) {
          newErrors.split = `Percentages must total exactly 100%. Current total: ${totalPercentage.toFixed(1)}%`;
          errorMessages.push(`• Percentages must total exactly 100% (currently ${totalPercentage.toFixed(1)}%)`);
        }
      }
    }

    setErrors(newErrors);
    
    // Show alert if there are validation errors
    if (errorMessages.length > 0) {
      const stepName = step === 'details' ? 'Expense Details' : 'Split Configuration';
      Alert.alert(
        `${stepName} Error`,
        `Please fix the following issues:\n\n${errorMessages.join('\n')}`,
        [{ text: 'OK', style: 'default' }]
      );
    }
    
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

    // 🚨 CRITICAL FIX: Check subscription limits BEFORE submitting expense
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to add expenses');
      return;
    }

    console.log('🔍 SUBMITTING EXPENSE - Checking subscription limits first...');
    const subscriptionHelper = SubscriptionHelper.getInstance();
    
    setLoading(true);

    // FIXED: Check if we should bypass limit check (user already saw subscription modal)
    const shouldBypass = (global as any).bypassTransactionLimitOnce;

    if (!shouldBypass) {
      try {
        // Check if user can create this transaction (this will show subscription modal if needed)
        // FIXED: Use canCreateTransaction instead of checkTransactionLimit to avoid double-counting
        // The transaction count should ONLY be incremented on the backend when expense is actually created
        const canCreate = await subscriptionHelper.canCreateTransaction(user.id);

        if (!canCreate) {
          console.log('🚫 Subscription limit reached - expense submission blocked');
          setLoading(false);
          return; // Don't continue with submission
        }

        console.log('✅ Subscription check passed, proceeding with expense submission...');
      } catch (error) {
        console.error('❌ Error checking subscription limits:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to check subscription limits. Please try again.');
        return;
      }
    } else {
      console.log('🎯 BYPASSING transaction limit check during submission (user already saw modal)');
      // Clear the bypass flag after using it
      (global as any).bypassTransactionLimitOnce = false;
    }

    console.log('🔍 SUBMITTING EXPENSE');
    console.log('🔍 Paid by:', paidBy);
    console.log('🔍 Split data being submitted:', splitData.filter(split => split.isIncluded).map(split => ({
      userId: split.userId,
      name: split.userData?.fullName || 'Unknown',
      amount: split.amount,
      isIncluded: split.isIncluded
    })));
    try {
      const expenseData = {
        description: description.trim(),
        amount: parseFloat(amount),
        currency: user?.currency || 'AUD',
        category: selectedCategory.id,
        categoryIcon: selectedCategory.icon,
        groupId: selectedGroup?.id,
        paidBy,
        paidByData: {
          fullName: selectedGroup?.members.find(m => m.userId === paidBy)?.userData.fullName || user?.fullName || 'Unknown',
          email: selectedGroup?.members.find(m => m.userId === paidBy)?.userData.email || user?.email || '',
          avatar: selectedGroup?.members.find(m => m.userId === paidBy)?.userData.avatar || ''
        },
        splitType,
        splits: splitData.filter(split => split.isIncluded).map(split => ({
          userId: split.userId,
          amount: split.amount,
          percentage: split.percentage,
          isPaid: false,
        })),
        notes: notes.trim(),
        tags: [],
        expenseDate,
        // Receipt data
        receipt: receiptImage ? {
          imageUri: receiptImage,
          isScanned: receiptScanComplete,
          scannedAt: receiptScanComplete ? new Date().toISOString() : null,
        } : null,
      };
      
      console.log('📤 AddExpenseModal - Submitting expense with receipt data:', {
        hasReceipt: !!expenseData.receipt,
        receiptImageUri: expenseData.receipt?.imageUri,
        receiptScanComplete: receiptScanComplete
      });

      await onSubmit(expenseData);
      resetForm();
    } catch (error) {
      // Error handled in parent component
    } finally {
      setLoading(false);
    }
  };

  // Dynamic split calculation for percentage
  const updateSplitPercentage = (userId: string, percentage: number) => {
    const totalAmount = parseFloat(amount);
    const newAmount = (totalAmount * percentage) / 100;
    
    setSplitData(prev => {
      const updated = prev.map(split => 
        split.userId === userId 
          ? { ...split, percentage, amount: newAmount }
          : split
      );
      
      // Auto-adjust remaining percentages
      const otherIncludedSplits = updated.filter(s => s.userId !== userId && s.isIncluded);
      
      if (otherIncludedSplits.length > 0) {
        const remainingPercentage = 100 - percentage;
        const percentagePerOther = remainingPercentage / otherIncludedSplits.length;
        
        return updated.map(split => {
          if (split.userId !== userId && split.isIncluded) {
            const otherAmount = (totalAmount * percentagePerOther) / 100;
            return { 
              ...split, 
              percentage: percentagePerOther,
              amount: otherAmount
            };
          }
          return split;
        });
      }
      
      return updated;
    });
  };

  // FIXED: Custom split - only update the specific amount, don't auto-adjust others
  const updateSplitAmount = (userId: string, newAmount: number) => {
    setSplitData(prev => {
      return prev.map(split => 
        split.userId === userId 
          ? { 
              ...split, 
              amount: newAmount,
              percentage: parseFloat(amount) > 0 ? (newAmount / parseFloat(amount)) * 100 : 0
            }
          : split
      );
    });
  };

  // Handle text input for custom amounts with smart auto-adjustment
  const handleCustomAmountInput = (userId: string, text: string) => {
    // Update local input state immediately for smooth typing
    setLocalSplitInputs(prev => ({
      ...prev,
      [userId]: text
    }));

    // Mark this field as edited
    setEditedFields(prev => new Set(prev).add(userId));

    const totalAmount = parseFloat(amount);
    const newAmount = parseFloat(text) || 0;

    if (totalAmount <= 0) {
      updateSplitAmount(userId, newAmount);
      return;
    }

    // Update the edited field
    setSplitData(prev => {
      const updated = prev.map(split =>
        split.userId === userId
          ? {
              ...split,
              amount: newAmount,
              percentage: totalAmount > 0 ? (newAmount / totalAmount) * 100 : 0
            }
          : split
      );

      // Calculate how much has been allocated to edited fields (including this one)
      const editedTotal = updated.reduce((sum, split) => {
        if (editedFields.has(split.userId) || split.userId === userId) {
          return sum + (split.isIncluded ? split.amount : 0);
        }
        return sum;
      }, 0);

      // Get non-edited included members
      const nonEditedIncludedMembers = updated.filter(
        split => split.isIncluded && !editedFields.has(split.userId) && split.userId !== userId
      );

      // Calculate remaining amount to distribute
      const remainingAmount = totalAmount - editedTotal;

      // Distribute remaining amount equally among non-edited fields
      if (nonEditedIncludedMembers.length > 0 && remainingAmount >= 0) {
        const amountPerNonEdited = remainingAmount / nonEditedIncludedMembers.length;

        return updated.map(split => {
          if (split.isIncluded && !editedFields.has(split.userId) && split.userId !== userId) {
            return {
              ...split,
              amount: amountPerNonEdited,
              percentage: totalAmount > 0 ? (amountPerNonEdited / totalAmount) * 100 : 0
            };
          }
          return split;
        });
      }

      return updated;
    });
  };

  // Handle text input for percentage amounts
  const handlePercentageInput = (userId: string, text: string) => {
    // Update local input state immediately for smooth typing
    setLocalSplitInputs(prev => ({
      ...prev,
      [`${userId}_percentage`]: text
    }));
    
    // Update split data with parsed number
    const newPercentage = parseFloat(text) || 0;
    updateSplitPercentage(userId, newPercentage);
  };

  const toggleSplitInclusion = (userId: string) => {
    setSplitData(prev => {
      const updated = prev.map(split => 
        split.userId === userId 
          ? { ...split, isIncluded: !split.isIncluded }
          : split
      );
      
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
        } else if (splitType === 'custom') {
          // For custom split, just reset excluded members to 0, keep included members' existing amounts
          return updated.map(split => 
            split.isIncluded 
              ? split // Keep existing amount for included members
              : { ...split, amount: 0, percentage: 0 } // Reset excluded members
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

  // Receipt scanning functions
  const handleReceiptScan = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to use receipt scanning');
      return;
    }

    // Check if user has access to premium receipt scanning BEFORE camera permissions
    const subscriptionHelper = SubscriptionHelper.getInstance();
    const hasAccess = await subscriptionHelper.checkReceiptScanningAccess(user.id);

    if (!hasAccess) {
      // Close AddExpenseModal first to show subscription modal properly
      Alert.alert(
        'Premium Feature',
        'Receipt scanning is a premium feature. Upgrade to use this feature.',
        [
          {
            text: 'Maybe Later',
            style: 'cancel'
          },
          {
            text: 'Upgrade Now',
            onPress: () => {
              // Close the expense modal first
              onClose();
              // Then show subscription modal (with small delay to ensure clean transition)
              setTimeout(() => {
                subscriptionHelper.showPremiumFeatureAlert('Receipt Scanning');
              }, 300);
            }
          }
        ]
      );
      return;
    }

    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to scan receipts');
      return;
    }

    // Show image picker options
    Alert.alert(
      'Scan Receipt',
      'Choose how to capture your receipt',
      [
        { text: 'Camera', onPress: () => openCamera() },
        { text: 'Gallery', onPress: () => openGallery() },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const openCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setReceiptImage(result.assets[0].uri);
        await processReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const openGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false, // Disable EXIF data for better iOS performance
        base64: false, // Disable base64 encoding for better performance
      });

      if (!result.canceled && result.assets[0]) {
        setReceiptImage(result.assets[0].uri);
        await processReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const processReceiptImage = async (imageUri: string) => {
    try {
      // Validate imageUri parameter
      if (!imageUri || typeof imageUri !== 'string') {
        console.error('❌ Invalid imageUri provided to processReceiptImage:', imageUri);
        throw new Error('Invalid image URI provided for processing');
      }
      
      console.log('🔍 Processing receipt with robust OCR...', imageUri);
      const result = await scanReceipt(imageUri);
      
      if (result.success && result.data) {
        console.log('✅ Receipt processed successfully');
        
        // Auto-fill form fields from receipt data
        if (result.data.merchant) {
          setDescription(result.data.merchant);
        }
        if (result.data.total) {
          setAmount(result.data.total.toString());
        }
        if (result.data.category) {
          const categoryMatch = EXPENSE_CATEGORIES.find(cat => 
            cat.id === result.data.category || cat.name.toLowerCase().includes(result.data.category)
          );
          if (categoryMatch) {
            setSelectedCategory(categoryMatch);
          }
        }
        if (result.data.date) {
          setExpenseDate(new Date(result.data.date));
        }
        if (result.data.notes) {
          setNotes(result.data.notes);
        }
        
        setReceiptScanComplete(true);
        Alert.alert(
          'Receipt Processed!', 
          'Information extracted from receipt. Please review and adjust details as needed.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('⚠️ Receipt processing failed, manual entry required');
        setReceiptScanComplete(false);
        Alert.alert(
          'Receipt Processing',
          'Could not extract all data from the receipt. Please review and enter any missing details manually.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Receipt processing error:', error);
      setReceiptScanComplete(false);
      Alert.alert(
        'Receipt Processing Failed',
        'Could not process the receipt. You can still attach the image and enter details manually.',
        [{ text: 'OK' }]
      );
    }
  };

  const parseReceiptData = async (ocrResult: OCRResult) => {
    const text = ocrResult.text;
    
    // Extract amount using regex patterns
    const amountPatterns = [
      /\$[\d,]+\.?\d{0,2}/g,
      /total[:\s]*\$?[\d,]+\.?\d{0,2}/i,
      /amount[:\s]*\$?[\d,]+\.?\d{0,2}/i,
      /[\d,]+\.?\d{2}/g
    ];

    let extractedAmount = '';
    for (const pattern of amountPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        // Get the last/largest amount as it's likely the total
        const amounts = matches
          .map(match => parseFloat(match.replace(/[^\d.]/g, '')))
          .filter(amt => !isNaN(amt) && amt > 0)
          .sort((a, b) => b - a);
        
        if (amounts.length > 0) {
          extractedAmount = amounts[0].toString();
          break;
        }
      }
    }

    // Extract date
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
      /\d{1,2}-\d{1,2}-\d{2,4}/g,
      /\d{4}-\d{1,2}-\d{1,2}/g
    ];

    let extractedDate = new Date();
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const dateStr = matches[0];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          extractedDate = parsedDate;
          break;
        }
      }
    }

    // Extract category based on keywords
    const categoryKeywords = {
      'food': ['restaurant', 'food', 'cafe', 'coffee', 'pizza', 'burger', 'dinner', 'lunch', 'breakfast', 'dining'],
      'transport': ['uber', 'taxi', 'gas', 'fuel', 'parking', 'transport', 'bus', 'train'],
      'shopping': ['store', 'shop', 'retail', 'mart', 'mall', 'purchase'],
      'entertainment': ['movie', 'cinema', 'theater', 'game', 'entertainment', 'ticket'],
      'utilities': ['electric', 'water', 'gas', 'utility', 'bill', 'phone', 'internet'],
      'healthcare': ['pharmacy', 'hospital', 'medical', 'health', 'doctor', 'clinic'],
      'travel': ['hotel', 'flight', 'airline', 'booking', 'travel'],
      'other': []
    };

    let detectedCategory = EXPENSE_CATEGORIES.find(cat => cat.id === 'other')!;
    const lowerText = text.toLowerCase();
    
    for (const [categoryId, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        const category = EXPENSE_CATEGORIES.find(cat => cat.id === categoryId);
        if (category) {
          detectedCategory = category;
          break;
        }
      }
    }

    // Extract description from merchant name or first line
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    let extractedDescription = '';
    
    if (lines.length > 0) {
      // Try to find merchant name (usually first non-address line)
      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.length > 3 && 
            !cleanLine.match(/^\d/) && 
            !cleanLine.includes('$') &&
            !cleanLine.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
          extractedDescription = cleanLine.slice(0, 50); // Limit length
          break;
        }
      }
    }

    // Update form fields with extracted data
    if (extractedAmount) {
      setAmount(extractedAmount);
    }
    
    if (extractedDescription) {
      setDescription(extractedDescription);
    }
    
    setSelectedCategory(detectedCategory);
    setExpenseDate(extractedDate);
  };

  const removeReceiptImage = () => {
    setReceiptImage(null);
    setReceiptScanComplete(false);
  };

  // Simple image attachment without OCR processing (for step 3)
  const handleSimpleImageAttachment = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to attach images');
      return;
    }

    try {
      Alert.alert(
        'Add Receipt Image',
        'Choose how to add your receipt image',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Camera', onPress: () => openCameraForAttachment() },
          { text: 'Gallery', onPress: () => openGalleryForAttachment() }
        ]
      );
    } catch (error) {
      console.error('Error in simple image attachment:', error);
      Alert.alert('Error', 'Failed to attach image');
    }
  };

  const openCameraForAttachment = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && result.assets[0].uri) {
        setReceiptImage(result.assets[0].uri);
        // No OCR processing, just attach the image
        console.log('📎 Image attached without OCR processing:', result.assets[0].uri);
      } else {
        console.log('📎 Image selection cancelled or invalid');
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const openGalleryForAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false, // Disable EXIF data for better iOS performance
        base64: false, // Disable base64 encoding for better performance
      });

      if (!result.canceled && result.assets[0] && result.assets[0].uri) {
        setReceiptImage(result.assets[0].uri);
        // No OCR processing, just attach the image
        console.log('📎 Image attached without OCR processing:', result.assets[0].uri);
      } else {
        console.log('📎 Image selection cancelled or invalid');
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
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

  const renderDetailsStep = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 20}
    >
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[styles.stepContent, { paddingBottom: 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={false}
        contentInsetAdjustmentBehavior="automatic"
      >
      {/* Receipt Scanning Section */}
      <View style={styles.inputContainer}>
        <View style={styles.scanReceiptHeader}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Receipt Scanning</Text>
          <View style={styles.premiumBadge}>
            <Icon name="star" size={12} color="#FFD700" />
            <Text style={[styles.premiumText, { color: '#FFD700' }]}>Premium</Text>
          </View>
        </View>
        
        {!receiptImage ? (
          <TouchableOpacity
            style={[
              styles.scanReceiptButton,
              { 
                backgroundColor: theme.colors.primary + '10',
                borderColor: theme.colors.primary,
              }
            ]}
            onPress={handleReceiptScan}
            disabled={isProcessingReceipt}
          >
            <Icon 
              name="camera" 
              size={24} 
              color={theme.colors.primary} 
            />
            <Text style={[styles.scanReceiptText, { color: theme.colors.primary }]}>
              {isProcessingReceipt ? 'Processing...' : 'Scan Receipt'}
            </Text>
            <Text style={[styles.scanReceiptSubtext, { color: theme.colors.textSecondary }]}>
              Auto-fill details from your receipt
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.scannedReceiptContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.scannedReceiptHeader}>
              <Icon name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={[styles.scannedReceiptText, { color: theme.colors.success }]}>
                Receipt Scanned Successfully
              </Text>
              <TouchableOpacity onPress={removeReceiptImage}>
                <Icon name="close" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
            {receiptScanComplete && (
              <Text style={[styles.receiptStatusText, { color: theme.colors.textSecondary }]}>
                ✨ Information extracted and filled below
              </Text>
            )}
          </View>
        )}
      </View>

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
          onFocus={() => {
            // Scroll to make description field visible
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }, 100);
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
            onFocus={() => {
              // Scroll to make amount field visible above keypad
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 200, animated: true });
              }, 100);
            }}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={() => {
              // Dismiss keyboard after amount entry
              Keyboard.dismiss();
            }}
            blurOnSubmit={true}
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
                onPress={() => {
                  setSelectedCategory(category);
                  // Auto-open date picker after category selection
                  setTimeout(() => setShowDatePicker(true), 300);
                }}
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
            <Icon name="calendar" size={20} color={theme.colors.textSecondary}  />
          </TouchableOpacity>
        </TouchableOpacity>
        <DatePickerCalendarModal
          visible={showDatePicker}
          selectedDate={expenseDate}
          maximumDate={new Date()}
          onDateSelect={(selectedDate) => {
            setExpenseDate(selectedDate);
            // Scroll to Groups section after date selection
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({ y: 350, animated: true });
            }, 400);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      </View>

      {/* Group Selection */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Group *</Text>
        {safeGroups.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Icon name="people" size={48} color={theme.colors.textSecondary}  />
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
              {safeGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupItem,
                    selectedGroup?.id === group.id && [
                      styles.selectedGroup,
                      { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                    ]
                  ]}
                  onPress={() => {
                    setSelectedGroup(group);
                    // Scroll to Paid By section after group selection
                    setTimeout(() => {
                      scrollViewRef.current?.scrollTo({ y: 600, animated: true });
                    }, 300);
                  }}
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
                    {getActiveMemberCount(group.members)} members
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
      {selectedGroup && Array.isArray(selectedGroup.members) && (
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
                  onPress={() => {
                    console.log('🔍 PAYER SELECTED:', member.userId, member.userData?.fullName || 'Unknown');
                    setPaidBy(member.userId);
                    // Scroll to Notes field after selecting who paid
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.memberAvatarText}>
                      {(member.userData?.fullName || 'U').charAt(0).toUpperCase()}
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
                    {member.userId === user?.id ? 'You' : (member.userData?.fullName || 'Unknown')}
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
          onFocus={() => {
            // Scroll to bottom when Notes field is focused
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
          multiline
          numberOfLines={3}
          maxLength={500}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          blurOnSubmit={true}
        />
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderSplitStep = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 200 : 0}
      enabled
    >
      <ScrollView
        contentContainerStyle={styles.stepContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={true}
      >
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
              setLocalSplitInputs({}); // Clear local inputs
              setEditedFields(new Set()); // Clear edited fields tracking
              recalculateEqual();
            }}
          >
            <Icon name="people"
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
            onPress={() => {
              setSplitType('custom');
              setLocalSplitInputs({}); // Clear local inputs
              setEditedFields(new Set()); // Clear edited fields tracking
            }}
          >
            <Icon name="calculator"
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
            onPress={() => {
              setSplitType('percentage');
              setLocalSplitInputs({}); // Clear local inputs
              setEditedFields(new Set()); // Clear edited fields tracking
            }}
          >
            <Icon
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
                    <Icon name="checkmark" size={16} color="white"  />
                  )}
                </View>
              </TouchableOpacity>
              
              <View style={[styles.memberAvatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.memberAvatarText}>
                  {(split.userData?.fullName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              
              <View>
                <Text style={[styles.splitMemberName, { color: theme.colors.text }]}>
                  {split.userId === user?.id ? 'You' : (split.userData?.fullName || 'Unknown')}
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
                    style={[styles.splitAmountInput, { 
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background
                    }]}
                    value={localSplitInputs[split.userId] !== undefined ? localSplitInputs[split.userId] : split.amount.toFixed(2)}
                    onChangeText={(text) => handleCustomAmountInput(split.userId, text)}
                    onFocus={() => {
                      // Initialize local input when focused
                      if (localSplitInputs[split.userId] === undefined) {
                        setLocalSplitInputs(prev => ({
                          ...prev,
                          [split.userId]: split.amount.toFixed(2)
                        }));
                      }
                    }}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    blurOnSubmit={true}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                )}
                {splitType === 'percentage' && (
                  <View style={styles.percentageContainer}>
                    <TextInput
                      style={[styles.splitPercentageInput, { color: theme.colors.text }]}
                      value={localSplitInputs[`${split.userId}_percentage`] !== undefined ? localSplitInputs[`${split.userId}_percentage`] : split.percentage.toFixed(1)}
                      onChangeText={(text) => handlePercentageInput(split.userId, text)}
                      onFocus={() => {
                        // Initialize local input when focused
                        if (localSplitInputs[`${split.userId}_percentage`] === undefined) {
                          setLocalSplitInputs(prev => ({
                            ...prev,
                            [`${split.userId}_percentage`]: split.percentage.toFixed(1)
                          }));
                        }
                      }}
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      blurOnSubmit={true}
                      placeholder="0.0"
                      placeholderTextColor={theme.colors.textSecondary}
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
              {splitType === 'custom' ? 'Remaining' : 'Difference'}
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
          
          {/* Custom split helper text */}
          {splitType === 'custom' && (
            <View style={styles.customSplitHelper}>
              <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                💡 Tip: Edit any amount - the remaining balance will auto-adjust across other members
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
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

          {/* Receipt Section */}
          <View style={styles.reviewItem}>
            <Text style={[styles.reviewLabel, { color: theme.colors.textSecondary }]}>Receipt</Text>
            {receiptImage ? (
              <View style={styles.reviewReceiptContainer}>
                <View style={styles.reviewReceiptPreview}>
                  <Image source={{ uri: receiptImage }} style={styles.reviewReceiptImage} />
                  <View style={styles.reviewReceiptOverlay}>
                    <Icon name="document" size={16} color="white" />
                  </View>
                </View>
                <Text style={[styles.reviewReceiptText, { color: theme.colors.text }]}>
                  Receipt attached {receiptScanComplete && '(Auto-scanned)'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.reviewUploadButton, { borderColor: theme.colors.border }]}
                onPress={handleSimpleImageAttachment}
              >
                <Icon name="camera" size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.reviewUploadText, { color: theme.colors.textSecondary }]}>
                  Add receipt image
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
                    {(split.userData?.fullName || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.reviewSplitName, { color: theme.colors.text }]}>
                  {split.userId === user?.id ? 'You' : (split.userData?.fullName || 'Unknown')}
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
      </View>
    </ScrollView>
  );

  return (
    <FullscreenModal
      visible={visible}
      onClose={onClose}
      title="Add Expense"
    >
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

    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  splitHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recalculateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customSplitActions: {
    flexDirection: 'row',
    gap: 8,
  },
  customActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  customActionText: {
    fontSize: 12,
    fontWeight: '600',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
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
  customSplitHelper: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
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
  // Receipt scanning styles
  scanReceiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '600',
  },
  scanReceiptButton: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  scanReceiptText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scanReceiptSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  scannedReceiptContainer: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scannedReceiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scannedReceiptText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  receiptPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 8,
  },
  receiptStatusText: {
    fontSize: 12,
    textAlign: 'center',
  },
  reviewReceiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewReceiptPreview: {
    position: 'relative',
  },
  reviewReceiptImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  reviewReceiptOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewReceiptText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  reviewUploadText: {
    fontSize: 12,
  },
});