import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  ImageBackground,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

const { width, height } = Dimensions.get('window');

interface SmartExpense {
  id: string;
  amount: number;
  description: string;
  category: string;
  merchant: string;
  location: string;
  date: Date;
  detectionMethod: 'location' | 'receipt' | 'auto' | 'manual';
  timeAgo: string;
  canSplit: boolean;
  isConfirmed: boolean;
}

const mockSmartExpenses: SmartExpense[] = [
  {
    id: '1',
    amount: 28.5,
    description: 'Coffee',
    category: 'Coffee',
    merchant: 'Seven Seeds Coffee',
    location: 'Carlton, Melbourne',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000),
    detectionMethod: 'location',
    timeAgo: '2h ago',
    canSplit: true,
    isConfirmed: false,
  },
  {
    id: '2',
    amount: 145.8,
    description: 'Groceries',
    category: 'Groceries',
    merchant: 'Coles Supermarket',
    location: 'Collins Street',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
    detectionMethod: 'receipt',
    timeAgo: '1 day ago',
    canSplit: false,
    isConfirmed: true,
  },
  {
    id: '3',
    amount: 89,
    description: 'Dinner',
    category: 'Dining',
    merchant: 'Chin Chin Restaurant',
    location: 'Flinders Lane',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    detectionMethod: 'location',
    timeAgo: '2 days ago',
    canSplit: true,
    isConfirmed: true,
  },
  {
    id: '4',
    amount: 22,
    description: 'Ride',
    category: 'Transport',
    merchant: 'Uber',
    location: 'Melbourne CBD',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    detectionMethod: 'auto',
    timeAgo: '3 days ago',
    canSplit: false,
    isConfirmed: true,
  },
];

const getCategoryConfig = (category: string) => {
  const configs = {
    Coffee: { 
      icon: 'cafe',
      gradient: ['#8B4513', '#D2691E'],
      bgColor: 'rgba(139, 69, 19, 0.1)',
      iconColor: '#8B4513'
    },
    Groceries: { 
      icon: 'basket',
      gradient: ['#22C55E', '#16A34A'],
      bgColor: 'rgba(34, 197, 94, 0.1)',
      iconColor: '#22C55E'
    },
    Dining: { 
      icon: 'restaurant',
      gradient: ['#EF4444', '#DC2626'],
      bgColor: 'rgba(239, 68, 68, 0.1)',
      iconColor: '#EF4444'
    },
    Transport: { 
      icon: 'car',
      gradient: ['#3B82F6', '#2563EB'],
      bgColor: 'rgba(59, 130, 246, 0.1)',
      iconColor: '#3B82F6'
    },
  };
  return configs[category as keyof typeof configs] || { 
    icon: 'card',
    gradient: ['#6B7280', '#4B5563'],
    bgColor: 'rgba(107, 114, 128, 0.1)',
    iconColor: '#6B7280'
  };
};

const getDetectionConfig = (method: string) => {
  const configs = {
    location: { icon: 'location', color: '#3B82F6', label: 'Location' },
    receipt: { icon: 'camera', color: '#22C55E', label: 'Receipt' },
    auto: { icon: 'flash', color: '#F59E0B', label: 'Auto' },
    manual: { icon: 'create', color: '#6B7280', label: 'Manual' },
  };
  return configs[method as keyof typeof configs] || configs.manual;
};

