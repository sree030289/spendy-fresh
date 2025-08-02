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
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

// Import services
import { AnalyticsService } from '@/services/smartMoney/analyticsService';
import { DataService } from '@/services/smartMoney/dataService';
import { MigrationService } from '@/services/smartMoney/migrationService';
import { FirebaseNotificationService } from '@/services/smartMoney/firebaseNotificationService';
import { Analytics, Expense, Income, Reminder, ExpenseCategory, IncomeCategory, ReminderCategory } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Main Component
const SmartMoneyScreen: React.FC = () => {
  const { user = null } = useAuth() || {};
  const { theme } = useTheme();

  // State Management
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // UI State
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<'expense' | 'income' | 'reminder'>('expense');
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllReminders, setShowAllReminders] = useState(false);
  
  // Form Data
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    description: '',
    place: '',
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'dueDate'>('date');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Categories
  const categories = {
    expense: ['Housing', 'Transportation', 'Food', 'Utilities', 'Healthcare', 'Entertainment', 'Shopping', 'Education', 'Insurance', 'Loans', 'Other'] as ExpenseCategory[],
    income: ['Salary', 'Freelance', 'Investment', 'Business', 'Rental', 'Gift', 'Other'] as IncomeCategory[],
    reminder: ['Bills', 'Subscriptions', 'Insurance', 'Loans', 'Taxes', 'Rent', 'Utilities', 'Other'] as ReminderCategory[]
  };

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Initialize Component
  useEffect(() => {
    initializeApp();
    startAnimations();
  }, [user?.id]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const initializeApp = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Check if migration is needed
      const migrationService = MigrationService.getInstance();
      const needsMigration = await migrationService.isMigrationNeeded(user.id);
      
      if (needsMigration) {
        console.log('🔄 Migration needed for user:', user.id);
        const migrationSuccess = await migrationService.migrateToUserSpecificData(user.id);
        if (migrationSuccess) {
          console.log('✅ Migration completed successfully');
        }
      }

      // Initialize notification service
      const notificationService = FirebaseNotificationService.getInstance();
      await notificationService.initialize();
      await notificationService.scheduleDailyExpenseReminder();
      await notificationService.scheduleWeeklyAnalytics();
      
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
      
      const [expensesData, incomeData, remindersData] = await Promise.all([
        dataService.getExpenses(user.id),
        dataService.getIncome(user.id),
        dataService.getReminders(user.id)
      ]);
      
      setExpenses(expensesData || []);
      setIncome(incomeData || []);
      setReminders(remindersData || []);
      
      // Generate analytics
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

  // Date handling
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

  // Add item handler
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
      
      if (formType === 'expense') {
        const expense: Expense = {
          id: '',
          title: formData.title,
          amount: parseFloat(formData.amount),
          category: formData.category as ExpenseCategory,
          date: formData.date,
          type: 'expense',
          description: formData.description,
        };
        
        const savedExpense = await dataService.saveExpense(expense, user.id);
        setExpenses(prev => [savedExpense!, ...prev]);
        
      } else if (formType === 'income') {
        const incomeItem: Income = {
          id: '',
          title: formData.title,
          amount: parseFloat(formData.amount),
          category: formData.category as IncomeCategory,
          date: formData.date,
          type: 'income'
        };
        
        const savedIncome = await dataService.saveIncome(incomeItem, user.id);
        setIncome(prev => [savedIncome!, ...prev]);
        
      } else if (formType === 'reminder') {
        const reminder: Reminder = {
          id: '',
          title: formData.title,
          amount: parseFloat(formData.amount),
          dueDate: formData.dueDate,
          status: 'pending',
          category: formData.category as ReminderCategory,
          recurring: 'none',
          autoDetected: false,
          priority: 'medium',
          description: formData.description
        };
        
        const savedReminder = await dataService.saveReminder(reminder, user.id);
        setReminders(prev => [savedReminder!, ...prev]);
      }

      // Reset form
      setFormData({
        title: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        description: '',
        place: '',
      });
      setShowAddForm(false);
      
      // Update analytics
      const analyticsService = AnalyticsService.getInstance();
      const newAnalytics = analyticsService.generateAnalytics(expenses, income, 'monthly');
      setAnalytics(newAnalytics);

      Alert.alert('Success', `${formType.charAt(0).toUpperCase() + formType.slice(1)} added successfully!`);
      
    } catch (error) {
      console.error('Failed to add item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    }
  };

  // Delete item handler
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
                await dataService.deleteExpense(id, user?.id);
                setExpenses(prev => prev.filter(e => e.id !== id));
              } else if (type === 'income') {
                await dataService.deleteIncome(id, user?.id);
                setIncome(prev => prev.filter(i => i.id !== id));
              } else if (type === 'reminder') {
                await dataService.deleteReminder(id, user?.id);
                setReminders(prev => prev.filter(r => r.id !== id));
              }
              
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

  // Mark reminder as paid
  const markReminderPaid = async (id: string) => {
    try {
      const dataService = DataService.getInstance();
      const reminder = reminders.find(r => r.id === id);
      
      if (reminder) {
        const updatedReminder = { ...reminder, status: 'paid' as const };
        await dataService.updateReminder(updatedReminder, user?.id);
        setReminders(prev => prev.map(r => r.id === id ? updatedReminder : r));
        Alert.alert('Success', 'Reminder marked as paid!');
      }
    } catch (error) {
      console.error('Failed to mark reminder as paid:', error);
      Alert.alert('Error', 'Failed to mark reminder as paid');
    }
  };

  // Render Financial Overview Card
  const renderFinancialOverview = () => {
    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const netFlow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryDark]}
          style={styles.financialOverviewCard}
        >
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Smart Money Tracker</Text>
            <Text style={styles.overviewSubtitle}>Family Financial Health</Text>
          </View>

          <View style={styles.overviewStats}>
            <View style={styles.statItem}>
              <Text style={styles.statAmount}>${totalIncome.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Income</Text>
              <Ionicons name="arrow-up" size={16} color="#4ADE80" />
            </View>
            
            <View style={[styles.statItem, styles.statItemBorder]}>
              <Text style={styles.statAmount}>${totalExpenses.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Expenses</Text>
              <Ionicons name="arrow-down" size={16} color="#F87171" />
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statAmount, { color: netFlow >= 0 ? '#4ADE80' : '#F87171' }]}>
                ${Math.abs(netFlow).toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Net Flow</Text>
              <Text style={[styles.savingsRate, { color: savingsRate >= 20 ? '#4ADE80' : '#FBB040' }]}>
                {savingsRate.toFixed(1)}% Savings Rate
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  // Render Quick Actions
  const renderQuickActions = () => {
    const actions = [
      {
        title: 'Add Expense',
        icon: 'remove-circle',
        color: '#EF4444',
        type: 'expense' as const,
        description: 'Track daily spending'
      },
      {
        title: 'Add Income',
        icon: 'add-circle',
        color: '#10B981',
        type: 'income' as const,
        description: 'Record earnings'
      },
      {
        title: 'Set Reminder',
        icon: 'notifications',
        color: '#F59E0B',
        type: 'reminder' as const,
        description: 'Bill & payment alerts'
      },
      {
        title: 'View Calendar',
        icon: 'calendar',
        color: '#8B5CF6',
        type: 'calendar' as const,
        description: 'Monthly overview'
      },
    ];

    return (
      <View style={styles.quickActionsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={action.type}
              style={[styles.quickActionCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                if (action.type === 'calendar') {
                  setShowCalendarView(true);
                } else {
                  setFormType(action.type);
                  setShowAddForm(true);
                }
              }}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: action.color }]}>
                <Ionicons name={action.icon as any} size={24} color="white" />
              </View>
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>{action.title}</Text>
              <Text style={[styles.actionDescription, { color: theme.colors.textSecondary }]}>
                {action.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Render Recent Transactions
  const renderRecentTransactions = () => {
    const recentTransactions = [...expenses, ...income]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => setShowAllTransactions(true)}>
            <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
              No transactions yet
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              Add your first expense or income to get started
            </Text>
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {recentTransactions.map((transaction, index) => (
              <TouchableOpacity
                key={`${transaction.type}-${transaction.id}`}
                style={[styles.transactionItem, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  Alert.alert(
                    transaction.title,
                    `Amount: $${transaction.amount.toFixed(2)}\nCategory: ${transaction.category}\nDate: ${new Date(transaction.date).toLocaleDateString()}`,
                    [
                      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(transaction.id, transaction.type) },
                      { text: 'Cancel', style: 'cancel' }
                    ]
                  );
                }}
              >
                <View style={[styles.transactionIcon, { backgroundColor: getCategoryColor(transaction.category) }]}>
                  <Text style={styles.transactionEmoji}>{getCategoryEmoji(transaction.category)}</Text>
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={[styles.transactionTitle, { color: theme.colors.text }]}>{transaction.title}</Text>
                  <Text style={[styles.transactionCategory, { color: theme.colors.textSecondary }]}>
                    {transaction.category} • {new Date(transaction.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount, 
                  { color: transaction.type === 'income' ? theme.colors.success : theme.colors.error }
                ]}>
                  {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Render Upcoming Reminders
  const renderUpcomingReminders = () => {
    const upcomingReminders = reminders
      .filter(r => r.status === 'pending')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3);

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upcoming Bills</Text>
          <TouchableOpacity onPress={() => setShowAllReminders(true)}>
            <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {upcomingReminders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
              No upcoming bills
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              Add reminders to stay on top of payments
            </Text>
          </View>
        ) : (
          <View style={styles.remindersList}>
            {upcomingReminders.map((reminder) => {
              const dueDate = new Date(reminder.dueDate);
              const today = new Date();
              const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isOverdue = daysDiff < 0;
              const isDueToday = daysDiff === 0;

              return (
                <View
                  key={reminder.id}
                  style={[
                    styles.reminderItem, 
                    { 
                      backgroundColor: theme.colors.surface,
                      borderLeftColor: isOverdue ? theme.colors.error : isDueToday ? theme.colors.warning : theme.colors.success
                    }
                  ]}
                >
                  <View style={styles.reminderContent}>
                    <Text style={[styles.reminderTitle, { color: theme.colors.text }]}>{reminder.title}</Text>
                    <Text style={[styles.reminderAmount, { color: theme.colors.text }]}>
                      ${reminder.amount.toFixed(2)}
                    </Text>
                    <Text style={[
                      styles.reminderDue, 
                      { 
                        color: isOverdue ? theme.colors.error : 
                               isDueToday ? theme.colors.warning : 
                               theme.colors.textSecondary 
                      }
                    ]}>
                      {isOverdue ? `Overdue by ${Math.abs(daysDiff)} days` :
                       isDueToday ? 'Due Today' :
                       `Due in ${daysDiff} days`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => markReminderPaid(reminder.id)}
                    style={[styles.markPaidButton, { backgroundColor: theme.colors.success }]}
                  >
                    <Ionicons name="checkmark" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  // Render Analytics Summary
  const renderAnalyticsSummary = () => {
    if (!analytics || (expenses.length === 0 && income.length === 0)) {
      return (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Financial Insights</Text>
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
              Not enough data for insights
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              Add more transactions to see AI analytics
            </Text>
          </View>
        </View>
      );
    }

    const topCategories = analytics.categoryBreakdown.slice(0, 3);
    const thisMonth = new Date().toLocaleDateString('en-US', { month: 'long' });

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>AI Insights</Text>
          <TouchableOpacity onPress={() => setShowAnalyticsModal(true)}>
            <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View Details</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.insightCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.insightHeader}>
            <Ionicons name="bulb" size={24} color={theme.colors.warning} />
            <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
              {thisMonth} Spending Analysis
            </Text>
          </View>
          
          <Text style={[styles.insightText, { color: theme.colors.textSecondary }]}>
            {analytics.netFlow >= 0 
              ? `Great job! You saved $${analytics.netFlow.toFixed(2)} this month. Your savings rate is ${((analytics.netFlow / analytics.totalIncome) * 100).toFixed(1)}%.`
              : `You're overspending by $${Math.abs(analytics.netFlow).toFixed(2)} this month. Consider reviewing your ${topCategories[0]?.category.toLowerCase()} expenses.`
            }
          </Text>

          {topCategories.length > 0 && (
            <View style={styles.topCategoriesContainer}>
              <Text style={[styles.categoriesTitle, { color: theme.colors.text }]}>Top Spending Categories:</Text>
              {topCategories.map((category, index) => (
                <View key={category.category} style={styles.categoryRow}>
                  <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  <Text style={[styles.categoryText, { color: theme.colors.text }]}>
                    {category.category}: ${category.amount.toFixed(2)} ({category.percentage.toFixed(1)}%)
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render Add Form Modal
  const renderAddForm = () => (
    <Modal visible={showAddForm} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  Add {formType.charAt(0).toUpperCase() + formType.slice(1)}
                </Text>
                <TouchableOpacity onPress={() => setShowAddForm(false)}>
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
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Amount *</Text>
                  <View style={[styles.amountContainer, { 
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
                        <Text style={[
                          styles.categoryOptionText,
                          { color: formData.category === category ? 'white' : theme.colors.text }
                        ]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description</Text>
                  <TextInput
                    style={[styles.textInput, { 
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      color: theme.colors.text
                    }]}
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    placeholder="Add details..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {formType !== 'reminder' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Place</Text>
                    <TextInput
                      style={[styles.textInput, { 
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        color: theme.colors.text
                      }]}
                      value={formData.place}
                      onChangeText={(text) => setFormData({ ...formData, place: text })}
                      placeholder="Where did this happen?"
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>
                )}

                {formType === 'reminder' ? (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Due Date *</Text>
                    <TouchableOpacity 
                      style={[styles.dateButton, { 
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
                      style={[styles.dateButton, { 
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
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
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
                  style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
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

  // Loading state
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

  // Main render
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Smart Money</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            AI-Powered Family Finance
          </Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <Ionicons name="person-circle" size={32} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {renderFinancialOverview()}
        {renderQuickActions()}
        {renderRecentTransactions()}
        {renderUpcomingReminders()}
        {renderAnalyticsSummary()}
        
        {/* Add some bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

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
      
      {/* Modals */}
      {renderAddForm()}
    </SafeAreaView>
  );
};

// Helper functions
const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    'Housing': '#FF6B6B',
    'Transportation': '#4ECDC4',
    'Food': '#45B7D1',
    'Utilities': '#96CEB4',
    'Healthcare': '#FFEAA7',
    'Entertainment': '#DDA0DD',
    'Shopping': '#98D8C8',
    'Education': '#F7DC6F',
    'Insurance': '#BB8FCE',
    'Loans': '#F1948A',
    'Salary': '#10B981',
    'Freelance': '#059669',
    'Investment': '#065F46',
    'Business': '#047857',
    'Rental': '#0D9488',
    'Gift': '#14B8A6',
    'Other': '#85C1E9'
  };
  return colors[category] || '#95A5A6';
};

const getCategoryEmoji = (category: string): string => {
  const emojis: Record<string, string> = {
    'Housing': '🏠',
    'Transportation': '🚗',
    'Food': '🍽️',
    'Utilities': '💡',
    'Healthcare': '🏥',
    'Entertainment': '🎬',
    'Shopping': '🛍️',
    'Education': '📚',
    'Insurance': '🛡️',
    'Loans': '💳',
    'Salary': '💰',
    'Freelance': '💻',
    'Investment': '📈',
    'Business': '🏢',
    'Rental': '🏘️',
    'Gift': '🎁',
    'Other': '📊'
  };
  return emojis[category] || '📊';
};

// Styles
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
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Financial Overview
  financialOverviewCard: {
    borderRadius: 20,
    padding: 24,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  overviewHeader: {
    marginBottom: 20,
  },
  overviewTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  overviewSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statAmount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  savingsRate: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Quick Actions
  quickActionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Sections
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty States
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Transactions
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionEmoji: {
    fontSize: 20,
  },
  transactionDetails: {
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
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Reminders
  remindersList: {
    gap: 12,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reminderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reminderDue: {
    fontSize: 14,
    fontWeight: '500',
  },
  markPaidButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Insights
  insightCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  topCategoriesContainer: {
    marginTop: 8,
  },
  categoriesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 13,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },

  // Modal Styles
  modalContainer: {
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
  amountContainer: {
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
  dateButton: {
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
    color: 'white',
  },
});

export default function SmartMoneyApp() {
  return <SmartMoneyScreen />;
}