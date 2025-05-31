// src/components/reminders/ReminderStatsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { RemindersService } from '@/services/reminders/RemindersService';
import { ReminderCategory } from '@/types/reminder';
import { formatCurrency } from '@/utils/currency';

interface ReminderStatsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface StatsData {
  total: number;
  upcoming: number;
  overdue: number;
  paid: number;
  totalAmount: number;
  overdueAmount: number;
  categoryBreakdown: Array<{ category: ReminderCategory; count: number; amount: number }>;
}

const { width } = Dimensions.get('window');

const CATEGORY_COLORS = {
  utilities: '#F59E0B',
  entertainment: '#8B5CF6',
  finance: '#EF4444',
  insurance: '#10B981',
  subscription: '#3B82F6',
  rent: '#F97316',
  food: '#EC4899',
  transport: '#06B6D4',
  health: '#84CC16',
  education: '#6366F1',
  shopping: '#F472B6',
  other: '#6B7280'
};

const CATEGORY_ICONS = {
  utilities: 'flash-outline',
  entertainment: 'play-outline',
  finance: 'card-outline',
  insurance: 'shield-outline',
  subscription: 'repeat-outline',
  rent: 'home-outline',
  food: 'restaurant-outline',
  transport: 'car-outline',
  health: 'medical-outline',
  education: 'school-outline',
  shopping: 'bag-outline',
  other: 'ellipse-outline'
};

