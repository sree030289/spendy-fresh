import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { SplittingService, Expense } from '@/services/firebase/splitting';
import ExpenseRefreshService from '@/services/expenseRefreshService';

export default function ExpensesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('all');

  useEffect(() => {
    loadExpenses();
  }, [user?.id]);

  useEffect(() => {
  const refreshService = ExpenseRefreshService.getInstance();
  const unsubscribe = refreshService.addListener(() => {
    console.log('Expenses screen received refresh notification');
    loadExpenses();
  });

  return unsubscribe;
}, []);

  const loadExpenses = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const userExpenses = await SplittingService.getUserExpenses(user.id, 100);
      setExpenses(userExpenses);
    } catch (error) {
      console.error('Load expenses error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  const filteredExpenses = expenses.filter(expense => {
    if (filter === 'pending') return !expense.isSettled;
    if (filter === 'settled') return expense.isSettled;
    return true;
  });

  const renderExpenseItem = (expense: Expense) => (
    <TouchableOpacity
      key={expense.id}
      style={[styles.expenseCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => {
        // Navigate to expense details
      }}
    >
      <View style={styles.expenseHeader}>
        <View style={styles.expenseLeft}>
          <Text style={styles.expenseIcon}>{expense.categoryIcon}</Text>
          <View>
            <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
              {expense.description}
            </Text>
            <Text style={[styles.expenseSubtitle, { color: theme.colors.textSecondary }]}>
              {expense.date.toLocaleDateString()} • {expense.paidByData.fullName}
            </Text>
          </View>
        </View>
        <View style={styles.expenseRight}>
          <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
            ${expense.amount.toFixed(2)}
          </Text>
          <View style={[
            styles.expenseStatus,
            { backgroundColor: expense.isSettled ? theme.colors.success + '20' : theme.colors.error + '20' }
          ]}>
            <Text style={[
              styles.expenseStatusText,
              { color: expense.isSettled ? theme.colors.success : theme.colors.error }
            ]}>
              {expense.isSettled ? 'Settled' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.expenseDetails}>
        <Text style={[styles.expenseCategory, { color: theme.colors.textSecondary }]}>
          {expense.category} • {expense.splitData.length} people
        </Text>
        <Text style={[styles.expenseNotes, { color: theme.colors.textSecondary }]}>
          {expense.notes && `"${expense.notes}"`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading expenses...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Expenses</Text>
        <TouchableOpacity onPress={loadExpenses}>
          <Ionicons name="refresh" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: theme.colors.surface }]}>
        {[
          { key: 'all', label: 'All', count: expenses.length },
          { key: 'pending', label: 'Pending', count: expenses.filter(e => !e.isSettled).length },
          { key: 'settled', label: 'Settled', count: expenses.filter(e => e.isSettled).length }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              filter === tab.key && [styles.activeFilterTab, { backgroundColor: theme.colors.primary }]
            ]}
            onPress={() => setFilter(tab.key as any)}
          >
            <Text style={[
              styles.filterTabText,
              { color: filter === tab.key ? 'white' : theme.colors.textSecondary }
            ]}>
              {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Expenses List */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredExpenses.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="receipt-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {filter === 'all' ? 'No expenses yet' : 
               filter === 'pending' ? 'No pending expenses' : 'No settled expenses'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              {filter === 'all' ? 'Start tracking expenses with your groups' :
               filter === 'pending' ? 'All your expenses are settled!' : 'No settled expenses to show'}
            </Text>
          </View>
        ) : (
          filteredExpenses.map(renderExpenseItem)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeFilterTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  expenseCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  expenseTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseSubtitle: {
    fontSize: 14,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  expenseStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  expenseStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expenseDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  expenseCategory: {
    fontSize: 14,
    marginBottom: 4,
  },
  expenseNotes: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    borderRadius: 16,
    marginTop: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});