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
import { Icon } from '../common/Icon';
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
        <Icon name="share" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
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

  const renderContent = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDark]}
            style={styles.summaryGradient}
          >
            <View style={styles.summaryContent}>
              <Text style={styles.summaryLabel}>Net Savings</Text>
              <Text style={styles.summaryAmount}>
                ${analytics.netSavings.toLocaleString()}
              </Text>
              <Text style={styles.savingsRate}>
                {analytics.savingsRate.toFixed(1)}% saved
              </Text>
            </View>
            <View style={styles.summaryIcon}>
              <Icon name="wallet" size={32} color="rgba(255,255,255,0.8)" />
            </View>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Category Breakdown
        </Text>
        {analytics.categoryBreakdown.slice(0, 5).map((category, index) => (
          <View key={category.category} style={styles.categoryItem}>
            <Text style={styles.categoryEmoji}>{category.icon}</Text>
            <View style={styles.categoryInfo}>
              <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                {category.category}
              </Text>
              <Text style={[styles.categoryAmount, { color: theme.colors.textSecondary }]}>
                ${category.amount.toLocaleString()} ({category.percentage.toFixed(1)}%)
              </Text>
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
  summaryCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryAmount: {
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
  summaryIcon: {
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
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  categoryEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  categoryAmount: {
    fontSize: 14,
  },
});

export default AnalyticsModal;