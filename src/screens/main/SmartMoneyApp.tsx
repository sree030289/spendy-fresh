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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

// Import your services
import BudgetPlanSection from '@/components/budget/BudgetPlanSection';
import { AnalyticsService } from '@/services/smartMoney/analyticsService';
import { DataService } from '@/services/smartMoney/dataService';
import { MigrationService } from '@/services/smartMoney/migrationService';
import { FirebaseNotificationService } from '@/services/smartMoney/firebaseNotificationService';
import { Analytics, Expense, Income, Reminder, ExpenseCategory, IncomeCategory, ReminderCategory } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import TransactionListModal from '@/components/modals/TransactionListModal';
import SmartMoneyCalendarModal from '@/components/modals/SmartMoneyCalendarModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Placeholder for SimpleExpenseListModal until it's properly implemented
const SimpleExpenseListModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  onExpensePress: (expense: Expense) => void;
}> = ({ visible, onClose, title, onExpensePress }) => {
  const { theme } = useTheme();
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.fullScreenModal, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.fullScreenHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.fullScreenTitle, { color: theme.colors.text }]}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.calendarContent}>
          <Text style={[styles.comingSoonText, { color: theme.colors.textSecondary }]}>
            Full Expense List - Coming Soon
          </Text>
          <Text style={[styles.comingSoonSubtext, { color: theme.colors.textSecondary }]}>
            This will show a complete expense list with advanced filtering capabilities
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

interface TabButtonProps {
  title: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ title, icon, isActive, onPress }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.segment,
        isActive && [styles.activeSegment, { backgroundColor: theme.colors.primary }],
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

