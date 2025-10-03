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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { Icon } from '../common/Icon';
import { useTheme } from '@/hooks/useTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface SplittingAnalytics {
  userId: string;
  period: 'week' | 'month' | 'quarter' | 'year';
  startDate: Date;
  endDate: Date;
  totalSpent: number;
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  groupAnalytics: Array<{
    groupName: string;
    totalSpent: number;
    memberCount: number;
    userBalance: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    count: number;
    icon: string;
    color: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    spent: number;
    settled: number;
  }>;
  friendAnalytics: Array<{
    friendName: string;
    totalShared: number;
    currentBalance: number;
    expenseCount: number;
  }>;
  insights: Array<{
    type: 'spending' | 'settlement' | 'efficiency';
    title: string;
    description: string;
    icon: string;
  }>;
  lastUpdated: Date;
}

interface SplittingAnalyticsModalProps {
  visible: boolean;
  analytics: SplittingAnalytics | null;
  onClose: () => void;
}

const SplittingAnalyticsModal: React.FC<SplittingAnalyticsModalProps> = ({ visible, analytics, onClose }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'friends' | 'trends'>('overview');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

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
            <ActivityIndicator size="large" color="#B0004F" />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Calculate settlement speed (mock data for now)
  const settlementSpeed = analytics.friendAnalytics.map((friend) => ({
    name: friend.friendName,
    avgDays: Math.random() * 7,
    status: (Math.random() * 7) < 2 ? 'fast' : (Math.random() * 7) < 5 ? 'medium' : 'slow' as 'fast' | 'medium' | 'slow',
  }));

  // Top payers per group
  const topPayers = analytics.groupAnalytics.map((group) => ({
    groupName: group.groupName,
    topPayer: 'You', // Mock - would come from actual data
    percentage: ((group.userBalance / group.totalSpent) * 100) || 0,
  }));

  const renderCircularProgress = (percentage: number, color: string, size: number = 120) => {
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * percentage) / 100;

    return (
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={12}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={12}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
        <SvgText
          x={size / 2}
          y={size / 2 + 6}
          fontSize="18"
          fontWeight="bold"
          fill={color}
          textAnchor="middle"
        >
          {percentage.toFixed(0)}%
        </SvgText>
      </Svg>
    );
  };

  const renderHeader = () => (
    <LinearGradient
      colors={['#B0004F', '#8B0000']}
      style={styles.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Your spending insights</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      {(['Week', 'Month', 'Quarter', 'Year'] as const).map((range) => (
        <TouchableOpacity
          key={range}
          style={[
            styles.timeRangeButton,
            analytics.period === range.toLowerCase() && styles.timeRangeButtonActive,
          ]}
        >
          <Text
            style={[
              styles.timeRangeText,
              analytics.period === range.toLowerCase() && styles.timeRangeTextActive,
            ]}
          >
            {range}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverviewTab = () => {
    const maxTrend = Math.max(...analytics.monthlyTrends.map(t => t.spent));

    return (
      <ScrollView
        style={styles.tabContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Time Range Selector */}
        {renderTimeRangeSelector()}

        {/* Hero Stats with Visual Cards */}
        <View style={styles.heroCardsContainer}>
          <LinearGradient
            colors={['#B0004F', '#8B0000']}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="wallet" size={32} color="white" />
            <Text style={styles.heroCardValue}>${analytics.totalSpent.toLocaleString()}</Text>
            <Text style={styles.heroCardLabel}>Total Spent</Text>
          </LinearGradient>

          <View style={[styles.heroCard, styles.heroCardLight]}>
            <Icon name="trending-up" size={32} color="#10B981" />
            <Text style={[styles.heroCardValue, { color: '#10B981' }]}>
              ${analytics.totalOwed.toLocaleString()}
            </Text>
            <Text style={styles.heroCardLabelDark}>You're Owed</Text>
          </View>

          <View style={[styles.heroCard, styles.heroCardLight]}>
            <Icon name="trending-down" size={32} color="#EF4444" />
            <Text style={[styles.heroCardValue, { color: '#EF4444' }]}>
              ${analytics.totalOwing.toLocaleString()}
            </Text>
            <Text style={styles.heroCardLabelDark}>You Owe</Text>
          </View>

          <LinearGradient
            colors={analytics.netBalance >= 0 ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name={analytics.netBalance >= 0 ? 'checkmark-circle' : 'alert-circle'} size={32} color="white" />
            <Text style={styles.heroCardValue}>
              ${Math.abs(analytics.netBalance).toLocaleString()}
            </Text>
            <Text style={styles.heroCardLabel}>
              {analytics.netBalance >= 0 ? 'Net Credit' : 'Net Debit'}
            </Text>
          </LinearGradient>
        </View>

        {/* Spending Trend Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Icon name="trending-up" size={24} color="#B0004F" />
            <Text style={styles.chartTitle}>Spending Trend</Text>
          </View>
          <View style={styles.trendChart}>
            {analytics.monthlyTrends.map((trend, index) => {
              const height = (trend.spent / maxTrend) * 150;
              return (
                <View key={index} style={styles.trendBar}>
                  <LinearGradient
                    colors={['#B0004F', '#FF6B6B']}
                    style={[styles.trendBarFill, { height: Math.max(height, 20) }]}
                  >
                    <Text style={styles.trendAmount}>${(trend.spent / 1000).toFixed(1)}k</Text>
                  </LinearGradient>
                  <Text style={styles.trendPeriod}>{trend.month}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Category Breakdown with Circular Charts */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Icon name="pie-chart" size={24} color="#B0004F" />
            <Text style={styles.chartTitle}>Spending by Category</Text>
          </View>

          <View style={styles.categoryCircles}>
            {analytics.categoryBreakdown.slice(0, 3).map((cat, index) => (
              <View key={index} style={styles.categoryCircleItem}>
                {renderCircularProgress(cat.percentage, cat.color, 100)}
                <Text style={styles.categoryCircleLabel} numberOfLines={1}>{cat.category}</Text>
                <Text style={[styles.categoryCircleAmount, { color: cat.color }]}>
                  ${cat.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.categoryList}>
            {analytics.categoryBreakdown.map((cat, index) => (
              <View key={index} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.categoryName}>{cat.icon} {cat.category}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categoryAmount}>${cat.amount.toLocaleString()}</Text>
                  <Text style={[styles.categoryPercentage, { color: cat.color }]}>
                    {cat.percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const renderGroupsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Icon name="people" size={28} color="#B0004F" />
        <Text style={styles.sectionTitle}>Group Insights</Text>
      </View>

      {/* Top Payer per Group */}
      <View style={styles.chartCard}>
        <Text style={styles.chartSubtitle}>Who Pays Most</Text>
        {topPayers.map((item, index) => (
          <View key={index} style={styles.topPayerRow}>
            <View style={styles.topPayerLeft}>
              <View style={[styles.rankBadge, index === 0 && styles.rankBadgeGold]}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
              <View>
                <Text style={styles.topPayerGroup}>{item.groupName}</Text>
                <Text style={styles.topPayerName}>Top: {item.topPayer}</Text>
              </View>
            </View>
            <Text style={styles.topPayerPercentage}>{item.percentage.toFixed(0)}%</Text>
          </View>
        ))}
      </View>

      {/* Group Cards */}
      {analytics.groupAnalytics.map((group, index) => (
        <View key={index} style={styles.groupCard}>
          <View style={styles.groupCardHeader}>
            <LinearGradient
              colors={['#B0004F', '#8B0000']}
              style={styles.groupIcon}
            >
              <Icon name="people" size={24} color="white" />
            </LinearGradient>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{group.groupName}</Text>
              <Text style={styles.groupMembers}>{group.memberCount} members</Text>
            </View>
          </View>

          <View style={styles.groupStatsRow}>
            <View style={styles.groupStat}>
              <Text style={styles.groupStatLabel}>Total Spent</Text>
              <Text style={styles.groupStatValue}>${group.totalSpent.toLocaleString()}</Text>
            </View>
            <View style={styles.groupStatDivider} />
            <View style={styles.groupStat}>
              <Text style={styles.groupStatLabel}>Your Balance</Text>
              <Text
                style={[
                  styles.groupStatValue,
                  {
                    color: Math.abs(group.userBalance) < 0.01
                      ? '#6B7280'
                      : group.userBalance > 0
                      ? '#10B981'
                      : '#EF4444',
                  },
                ]}
              >
                {Math.abs(group.userBalance) < 0.01
                  ? 'Settled'
                  : `${group.userBalance > 0 ? '+' : ''}$${Math.abs(group.userBalance).toFixed(2)}`}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderFriendsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Icon name="person" size={28} color="#B0004F" />
        <Text style={styles.sectionTitle}>Friend Analytics</Text>
      </View>

      {/* Settlement Speed */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Icon name="time" size={24} color="#B0004F" />
          <Text style={styles.chartTitle}>Settlement Speed</Text>
        </View>
        {settlementSpeed.map((friend, index) => {
          const statusColors = {
            fast: '#10B981',
            medium: '#F59E0B',
            slow: '#EF4444',
          };
          return (
            <View key={index} style={styles.settlementRow}>
              <View style={styles.settlementLeft}>
                <View style={[styles.statusDot, { backgroundColor: statusColors[friend.status] }]} />
                <Text style={styles.settlementName}>{friend.name}</Text>
              </View>
              <View style={styles.settlementRight}>
                <Text style={[styles.settlementDays, { color: statusColors[friend.status] }]}>
                  {friend.avgDays.toFixed(1)} days
                </Text>
                <Icon
                  name={friend.status === 'fast' ? 'checkmark-circle' : friend.status === 'medium' ? 'time' : 'alert-circle'}
                  size={20}
                  color={statusColors[friend.status]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Friend Cards */}
      {analytics.friendAnalytics.map((friend, index) => (
        <View key={index} style={styles.friendCard}>
          <View style={styles.friendHeader}>
            <View style={styles.friendAvatar}>
              <Text style={styles.friendInitial}>{friend.friendName.charAt(0)}</Text>
            </View>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{friend.friendName}</Text>
              <Text style={styles.friendExpenses}>{friend.expenseCount} shared expenses</Text>
            </View>
          </View>

          <View style={styles.friendStatsRow}>
            <View style={styles.friendStat}>
              <Text style={styles.friendStatLabel}>Total Shared</Text>
              <Text style={styles.friendStatValue}>${friend.totalShared.toLocaleString()}</Text>
            </View>
            <View style={styles.friendStatDivider} />
            <View style={styles.friendStat}>
              <Text style={styles.friendStatLabel}>Balance</Text>
              <Text
                style={[
                  styles.friendStatValue,
                  {
                    color: Math.abs(friend.currentBalance) < 0.01
                      ? '#6B7280'
                      : friend.currentBalance > 0
                      ? '#10B981'
                      : '#EF4444',
                  },
                ]}
              >
                {Math.abs(friend.currentBalance) < 0.01
                  ? 'Settled'
                  : `${friend.currentBalance > 0 ? '+' : ''}$${Math.abs(friend.currentBalance).toFixed(2)}`}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderTrendsTab = () => {
    const maxValue = Math.max(...analytics.monthlyTrends.map(t => Math.max(t.spent, t.settled)));

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Icon name="stats-chart" size={28} color="#B0004F" />
          <Text style={styles.sectionTitle}>Monthly Trends</Text>
        </View>

        {/* Trend Comparison Chart */}
        <View style={styles.chartCard}>
          <View style={styles.trendComparisonChart}>
            {analytics.monthlyTrends.map((trend, index) => {
              const spentHeight = (trend.spent / maxValue) * 180;
              const settledHeight = (trend.settled / maxValue) * 180;

              return (
                <View key={index} style={styles.trendComparisonBar}>
                  <View style={styles.barPair}>
                    <LinearGradient
                      colors={['#B0004F', '#FF6B6B']}
                      style={[styles.barSpent, { height: Math.max(spentHeight, 20) }]}
                    />
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={[styles.barSettled, { height: Math.max(settledHeight, 20) }]}
                    />
                  </View>
                  <Text style={styles.trendComparisonMonth}>{trend.month.slice(0, 3)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.trendLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#B0004F' }]} />
              <Text style={styles.legendText}>Spent</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Settled</Text>
            </View>
          </View>
        </View>

        {/* Trend Details */}
        {analytics.monthlyTrends.map((trend, index) => (
          <View key={index} style={styles.trendDetailCard}>
            <Text style={styles.trendDetailMonth}>{trend.month}</Text>
            <View style={styles.trendDetailRow}>
              <View style={styles.trendDetailItem}>
                <Text style={styles.trendDetailLabel}>Spent</Text>
                <Text style={[styles.trendDetailValue, { color: '#B0004F' }]}>
                  ${trend.spent.toLocaleString()}
                </Text>
              </View>
              <View style={styles.trendDetailItem}>
                <Text style={styles.trendDetailLabel}>Settled</Text>
                <Text style={[styles.trendDetailValue, { color: '#10B981' }]}>
                  ${trend.settled.toLocaleString()}
                </Text>
              </View>
              <View style={styles.trendDetailItem}>
                <Text style={styles.trendDetailLabel}>Pending</Text>
                <Text style={[styles.trendDetailValue, { color: '#F59E0B' }]}>
                  ${(trend.spent - trend.settled).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        {renderHeader()}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {[
            { key: 'overview', label: 'Overview', icon: 'analytics' },
            { key: 'groups', label: 'Groups', icon: 'people' },
            { key: 'friends', label: 'Friends', icon: 'person' },
            { key: 'trends', label: 'Trends', icon: 'trending-up' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Icon
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.key ? '#B0004F' : '#6B7280'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.key && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'groups' && renderGroupsTab()}
          {activeTab === 'friends' && renderFriendsTab()}
          {activeTab === 'trends' && renderTrendsTab()}
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FEF2F2',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
  },
  tabLabelActive: {
    color: '#B0004F',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    marginVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: '#B0004F',
  },
  timeRangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  timeRangeTextActive: {
    color: 'white',
  },
  heroCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  heroCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  heroCardLight: {
    backgroundColor: 'white',
  },
  heroCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
  },
  heroCardLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  heroCardLabelDark: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
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
      android: { elevation: 4 },
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
    color: '#111827',
    marginLeft: 12,
  },
  chartSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  trendChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
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
  },
  trendAmount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  trendPeriod: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 8,
  },
  categoryCircles: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  categoryCircleItem: {
    alignItems: 'center',
    width: 100,
  },
  categoryCircleLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  categoryCircleAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  categoryList: {
    marginTop: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryLeft: {
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
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  categoryPercentage: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 12,
  },
  topPayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  topPayerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankBadgeGold: {
    backgroundColor: '#FCD34D',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
  },
  topPayerGroup: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  topPayerName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  topPayerPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B0004F',
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  groupMembers: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  groupStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupStat: {
    flex: 1,
    alignItems: 'center',
  },
  groupStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  groupStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  groupStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settlementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  settlementName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
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
  friendCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#B0004F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  friendExpenses: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  friendStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendStat: {
    flex: 1,
    alignItems: 'center',
  },
  friendStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  friendStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  friendStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  trendComparisonChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 200,
    marginBottom: 16,
  },
  trendComparisonBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    width: '100%',
    justifyContent: 'center',
  },
  barSpent: {
    width: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 20,
  },
  barSettled: {
    width: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 20,
  },
  trendComparisonMonth: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 8,
  },
  trendLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#6B7280',
  },
  trendDetailCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  trendDetailMonth: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  trendDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendDetailItem: {
    alignItems: 'center',
  },
  trendDetailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  trendDetailValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SplittingAnalyticsModal;
