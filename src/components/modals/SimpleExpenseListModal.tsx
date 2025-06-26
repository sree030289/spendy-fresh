// src/components/modals/EnhancedExpenseListModal.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { SplittingService, Expense, Group, Friend } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';

interface EnhancedExpenseListModalProps {
  visible: boolean;
  onClose: () => void;
  initialGroupId?: string;
  initialFriendId?: string;
  title?: string;
  onExpensePress?: (expense: Expense) => void;
}

// Enhanced categories with colors
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

const DATE_RANGES = [
  { id: 'all', name: 'All Time' },
  { id: 'week', name: 'Last Week' },
  { id: 'month', name: 'Last Month' },
  { id: 'quarter', name: 'Last 3 Months' },
  { id: 'year', name: 'Last Year' },
];

interface FilterState {
  searchQuery: string;
  category: string;
  groupId: string;
  friendId: string;
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
  
  // State management
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    category: 'all',
    groupId: initialGroupId || 'all',
    friendId: initialFriendId || 'all',
    dateRange: 'all',
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
      
      const [userGroups, userFriends] = await Promise.all([
        SplittingService.getUserGroups(user!.id),
        SplittingService.getFriends(user!.id)
      ]);
      
      setGroups([
        { id: 'all', name: 'All Groups', members: [], isActive: true } as Group,
        ...userGroups
      ]);
      
      setFriends([
        { 
          id: 'all', 
          friendData: { id: 'all', fullName: 'All Friends', email: '', avatar: '' },
          status: 'accepted'
        } as Friend,
        ...userFriends.filter(f => f.status === 'accepted')
      ]);
      
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
      const filteredExpenses = await SplittingService.getFilteredExpenses(user.id, {
        searchQuery: filters.searchQuery,
        category: filters.category !== 'all' ? filters.category : undefined,
        groupId: filters.groupId !== 'all' ? filters.groupId : undefined,
        friendId: filters.friendId !== 'all' ? filters.friendId : undefined,
        dateRange: filters.dateRange !== 'all' ? filters.dateRange as any : undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        limit: 500
      });
      
      setExpenses(filteredExpenses);
      
    } catch (error) {
      console.error('Error loading filtered expenses:', error);
      setExpenses([]);
    }
  };

  // Load expenses when filters change
  useEffect(() => {
    if (user?.id && visible) {
      const timeoutId = setTimeout(() => {
        loadFilteredExpenses();
      }, 300); // Debounce search
      
      return () => clearTimeout(timeoutId);
    }
  }, [filters, user?.id, visible]);

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

  const getCategoryIcon = (categoryId: string) => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === categoryId)?.icon || '📝';
  };

  const getCategoryColor = (categoryId: string) => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === categoryId)?.color || theme.colors.textSecondary;
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

  const getGroupName = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    return group?.name || 'Unknown Group';
  };

  const getSelectedCategoryName = () => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === filters.category)?.name || 'All Categories';
  };

  const getSelectedGroupName = () => {
    return groups.find(g => g.id === filters.groupId)?.name || 'All Groups';
  };

  const getSelectedFriendName = () => {
    return friends.find(f => f.friendData.id === filters.friendId)?.friendData.fullName || 'All Friends';
  };

  const getSelectedDateRange = () => {
    return DATE_RANGES.find(d => d.id === filters.dateRange)?.name || 'All Time';
  };

  const getSplitWithNames = (expense: Expense) => {
    const splitUserIds = expense.splitData.map(split => split.userId).filter(id => id !== user?.id);
    const names: string[] = [];
    
    splitUserIds.forEach(userId => {
      let userName = 'Unknown';
      for (const group of groups) {
        const member = group.members?.find(m => m.userId === userId);
        if (member) {
          userName = member.userData.fullName;
          break;
        }
      }
      
      if (userName === 'Unknown') {
        const friend = friends.find(f => f.friendId === userId);
        if (friend) {
          userName = friend.friendData.fullName;
        }
      }
      
      names.push(userName);
    });
    
    return names;
  };

  const renderExpenseItem = ({ item: expense }: { item: Expense }) => {
    const splitWithNames = getSplitWithNames(expense);
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
              {isUserPayer ? 'You paid' : `${expense.paidByData.fullName} paid`}
            </Text>
            <Text style={[styles.separator, { color: theme.colors.textSecondary }]}>•</Text>
            <Text style={[styles.expenseGroup, { color: theme.colors.textSecondary }]}>
              {getGroupName(expense.groupId)}
            </Text>
          </View>

          {splitWithNames.length > 0 && (
            <View style={styles.splitWithContainer}>
              <Text style={[styles.splitWithLabel, { color: theme.colors.textTertiary }]}>
                Split with:
              </Text>
              {splitWithNames.slice(0, 2).map((name, idx) => (
                <View key={idx} style={[styles.splitChip, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.splitChipText, { color: theme.colors.textSecondary }]}>
                    {name}
                  </Text>
                </View>
              ))}
              {splitWithNames.length > 2 && (
                <View style={[styles.splitChip, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.splitChipText, { color: theme.colors.textSecondary }]}>
                    +{splitWithNames.length - 2} more
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.rightSection}>
          <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
            {formatCurrency(expense.amount, expense.currency)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name="receipt-outline" 
        size={64} 
        color={theme.colors.textTertiary} 
      />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        No expenses found
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
        {filters.searchQuery || filters.category !== 'all' || filters.groupId !== 'all' || filters.friendId !== 'all'
          ? 'Try adjusting your filters or search criteria'
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
        </LinearGradient>

        {/* Compact Filter Section */}
        <View style={[styles.filterSection, { backgroundColor: theme.colors.surfaceSecondary }]}>
          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search expenses, people, or notes..."
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

            {/* Groups */}
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowGroupModal(true)}
            >
              <Ionicons name="people-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.filterButtonText, { color: theme.colors.text }]} numberOfLines={1}>
                {getSelectedGroupName()}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* Friends */}
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowFriendModal(true)}
            >
              <Ionicons name="person-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.filterButtonText, { color: theme.colors.text }]} numberOfLines={1}>
                {getSelectedFriendName()}
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

        {/* Expense List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
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

        {/* Filter Modals */}
        <FilterSelectionModal
          visible={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title="Select Category"
          options={EXPENSE_CATEGORIES}
          selectedValue={filters.category}
          onSelect={(value) => updateFilter('category', value)}
        />

        <FilterSelectionModal
          visible={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          title="Select Group"
          options={groups.map(g => ({ id: g.id, name: g.name, icon: g.id === 'all' ? '🏠' : '👥' }))}
          selectedValue={filters.groupId}
          onSelect={(value) => updateFilter('groupId', value)}
        />

        <FilterSelectionModal
          visible={showFriendModal}
          onClose={() => setShowFriendModal(false)}
          title="Select Friend"
          options={friends.map(f => ({ 
            id: f.friendData.id, 
            name: f.friendData.fullName, 
            icon: f.friendData.id === 'all' ? '👥' : '👤' 
          }))}
          selectedValue={filters.friendId}
          onSelect={(value) => updateFilter('friendId', value)}
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
  expenseGroup: {
    fontSize: 13,
  },
  splitWithContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  splitWithLabel: {
    fontSize: 11,
  },
  splitChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  splitChipText: {
    fontSize: 10,
    fontWeight: '500',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
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