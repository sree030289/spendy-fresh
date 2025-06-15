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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import * as Location from 'expo-location';

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
  name: string;
  description?: string;
  category: string;
  categoryIcon: string;
  merchant: string;
  location: string;
  isRecurring: boolean;
  tags: string[];
}

// Region-specific categories and merchants
const getRegionalCategories = (currencyCode: string = 'USD'): Category[] => {
  const baseCategories: Category[] = [
    // Loans & Finance
    { category: 'Home Loan', icon: '�', color: '#FF6B6B' },
    { category: 'Car Loan', icon: '🚗', color: '#4ECDC4' },
    { category: 'Personal Loan', icon: '�', color: '#45B7D1' },
    { category: 'Credit Card', icon: '💳', color: '#FF9F43' },
    
    // Bills & Utilities
    { category: 'Electricity', icon: '⚡', color: '#96CEB4' },
    { category: 'Gas', icon: '🔥', color: '#FD79A8' },
    { category: 'Internet', icon: '📶', color: '#74B9FF' },
    { category: 'Telecom', icon: '📱', color: '#00B894' },
    { category: 'Water', icon: '💧', color: '#0984E3' },
    { category: 'Insurance', icon: '🛡️', color: '#6C5CE7' },
    
    // Transport
    { category: 'Petrol', icon: '⛽', color: '#E17055' },
    { category: 'Public Transport', icon: '🚌', color: '#55A3FF' },
    { category: 'Taxi/Uber', icon: '🚕', color: '#FDCB6E' },
    { category: 'Car Maintenance', icon: '🔧', color: '#A29BFE' },
    
    // Food & Dining
    { category: 'Restaurants', icon: '�️', color: '#FF7675' },
    { category: 'Coffee', icon: '☕', color: '#795548' },
    { category: 'Fast Food', icon: '🍕', color: '#FF9F43' },
    { category: 'Bars & Pubs', icon: '🍺', color: '#00B894' },
    
    // Entertainment
    { category: 'Movies', icon: '🎬', color: '#DDA0DD' },
    { category: 'Streaming', icon: '📺', color: '#6C5CE7' },
    { category: 'Gaming', icon: '🎮', color: '#A29BFE' },
    { category: 'Sports', icon: '⚽', color: '#00B894' },
    
    // Health
    { category: 'Medical', icon: '🏥', color: '#FFEAA7' },
    { category: 'Pharmacy', icon: '💊', color: '#81ECEC' },
    { category: 'Gym', icon: '💪', color: '#74B9FF' },
    
    // Other
    { category: 'Other', icon: '📊', color: '#636E72' },
  ];

  // Add region-specific retailers
  if (currencyCode === 'AUD') {
    // Australian retailers
    baseCategories.push(
      { category: 'Coles', icon: '🛒', color: '#E74C3C' },
      { category: 'Woolworths', icon: '🛒', color: '#27AE60' },
      { category: 'Bunnings', icon: '🔨', color: '#E67E22' },
      { category: 'JB Hi-Fi', icon: '📱', color: '#3498DB' },
      { category: 'Big W', icon: '🛍️', color: '#9B59B6' },
      { category: 'Kmart', icon: '🛍️', color: '#E74C3C' },
      { category: 'Target', icon: '🛍️', color: '#E74C3C' },
      { category: 'Harvey Norman', icon: '🏠', color: '#F39C12' },
      { category: 'Officeworks', icon: '📋', color: '#34495E' },
      { category: 'Australia Post', icon: '📦', color: '#E74C3C' }
    );
  } else if (currencyCode === 'INR') {
    // Indian retailers
    baseCategories.push(
      { category: 'Amazon India', icon: '📦', color: '#FF9F00' },
      { category: 'Flipkart', icon: '🛒', color: '#2874F0' },
      { category: 'BigBasket', icon: '🛒', color: '#84C341' },
      { category: 'Swiggy', icon: '🍽️', color: '#FC8019' },
      { category: 'Zomato', icon: '�️', color: '#E23744' },
      { category: 'Paytm Mall', icon: '🛍️', color: '#00BAF2' },
      { category: 'Reliance Digital', icon: '📱', color: '#0066CC' },
      { category: 'More Supermarket', icon: '🛒', color: '#00A651' },
      { category: 'Spencer\'s', icon: '🛒', color: '#E74C3C' },
      { category: 'D-Mart', icon: '🛒', color: '#1E88E5' }
    );
  } else {
    // Global/US retailers
    baseCategories.push(
      { category: 'Amazon', icon: '�', color: '#FF9F00' },
      { category: 'eBay', icon: '🛒', color: '#0064D2' },
      { category: 'Walmart', icon: '🛒', color: '#004C91' },
      { category: 'Target', icon: '🛍️', color: '#E74C3C' },
      { category: 'Costco', icon: '🛒', color: '#E31837' },
      { category: 'Best Buy', icon: '📱', color: '#003DA6' },
      { category: 'Home Depot', icon: '🔨', color: '#F96302' },
      { category: 'Starbucks', icon: '☕', color: '#00704A' },
      { category: 'McDonald\'s', icon: '🍟', color: '#FFC72C' },
      { category: 'Uber Eats', icon: '🍽️', color: '#000000' }
    );
  }

  return baseCategories;
};

