// src/screens/main/SmartMoneyScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { SmartMoneyService } from '@/services/smartMoney/SmartMoneyService';
import { RemindersService } from '@/services/reminders/RemindersService1';
import { BankingService } from '@/services/banking/BankingService';
import { AIService } from '@/services/ai/AIService';
import { formatCurrency } from '@/utils/currency';
import AddExpenseModal from '@/components/smartMoney/AddExpenseModal';
import AddReminderModal from '@/components/smartMoney/AddReminderModal';
import {BankConnectionModal} from '@/components/smartMoney/BankConnectionModal';
import ReceiptScannerModal from '@/components/smartMoney/ReceiptScannerModal';
import {TransactionDetailsModal} from '@/components/smartMoney/TransactionDetailsModal';
import AnalyticsModal from '@/components/smartMoney/AnalyticsModal';

const { width } = Dimensions.get('window');

interface SmartTransaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  categoryIcon: string;
  merchant: string;
  location: string;
  date: Date;
  source: 'bank_transaction' | 'receipt_scan' | 'manual' | 'recurring';
  account: string;
  aiConfidence: number;
  canSplit: boolean;
  tags: string[];
  receiptUrl?: string;
  isRecurring?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SmartReminder {
  id: string;
  title: string;
  amount: number;
  dueDate: Date;
  category: string;
  status: 'upcoming' | 'overdue' | 'paid';
  aiPredicted: boolean;
  autoPayEnabled: boolean;
  isRecurring: boolean;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountType: string;
  balance: number;
  currency: string;
  isActive: boolean;
  lastSynced: Date;
}

interface Analytics {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    color: string;
    icon: string;
  }>;
  insights: Array<{
    type: 'positive' | 'warning' | 'info';
    title: string;
    description: string;
    icon: string;
  }>;
}

