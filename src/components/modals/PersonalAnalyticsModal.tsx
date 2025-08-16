import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { PersonalAnalytics } from '@/types/moneyManagement';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PersonalAnalyticsModalProps {
  visible: boolean;
  analytics: PersonalAnalytics | null;
  onClose: () => void;
}

interface TabButtonProps {
  title: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
  color: string;
}

const TabButton: React.FC<TabButtonProps> = ({ title, icon, isActive, onPress, color }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.tabButton,
        isActive && [styles.activeTab, { backgroundColor: color }],
        !isActive && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
      ]}
    >
      <Icon
        name={icon as any}
        size={18}
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

const PersonalAnalyticsModal: React.FC<PersonalAnalyticsModalProps> = ({ visible, analytics, onClose }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'spending' | 'income' | 'insights'>('overview');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

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
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Icon name="close" size={24} color="white" />
      </TouchableOpacity>
      
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Financial Analytics</Text>
        <Text style={styles.headerSubtitle}>Your money insights</Text>
      </View>
      
      <TouchableOpacity style={styles.shareButton}>
        <Icon name="share" size={24} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>
    </LinearGradient>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TabButton
        title="Overview"
        icon="stats-chart"
        color="#4ECDC4"
        isActive={activeTab === 'overview'}
        onPress={() => setActiveTab('overview')}
      />
      <TabButton
        title="Spending"
        icon="trending-down"
        color="#FF6B6B"
        isActive={activeTab === 'spending'}
        onPress={() => setActiveTab('spending')}
      />
      <TabButton
        title="Income"
        icon="trending-up"
        color="#4ECB71"
        isActive={activeTab === 'income'}
        onPress={() => setActiveTab('income')}
      />
      <TabButton
        title="Insights"
        icon="bulb"
        color="#45B7D1"
        isActive={activeTab === 'insights'}
        onPress={() => setActiveTab('insights')}
      />
    </View>
  );

  const renderCircularProgress = (percentage: number, size: number, strokeWidth: number, color: string) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    return (
      <View style={{ width: size, height: size, position: 'relative' }}>
        {/* Background circle */}
        <View style={[styles.progressBackground, {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: theme.colors.border
        }]} />
        
        {/* Progress circle - we'll use a simple animated view for now */}
        <View style={[styles.progressForeground, {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          transform: [{ rotate: `${(percentage * 3.6)}deg` }]
        }]} />
        
        <View style={[styles.progressCenter, {
          position: 'absolute',
          top: strokeWidth,
          left: strokeWidth,
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          borderRadius: (size - strokeWidth * 2) / 2,
          justifyContent: 'center',
          alignItems: 'center'
        }]}>
          <Text style={[styles.progressText, { color: theme.colors.text }]}>
            {percentage.toFixed(0)}%
          </Text>
        </View>
      </View>
    );
  };

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Hero Stats */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.heroCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroContent}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>${analytics.netSavings.toLocaleString()}</Text>
            <Text style={styles.heroLabel}>Net Savings</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{analytics.savingsRate.toFixed(1)}%</Text>
            <Text style={styles.heroLabel}>Savings Rate</Text>
          </View>
        </View>
        
        {analytics.savingsRate > 0 && (
          <View style={styles.savingsProgress}>
            {renderCircularProgress(analytics.savingsRate, 80, 6, '#4ECDC4')}
          </View>
        )}
      </LinearGradient>

      {/* Income vs Expenses */}
      <View style={styles.comparisonContainer}>
        <View style={[styles.comparisonCard, { backgroundColor: theme.colors.surface }]}>
          <LinearGradient
            colors={['#4ECB71', '#44A08D']}
            style={styles.comparisonHeader}
          >
            <Icon name="trending" size={24} color="white" />
            <Text style={styles.comparisonTitle}>Income</Text>
          </LinearGradient>
          <View style={styles.comparisonBody}>
            <Text style={[styles.comparisonAmount, { color: '#4ECB71' }]}>
              ${analytics.totalIncome.toLocaleString()}
            </Text>
            <Text style={[styles.comparisonSubtext, { color: theme.colors.textSecondary }]}>
              This month
            </Text>
          </View>
        </View>

        <View style={[styles.comparisonCard, { backgroundColor: theme.colors.surface }]}>
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            style={styles.comparisonHeader}
          >
            <Icon name="trending" size={24} color="white" />
            <Text style={styles.comparisonTitle}>Expenses</Text>
          </LinearGradient>
          <View style={styles.comparisonBody}>
            <Text style={[styles.comparisonAmount, { color: '#FF6B6B' }]}>
              ${analytics.totalExpenses.toLocaleString()}
            </Text>
            <Text style={[styles.comparisonSubtext, { color: theme.colors.textSecondary }]}>
              This month
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Categories */}
      <View style={styles.quickCategoriesContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Top Spending Categories
        </Text>
        {analytics.categoryBreakdown.slice(0, 4).map((category, index) => (
          <View key={category.category} style={[styles.categoryQuickItem, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.categoryQuickLeft}>
              <Text style={styles.categoryEmoji}>{category.icon}</Text>
              <View>
                <Text style={[styles.categoryQuickName, { color: theme.colors.text }]}>
                  {category.category}
                </Text>
                <Text style={[styles.categoryQuickAmount, { color: theme.colors.textSecondary }]}>
                  ${category.amount.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.categoryQuickRight}>
              <Text style={[styles.categoryPercentage, { color: category.color }]}>
                {category.percentage.toFixed(1)}%
              </Text>
              <View style={[styles.categoryBar, { backgroundColor: theme.colors.border }]}>
                <View style={[
                  styles.categoryBarFill,
                  { backgroundColor: category.color, width: `${category.percentage}%` }
                ]} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderSpendingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Spending Breakdown Chart */}
      <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.chartTitle, { color: theme.colors.text }]}>
          Spending Breakdown
        </Text>
        <View style={styles.donutChartContainer}>
          {/* Simple visual representation */}
          <View style={styles.donutChart}>
            {analytics.categoryBreakdown.slice(0, 5).map((category, index) => (
              <View key={category.category} style={styles.chartLegendItem}>
                <View style={[styles.legendColor, { backgroundColor: category.color }]} />
                <Text style={[styles.legendText, { color: theme.colors.text }]}>
                  {category.category} ({category.percentage.toFixed(1)}%)
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Detailed Categories */}
      <View style={styles.detailsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          All Categories
        </Text>
        {analytics.categoryBreakdown.map((category, index) => (
          <View key={category.category} style={[styles.detailedCategoryItem, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.categoryDetailHeader}>
              <View style={styles.categoryDetailLeft}>
                <Text style={styles.categoryEmoji}>{category.icon}</Text>
                <View>
                  <Text style={[styles.categoryDetailName, { color: theme.colors.text }]}>
                    {category.category}
                  </Text>
                  <Text style={[styles.categoryDetailMeta, { color: theme.colors.textSecondary }]}>
                    {category.transactionCount} transactions • Avg: ${category.averageAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.categoryDetailRight}>
                <Text style={[styles.categoryDetailAmount, { color: category.color }]}>
                  ${category.amount.toLocaleString()}
                </Text>
                <View style={[
                  styles.trendBadge,
                  { backgroundColor: category.trend === 'up' ? '#FF6B6B' : category.trend === 'down' ? '#4ECB71' : theme.colors.textSecondary }
                ]}>
                  <Icon 
                    name={category.trend === 'up' ? 'trending' : category.trend === 'down' ? 'trending' : 'remove'} 
                    size={12} 
                    color="white" 
                  />
                </View>
              </View>
            </View>
            
            <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.border }]}>
              <View style={[
                styles.progressBarFill,
                { backgroundColor: category.color, width: `${Math.min(category.percentage, 100)}%` }
              ]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderIncomeTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.incomeContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Income Sources
        </Text>
        {analytics.incomeBreakdown.length > 0 ? (
          analytics.incomeBreakdown.map((income, index) => (
            <View key={income.category} style={[styles.incomeItem, { backgroundColor: theme.colors.surface }]}>
              <LinearGradient
                colors={['#4ECB71', '#44A08D']}
                style={styles.incomeGradient}
              >
                <View style={styles.incomeContent}>
                  <Text style={styles.incomeEmoji}>{income.icon}</Text>
                  <View style={styles.incomeDetails}>
                    <Text style={styles.incomeCategory}>{income.category}</Text>
                    <Text style={styles.incomeAmount}>
                      +${income.amount.toLocaleString()}
                    </Text>
                    <Text style={styles.incomeMeta}>
                      {income.transactionCount} transactions • {income.percentage.toFixed(1)}% of total
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>💸</Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
              No income data yet
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              Add some income transactions to see insights
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderInsightsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {analytics.aiInsights && analytics.aiInsights.length > 0 ? (
        <View style={styles.insightsContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            AI-Powered Insights
          </Text>
          {analytics.aiInsights.map((insight) => (
            <View key={insight.id} style={[styles.insightCard, { backgroundColor: theme.colors.surface }]}>
              <LinearGradient
                colors={
                  insight.type === 'positive' ? ['#4ECB71', '#44A08D'] :
                  insight.type === 'warning' ? ['#FFD93D', '#FF8C69'] :
                  insight.type === 'alert' ? ['#FF6B6B', '#FF8E53'] :
                  ['#667eea', '#764ba2']
                }
                style={styles.insightGradient}
              >
                <View style={styles.insightContent}>
                  <View style={styles.insightIconContainer}>
                    <Text style={styles.insightEmoji}>{insight.icon}</Text>
                  </View>
                  <View style={styles.insightText}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightDescription}>{insight.description}</Text>
                    <View style={styles.insightFooter}>
                      <Text style={styles.confidenceText}>
                        {(insight.confidence * 100).toFixed(0)}% confidence
                      </Text>
                      <Text style={styles.insightPriority}>
                        {insight.priority} priority
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>🧠</Text>
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            Building insights...
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
            Add more transactions to get AI-powered financial insights
          </Text>
        </View>
      )}
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
      case 'insights':
        return renderInsightsTab();
      default:
        return renderOverviewTab();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {renderHeader()}
          {renderTabs()}
          {renderContent()}
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
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
    paddingVertical: 20,
    paddingTop: 50,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  activeTab: {
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroContent: {
    flex: 1,
  },
  heroStat: {
    marginBottom: 16,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  savingsProgress: {
    marginLeft: 20,
  },
  progressBackground: {
    position: 'absolute',
  },
  progressForeground: {
    position: 'absolute',
  },
  progressCenter: {
    backgroundColor: 'transparent',
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  comparisonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  comparisonCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  comparisonBody: {
    padding: 16,
    alignItems: 'center',
  },
  comparisonAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  comparisonSubtext: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quickCategoriesContainer: {
    marginBottom: 24,
  },
  categoryQuickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryQuickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  categoryQuickName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryQuickAmount: {
    fontSize: 14,
  },
  categoryQuickRight: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  categoryBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  chartContainer: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  donutChartContainer: {
    alignItems: 'center',
  },
  donutChart: {
    width: '100%',
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  legendText: {
    fontSize: 14,
    flex: 1,
  },
  detailsContainer: {
    marginBottom: 24,
  },
  detailedCategoryItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDetailName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryDetailMeta: {
    fontSize: 12,
  },
  categoryDetailRight: {
    alignItems: 'flex-end',
  },
  categoryDetailAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  trendBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  incomeContainer: {
    marginBottom: 24,
  },
  incomeItem: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  incomeGradient: {
    padding: 20,
  },
  incomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incomeEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  incomeDetails: {
    flex: 1,
  },
  incomeCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  incomeAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  incomeMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  insightsContainer: {
    marginBottom: 24,
  },
  insightCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  insightGradient: {
    padding: 20,
  },
  insightContent: {
    flexDirection: 'row',
  },
  insightIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  insightEmoji: {
    fontSize: 24,
  },
  insightText: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 8,
  },
  insightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confidenceText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  insightPriority: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PersonalAnalyticsModal;