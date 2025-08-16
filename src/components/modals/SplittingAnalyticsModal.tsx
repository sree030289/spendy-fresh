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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

const SplittingAnalyticsModal: React.FC<SplittingAnalyticsModalProps> = ({ visible, analytics, onClose }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'friends' | 'trends'>('overview');
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
              Loading splitting analytics...
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
      
      <Text style={styles.headerTitle}>Splitting Analytics</Text>
      
      <TouchableOpacity style={styles.shareButton}>
        <Icon name="share" size={24} color="white" />
      </TouchableOpacity>
    </LinearGradient>
  );

  const renderTabs = () => (
    <View style={[styles.tabContainer, { backgroundColor: theme.colors.background }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <TabButton
          title="Overview"
          icon="analytics"
          isActive={activeTab === 'overview'}
          onPress={() => setActiveTab('overview')}
          color="#667eea"
        />
        <TabButton
          title="Groups"
          icon="people"
          isActive={activeTab === 'groups'}
          onPress={() => setActiveTab('groups')}
          color="#10B981"
        />
        <TabButton
          title="Friends"
          icon="person"
          isActive={activeTab === 'friends'}
          onPress={() => setActiveTab('friends')}
          color="#F59E0B"
        />
        <TabButton
          title="Trends"
          icon="trending"
          isActive={activeTab === 'trends'}
          onPress={() => setActiveTab('trends')}
          color="#8B5CF6"
        />
      </ScrollView>
    </View>
  );

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Balance Overview */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.heroCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.heroTitle}>Your Splitting Summary</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>
              ${Math.abs(analytics.netBalance).toLocaleString()}
            </Text>
            <Text style={styles.heroStatLabel}>
              {analytics.netBalance >= 0 ? "You're owed" : "You owe"}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>
              ${analytics.totalSpent.toLocaleString()}
            </Text>
            <Text style={styles.heroStatLabel}>Total Spent</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Stats */}
      <View style={styles.quickStatsContainer}>
        <View style={[styles.quickStat, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.quickStatIcon, { backgroundColor: '#10B981' }]}>
            <Icon name="trending" size={20} color="white" />
          </View>
          <View style={styles.quickStatContent}>
            <Text style={[styles.quickStatValue, { color: theme.colors.success }]}>
              ${analytics.totalOwed.toLocaleString()}
            </Text>
            <Text style={[styles.quickStatLabel, { color: theme.colors.textSecondary }]}>
              You're owed
            </Text>
          </View>
        </View>

        <View style={[styles.quickStat, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.quickStatIcon, { backgroundColor: '#EF4444' }]}>
            <Icon name="trending" size={20} color="white" />
          </View>
          <View style={styles.quickStatContent}>
            <Text style={[styles.quickStatValue, { color: theme.colors.error }]}>
              ${analytics.totalOwing.toLocaleString()}
            </Text>
            <Text style={[styles.quickStatLabel, { color: theme.colors.textSecondary }]}>
              You owe
            </Text>
          </View>
        </View>
      </View>

      {/* Top Categories */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Top Spending Categories
        </Text>
        {analytics.categoryBreakdown.slice(0, 4).map((category, index) => (
          <View key={category.category} style={[styles.categoryItem, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.categoryLeft}>
              <Text style={styles.categoryEmoji}>{category.icon}</Text>
              <View>
                <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                  {category.category}
                </Text>
                <Text style={[styles.categoryCount, { color: theme.colors.textSecondary }]}>
                  {category.count} expenses
                </Text>
              </View>
            </View>
            <View style={styles.categoryRight}>
              <Text style={[styles.categoryAmount, { color: theme.colors.text }]}>
                ${category.amount.toLocaleString()}
              </Text>
              <Text style={[styles.categoryPercentage, { color: category.color }]}>
                {category.percentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Insights */}
      {analytics.insights && analytics.insights.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Splitting Insights
          </Text>
          {analytics.insights.slice(0, 2).map((insight, index) => (
            <View key={index} style={[styles.insightCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={styles.insightIcon}>{insight.icon}</Text>
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
      )}
    </ScrollView>
  );

  const renderGroupsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Group Spending Analysis
        </Text>
        {analytics.groupAnalytics.map((group, index) => (
          <View key={index} style={[styles.groupCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupIcon, { backgroundColor: theme.colors.primary }]}>
                <Icon name="people" size={24} color="white" />
              </View>
              <View style={styles.groupInfo}>
                <Text style={[styles.groupName, { color: theme.colors.text }]}>
                  {group.groupName}
                </Text>
                <Text style={[styles.groupMembers, { color: theme.colors.textSecondary }]}>
                  {group.memberCount} members
                </Text>
              </View>
            </View>
            
            <View style={styles.groupStats}>
              <View style={styles.groupStat}>
                <Text style={[styles.groupStatLabel, { color: theme.colors.textSecondary }]}>
                  Total Spent
                </Text>
                <Text style={[styles.groupStatValue, { color: theme.colors.text }]}>
                  ${group.totalSpent.toLocaleString()}
                </Text>
              </View>
              <View style={styles.groupStat}>
                <Text style={[styles.groupStatLabel, { color: theme.colors.textSecondary }]}>
                  Your Balance
                </Text>
                <Text style={[
                  styles.groupStatValue,
                  { 
                    color: Math.abs(group.userBalance) < 0.01 ? theme.colors.textSecondary :
                           group.userBalance > 0 ? theme.colors.success : theme.colors.error
                  }
                ]}>
                  {Math.abs(group.userBalance) < 0.01 ? 'Settled' : 
                   `${group.userBalance > 0 ? '+' : ''}$${Math.abs(group.userBalance).toFixed(2)}`}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderFriendsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Friend Activity
        </Text>
        {analytics.friendAnalytics.map((friend, index) => (
          <View key={index} style={[styles.friendCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.friendHeader}>
              <View style={[styles.friendAvatar, { backgroundColor: theme.colors.primary }]}>
                <Icon name="person" size={20} color="white" />
              </View>
              <View style={styles.friendInfo}>
                <Text style={[styles.friendName, { color: theme.colors.text }]}>
                  {friend.friendName}
                </Text>
                <Text style={[styles.friendExpenses, { color: theme.colors.textSecondary }]}>
                  {friend.expenseCount} shared expenses
                </Text>
              </View>
            </View>
            
            <View style={styles.friendStats}>
              <View style={styles.friendStat}>
                <Text style={[styles.friendStatLabel, { color: theme.colors.textSecondary }]}>
                  Total Shared
                </Text>
                <Text style={[styles.friendStatValue, { color: theme.colors.text }]}>
                  ${friend.totalShared.toLocaleString()}
                </Text>
              </View>
              <View style={styles.friendStat}>
                <Text style={[styles.friendStatLabel, { color: theme.colors.textSecondary }]}>
                  Balance
                </Text>
                <Text style={[
                  styles.friendStatValue,
                  { 
                    color: Math.abs(friend.currentBalance) < 0.01 ? theme.colors.textSecondary :
                           friend.currentBalance > 0 ? theme.colors.success : theme.colors.error
                  }
                ]}>
                  {Math.abs(friend.currentBalance) < 0.01 ? 'Settled' : 
                   `${friend.currentBalance > 0 ? '+' : ''}$${Math.abs(friend.currentBalance).toFixed(2)}`}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderTrendsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Monthly Trends
        </Text>
        {analytics.monthlyTrends.map((trend, index) => (
          <View key={index} style={[styles.trendCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.trendHeader}>
              <Text style={[styles.trendMonth, { color: theme.colors.text }]}>
                {trend.month}
              </Text>
              <View style={styles.trendIcons}>
                <Icon name="trending" size={16} color={theme.colors.primary} />
              </View>
            </View>
            
            <View style={styles.trendStats}>
              <View style={styles.trendStat}>
                <Text style={[styles.trendStatLabel, { color: theme.colors.textSecondary }]}>
                  Spent
                </Text>
                <Text style={[styles.trendStatValue, { color: theme.colors.text }]}>
                  ${trend.spent.toLocaleString()}
                </Text>
              </View>
              <View style={styles.trendStat}>
                <Text style={[styles.trendStatLabel, { color: theme.colors.textSecondary }]}>
                  Settled
                </Text>
                <Text style={[styles.trendStatValue, { color: theme.colors.success }]}>
                  ${trend.settled.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderHeader()}
        {renderTabs()}
        
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
    paddingTop: 20,
    paddingBottom: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tabScroll: {
    paddingHorizontal: 20,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeTab: {
    borderWidth: 0,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroCard: {
    padding: 24,
    borderRadius: 20,
    marginVertical: 16,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  heroStatLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  quickStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  quickStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickStatContent: {
    flex: 1,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: '500',
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
    fontWeight: '600',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
  groupCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  groupHeader: {
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
    marginBottom: 2,
  },
  groupMembers: {
    fontSize: 12,
    fontWeight: '500',
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupStat: {
    alignItems: 'center',
  },
  groupStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  groupStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  friendExpenses: {
    fontSize: 12,
    fontWeight: '500',
  },
  friendStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  friendStat: {
    alignItems: 'center',
  },
  friendStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  friendStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trendCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  trendMonth: {
    fontSize: 16,
    fontWeight: '600',
  },
  trendIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  trendStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendStat: {
    alignItems: 'center',
  },
  trendStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  trendStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SplittingAnalyticsModal;