// Name-to-category mapping for auto-selection
const getNameCategoryMapping = (currencyCode: string = 'USD'): Record<string, string> => {
  const mapping: Record<string, string> = {
    // Common patterns
    'coffee': 'Coffee',
    'starbucks': 'Coffee',
    'cafe': 'Coffee',
    'pizza': 'Fast Food',
    'burger': 'Fast Food',
    'mcdonalds': 'Fast Food',
    'kfc': 'Fast Food',
    'restaurant': 'Restaurants',
    'bar': 'Bars & Pubs',
    'pub': 'Bars & Pubs',
    'petrol': 'Petrol',
    'gas': 'Petrol',
    'fuel': 'Petrol',
    'uber': 'Taxi/Uber',
    'taxi': 'Taxi/Uber',
    'electricity': 'Electricity',
    'power': 'Electricity',
    'internet': 'Internet',
    'wifi': 'Internet',
    'phone': 'Telecom',
    'mobile': 'Telecom',
    'gym': 'Gym',
    'fitness': 'Gym',
    'medical': 'Medical',
    'doctor': 'Medical',
    'pharmacy': 'Pharmacy',
    'medicine': 'Pharmacy',
    'movie': 'Movies',
    'cinema': 'Movies',
    'netflix': 'Streaming',
    'spotify': 'Streaming',
    'amazon': currencyCode === 'INR' ? 'Amazon India' : 'Amazon',
  };

  if (currencyCode === 'AUD') {
    mapping['coles'] = 'Coles';
    mapping['woolworths'] = 'Woolworths';
    mapping['bunnings'] = 'Bunnings';
    mapping['jb'] = 'JB Hi-Fi';
    mapping['bigw'] = 'Big W';
    mapping['kmart'] = 'Kmart';
    mapping['target'] = 'Target';
    mapping['harvey'] = 'Harvey Norman';
    mapping['officeworks'] = 'Officeworks';
  } else if (currencyCode === 'INR') {
    mapping['flipkart'] = 'Flipkart';
    mapping['bigbasket'] = 'BigBasket';
    mapping['swiggy'] = 'Swiggy';
    mapping['zomato'] = 'Zomato';
    mapping['paytm'] = 'Paytm Mall';
    mapping['reliance'] = 'Reliance Digital';
    mapping['more'] = 'More Supermarket';
    mapping['spencer'] = 'Spencer\'s';
    mapping['dmart'] = 'D-Mart';
  }

  return mapping;
};

// Helper function to get currency symbol
const getCurrencySymbol = (currencyCode: string): string => {
  switch (currencyCode) {
    case 'AUD':
      return 'A$';
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return '$';
  }
};

