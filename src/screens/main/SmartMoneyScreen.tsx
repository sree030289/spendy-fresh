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
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { SmartMoneyService } from '@/services/smartMoney/SmartMoneyService';
import { RemindersService } from '@/services/reminders/RemindersService';
import { BankingService } from '@/services/banking/BankingService';
import { AIService } from '@/services/ai/AIService';
import { formatCurrency } from '@/utils/currency';
import AddExpenseModal from '@/components/smartmoney/AddExpenseModal';
import AddReminderModal from '@/components/smartmoney/AddReminderModal';
import { BankConnectionModal } from '@/components/smartmoney/BankConnectionModal';
import ReceiptScannerModal from '@/components/smartmoney/ReceiptScannerModal';
import { TransactionDetailsModal } from '@/components/smartmoney/TransactionDetailsModal';
import AnalyticsModal from '@/components/smartmoney/AnalyticsModal';

const { width } = Dimensions.get('window');

interface SmartTransaction {
  id: string;
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
  status: 'upcoming' | 'overdue' | 'paid' | 'snoozed';
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
  const [activeTab, setActiveTab] = useState('overview');
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
      setReminders(remindersData.filter(r => r.status !== 'paid'));
      setBankAccounts(bankAccountsData);
      setAnalytics(analyticsData);
      
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

  const handleMarkReminderPaid = async (reminderId: string) => {
    try {
      await RemindersService.markAsPaid(reminderId);
      await loadData();
      Alert.alert('Success', 'Reminder marked as paid!');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark reminder as paid');
    }
  };

