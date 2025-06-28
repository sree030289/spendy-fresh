import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
// Using Ionicons instead of Lucide icons to avoid SVG compatibility issues
import { LineChart, PieChart as RNPieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// Import your services
import { FirebaseNotificationService } from '@/services/smartMoney/firebaseNotificationService';
import { AnalyticsService } from '@/services/smartMoney/analyticsService';
import { DataService } from '@/services/smartMoney/dataService';
import { Analytics, Expense, Income, Reminder, ExpenseCategory, IncomeCategory, ReminderCategory } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TabButtonProps {
  title: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ title, icon, isActive, onPress, isFirst, isLast }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.segment,
        isActive && [styles.activeSegment, { backgroundColor: theme.colors.primary }],
        isFirst && styles.firstSegment,
        isLast && styles.lastSegment,
      ]}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={isActive ? 'white' : theme.colors.textSecondary}
      />
      <Text style={[
        styles.segmentText,
        { color: isActive ? 'white' : theme.colors.textSecondary }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const SmartMoneyScreen: React.FC = () => {
  const { user = null } = useAuth() || {};
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<'expense' | 'income' | 'reminder'>('expense');
  const [gmailConnected, setGmailConnected] = useState(false);
  
  // Define tabs configuration for the segmented control
  const tabs = [
    { id: 'overview', title: 'Overview', icon: 'analytics-outline' },
    { id: 'transactions', title: 'Transactions', icon: 'card-outline' },
    { id: 'reminders', title: 'Reminders', icon: 'calendar-outline' },
  ];

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'dueDate'>('date');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const categories = {
    expense: ['Housing', 'Transportation', 'Food', 'Utilities', 'Healthcare', 'Entertainment', 'Shopping', 'Education', 'Insurance', 'Loans', 'Other'] as ExpenseCategory[],
    income: ['Salary', 'Freelance', 'Investment', 'Business', 'Rental', 'Gift', 'Other'] as IncomeCategory[],
    reminder: ['Bills', 'Subscriptions', 'Insurance', 'Loans', 'Taxes', 'Rent', 'Utilities', 'Other'] as ReminderCategory[]
  };

  useEffect(() => {
    initializeApp();
  }, [user?.id]);

  const initializeApp = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Initialize notification service
      const notificationService = FirebaseNotificationService.getInstance();
      await notificationService.initialize();
      
      // Load real data from Firebase - no demo data
      await loadData();
      
    } catch (error) {
      console.error('Failed to initialize Smart Money:', error);
      Alert.alert('Error', 'Failed to initialize Smart Money features');
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    if (!user?.id) return;
    
    try {
      const dataService = DataService.getInstance();
      
      // Load real data from Firebase/storage
      const [expensesData, incomeData, remindersData] = await Promise.all([
        dataService.getExpenses(),
        dataService.getIncome(),
        dataService.getReminders()
      ]);
      
      console.log('📊 Loaded data:', {
        expenses: expensesData.length,
        income: incomeData.length,
        reminders: remindersData.length
      });
      
      // Set the real data
      setExpenses(expensesData || []);
      setIncome(incomeData || []);
      setReminders(remindersData || []);
      
      // Generate analytics from real data
      const analyticsService = AnalyticsService.getInstance();
      if (expensesData.length > 0 || incomeData.length > 0) {
        const monthlyAnalytics = analyticsService.generateAnalytics(
          expensesData || [], 
          incomeData || [], 
          'monthly'
        );
        setAnalytics(monthlyAnalytics);
      } else {
        setAnalytics(null);
      }
      
    } catch (error) {
      console.error('Failed to load data:', error);
      // Set empty arrays on error
      setExpenses([]);
      setIncome([]);
      setReminders([]);
      setAnalytics(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const connectGmail = async () => {
    Alert.alert(
      'Gmail Integration',
      'Gmail integration requires web authentication. This feature will be available in a future update.',
      [{ text: 'OK' }]
    );
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
      const formattedDate = date.toISOString().split('T')[0];
      
      if (datePickerMode === 'date') {
        setFormData(prev => ({ ...prev, date: formattedDate }));
      } else {
        setFormData(prev => ({ ...prev, dueDate: formattedDate }));
      }
    }
  };
  
  const openDatePicker = (mode: 'date' | 'dueDate') => {
    setDatePickerMode(mode);
    if (mode === 'date') {
      setSelectedDate(new Date(formData.date));
    } else {
      setSelectedDate(new Date(formData.dueDate));
    }
    setShowDatePicker(true);
  };

  const handleAddItem = async () => {
    if (!formData.title || !formData.amount || !formData.category) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      const dataService = DataService.getInstance();
      
      let savedExpense: Expense | null = null;
      let savedIncome: Income | null = null;
      let savedReminder: Reminder | null = null;

      if (formType === 'expense') {
        const expense: Expense = {
          id: '', // Will be set by service
          title: formData.title,
          amount: parseFloat(formData.amount),
          category: formData.category as ExpenseCategory,
          date: formData.date,
          type: 'expense'
        };
        
        savedExpense = await dataService.saveExpense(expense);
        setExpenses(prev => [savedExpense!, ...prev]);
        
      } else if (formType === 'income') {
        const incomeItem: Income = {
          id: '', // Will be set by service
          title: formData.title,
          amount: parseFloat(formData.amount),
          category: formData.category as IncomeCategory,
          date: formData.date,
          type: 'income'
        };
        
        savedIncome = await dataService.saveIncome(incomeItem);
        setIncome(prev => [savedIncome!, ...prev]);
        
      } else if (formType === 'reminder') {
        const reminder: Reminder = {
          id: '', // Will be set by service
          title: formData.title,
          amount: parseFloat(formData.amount),
          dueDate: formData.dueDate,
          status: 'pending',
          category: formData.category as ReminderCategory,
          recurring: 'none',
          autoDetected: false,
          priority: 'medium'
        };
        
        savedReminder = await dataService.saveReminder(reminder);
        setReminders(prev => [savedReminder!, ...prev]);
      }

      // Reset form
      setFormData({
        title: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
      });
      setShowAddForm(false);
      
      // Refresh analytics with the newly saved item
      const analyticsService = AnalyticsService.getInstance();
      
      // Create updated arrays with the new item (since React state updates are async)
      const updatedExpenses = formType === 'expense' && savedExpense 
        ? [savedExpense, ...expenses]
        : expenses;
        
      const updatedIncome = formType === 'income' && savedIncome
        ? [savedIncome, ...income]
        : income;
      
      const newAnalytics = analyticsService.generateAnalytics(
        updatedExpenses,
        updatedIncome,
        'monthly'
      );
      setAnalytics(newAnalytics);

      Alert.alert('Success', `${formType.charAt(0).toUpperCase() + formType.slice(1)} added successfully!`);
      
    } catch (error) {
      console.error('Failed to add item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  };

  const deleteItem = async (id: string, type: 'expense' | 'income' | 'reminder') => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete this ${type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const dataService = DataService.getInstance();
              
              if (type === 'expense') {
                await dataService.deleteExpense(id);
                setExpenses(prev => prev.filter(e => e.id !== id));
              } else if (type === 'income') {
                await dataService.deleteIncome(id);
                setIncome(prev => prev.filter(i => i.id !== id));
              } else if (type === 'reminder') {
                await dataService.deleteReminder(id);
                setReminders(prev => prev.filter(r => r.id !== id));
              }
              
              // Refresh analytics
              const analyticsService = AnalyticsService.getInstance();
              const newAnalytics = analyticsService.generateAnalytics(expenses, income, 'monthly');
              setAnalytics(newAnalytics);
              
              Alert.alert('Success', `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);
              
            } catch (error) {
              console.error('Failed to delete item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  const markReminderPaid = async (id: string) => {
    try {
      const dataService = DataService.getInstance();
      const reminder = reminders.find(r => r.id === id);
      
      if (reminder) {
        const updatedReminder = { ...reminder, status: 'paid' as const };
        await dataService.updateReminder(updatedReminder);
        setReminders(prev => prev.map(r => r.id === id ? updatedReminder : r));
        Alert.alert('Success', 'Reminder marked as paid!');
      }
    } catch (error) {
      console.error('Failed to mark reminder as paid:', error);
      Alert.alert('Error', 'Failed to mark reminder as paid');
    }
  };

  const renderAnalyticsSection = () => {
    if (!analytics || (expenses.length === 0 && income.length === 0)) {
      return (
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Analytics</Text>
          <View style={styles.emptyAnalytics}>
            <Ionicons name="analytics-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyAnalyticsText, { color: theme.colors.text }]}>
              No data for analytics
            </Text>
            <Text style={[styles.emptyAnalyticsSubtext, { color: theme.colors.textSecondary }]}>
              Add some expenses and income to see insights
            </Text>
          </View>
        </View>
      );
    }

    const chartData = {
      datasets: [{
        data: analytics.categoryBreakdown.slice(0, 5).map(cat => cat.amount)
      }],
      labels: analytics.categoryBreakdown.slice(0, 5).map(cat => cat.category)
    };

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Analytics</Text>
        
        {/* Top Categories */}
        <View style={styles.analyticsContainer}>
          <Text style={[styles.analyticsSubtitle, { color: theme.colors.text }]}>Top Spending Categories</Text>
          {analytics.categoryBreakdown.slice(0, 3).map((category, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryInfo}>
                <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                  {category.category}
                </Text>
              </View>
              <View style={styles.categoryAmounts}>
                <Text style={[styles.categoryAmount, { color: theme.colors.text }]}>
                  ${category.amount.toFixed(2)}
                </Text>
                <Text style={[styles.categoryPercentage, { color: theme.colors.textSecondary }]}>
                  {category.percentage.toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Savings Rate */}
        <View style={styles.savingsContainer}>
          <Text style={[styles.analyticsSubtitle, { color: theme.colors.text }]}>Savings Rate</Text>
          <View style={styles.savingsDisplay}>
            <Text style={[styles.savingsPercentage, { 
              color: analytics.netFlow >= 0 ? theme.colors.success : theme.colors.error 
            }]}>
              {((analytics.netFlow / (analytics.totalIncome || 1)) * 100).toFixed(1)}%
            </Text>
            <Text style={[styles.savingsLabel, { color: theme.colors.textSecondary }]}>
              of income saved
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderOverview = () => {
    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const netFlow = totalIncome - totalExpenses;
    
    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Financial Summary Card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Your Balance</Text>
          </View>

          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                ${totalIncome.toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>Income</Text>
            </View>
            
            <View style={[styles.balanceItem, {
              borderLeftWidth: 1, 
              borderRightWidth: 1, 
              borderColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: 10
            }]}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                ${totalExpenses.toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>Expenses</Text>
            </View>
            
            <View style={styles.balanceItem}>
              <Text 
                style={[
                  styles.balanceAmount, 
                  { color: netFlow >= 0 ? '#FFD700' : '#FFA500' }
                ]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                {netFlow >= 0 ? '+' : ''} ${Math.abs(netFlow).toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>Net Balance</Text>
            </View>
          </View>
          
          <Text style={styles.balanceSubtext}>Your balance summary</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                setFormType('expense');
                setShowAddForm(true);
              }}
            >
              <Ionicons name="remove-circle-outline" size={24} color={theme.colors.error} />
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Add Expense</Text>
              <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
                Track spending
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                setFormType('income');
                setShowAddForm(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={24} color={theme.colors.success} />
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Add Income</Text>
              <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
                Record earnings
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                setFormType('reminder');
                setShowAddForm(true);
              }}
            >
              <Ionicons name="calendar-outline" size={24} color={theme.colors.warning} />
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Add Reminder</Text>
              <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
                Set alerts
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
              onPress={connectGmail}
              disabled={gmailConnected}
            >
              <Ionicons name="mail-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>
                {gmailConnected ? 'Gmail Connected' : 'Connect Gmail'}
              </Text>
              <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
                Import bills
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Analytics Section */}
        {renderAnalyticsSection()}

        {/* Upcoming Reminders */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upcoming This Week</Text>
            <TouchableOpacity style={styles.sectionLink} onPress={() => setActiveTab('reminders')}>
              <Text style={{ color: theme.colors.primary }}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {reminders.filter(reminder => {
            const dueDate = new Date(reminder.dueDate);
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            return dueDate <= nextWeek && reminder.status === 'pending';
          }).length > 0 ? (
            reminders
              .filter(reminder => {
                const dueDate = new Date(reminder.dueDate);
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                return dueDate <= nextWeek && reminder.status === 'pending';
              })
              .slice(0, 3)
              .map(reminder => (
                <View key={reminder.id} style={[styles.card, styles.reminderCard]}>
                  <View style={styles.reminderContent}>
                    <View style={styles.reminderHeader}>
                      <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>
                        {reminder.title}
                      </Text>
                      {reminder.autoDetected && (
                        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.badgeText}>AI</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.reminderAmount, { color: theme.colors.text }]}>
                      ${reminder.amount.toFixed(2)}
                    </Text>
                    <Text style={[styles.reminderDate, { color: theme.colors.textSecondary }]}>
                      Due: {new Date(reminder.dueDate).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.markPaidButton}
                    onPress={() => markReminderPaid(reminder.id)}
                  >
                    <Ionicons name="checkmark-circle" color="#10B981" size={24} />
                  </TouchableOpacity>
                </View>
              ))
          ) : (
            <View style={[styles.card, styles.emptyStateContainer]}>
              <Ionicons name="calendar-outline" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                No upcoming reminders
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
                Add a reminder to see it here
              </Text>
              <TouchableOpacity 
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  marginTop: 16,
                }}
                onPress={() => {
                  setFormType('reminder');
                  setShowAddForm(true);
                }}
              >
                <Text style={{
                  color: 'white',
                  fontWeight: '500',
                  fontSize: 14,
                }}>Add Reminder</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderTransactions = () => (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Expenses */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trending-down" color="#EF4444" size={24} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Expenses</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: '#EF4444' }]}
            onPress={() => {
              setFormType('expense');
              setShowAddForm(true);
            }}
          >
            <Ionicons name="add" color="#FFFFFF" size={20} />
          </TouchableOpacity>
        </View>
        
        {expenses.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="trending-down" color="#D1D5DB" size={40} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No expenses yet</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              Track your spending by adding expenses
            </Text>
          </View>
        ) : (
          expenses.slice(0, 5).map(expense => (
            <View key={expense.id} style={[styles.transactionCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.transactionContent}>
                <Text style={[styles.transactionTitle, { color: theme.colors.text }]}>{expense.title}</Text>
                <Text style={[styles.transactionCategory, { color: theme.colors.textSecondary }]}>
                  {expense.category} • {new Date(expense.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.transactionActions}>
                <Text style={[styles.transactionAmount, { color: '#EF4444' }]}>
                  -${expense.amount.toFixed(2)}
                </Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteItem(expense.id, 'expense')}
                >
                  <Ionicons name="trash-outline" color="#EF4444" size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Income */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trending-up" color="#10B981" size={24} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Income</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: '#10B981' }]}
            onPress={() => {
              setFormType('income');
              setShowAddForm(true);
            }}
          >
            <Ionicons name="add" color="#FFFFFF" size={20} />
          </TouchableOpacity>
        </View>
        
        {income.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="trending-up" color="#D1D5DB" size={40} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No income yet</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              Add income sources to track your earnings
            </Text>
          </View>
        ) : (
          income.slice(0, 5).map(incomeItem => (
            <View key={incomeItem.id} style={[styles.transactionCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.transactionContent}>
                <Text style={[styles.transactionTitle, { color: theme.colors.text }]}>{incomeItem.title}</Text>
                <Text style={[styles.transactionCategory, { color: theme.colors.textSecondary }]}>
                  {incomeItem.category} • {new Date(incomeItem.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.transactionActions}>
                <Text style={[styles.transactionAmount, { color: '#10B981' }]}>
                  +${incomeItem.amount.toFixed(2)}
                </Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteItem(incomeItem.id, 'income')}
                >
                  <Ionicons name="trash-outline" color="#EF4444" size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderReminders = () => (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Gmail Connection */}
      {!gmailConnected && (
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.gmailCard}
        >
          <View style={styles.gmailContent}>
            <Ionicons name="mail" color="#FFFFFF" size={24} />
            <View style={styles.gmailText}>
              <Text style={styles.gmailTitle}>Connect Gmail for Smart Reminders</Text>
              <Text style={styles.gmailSubtitle}>AI will scan your emails for bills</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.gmailButton} onPress={connectGmail}>
            <Text style={styles.gmailButtonText}>Connect</Text>
          </TouchableOpacity>
        </LinearGradient>
      )}

      {/* Reminders List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications" color="#3B82F6" size={24} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Payment Reminders</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => {
              setFormType('reminder');
              setShowAddForm(true);
            }}
          >
            <Ionicons name="add" color="#FFFFFF" size={20} />
          </TouchableOpacity>
        </View>
        
        {reminders.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="notifications" color="#D1D5DB" size={40} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No payment reminders</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              Stay on top of your bills by adding reminders
            </Text>
          </View>
        ) : (
          reminders.slice(0, 10).map(reminder => (
            <View
              key={reminder.id}
              style={[
                styles.reminderCard,
                { backgroundColor: theme.colors.surface },
                reminder.status === 'paid' && styles.paidReminderCard,
                new Date(reminder.dueDate) < new Date() && reminder.status === 'pending' && styles.overdueReminderCard
              ]}
            >
              <View style={styles.reminderContent}>
                <View style={styles.reminderHeader}>
                  <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>{reminder.title}</Text>
                  <View style={styles.reminderBadges}>
                    {reminder.autoDetected && (
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    )}
                    {reminder.status === 'paid' && (
                      <Ionicons name="checkmark-circle" color="#10B981" size={16} />
                    )}
                    {new Date(reminder.dueDate) < new Date() && reminder.status === 'pending' && (
                      <Ionicons name="alert-circle" color="#EF4444" size={16} />
                    )}
                  </View>
                </View>
                <Text style={[styles.reminderAmount, { color: theme.colors.text }]}>
                  ${reminder.amount.toFixed(2)}
                </Text>
                <Text style={[styles.reminderDetails, { color: theme.colors.textSecondary }]}>
                  {reminder.category} • Due: {new Date(reminder.dueDate).toLocaleDateString()} • {reminder.recurring || 'One-time'}
                </Text>
              </View>
              
              <View style={styles.reminderActions}>
                {reminder.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.markPaidButton}
                    onPress={() => markReminderPaid(reminder.id)}
                  >
                    <Ionicons name="checkmark-circle" color="#10B981" size={24} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteItem(reminder.id, 'reminder')}
                >
                  <Ionicons name="trash-outline" color="#EF4444" size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderAddForm = () => (
    <Modal visible={showAddForm} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingContainer}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  Add {formType.charAt(0).toUpperCase() + formType.slice(1)}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    // Reset form when closing
                    setFormData({
                      title: '',
                      amount: '',
                      category: '',
                      date: new Date().toISOString().split('T')[0],
                      dueDate: new Date().toISOString().split('T')[0],
                    });
                    setShowAddForm(false);
                  }}
                >
                  <Ionicons name="close" color={theme.colors.textSecondary} size={24} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Title *</Text>
                  <TextInput
                    style={[styles.textInput, { 
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      color: theme.colors.text
                    }]}
                    value={formData.title}
                    onChangeText={(text) => setFormData({ ...formData, title: text })}
                    placeholder="Enter title"
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="sentences"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Amount *</Text>
                  <View style={[styles.amountInputContainer, { 
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border
                  }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>$</Text>
                    <TextInput
                      style={[styles.amountInput, { color: theme.colors.text }]}
                      value={formData.amount}
                      onChangeText={(text) => setFormData({ ...formData, amount: text.replace(/[^0-9.]/g, '') })}
                      placeholder="0.00"
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Category *</Text>
                  <View style={styles.categoryGrid}>
                    {categories[formType].map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryOption,
                          { 
                            backgroundColor: formData.category === category ? theme.colors.primary : theme.colors.background,
                            borderColor: formData.category === category ? theme.colors.primary : theme.colors.border
                          }
                        ]}
                        onPress={() => setFormData({ ...formData, category })}
                      >
                        <Text
                          style={[
                            styles.categoryOptionText,
                            { 
                              color: formData.category === category ? 'white' : theme.colors.text
                            }
                          ]}
                        >
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {formType === 'reminder' ? (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Due Date *</Text>
                    <TouchableOpacity 
                      style={[styles.datePickerButton, { 
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}
                      onPress={() => openDatePicker('dueDate')}
                    >
                      <Text style={[styles.dateText, { color: theme.colors.text }]}>
                        {new Date(formData.dueDate).toLocaleDateString()}
                      </Text>
                      <Ionicons name="calendar-outline" color={theme.colors.textSecondary} size={20} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Date *</Text>
                    <TouchableOpacity 
                      style={[styles.datePickerButton, { 
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border
                      }]}
                      onPress={() => openDatePicker('date')}
                    >
                      <Text style={[styles.dateText, { color: theme.colors.text }]}>
                        {new Date(formData.date).toLocaleDateString()}
                      </Text>
                      <Ionicons name="calendar-outline" color={theme.colors.textSecondary} size={20} />
                    </TouchableOpacity>
                  </View>
                )}
                
                {showDatePicker && (
                  <DateTimePicker
                    testID="dateTimePicker"
                    value={selectedDate}
                    mode="date"
                    is24Hour={true}
                    display="default"
                    onChange={handleDateChange}
                    style={{marginTop: 10}}
                  />
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.colors.background }]}
                  onPress={() => setShowAddForm(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveButton, 
                    { backgroundColor: theme.colors.primary },
                    (!formData.title || !formData.amount || !formData.category) && styles.disabledButton
                  ]}
                  onPress={handleAddItem}
                  disabled={!formData.title || !formData.amount || !formData.category}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading Smart Money...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Fixed Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Smart Money</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              Track your finances
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerAction}
              onPress={connectGmail}
            >
              <Ionicons name="cloud-download" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerAction}
            >
              <Ionicons name="notifications" size={24} color={theme.colors.text} />
              {reminders.filter(r => r.status === 'pending').length > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                  <Text style={styles.notificationBadgeText}>
                    {reminders.filter(r => r.status === 'pending').length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabNavigation, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.segmentedControl, { backgroundColor: theme.colors.surface }]}>
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.segment,
                activeTab === tab.id && [styles.activeSegment, { backgroundColor: theme.colors.primary }],
                index === 0 && styles.firstSegment,
                index === tabs.length - 1 && styles.lastSegment,
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? 'white' : theme.colors.textSecondary}
              />
              <Text style={[
                styles.segmentText,
                { color: activeTab === tab.id ? 'white' : theme.colors.textSecondary }
              ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContainer}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'reminders' && renderReminders()}
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => {
          setFormType('expense');
          setShowAddForm(true);
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
      
      {renderAddForm()}
    </SafeAreaView>
  );
};

// Updated styles with improvements
const styles = StyleSheet.create({
  // Main Container Styles
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
  
  // Header Styles - Fixed alignment
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerAction: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Tab Navigation
  tabNavigation: {
    paddingVertical: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeSegment: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  firstSegment: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  lastSegment: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Content
  tabContainer: {
    flex: 1,
  },
  tabContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Balance Card
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceHeader: {
    marginBottom: 16,
  },
  balanceTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginVertical: 16,
  },
  balanceItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  balanceSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },

  // Sections
  section: {
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  sectionLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },

  // Analytics Styles
  analyticsContainer: {
    marginBottom: 16,
  },
  analyticsSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryAmounts: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryPercentage: {
    fontSize: 12,
    marginTop: 2,
  },
  savingsContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  savingsDisplay: {
    alignItems: 'center',
  },
  savingsPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  savingsLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyAnalytics: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyAnalyticsText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyAnalyticsSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },

  // Transaction Cards
  transactionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionContent: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 14,
  },
  transactionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Reminder Cards
  reminderCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidReminderCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
  },
  overdueReminderCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  reminderContent: {
    flex: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  reminderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reminderDate: {
    fontSize: 14,
  },
  reminderDetails: {
    fontSize: 14,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Buttons
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markPaidButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  // Badges
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  aiBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Empty States
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },

  // Gmail Card
  gmailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  gmailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gmailText: {
    marginLeft: 12,
    flex: 1,
  },
  gmailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  gmailSubtitle: {
    fontSize: 14,
    color: '#E0E7FF',
  },
  gmailButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gmailButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Modal Styles
  keyboardAvoidingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    width: screenWidth - 40,
    maxHeight: screenHeight * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    maxHeight: screenHeight * 0.5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    paddingLeft: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  dateText: {
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
    opacity: 0.7,
  },

  // Card base style
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default SmartMoneyScreen;