export default function AddExpenseModal({ visible, onClose, onSubmit, categories }: AddExpenseModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [location, setLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);

  // Get user's currency from their profile, default to USD if not set
  const userCurrency = user?.currency || 'USD';
  const availableCategories = categories.length > 0 ? categories : getRegionalCategories(userCurrency);
  const nameCategoryMapping = getNameCategoryMapping(userCurrency);

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setAmount('');
      setName('');
      setDescription('');
      setMerchant('');
      setLocation('');
      setSelectedCategory(null);
      setIsRecurring(false);
      setTags([]);
      setCustomTag('');
      checkLocationPermission();
    }
  }, [visible]);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setIsLocationEnabled(true);
        getCurrentLocation();
      }
    } catch (error) {
      console.log('Location permission error:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      if (address[0]) {
        const { street, name, city, region } = address[0];
        const locationString = `${name || street || ''}, ${city || ''}, ${region || ''}`.replace(/^,\s*|,\s*$/g, '');
        setLocation(locationString);
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  // Auto-select category based on name
  useEffect(() => {
    if (name && !selectedCategory) {
      const nameLower = name.toLowerCase();
      for (const [keyword, categoryName] of Object.entries(nameCategoryMapping)) {
        if (nameLower.includes(keyword)) {
          const category = availableCategories.find(cat => cat.category === categoryName);
          if (category) {
            setSelectedCategory(category);
            break;
          }
        }
      }
    }
  }, [name, selectedCategory, nameCategoryMapping, availableCategories]);

  const handleSubmit = () => {
    if (!amount || !name || !selectedCategory) {
      Alert.alert('Error', 'Please fill in amount, name, and category');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const expenseData: ExpenseData = {
      amount: numericAmount,
      name: name.trim(),
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
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.colors.background }]}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add Expense</Text>
            <TouchableOpacity onPress={handleSubmit} style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={[styles.content, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
          {/* Amount Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Amount *</Text>
            <View style={[styles.amountContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>
                {getCurrencySymbol(userCurrency)}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: theme.colors.text }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
          </View>

          {/* Name Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="What did you spend on?"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Category *</Text>
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
                    { backgroundColor: theme.colors.surface },
                    selectedCategory?.category === category.category && [styles.categoryItemSelected, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]
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
                    { color: theme.colors.textSecondary },
                    selectedCategory?.category === category.category && [styles.categoryTextSelected, { color: theme.colors.primary }]
                  ]}>
                    {category.category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Merchant */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Merchant</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Where did you spend?"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          {/* Description - Optional and moved down */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text, minHeight: 60 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Additional details (optional)"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <View style={styles.locationHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Location</Text>
              {isLocationEnabled && (
                <TouchableOpacity onPress={getCurrentLocation} style={styles.locationButton}>
                  <Ionicons name="location" size={16} color={theme.colors.primary} />
                  <Text style={[styles.locationButtonText, { color: theme.colors.primary }]}>Get Current</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={location}
              onChangeText={setLocation}
              placeholder="Optional location"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tags</Text>
            
            {/* Current Tags */}
            {tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tag, { backgroundColor: theme.colors.primary + '20' }]}
                    onPress={() => removeTag(tag)}
                  >
                    <Text style={[styles.tagText, { color: theme.colors.primary }]}>{tag}</Text>
                    <Ionicons name="close" size={14} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Add Custom Tag */}
            <View style={[styles.addTagContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <TextInput
                style={[styles.tagInput, { color: theme.colors.text }]}
                value={customTag}
                onChangeText={setCustomTag}
                placeholder="Add a tag"
                placeholderTextColor={theme.colors.textSecondary}
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addTag} style={styles.addTagButton}>
                <Ionicons name="add" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Suggested Tags */}
            <View style={styles.suggestedTags}>
              {suggestedTags.filter(tag => !tags.includes(tag)).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.suggestedTag, { backgroundColor: theme.colors.surface }]}
                  onPress={() => setTags([...tags, tag])}
                >
                  <Text style={[styles.suggestedTagText, { color: theme.colors.textSecondary }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recurring Toggle */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.toggleContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => setIsRecurring(!isRecurring)}
            >
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleTitle, { color: theme.colors.text }]}>Recurring Expense</Text>
                <Text style={[styles.toggleSubtitle, { color: theme.colors.textSecondary }]}>
                  This expense repeats regularly
                </Text>
              </View>
              <View style={[
                styles.toggle,
                { backgroundColor: theme.colors.border },
                isRecurring && { backgroundColor: theme.colors.primary }
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
                colors={[theme.colors.primary, theme.colors.primary + 'CC']}
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
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    marginBottom: 12,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    padding: 16,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryItemSelected: {
    borderWidth: 2,
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
    textAlign: 'center',
  },
  categoryTextSelected: {
    fontWeight: '600',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    marginRight: 6,
  },
  addTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  addTagButton: {
    padding: 16,
  },
  suggestedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  suggestedTag: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  suggestedTagText: {
    fontSize: 14,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 14,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
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