  const renderHeader = () => (
    <LinearGradient
      colors={['#10B981', '#059669']}
      style={styles.header}
    >
      <SafeAreaView>
        <BlurView intensity={20} style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Smart Money</Text>
              <Text style={styles.headerSubtitle}>AI-powered financial insights</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowBankConnection(true)}
              >
                <Ionicons name="link" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowReceiptScanner(true)}
              >
                <Ionicons name="scan" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceTitle}>Total Balance</Text>
              <Ionicons name="eye" size={20} color="rgba(255,255,255,0.8)" />
            </View>
            <Text style={styles.balanceAmount}>
              {formatCurrency(totalBalance, user?.currency || 'USD')}
            </Text>
            <View style={styles.balanceDetails}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>Income</Text>
                <Text style={styles.balanceValue}>
                  +{formatCurrency(analytics?.totalIncome || 0, user?.currency || 'USD')}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>Expenses</Text>
                <Text style={styles.balanceValue}>
                  -{formatCurrency(analytics?.totalExpenses || 0, user?.currency || 'USD')}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>Savings</Text>
                <Text style={styles.balanceValue}>
                  {analytics?.savingsRate?.toFixed(1) || '0'}%
                </Text>
              </View>
            </View>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabNavigation}>
            {[
              { id: 'overview', title: 'Overview', icon: 'home' },
              { id: 'transactions', title: 'Transactions', icon: 'list' },
              { id: 'reminders', title: 'Reminders', icon: 'alarm' },
              { id: 'analytics', title: 'Analytics', icon: 'analytics' }
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabItem,
                  activeTab === tab.id && styles.tabItemActive
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={activeTab === tab.id ? '#10B981' : 'rgba(255,255,255,0.7)'}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive
                  ]}
                >
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      </SafeAreaView>
    </LinearGradient>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => setShowAddExpense(true)}
        >
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="add" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Add Expense</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => setShowReceiptScanner(true)}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="camera" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Scan Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => setShowAddReminder(true)}
        >
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="alarm" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Add Reminder</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => setShowAnalytics(true)}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="trending-up" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Analytics</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTransactionItem = (transaction: SmartTransaction) => (
    <TouchableOpacity
      key={transaction.id}
      style={styles.transactionCard}
      onPress={() => handleTransactionPress(transaction)}
    >
      <View style={styles.transactionHeader}>
        <View style={styles.transactionLeft}>
          <View style={[styles.categoryIcon, { backgroundColor: '#10B981' + '20' }]}>
            <Text style={styles.categoryEmoji}>{transaction.categoryIcon}</Text>
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription}>{transaction.description}</Text>
            <View style={styles.transactionMeta}>
              <Text style={styles.transactionMerchant}>{transaction.merchant}</Text>
              <Text style={styles.transactionDot}>•</Text>
              <Text style={styles.transactionTime}>
                {transaction.date.toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.transactionTags}>
              {transaction.aiConfidence > 0.8 && (
                <View style={styles.aiTag}>
                  <Ionicons name="sparkles" size={10} color="#10B981" />
                  <Text style={styles.aiTagText}>AI Categorized</Text>
                </View>
              )}
              {transaction.canSplit && (
                <TouchableOpacity style={styles.splitTag}>
                  <Ionicons name="people" size={10} color="#3B82F6" />
                  <Text style={styles.splitTagText}>Split</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.transactionAmount,
              { color: transaction.category === 'Income' ? '#10B981' : '#1F2937' }
            ]}
          >
            {transaction.category === 'Income' ? '+' : '-'}
            {formatCurrency(transaction.amount, user?.currency || 'USD')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderReminderItem = (reminder: SmartReminder) => (
    <View key={reminder.id} style={styles.reminderCard}>
      <View style={styles.reminderHeader}>
        <View style={styles.reminderLeft}>
          <View
            style={[
              styles.reminderIcon,
              { backgroundColor: reminder.status === 'overdue' ? '#EF4444' : '#F59E0B' }
            ]}
          >
            <Ionicons
              name={reminder.status === 'overdue' ? 'warning' : 'time'}
              size={16}
              color="white"
            />
          </View>
          <View style={styles.reminderInfo}>
            <Text style={styles.reminderTitle}>{reminder.title}</Text>
            <Text style={styles.reminderDue}>
              Due {reminder.dueDate.toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View style={styles.reminderRight}>
          <Text style={styles.reminderAmount}>
            {formatCurrency(reminder.amount, user?.currency || 'USD')}
          </Text>
          {reminder.aiPredicted && (
            <View style={styles.aiPredictedTag}>
              <Ionicons name="sparkles" size={10} color="#10B981" />
              <Text style={styles.aiPredictedText}>AI</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.reminderActions}>
        <TouchableOpacity
          style={styles.reminderPayButton}
          onPress={() => handleMarkReminderPaid(reminder.id)}
        >
          <Text style={styles.reminderPayText}>Mark Paid</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reminderSnoozeButton}>
          <Ionicons name="time" size={14} color="#6B7280" />
          <Text style={styles.reminderSnoozeText}>Snooze</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOverview = () => (
    <View style={styles.content}>
      {renderQuickActions()}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => setActiveTab('transactions')}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>
        {transactions.slice(0, 3).map(renderTransactionItem)}
      </View>

      {/* Upcoming Reminders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Reminders</Text>
          <TouchableOpacity onPress={() => setActiveTab('reminders')}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>
        {reminders.slice(0, 2).map(renderReminderItem)}
      </View>

      {/* AI Insights */}
      {analytics?.insights && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Insights</Text>
          {analytics.insights.map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <View style={styles.insightIcon}>
                <Text style={styles.insightEmoji}>{insight.icon}</Text>
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightDescription}>{insight.description}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderTransactions = () => (
    <View style={styles.content}>
      <FlatList
        data={transactions}
        renderItem={({ item }) => renderTransactionItem(item)}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const renderReminders = () => (
    <View style={styles.content}>
      <FlatList
        data={reminders}
        renderItem={({ item }) => renderReminderItem(item)}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const renderAnalyticsTab = () => (
    <View style={styles.content}>
      {analytics && (
        <>
          {/* Category Breakdown */}
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>Spending by Category</Text>
            {analytics.categoryBreakdown.map((category, index) => (
              <View key={index} style={styles.categoryBreakdown}>
                <View style={styles.categoryBreakdownHeader}>
                  <View style={styles.categoryBreakdownLeft}>
                    <Text style={styles.categoryBreakdownEmoji}>{category.icon}</Text>
                    <Text style={styles.categoryBreakdownName}>{category.category}</Text>
                  </View>
                  <Text style={styles.categoryBreakdownAmount}>
                    {formatCurrency(category.amount, user?.currency || 'USD')}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${category.percentage}%`, backgroundColor: category.color }
                    ]}
                  />
                </View>
                <Text style={styles.categoryPercentage}>
                  {category.percentage.toFixed(1)}% of total
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading Smart Money...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'transactions':
        return renderTransactions();
      case 'reminders':
        return renderReminders();
      case 'analytics':
        return renderAnalyticsTab();
      default:
        return renderOverview();
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Please log in to use Smart Money</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <Animated.ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {renderContent()}
      </Animated.ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddExpense(true)}
      >
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={24} color="white" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Modals */}
      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onSubmit={handleAddExpense}
        categories={analytics?.categoryBreakdown || []}
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

      <TransactionDetailsModal
        visible={showTransactionDetails}
        transaction={selectedTransaction}
        onClose={() => {
          setShowTransactionDetails(false);
          setSelectedTransaction(null);
        }}
        onUpdate={loadData}
      />

      <AnalyticsModal
        visible={showAnalytics}
        analytics={analytics}
        onClose={() => setShowAnalytics(false)}
        currency={user.currency}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingBottom: 20,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 16,
  },
  balanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: 'white',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: '#10B981',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  quickActions: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
  },
  transactionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionMerchant: {
    fontSize: 14,
    color: '#6B7280',
  },
  transactionDot: {
    fontSize: 14,
    color: '#6B7280',
    marginHorizontal: 6,
  },
  transactionTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  transactionTags: {
    flexDirection: 'row',
    gap: 8,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981' + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  splitTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6' + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  splitTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3B82F6',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  reminderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  reminderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  reminderDue: {
    fontSize: 14,
    color: '#6B7280',
  },
  reminderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  reminderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  aiPredictedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981' + '20',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  aiPredictedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  reminderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reminderPayButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  reminderPayText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  reminderSnoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  reminderSnoozeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  analyticsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  categoryBreakdown: {
    marginBottom: 16,
  },
  categoryBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBreakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBreakdownEmoji: {
    fontSize: 16,
  },
  categoryBreakdownName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  categoryBreakdownAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#6B7280',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981' + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightEmoji: {
    fontSize: 18,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});