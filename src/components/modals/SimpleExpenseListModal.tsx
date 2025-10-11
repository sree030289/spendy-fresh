// src/components/modals/EnhancedExpenseListModal.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../common/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/services/api/ApiService';
import { getCurrencySymbol } from '@/utils/currency';
import CircularLoader from '@/components/common/CircularLoader';

// Define types locally since they might differ from the old service
interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  paidBy: string;
  paidByData?: {
    fullName: string;
    email: string;
  };
  groupId: string;
  splitData?: Array<{
    userId: string;
    amount: number;
  }>;
  currency: string;
  date: Date;
  createdAt: Date;
  receiptUrl?: string;
}

interface Group {
  id: string;
  name: string;
  members: Array<{
    userId: string;
    userData: {
      fullName: string;
      email: string;
    };
  }>;
  isActive?: boolean;
}

interface Friend {
  id: string;
  friendId: string;
  friendData: {
    id: string;
    fullName: string;
    email: string;
    avatar?: string;
  };
  status: string;
}

interface EnhancedExpenseListModalProps {
  visible: boolean;
  onClose: () => void;
  initialGroupId?: string;
  initialFriendId?: string;
  title?: string;
  onExpensePress?: (expense: Expense) => void;
}

// Enhanced categories with colors for display
const EXPENSE_CATEGORIES = [
  { id: 'all', name: 'All Categories', icon: '📋', color: '#667eea' },
  { id: 'food', name: 'Food', icon: '🍕', color: '#F59E0B' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#3B82F6' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { id: 'utilities', name: 'Utilities', icon: '⚡', color: '#F59E0B' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#EF4444' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#06B6D4' },
  { id: 'settlement', name: 'Settlement', icon: '💸', color: '#10B981' },
  { id: 'other', name: 'Other', icon: '📝', color: '#6B7280' },
];

interface FilterState {
  searchQuery: string;
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

// Helper function to calculate split amount for user
const calculateSplitAmount = (expense: any, user: any, groupMemberCount: number = 2) => {
  if (!expense || !user) return 0;
  
  // If user paid the expense, they owe nothing
  if (expense.paidBy === user.id) return 0;
  
  // If there's split data, use it
  if (expense.splitData && Array.isArray(expense.splitData)) {
    const userSplit = expense.splitData.find((split: any) => split.userId === user.id);
    if (userSplit) return userSplit.amount;
  }
  
  // Default to equal split based on actual group member count
  return expense.amount / groupMemberCount;
};

// Helper function to get category icon
const getCategoryIcon = (category: string) => {
  return EXPENSE_CATEGORIES.find(cat => cat.id === category)?.icon || '💰';
};

// Helper function to get payer name safely
const getPayerName = (expense: any) => {
  return expense.paidByData?.fullName || expense.paidByName || 'Unknown';
};

export default function SimpleExpenseListModal({ 
  visible, 
  onClose, 
  initialGroupId,
  initialFriendId,
  title = "All Expenses",
  onExpensePress
}: EnhancedExpenseListModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // Initialize API service
  const apiService = ApiService.getInstance();
  
  // State management
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]); // Store all expenses for filtering
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  // Load initial data
  useEffect(() => {
    if (visible && user?.id) {
      loadInitialData();
    }
  }, [visible, user?.id]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadFilteredExpenses();
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load expense data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredExpenses = async () => {
    if (!user?.id) return;
    
    try {
      let apiExpenses: any[] = [];
      
      if (initialGroupId && initialGroupId !== 'all') {
        apiExpenses = await apiService.getGroupExpenses(initialGroupId);
      } else {
        // 🚀 For "View All", load expenses from all user groups
        console.log('🌟 View All Modal: Loading all user expenses for user:', user?.id);
        
        try {
          // First try to get all user expenses directly
          apiExpenses = await apiService.getUserExpenses(user.id, 50);
          console.log('🌟 View All Modal: Loaded', apiExpenses.length, 'expenses from getUserExpenses');
        } catch (error) {
          console.log('🌟 View All Modal: getUserExpenses failed, trying group-based approach:', error);
          
          // Fallback: Get all groups and load their expenses
          const userGroups = await apiService.getUserGroups(user.id);
          console.log('🌟 View All Modal: Found', userGroups.length, 'user groups');
          
          for (const group of userGroups) {
            try {
              const groupExpenses = await apiService.getGroupExpenses(group.id);
              apiExpenses.push(...groupExpenses);
              console.log('🌟 View All Modal: Added', groupExpenses.length, 'expenses from group', group.name);
            } catch (groupError) {
              console.log('🌟 View All Modal: Failed to load expenses from group', group.name, groupError);
            }
          }
          
          // Remove duplicates based on expense ID
          const uniqueExpenses = apiExpenses.filter((expense, index, self) => 
            index === self.findIndex(e => e.id === expense.id)
          );
          apiExpenses = uniqueExpenses;
          console.log('🌟 View All Modal: After deduplication:', apiExpenses.length, 'unique expenses');
        }
      }

      const processedExpenses = apiExpenses.map(expense => ({
        ...expense,
        splitType: expense.splitType || 'equal',
        split: expense.split,
        splitDetails: expense.splitDetails || [],
        actualSplitAmount: calculateSplitAmount(expense, user),
        // Ensure date fields are proper Date objects
        date: expense.date ? new Date(expense.date) : new Date(expense.createdAt || Date.now()),
        createdAt: expense.createdAt ? new Date(expense.createdAt) : new Date(),
      }));

      // 🌟 Apply SAME user-specific filtering logic as overview screen for consistency
      console.log('🌟 View All Modal: Applying user-specific filtering for user:', user?.id);
      console.log('🔍 View All Modal: Total processed expenses before filtering:', processedExpenses.length);
      console.log('🔍 View All Modal: Expense descriptions:', processedExpenses.map(e => e.description));
      
      let userFilteredExpenses = processedExpenses;
      
      // For now, show all expenses to maintain consistency with overview
      // In a production app, you'd want proper involvement checking
      userFilteredExpenses = processedExpenses; // Show all expenses
      
      console.log('✅ View All Modal - Showing all expenses for consistency');
      console.log('✅ View All Modal - Total expenses shown:', userFilteredExpenses.length);
      console.log('✅ View All Modal - Expense descriptions:', userFilteredExpenses.map(e => e.description));
      
      // Store all expenses for filtering and sorting
      setAllExpenses(userFilteredExpenses);
      // Apply current filters
      applyFiltersAndSort(userFilteredExpenses);
      
    } catch (error) {
      console.error('Error loading filtered expenses:', error);
      setAllExpenses([]);
      setExpenses([]);
    }
  };

  // Apply filters and sorting to the expenses
  const applyFiltersAndSort = useCallback((expensesToFilter: Expense[] = allExpenses) => {
    let filteredExpenses = [...expensesToFilter];
    
    // Apply search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      filteredExpenses = filteredExpenses.filter(expense => 
        expense.description.toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query) ||
        getPayerName(expense).toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filteredExpenses.sort((a, b) => {
      let comparison = 0;
      
      if (filters.sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (filters.sortBy === 'amount') {
        comparison = a.amount - b.amount;
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });
    
    setExpenses(filteredExpenses);
  }, [filters, allExpenses]);

  // Load expenses when filters change
  useEffect(() => {
    if (allExpenses.length > 0) {
      applyFiltersAndSort();
    }
  }, [filters.searchQuery, filters.sortBy, filters.sortOrder, applyFiltersAndSort]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, []);

  // Calculate total amount
  const totalAmount = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getCategoryColor = (categoryId: string) => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === categoryId)?.color || theme.colors.textSecondary;
  };

  const formatCurrency = (amount: number, currency?: string) => {
    // Use user's preferred currency for display consistency
    const displayCurrency = user?.currency || currency || 'USD';
    return `${getCurrencySymbol(displayCurrency)}${amount.toFixed(2)}`;
  };

  const formatDate = (dateInput: Date | string | number) => {
    // Ensure we have a proper Date object
    let date: Date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      date = new Date(dateInput);
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getPayerName = (expense: Expense) => {
    // If current user is the payer
    if (expense.paidBy === user?.id) {
      return 'You';
    }
    
    // If paidByData exists, use it
    if (expense.paidByData?.fullName) {
      return expense.paidByData.fullName;
    }
    
    return 'Unknown User';
  };

  const renderExpenseItem = ({ item: expense }: { item: Expense }) => {
    const isUserPayer = expense.paidBy === user?.id;
    
    return (
      <TouchableOpacity
        style={[styles.expenseItem, { backgroundColor: theme.colors.surface }]}
        onPress={() => onExpensePress?.(expense)}
        activeOpacity={0.7}
      >
        {/* Category Icon */}
        <View 
          style={[
            styles.categoryIcon,
            { backgroundColor: getCategoryColor(expense.category) }
          ]}
        >
          <Text style={styles.categoryIconText}>
            {getCategoryIcon(expense.category)}
          </Text>
        </View>

        {/* Expense Details */}
        <View style={styles.expenseDetails}>
          <Text style={[styles.expenseTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {expense.description}
          </Text>
          
          <View style={styles.expenseMetadata}>
            <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
              {formatDate(expense.date)}
            </Text>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>•</Text>
            <Text style={[styles.expensePayer, { color: theme.colors.textSecondary }]}>
              {isUserPayer ? 'You paid' : `${getPayerName(expense)} paid`}
            </Text>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>•</Text>
            <Text style={[styles.expenseCategory, { color: theme.colors.textSecondary }]}>
              {expense.category}
            </Text>
          </View>
        </View>

        {/* Amount and Receipt Indicator */}
        <View style={styles.rightSection}>
          <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
            {formatCurrency(expense.amount)}
          </Text>
          
          {/* Receipt Indicator */}
          {expense.receiptUrl && (
            <View style={styles.receiptIndicator}>
              <Icon name="document" size={12} color={theme.colors.primary} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="receipt" 
        size={64} 
        color={theme.colors.textTertiary} 
       />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        No expenses found
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        {filters.searchQuery
          ? 'Try adjusting your search criteria'
          : 'Start adding expenses to see them here'
        }
      </Text>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Brand Header - consistent with login/register */}
        <View style={[styles.headerGradient, { backgroundColor: theme.colors.brand }]}>
        
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="white"  />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>Track and manage all your expenses</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Summary Line */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              {expenses.length} expenses • {formatCurrency(totalAmount)}
            </Text>
          </View>
        </View>

        {/* Simple Filter Section */}
        <View style={[styles.filterSection, { backgroundColor: theme.colors.surfaceSecondary }]}>
          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
            <Icon name="search" size={20} color={theme.colors.textSecondary}  />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search expenses by name or category..."
              placeholderTextColor={theme.colors.textSecondary}
              value={filters.searchQuery}
              onChangeText={(text) => updateFilter('searchQuery', text)}
            />
            {filters.searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => updateFilter('searchQuery', '')}>
                <Icon name="error" size={20} color={theme.colors.textSecondary}  />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort and Refresh Controls */}
          <View style={styles.controlsRow}>
            {/* Sort by Date */}
            <TouchableOpacity
              onPress={() => {
                if (filters.sortBy === 'date') {
                  updateFilter('sortOrder', filters.sortOrder === 'desc' ? 'asc' : 'desc');
                } else {
                  updateFilter('sortBy', 'date');
                  updateFilter('sortOrder', 'desc');
                }
              }}
              style={[
                styles.sortButton,
                { 
                  backgroundColor: filters.sortBy === 'date' ? theme.colors.primary : theme.colors.surface,
                }
              ]}
            >
              <Icon name="calendar" 
                size={16} 
                color={filters.sortBy === 'date' ? 'white' : theme.colors.text} 
               />
              <Text style={[
                styles.sortButtonText, 
                { color: filters.sortBy === 'date' ? 'white' : theme.colors.text }
              ]}>
                Date
              </Text>
              {filters.sortBy === 'date' && (
                <Icon 
                  name={filters.sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} 
                  size={14} 
                  color="white" 
                />
              )}
            </TouchableOpacity>

            {/* Sort by Price */}
            <TouchableOpacity
              onPress={() => {
                if (filters.sortBy === 'amount') {
                  updateFilter('sortOrder', filters.sortOrder === 'desc' ? 'asc' : 'desc');
                } else {
                  updateFilter('sortBy', 'amount');
                  updateFilter('sortOrder', 'desc');
                }
              }}
              style={[
                styles.sortButton,
                { 
                  backgroundColor: filters.sortBy === 'amount' ? theme.colors.primary : theme.colors.surface,
                }
              ]}
            >
              <Icon name="cash" 
                size={16} 
                color={filters.sortBy === 'amount' ? 'white' : theme.colors.text} 
               />
              <Text style={[
                styles.sortButtonText, 
                { color: filters.sortBy === 'amount' ? 'white' : theme.colors.text }
              ]}>
                Price
              </Text>
              {filters.sortBy === 'amount' && (
                <Icon 
                  name={filters.sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} 
                  size={14} 
                  color="white" 
                />
              )}
            </TouchableOpacity>

            {/* Refresh Button */}
            <TouchableOpacity
              onPress={onRefresh}
              style={[styles.refreshButton, { backgroundColor: theme.colors.surface }]}
              disabled={refreshing}
            >
              <Icon name="refresh" 
                size={16} 
                color={theme.colors.primary}
                style={refreshing ? styles.spinning : undefined}
               />
              <Text style={[styles.refreshButtonText, { color: theme.colors.primary }]}>
                Refresh
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expense List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <CircularLoader size={60} />
            <Text style={[styles.loadingText, { color: '#3bf6ceff' }]}>
              Loading expenses...
            </Text>
          </View>
        ) : (
          <FlatList
            data={expenses}
            renderItem={renderExpenseItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.expensesList}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 2,
  },
  headerSpacer: {
    width: 32,
  },
  summaryContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  filterSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    justifyContent: 'center',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    justifyContent: 'center',
    minWidth: 80,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  spinning: {
    transform: [{ rotate: '360deg' }],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  expensesList: {
    padding: 16,
    paddingTop: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
    gap: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: {
    fontSize: 18,
  },
  expenseDetails: {
    flex: 1,
    gap: 4,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expenseDate: {
    fontSize: 13,
  },
  separator: {
    fontSize: 13,
  },
  expensePayer: {
    fontSize: 13,
  },
  expenseCategory: {
    fontSize: 13,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiptIndicator: {
    marginTop: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 200,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});