export default function SmartMoneyScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // State
  const [transactions, setTransactions] = useState<SmartTransaction[]>([]);
  const [reminders, setReminders] = useState<SmartReminder[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  
  // Modal states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [showBankConnection, setShowBankConnection] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<SmartTransaction | null>(null);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      const [
        transactionsData,
        remindersData,
        bankAccountsData,
        analyticsData
      ] = await Promise.all([
        SmartMoneyService.getTransactions(user.id),
        RemindersService.getReminders(user.id),
        BankingService.getBankAccounts(user.id),
        SmartMoneyService.getAnalytics(user.id)
      ]);
      
      setTransactions(transactionsData);
      setReminders(remindersData.filter(r => r.status !== 'paid').map(reminder => ({
        ...reminder,
        aiPredicted: reminder.autoDetected || false,
        autoPayEnabled: false
      })));
      setBankAccounts(bankAccountsData);
      setAnalytics(analyticsData as Analytics);
      
      // Calculate total balance
      const totalBal = bankAccountsData.reduce((sum, account) => sum + account.balance, 0);
      setTotalBalance(totalBal);
      
    } catch (error) {
      console.error('Load data error:', error);
      Alert.alert('Error', 'Failed to load Smart Money data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddExpense = async (expenseData: any) => {
    try {
      if (!user?.id) return;
      
      await SmartMoneyService.addTransaction({
        ...expenseData,
        userId: user.id,
        source: 'manual',
        aiConfidence: 1.0,
        canSplit: true,
        tags: [expenseData.category.toLowerCase()],
        date: new Date()
      });
      
      setShowAddExpense(false);
      await loadData();
      Alert.alert('Success', 'Expense added successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add expense');
    }
  };

  const handleAddReminder = async (reminderData: any) => {
    try {
      if (!user?.id) return;
      
      await RemindersService.createReminder(user.id, {
        ...reminderData,
        status: 'upcoming',
        isRecurring: reminderData.isRecurring || false,
        notificationEnabled: true,
        reminderDays: [1, 3],
        autoDetected: false
      });
      
      setShowAddReminder(false);
      await loadData();
      Alert.alert('Success', 'Reminder added successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add reminder');
    }
  };

  const handleReceiptScan = async (imageUri: string) => {
    try {
      if (!user?.id) return;
      
      setShowReceiptScanner(true);
      
      // Process receipt with AI
      const receiptData = await AIService.processReceipt(imageUri);
      
      // Auto-categorize
      const category = await AIService.categorizeExpense(receiptData.description);
      
      // Add transaction
      await SmartMoneyService.addTransaction({
        userId: user.id,
        amount: receiptData.amount,
        description: receiptData.description,
        category: category.category,
        categoryIcon: category.icon,
        merchant: receiptData.merchant,
        location: receiptData.location || '',
        source: 'receipt_scan',
        account: bankAccounts[0]?.bankName || 'Unknown',
        aiConfidence: receiptData.confidence,
        canSplit: true,
        tags: ['receipt', category.category.toLowerCase()],
        receiptUrl: receiptData.receiptUrl,
        date: receiptData.date
      });
      
      setShowReceiptScanner(false);
      await loadData();
      Alert.alert('Success', 'Receipt scanned and expense added!');
    } catch (error) {
      setShowReceiptScanner(false);
      Alert.alert('Error', 'Failed to process receipt');
    }
  };

  const handleConnectBank = async (bankData: any) => {
    try {
      if (!user?.id) return;
      
      const account = await BankingService.connectBankAccount(user.id, bankData);
      
      if (account) {
        // Sync transactions
        await BankingService.syncTransactions(account.id);
        await loadData();
        Alert.alert('Success', 'Bank account connected successfully!');
      }
      
      setShowBankConnection(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to connect bank account');
    }
  };

  const handleTransactionPress = (transaction: SmartTransaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetails(true);
  };

  const renderHeader = () => (
    <BlurView 
      intensity={20} 
      style={[styles.header, { backgroundColor: theme.colors.surface + 'F0' }]}
    >
      <SafeAreaView>
        <View style={styles.headerContent}>
          <View style={styles.logoSection}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.logo}
            >
              <Text style={styles.logoText}>S</Text>
            </LinearGradient>
            <Text style={[styles.appTitle, { color: theme.colors.text }]}>SmartMoney</Text>
          </View>
          <TouchableOpacity style={[styles.headerButton, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </BlurView>
  );

  const renderBalanceCard = () => (
    <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddExpense(true)}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>
      <Text style={styles.balanceAmount}>
        {formatCurrency(totalBalance, user?.currency || 'USD')}
      </Text>
      <View style={styles.balanceTrend}>
        <Ionicons name="trending-up" size={12} color="rgba(255,255,255,0.8)" />
        <Text style={styles.trendText}>+12.5% this month</Text>
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: theme.colors.surface }]}
        onPress={() => setShowAddExpense(true)}
      >
        <LinearGradient
          colors={['#EF4444', '#DC2626']}
          style={styles.actionIcon}
        >
          <Ionicons name="add" size={16} color="white" />
        </LinearGradient>
        <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
          Add Expense
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: theme.colors.surface }]}
        onPress={() => setShowAddReminder(true)}
      >
        <LinearGradient
          colors={['#F59E0B', '#D97706']}
          style={styles.actionIcon}
        >
          <Ionicons name="alarm" size={16} color="white" />
        </LinearGradient>
        <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
          Reminders
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: theme.colors.surface }]}
        onPress={() => setShowAnalytics(true)}
      >
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          style={styles.actionIcon}
        >
          <Ionicons name="analytics" size={16} color="white" />
        </LinearGradient>
        <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
          Analytics
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: theme.colors.surface }]}
        onPress={() => setShowReceiptScanner(true)}
      >
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.actionIcon}
        >
          <Ionicons name="scan" size={16} color="white" />
        </LinearGradient>
        <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
          Scan
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderInsights = () => (
    <View style={styles.insightsSection}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Insights</Text>
        <TouchableOpacity onPress={() => setShowAnalytics(true)}>
          <Text style={styles.sectionAction}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.insightsGrid}>
        {[
          { value: `$${analytics?.totalExpenses || 342}`, label: 'This Week', change: '+8.2%', positive: true },
          { value: `$${analytics?.totalIncome || 1205}`, label: 'This Month', change: '-3.1%', positive: false },
          { value: `$${Math.round((analytics?.totalExpenses || 623) / 7)}`, label: 'Daily Avg', change: '+5.7%', positive: true },
          { value: `${transactions.length}`, label: 'Transactions', change: '+12%', positive: true }
        ].map((insight, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.insightCard, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.insightValue, { color: theme.colors.text }]}>{insight.value}</Text>
            <Text style={[styles.insightLabel, { color: theme.colors.textSecondary }]}>{insight.label}</Text>
            <View style={styles.insightChange}>
              <Ionicons 
                name={insight.positive ? "trending-up" : "trending-down"} 
                size={12} 
                color={insight.positive ? "#10b981" : "#ef4444"} 
              />
              <Text style={[styles.changeText, { color: insight.positive ? "#10b981" : "#ef4444" }]}>
                {insight.change}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTransactionItem = (transaction: SmartTransaction) => (
    <TouchableOpacity
      style={[styles.transactionItem, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleTransactionPress(transaction)}
    >
      <LinearGradient
        colors={transaction.category === 'Income' ? ['#10b981', '#059669'] : ['#f59e0b', '#d97706']}
        style={styles.transactionAvatar}
      >
        <Text style={styles.avatarEmoji}>{transaction.categoryIcon}</Text>
      </LinearGradient>
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionTitle, { color: theme.colors.text }]}>
          {transaction.description}
        </Text>
        <Text style={[styles.transactionSubtitle, { color: theme.colors.textSecondary }]}>
          {transaction.merchant}
        </Text>
      </View>
      <View style={styles.transactionAmountWrapper}>
        <Text style={[
          styles.transactionAmount,
          { color: transaction.category === 'Income' ? '#10b981' : theme.colors.text }
        ]}>
          {transaction.category === 'Income' ? '+' : '-'}
          {formatCurrency(transaction.amount, user?.currency || 'USD')}
        </Text>
        <Text style={[styles.transactionTime, { color: theme.colors.textSecondary }]}>
          {transaction.date.toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderTransactions = () => (
    <View style={styles.transactionsSection}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Activity</Text>
        <TouchableOpacity>
          <Text style={styles.sectionAction}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.transactionList, { backgroundColor: theme.colors.surface }]}>
        {transactions.slice(0, 4).map((transaction) => renderTransactionItem(transaction))}
      </View>
    </View>
  );

  const renderFAB = () => (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => setShowAddExpense(true)}
    >
      <LinearGradient
        colors={['#00c805', '#00a804']}
        style={styles.fabGradient}
      >
        <Ionicons name="add" size={24} color="white" />
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color="#00c805" />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading Smart Money...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderHeader()}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00c805"
          />
        }
      >
        {renderBalanceCard()}
        {renderQuickActions()}
        {renderInsights()}
        {renderTransactions()}
      </ScrollView>

      {/* Modals */}
      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onSubmit={handleAddExpense}
        categories={[
          { category: 'Food', icon: '🍔', color: '#f59e0b' },
          { category: 'Transport', icon: '🚗', color: '#3b82f6' },
          { category: 'Shopping', icon: '🛒', color: '#8b5cf6' },
          { category: 'Entertainment', icon: '🎬', color: '#ef4444' },
          { category: 'Bills', icon: '💡', color: '#10b981' },
        ]}
      />
      
      <AddReminderModal
        visible={showAddReminder}
        onClose={() => setShowAddReminder(false)}
        onSubmit={handleAddReminder}
      />
      
      <BankConnectionModal
        visible={showBankConnection}
        onClose={() => setShowBankConnection(false)}
        onConnect={handleConnectBank}
      />
      
      <ReceiptScannerModal
        visible={showReceiptScanner}
        onClose={() => setShowReceiptScanner(false)}
        onReceiptProcessed={handleReceiptScan}
      />
      
      {selectedTransaction && (
        <TransactionDetailsModal
          visible={showTransactionDetails}
          transaction={selectedTransaction}
          onClose={() => {
            setShowTransactionDetails(false);
            setSelectedTransaction(null);
          }}
          onUpdate={() => {
            // Handle transaction update
            loadData();
          }}
        />
      )}
      
      <AnalyticsModal
        visible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        analytics={analytics}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  scrollView: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 100 : 120,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceAmount: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  balanceTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    gap: 6,
    minHeight: 65,
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  insightsSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 14,
    color: '#00c805',
    fontWeight: '500',
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  insightCard: {
    width: (width - 64) / 2,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  insightValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  insightLabel: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  transactionsSection: {
    marginBottom: 100,
  },
  transactionList: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  transactionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  transactionDetails: {
    flex: 1,
    minWidth: 0,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionSubtitle: {
    fontSize: 13,
  },
  transactionAmountWrapper: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: '50%',
    transform: [{ translateX: 32 }],
    width: 64,
    height: 64,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
});
