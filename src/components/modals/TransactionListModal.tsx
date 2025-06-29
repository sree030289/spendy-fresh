import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { DataService } from '@/services/smartMoney/dataService';
import { Expense, Income } from '@/types';
import { getCurrencySymbol } from '@/utils/currency';

// Combined transaction type for unified display
interface CombinedTransaction {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: Date;
  type: 'income' | 'expense';
  merchant?: string;
  tags?: string[];
  location?: string;
}

interface TransactionListModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  onTransactionPress?: (transaction: CombinedTransaction) => void;
}

// Transaction categories with colors (for income and expenses)
const TRANSACTION_CATEGORIES = [
  { id: 'all', name: 'All Categories', icon: '📋', color: '#667eea' },
  // Income categories
  { id: 'salary', name: 'Salary', icon: '💰', color: '#10B981' },
  { id: 'freelance', name: 'Freelance', icon: '💻', color: '#059669' },
  { id: 'investment', name: 'Investment', icon: '📈', color: '#065F46' },
  { id: 'bonus', name: 'Bonus', icon: '🎁', color: '#047857' },
  { id: 'rental', name: 'Rental Income', icon: '🏠', color: '#064E3B' },
  { id: 'business', name: 'Business', icon: '🏢', color: '#065F46' },
  { id: 'other_income', name: 'Other Income', icon: '💸', color: '#047857' },
  // Expense categories
  { id: 'food', name: 'Food & Dining', icon: '🍕', color: '#F59E0B' },
  { id: 'transport', name: 'Transportation', icon: '🚗', color: '#3B82F6' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { id: 'utilities', name: 'Utilities', icon: '⚡', color: '#F97316' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#EF4444' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#06B6D4' },
  { id: 'education', name: 'Education', icon: '📚', color: '#7C3AED' },
  { id: 'housing', name: 'Housing', icon: '🏠', color: '#DC2626' },
  { id: 'insurance', name: 'Insurance', icon: '🛡️', color: '#059669' },
  { id: 'taxes', name: 'Taxes', icon: '📊', color: '#B91C1C' },
  { id: 'other_expense', name: 'Other Expenses', icon: '📝', color: '#6B7280' },
];

const DATE_RANGES = [
  { id: 'all', name: 'All Time' },
  { id: 'week', name: 'Last Week' },
  { id: 'month', name: 'Last Month' },
  { id: 'quarter', name: 'Last 3 Months' },
  { id: 'year', name: 'Last Year' },
];

const TRANSACTION_TYPES = [
  { id: 'all', name: 'All Transactions', icon: '📊' },
  { id: 'income', name: 'Income', icon: '💰' },
  { id: 'expense', name: 'Expenses', icon: '💸' },
];

interface TransactionFilterState {
  searchQuery: string;
  category: string;
  type: 'all' | 'income' | 'expense';
  dateRange: string;
  sortBy: 'date' | 'amount' | 'category';
  sortOrder: 'asc' | 'desc';
}

// Filter Selection Modal Component
const FilterSelectionModal = ({ 
  visible, 
  onClose, 
  title, 
  options, 
  selectedValue, 
  onSelect 
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: Array<{ id: string; name: string; icon?: string; color?: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
}) => {
  const { theme } = useTheme();
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  { 
                    backgroundColor: selectedValue === item.id ? `${theme.colors.primary}20` : 'transparent',
                    borderBottomColor: theme.colors.border 
                  }
                ]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                {item.icon && <Text style={styles.modalOptionIcon}>{item.icon}</Text>}
                <Text style={[
                  styles.modalOptionText, 
                  { 
                    color: selectedValue === item.id ? theme.colors.primary : theme.colors.text,
                    fontWeight: selectedValue === item.id ? '600' : '400'
                  }
                ]}>
                  {item.name}
                </Text>
                {selectedValue === item.id && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

export default function TransactionListModal({ 
  visible, 
  onClose, 
  title = "All Transactions",
  onTransactionPress
}: TransactionListModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // State management
  const [transactions, setTransactions] = useState<CombinedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  
  const [filters, setFilters] = useState<TransactionFilterState>({
    searchQuery: '',
    category: 'all',
    type: 'all',
    dateRange: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  // Load initial data
  useEffect(() => {
    if (visible && user?.id) {
      loadTransactions();
    }
  }, [visible, user?.id]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const dataService = DataService.getInstance();
      
      // Load both expenses and income separately
      const [expenses, income] = await Promise.all([
        dataService.getExpenses(),
        dataService.getIncome()
      ]);
      
      console.log(`Loaded ${expenses.length} expenses and ${income.length} income items`);
      
      // Convert to unified format
      const combinedTransactions: CombinedTransaction[] = [
        // Convert expenses
        ...expenses.map((expense: Expense): CombinedTransaction => ({
          id: expense.id,
          title: expense.title,
          amount: expense.amount,
          category: expense.category.toLowerCase(),
          date: new Date(expense.date),
          type: 'expense',
          merchant: expense.description || 'Unknown'
        })),
        // Convert income
        ...income.map((incomeItem: Income): CombinedTransaction => ({
          id: incomeItem.id,
          title: incomeItem.title,
          amount: incomeItem.amount,
          category: incomeItem.category.toLowerCase(),
          date: new Date(incomeItem.date),
          type: 'income',
          merchant: 'Income'
        }))
      ];
      
      // Debug: Log first few transactions to see their structure
      if (combinedTransactions.length > 0) {
        console.log('First combined transaction:', combinedTransactions[0]);
        combinedTransactions.slice(0, 3).forEach((t, idx) => {
          console.log(`Transaction ${idx + 1}:`, {
            title: t.title,
            amount: t.amount,
            category: t.category,
            type: t.type,
            date: t.date
          });
        });
      }
      
      setTransactions(combinedTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load transaction data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine if a transaction is income or expense (simplified since we now have explicit types)
  const isIncomeTransaction = (transaction: CombinedTransaction) => {
    return transaction.type === 'income';
  };

  // Filter transactions based on current filters
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    
    console.log(`Filtering ${transactions.length} transactions with filters:`, filters);

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(transaction => 
        transaction.title.toLowerCase().includes(query) ||
        (transaction.merchant && transaction.merchant.toLowerCase().includes(query)) ||
        transaction.category.toLowerCase().includes(query)
      );
      console.log(`After search filter: ${filtered.length} transactions`);
    }

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(transaction => transaction.category === filters.category);
      console.log(`After category filter: ${filtered.length} transactions`);
    }

    // Filter by transaction type (income vs expense)
    if (filters.type !== 'all') {
      if (filters.type === 'income') {
        // Use the same logic as isIncomeTransaction
        filtered = filtered.filter(transaction => isIncomeTransaction(transaction));
      } else if (filters.type === 'expense') {
        // Use the inverse of isIncomeTransaction logic
        filtered = filtered.filter(transaction => !isIncomeTransaction(transaction));
      }
      console.log(`After type filter (${filters.type}): ${filtered.length} transactions`);
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (filters.dateRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      // Reset time to start of day for comparison
      startDate.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        transactionDate.setHours(0, 0, 0, 0);
        return transactionDate >= startDate;
      });
    }

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = a.date.getTime() - b.date.getTime();
          break;
        case 'amount':
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    console.log(`Final filtered transactions: ${filtered.length}`);
    if (filtered.length > 0) {
      console.log('Sample filtered transactions:', filtered.slice(0, 3).map(t => ({
        title: t.title,
        amount: t.amount,
        category: t.category,
        type: t.type,
        date: t.date
      })));
    }

    return filtered;
  }, [transactions, filters]);

  // Load transactions when filters change (debounced)
  useEffect(() => {
    if (user?.id && visible && filters.searchQuery !== '') {
      const timeoutId = setTimeout(() => {
        // Search is handled in filteredTransactions memo, no need to reload
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [filters.searchQuery, user?.id, visible]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  }, []);

  // Calculate totals
  const { totalIncome, totalExpenses, netAmount } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    
    filteredTransactions.forEach(transaction => {
      const isIncome = isIncomeTransaction(transaction);
      
      if (isIncome) {
        income += Math.abs(transaction.amount);
      } else {
        expenses += Math.abs(transaction.amount);
      }
    });
    
    console.log('Totals calculation:', { income, expenses, transactionCount: filteredTransactions.length });
    
    return {
      totalIncome: income,
      totalExpenses: expenses,
      netAmount: income - expenses
    };
  }, [filteredTransactions]);

  const updateFilter = (key: keyof TransactionFilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getCategoryIcon = (categoryId: string) => {
    return TRANSACTION_CATEGORIES.find(cat => cat.id === categoryId)?.icon || '📝';
  };

  const getCategoryColor = (categoryId: string) => {
    return TRANSACTION_CATEGORIES.find(cat => cat.id === categoryId)?.color || theme.colors.textSecondary;
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return `${getCurrencySymbol(currency)}${amount.toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
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

  const getSelectedCategoryName = () => {
    return TRANSACTION_CATEGORIES.find(cat => cat.id === filters.category)?.name || 'All Categories';
  };

  const getSelectedTypeName = () => {
    return TRANSACTION_TYPES.find(t => t.id === filters.type)?.name || 'All Transactions';
  };

  const getSelectedDateRange = () => {
    return DATE_RANGES.find(d => d.id === filters.dateRange)?.name || 'All Time';
  };

  const renderTransactionItem = ({ item: transaction }: { item: CombinedTransaction }) => {
    const isIncome = isIncomeTransaction(transaction);
    
    return (
      <TouchableOpacity
        style={[styles.transactionItem, { backgroundColor: theme.colors.surface }]}
        onPress={() => onTransactionPress?.(transaction)}
        activeOpacity={0.7}
      >
        {/* Category Icon */}
        <View 
          style={[
            styles.categoryIcon,
            { backgroundColor: getCategoryColor(transaction.category) }
          ]}
        >
          <Text style={styles.categoryIconText}>
            {getCategoryIcon(transaction.category)}
          </Text>
        </View>

        {/* Transaction Details */}
        <View style={styles.transactionDetails}>
          <Text style={[styles.transactionTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {transaction.title}
          </Text>
          
          <View style={styles.transactionMetadata}>
            <Text style={[styles.transactionDate, { color: theme.colors.textSecondary }]}>
              {formatDate(transaction.date)}
            </Text>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>•</Text>
            <Text style={[styles.transactionMerchant, { color: theme.colors.textSecondary }]}>
              {transaction.merchant || 'Unknown'}
            </Text>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>•</Text>
            <Text style={[styles.transactionLocation, { color: theme.colors.textSecondary }]}>
              {transaction.category}
            </Text>
          </View>

          {transaction.tags && transaction.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {transaction.tags.slice(0, 2).map((tag: string, idx: number) => (
                <View key={idx} style={[styles.tagChip, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.tagChipText, { color: theme.colors.textSecondary }]}>
                    {tag}
                  </Text>
                </View>
              ))}
              {transaction.tags.length > 2 && (
                <View style={[styles.tagChip, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.tagChipText, { color: theme.colors.textSecondary }]}>
                    +{transaction.tags.length - 2} more
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.rightSection}>
          <Text style={[
            styles.transactionAmount, 
            { 
              color: isIncome ? '#10B981' : '#EF4444'
            }
          ]}>
            {isIncome ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
          </Text>
          <Text style={[styles.transactionType, { color: theme.colors.textSecondary }]}>
            {isIncome ? 'Income' : 'Expense'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="wallet-outline" 
        size={64} 
        color={theme.colors.textSecondary} 
      />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        No transactions found
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        {filters.searchQuery || filters.category !== 'all' || filters.type !== 'all'
          ? 'Try adjusting your filters or search criteria'
          : 'Start adding transactions to see them here'
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
        {/* Gradient Header */}
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>Track your income and expenses</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Summary */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>+{formatCurrency(totalIncome)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={[styles.summaryValue, { color: '#EF4444' }]}>-{formatCurrency(totalExpenses)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Net</Text>
                <Text style={[
                  styles.summaryValue,
                  { color: netAmount >= 0 ? '#10B981' : '#EF4444' }
                ]}>
                  {netAmount >= 0 ? '+' : ''}{formatCurrency(Math.abs(netAmount))}
                </Text>
              </View>
            </View>
            <Text style={styles.summarySubtext}>
              {filteredTransactions.length} transactions
            </Text>
          </View>
        </LinearGradient>

        {/* Filter Section */}
        <View style={[styles.filterSection, { backgroundColor: theme.colors.surface }]}>
          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search transactions..."
              placeholderTextColor={theme.colors.textSecondary}
              value={filters.searchQuery}
              onChangeText={(text) => updateFilter('searchQuery', text)}
            />
            {filters.searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => updateFilter('searchQuery', '')}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Controls */}
          <View style={styles.filterControls}>
            {/* Type Filter */}
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowTypeModal(true)}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.filterButtonText, { color: theme.colors.text }]} numberOfLines={1}>
                {getSelectedTypeName()}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* Categories */}
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowCategoryModal(true)}
            >
              <Ionicons name="pricetag-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.filterButtonText, { color: theme.colors.text }]} numberOfLines={1}>
                {getSelectedCategoryName()}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Date and Sort */}
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowDateModal(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.dateButtonText, { color: theme.colors.text }]}>
                {getSelectedDateRange()}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const newOrder = filters.sortOrder === 'desc' ? 'asc' : 'desc';
                updateFilter('sortOrder', newOrder);
              }}
              style={[styles.sortButton, { backgroundColor: theme.colors.surface }]}
            >
              <Ionicons 
                name={filters.sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} 
                size={16} 
                color={theme.colors.primary} 
              />
              <Text style={[styles.sortButtonText, { color: theme.colors.text }]}>
                Date
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading transactions...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredTransactions}
            renderItem={renderTransactionItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.transactionsList}
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

        {/* Filter Modals */}
        <FilterSelectionModal
          visible={showTypeModal}
          onClose={() => setShowTypeModal(false)}
          title="Select Transaction Type"
          options={TRANSACTION_TYPES}
          selectedValue={filters.type}
          onSelect={(value) => updateFilter('type', value)}
        />

        <FilterSelectionModal
          visible={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title="Select Category"
          options={TRANSACTION_CATEGORIES}
          selectedValue={filters.category}
          onSelect={(value) => updateFilter('category', value)}
        />

        <FilterSelectionModal
          visible={showDateModal}
          onClose={() => setShowDateModal(false)}
          title="Select Date Range"
          options={DATE_RANGES.map(d => ({ id: d.id, name: d.name, icon: '📅' }))}
          selectedValue={filters.dateRange}
          onSelect={(value) => updateFilter('dateRange', value)}
        />
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  summarySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
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
  filterControls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  filterButtonText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  bottomControls: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '500',
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
  transactionsList: {
    padding: 16,
    paddingTop: 8,
  },
  transactionItem: {
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
  transactionDetails: {
    flex: 1,
    gap: 4,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transactionDate: {
    fontSize: 13,
  },
  separator: {
    fontSize: 13,
  },
  transactionMerchant: {
    fontSize: 13,
  },
  transactionLocation: {
    fontSize: 13,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagChipText: {
    fontSize: 10,
    fontWeight: '500',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionType: {
    fontSize: 12,
    marginTop: 2,
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
  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  modalOptionIcon: {
    fontSize: 16,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
  },
});