export default function ReminderStatsModal({ visible, onClose }: ReminderStatsModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    upcoming: 0,
    overdue: 0,
    paid: 0,
    totalAmount: 0,
    overdueAmount: 0,
    categoryBreakdown: [],
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    if (visible) {
      loadStats();
    }
  }, [visible]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const statsData = await RemindersService.getReminderStats(user?.id || '');
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusPercentage = (count: number): number => {
    return stats.total > 0 ? (count / stats.total) * 100 : 0;
  };

  const getTopCategories = () => {
    return stats.categoryBreakdown
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  };

  const getCategoryPercentage = (amount: number): number => {
    return stats.totalAmount > 0 ? (amount / stats.totalAmount) * 100 : 0;
  };

  const renderOverviewCards = () => (
    <View style={styles.overviewContainer}>
      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.overviewIcon, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="alarm-outline" size={20} color="white" />
          </View>
          <Text style={[styles.overviewValue, { color: theme.colors.text }]}>
            {stats.total}
          </Text>
          <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>
            Total Bills
          </Text>
        </View>

        <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.overviewIcon, { backgroundColor: theme.colors.success }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color="white" />
          </View>
          <Text style={[styles.overviewValue, { color: theme.colors.text }]}>
            {stats.paid}
          </Text>
          <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>
            Paid
          </Text>
        </View>
      </View>

      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.overviewIcon, { backgroundColor: '#3B82F6' }]}>
            <Ionicons name="time-outline" size={20} color="white" />
          </View>
          <Text style={[styles.overviewValue, { color: theme.colors.text }]}>
            {stats.upcoming}
          </Text>
          <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>
            Upcoming
          </Text>
        </View>

        <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.overviewIcon, { backgroundColor: theme.colors.error }]}>
            <Ionicons name="alert-circle-outline" size={20} color="white" />
          </View>
          <Text style={[styles.overviewValue, { color: theme.colors.text }]}>
            {stats.overdue}
          </Text>
          <Text style={[styles.overviewLabel, { color: theme.colors.textSecondary }]}>
            Overdue
          </Text>
        </View>
      </View>
    </View>
  );

  const renderAmountSummary = () => (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Amount Summary
      </Text>
      
      <View style={styles.amountRow}>
        <View style={styles.amountItem}>
          <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
            Total Outstanding
          </Text>
          <Text style={[styles.amountValue, { color: theme.colors.primary }]}>
            {formatCurrency(stats.totalAmount, user?.currency || 'USD')}
          </Text>
        </View>
        
        <View style={styles.amountItem}>
          <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
            Overdue Amount
          </Text>
          <Text style={[styles.amountValue, { color: theme.colors.error }]}>
            {formatCurrency(stats.overdueAmount, user?.currency || 'USD')}
          </Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <View style={styles.amountItem}>
          <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
            Average Bill
          </Text>
          <Text style={[styles.amountValue, { color: theme.colors.text }]}>
            {formatCurrency(
              stats.total > 0 ? stats.totalAmount / stats.total : 0, 
              user?.currency || 'USD'
            )}
          </Text>
        </View>
        
        <View style={styles.amountItem}>
          <Text style={[styles.amountLabel, { color: theme.colors.textSecondary }]}>
            Payment Success Rate
          </Text>
          <Text style={[styles.amountValue, { color: theme.colors.success }]}>
            {stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0}%
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStatusBreakdown = () => (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Status Breakdown
      </Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressSegment, 
              { 
                backgroundColor: theme.colors.success,
                width: `${getStatusPercentage(stats.paid)}%`,
              }
            ]} 
          />
          <View 
            style={[
              styles.progressSegment, 
              { 
                backgroundColor: '#3B82F6',
                width: `${getStatusPercentage(stats.upcoming)}%`,
              }
            ]} 
          />
          <View 
            style={[
              styles.progressSegment, 
              { 
                backgroundColor: theme.colors.error,
                width: `${getStatusPercentage(stats.overdue)}%`,
              }
            ]} 
          />
        </View>
      </View>

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
          <Text style={[styles.legendText, { color: theme.colors.text }]}>
            Paid ({Math.round(getStatusPercentage(stats.paid))}%)
          </Text>
        </View>
        
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={[styles.legendText, { color: theme.colors.text }]}>
            Upcoming ({Math.round(getStatusPercentage(stats.upcoming))}%)
          </Text>
        </View>
        
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.error }]} />
          <Text style={[styles.legendText, { color: theme.colors.text }]}>
            Overdue ({Math.round(getStatusPercentage(stats.overdue))}%)
          </Text>
        </View>
      </View>
    </View>
  );

  const renderCategoryBreakdown = () => {
    const topCategories = getTopCategories();
    
    return (
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Top Categories by Amount
        </Text>
        
        {topCategories.map((item, index) => {
          const percentage = getCategoryPercentage(item.amount);
          const color = CATEGORY_COLORS[item.category];
          const icon = CATEGORY_ICONS[item.category];
          
          return (
            <View key={item.category} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryIcon, { backgroundColor: color }]}>
                    <Ionicons name={icon as any} size={16} color="white" />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                      {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                    </Text>
                    <Text style={[styles.categoryCount, { color: theme.colors.textSecondary }]}>
                      {item.count} bill{item.count === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.categoryRight}>
                  <Text style={[styles.categoryAmount, { color: theme.colors.text }]}>
                    {formatCurrency(item.amount, user?.currency || 'USD')}
                  </Text>
                  <Text style={[styles.categoryPercentage, { color: theme.colors.textSecondary }]}>
                    {percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
              
              <View style={styles.categoryProgressContainer}>
                <View style={styles.categoryProgressBar}>
                  <View 
                    style={[
                      styles.categoryProgress, 
                      { 
                        backgroundColor: color,
                        width: `${percentage}%`,
                      }
                    ]} 
                  />
                </View>
              </View>
            </View>
          );
        })}
        
        {topCategories.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No category data available
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderInsights = () => {
    const insights = [];
    
    // Payment rate insight
    const paymentRate = stats.total > 0 ? (stats.paid / stats.total) * 100 : 0;
    if (paymentRate >= 80) {
      insights.push({
        icon: 'checkmark-circle',
        color: theme.colors.success,
        title: 'Great Payment Record!',
        description: `You've paid ${paymentRate.toFixed(0)}% of your bills on time.`
      });
    } else if (paymentRate >= 60) {
      insights.push({
        icon: 'warning',
        color: '#F59E0B',
        title: 'Room for Improvement',
        description: `${paymentRate.toFixed(0)}% payment rate. Consider setting up automatic payments.`
      });
    } else {
      insights.push({
        icon: 'alert-circle',
        color: theme.colors.error,
        title: 'Payment Issues',
        description: `Only ${paymentRate.toFixed(0)}% of bills paid. Review your payment schedule.`
      });
    }
    
    // Overdue insight
    if (stats.overdue > 0) {
      insights.push({
        icon: 'time',
        color: theme.colors.error,
        title: 'Overdue Bills',
        description: `You have ${stats.overdue} overdue bill${stats.overdue === 1 ? '' : 's'} totaling ${formatCurrency(stats.overdueAmount, user?.currency || 'USD')}.`
      });
    }
    
    // Spending pattern insight
    const topCategory = getTopCategories()[0];
    if (topCategory) {
      const percentage = getCategoryPercentage(topCategory.amount);
      insights.push({
        icon: 'analytics',
        color: theme.colors.primary,
        title: 'Top Spending Category',
        description: `${topCategory.category.charAt(0).toUpperCase() + topCategory.category.slice(1)} represents ${percentage.toFixed(0)}% of your bills.`
      });
    }
    
    return (
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Insights & Recommendations
        </Text>
        
        {insights.map((insight, index) => (
          <View key={index} style={styles.insightItem}>
            <View style={[styles.insightIcon, { backgroundColor: insight.color }]}>
              <Ionicons name={insight.icon as any} size={20} color="white" />
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
        
        {insights.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="bulb-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              Add more reminders to see insights
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderExportOptions = () => (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Export Data
      </Text>
      
      <View style={styles.exportContainer}>
        <TouchableOpacity 
          style={[styles.exportButton, { borderColor: theme.colors.border }]}
          onPress={() => {
            // Handle CSV export
            console.log('Export as CSV');
          }}
        >
          <Ionicons name="document-text-outline" size={24} color={theme.colors.primary} />
          <Text style={[styles.exportText, { color: theme.colors.text }]}>
            Export as CSV
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.exportButton, { borderColor: theme.colors.border }]}
          onPress={() => {
            // Handle PDF export
            console.log('Export as PDF');
          }}
        >
          <Ionicons name="document-outline" size={24} color={theme.colors.primary} />
          <Text style={[styles.exportText, { color: theme.colors.text }]}>
            Export as PDF
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Bill Statistics
          </Text>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={loadStats}
          >
            <Ionicons name="refresh" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="analytics-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading statistics...
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Overview Cards */}
            {renderOverviewCards()}
            
            {/* Amount Summary */}
            {renderAmountSummary()}
            
            {/* Status Breakdown */}
            {renderStatusBreakdown()}
            
            {/* Category Breakdown */}
            {renderCategoryBreakdown()}
            
            {/* Insights */}
            {renderInsights()}
            
            {/* Export Options */}
            {renderExportOptions()}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  overviewContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  overviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    gap: 2,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: 12,
  },
  categoryRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryPercentage: {
    fontSize: 12,
  },
  categoryProgressContainer: {
    marginTop: 4,
  },
  categoryProgressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryProgress: {
    height: '100%',
    borderRadius: 2,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
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
    gap: 4,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  insightDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  exportContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  exportText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});