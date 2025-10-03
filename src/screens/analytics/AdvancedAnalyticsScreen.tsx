// src/screens/analytics/AdvancedAnalyticsScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type TimeRange = 'week' | 'month' | 'year' | 'all';

interface AnalyticsData {
  totalSpent: number;
  totalIncome: number;
  groupCount: number;
  friendCount: number;
  categoryBreakdown: { category: string; amount: number; color: string }[];
  topSpenders: { name: string; amount: number; avatar?: string }[];
  settlementSpeed: { name: string; avgDays: number; status: 'fast' | 'medium' | 'slow' }[];
  groupInsights: { groupName: string; totalSpent: number; topPayer: string }[];
  spendingTrend: { period: string; amount: number }[];
}

export default function AdvancedAnalyticsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Mock data - replace with real API calls
  const analyticsData: AnalyticsData = {
    totalSpent: 12580,
    totalIncome: 15000,
    groupCount: 8,
    friendCount: 24,
    categoryBreakdown: [
      { category: 'Food & Dining', amount: 4200, color: '#FF6B6B' },
      { category: 'Entertainment', amount: 2800, color: '#4ECDC4' },
      { category: 'Travel', amount: 3500, color: '#45B7D1' },
      { category: 'Shopping', amount: 1580, color: '#FFA07A' },
      { category: 'Others', amount: 500, color: '#98D8C8' },
    ],
    topSpenders: [
      { name: 'John Smith', amount: 5200 },
      { name: 'Sarah Wilson', amount: 3800 },
      { name: 'Mike Chen', amount: 2100 },
    ],
    settlementSpeed: [
      { name: 'Emma Davis', avgDays: 1.5, status: 'fast' },
      { name: 'Alex Kumar', avgDays: 3.2, status: 'medium' },
      { name: 'Chris Lee', avgDays: 7.5, status: 'slow' },
    ],
    groupInsights: [
      { groupName: 'Weekend Squad', totalSpent: 6800, topPayer: 'John' },
      { groupName: 'Office Lunch', totalSpent: 3200, topPayer: 'Sarah' },
      { groupName: 'Travel Buddies', totalSpent: 2580, topPayer: 'Mike' },
    ],
    spendingTrend: [
      { period: 'Jan', amount: 3200 },
      { period: 'Feb', amount: 4100 },
      { period: 'Mar', amount: 3800 },
      { period: 'Apr', amount: 5200 },
      { period: 'May', amount: 4500 },
      { period: 'Jun', amount: 6200 },
    ],
  };

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500);
  }, [timeRange]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      {(['week', 'month', 'year', 'all'] as TimeRange[]).map((range) => (
        <TouchableOpacity
          key={range}
          onPress={() => setTimeRange(range)}
          style={[
            styles.timeRangeButton,
            timeRange === range && styles.timeRangeButtonActive,
          ]}
        >
          <Text
            style={[
              styles.timeRangeText,
              timeRange === range && styles.timeRangeTextActive,
            ]}
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStatCard = (title: string, value: string, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.statIconContainer}>
        <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
          <Icon name={icon as any} size={24} color={color} />
        </View>
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
    </View>
  );

  const renderCategoryChart = () => {
    const maxAmount = Math.max(...analyticsData.categoryBreakdown.map(c => c.amount));

    return (
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Icon name="pie-chart" size={24} color="#B0004F" />
          <Text style={styles.chartTitle}>Spending by Category</Text>
        </View>

        {/* Circular Progress Rings */}
        <View style={styles.categoryRingsContainer}>
          {analyticsData.categoryBreakdown.map((cat, index) => {
            const percentage = (cat.amount / maxAmount) * 100;
            const size = 140 - index * 20;

            return (
              <View key={cat.category} style={[styles.ringWrapper, { width: size, height: size }]}>
                <LinearGradient
                  colors={[cat.color, cat.color + '80']}
                  style={styles.ring}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </View>
            );
          })}
        </View>

        {/* Category List */}
        <View style={styles.categoryList}>
          {analyticsData.categoryBreakdown.map((cat) => (
            <View key={cat.category} style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={styles.categoryName}>{cat.category}</Text>
              </View>
              <Text style={[styles.categoryAmount, { color: cat.color }]}>
                ${cat.amount.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSpendingTrend = () => {
    const maxAmount = Math.max(...analyticsData.spendingTrend.map(t => t.amount));

    return (
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Icon name="trending-up" size={24} color="#B0004F" />
          <Text style={styles.chartTitle}>Spending Trend</Text>
        </View>

        <View style={styles.trendChart}>
          {analyticsData.spendingTrend.map((item, index) => {
            const height = (item.amount / maxAmount) * 150;

            return (
              <View key={item.period} style={styles.trendBar}>
                <LinearGradient
                  colors={['#B0004F', '#FF6B6B']}
                  style={[styles.trendBarFill, { height }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <Text style={styles.trendAmount}>${(item.amount / 1000).toFixed(1)}k</Text>
                </LinearGradient>
                <Text style={styles.trendPeriod}>{item.period}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTopSpenders = () => (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Icon name="people" size={24} color="#B0004F" />
        <Text style={styles.chartTitle}>Top Spenders in Groups</Text>
      </View>

      {analyticsData.topSpenders.map((spender, index) => (
        <View key={spender.name} style={styles.spenderRow}>
          <View style={styles.spenderLeft}>
            <View style={[styles.rankBadge, index === 0 && styles.rankBadgeGold]}>
              <Text style={styles.rankText}>#{index + 1}</Text>
            </View>
            <View style={styles.spenderAvatar}>
              <Text style={styles.spenderInitial}>{spender.name.charAt(0)}</Text>
            </View>
            <Text style={styles.spenderName}>{spender.name}</Text>
          </View>
          <Text style={styles.spenderAmount}>${spender.amount.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );

  const renderSettlementSpeed = () => (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Icon name="time" size={24} color="#B0004F" />
        <Text style={styles.chartTitle}>Settlement Speed</Text>
      </View>

      {analyticsData.settlementSpeed.map((friend) => {
        const statusColors = {
          fast: '#4CAF50',
          medium: '#FFA726',
          slow: '#EF5350',
        };

        return (
          <View key={friend.name} style={styles.settlementRow}>
            <View style={styles.settlementLeft}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: statusColors[friend.status] },
                ]}
              />
              <Text style={styles.settlementName}>{friend.name}</Text>
            </View>
            <View style={styles.settlementRight}>
              <Text style={[styles.settlementDays, { color: statusColors[friend.status] }]}>
                {friend.avgDays.toFixed(1)} days
              </Text>
              <Icon
                name={friend.status === 'fast' ? 'checkmark-circle' : 'time'}
                size={20}
                color={statusColors[friend.status]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderGroupInsights = () => (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Icon name="people-outline" size={24} color="#B0004F" />
        <Text style={styles.chartTitle}>Group Insights</Text>
      </View>

      {analyticsData.groupInsights.map((group) => (
        <View key={group.groupName} style={styles.groupInsightRow}>
          <View style={styles.groupInsightHeader}>
            <Text style={styles.groupName}>{group.groupName}</Text>
            <Text style={styles.groupAmount}>${group.totalSpent.toLocaleString()}</Text>
          </View>
          <View style={styles.groupInsightDetail}>
            <Icon name="person" size={16} color="#666" />
            <Text style={styles.topPayerText}>Top payer: {group.topPayer}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.headerGradient, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={['#B0004F', '#8B0000']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>Your financial insights at a glance</Text>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.content}>
          {/* Time Range Selector */}
          {renderTimeRangeSelector()}

          {/* Summary Stats */}
          <View style={styles.statsGrid}>
            {renderStatCard(
              'Total Spent',
              `$${analyticsData.totalSpent.toLocaleString()}`,
              'wallet',
              '#B0004F'
            )}
            {renderStatCard(
              'Groups',
              analyticsData.groupCount.toString(),
              'people',
              '#4ECDC4'
            )}
            {renderStatCard(
              'Friends',
              analyticsData.friendCount.toString(),
              'person-add',
              '#45B7D1'
            )}
            {renderStatCard(
              'Balance',
              `$${(analyticsData.totalIncome - analyticsData.totalSpent).toLocaleString()}`,
              'trending-up',
              '#4CAF50'
            )}
          </View>

          {/* Spending Trend */}
          {renderSpendingTrend()}

          {/* Category Breakdown */}
          {renderCategoryChart()}

          {/* Top Spenders */}
          {renderTopSpenders()}

          {/* Settlement Speed */}
          {renderSettlementSpeed()}

          {/* Group Insights */}
          {renderGroupInsights()}

          {/* Bottom Padding */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: '#B0004F',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  timeRangeTextActive: {
    color: 'white',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    margin: 6,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statIconContainer: {
    marginRight: 12,
  },
  statIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  categoryRingsContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  ringWrapper: {
    position: 'absolute',
    borderRadius: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    width: '100%',
    height: '100%',
    borderRadius: 1000,
    opacity: 0.6,
  },
  categoryList: {
    marginTop: 10,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trendChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 200,
    paddingTop: 20,
  },
  trendBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  trendBarFill: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 8,
    minHeight: 40,
  },
  trendAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
  },
  trendPeriod: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  spenderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  spenderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankBadgeGold: {
    backgroundColor: '#FFD700',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  spenderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B0004F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  spenderInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  spenderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  spenderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B0004F',
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settlementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  settlementName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  settlementRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settlementDays: {
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 8,
  },
  groupInsightRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  groupInsightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  groupAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B0004F',
  },
  groupInsightDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topPayerText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
});
