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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

const { width } = Dimensions.get('window');

// Smart Expense Interface matching the screenshots
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

// Mock Smart Expenses Data based on the screenshots
const mockSmartExpenses: SmartExpense[] = [
  {
    id: '1',
    amount: 28.5,
    description: 'Coffee',
    category: 'Coffee',
    merchant: 'Seven Seeds Coffee',
    location: 'Carlton, Melbourne',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
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
    date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
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
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
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
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    detectionMethod: 'auto',
    timeAgo: '3 days ago',
    canSplit: false,
    isConfirmed: true,
  },
];

// Category configuration matching the screenshots
const getCategoryConfig = (category: string) => {
  const configs = {
    Coffee: { icon: '☕', bgColor: '#FFF3E0', iconColor: '#FF8F00', textColor: '#E65100' },
    Groceries: { icon: '🛒', bgColor: '#E8F5E8', iconColor: '#4CAF50', textColor: '#2E7D32' },
    Dining: { icon: '🍽️', bgColor: '#FFEBEE', iconColor: '#F44336', textColor: '#C62828' },
    Transport: { icon: '🚗', bgColor: '#E3F2FD', iconColor: '#2196F3', textColor: '#1565C0' },
  };
  return configs[category as keyof typeof configs] || { 
    icon: '💳', 
    bgColor: '#F5F5F5', 
    iconColor: '#757575', 
    textColor: '#424242' 
  };
};

const getDetectionIcon = (method: string) => {
  switch (method) {
    case 'location': return { name: 'location' as const, color: '#2196F3' };
    case 'receipt': return { name: 'camera' as const, color: '#4CAF50' };
    case 'auto': return { name: 'flash' as const, color: '#FF9800' };
    default: return { name: 'add' as const, color: '#757575' };
  }
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

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
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
    // Simulate scanning process
    setTimeout(() => {
      setShowReceiptScanner(false);
      Alert.alert('Receipt Scanned!', 'Expense added automatically');
    }, 3000);
  };

  const renderExpenseCard = ({ item }: { item: SmartExpense }) => {
    const categoryConfig = getCategoryConfig(item.category);
    const detectionIcon = getDetectionIcon(item.detectionMethod);
    
    return (
      <TouchableOpacity
        style={[styles.expenseCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => setSelectedExpense(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.categoryIcon, { backgroundColor: categoryConfig.bgColor }]}>
              <Text style={styles.categoryEmoji}>{categoryConfig.icon}</Text>
            </View>
            <View style={styles.expenseInfo}>
              <View style={styles.amountRow}>
                <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
                  ${item.amount.toFixed(2)}
                </Text>
                {!item.isConfirmed && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>Pending</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.expenseDescription, { color: theme.colors.textSecondary }]}>
                {item.description}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                  {item.location}
                </Text>
                <Text style={[styles.dot, { color: theme.colors.textSecondary }]}>•</Text>
                <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                  {item.timeAgo}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.cardRight}>
            <View style={styles.detectionBadge}>
              <Ionicons name={detectionIcon.name} size={12} color={detectionIcon.color} />
            </View>
            {item.canSplit && (
              <TouchableOpacity style={styles.splitButton}>
                <Text style={styles.splitButtonText}>Split</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLocationModal = () => {
    if (!showLocationModal) return null;

    return (
      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.locationModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={styles.locationIcon}>
                <Ionicons name="location" size={24} color="#2196F3" />
              </View>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Location Detected!
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                You're at Coles Collins Street
              </Text>
            </View>
            
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickActionButton, styles.groceriesButton]}
                onPress={() => handleQuickAdd('Groceries')}
              >
                <Text style={styles.quickActionIcon}>🛒</Text>
                <Text style={styles.quickActionText}>Groceries</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, styles.snacksButton]}
                onPress={() => handleQuickAdd('Snacks')}
              >
                <Text style={styles.quickActionIcon}>🍿</Text>
                <Text style={styles.quickActionText}>Snacks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, styles.householdButton]}
                onPress={() => handleQuickAdd('Household')}
              >
                <Text style={styles.quickActionIcon}>🧽</Text>
                <Text style={styles.quickActionText}>Household</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.dismissButton]}
                onPress={() => setShowLocationModal(false)}
              >
                <Text style={styles.dismissButtonText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.scanButton]}
                onPress={() => {
                  setShowLocationModal(false);
                  handleScanReceipt();
                }}
              >
                <Text style={styles.scanButtonText}>Scan Receipt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderReceiptScanner = () => {
    if (!showReceiptScanner) return null;

    return (
      <Modal
        visible={showReceiptScanner}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReceiptScanner(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.scannerModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.scannerIcon}>
              <Ionicons name="camera" size={48} color="#4CAF50" />
            </View>
            <Text style={[styles.scannerTitle, { color: theme.colors.text }]}>
              Scanning Receipt...
            </Text>
            <Text style={[styles.scannerSubtitle, { color: theme.colors.textSecondary }]}>
              AI is extracting expense details
            </Text>
            <View style={styles.scannerProgress}>
              <View style={styles.progressDot} />
              <View style={styles.progressDot} />
              <View style={styles.progressDot} />
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F8FAFC' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Smart Expenses
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, styles.cameraButton]}
              onPress={handleScanReceipt}
            >
              <Ionicons name="camera" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, styles.analyticsButton]}
              onPress={() => setShowAnalytics(!showAnalytics)}
            >
              <Ionicons name="analytics" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Smart Detection Banner */}
        <TouchableOpacity
          style={styles.smartBanner}
          onPress={() => setShowLocationModal(true)}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerIcon}>
              <Ionicons name="location" size={20} color="white" />
            </View>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>Smart Detection Active</Text>
              <Text style={styles.bannerSubtitle}>Tap to see location suggestions</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Recent Expenses Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Recent Expenses
        </Text>
        <Text style={[styles.expenseCount, { color: theme.colors.textSecondary }]}>
          {expenses.length} expenses
        </Text>
      </View>

      {/* Expenses List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading smart expenses...
          </Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          renderItem={renderExpenseCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.expensesList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2196F3"
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={48} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No Smart Expenses Yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                Start shopping and we'll detect your expenses automatically!
              </Text>
            </View>
          )}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => Alert.alert('Add Expense', 'Choose method:', [
          { text: 'Manual Entry', onPress: () => console.log('Manual') },
          { text: 'Scan Receipt', onPress: handleScanReceipt },
          { text: 'Cancel', style: 'cancel' }
        ])}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>

      {/* Modals */}
      {renderLocationModal()}
      {renderReceiptScanner()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: '#4CAF50',
  },
  analyticsButton: {
    backgroundColor: '#2196F3',
  },
  smartBanner: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerContent: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  expenseCount: {
    fontSize: 14,
  },
  expensesList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  expenseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 24,
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
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF8F00',
  },
  expenseDescription: {
    fontSize: 16,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
  },
  dot: {
    fontSize: 12,
  },
  timeText: {
    fontSize: 12,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  detectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  splitButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  fabButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  locationModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 320,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  locationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  groceriesButton: {
    backgroundColor: '#E8F5E8',
  },
  snacksButton: {
    backgroundColor: '#FFF3E0',
  },
  householdButton: {
    backgroundColor: '#E3F2FD',
  },
  quickActionIcon: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissButton: {
    backgroundColor: '#F5F5F5',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  scanButton: {
    backgroundColor: '#4CAF50',
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  scannerModal: {
    margin: 20,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  scannerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  scannerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  scannerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  scannerProgress: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
});