// Enhanced Recent Transactions View Component - Card Rows Layout
const RecentTransactionsView: React.FC<{
  expenses: Expense[];
  theme: any;
  onViewAll: () => void;
  onExpensePress: (expense: Expense) => void;
}> = ({ expenses, theme, onViewAll, onExpensePress }) => {
  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Transactions</Text>
        <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
          <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      
      {expenses.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="card-outline" size={40} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            No transactions yet
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
            Add your first expense to get started
          </Text>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          style={styles.transactionCardsList}
        >
          {expenses.slice(0, 5).map((expense, index) => (
            <TouchableOpacity
              key={expense.id}
              style={[styles.transactionCardRow, { backgroundColor: theme.colors.background }]}
              onPress={() => onExpensePress(expense)}
              activeOpacity={0.7}
            >
              {/* Left: Category Icon */}
              <View style={[styles.categoryIconContainer, { backgroundColor: getCategoryColor(expense.category) }]}>
                <Text style={styles.categoryIconText}>
                  {getCategoryEmoji(expense.category)}
                </Text>
              </View>

              {/* Center: Transaction Details */}
              <View style={styles.transactionCardDetails}>
                <Text style={[styles.transactionCardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {expense.title}
                </Text>
                <View style={styles.transactionCardMeta}>
                  <Text style={[styles.transactionCardCategory, { color: theme.colors.textSecondary }]}>
                    {expense.category}
                  </Text>
                  <Text style={[styles.metaSeparator, { color: theme.colors.textSecondary }]}>•</Text>
                  <Text style={[styles.transactionCardDate, { color: theme.colors.textSecondary }]}>
                    {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </View>

              {/* Right: Amount */}
              <View style={styles.transactionCardAmount}>
                <Text style={[styles.transactionCardAmountText, { color: theme.colors.error }]}>
                  -${expense.amount.toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// Enhanced Upcoming Reminders View Component - Card Rows Layout
const UpcomingRemindersView: React.FC<{
  reminders: Reminder[];
  theme: any;
  onViewAll: () => void;
  onReminderPress: (reminder: Reminder) => void;
  onMarkPaid: (id: string) => void;
}> = ({ reminders, theme, onViewAll, onReminderPress, onMarkPaid }) => {
  const upcomingReminders = reminders
    .filter(r => r.status === 'pending')
    .slice(0, 5);

  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upcoming Reminders</Text>
        <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
          <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      
      {upcomingReminders.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="calendar-outline" size={40} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            No upcoming reminders
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
            Add a reminder to stay on top of bills
          </Text>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          style={styles.reminderCardsList}
        >
          {upcomingReminders.map((reminder) => {
            const dueDate = new Date(reminder.dueDate);
            const today = new Date();
            const isOverdue = dueDate < today;
            const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <TouchableOpacity
                key={reminder.id}
                style={[
                  styles.reminderCardRow, 
                  { 
                    backgroundColor: theme.colors.background,
                    borderLeftColor: isOverdue ? theme.colors.error : theme.colors.warning,
                  }
                ]}
                onPress={() => onReminderPress(reminder)}
                activeOpacity={0.7}
              >
                {/* Left: Priority Icon */}
                <View style={[
                  styles.priorityIconContainer, 
                  { backgroundColor: isOverdue ? theme.colors.error : theme.colors.warning }
                ]}>
                  <Text style={styles.priorityIconText}>
                    {getReminderEmoji(reminder.category)}
                  </Text>
                </View>

                {/* Center: Reminder Details */}
                <View style={styles.reminderCardDetails}>
                  <Text style={[styles.reminderCardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {reminder.title}
                  </Text>
                  <View style={styles.reminderCardMeta}>
                    <Text style={[styles.reminderCardCategory, { color: theme.colors.textSecondary }]}>
                      {reminder.category}
                    </Text>
                    <Text style={[styles.metaSeparator, { color: theme.colors.textSecondary }]}>•</Text>
                    <Text style={[
                      styles.reminderCardDue, 
                      { 
                        color: isOverdue ? theme.colors.error : 
                               daysDiff <= 1 ? theme.colors.warning : 
                               theme.colors.textSecondary 
                      }
                    ]}>
                      {isOverdue ? 'Overdue' : 
                       daysDiff === 0 ? 'Due Today' : 
                       daysDiff === 1 ? 'Due Tomorrow' : 
                       `${daysDiff} days`}
                    </Text>
                  </View>
                </View>

                {/* Right: Amount & Action */}
                <View style={styles.reminderCardRight}>
                  <Text style={[styles.reminderCardAmount, { color: theme.colors.text }]}>
                    ${reminder.amount.toFixed(2)}
                  </Text>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      onMarkPaid(reminder.id);
                    }}
                    style={styles.quickMarkPaidButton}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

// Full Screen Reminder List Modal Component
const FullScreenReminderModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  reminders: Reminder[];
  theme: any;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ visible, onClose, reminders, theme, onMarkPaid, onDelete }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const getRemindersForDate = (date: string) => {
    return reminders.filter(r => r.dueDate === date);
  };

  const renderReminderItem = (reminder: Reminder) => {
    const dueDate = new Date(reminder.dueDate);
    const today = new Date();
    const isOverdue = dueDate < today && reminder.status === 'pending';
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return (
      <View
        key={reminder.id}
        style={[
          styles.fullScreenReminderCard,
          { 
            backgroundColor: theme.colors.surface,
            borderLeftColor: isOverdue ? theme.colors.error : 
                            reminder.status === 'paid' ? theme.colors.success :
                            theme.colors.warning,
          }
        ]}
      >
        <View style={styles.fullScreenReminderHeader}>
          <View style={[
            styles.fullScreenReminderIcon,
            { 
              backgroundColor: isOverdue ? theme.colors.error : 
                              reminder.status === 'paid' ? theme.colors.success :
                              theme.colors.warning 
            }
          ]}>
            <Text style={styles.fullScreenReminderIconText}>
              {getReminderEmoji(reminder.category)}
            </Text>
          </View>
          
          <View style={styles.fullScreenReminderContent}>
            <Text style={[styles.fullScreenReminderTitle, { color: theme.colors.text }]}>
              {reminder.title}
            </Text>
            <Text style={[styles.fullScreenReminderAmount, { color: theme.colors.text }]}>
              ${reminder.amount.toFixed(2)}
            </Text>
            <View style={styles.fullScreenReminderMeta}>
              <Text style={[styles.fullScreenReminderCategory, { color: theme.colors.textSecondary }]}>
                {reminder.category}
              </Text>
              <Text style={[styles.metaSeparator, { color: theme.colors.textSecondary }]}>•</Text>
              <Text style={[
                styles.fullScreenReminderStatus,
                { 
                  color: isOverdue ? theme.colors.error : 
                         reminder.status === 'paid' ? theme.colors.success :
                         daysDiff <= 1 ? theme.colors.warning : 
                         theme.colors.textSecondary 
                }
              ]}>
                {reminder.status === 'paid' ? 'Paid' :
                 isOverdue ? 'Overdue' : 
                 daysDiff === 0 ? 'Due Today' : 
                 daysDiff === 1 ? 'Due Tomorrow' : 
                 `Due in ${daysDiff} days`}
              </Text>
              <Text style={[styles.metaSeparator, { color: theme.colors.textSecondary }]}>•</Text>
              <Text style={[styles.fullScreenReminderDate, { color: theme.colors.textSecondary }]}>
                {new Date(reminder.dueDate).toLocaleDateString()}
              </Text>
            </View>
          </View>
          
          <View style={styles.fullScreenReminderActions}>
            {reminder.status === 'pending' && (
              <TouchableOpacity
                onPress={() => onMarkPaid(reminder.id)}
                style={[styles.fullScreenActionButton, { backgroundColor: theme.colors.success }]}
              >
                <Ionicons name="checkmark" size={16} color="white" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => onDelete(reminder.id)}
              style={[styles.fullScreenActionButton, { backgroundColor: theme.colors.error }]}
            >
              <Ionicons name="trash" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.fullScreenModal, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.fullScreenHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.fullScreenTitle, { color: theme.colors.text }]}>All Reminders</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* View Mode Selector */}
        <View style={[styles.viewModeSelector, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'list' && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setViewMode('list')}
          >
            <Text style={[
              styles.viewModeText,
              { color: viewMode === 'list' ? 'white' : theme.colors.textSecondary }
            ]}>
              List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'calendar' && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setViewMode('calendar')}
          >
            <Text style={[
              styles.viewModeText,
              { color: viewMode === 'calendar' ? 'white' : theme.colors.textSecondary }
            ]}>
              Calendar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.fullScreenContent}>
          {viewMode === 'list' ? (
            <View style={styles.fullScreenRemindersList}>
              {reminders.length === 0 ? (
                <View style={styles.fullScreenEmptyState}>
                  <Ionicons name="calendar-outline" size={64} color={theme.colors.textSecondary} />
                  <Text style={[styles.fullScreenEmptyTitle, { color: theme.colors.text }]}>
                    No reminders yet
                  </Text>
                  <Text style={[styles.fullScreenEmptySubtitle, { color: theme.colors.textSecondary }]}>
                    Add your first reminder to get started
                  </Text>
                </View>
              ) : (
                reminders
                  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                  .map(renderReminderItem)
              )}
            </View>
          ) : (
            <View style={styles.fullScreenCalendarView}>
              <Text style={[styles.comingSoonText, { color: theme.colors.textSecondary }]}>
                Calendar View - Coming Soon
              </Text>
              <Text style={[styles.comingSoonSubtext, { color: theme.colors.textSecondary }]}>
                This will show a full calendar with all your reminders marked by date
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// Full Screen Calendar Modal Component
const FullScreenCalendarModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  expenses: Expense[];
  reminders: Reminder[];
  theme: any;
}> = ({ visible, onClose, expenses, reminders, theme }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'year'>('month');

  const getItemsForDate = (date: string) => {
    const dateExpenses = expenses.filter(e => e.date === date);
    const dateReminders = reminders.filter(r => r.dueDate === date);
    return [...dateExpenses, ...dateReminders];
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.fullScreenModal, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.fullScreenHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.fullScreenTitle, { color: theme.colors.text }]}>Calendar View</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* View Mode Selector */}
        <View style={[styles.viewModeSelector, { backgroundColor: theme.colors.surface }]}>
          {['month', 'week', 'day', 'year'].map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.viewModeButton,
                viewMode === mode && { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setViewMode(mode as any)}
            >
              <Text style={[
                styles.viewModeText,
                { color: viewMode === mode ? 'white' : theme.colors.textSecondary }
              ]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calendar Content */}
        <ScrollView style={styles.calendarContent}>
          <Text style={[styles.comingSoonText, { color: theme.colors.textSecondary }]}>
            Full Calendar View - Coming Soon
          </Text>
          <Text style={[styles.comingSoonSubtext, { color: theme.colors.textSecondary }]}>
            This will show a complete calendar with monthly, weekly, daily, and yearly views
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const SmartMoneyScreen: React.FC = () => {
  const { user = null } = useAuth() || {};
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<'expense' | 'income' | 'reminder'>('expense');
  const [gmailConnected, setGmailConnected] = useState(false);
  
  // Modal states
  const [showExpenseListModal, setShowExpenseListModal] = useState(false);
  const [showReminderListModal, setShowReminderListModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showTransactionListModal, setShowTransactionListModal] = useState(false);
  
  // Updated tabs for Family Financial Management System
  const tabs = [
    { id: 'dashboard', title: 'Dashboard', icon: 'home-outline' },
    { id: 'analytics', title: 'Analytics', icon: 'analytics-outline' },
    { id: 'transactions', title: 'Transactions', icon: 'card-outline' },
    { id: 'budget', title: 'Budget', icon: 'wallet-outline' }
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
      // Check if migration is needed for this user
      const migrationService = MigrationService.getInstance();
      const needsMigration = await migrationService.isMigrationNeeded(user.id);
      
      if (needsMigration) {
        console.log('🔄 Migration needed for user:', user.id);
        const migrationSuccess = await migrationService.migrateToUserSpecificData(user.id);
        if (migrationSuccess) {
          console.log('✅ Migration completed successfully');
        } else {
          console.log('⚠️ Migration failed, but continuing with app initialization');
        }
      }

      const notificationService = FirebaseNotificationService.getInstance();
      await notificationService.initialize();
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
          id: '',
          title: formData.title,
          amount: parseFloat(formData.amount),
          category: formData.category as ExpenseCategory,
          date: formData.date,
          type: 'expense'
        };
        
        savedExpense = await dataService.saveExpense(expense, user.id);
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
        
        savedIncome = await dataService.saveIncome(incomeItem, user.id);
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
          priority: 'medium'
        };
        
        savedReminder = await dataService.saveReminder(reminder, user.id);
        setReminders(prev => [savedReminder!, ...prev]);
      }

      setFormData({
        title: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
      });
      setShowAddForm(false);
      
      const analyticsService = AnalyticsService.getInstance();
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
                await dataService.deleteExpense(id, user?.id);
                setExpenses(prev => prev.filter(e => e.id !== id));
              } else if (type === 'income') {
                await dataService.deleteIncome(id, user?.id);
                setIncome(prev => prev.filter(i => i.id !== id));
              } else if (type === 'reminder') {
                await dataService.deleteReminder(id, user?.id);
                setReminders(prev => prev.filter(r => r.id !== id));
              }
              
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
        await dataService.updateReminder(updatedReminder, user?.id);
        setReminders(prev => prev.map(r => r.id === id ? updatedReminder : r));
        Alert.alert('Success', 'Reminder marked as paid!');
      }
    } catch (error) {
      console.error('Failed to mark reminder as paid:', error);
      Alert.alert('Error', 'Failed to mark reminder as paid');
    }
  };

  // Alias for markReminderPaid for compatibility
  const markReminderAsPaid = markReminderPaid;

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

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Analytics</Text>
        
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

  const renderDashboard = () => {
    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const netFlow = totalIncome - totalExpenses;
    
    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Family Financial Overview Card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Family Financial Overview</Text>
            <Text style={[styles.balanceSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              Current Month
            </Text>
          </View>

          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                ${totalIncome.toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>Total Income</Text>
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
              <Text style={styles.balanceLabel}>Total Expenses</Text>
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
        </View>

        {/* Quick Actions for Family Management */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Family Financial Actions</Text>
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
                Track family spending
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
                Record family income
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                setFormType('reminder');
                setShowAddForm(true);
              }}
            >
              <Ionicons name="notifications-outline" size={24} color={theme.colors.warning} />
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Bill Reminder</Text>
              <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
                Set payment alerts
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => setActiveTab('budget')}
            >
              <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Budget Plan</Text>
              <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
                Manage family budget
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Budget Alerts Section */}
        {renderBudgetAlerts()}

        {/* Recent Transactions - Enhanced Card Rows */}
        <RecentTransactionsView
          expenses={expenses}
          theme={theme}
          onViewAll={() => setActiveTab('transactions')}
          onExpensePress={(expense) => {
            Alert.alert(
              expense.title,
              `Amount: ${expense.amount.toFixed(2)}\nCategory: ${expense.category}\nDate: ${new Date(expense.date).toLocaleDateString()}`,
              [
                { text: 'Delete', style: 'destructive', onPress: () => deleteItem(expense.id, 'expense') },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          }}
        />

        {/* Upcoming Bills & Reminders */}
        <UpcomingRemindersView
          reminders={reminders}
          theme={theme}
          onViewAll={() => setShowReminderListModal(true)}
          onReminderPress={(reminder) => {
            Alert.alert(
              reminder.title,
              `Amount: ${reminder.amount.toFixed(2)}\nCategory: ${reminder.category}\nDue: ${new Date(reminder.dueDate).toLocaleDateString()}`,
              [
                { text: 'Mark Paid', onPress: () => markReminderAsPaid(reminder.id) },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          }}
          onMarkPaid={markReminderAsPaid}
        />
      </ScrollView>
    );
  };

  const renderAnalytics = () => {
    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

    // Calculate category-wise expenses
    const categoryExpenses = expenses.reduce((acc: any, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    // Calculate monthly trends
    const monthlyExpenses = expenses.reduce((acc: any, expense) => {
      const month = new Date(expense.date).toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + expense.amount;
      return acc;
    }, {});

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Financial Health Card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.success }]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Financial Health Score</Text>
            <Text style={[styles.balanceSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              Based on spending patterns
            </Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={[styles.balanceAmount, { fontSize: 48 }]}>
              {totalIncome > 0 ? Math.min(100, Math.round((1 - totalExpenses / totalIncome) * 100)) : 0}%
            </Text>
            <Text style={styles.balanceLabel}>
              {totalIncome > totalExpenses ? 'Excellent' : 'Needs Attention'}
            </Text>
          </View>
        </View>

        {/* Spending by Category */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Spending by Category</Text>
          {Object.entries(categoryExpenses).length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="pie-chart-outline" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                No spending data yet
              </Text>
            </View>
          ) : (
            Object.entries(categoryExpenses)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .map(([category, amount]) => (
                <View key={category} style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <Text style={styles.categoryIcon}>{getCategoryEmoji(category)}</Text>
                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>{category}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={[styles.categoryAmount, { color: theme.colors.text }]}>
                      ${(amount as number).toFixed(2)}
                    </Text>
                    <View style={[styles.categoryBar, { backgroundColor: theme.colors.border }]}>
                      <View 
                        style={[
                          styles.categoryBarFill, 
                          { 
                            width: `${((amount as number) / Math.max(...Object.values(categoryExpenses) as number[])) * 100}%`,
                            backgroundColor: getCategoryColor(category)
                          }
                        ]} 
                      />
                    </View>
                  </View>
                </View>
              ))
          )}
        </View>

        {/* Monthly Trends */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Monthly Spending Trends</Text>
          {Object.entries(monthlyExpenses).length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="trending-up-outline" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                No trend data yet
              </Text>
            </View>
          ) : (
            Object.entries(monthlyExpenses)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, amount]) => (
                <View key={month} style={styles.trendRow}>
                  <Text style={[styles.trendMonth, { color: theme.colors.text }]}>
                    {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text style={[styles.trendAmount, { color: theme.colors.text }]}>
                    ${(amount as number).toFixed(2)}
                  </Text>
                </View>
              ))
          )}
        </View>

        {/* Budget Insights */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Budget Insights</Text>
          <View style={styles.insightCard}>
            <Ionicons name="bulb-outline" size={24} color={theme.colors.warning} />
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                Smart Savings Tip
              </Text>
              <Text style={[styles.insightText, { color: theme.colors.textSecondary }]}>
                {totalExpenses > totalIncome * 0.8 
                  ? "Consider reducing expenses in your top spending categories to improve your financial health."
                  : "Great job! You're maintaining a healthy spending ratio. Consider increasing savings."}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderBudget = () => {
    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const remainingBudget = totalIncome - totalExpenses;

    // Sample budget categories - in a real app, this would be user-configurable
    const budgetCategories = [
      { name: 'Housing', budgeted: totalIncome * 0.3, spent: expenses.filter(e => e.category === 'Housing').reduce((sum, e) => sum + e.amount, 0) },
      { name: 'Food', budgeted: totalIncome * 0.15, spent: expenses.filter(e => e.category === 'Food').reduce((sum, e) => sum + e.amount, 0) },
      { name: 'Transportation', budgeted: totalIncome * 0.15, spent: expenses.filter(e => e.category === 'Transportation').reduce((sum, e) => sum + e.amount, 0) },
      { name: 'Utilities', budgeted: totalIncome * 0.1, spent: expenses.filter(e => e.category === 'Utilities').reduce((sum, e) => sum + e.amount, 0) },
      { name: 'Entertainment', budgeted: totalIncome * 0.1, spent: expenses.filter(e => e.category === 'Entertainment').reduce((sum, e) => sum + e.amount, 0) },
      { name: 'Savings', budgeted: totalIncome * 0.2, spent: 0 },
    ];

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Budget Overview */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Monthly Budget Overview</Text>
            <Text style={[styles.balanceSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>
              Family Financial Plan
            </Text>
          </View>
          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount}>${totalIncome.toFixed(2)}</Text>
              <Text style={styles.balanceLabel}>Monthly Income</Text>
            </View>
            <View style={[styles.balanceItem, { borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.balanceAmount}>${totalExpenses.toFixed(2)}</Text>
              <Text style={styles.balanceLabel}>Spent This Month</Text>
            </View>
            <View style={[styles.balanceItem, { borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={[styles.balanceAmount, { color: remainingBudget >= 0 ? '#FFD700' : '#FFA500' }]}>
                ${Math.abs(remainingBudget).toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>
                {remainingBudget >= 0 ? 'Remaining' : 'Over Budget'}
              </Text>
            </View>
          </View>
        </View>

        {/* Budget Categories */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Budget Categories</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                Alert.alert(
                  'Budget Management',
                  'Budget category management coming soon! Set custom limits and track spending per category.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Ionicons name="settings" color="white" size={20} />
            </TouchableOpacity>
          </View>
          
          {budgetCategories.map((category) => {
            const percentage = category.budgeted > 0 ? (category.spent / category.budgeted) * 100 : 0;
            const isOverBudget = percentage > 100;
            
            return (
              <View key={category.name} style={styles.budgetCategoryCard}>
                <View style={styles.budgetCategoryHeader}>
                  <View style={styles.budgetCategoryLeft}>
                    <Text style={styles.budgetCategoryIcon}>{getCategoryEmoji(category.name)}</Text>
                    <View>
                      <Text style={[styles.budgetCategoryName, { color: theme.colors.text }]}>
                        {category.name}
                      </Text>
                      <Text style={[styles.budgetCategorySubtext, { color: theme.colors.textSecondary }]}>
                        ${category.spent.toFixed(2)} of ${category.budgeted.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.budgetCategoryRight}>
                    <Text style={[
                      styles.budgetCategoryPercentage, 
                      { color: isOverBudget ? theme.colors.error : theme.colors.success }
                    ]}>
                      {percentage.toFixed(0)}%
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.budgetProgress, { backgroundColor: theme.colors.border }]}>
                  <View 
                    style={[
                      styles.budgetProgressFill, 
                      { 
                        width: `${Math.min(100, percentage)}%`,
                        backgroundColor: isOverBudget ? theme.colors.error : theme.colors.success
                      }
                    ]} 
                  />
                </View>
                
                {isOverBudget && (
                  <Text style={[styles.budgetWarning, { color: theme.colors.error }]}>
                    Over budget by ${(category.spent - category.budgeted).toFixed(2)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Budget Tips */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Budget Tips</Text>
          <View style={styles.tipCard}>
            <Ionicons name="lightbulb-outline" size={24} color={theme.colors.primary} />
            <View style={styles.tipContent}>
              <Text style={[styles.tipTitle, { color: theme.colors.text }]}>
                50/30/20 Rule
              </Text>
              <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
                Allocate 50% for needs, 30% for wants, and 20% for savings and debt repayment.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderBudgetAlerts = () => {
    const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    
    if (totalExpenses > totalIncome * 0.8) {
      return (
        <View style={[styles.alertCard, { backgroundColor: theme.colors.warning + '20', borderColor: theme.colors.warning }]}>
          <Ionicons name="warning-outline" size={24} color={theme.colors.warning} />
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: theme.colors.text }]}>
              Budget Alert
            </Text>
            <Text style={[styles.alertText, { color: theme.colors.textSecondary }]}>
              You've spent 80% of your monthly income. Consider reviewing your expenses.
            </Text>
          </View>
        </View>
      );
    }
    return null;
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

      {/* Budget Plan for Family */}
      <BudgetPlanSection
        onManageBudget={() => {
          Alert.alert(
            'Budget Management',
            'Budget management features coming soon! Set up categories, limits, and track family spending.',
            [{ text: 'OK' }]
          );
        }}
      />
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
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Family Finance</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              Manage your family's finances
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerAction}
              onPress={connectGmail}
            >
              <Ionicons name="cloud-download" size={24} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerAction}
            >
              <Ionicons name="notifications" size={24} color="#F59E0B" />
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
            <TabButton
              key={tab.id}
              title={tab.title}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onPress={() => setActiveTab(tab.id)}
            />
          ))}
        </View>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContainer}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'budget' && renderBudget()}
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
      
      {/* Modals */}
      {renderAddForm()}
      
      {/* Full Screen Expense List Modal */}
      <SimpleExpenseListModal
        visible={showExpenseListModal}
        onClose={() => setShowExpenseListModal(false)}
        title="All Expenses"
        onExpensePress={(expense) => {
          Alert.alert(
            expense.title,
            `Amount: ${expense.amount.toFixed(2)}\nCategory: ${expense.category}\nDate: ${new Date(expense.date).toLocaleDateString()}`,
            [
              { text: 'Delete', style: 'destructive', onPress: () => deleteItem(expense.id, 'expense') },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }}
      />

      {/* Full Screen Reminder List Modal */}
      <FullScreenReminderModal
        visible={showReminderListModal}
        onClose={() => setShowReminderListModal(false)}
        reminders={reminders}
        theme={theme}
        onMarkPaid={markReminderPaid}
        onDelete={(id) => deleteItem(id, 'reminder')}
      />

      <SmartMoneyCalendarModal
        visible={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        expenses={expenses}
        income={income}
        reminders={reminders}
        theme={theme}
        onExpensePress={(expense) => {
          Alert.alert(
            expense.title,
            `Amount: ${expense.amount.toFixed(2)}\nCategory: ${expense.category}\nDate: ${new Date(expense.date).toLocaleDateString()}`,
            [
              { text: 'Edit', onPress: () => {
                // Navigate to edit expense
                setShowCalendarModal(false);
                // Add edit functionality here
              }},
              { text: 'Delete', style: 'destructive', onPress: () => {
                setShowCalendarModal(false);
                deleteItem(expense.id, 'expense');
              }},
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }}
        onReminderPress={(reminder) => {
          Alert.alert(
            reminder.title,
            `Amount: ${reminder.amount.toFixed(2)}\nDue: ${new Date(reminder.dueDate).toLocaleDateString()}\nStatus: ${reminder.status}`,
            [
              { text: 'Mark Paid', onPress: () => {
                setShowCalendarModal(false);
                markReminderPaid(reminder.id);
              }},
              { text: 'Delete', style: 'destructive', onPress: () => {
                setShowCalendarModal(false);
                deleteItem(reminder.id, 'reminder');
              }},
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }}
        onAddExpense={() => {
          setShowCalendarModal(false);
          setFormType('expense');
          setShowAddForm(true);
        }}
        onAddReminder={() => {
          setShowCalendarModal(false);
          setFormType('reminder');
          setShowAddForm(true);
        }}
      />

      {/* Keep all your existing modals */}
      <SimpleExpenseListModal
        visible={showExpenseListModal}
        onClose={() => setShowExpenseListModal(false)}
        title="All Expenses"
        onExpensePress={(expense) => {
          Alert.alert(
            expense.title,
            `Amount: ${expense.amount.toFixed(2)}\nCategory: ${expense.category}\nDate: ${new Date(expense.date).toLocaleDateString()}`,
            [
              { text: 'Delete', style: 'destructive', onPress: () => deleteItem(expense.id, 'expense') },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }}
      />

      {/* Transaction List Modal */}
      <TransactionListModal
        visible={showTransactionListModal}
        onClose={() => setShowTransactionListModal(false)}
        title="All Transactions"
        onTransactionPress={(transaction) => {
          Alert.alert(
            transaction.description,
            `Amount: ${transaction.amount.toFixed(2)}\nCategory: ${transaction.category}\nMerchant: ${transaction.merchant}\nDate: ${transaction.date.toLocaleDateString()}`,
            [{ text: 'OK' }]
          );
        }}
      />
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
    'Other': '📊'
  };
  return emojis[category] || '📊';
};

const getReminderEmoji = (category: string): string => {
  const emojis: Record<string, string> = {
    'Bills': '📄',
    'Subscriptions': '📱',
    'Insurance': '🛡️',
    'Loans': '🏦',
    'Taxes': '🧾',
    'Rent': '🏠',
    'Utilities': '⚡',
    'Other': '📝'
  };
  return emojis[category] || '📝';
};

// Enhanced styles with new components
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
    fontWeight: '500',
  },
  
  // Header Styles
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
    fontWeight: '400',
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
    fontWeight: '500',
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
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Transaction Card Rows (New Layout)
  transactionCardsList: {
    maxHeight: 300,
  },
  transactionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    fontSize: 18,
  },
  transactionCardDetails: {
    flex: 1,
  },
  transactionCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionCardCategory: {
    fontSize: 13,
    fontWeight: '400',
  },
  metaSeparator: {
    fontSize: 13,
    marginHorizontal: 6,
  },
  transactionCardDate: {
    fontSize: 13,
    fontWeight: '400',
  },
  transactionCardAmount: {
    alignItems: 'flex-end',
  },
  transactionCardAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Reminder Card Rows (New Layout)
  reminderCardsList: {
    maxHeight: 300,
  },
  reminderCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
  },
  priorityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  priorityIconText: {
    fontSize: 18,
  },
  reminderCardDetails: {
    flex: 1,
  },
  reminderCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reminderCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderCardCategory: {
    fontSize: 13,
    fontWeight: '400',
  },
  reminderCardDue: {
    fontSize: 13,
    fontWeight: '500',
  },
  reminderCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  reminderCardAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickMarkPaidButton: {
    padding: 4,
  },

  // Full Screen Modal Styles
  fullScreenModal: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  fullScreenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewModeSelector: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  calendarContent: {
    flex: 1,
    padding: 20,
  },
  comingSoonText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 100,
  },
  comingSoonSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Full Screen Reminder Modal Styles
  fullScreenRemindersList: {
    padding: 16,
  },
  fullScreenReminderCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fullScreenReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  fullScreenReminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fullScreenReminderIconText: {
    fontSize: 20,
  },
  fullScreenReminderContent: {
    flex: 1,
  },
  fullScreenReminderTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  fullScreenReminderAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  fullScreenReminderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  fullScreenReminderCategory: {
    fontSize: 14,
    fontWeight: '400',
  },
  fullScreenReminderStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  fullScreenReminderDate: {
    fontSize: 14,
    fontWeight: '400',
  },
  fullScreenReminderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fullScreenActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenContent: {
    flex: 1,
  },
  fullScreenCalendarView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  fullScreenEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  fullScreenEmptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  fullScreenEmptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
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
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '500',
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
    fontWeight: '400',
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
    fontWeight: '400',
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
  reminderDetails: {
    fontSize: 14,
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
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

  // Enhanced Analytics Styles
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoryRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryBar: {
    height: 4,
    width: 80,
    borderRadius: 2,
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  trendMonth: {
    fontSize: 16,
    fontWeight: '500',
  },
  trendAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  insightCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  insightContent: {
    marginLeft: 12,
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Budget Styles
  budgetCategoryCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  budgetCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetCategoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  budgetCategoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  budgetCategoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  budgetCategorySubtext: {
    fontSize: 14,
  },
  budgetCategoryRight: {
    alignItems: 'flex-end',
  },
  budgetCategoryPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  budgetProgress: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  budgetProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetWarning: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  tipCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  tipContent: {
    marginLeft: 12,
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Alert Styles
  alertCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  alertContent: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    lineHeight: 20,
  },
  balanceSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default function SmartMoneyApp() {
  return <SmartMoneyScreen />;
}