export default function ExpensesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [expenses] = useState<SmartExpense[]>(mockSmartExpenses);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<SmartExpense | null>(null);
  const [scrollY] = useState(new Animated.Value(0));

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const thisWeekSpent = expenses
    .filter(expense => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return expense.date > weekAgo;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [20, 0],
    extrapolate: 'clamp',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleQuickAdd = (type: string) => {
    Alert.alert(
      'Quick Add',
      `Add ${type} expense?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => console.log(`Adding ${type} expense`) }
      ]
    );
  };

  const handleScanReceipt = () => {
    setShowReceiptScanner(true);
    setTimeout(() => {
      setShowReceiptScanner(false);
      Alert.alert('Receipt Scanned!', 'Expense added automatically');
    }, 3000);
  };

  const renderStatsCard = () => (
    <View style={styles.statsCard}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statsGradient}
      >
        <BlurView intensity={20} style={styles.statsContent}>
          <View style={styles.statsHeader}>
            <View>
              <Text style={styles.statsTitle}>Smart Tracking</Text>
              <Text style={styles.statsSubtitle}>AI-powered expense detection</Text>
            </View>
            <TouchableOpacity style={styles.insightsButton} onPress={() => setShowAnalytics(true)}>
              <Ionicons name="analytics" size={20} color="white" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statAmount}>${totalSpent.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statAmount}>${thisWeekSpent.toFixed(2)}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statAmount}>{expenses.length}</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
          </View>
        </BlurView>
      </LinearGradient>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsCard}>
      <Text style={styles.quickActionsTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={styles.quickActionItem}
          onPress={handleScanReceipt}
        >
          <LinearGradient
            colors={['#22C55E', '#16A34A']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="camera" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Scan Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionItem}
          onPress={() => setShowLocationModal(true)}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="location" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Location Detect</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionItem}
          onPress={() => handleQuickAdd('Manual')}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="add" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Add Manual</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionItem}
          onPress={() => setShowAnalytics(true)}
        >
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={styles.quickActionGradient}
          >
            <Ionicons name="pie-chart" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.quickActionLabel}>Analytics</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderExpenseCard = ({ item, index }: { item: SmartExpense; index: number }) => {
    const categoryConfig = getCategoryConfig(item.category);
    const detectionConfig = getDetectionConfig(item.detectionMethod);
    
    return (
      <Animated.View
        style={[
          styles.expenseCard,
          {
            transform: [{
              translateY: scrollY.interpolate({
                inputRange: [0, 50 * index, 50 * (index + 2)],
                outputRange: [0, 0, -50],
                extrapolate: 'clamp',
              }),
            }],
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => setSelectedExpense(item)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['white', '#F8FAFC']}
            style={styles.expenseGradient}
          >
            <View style={styles.expenseContent}>
              {/* Header */}
              <View style={styles.expenseHeader}>
                <View style={styles.expenseLeft}>
                  <LinearGradient
                    colors={categoryConfig.gradient as [string, string, ...string[]]}
                    style={styles.categoryIconContainer}
                  >
                    <Ionicons 
                      name={categoryConfig.icon as any} 
                      size={24} 
                      color="white" 
                    />
                  </LinearGradient>
                  <View style={styles.expenseInfo}>
                    <View style={styles.amountRow}>
                      <Text style={styles.expenseAmount}>${item.amount.toFixed(2)}</Text>
                      {!item.isConfirmed && (
                        <View style={styles.pendingBadge}>
                          <View style={styles.pendingDot} />
                          <Text style={styles.pendingText}>Pending</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.expenseDescription}>{item.description}</Text>
                    <Text style={styles.merchantName}>{item.merchant}</Text>
                  </View>
                </View>
                
                <View style={styles.expenseRight}>
                  <View style={[styles.detectionBadge, { backgroundColor: `${detectionConfig.color}20` }]}>
                    <Ionicons 
                      name={detectionConfig.icon as any} 
                      size={14} 
                      color={detectionConfig.color} 
                    />
                  </View>
                  <Text style={styles.timeAgo}>{item.timeAgo}</Text>
                </View>
              </View>

              {/* Location & Details */}
              <View style={styles.expenseDetails}>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="#64748B" />
                  <Text style={styles.locationText}>{item.location}</Text>
                </View>
                <View style={styles.detectionRow}>
                  <Ionicons name="checkmark-circle" size={14} color={detectionConfig.color} />
                  <Text style={[styles.detectionText, { color: detectionConfig.color }]}>
                    {detectionConfig.label} Detection
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.expenseActions}>
                {item.canSplit && (
                  <TouchableOpacity style={styles.splitButton}>
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={styles.splitGradient}
                    >
                      <Ionicons name="people" size={16} color="white" />
                      <Text style={styles.splitText}>Split</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.moreButton}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderLocationModal = () => (
    <Modal
      visible={showLocationModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowLocationModal(false)}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={50} style={styles.modalBlur}>
          <View style={styles.locationModalContainer}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={styles.locationModalGradient}
            >
              <View style={styles.locationModalHeader}>
                <View style={styles.locationIconContainer}>
                  <Ionicons name="location" size={32} color="white" />
                </View>
                <Text style={styles.locationModalTitle}>Location Detected!</Text>
                <Text style={styles.locationModalSubtitle}>You're at Coles Collins Street</Text>
              </View>
              
              <View style={styles.quickSuggestionsGrid}>
                <TouchableOpacity
                  style={styles.quickSuggestionItem}
                  onPress={() => handleQuickAdd('Groceries')}
                >
                  <View style={styles.suggestionIcon}>
                    <Text style={styles.suggestionEmoji}>🛒</Text>
                  </View>
                  <Text style={styles.suggestionText}>Groceries</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickSuggestionItem}
                  onPress={() => handleQuickAdd('Snacks')}
                >
                  <View style={styles.suggestionIcon}>
                    <Text style={styles.suggestionEmoji}>🍿</Text>
                  </View>
                  <Text style={styles.suggestionText}>Snacks</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.quickSuggestionItem}
                  onPress={() => handleQuickAdd('Household')}
                >
                  <View style={styles.suggestionIcon}>
                    <Text style={styles.suggestionEmoji}>🧽</Text>
                  </View>
                  <Text style={styles.suggestionText}>Household</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.locationModalActions}>
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => setShowLocationModal(false)}
                >
                  <Text style={styles.dismissButtonText}>Not now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.scanReceiptButton}
                  onPress={() => {
                    setShowLocationModal(false);
                    handleScanReceipt();
                  }}
                >
                  <Text style={styles.scanReceiptButtonText}>Scan Receipt</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </BlurView>
      </View>
    </Modal>
  );

  const renderReceiptScanner = () => (
    <Modal
      visible={showReceiptScanner}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowReceiptScanner(false)}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={50} style={styles.modalBlur}>
          <View style={styles.scannerModalContainer}>
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              style={styles.scannerModalGradient}
            >
              <View style={styles.scannerIconContainer}>
                <Ionicons name="camera" size={48} color="white" />
              </View>
              <Text style={styles.scannerTitle}>Scanning Receipt...</Text>
              <Text style={styles.scannerSubtitle}>AI is extracting expense details</Text>
              
              <View style={styles.scannerProgress}>
                <Animated.View style={styles.progressDot} />
                <Animated.View style={[styles.progressDot, { opacity: 0.7 }]} />
                <Animated.View style={[styles.progressDot, { opacity: 0.4 }]} />
              </View>
            </LinearGradient>
          </View>
        </BlurView>
      </View>
    </Modal>
  );

  const renderAnalyticsModal = () => (
    <Modal
      visible={showAnalytics}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAnalytics(false)}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={50} style={styles.modalBlur}>
          <View style={styles.analyticsModalContainer}>
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.analyticsModalGradient}
            >
              <View style={styles.analyticsHeader}>
                <TouchableOpacity
                  onPress={() => setShowAnalytics(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.analyticsTitle}>Expense Analytics</Text>
                <View style={styles.placeholder} />
              </View>
              
              <View style={styles.analyticsContent}>
                <View style={styles.categoryBreakdown}>
                  <Text style={styles.breakdownTitle}>Category Breakdown</Text>
                  {Object.entries(
                    expenses.reduce((acc, expense) => {
                      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([category, amount]) => {
                    const config = getCategoryConfig(category);
                    const percentage = (amount / totalSpent) * 100;
                    
                    return (
                      <View key={category} style={styles.categoryItem}>
                        <View style={styles.categoryItemLeft}>
                          <LinearGradient
                            colors={config.gradient as [string, string, ...string[]]}
                            style={styles.categoryItemIcon}
                          >
                            <Ionicons name={config.icon as any} size={16} color="white" />
                          </LinearGradient>
                          <Text style={styles.categoryItemName}>{category}</Text>
                        </View>
                        <View style={styles.categoryItemRight}>
                          <Text style={styles.categoryItemAmount}>${amount.toFixed(2)}</Text>
                          <Text style={styles.categoryItemPercentage}>{percentage.toFixed(1)}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </LinearGradient>
          </View>
        </BlurView>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.animatedHeaderGradient}
        >
          <Animated.View style={[styles.animatedHeaderContent, { transform: [{ translateY: headerTranslateY }] }]}>
            <Text style={styles.animatedHeaderTitle}>Smart Expenses</Text>
            <TouchableOpacity style={styles.animatedHeaderButton} onPress={handleScanReceipt}>
              <Ionicons name="camera" size={20} color="white" />
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#667eea"
            progressBackgroundColor="white"
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=500' }}
              style={styles.heroBackground}
              imageStyle={{ opacity: 0.1 }}
            >
              <BlurView intensity={20} style={styles.heroContent}>
                <View style={styles.heroHeader}>
                  <View>
                    <Text style={styles.heroTitle}>Smart Expenses</Text>
                    <Text style={styles.heroSubtitle}>AI-powered tracking & insights</Text>
                  </View>
                  <View style={styles.heroActions}>
                    <TouchableOpacity style={styles.heroButton} onPress={handleScanReceipt}>
                      <Ionicons name="camera" size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.heroButton} onPress={() => setShowAnalytics(true)}>
                      <Ionicons name="analytics" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.smartBanner}>
                  <TouchableOpacity
                    style={styles.smartBannerContent}
                    onPress={() => setShowLocationModal(true)}
                  >
                    <View style={styles.smartBannerLeft}>
                      <View style={styles.smartBannerIcon}>
                        <Ionicons name="location" size={20} color="white" />
                      </View>
                      <View>
                        <Text style={styles.smartBannerTitle}>Smart Detection Active</Text>
                        <Text style={styles.smartBannerSubtitle}>Tap for location suggestions</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                </View>
              </BlurView>
            </ImageBackground>
          </LinearGradient>
        </View>

        {/* Stats Card */}
        {renderStatsCard()}

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Recent Expenses */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            <Text style={styles.expenseCount}>{expenses.length} transactions</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.loadingText}>Loading smart expenses...</Text>
            </View>
          ) : expenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No Smart Expenses Yet</Text>
              <Text style={styles.emptySubtitle}>
                Start shopping and we'll detect your expenses automatically!
              </Text>
            </View>
          ) : (
            <FlatList
              data={expenses}
              renderItem={renderExpenseCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.expensesList}
            />
          )}
        </View>
      </Animated.ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => Alert.alert('Add Expense', 'Choose method:', [
          { text: 'Manual Entry', onPress: () => console.log('Manual') },
          { text: 'Scan Receipt', onPress: handleScanReceipt },
          { text: 'Cancel', style: 'cancel' }
        ])}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Modals */}
      {renderLocationModal()}
      {renderReceiptScanner()}
      {renderAnalyticsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  animatedHeaderGradient: {
    paddingTop: 50,
    paddingBottom: 16,
  },
  animatedHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  animatedHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  animatedHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroSection: {
    height: 280,
    marginBottom: 20,
  },
  heroGradient: {
    flex: 1,
  },
  heroBackground: {
    flex: 1,
  },
  heroContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
  },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartBanner: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  smartBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  smartBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smartBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  smartBannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  statsGradient: {
    borderRadius: 20,
  },
  statsContent: {
    padding: 20,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  statsSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  insightsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  quickActionsCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  recentSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  expenseCount: {
    fontSize: 14,
    color: '#64748B',
  },
  expensesList: {
    gap: 12,
  },
  expenseCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  expenseGradient: {
    borderRadius: 16,
  },
  expenseContent: {
    padding: 16,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  merchantName: {
    fontSize: 14,
    color: '#64748B',
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  detectionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeAgo: {
    fontSize: 12,
    color: '#64748B',
  },
  expenseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
  },
  detectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detectionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  expenseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  splitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  splitText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationModalContainer: {
    width: width * 0.9,
    borderRadius: 24,
    overflow: 'hidden',
  },
  locationModalGradient: {
    padding: 24,
  },
  locationModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  locationIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  locationModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  locationModalSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  quickSuggestionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  quickSuggestionItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  suggestionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionEmoji: {
    fontSize: 24,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  locationModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  scanReceiptButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scanReceiptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  scannerModalContainer: {
    width: width * 0.8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  scannerModalGradient: {
    padding: 40,
    alignItems: 'center',
  },
  scannerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  scannerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  scannerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  scannerProgress: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
  },
  analyticsModalContainer: {
    width: width * 0.95,
    height: height * 0.8,
    borderRadius: 24,
    overflow: 'hidden',
  },
  analyticsModalGradient: {
    flex: 1,
  },
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  analyticsContent: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  categoryBreakdown: {
    marginBottom: 24,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  categoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  categoryItemRight: {
    alignItems: 'flex-end',
  },
  categoryItemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  categoryItemPercentage: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});

