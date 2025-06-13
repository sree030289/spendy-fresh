// src/components/modals/SimpleExpenseListModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { SplittingService, Expense } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';

interface SimpleExpenseListModalProps {
  visible: boolean;
  onClose: () => void;
  groupId?: string; // Optional: show expenses for specific group
  title?: string;
  onExpensePress?: (expense: Expense) => void;
}

const EXPENSE_CATEGORIES = [
  { id: 'all', name: 'All', icon: '📋' },
  { id: 'food', name: 'Food', icon: '🍕' },
  { id: 'transport', name: 'Transport', icon: '🚗' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'utilities', name: 'Utilities', icon: '⚡' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'settlement', name: 'Settlement', icon: '💸' },
  { id: 'other', name: 'Other', icon: '📝' },
];

export default function SimpleExpenseListModal({ 
  visible, 
  onClose, 
  groupId,
  title = "All Expenses",
  onExpensePress
}: SimpleExpenseListModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (visible) {
      loadExpenses();
    }
  }, [visible, groupId]);

  useEffect(() => {
    filterAndSortExpenses();
  }, [expenses, selectedCategory, searchQuery, sortBy, sortOrder]);

  const loadExpenses = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      let fetchedExpenses: Expense[] = [];
      
      if (groupId) {
        // Load expenses for specific group
        fetchedExpenses = await SplittingService.getGroupExpenses(groupId);
      } else {
        // Load all user expenses
        fetchedExpenses = await SplittingService.getUserExpenses(user.id, 1000);
      }
      
      setExpenses(fetchedExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortExpenses = () => {
    let filtered = [...expenses];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(expense => expense.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(expense => 
        expense.description.toLowerCase().includes(query) ||
        expense.paidByData.fullName.toLowerCase().includes(query) ||
        expense.notes?.toLowerCase().includes(query)
      );
    }

    // Sort expenses
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.date.getTime();
        const dateB = b.date.getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
      }
    });

    setFilteredExpenses(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  const renderExpenseItem = (expense: Expense) => (
    <TouchableOpacity
      key={expense.id}
      style={[styles.expenseItem, { backgroundColor: theme.colors.surface }]}
      onPress={() => onExpensePress?.(expense)}
    >
      <View style={styles.expenseLeft}>
        <View style={[
          styles.categoryIcon,
          { backgroundColor: expense.category === 'settlement' ? '#10b981' : theme.colors.primary + '20' }
        ]}>
          <Text style={styles.categoryIconText}>
            {EXPENSE_CATEGORIES.find(cat => cat.id === expense.category)?.icon || '📝'}
          </Text>
        </View>
        <View style={styles.expenseDetails}>
          <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
            {expense.description}
          </Text>
          <Text style={[styles.expenseSubtitle, { color: theme.colors.textSecondary }]}>
            {expense.date.toLocaleDateString()} • {expense.paidByData.fullName}
          </Text>
          {expense.notes && (
            <Text style={[styles.expenseNotes, { color: theme.colors.textSecondary }]}>
              {expense.notes.length > 50 ? `${expense.notes.substring(0, 50)}...` : expense.notes}
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.expenseRight}>
        <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
          {getCurrencySymbol(expense.currency)}{expense.amount.toFixed(2)}
        </Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: expense.isSettled ? theme.colors.success + '20' : theme.colors.error + '20' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: expense.isSettled ? theme.colors.success : theme.colors.error }
          ]}>
            {expense.isSettled ? 'Settled' : 'Pending'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryFilter = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryFilter}
    >
      {EXPENSE_CATEGORIES.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.categoryButton,
            selectedCategory === category.id && [
              styles.selectedCategoryButton,
              { backgroundColor: theme.colors.primary }
            ]
          ]}
          onPress={() => setSelectedCategory(category.id)}
        >
          <Text style={styles.categoryButtonIcon}>{category.icon}</Text>
          <Text style={[
            styles.categoryButtonText,
            {
              color: selectedCategory === category.id 
                ? 'white' 
                : theme.colors.text
            }
          ]}>
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              style={styles.sortButton}
            >
              <Ionicons 
                name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} 
                size={20} 
                color={theme.colors.primary} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search expenses..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        {renderCategoryFilter()}

        {/* Results Summary */}
        <View style={styles.summaryContainer}>
          <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
            {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} found
          </Text>
          <View style={styles.sortOptions}>
            <TouchableOpacity
              style={[
                styles.sortOptionButton,
                sortBy === 'date' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => setSortBy('date')}
            >
              <Text style={[
                styles.sortOptionText,
                { color: sortBy === 'date' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Date
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortOptionButton,
                sortBy === 'amount' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => setSortBy('amount')}
            >
              <Text style={[
                styles.sortOptionText,
                { color: sortBy === 'amount' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Amount
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expenses List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading expenses...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.expensesList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            }
          >
            {filteredExpenses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={64} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  No Expenses Found
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  {searchQuery || selectedCategory !== 'all'
                    ? 'Try adjusting your filters'
                    : 'No expenses to display'
                  }
                </Text>
              </View>
            ) : (
              filteredExpenses.map(renderExpenseItem)
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

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
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    width: 40,
    alignItems: 'flex-end',
  },
  sortButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  categoryFilter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  selectedCategoryButton: {
    backgroundColor: '#3B82F6',
  },
  categoryButtonIcon: {
    fontSize: 16,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  summaryText: {
    fontSize: 14,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOptionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  expensesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseSubtitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  expenseNotes: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});