// src/components/smartMoney/AddExpenseModal.tsx
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface Category {
  category: string;
  icon: string;
  color: string;
}

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (expense: ExpenseData) => void;
  categories: Category[];
}

interface ExpenseData {
  amount: number;
  description: string;
  category: string;
  categoryIcon: string;
  merchant: string;
  location: string;
  isRecurring: boolean;
  tags: string[];
}

const defaultCategories: Category[] = [
  { category: 'Food & Drink', icon: '🍽️', color: '#FF6B6B' },
  { category: 'Transport', icon: '🚗', color: '#4ECDC4' },
  { category: 'Shopping', icon: '🛍️', color: '#45B7D1' },
  { category: 'Bills & Utilities', icon: '⚡', color: '#96CEB4' },
  { category: 'Health & Fitness', icon: '🏥', color: '#FFEAA7' },
  { category: 'Entertainment', icon: '🎬', color: '#DDA0DD' },
  { category: 'Groceries', icon: '🛒', color: '#98D8C8' },
  { category: 'Housing', icon: '🏠', color: '#A29BFE' },
  { category: 'Other', icon: '📊', color: '#74B9FF' },
];

export default function AddExpenseModal({ visible, onClose, onSubmit, categories }: AddExpenseModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [location, setLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

  const availableCategories = categories.length > 0 ? categories : defaultCategories;

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setAmount('');
      setDescription('');
      setMerchant('');
      setLocation('');
      setSelectedCategory(null);
      setIsRecurring(false);
      setTags([]);
      setCustomTag('');
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!amount || !description || !selectedCategory) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const expenseData: ExpenseData = {
      amount: numericAmount,
      description: description.trim(),
      category: selectedCategory.category,
      categoryIcon: selectedCategory.icon,
      merchant: merchant.trim() || 'Unknown',
      location: location.trim(),
      isRecurring,
      tags: [...tags, selectedCategory.category.toLowerCase()]
    };

    onSubmit(expenseData);
  };

  const addTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim().toLowerCase())) {
      setTags([...tags, customTag.trim().toLowerCase()]);
      setCustomTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const suggestedTags = ['work', 'personal', 'urgent', 'subscription', 'one-time'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <BlurView intensity={100} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Expense</Text>
            <TouchableOpacity onPress={handleSubmit} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Amount Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount *</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
          </View>
{/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description *</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="What did you spend on?"
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category *</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
            >
              {availableCategories.map((category) => (
                <TouchableOpacity
                  key={category.category}
                  style={[
                    styles.categoryItem,
                    selectedCategory?.category === category.category && styles.categoryItemSelected
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <View 
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: category.color + '20' },
                      selectedCategory?.category === category.category && { backgroundColor: category.color }
                    ]}
                  >
                    <Text style={styles.categoryEmoji}>{category.icon}</Text>
                  </View>
                  <Text style={[
                    styles.categoryText,
                    selectedCategory?.category === category.category && styles.categoryTextSelected
                  ]}>
                    {category.category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Merchant */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Merchant</Text>
            <TextInput
              style={styles.input}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Where did you spend?"
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Optional location"
            />
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            
            {/* Current Tags */}
            {tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tag}
                    onPress={() => removeTag(tag)}
                  >
                    <Text style={styles.tagText}>{tag}</Text>
                    <Ionicons name="close" size={14} color="#666" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Add Custom Tag */}
            <View style={styles.addTagContainer}>
              <TextInput
                style={styles.tagInput}
                value={customTag}
                onChangeText={setCustomTag}
                placeholder="Add a tag"
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addTag} style={styles.addTagButton}>
                <Ionicons name="add" size={20} color="#10B981" />
              </TouchableOpacity>
            </View>

            {/* Suggested Tags */}
            <View style={styles.suggestedTags}>
              {suggestedTags.filter(tag => !tags.includes(tag)).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.suggestedTag}
                  onPress={() => setTags([...tags, tag])}
                >
                  <Text style={styles.suggestedTagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recurring Toggle */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.toggleContainer}
              onPress={() => setIsRecurring(!isRecurring)}
            >
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Recurring Expense</Text>
                <Text style={styles.toggleSubtitle}>
                  This expense repeats regularly
                </Text>
              </View>
              <View style={[
                styles.toggle,
                isRecurring && styles.toggleActive
              ]}>
                <View style={[
                  styles.toggleKnob,
                  isRecurring && styles.toggleKnobActive
                ]} />
              </View>
            </TouchableOpacity>
          </View>


          {/* Submit Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleSubmit}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.submitButton}
              >
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.submitButtonText}>Add Expense</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Bottom Padding */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#9CA3AF',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
    padding: 16,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 50,
  },
  categoriesScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 16,
    padding: 12,
    borderRadius: 12,
    minWidth: 80,
  },
  categoryItemSelected: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  categoryTextSelected: {
    color: '#10B981',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: '#1E40AF',
    marginRight: 6,
  },
  addTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  addTagButton: {
    padding: 16,
  },
  suggestedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  suggestedTag: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  suggestedTagText: {
    fontSize: 14,
    color: '#6B7280',
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
  buttonContainer: {
    marginVertical: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  bottomPadding: {
    height: 40,
  },
});