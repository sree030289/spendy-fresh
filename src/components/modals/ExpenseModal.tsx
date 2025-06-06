import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { SplittingService, Expense } from '@/services/firebase/splitting';

interface ExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  groupId?: string; // Optional: show expenses for specific group
  title?: string;
}

// Category icon mapping
const getCategoryIcon = (category: string): string => {
  const iconMap: { [key: string]: string } = {
    'Coffee': '☕',
    'Groceries': '🛒',
    'Dining': '🍽️',
    'Transport': '🚗',
    'Entertainment': '🎬',
    'Shopping': '🛍️',
    'Bills': '💡',
    'Gas': '⛽',
    'Healthcare': '🏥',
    'Other': '💳'
  };
  return iconMap[category] || '💳';
};

// Category color mapping
const getCategoryColor = (category: string): string => {
  const colorMap: { [key: string]: string } = {
    'Coffee': '#f59e0b',
    'Groceries': '#10b981',
    'Dining': '#ef4444',
    'Transport': '#3b82f6',
    'Entertainment': '#8b5cf6',
    'Shopping': '#ec4899',
    'Bills': '#f97316',
    'Gas': '#64748b',
    'Healthcare': '#06b6d4',
    'Other': '#6b7280'
  };
  return colorMap[category] || '#6b7280';
};

