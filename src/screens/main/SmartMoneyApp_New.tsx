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
                <Text style={styles.statAmount}>$0.00</Text>
                <Text style={styles.statLabel}>Total Income</Text>
                <Ionicons name="arrow-up" size={16} color="#4ADE80" />
              </View>
              <View style={[styles.statItem, styles.statItemBorder]}>
                <Text style={styles.statAmount}>$0.00</Text>
                <Text style={styles.statLabel}>Total Expenses</Text>
                <Ionicons name="arrow-down" size={16} color="#F87171" />
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statAmount, { color: '#4ADE80' }]}>$0.00</Text>
                <Text style={styles.statLabel}>Net Flow</Text>
                <Text style={[styles.savingsRate, { color: '#4ADE80' }]}>0.0% Savings Rate</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
        
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
    </SafeAreaView>
  );
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
});

export default function SmartMoneyApp() {
  return <SmartMoneyScreen />;
}
