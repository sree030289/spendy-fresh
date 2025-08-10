// src/components/modals/AnalyticsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { useTheme } from '@/hooks/useTheme';
import { SplittingService, ExpenseAnalytics } from '@/services/firebase/splitting-disabled';
import { getCurrencySymbol } from '@/utils/currency';
import { User } from '@/types';
import FullscreenModal from '@/components/common/FullscreenModal';

interface AnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
  groupId?: string; // Optional group filter
}

interface GroupAnalytics extends ExpenseAnalytics {
  groupName?: string;
  groupMemberCount?: number;
}

const screenWidth = Dimensions.get('window').width;

const TIMEFRAME_OPTIONS = [
  { value: 'week', label: 'Week', icon: 'calendar-outline' },
  { value: 'month', label: 'Month', icon: 'calendar' },
  { value: 'quarter', label: 'Quarter', icon: 'calendar-sharp' },
  { value: 'year', label: 'Year', icon: 'calendar-number' },
];

const VIEW_OPTIONS = [
  { value: 'overview', label: 'Overview', icon: 'analytics' },
  { value: 'groups', label: 'Groups', icon: 'people' },
  { value: 'trends', label: 'Trends', icon: 'trending-up' },
];

const CHART_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
];

export default function AnalyticsModal({ visible, onClose, currentUser, groupId }: AnalyticsModalProps) {
  const { theme } = useTheme();
  const [analytics, setAnalytics] = useState<ExpenseAnalytics | null>(null);
  const [groupAnalytics, setGroupAnalytics] = useState<{ [groupId: string]: GroupAnalytics }>({});
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [activeView, setActiveView] = useState<'overview' | 'groups' | 'trends'>('overview');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && currentUser) {
      loadAnalytics();
    }
  }, [visible, currentUser, selectedTimeframe]);

  const loadAnalytics = async () => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);
    try {
      console.log('Loading analytics for user:', currentUser.id, 'timeframe:', selectedTimeframe);
      
      // Load overall analytics
      const data = await SplittingService.getExpenseAnalytics(currentUser.id, selectedTimeframe);
      console.log('Analytics data loaded:', data);
      setAnalytics(data);

      // Load group-specific analytics if no specific group is selected
      if (!groupId) {
        await loadGroupAnalytics();
      }
    } catch (error) {
      console.error('Load analytics error:', error);
      setError('Failed to load analytics. Please try again.');
      // Set empty analytics to prevent undefined errors
      setAnalytics({
        totalSpent: 0,
        totalOwed: 0,
        totalOwing: 0,
        averageExpense: 0,
        expenseCount: 0,
        monthlySpending: [],
        categoryBreakdown: [],
        groupAnalytics: [],
        splitWithMostFrequent: { userId: '', userName: '', count: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGroupAnalytics = async () => {
    if (!currentUser) return;

    try {
      console.log('Loading group analytics for user:', currentUser.id);
      
      // Get user's groups
      const userGroups = await SplittingService.getUserGroups(currentUser.id);
      const groupAnalyticsData: { [groupId: string]: GroupAnalytics } = {};

      console.log('Found user groups:', userGroups.length);

      // Load analytics for each group
      for (const group of userGroups) {
        try {
          console.log('Loading analytics for group:', group.name, group.id);
          
          // Get group-specific analytics by filtering
          const groupExpenses = await SplittingService.getGroupExpenses(group.id);
          
          // Calculate group analytics manually to ensure consistency
          const userGroupExpenses = groupExpenses.filter(expense => 
            expense.paidBy === currentUser.id || 
            expense.splitData?.some(split => split.userId === currentUser.id)
          );

          // Filter by timeframe
          const now = new Date();
          const startDate = new Date();
          switch (selectedTimeframe) {
            case 'week':
              startDate.setDate(now.getDate() - 7);
              break;
            case 'month':
              startDate.setMonth(now.getMonth() - 1);
              break;
            case 'quarter':
              startDate.setMonth(now.getMonth() - 3);
              break;
            case 'year':
              startDate.setFullYear(now.getFullYear() - 1);
              break;
          }

          const filteredExpenses = userGroupExpenses.filter(expense => {
            // Safe date parsing
            let expenseDate;
            try {
              if (expense.date instanceof Date) {
                expenseDate = expense.date;
              } else if (expense.date && typeof expense.date === 'object' && 'toDate' in expense.date) {
                expenseDate = (expense.date as any).toDate();
              } else {
                expenseDate = new Date(expense.date);
              }
              
              if (isNaN(expenseDate.getTime())) {
                expenseDate = new Date();
              }
            } catch (dateError) {
              console.warn('Date parsing error for expense:', expense.id, dateError);
              expenseDate = new Date();
            }

            return expenseDate >= startDate && expenseDate <= now;
          });

          // Calculate totals
          let totalSpent = 0;
          let totalOwed = 0;
          let totalOwing = 0;
          const categoryData: { [category: string]: number } = {};

          filteredExpenses.forEach(expense => {
            if (expense.paidBy === currentUser.id) {
              totalSpent += expense.amount || 0;
            }

            const userSplit = expense.splitData?.find(split => split.userId === currentUser.id);
            if (userSplit) {
              if (expense.paidBy === currentUser.id) {
                const othersOwe = (expense.amount || 0) - (userSplit.amount || 0);
                totalOwed += othersOwe;
              } else if (!userSplit.isPaid) {
                totalOwing += userSplit.amount || 0;
              }
            }

            // Category breakdown
            if (expense.paidBy === currentUser.id) {
              const category = expense.category || 'Other';
              categoryData[category] = (categoryData[category] || 0) + (expense.amount || 0);
            }
          });

          const categoryBreakdown = Object.entries(categoryData)
            .map(([category, amount]) => ({
              category,
              amount,
              percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0
            }))
            .sort((a, b) => b.amount - a.amount);

          groupAnalyticsData[group.id] = {
            totalSpent: totalSpent || 0,
            totalOwed: totalOwed || 0,
            totalOwing: totalOwing || 0,
            averageExpense: filteredExpenses.length > 0 ? totalSpent / filteredExpenses.filter(e => e.paidBy === currentUser.id).length : 0,
            expenseCount: filteredExpenses.filter(e => e.paidBy === currentUser.id).length,
            monthlySpending: [], // Simplified for now
            categoryBreakdown,
            groupAnalytics: [],
            splitWithMostFrequent: { userId: '', userName: '', count: 0 },
            groupName: group.name,
            groupMemberCount: group.members.length
          };
          
          console.log('Group analytics calculated for', group.name, ':', groupAnalyticsData[group.id]);
        } catch (groupError) {
          console.error(`Error loading analytics for group ${group.id}:`, groupError);
          // Add fallback data for this group
          groupAnalyticsData[group.id] = {
            totalSpent: 0,
            totalOwed: 0,
            totalOwing: 0,
            averageExpense: 0,
            expenseCount: 0,
            monthlySpending: [],
            categoryBreakdown: [],
            groupAnalytics: [],
            splitWithMostFrequent: { userId: '', userName: '', count: 0 },
            groupName: group.name,
            groupMemberCount: group.members.length
          };
        }
      }

      console.log('Setting group analytics data:', Object.keys(groupAnalyticsData).length, 'groups');
      setGroupAnalytics(groupAnalyticsData);
    } catch (error) {
      console.error('Load group analytics error:', error);
      setGroupAnalytics({});
    }
  };

  const renderTimeframeSelector = () => (
    <View style={styles.timeframeSelector}>
      {TIMEFRAME_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.timeframeOption,
            selectedTimeframe === option.value && [
              styles.selectedTimeframe,
              { backgroundColor: theme.colors.primary + '20' }
            ]
          ]}
          onPress={() => setSelectedTimeframe(option.value as any)}
        >
          <Ionicons
            name={option.icon as any}
            size={16}
            color={selectedTimeframe === option.value ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text style={[
            styles.timeframeText,
            { color: selectedTimeframe === option.value ? theme.colors.primary : theme.colors.textSecondary }
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderViewSelector = () => (
    <View style={styles.viewSelector}>
      {VIEW_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.viewOption,
            activeView === option.value && [
              styles.selectedView,
              { backgroundColor: theme.colors.primary + '20' }
            ]
          ]}
          onPress={() => setActiveView(option.value as any)}
        >
          <Ionicons
            name={option.icon as any}
            size={16}
            color={activeView === option.value ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text style={[
            styles.viewText,
            { color: activeView === option.value ? theme.colors.primary : theme.colors.textSecondary }
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSummaryCards = () => {
    if (!analytics) return null;

    const currency = getCurrencySymbol(currentUser?.currency || 'USD');

    return (
      <View style={styles.summaryCards}>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.summaryIcon, { backgroundColor: theme.colors.primary + '20' }]}>
            <Ionicons name="wallet" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.summaryContent}>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {currency}{analytics.totalSpent.toFixed(2)}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Total Spent
            </Text>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.summaryIcon, { backgroundColor: theme.colors.success + '20' }]}>
            <Ionicons name="trending-up" size={24} color={theme.colors.success} />
          </View>
          <View style={styles.summaryContent}>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {currency}{analytics.averageExpense.toFixed(2)}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Average Expense
            </Text>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.summaryIcon, { backgroundColor: theme.colors.secondary + '20' }]}>
            <Ionicons name="receipt" size={24} color={theme.colors.secondary} />
          </View>
          <View style={styles.summaryContent}>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {analytics.expenseCount}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Total Expenses
            </Text>
          </View>
        </View>

        {analytics.splitWithMostFrequent.count > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="people" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.summaryContent}>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {analytics.splitWithMostFrequent.userName}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Most Split With ({analytics.splitWithMostFrequent.count}x)
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderOverview = () => {
    if (!analytics) return null;

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Spending Chart */}
        {renderSpendingChart()}

        {/* Top Categories */}
        {renderCategoriesChart()}

        {/* Insights */}
        {renderInsights()}
      </ScrollView>
    );
  };

  const renderGroupsView = () => {
    const currency = getCurrencySymbol(currentUser?.currency || 'USD');

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.groupsContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Group Analytics
          </Text>
          
          {Object.entries(groupAnalytics).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                No group data available
              </Text>
            </View>
          ) : (
            Object.entries(groupAnalytics).map(([groupId, groupData]) => (
              <View key={groupId} style={[styles.groupCard, { backgroundColor: theme.colors.background }]}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, { color: theme.colors.text }]}>
                      {groupData.groupName || 'Unknown Group'}
                    </Text>
                    <Text style={[styles.groupMembers, { color: theme.colors.textSecondary }]}>
                      {groupData.groupMemberCount || 0} members
                    </Text>
                  </View>
                  <Text style={[styles.groupTotal, { color: theme.colors.primary }]}>
                    {currency}{groupData.totalSpent.toFixed(2)}
                  </Text>
                </View>
                
                <View style={styles.groupStats}>
                  <View style={styles.groupStat}>
                    <Text style={[styles.statValue, { color: theme.colors.text }]}>
                      {groupData.expenseCount}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                      Expenses
                    </Text>
                  </View>
                  <View style={styles.groupStat}>
                    <Text style={[styles.statValue, { color: theme.colors.success }]}>
                      {currency}{groupData.totalOwed.toFixed(2)}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                      You're Owed
                    </Text>
                  </View>
                  <View style={styles.groupStat}>
                    <Text style={[styles.statValue, { color: theme.colors.error }]}>
                      {currency}{groupData.totalOwing.toFixed(2)}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                      You Owe
                    </Text>
                  </View>
                </View>

                {/* Top Categories for this group */}
                {groupData.categoryBreakdown.length > 0 && (
                  <View style={styles.groupCategories}>
                    <Text style={[styles.categoriesTitle, { color: theme.colors.text }]}>
                      Top Categories
                    </Text>
                    {groupData.categoryBreakdown.slice(0, 3).map((category, index) => (
                      <View key={category.category} style={styles.categoryItem}>
                        <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                          {category.category}
                        </Text>
                        <Text style={[styles.categoryAmount, { color: theme.colors.textSecondary }]}>
                          {currency}{category.amount.toFixed(2)} ({category.percentage.toFixed(1)}%)
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  const renderTrendsView = () => {
    if (!analytics) return null;

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Trends Chart */}
        {renderTrendsChart()}

        {/* Spending Patterns */}
        {renderSpendingChart()}
      </ScrollView>
    );
  };

  const renderSpendingChart = () => {
    if (!analytics || analytics.categoryBreakdown.length === 0) {
      return (
        <View style={[styles.emptyChart, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="pie-chart-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyChartText, { color: theme.colors.textSecondary }]}>
            No spending data available
          </Text>
        </View>
      );
    }

    const pieData = analytics.categoryBreakdown
      .map((item, index) => ({
        name: item.category.charAt(0).toUpperCase() + item.category.slice(1),
        amount: item.amount,
        color: CHART_COLORS[index % CHART_COLORS.length],
        legendFontColor: theme.colors.text,
        legendFontSize: 12,
      }))
      .filter(item => item.amount > 0);

    return (
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.chartTitle, { color: theme.colors.text }]}>
          Spending by Category
        </Text>
        <PieChart
          data={pieData}
          width={screenWidth - 80}
          height={220}
          chartConfig={{
            backgroundColor: theme.colors.surface,
            backgroundGradientFrom: theme.colors.surface,
            backgroundGradientTo: theme.colors.surface,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft="15"
          center={[10, 10]}
          absolute
        />
      </View>
    );
  };

  const renderCategoriesChart = () => {
    if (!analytics || analytics.categoryBreakdown.length === 0) {
      return (
        <View style={[styles.emptyChart, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="bar-chart-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyChartText, { color: theme.colors.textSecondary }]}>
            No category data available
          </Text>
        </View>
      );
    }

    const barData = {
      labels: analytics.categoryBreakdown
        .slice(0, 6) // Limit to top 6 categories
        .map(item => item.category.charAt(0).toUpperCase() + item.category.slice(1)),
      datasets: [{
        data: analytics.categoryBreakdown
          .slice(0, 6)
          .map(item => item.amount)
      }]
    };

    return (
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.chartTitle, { color: theme.colors.text }]}>
          Top Categories
        </Text>
        <BarChart
          data={barData}
          width={screenWidth - 80}
          height={220}
          yAxisLabel="$"
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: theme.colors.surface,
            backgroundGradientFrom: theme.colors.surface,
            backgroundGradientTo: theme.colors.surface,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
            labelColor: (opacity = 1) => theme.colors.text,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: theme.colors.primary
            }
          }}
          style={{
            marginVertical: 8,
            borderRadius: 16
          }}
        />
      </View>
    );
  };

  const renderTrendsChart = () => {
    if (!analytics || analytics.monthlySpending.length === 0) {
      return (
        <View style={[styles.emptyChart, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="analytics-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyChartText, { color: theme.colors.textSecondary }]}>
            No trend data available
          </Text>
        </View>
      );
    }

    const lineData = {
      labels: analytics.monthlySpending.map((trend: { month: string; amount: number }) => {
        const date = new Date(trend.month + '-01');
        return date.toLocaleDateString('en-US', { month: 'short' });
      }),
      datasets: [{
        data: analytics.monthlySpending.map((trend: { month: string; amount: number }) => trend.amount),
        color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
        strokeWidth: 2
      }]
    };

    return (
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.chartTitle, { color: theme.colors.text }]}>
          Spending Trends
        </Text>
        <LineChart
          data={lineData}
          width={screenWidth - 80}
          height={220}
          chartConfig={{
            backgroundColor: theme.colors.surface,
            backgroundGradientFrom: theme.colors.surface,
            backgroundGradientTo: theme.colors.surface,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
            labelColor: (opacity = 1) => theme.colors.text,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: theme.colors.primary
            }
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16
          }}
        />
      </View>
    );
  };

  const renderInsights = () => {
    if (!analytics) return null;

    const insights = [];
    const currency = getCurrencySymbol(currentUser?.currency || 'USD');

    // Spending insights
    if (analytics.totalSpent > 0 && analytics.categoryBreakdown.length > 0) {
      const topCategory = analytics.categoryBreakdown[0]; // Already sorted by amount in descending order
      
      if (topCategory) {
        insights.push({
          icon: 'pie-chart',
          title: 'Top Category',
          description: `${topCategory.category} accounts for ${topCategory.percentage.toFixed(1)}% of your spending (${currency}${topCategory.amount.toFixed(2)})`,
          color: theme.colors.primary
        });
      }
    }

    // Average expense insight
    if (analytics.averageExpense > 0) {
      insights.push({
        icon: 'trending-up',
        title: 'Average Expense',
        description: `You spend an average of ${currency}${analytics.averageExpense.toFixed(2)} per expense`,
        color: theme.colors.success
      });
    }

    // Frequency insight
    if (analytics.expenseCount > 0) {
      const frequency = selectedTimeframe === 'week' ? 'week' : 
                      selectedTimeframe === 'month' ? 'month' : 
                      selectedTimeframe === 'quarter' ? 'quarter' : 'year';
      insights.push({
        icon: 'time',
        title: 'Expense Frequency',
        description: `You recorded ${analytics.expenseCount} expense${analytics.expenseCount !== 1 ? 's' : ''} this ${frequency}`,
        color: theme.colors.secondary
      });
    }

    if (insights.length === 0) return null;

    return (
      <View style={[styles.insightsContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Insights
        </Text>
        {insights.map((insight, index) => (
          <View key={index} style={styles.insightItem}>
            <View style={[styles.insightIcon, { backgroundColor: insight.color + '20' }]}>
              <Ionicons name={insight.icon as any} size={20} color={insight.color} />
            </View>
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                {insight.title}
              </Text>
              <Text style={[styles.insightDescription, { color: theme.colors.textSecondary }]}>
                {insight.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const handleRetry = () => {
    loadAnalytics();
  };

  return (
    <FullscreenModal
      visible={visible}
      onClose={onClose}
      title={groupId ? 'Group Analytics' : 'Expense Analytics'}
      rightActions={
        <TouchableOpacity onPress={loadAnalytics}>
          <Ionicons name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      }
    >
      {/* Timeframe Selector */}
      {renderTimeframeSelector()}

      {/* View Selector */}
      {!groupId && renderViewSelector()}

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={[styles.errorTitle, { color: theme.colors.error }]}>
            Failed to Load Analytics
          </Text>
          <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Analyzing your expenses...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {activeView === 'overview' && renderOverview()}
          {activeView === 'groups' && renderGroupsView()}
          {activeView === 'trends' && renderTrendsView()}
        </ScrollView>
      )}
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  timeframeSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  timeframeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  selectedTimeframe: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeframeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    padding: 16,
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
  summaryCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContent: {
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 12,
  },
  chartSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  chartOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  activeChartOption: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chartOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyChart: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    marginBottom: 24,
  },
  emptyChartText: {
    fontSize: 16,
    marginTop: 12,
  },
  topExpensesContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  topExpenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  topExpenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  expenseRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseRankText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  expenseDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
  expenseDate: {
    fontSize: 12,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  insightsContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  viewSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  viewOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  selectedView: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  viewText: {
    fontSize: 12,
    fontWeight: '600',
  },
  groupsContainer: {
    borderRadius: 16,
    padding: 16,
  },
  groupCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  groupMembers: {
    fontSize: 12,
  },
  groupTotal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  groupStat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
  },
  groupCategories: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  categoriesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  categoryName: {
    fontSize: 12,
    flex: 1,
  },
  categoryAmount: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});