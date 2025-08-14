import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
// Icon import handled by existing Icon component
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { PersonalAnalytics } from '@/types/moneyManagement';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AnalyticsModalProps {
  visible: boolean;
  analytics: PersonalAnalytics | null;
  onClose: () => void;
}

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
        styles.tabButton,
        isActive && [styles.activeTab, { backgroundColor: theme.colors.primary }],
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
      ]}
    >
      <Icon
        name={icon as any}
        size={20}
        color={isActive ? 'white' : theme.colors.textSecondary}
      />
      <Text style={[
        styles.tabText,
        { color: isActive ? 'white' : theme.colors.textSecondary }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ visible, analytics, onClose }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'spending' | 'income' | 'trends'>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  if (!analytics) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              Loading analytics...
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
      <TouchableOpacity onPress={onClose}>
        <Icon name="close" size={24} color={theme.colors.text} />
      </TouchableOpacity>
      
      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
        Financial Analytics
      </Text>
      
      <TouchableOpacity>
        <Icon name="share-outline" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderPeriodSelector = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.periodSelector}
    >
      {[
        { key: 'week', label: '7 Days' },
        { key: 'month', label: '30 Days' },
        { key: 'quarter', label: '3 Months' },
        { key: 'year', label: '1 Year' },
      ].map((period) => (
        <TouchableOpacity
          key={period.key}
          style={[
            styles.periodButton,
            selectedPeriod === period.key && [
              styles.activePeriod, 
              { backgroundColor: theme.colors.primary }
            ],
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
          ]}
          onPress={() => setSelectedPeriod(period.key as any)}
        >
          <Text style={[
            styles.periodText,
            { 
              color: selectedPeriod === period.key 
                ? 'white' 
                : theme.colors.text 
            }
          ]}>
            {period.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TabButton
        title="Overview"
        icon="stats-chart"
        isActive={activeTab === 'overview'}
        onPress={() => setActiveTab('overview')}
      />
      <TabButton
        title="Spending"
        icon="trending-down"
        isActive={activeTab === 'spending'}
        onPress={() => setActiveTab('spending')}
      />
      <TabButton
        title="Income"
        icon="trending-up"
        isActive={activeTab === 'income'}
        onPress={() => setActiveTab('income')}
      />
      <TabButton
        title="Trends"
        icon="analytics"
        isActive={activeTab === 'trends'}
        onPress={() => setActiveTab('trends')}
      />
    </View>
  );

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.colors.success }]}>
              <Icon name="trending-up" size={24} color="white" />
            </View>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Total Income
            </Text>
            <Text style={[styles.summaryAmount, { color: theme.colors.text }]}>
              ${analytics.totalIncome.toLocaleString()}
            </Text>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.colors.error }]}>
              <Icon name="trending-down" size={24} color="white" />
            </View>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
              Total Expenses
            </Text>
            <Text style={[styles.summaryAmount, { color: theme.colors.text }]}>
              ${analytics.totalExpenses.toLocaleString()}
            </Text>
          </View>
        </View>
        
        <View style={[styles.netSavingsCard, { backgroundColor: theme.colors.surface }]}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDark]}
            style={styles.netSavingsGradient}
          >
            <View style={styles.netSavingsContent}>
              <Text style={styles.netSavingsLabel}>Net Savings</Text>
              <Text style={styles.netSavingsAmount}>
                ${analytics.netSavings.toLocaleString()}
              </Text>
              <Text style={styles.savingsRate}>
                {analytics.savingsRate.toFixed(1)}% of income
              </Text>
            </View>
            <View style={styles.savingsIcon}>
              <Icon name="wallet" size={32} color="rgba(255,255,255,0.8)" />
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* AI Insights */}
      {analytics.aiInsights && analytics.aiInsights.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            AI Insights
          </Text>
          {analytics.aiInsights.map((insight) => (
            <View key={insight.id} style={[
              styles.insightCard,
              { backgroundColor: theme.colors.surface }
            ]}>
              <View style={styles.insightHeader}>
                <View style={[
                  styles.insightIconContainer,
                  { 
                    backgroundColor: insight.type === 'positive' ? theme.colors.success :
                                   insight.type === 'warning' ? theme.colors.warning :
                                   insight.type === 'alert' ? theme.colors.error :
                                   theme.colors.primary
                  }
                ]}>
                  <Text style={styles.insightEmoji}>{insight.icon}</Text>
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
            </View>
          ))}
        </View>
      )}

      {/* Quick Category Overview */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Top Spending Categories
        </Text>
        {analytics.categoryBreakdown.slice(0, 5).map((category, index) => (
          <View key={category.category} style={styles.categoryItem}>
            <View style={styles.categoryLeft}>
              <View style={[
                styles.categoryColorBar,
                { backgroundColor: category.color }
              ]} />
              <Text style={styles.categoryEmoji}>{category.icon}</Text>
              <View>
                <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                  {category.category}
                </Text>
                <Text style={[styles.categoryCount, { color: theme.colors.textSecondary }]}>
                  {category.transactionCount} transactions
                </Text>
              </View>
            </View>
            <View style={styles.categoryRight}>
              <Text style={[styles.categoryAmount, { color: theme.colors.text }]}>
                ${category.amount.toLocaleString()}
              </Text>
              <Text style={[styles.categoryPercentage, { color: theme.colors.textSecondary }]}>
                {category.percentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderSpendingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Detailed Category List */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          All Categories
        </Text>
        {analytics.categoryBreakdown.map((category, index) => (
          <View key={category.category} style={[
            styles.detailedCategoryItem,
            { backgroundColor: theme.colors.surface }
          ]}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryTitleRow}>
                <Text style={styles.categoryEmoji}>{category.icon}</Text>
                <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                  {category.category}
                </Text>
                <View style={[
                  styles.trendIndicator,
                  { 
                    backgroundColor: category.trend === 'up' ? theme.colors.error :
                                   category.trend === 'down' ? theme.colors.success :
                                   theme.colors.textSecondary
                  }
                ]}>
                  <Icon 
                    name={category.trend === 'up' ? 'trending-up' : 
                          category.trend === 'down' ? 'trending-down' : 
                          'remove'} 
                    size={12} 
                    color="white" 
                  />
                </View>
              </View>
              <Text style={[styles.categoryAmount, { color: theme.colors.text }]}>
                ${category.amount.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.categoryDetails}>
              <View style={styles.categoryStats}>
                <Text style={[styles.categorySubtext, { color: theme.colors.textSecondary }]}>
                  {category.transactionCount} transactions
                </Text>
                <Text style={[styles.categorySubtext, { color: theme.colors.textSecondary }]}>
                  Avg: ${category.averageAmount.toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      backgroundColor: category.color,
                      width: `${Math.min(category.percentage, 100)}%`
                    }
                  ]}
                />
              </View>
              
              <Text style={[styles.categoryPercentage, { color: theme.colors.textSecondary }]}>
                {category.percentage.toFixed(1)}% of total spending
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderIncomeTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Income Sources
        </Text>
        {analytics.incomeBreakdown.map((income, index) => (
          <View key={income.category} style={[
            styles.detailedCategoryItem,
            { backgroundColor: theme.colors.surface }
          ]}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryTitleRow}>
                <Text style={styles.categoryEmoji}>{income.icon}</Text>
                <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                  {income.category}
                </Text>
              </View>
              <Text style={[styles.categoryAmount, { color: theme.colors.success }]}>
                +${income.amount.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.categoryDetails}>
              <View style={styles.categoryStats}>
                <Text style={[styles.categorySubtext, { color: theme.colors.textSecondary }]}>
                  {income.transactionCount} transactions
                </Text>
                <Text style={[styles.categorySubtext, { color: theme.colors.textSecondary }]}>
                  Avg: ${income.averageAmount.toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      backgroundColor: theme.colors.success,
                      width: `${Math.min(income.percentage, 100)}%`
                    }
                  ]}
                />
              </View>
              
              <Text style={[styles.categoryPercentage, { color: theme.colors.textSecondary }]}>
                {income.percentage.toFixed(1)}% of total income
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderTrendsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Monthly Details */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Monthly Details
        </Text>
        {analytics.monthlyTrends.slice(-6).reverse().map((trend, index) => (
          <View key={trend.month} style={[
            styles.trendItem,
            { backgroundColor: theme.colors.surface }
          ]}>
            <View style={styles.trendHeader}>
              <Text style={[styles.trendMonth, { color: theme.colors.text }]}>
                {trend.month}
              </Text>
              <Text style={[
                styles.trendSavings,
                { 
                  color: trend.savings >= 0 ? theme.colors.success : theme.colors.error 
                }
              ]}>
                ${Math.abs(trend.savings).toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.trendDetails}>
              <View style={styles.trendRow}>
                <Text style={[styles.trendLabel, { color: theme.colors.textSecondary }]}>
                  Income
                </Text>
                <Text style={[styles.trendValue, { color: theme.colors.success }]}>
                  ${trend.income.toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.trendRow}>
                <Text style={[styles.trendLabel, { color: theme.colors.textSecondary }]}>
                  Expenses
                </Text>
                <Text style={[styles.trendValue, { color: theme.colors.error }]}>
                  ${trend.expenses.toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.trendRow}>
                <Text style={[styles.trendLabel, { color: theme.colors.textSecondary }]}>
                  Savings Rate
                </Text>
                <Text style={[styles.trendValue, { color: theme.colors.text }]}>
                  {trend.savingsRate.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'spending':
        return renderSpendingTab();
      case 'income':
        return renderIncomeTab();
      case 'trends':
        return renderTrendsTab();
      default:
        return renderOverviewTab();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderHeader()}
        {renderPeriodSelector()}
        {renderTabs()}
        {renderContent()}
      </SafeAreaView>
    </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  periodSelector: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
  },
  activePeriod: {
    borderColor: 'transparent',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  activeTab: {
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  netSavingsCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  netSavingsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  savingsRate: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  savingsIcon: {
    marginLeft: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  insightCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightEmoji: {
    fontSize: 20,
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
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryColorBar: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 12,
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 12,
  },
  detailedCategoryItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  categoryDetails: {
    gap: 8,
  },
  categoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categorySubtext: {
    fontSize: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  trendItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendMonth: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trendSavings: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trendDetails: {
    gap: 8,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: 14,
  },
  trendValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AnalyticsModal;
