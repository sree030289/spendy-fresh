// src/components/modals/AnalyticsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { useTheme } from '@/hooks/useTheme';
import { SplittingService, ExpenseAnalytics } from '@/services/firebase/splitting';
import { getCurrencySymbol } from '@/utils/currency';
import { User } from '@/types';

interface AnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
}

const screenWidth = Dimensions.get('window').width;

const TIMEFRAME_OPTIONS = [
  { value: 'week', label: 'Week', icon: 'calendar-outline' },
  { value: 'month', label: 'Month', icon: 'calendar' },
  { value: 'quarter', label: 'Quarter', icon: 'calendar-sharp' },
  { value: 'year', label: 'Year', icon: 'calendar-number' },
];

const CHART_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
];

export default function AnalyticsModal({ visible, onClose, currentUser }: AnalyticsModalProps) {
  const { theme } = useTheme();
  const [analytics, setAnalytics] = useState<ExpenseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [activeChart, setActiveChart] = useState<'spending' | 'categories' | 'trends'>('spending');

  useEffect(() => {
    if (visible && currentUser) {
      loadAnalytics();
    }
  }, [visible, currentUser, selectedTimeframe]);

  const loadAnalytics = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const data = await SplittingService.getExpenseAnalytics(currentUser.id, selectedTimeframe);
      setAnalytics(data);
    } catch (error) {
      console.error('Load analytics error:', error);
    } finally {
      setLoading(false);
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

  const renderChartSelector = () => (
    <View style={styles.chartSelector}>
      <TouchableOpacity
        style={[
          styles.chartOption,
          activeChart === 'spending' && [styles.activeChartOption, { backgroundColor: theme.colors.primary + '20' }]
        ]}
        onPress={() => setActiveChart('spending')}
      >
        <Ionicons
          name="pie-chart"
          size={16}
          color={activeChart === 'spending' ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text style={[
          styles.chartOptionText,
          { color: activeChart === 'spending' ? theme.colors.primary : theme.colors.textSecondary }
        ]}>
          Spending
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.chartOption,
          activeChart === 'categories' && [styles.activeChartOption, { backgroundColor: theme.colors.primary + '20' }]
        ]}
        onPress={() => setActiveChart('categories')}
      >
        <Ionicons
          name="bar-chart"
          size={16}
          color={activeChart === 'categories' ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text style={[
          styles.chartOptionText,
          { color: activeChart === 'categories' ? theme.colors.primary : theme.colors.textSecondary }
        ]}>
          Categories
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.chartOption,
          activeChart === 'trends' && [styles.activeChartOption, { backgroundColor: theme.colors.primary + '20' }]
        ]}
        onPress={() => setActiveChart('trends')}
      >
        <Ionicons
          name="analytics"
          size={16}
          color={activeChart === 'trends' ? theme.colors.primary : theme.colors.textSecondary}
        />
        <Text style={[
          styles.chartOptionText,
          { color: activeChart === 'trends' ? theme.colors.primary : theme.colors.textSecondary }
        ]}>
          Trends
        </Text>
      </TouchableOpacity>
    </View>
  );

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

  const renderGroupAnalytics = () => {
    if (!analytics || analytics.groupAnalytics.length === 0) return null;

    return (
      <View style={[styles.topExpensesContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Group Spending
        </Text>
        {analytics.groupAnalytics.slice(0, 5).map((group: { groupName: string; totalSpent: number; memberCount: number }, index: number) => (
          <View key={index} style={styles.topExpenseItem}>
            <View style={styles.topExpenseLeft}>
              <View style={[styles.expenseRank, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.expenseRankText}>{index + 1}</Text>
              </View>
              <View>
                <Text style={[styles.expenseDescription, { color: theme.colors.text }]}>
                  {group.groupName}
                </Text>
                <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
                  {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
              {getCurrencySymbol(currentUser?.currency || 'USD')}{group.totalSpent.toFixed(2)}
            </Text>
          </View>
        ))}
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Expense Analytics
          </Text>
          <TouchableOpacity onPress={loadAnalytics}>
            <Ionicons name="refresh" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Timeframe Selector */}
        {renderTimeframeSelector()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Analyzing your expenses...
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {/* Summary Cards */}
            {renderSummaryCards()}

            {/* Chart Selector */}
            {renderChartSelector()}

            {/* Charts */}
            {activeChart === 'spending' && renderSpendingChart()}
            {activeChart === 'categories' && renderCategoriesChart()}
            {activeChart === 'trends' && renderTrendsChart()}

            {/* Top Expenses */}
            {renderGroupAnalytics()}

            {/* Insights */}
            {renderInsights()}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
});