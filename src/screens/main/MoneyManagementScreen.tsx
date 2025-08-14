import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../../components/common/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { ApiService } from '@/services/api/ApiService';
import { PersonalTransaction, PersonalAnalytics } from '@/types/moneyManagement';

// Import modals
import AddTransactionModal from '@/components/modals/AddTransactionModal';
import TransactionDetailsModal from '@/components/modals/TransactionDetailsModal';
import AnalyticsModal from '@/components/modals/AnalyticsModal';
import CalendarViewModal from '@/components/modals/CalendarViewModal';
import SmartNotificationService from '@/services/smartNotifications/SmartNotificationService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface QuickStatCardProps {
  title: string;
  amount: number;
  icon: string;
  color: string;
  trend?: number;
  onPress?: () => void;
}

const QuickStatCard: React.FC<QuickStatCardProps> = ({ 
  title, 
  amount, 
  icon, 
  color, 
  trend,
  onPress 
}) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[styles.statCard, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.statIconContainer, { backgroundColor: color }]}>
        <Icon name={icon as any} size={24} color="white" />
      </View>
      
      <View style={styles.statContent}>
        <Text style={[styles.statTitle, { color: theme.colors.textSecondary }]}>
          {title}
        </Text>
        <Text style={[styles.statAmount, { color: theme.colors.text }]}>
          ${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
        
        {trend !== undefined && (
          <View style={styles.trendContainer}>
            <Icon 
              name={trend >= 0 ? 'trending-up' : 'trending-down'} 
              size={16} 
              color={trend >= 0 ? theme.colors.success : theme.colors.error} 
            />
            <Text style={[
              styles.trendText, 
              { color: trend >= 0 ? theme.colors.success : theme.colors.error }
            ]}>
              {Math.abs(trend).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

interface RecentTransactionItemProps {
  transaction: PersonalTransaction;
  onPress: (transaction: PersonalTransaction) => void;
}

const RecentTransactionItem: React.FC<RecentTransactionItemProps> = ({ 
  transaction, 
  onPress 
}) => {
  const { theme } = useTheme();
  
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Salary': '💰', 'Freelance': '💼', 'Business': '🏢', 'Investment': '📈',
      'Rent': '🏠', 'Groceries': '🛒', 'Transportation': '🚗', 'Entertainment': '🎬',
      'Utilities': '⚡', 'Healthcare': '🏥', 'Shopping': '🛍️', 'Restaurant': '🍽️',
      'Coffee': '☕', 'Fuel': '⛽', 'Bills': '📄', 'Insurance': '🛡️'
    };
    return icons[category] || (transaction.type === 'income' ? '💵' : '💳');
  };

  const getCategoryColor = (category: string) => {
    if (transaction.type === 'income') return theme.colors.success;
    
    const colors: Record<string, string> = {
      'Rent': '#FF6B6B', 'Groceries': '#4ECDC4', 'Transportation': '#45B7D1',
      'Entertainment': '#96CEB4', 'Utilities': '#FFEAA7', 'Healthcare': '#DDA0DD',
      'Shopping': '#98D8C8', 'Restaurant': '#FD79A8', 'Coffee': '#FDCB6E'
    };
    return colors[category] || theme.colors.primary;
  };

  return (
    <TouchableOpacity
      style={[styles.transactionItem, { backgroundColor: theme.colors.surface }]}
      onPress={() => onPress(transaction)}
      activeOpacity={0.7}
    >
      <View style={[
        styles.transactionIcon, 
        { backgroundColor: getCategoryColor(transaction.category) }
      ]}>
        <Text style={styles.transactionIconText}>
          {getCategoryIcon(transaction.category)}
        </Text>
      </View>
      
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionDescription, { color: theme.colors.text }]} numberOfLines={1}>
          {transaction.description}
        </Text>
        <View style={styles.transactionMeta}>
          <Text style={[styles.transactionCategory, { color: theme.colors.textSecondary }]}>
            {transaction.category}
          </Text>
          <Text style={[styles.transactionDate, { color: theme.colors.textSecondary }]}>
            {new Date(transaction.date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })}
          </Text>
        </View>
      </View>
      
      <Text style={[
        styles.transactionAmount,
        { 
          color: transaction.type === 'income' 
            ? theme.colors.success 
            : theme.colors.error 
        }
      ]}>
        {transaction.type === 'income' ? '+' : '-'}$
        {transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </Text>
    </TouchableOpacity>
  );
};

const MoneyManagementScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const apiService = ApiService.getInstance();
  const notificationService = SmartNotificationService.getInstance();
  
  // State management
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [analytics, setAnalytics] = useState<PersonalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyUsage, setDailyUsage] = useState({ transactions: 0, analytics: 0 });
  
  // Modal states
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<PersonalTransaction | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(-100)).current;

  // Load data on mount
  useEffect(() => {
    loadInitialData();
    
    // Enhanced animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(headerAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load transactions, analytics, and usage in parallel
      const [transactionsRes, analyticsRes, usageRes] = await Promise.all([
        loadTransactions(),
        loadAnalytics(),
        loadDailyUsage()
      ]);
      
      // Setup smart notifications based on transaction patterns
      if (transactionsRes && transactionsRes.length > 0) {
        try {
          const smartReminders = await notificationService.analyzeTransactionsForSmartReminders(transactionsRes);
          if (smartReminders.length > 0) {
            await notificationService.scheduleSmartReminders(smartReminders);
            console.log(`Scheduled ${smartReminders.length} smart reminders`);
          }
        } catch (notificationError) {
          console.error('Error setting up smart notifications:', notificationError);
        }
      }
      
    } catch (error) {
      console.error('Error loading money management data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (page = 1, limit = 20) => {
    try {
      const response = await apiService.get(`/money/transactions?page=${page}&limit=${limit}`);
      
      if (response.success && response.data) {
        const transactions = response.data.transactions || [];
        setTransactions(transactions);
        return transactions;
      } else {
        console.log('No transactions found or user is new');
        setTransactions([]);
        return [];
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      // For new users or API errors, start with empty array
      setTransactions([]);
      return [];
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await apiService.get('/money/analytics?period=month');
      
      if (response.success && response.data) {
        setAnalytics(response.data);
        return response.data;
      } else {
        console.log('No analytics data found or user is new');
        // For new users, set basic empty analytics
        const emptyAnalytics: PersonalAnalytics = {
          userId: user?.id || '',
          period: 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          totalIncome: 0,
          totalExpenses: 0,
          netSavings: 0,
          savingsRate: 0,
          categoryBreakdown: [],
          incomeBreakdown: [],
          monthlyTrends: [],
          aiInsights: [],
          budgetPerformance: [],
          upcomingExpenses: [],
          lastUpdated: new Date()
        };
        setAnalytics(emptyAnalytics);
        return emptyAnalytics;
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      // For API errors, set empty analytics
      const emptyAnalytics: PersonalAnalytics = {
        userId: user?.id || '',
        period: 'month',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        totalIncome: 0,
        totalExpenses: 0,
        netSavings: 0,
        savingsRate: 0,
        categoryBreakdown: [],
        incomeBreakdown: [],
        monthlyTrends: [],
        aiInsights: [],
        budgetPerformance: [],
        upcomingExpenses: [],
        lastUpdated: new Date()
      };
      setAnalytics(emptyAnalytics);
      return emptyAnalytics;
    }
  };

  const loadDailyUsage = async () => {
    try {
      const response = await apiService.get('/money/usage/daily');
      
      if (response.success && response.data) {
        setDailyUsage(response.data);
        return response.data;
      } else {
        // For new users or API errors, start with zero usage
        const emptyUsage = { transactions: 0, analytics: 0 };
        setDailyUsage(emptyUsage);
        return emptyUsage;
      }
    } catch (error) {
      console.error('Error loading usage:', error);
      const emptyUsage = { transactions: 0, analytics: 0 };
      setDailyUsage(emptyUsage);
      return emptyUsage;
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, []);

  const handleAddTransaction = async (transactionData: any) => {
    try {
      const response = await apiService.post('/money/transactions', transactionData);
      
      if (response.success) {
        setShowAddTransaction(false);
        await onRefresh(); // Refresh all data after adding transaction
        
        // Update daily usage count
        setDailyUsage(prev => ({
          ...prev,
          transactions: prev.transactions + 1
        }));
      } else {
        Alert.alert('Error', response.message || 'Failed to add transaction');
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      Alert.alert('Error', 'Failed to add transaction. Please try again.');
    }
  };

  const handleTransactionPress = (transaction: PersonalTransaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetails(true);
  };

  const handleAnalyticsPress = async () => {
    if (dailyUsage.analytics > 0 && !user?.isPremium) {
      Alert.alert(
        'Premium Feature',
        'You\'ve already viewed analytics today. Upgrade to premium for unlimited access.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => console.log('Navigate to premium') }
        ]
      );
      return;
    }
    
    setShowAnalytics(true);
    
    // Update analytics usage count
    if (!user?.isPremium) {
      try {
        await apiService.post('/money/usage/analytics');
        setDailyUsage(prev => ({
          ...prev,
          analytics: prev.analytics + 1
        }));
      } catch (error) {
        console.error('Error updating analytics usage:', error);
      }
    }
  };

  const canAddTransaction = dailyUsage.transactions < 5 || user?.isPremium;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading your finances...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        backgroundColor="transparent" 
        barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
        translucent
      />
      
      {/* Modern Header with Gradient Background */}
      <Animated.View style={[styles.modernHeader, { transform: [{ translateY: headerAnim }] }]}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryDark]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {(user?.fullName?.charAt(0) || 'U').toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.welcomeText}>Good morning,</Text>
                <Text style={styles.userName}>
                  {user?.fullName?.split(' ')[0] || 'User'}!
                </Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.modernHeaderButton}
                onPress={() => setShowCalendar(true)}
              >
                <Icon name="calendar" size={22} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modernHeaderButton}
                onPress={handleAnalyticsPress}
              >
                <Icon name="analytics" size={22} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Financial Overview Cards in Header */}
          <View style={styles.headerStats}>
            <View style={styles.headerStatCard}>
              <Text style={styles.headerStatLabel}>This Month</Text>
              <Text style={styles.headerStatValue}>
                ${(analytics?.netSavings || 0).toLocaleString()}
              </Text>
              <Text style={styles.headerStatSubtext}>Net Savings</Text>
            </View>
            
            <View style={styles.headerStatDivider} />
            
            <View style={styles.headerStatCard}>
              <Text style={styles.headerStatLabel}>Savings Rate</Text>
              <Text style={styles.headerStatValue}>
                {analytics?.savingsRate?.toFixed(1) || 0}%
              </Text>
              <Text style={styles.headerStatSubtext}>Of Income</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
      
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

        <ScrollView
          style={styles.modernScrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              progressBackgroundColor={theme.colors.surface}
            />
          }
        >
          {/* Modern Action Cards */}
          <View style={styles.modernActionsContainer}>
            <TouchableOpacity
              style={[
                styles.modernActionCard,
                styles.addTransactionCard,
                { 
                  backgroundColor: canAddTransaction 
                    ? theme.colors.primary 
                    : theme.colors.disabled,
                  shadowColor: theme.colors.primary
                }
              ]}
              onPress={() => canAddTransaction && setShowAddTransaction(true)}
              disabled={!canAddTransaction}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={canAddTransaction 
                  ? [theme.colors.primary, theme.colors.primaryDark] 
                  : [theme.colors.disabled, theme.colors.disabled]
                }
                style={styles.modernActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.actionCardContent}>
                  <View style={styles.actionIconContainer}>
                    <Icon name="add" size={28} color="white" />
                  </View>
                  <Text style={styles.actionCardTitle}>Add Transaction</Text>
                  <Text style={styles.actionCardSubtitle}>
                    {canAddTransaction 
                      ? 'Track your income & expenses' 
                      : `${5 - dailyUsage.transactions} left today`
                    }
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={[styles.modernActionCard, styles.secondaryActionCard, { backgroundColor: theme.colors.surface }]}
                onPress={() => setShowAnalytics(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.secondaryActionIcon, { backgroundColor: theme.colors.success }]}>
                  <Icon name="analytics" size={24} color="white" />
                </View>
                <Text style={[styles.secondaryActionTitle, { color: theme.colors.text }]}>Analytics</Text>
                <Text style={[styles.secondaryActionSubtitle, { color: theme.colors.textSecondary }]}>View insights</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modernActionCard, styles.secondaryActionCard, { backgroundColor: theme.colors.surface }]}
                onPress={() => setShowCalendar(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.secondaryActionIcon, { backgroundColor: theme.colors.warning }]}>
                  <Icon name="calendar" size={24} color="white" />
                </View>
                <Text style={[styles.secondaryActionTitle, { color: theme.colors.text }]}>Calendar</Text>
                <Text style={[styles.secondaryActionSubtitle, { color: theme.colors.textSecondary }]}>View monthly</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Income vs Expenses Overview */}
          <View style={styles.modernOverviewContainer}>
            <Text style={[styles.modernSectionTitle, { color: theme.colors.text }]}>
              Financial Overview
            </Text>
            
            <View style={styles.overviewCards}>
              <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.overviewIconContainer, { backgroundColor: theme.colors.success }]}>
                  <Icon name="trending-up" size={20} color="white" />
                </View>
                <Text style={[styles.overviewAmount, { color: theme.colors.success }]}>
                  +${(analytics?.totalIncome || 0).toLocaleString()}
                </Text>
                <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>
                  Total Income
                </Text>
                <View style={styles.trendContainer}>
                  <Icon name="trending-up" size={12} color={theme.colors.success} />
                  <Text style={[styles.trendText, { color: theme.colors.success }]}>+5.2%</Text>
                </View>
              </View>

              <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.overviewIconContainer, { backgroundColor: theme.colors.error }]}>
                  <Icon name="trending-down" size={20} color="white" />
                </View>
                <Text style={[styles.overviewAmount, { color: theme.colors.error }]}>
                  -${(analytics?.totalExpenses || 0).toLocaleString()}
                </Text>
                <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>
                  Total Expenses
                </Text>
                <View style={styles.trendContainer}>
                  <Icon name="trending-down" size={12} color={theme.colors.error} />
                  <Text style={[styles.trendText, { color: theme.colors.error }]}>-2.1%</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Modern Recent Transactions */}
          <View style={styles.modernTransactionsContainer}>
            <View style={styles.modernSectionHeader}>
              <Text style={[styles.modernSectionTitle, { color: theme.colors.text }]}>
                Recent Activity
              </Text>
              <TouchableOpacity 
                style={[styles.viewAllButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => console.log('View all transactions')}
              >
                <Text style={styles.viewAllButtonText}>View All</Text>
                <Icon name="forward" size={14} color="white" />
              </TouchableOpacity>
            </View>
            
            {transactions.length === 0 ? (
              <View style={[styles.modernEmptyState, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.emptyStateIconContainer, { backgroundColor: theme.colors.primaryLight }]}>
                  <Icon name="receipt" size={32} color={theme.colors.primary} />
                </View>
                <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
                  Start Your Financial Journey
                </Text>
                <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]}>
                  Add your first transaction to begin tracking your finances
                </Text>
                <TouchableOpacity
                  style={[styles.emptyStateButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => canAddTransaction && setShowAddTransaction(true)}
                >
                  <Text style={styles.emptyStateButtonText}>Add Transaction</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.modernTransactionsList, { backgroundColor: theme.colors.surface }]}>
                {transactions.slice(0, 4).map((transaction, index) => (
                  <View key={transaction.id}>
                    <RecentTransactionItem
                      transaction={transaction}
                      onPress={handleTransactionPress}
                    />
                    {index < transactions.slice(0, 4).length - 1 && (
                      <View style={[styles.transactionDivider, { backgroundColor: theme.colors.border }]} />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Modern AI Insights */}
          {analytics?.aiInsights && analytics.aiInsights.length > 0 && (
            <View style={styles.modernInsightsContainer}>
              <Text style={[styles.modernSectionTitle, { color: theme.colors.text }]}>
                Smart Insights
              </Text>
              
              {analytics.aiInsights.slice(0, 2).map((insight, index) => (
                <View key={insight.id} style={[
                  styles.modernInsightCard, 
                  { backgroundColor: theme.colors.surface }
                ]}>
                  <LinearGradient
                    colors={[
                      insight.type === 'positive' ? theme.colors.success : 
                      insight.type === 'warning' ? theme.colors.warning : 
                      theme.colors.primary,
                      'rgba(255,255,255,0.1)'
                    ]}
                    style={styles.insightGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View style={styles.modernInsightContent}>
                      <View style={[
                        styles.modernInsightIconContainer,
                        { backgroundColor: 'rgba(255,255,255,0.2)' }
                      ]}>
                        <Text style={styles.modernInsightIcon}>{insight.icon}</Text>
                      </View>
                      <View style={styles.modernInsightText}>
                        <Text style={[styles.modernInsightTitle, { color: 'white' }]}>
                          {insight.title}
                        </Text>
                        <Text style={[styles.modernInsightDescription, { color: 'rgba(255,255,255,0.9)' }]}>
                          {insight.description}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </View>
          )}

          {/* Bottom spacing for tab navigation */}
          <View style={styles.modernBottomSpacing} />
        </ScrollView>
      </Animated.View>

      {/* Modals */}
      <AddTransactionModal
        visible={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        onSubmit={handleAddTransaction}
      />
      
      <TransactionDetailsModal
        visible={showTransactionDetails}
        transaction={selectedTransaction}
        onClose={() => setShowTransactionDetails(false)}
        onEdit={() => {
          setShowTransactionDetails(false);
          setShowAddTransaction(true);
        }}
        onDelete={async (id) => {
          try {
            const response = await apiService.delete(`/money/transactions/${id}`);
            if (response.success) {
              setShowTransactionDetails(false);
              await onRefresh();
            } else {
              Alert.alert('Error', response.message || 'Failed to delete transaction');
            }
          } catch (error) {
            console.error('Error deleting transaction:', error);
            Alert.alert('Error', 'Failed to delete transaction. Please try again.');
          }
        }}
      />
      
      <AnalyticsModal
        visible={showAnalytics}
        analytics={analytics}
        onClose={() => setShowAnalytics(false)}
      />
      
      <CalendarViewModal
        visible={showCalendar}
        transactions={transactions}
        onClose={() => setShowCalendar(false)}
      />
    </SafeAreaView>
  );
};

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
  content: {
    flex: 1,
  },
  // Modern Header Styles
  modernHeader: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modernHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  headerStatCard: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 4,
  },
  headerStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  headerStatSubtext: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  headerStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 20,
  },
  // Modern Scroll View
  modernScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Modern Action Cards
  modernActionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 24,
  },
  modernActionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  addTransactionCard: {
    marginBottom: 16,
  },
  modernActionGradient: {
    padding: 24,
    minHeight: 120,
    justifyContent: 'center',
  },
  actionCardContent: {
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  actionCardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryActionCard: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    minHeight: 100,
  },
  secondaryActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  secondaryActionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quickStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  netSavingsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  netSavingsGradient: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  netSavingsContent: {
    flex: 1,
  },
  netSavingsLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  netSavingsAmount: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  savingsRate: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  netSavingsIcon: {
    marginLeft: 16,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickActions: {
    gap: 12,
  },
  actionButton: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  limitText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  recentTransactionsContainer: {
    paddingHorizontal: 20,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionIconText: {
    fontSize: 24,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionCategory: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  insightsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  insightCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 100,
  },
  // Modern Overview Styles
  modernOverviewContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modernSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  overviewCards: {
    flexDirection: 'row',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  overviewIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  // Modern Transactions Styles
  modernTransactionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modernSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  viewAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  modernEmptyState: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
  },
  emptyStateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyStateButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  modernTransactionsList: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  transactionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
  },
  // Modern Insights Styles
  modernInsightsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modernInsightCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  insightGradient: {
    padding: 20,
  },
  modernInsightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernInsightIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modernInsightIcon: {
    fontSize: 24,
  },
  modernInsightText: {
    flex: 1,
  },
  modernInsightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modernInsightDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  modernBottomSpacing: {
    height: 120,
  },
});

export default MoneyManagementScreen;