export default function ExpenseModal({ 
  visible, 
  onClose, 
  groupId,
  title = "Smart Expenses" 
}: ExpenseModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'settled'>('all');
  const [activeView, setActiveView] = useState<'expenses' | 'analytics'>('expenses');

  useEffect(() => {
    if (visible) {
      loadExpenses();
    }
  }, [visible, groupId, selectedFilter]);

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
        fetchedExpenses = await SplittingService.getUserExpenses(user.id);
      }
      
      // Apply filter
      switch (selectedFilter) {
        case 'pending':
          fetchedExpenses = fetchedExpenses.filter(expense => !expense.isSettled);
          break;
        case 'settled':
          fetchedExpenses = fetchedExpenses.filter(expense => expense.isSettled);
          break;
        default:
          // Show all
          break;
      }
      
      // Sort by date (newest first)
      fetchedExpenses.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setExpenses(fetchedExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  const handleExpensePress = (expense: Expense) => {
    // Show modern expense details with actions
    Alert.alert(
      'Expense Details',
      `${expense.description}\nAmount: $${expense.amount.toFixed(2)}\nPaid by: ${expense.paidByData.fullName}\nDate: ${expense.date.toLocaleDateString()}\nStatus: ${expense.isSettled ? 'Settled' : 'Pending'}`,
      [
        { text: 'OK', style: 'default' },
        ...(expense.isSettled ? [] : [
          { 
            text: 'Mark as Settled', 
            onPress: () => handleMarkSettled(expense),
            style: 'default' as const
          }
        ])
      ]
    );
  };

  const handleMarkSettled = async (expense: Expense) => {
    try {
      // Use updateExpense method instead of settleExpense
      await SplittingService.updateExpense({
        ...expense,
        isSettled: true
      });
      await loadExpenses(); // Refresh the list
      Alert.alert('Success', 'Expense marked as settled!');
    } catch (error) {
      console.error('Error settling expense:', error);
      Alert.alert('Error', 'Failed to settle expense');
    }
  };

  const renderViewToggle = () => (
    <View style={[styles.viewToggle, { backgroundColor: theme.colors.surface }]}>
      <TouchableOpacity
        onPress={() => setActiveView('expenses')}
        style={[
          styles.viewToggleButton,
          activeView === 'expenses' && { backgroundColor: theme.colors.background, shadowColor: theme.colors.border }
        ]}
      >
        <Ionicons 
          name="receipt" 
          size={16} 
          color={activeView === 'expenses' ? theme.colors.primary : theme.colors.textSecondary} 
        />
        <Text style={[
          styles.viewToggleText,
          { color: activeView === 'expenses' ? theme.colors.primary : theme.colors.textSecondary }
        ]}>
          Expenses
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setActiveView('analytics')}
        style={[
          styles.viewToggleButton,
          activeView === 'analytics' && { backgroundColor: theme.colors.background, shadowColor: theme.colors.border }
        ]}
      >
        <Ionicons 
          name="analytics" 
          size={16} 
          color={activeView === 'analytics' ? theme.colors.primary : theme.colors.textSecondary} 
        />
        <Text style={[
          styles.viewToggleText,
          { color: activeView === 'analytics' ? theme.colors.primary : theme.colors.textSecondary }
        ]}>
          Analytics
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFilterButton = (filter: 'all' | 'pending' | 'settled', label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        {
          backgroundColor: selectedFilter === filter ? theme.colors.primary : theme.colors.surface,
          borderColor: selectedFilter === filter ? theme.colors.primary : theme.colors.border,
        }
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text
        style={[
          styles.filterText,
          {
            color: selectedFilter === filter ? 'white' : theme.colors.text,
          }
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderExpenseCard = (expense: Expense) => {
    const category = expense.category || 'Other';
    const iconText = getCategoryIcon(category);
    const colorBg = getCategoryColor(category);
    const canSplit = expense.amount > (category === 'Coffee' ? 10 : 30);
    
    return (
      <TouchableOpacity
        key={expense.id}
        style={[styles.expenseCard, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.border }]}
        onPress={() => handleExpensePress(expense)}
      >
        <View style={styles.expenseCardContent}>
          <View style={styles.expenseLeft}>
            <View style={[styles.expenseIcon, { backgroundColor: colorBg }]}>
              <Text style={styles.expenseIconText}>{iconText}</Text>
            </View>
            <View style={styles.expenseInfo}>
              <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
                ${expense.amount.toFixed(2)}
              </Text>
              <Text style={[styles.expenseSubtitle, { color: theme.colors.textSecondary }]}>
                {expense.description}
              </Text>
              <View style={styles.expenseMetaRow}>
                <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.expenseLocation, { color: theme.colors.textSecondary }]}>
                  {expense.paidByData.fullName}
                </Text>
                <Text style={[styles.expenseDot, { color: theme.colors.textSecondary }]}>•</Text>
                <Text style={[styles.expenseTime, { color: theme.colors.textSecondary }]}>
                  {expense.date.toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.expenseRight}>
            <View style={[
              styles.categoryBadge,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
            ]}>
              <Text style={[styles.categoryText, { color: theme.colors.textSecondary }]}>
                {category}
              </Text>
            </View>
            <View style={styles.expenseActions}>
              <View style={styles.statusRow}>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: expense.isSettled ? '#10b981' : '#f59e0b' }
                ]} />
                {canSplit && !expense.isSettled && (
                  <TouchableOpacity 
                    style={[styles.splitButton, { backgroundColor: theme.colors.primary + '20' }]}
                    onPress={() => handleExpensePress(expense)}
                  >
                    <Text style={[styles.splitButtonText, { color: theme.colors.primary }]}>
                      Split
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
        
        {/* Split info if expense is split */}
        {expense.isSettled && (
          <View style={[styles.splitInfo, { backgroundColor: '#10b981' + '20' }]}>
            <View style={styles.splitInfoContent}>
              <Text style={[styles.splitInfoText, { color: '#10b981' }]}>
                Expense settled
              </Text>
              <Text style={[styles.splitInfoAmount, { color: '#059669' }]}>
                ✓ Completed
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSmartBanner = () => (
    <View style={[styles.smartBanner, { backgroundColor: theme.colors.primary }]}>
      <View style={styles.smartBannerContent}>
        <View style={[styles.smartBannerIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Ionicons name="location" size={20} color="white" />
        </View>
        <View style={styles.smartBannerText}>
          <Text style={styles.smartBannerTitle}>Smart Expense Tracking</Text>
          <Text style={styles.smartBannerSubtitle}>Auto-detect expenses from location & receipts</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.border }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              {title}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={[styles.headerActionButton, { backgroundColor: '#10b981' }]}>
                <Ionicons name="camera" size={18} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerActionButton, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="analytics" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* View Toggle */}
          {renderViewToggle()}
        </View>

        {/* Smart Banner */}
        {renderSmartBanner()}

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Recent Expenses</Text>
          <View style={styles.filterButtons}>
            {renderFilterButton('all', 'All')}
            {renderFilterButton('pending', 'Pending')}
            {renderFilterButton('settled', 'Settled')}
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading smart expenses...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {expenses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons 
                    name="receipt-outline" 
                    size={48} 
                    color={theme.colors.textSecondary} 
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  No Expenses Found
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                  {selectedFilter === 'all' 
                    ? 'Start tracking expenses with smart detection!'
                    : `No ${selectedFilter} expenses found.`
                  }
                </Text>
              </View>
            ) : (
              <View style={styles.expensesList}>
                <View style={styles.expensesHeader}>
                  <View style={styles.expensesCounter}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.expensesCounterText, { color: theme.colors.textSecondary }]}>
                      Auto-tracked
                    </Text>
                  </View>
                </View>
                {expenses.map(renderExpenseCard)}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  smartBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  smartBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smartBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartBannerText: {
    flex: 1,
  },
  smartBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  smartBannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  filterLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    minWidth: 80,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  expensesList: {
    padding: 16,
    gap: 16,
  },
  expensesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expensesCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expensesCounterText: {
    fontSize: 14,
  },
  expenseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  expenseIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseIconText: {
    fontSize: 24,
    color: 'white',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseSubtitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expenseLocation: {
    fontSize: 12,
  },
  expenseDot: {
    fontSize: 12,
  },
  expenseTime: {
    fontSize: 12,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  expenseActions: {
    alignItems: 'flex-end',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  splitButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  splitButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  splitInfo: {
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
  },
  splitInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  splitInfoAmount: {
    fontSize: 14,
    fontWeight: '600',
    },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});
