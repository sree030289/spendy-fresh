// src/screens/main/RealSplittingScreen.tsx - Updated with subscription limits
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { User } from '@/types';

// Import subscription helper
import { SubscriptionHelper } from '@/utils/SubscriptionHelper';

// FIXED: Import only the unified balance system
import { useSharedBalances } from '@/hooks/useSharedBalances';
import { useOverviewBalances } from '@/hooks/useBalances';
import { 
  BalanceCard, 
  BalanceList, 
  BalanceItem, 
  BalanceRefreshButton,
  EmptyBalanceState 
} from '@/components/balance/BalanceComponents';

// FIXED: Use only API service - removed Firebase splitting imports
import { ApiService } from '@/services/api/ApiService';

// Define types locally to avoid import conflicts
interface Friend {
  id: string;
  friendId: string;
  friendData: {
    id: string;
    fullName: string;
    email: string;
    avatar?: string;
  };
  status: 'pending' | 'accepted' | 'blocked';
  balance: number;
  createdAt: Date;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  avatar: string;
  createdBy: string;
  members: Array<{
    userId: string;
    userData: {
      fullName: string;
      email: string;
      avatar?: string;
    };
    role: 'admin' | 'member';
    balance: number;
  }>;
  currency: string;
  createdAt: Date;
}

interface Expense {
  id: string;
  title?: string; // For backward compatibility
  description: string;
  amount: number;
  groupId?: string;
  category: string;
  categoryIcon: string;
  paidBy: string;
  paidByData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  splitData?: Array<{
    userId: string;
    amount: number;
    isPaid: boolean;
  }>;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Expense categories for icon lookup
const EXPENSE_CATEGORIES = [
  { id: 'all', name: 'All Categories', icon: '📋', color: '#667eea' },
  { id: 'food', name: 'Food', icon: '🍕', color: '#F59E0B' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#3B82F6' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { id: 'utilities', name: 'Utilities', icon: '⚡', color: '#F59E0B' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#EF4444' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#06B6D4' },
  { id: 'settlement', name: 'Settlement', icon: '💸', color: '#10B981' },
  { id: 'other', name: 'Other', icon: '📝', color: '#6B7280' },
];

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  timestamp: Date;
  read: boolean;
}

// Import animation components - using simple versions for Expo Go compatibility
import FullScreenSuccessAnimationSimple from '@/components/animations/FullScreenSuccessAnimationSimple';
import FullScreenErrorSimple from '@/components/animations/FullScreenErrorSimple';
import { PaymentService } from '@/services/payments/PaymentService';
import { PushNotificationService } from '@/services/notifications/PushNotificationService';
import { RealNotificationService } from '@/services/notifications/RealNotificationService';
import { QRCodeService } from '@/services/qr/QRCodeService';
// REMOVED: friendsManager import - using only API service

// Import modals
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import AddFriendModal from '@/components/modals/AddFriendModal';
import CreateGroupModal from '@/components/modals/CreateGroupModal';
import QRCodeModal from '@/components/modals/QRCodeModal';
import PaymentModal from '@/components/modals/PaymentModal';
import GroupChatModal from '@/components/modals/GroupChatModal';
import ReceiptScannerModal from '@/components/modals/ReceiptScannerModal';
import GroupDetailsModal from '@/components/modals/GroupDetailsModal';
import ExpenseRefreshService from '@/services/expenseRefreshService';
import NotificationsModal from '@/components/modals/NotificationsModal';
import AnalyticsModal from '@/components/modals/AnalyticsModal';
import ExpenseDeletionModal from '@/components/modals/ExpenseDeletionModal';
import ExpenseSettlementModal from '@/components/modals/ExpenseSettlementModal';
import FriendRequestModal from '@/components/modals/FriendRequestModal';
import UnifiedSettlementScreen from './UnifiedSettlementScreen';
import ImportSplitwiseModal from '@/components/modals/ImportSplitwise';
import { getCurrencySymbol } from '@/utils/currency';
import { formatTimestamp } from '@/utils/timestamp';
import QRCodeScanner from '@/components/QRCodeScanner';
import QRScannerManager from '@/services/qr/QRScannerManager';
import EditExpenseModal from '@/components/modals/EditExpenseModal';
import SimpleExpenseListModal from '@/components/modals/SimpleExpenseListModal';
import RemindModal from '@/components/modals/RemindModal';
import SuccessAnimationModal from '@/components/modals/SuccessAnimationModal';
import GenericErrorModal from '@/components/modals/GenericErrorModal';
import ExportModal from '@/components/modals/ExportModal';
import { ExportService } from '@/services/ExportService';
import { CrossPlatformAlert } from '@/utils/alertUtils';

export default function RealSplittingScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // Initialize subscription helper
  const subscriptionHelper = SubscriptionHelper.getInstance();
  
  // Initialize API service
  const apiService = ApiService.getInstance();
  
  // PERFORMANCE OPTIMIZED: Single shared balance hook prevents duplicate calculations
  const sharedBalances = useSharedBalances();
  const { calculateSettlementBalances } = sharedBalances;
  
  // Helper function to get category icon
  const getCategoryIcon = (categoryId: string) => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === categoryId)?.icon || '💰';
  };
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [activeFriendsTab, setActiveFriendsTab] = useState('accepted'); // New state for friends subtabs
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  interface ContactData {
    name: string;
    phoneNumber: string;
  }
  
  // Data state - FIXED: Removed all old balance states
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Debug: Log expenses state changes - MEMOIZED
  const expensesDebugInfo = useMemo(() => ({
    length: expenses.length,
    expenses: expenses.map(e => ({
      id: e.id,
      description: e.description,
      amount: e.amount
    }))
  }), [expenses]);
  
  useEffect(() => {
    console.log('🚨🚨🚨 CLAUDE FIX ACTIVE - EXPENSES STATE CHANGED:', expensesDebugInfo);
  }, [expensesDebugInfo]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Friend requests state - FIXED: Added proper friend request management
  const [friendRequests, setFriendRequests] = useState<{incoming: any[], outgoing: any[]}>({incoming: [], outgoing: []});
  const [pendingFriends, setPendingFriends] = useState<Friend[]>([]);
  const [acceptedFriends, setAcceptedFriends] = useState<Friend[]>([]);
  
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [selectedGroupForExpense, setSelectedGroupForExpense] = useState<Group | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Modal states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanSource, setQrScanSource] = useState<'direct' | 'addFriend' | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  
  // Remind modal state
  const [showRemindModal, setShowRemindModal] = useState(false);
  const [selectedFriendForRemind, setSelectedFriendForRemind] = useState<Friend | null>(null);
  const [remindBalance, setRemindBalance] = useState(0);
  
  // Animated success modal state
  const [showAnimatedModal, setShowAnimatedModal] = useState(false);
  const [animatedModalProps, setAnimatedModalProps] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning';
  }>({
    title: '',
    message: '',
    type: 'success'
  });
  
  // Generic error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalProps, setErrorModalProps] = useState<{
    title: string;
    message: string;
    primaryButtonText?: string;
    secondaryButtonText?: string;
    onPrimaryPress?: () => void;
    onSecondaryPress?: () => void;
  }>({
    title: '',
    message: '',
  });
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedGroupForExport, setSelectedGroupForExport] = useState<Group | null>(null);
  
  // Full-screen animation states
  const [showFullScreenSuccess, setShowFullScreenSuccess] = useState(false);
  const [fullScreenSuccessProps, setFullScreenSuccessProps] = useState<{
    title: string;
    message: string;
    subtitle?: string;
    buttonText?: string;
    onContinue?: () => void;
  }>({
    title: '',
    message: '',
  });
  
  const [showFullScreenError, setShowFullScreenError] = useState(false);
  const [fullScreenErrorProps, setFullScreenErrorProps] = useState<{
    title: string;
    message: string;
    subtitle?: string;
    errorCode?: string;
    onRestart: () => void;
  }>({
    title: '',
    message: '',
    onRestart: () => {},
  });
  
  // Additional modal states
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showExpenseApproval, setShowExpenseApproval] = useState(false);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [showExpenseSettlement, setShowExpenseSettlement] = useState(false);
  const [showExpenseDeletion, setShowExpenseDeletion] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  // NEW: Unified settlement state
  const [showUnifiedSettlement, setShowUnifiedSettlement] = useState(false);
  const [settlementConfig, setSettlementConfig] = useState<{
    filter: 'all' | 'friends' | 'groups' | 'friend';
    groupId?: string;
    friendId?: string;
  }>({ filter: 'all' });
  
  const [selectedExpenseForAction, setSelectedExpenseForAction] = useState<Expense | null>(null);
  
  // Friend request modal state
  const [showFriendRequest, setShowFriendRequest] = useState(false);
  const [selectedFriendRequest, setSelectedFriendRequest] = useState<any>(null);
  
  // Import Splitwise modal state
  const [showImportSplitwise, setShowImportSplitwise] = useState(false);

  // Simple Expense List Modal states
  const [showSimpleExpenseList, setShowSimpleExpenseList] = useState(false);
  const [expenseListGroupId, setExpenseListGroupId] = useState<string | undefined>(undefined);
  const [expenseListTitle, setExpenseListTitle] = useState('All Expenses');

  const [groupBalances, setGroupBalances] = useState<Map<string, number>>(new Map());
  const { calculateGroupBalance } = useOverviewBalances();

  // Settlement balances state for Friends tab (moved to top level to avoid conditional hooks)
  const [settlementBalances, setSettlementBalances] = useState<Array<{
    userId: string;
    name: string;
    email: string;
    balance: number;
    source: string;
    groupName?: string;
    groupId?: string;
  }>>([]);

  // Set up subscription helper when component mounts
  useEffect(() => {
    if ((global as any).showSubscriptionModal) {
      subscriptionHelper.setShowSubscriptionModal((global as any).showSubscriptionModal);
    }
    
    // Set up global function to process pending expenses after countdown
    (window as any).processPendingExpense = async (expenseData: any, fromGroupDetails?: Group | null) => {
      console.log('📋 Processing pending expense:', expenseData);
      try {
        const response = await apiService.addExpense({
          ...expenseData,
          isSettled: false,
          date: new Date()
        });
        
        const expenseId = response.id;
        console.log('Expense added successfully after countdown:', expenseId);
        
        // Notify all listeners about the new expense
        ExpenseRefreshService.getInstance().notifyExpenseAdded();
        
        // Force refresh local data and notify balance system
        await Promise.all([
          loadGroups(),
          loadRecentExpenses()
        ]);
        
        // Notify unified balance system
        notifyBalanceChange();
        
        setShowAddExpense(false);
        setSelectedGroupForExpense(null);
        
        // Show success animation
        showFullScreenSuccessAnimation(
          'Expense Added! 🧾', 
          'Expense has been added and split successfully!',
          fromGroupDetails ? `Added to ${fromGroupDetails.name}` : 'Check your groups for updates'
        );
      } catch (error) {
        console.error('Error processing pending expense:', error);
        Alert.alert('Error', 'Failed to add expense. Please try again.');
      }
    };
    
    return () => {
      (window as any).processPendingExpense = undefined;
    };
  }, []);

  // FIXED: Initialize friends data when user is available
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 Initializing friends data for user:', user.id);
      loadFriendsAndRequests().then(() => {
        console.log('✅ Friends data initialization complete');
      }).catch((error) => {
        console.error('❌ Friends data initialization failed:', error);
      });
    }
  }, [user?.id]);

  // Calculate balances for all groups with detailed logging
  useEffect(() => {
    const calculateAllGroupBalances = async () => {
      if (!user?.id || !sharedBalances.calculateSettlementBalances) {
        console.log('❌ Missing user ID or calculateGroupBalance function');
        return;
      }
      
      console.log('🔄 Calculating balances for', groups.length, 'groups');
      const newBalances = new Map<string, number>();
      
      for (const group of groups) {
        console.log(`\n📊 Calculating balance for group: ${group.name} (${group.id})`);
        console.log(`👥 Group members: ${group.members.length}`);
        
        let totalGroupBalance = 0;
        
        for (const member of group.members) {
          if (member.userId === user.id) {
            console.log(`⏭️  Skipping self: ${member.userData?.fullName || 'Self'}`);
            continue;
          }
          
          try {
            // Skip group balance calculation for now - handled by shared balances
            const pairwiseBalance = 0; // await calculateGroupBalance(user.id, member.userId, group.id);
            console.log(`💰 Balance with ${member.userData?.fullName || 'Unknown User'}: ${pairwiseBalance}`);
            
            // FIXED: Only add non-zero balances to avoid floating point errors
            if (Math.abs(pairwiseBalance) > 0.01) {
              totalGroupBalance += pairwiseBalance;
            }
          } catch (error) {
            console.error(`❌ Error calculating balance with ${member.userData?.fullName || 'Unknown User'}:`, error);
          }
        }
        
        // Round to 2 decimal places to avoid floating point issues
        totalGroupBalance = parseFloat(totalGroupBalance.toFixed(2));
        
        console.log(`✅ Total balance for ${group.name}: ${totalGroupBalance}`);
        newBalances.set(group.id, totalGroupBalance);
      }
      
      console.log('📋 Final group balances:', Array.from(newBalances.entries()));
      setGroupBalances(newBalances);
    };
    
    // Add debounce to prevent excessive calculations
    const timeoutId = setTimeout(calculateAllGroupBalances, 500);
    return () => clearTimeout(timeoutId);
  }, [groups, user?.id, sharedBalances]);

  // Load settlement balances for Friends tab (moved to top level to avoid conditional hooks)
  useEffect(() => {
    const loadSettlementBalances = async () => {
      if (!user?.id) {
        console.log('❌ No user ID available for settlement balances');
        return;
      }
      try {
        console.log('🔄 Loading settlement balances for user:', user.id);
        const balances = await sharedBalances.calculateSettlementBalances(user.id);
        console.log('📊 Raw settlement balances from sharedBalances:', balances);
        
        // Create settlement balances from both actual balances AND accepted friends
        let friendSettlementBalances = [];
        
        // Debug accepted friends data
        const acceptedFriends = friends.filter(f => f.status === 'accepted');
        console.log('🔍 DEBUG: Accepted friends data:', acceptedFriends.map(f => ({
          id: f.id,
          friendId: f.friendId,
          name: f.friendData?.fullName,
          email: f.friendData?.email,
          status: f.status,
          fullFriendData: f.friendData,
          rawFriend: f
        })));
        
        // CRITICAL DEBUG: Check if any friend has undefined friendId
        const friendsWithUndefinedId = acceptedFriends.filter(f => !f.friendId);
        if (friendsWithUndefinedId.length > 0) {
          console.error('🚨 CRITICAL: Friends with undefined friendId found:', friendsWithUndefinedId);
        }
        
        // CRITICAL DEBUG: Check if any friend has undefined friendData
        const friendsWithUndefinedData = acceptedFriends.filter(f => !f.friendData);
        if (friendsWithUndefinedData.length > 0) {
          console.error('🚨 CRITICAL: Friends with undefined friendData found:', friendsWithUndefinedData);
        }
        
        console.log('🔍 DEBUG: Raw balance calculation results:', balances.map(b => ({
          userId: b.userId,
          name: b.name,
          email: b.email,
          balance: b.balance,
          source: b.source
        })));
        
        // First, add all non-zero balances with enhanced name resolution
        const nonZeroBalances = balances
          .filter(balance => Math.abs(balance.balance) > 0.01)
          .map(balance => {
            // Try to get a better name from the friends list if available
            const friendMatch = acceptedFriends.find(f => f.friendId === balance.userId);
            const betterName = friendMatch?.friendData?.fullName || balance.name;
            const betterEmail = friendMatch?.friendData?.email || balance.email;
            
            console.log(`🔍 DEBUG: Balance entry for ${balance.userId}:`, {
              originalName: balance.name,
              betterName,
              friendMatch: !!friendMatch,
              friendName: friendMatch?.friendData?.fullName,
              friendEmail: friendMatch?.friendData?.email,
              balanceAmount: balance.balance
            });
            
            return {
              userId: balance.userId,
              name: betterName || 'Debug: Unknown User',
              email: betterEmail,
              balance: balance.balance,
              source: balance.source,
              groupName: balance.groupName,
              groupId: balance.groupId
            };
          });
        
        console.log('🔍 DEBUG: Enhanced non-zero balances:', nonZeroBalances);
        
        // Then, add accepted friends who don't have balances (settled/no transactions)
        const balanceUserIds = new Set(balances.map(b => b.userId));
        
        const settledFriends = acceptedFriends
          .filter(friend => {
            // Only include friends with valid friendId AND friendData
            const hasValidId = Boolean(friend.friendId);
            const hasValidData = Boolean(friend.friendData);
            const notInBalances = !balanceUserIds.has(friend.friendId);
            
            if (!hasValidId) {
              console.warn('⚠️ Skipping friend with undefined friendId:', friend);
              return false;
            }
            if (!hasValidData) {
              console.warn('⚠️ Skipping friend with undefined friendData:', friend);
              return false;
            }
            
            return notInBalances;
          })
          .map(friend => {
            console.log(`🔍 DEBUG: Adding settled friend ${friend.friendId}:`, {
              name: friend.friendData?.fullName,
              email: friend.friendData?.email,
              fullData: friend.friendData
            });
            
            return {
              userId: friend.friendId,
              name: friend.friendData?.fullName || 'Debug: Settled Unknown User',
              email: friend.friendData?.email || '',
              balance: 0,
              source: 'direct',
              groupName: undefined,
              groupId: undefined
            };
          });
        
        console.log('🔍 DEBUG: Settled friends:', settledFriends);
        
        // Combine and ensure uniqueness by userId-source-groupId combination
        const allEntries = [...nonZeroBalances, ...settledFriends];
        
        // Aggressive deduplication by userId only (keep only ONE entry per user)
        const finalUnique = new Map();
        allEntries.forEach(entry => {
          const existing = finalUnique.get(entry.userId);
          
          if (!existing) {
            // First entry for this user
            finalUnique.set(entry.userId, entry);
          } else {
            // Decide which entry to keep based on priority:
            // 1. Prefer non-zero balance over zero balance
            // 2. If both have balances, prefer the one with higher absolute balance
            // 3. If balances are equal, prefer group over direct
            
            const entryHasBalance = Math.abs(entry.balance) > 0.01;
            const existingHasBalance = Math.abs(existing.balance) > 0.01;
            
            if (entryHasBalance && !existingHasBalance) {
              // Entry has balance, existing doesn't - use entry
              finalUnique.set(entry.userId, entry);
            } else if (!entryHasBalance && existingHasBalance) {
              // Existing has balance, entry doesn't - keep existing
              // Do nothing
            } else if (entryHasBalance && existingHasBalance) {
              // Both have balances - use the one with higher absolute balance
              if (Math.abs(entry.balance) > Math.abs(existing.balance)) {
                finalUnique.set(entry.userId, entry);
              }
            } else {
              // Both are settled (zero balance) - prefer group over direct
              if (entry.source !== 'direct' && existing.source === 'direct') {
                finalUnique.set(entry.userId, entry);
              }
            }
          }
        });
        
        friendSettlementBalances = Array.from(finalUnique.values());
        
        // CRITICAL: Filter out any entries with undefined userId before setting state
        const validSettlementBalances = friendSettlementBalances.filter(balance => {
          if (!balance.userId) {
            console.error('🚨 CRITICAL: Found balance entry with undefined userId:', balance);
            return false;
          }
          return true;
        });
        
        console.log('👥 Settlement balances after processing:', validSettlementBalances.length, 'entries');
        console.log('👥 Non-zero balances:', nonZeroBalances.length);
        console.log('👥 Settled friends added:', settledFriends.length);
        console.log('👥 Final settlement balances with names:', validSettlementBalances.map(b => ({
          userId: b.userId,
          name: b.name,
          email: b.email,
          balance: b.balance,
          source: b.source
        })));
        setSettlementBalances(validSettlementBalances);
      } catch (error) {
        console.error('Failed to load settlement balances for Friends tab:', error);
        // Fallback to showing just accepted friends with zero balances
        console.log('⚠️ Error occurred, showing accepted friends as fallback');
        const acceptedFriends = friends.filter(f => f.status === 'accepted');
        console.log('🔍 DEBUG FALLBACK: Accepted friends:', acceptedFriends.map(f => ({
          id: f.id,
          friendId: f.friendId,
          name: f.friendData?.fullName,
          email: f.friendData?.email,
          fullFriendData: f.friendData
        })));
        
        const fallbackBalances = acceptedFriends.map(friend => ({
          userId: friend.friendId,
          name: friend.friendData?.fullName || 'Unknown User',
          email: friend.friendData?.email || '',
          balance: 0,
          source: 'direct',
          groupName: undefined,
          groupId: undefined
        }));
        console.log('🔍 DEBUG FALLBACK: Final balances:', fallbackBalances);
        setSettlementBalances(fallbackBalances);
      }
    };

    loadSettlementBalances();
  }, [sharedBalances, friends, user?.id]); // Added friends dependency back since we're using it
  
  // FIXED: Unified balance change notification
  const notifyBalanceChange = useCallback(() => {
    sharedBalances.notifyChange();
    sharedBalances.notifyChange();
  }, [sharedBalances.notifyChange, sharedBalances.notifyChange]);

  // Reset to overview tab when the screen gains focus (when bottom tab is pressed)
  useFocusEffect(
    useCallback(() => {
      setActiveTab('overview');
    }, [])
  );

  // FIXED: Updated tab switching with unified balance refresh
  const handleTabSwitch = useCallback((tabId: string) => {
    setActiveTab(tabId);
    
    if (tabId === 'friends') {
      sharedBalances.refresh();
      loadFriendsAndRequests().catch(() => {
        console.log('API service not ready for friends tab refresh');
      });
    } else if (tabId === 'groups') {
      loadGroups();
    } else if (tabId === 'overview') {
      sharedBalances.refresh();
      Promise.all([
        loadFriendsAndRequests().catch(() => {
          console.log('API service not ready for overview refresh');
        }),
        loadGroups(), 
        loadRecentExpenses()
      ]);
    }
  }, [sharedBalances.refresh, sharedBalances.refresh]);

  // Real-time listeners
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribeFriends: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const initializeData = async () => {
      try {
        setLoading(true);
        
        // Load friends and requests FIRST
        console.log('🚀 Starting data loading - user ID:', user?.id);
        console.log('⏰ Step 1: Loading friends and requests...');
        const loadedFriends = await loadFriendsAndRequests();
        console.log('✅ Step 1 complete: Friends data loaded', loadedFriends.length, 'friends');
        
        // Load groups SECOND (needed for user name resolution in expenses)
        console.log('⏰ Step 2: Loading groups...');
        const loadedGroups = await loadGroups();
        console.log('✅ Step 2 complete: Groups data loaded', loadedGroups.length, 'groups');
        
        // Load notifications in parallel (not needed for expenses)
        console.log('⏰ Step 3: Loading notifications...');
        await loadNotifications();
        console.log('✅ Step 3 complete: Notifications loaded');
        
        // PERFORMANCE: Load essential data first, defer expenses for better UX
        console.log('⏰ Essential data loaded, showing UI immediately');
        setLoading(false); // Show UI immediately with balance data
        
        // LAZY LOAD: Load recent expenses in background after UI is shown
        console.log('⏰ Background: Starting lazy load of expenses...');
        setTimeout(() => {
          loadRecentExpenses(loadedFriends, loadedGroups).then(() => {
            console.log('✅ Background: Recent expenses loaded');
          }).catch(error => {
            console.error('❌ Background: loadRecentExpenses failed:', error);
          });
        }, 100); // Small delay to allow UI to render first
        
        // Set up periodic refresh for friends data
        const friendsRefreshInterval = setInterval(async () => {
          try {
            await loadFriendsAndRequests();
            notifyBalanceChange();
          } catch (error) {
            console.log('Error in friends refresh interval:', error);
          }
        }, 120000); // OPTIMIZED: Refresh every 2 minutes instead of 30 seconds
        
        // Store cleanup function
        unsubscribeFriends = () => {
          clearInterval(friendsRefreshInterval);
        };
        
      } catch (error) {
        console.error('Initialize splitting screen error:', error);
        Alert.alert('Error', 'Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initializeData();

    return () => {
      unsubscribeFriends?.();
      unsubscribeNotifications?.();
      // Cleanup handled by unsubscribeFriends function
    };
  }, [user?.id, notifyBalanceChange]);

  useEffect(() => {
    const refreshService = ExpenseRefreshService.getInstance();
    const unsubscribe = refreshService.addListener(() => {
      console.log('Received expense refresh notification');
      // Refresh data and notify balance system
      loadRecentExpenses();
      loadGroups();
      notifyBalanceChange();
    });

    return () => {
      unsubscribe();
    };
  }, [notifyBalanceChange]);

  // Handle deep linking from notifications
  useEffect(() => {
    const checkNavigationIntent = async () => {
      try {
        const intent = await RealNotificationService.getAndClearNavigationIntent();
        if (intent && user?.id) {
          console.log('Processing navigation intent:', intent);
          await handleNavigationIntent(intent);
        }
      } catch (error) {
        console.error('Error processing navigation intent:', error);
      }
    };

    checkNavigationIntent();
    const interval = setInterval(checkNavigationIntent, 1000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      if (!user?.id) return;
      const notificationsData = await apiService.getNotifications(user.id);
      
      // Ensure notificationsData is an array before processing
      const dataArray = Array.isArray(notificationsData) ? notificationsData : [];
      
      const processedNotifications = dataArray.map(notification => ({
        ...notification,
        createdAt: notification.createdAt && typeof (notification.createdAt as any).toDate === 'function' 
          ? (notification.createdAt as any).toDate() 
          : new Date(notification.createdAt || Date.now())
      }));
      
      setNotifications(processedNotifications);
    } catch (error) {
      console.error('Load notifications error:', error);
    }
  };

  // Navigate to expenses modal instead of tab
  const navigateToExpenses = () => {
    setExpenseListGroupId(undefined);
    setExpenseListTitle('All Expenses');
    setShowSimpleExpenseList(true);
  };

  // Load groups data
  const loadGroups = async (): Promise<Group[]> => {
    try {
      if (!user?.id) return [];
      const groupsData = await apiService.getUserGroups();
      
      // Calculate total expenses for each group
      const groupsWithTotals = await Promise.all(
        (Array.isArray(groupsData) ? groupsData : []).map(async (group) => {
          try {
            const groupExpenses = await apiService.getGroupExpenses(group.id);
            const totalExpenses = groupExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
            return {
              ...group,
              totalExpenses: totalExpenses
            };
          } catch (error) {
            console.error(`Error calculating expenses for group ${group.id}:`, error);
            return {
              ...group,
              totalExpenses: 0
            };
          }
        })
      );
      
      setGroups(groupsWithTotals);
      return groupsWithTotals;
    } catch (error) {
      console.error('Load groups error:', error);
      setGroups([]);
      return [];
    }
  };

  // Load recent expenses
  const loadRecentExpenses = async (loadedFriends?: Friend[], loadedGroups?: Group[]) => {
    console.log('🚀 loadRecentExpenses: FUNCTION CALLED');
    try {
      if (!user?.id) {
        console.log('⚠️  loadRecentExpenses: No user ID available, user:', user);
        return;
      }
      console.log('🔄 loadRecentExpenses: Loading expenses for user:', user.id);
      
      // Use passed data or fall back to state
      const friendsData = loadedFriends || friends;
      const groupsData = loadedGroups || groups;
      
      console.log('🔍 loadRecentExpenses: Using data:', {
        friendsCount: friendsData.length,
        groupsCount: groupsData.length,
        fromParameters: !!loadedFriends || !!loadedGroups
      });
      
      // Try primary method: getUserExpenses
      let expensesData: any[] = [];
      let usedFallback = false;
      try {
        expensesData = await apiService.getUserExpenses(user.id, 10);
        console.log('📋 loadRecentExpenses: Primary API call successful:', expensesData);
        
        // If we get very few expenses (less than expected), use fallback for comprehensive results
        // This helps when the API endpoint is incomplete or missing some user expenses
        if (expensesData.length < 3 && groupsData.length > 0) {
          console.log('⚠️  Primary API returned limited expenses, trying fallback for comprehensive results');
          throw new Error('Incomplete primary results - using fallback');
        }
      } catch (primaryError) {
        console.log('⚠️  Primary getUserExpenses failed or incomplete, trying fallback method:', primaryError.message || primaryError);
        usedFallback = true;
        
        // Fallback: Get expenses from all user groups
        try {
          const allExpenses: any[] = [];
          for (const group of groupsData) {
            const groupExpenses = await apiService.getGroupExpenses(group.id);
            console.log(`📋 Fallback: Group ${group.name} has ${groupExpenses.length} total expenses`);
            
            // Filter for expenses where user is involved (paidBy or in splits)
            const userExpenses = groupExpenses.filter(expense => {
              console.log(`🔍 Processing expense: ${expense.description}`);
              console.log(`  splitType: "${expense.splitType}" (type: ${typeof expense.splitType})`);
              console.log(`  paidBy: ${expense.paidBy}`);
              console.log(`  user.id: ${user.id}`);
              console.log(`  splitData: ${expense.splitData ? 'present' : 'missing'}`);
              console.log(`  splitDetails: ${expense.splitDetails ? 'present' : 'missing'}`);
              if (expense.splitData) {
                console.log(`  splitData content:`, expense.splitData);
              }
              if (expense.splitDetails) {
                console.log(`  splitDetails content:`, expense.splitDetails);
              }
              const isPaidBy = expense.paidBy === user.id;
              const isInSplitData = expense.splitData && expense.splitData.some((split: any) => split.userId === user.id);
              const isInSplitDetails = expense.splitDetails && expense.splitDetails.some((split: any) => split.userId === user.id);
              
              console.log(`  isPaidBy: ${isPaidBy}`);
              console.log(`  isInSplitData: ${isInSplitData}`);
              console.log(`  isInSplitDetails: ${isInSplitDetails}`);
              
              // For expenses without split data, use dynamic logic to determine involvement
              let isInvolvedInEqualSplit = false;
              if (expense.splitType === 'equal' || !expense.splitType) {
                // For equal split expenses, assume user is involved unless proven otherwise
                // This could be enhanced to check expense timestamps vs user join dates
                isInvolvedInEqualSplit = true;
                console.log(`🔍 User assumed involved in equal split: ${expense.description}`);
              } else if (expense.splitType === 'custom') {
                // For custom split expenses, be more conservative - only include if user paid
                isInvolvedInEqualSplit = isPaidBy;
                console.log(`🔍 Custom split expense, user involved based on payment: ${expense.description}`);
              } else {
                console.log(`🔍 Unknown split type: ${expense.splitType} for expense: ${expense.description}`);
                isInvolvedInEqualSplit = false;
              }
              
              const isInvolved = isPaidBy || isInSplitData || isInSplitDetails || isInvolvedInEqualSplit;
              
              console.log(`  isInvolvedInEqualSplit: ${isInvolvedInEqualSplit}`);
              console.log(`  Final isInvolved: ${isInvolved}`);
              
              if (isInvolved) {
                console.log(`✅ User involved in expense: ${expense.description} (${
                  isPaidBy ? 'paid by user' : 
                  isInSplitData || isInSplitDetails ? 'in split data' : 
                  'equal split assumption'
                })`);
              } else {
                console.log(`❌ User NOT involved in expense: ${expense.description} (${
                  expense.splitType === 'custom' ? 'custom split exclusion' : 'other reason'
                })`);
              }
              
              return isInvolved;
            });
            console.log(`📋 Fallback: Found ${userExpenses.length} relevant expenses for user in group ${group.name}`);
            allExpenses.push(...userExpenses);
          }
          
          // Sort by date (most recent first) and limit to 10
          allExpenses.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date || 0).getTime();
            const dateB = new Date(b.createdAt || b.date || 0).getTime();
            return dateB - dateA;
          });
          
          expensesData = allExpenses.slice(0, 10);
          console.log('✅ Fallback method successful, found expenses:', expensesData.length);
        } catch (fallbackError) {
          console.error('❌ Fallback method also failed:', fallbackError);
          expensesData = [];
        }
      }
      
      console.log('📋 loadRecentExpenses: Raw expenses data received:', expensesData);
      console.log('📋 loadRecentExpenses: Is array?', Array.isArray(expensesData), 'Length:', Array.isArray(expensesData) ? expensesData.length : 'N/A');
      console.log('📋 loadRecentExpenses: Method used:', usedFallback ? 'FALLBACK (group-based)' : 'PRIMARY (user API)');
      
      // Enhance expenses with user information from friends and group members data
      console.log('🔍 loadRecentExpenses: Starting expense enhancement with:', {
        friendsCount: friendsData.length,
        groupsCount: groupsData.length,
        expensesCount: expensesData.length
      });
      
      const enhancedExpenses = expensesData.map(expense => {
        console.log(`🔍 Processing expense: ${expense.description} paid by ${expense.paidBy}`);
        
        // Find the payer information
        let paidByData = null;
        if (expense.paidBy === user.id) {
          paidByData = { fullName: 'You' };
          console.log(`✅ Payer is current user (You)`);
        } else {
          // Look for the payer in friends data first
          console.log(`🔍 Looking for payer ${expense.paidBy} in friends:`, friendsData.map(f => ({
            id: f.id, 
            friendId: f.friendId, 
            name: (f as any).name || (f as any).fullName || f.friendData?.fullName
          })));
          
          const friend = friendsData.find(f => f.id === expense.paidBy || f.friendId === expense.paidBy);
          if (friend) {
            const friendName = (friend as any).name || (friend as any).fullName || friend.friendData?.fullName || (friend as any).email || friend.friendData?.email || 'Friend';
            paidByData = { fullName: friendName };
            console.log(`✅ Found payer in friends: ${friendName}`);
          } else {
            console.log(`⚠️ Payer not found in friends, checking group members...`);
            // If not found in friends, look in group members
            for (const group of groupsData) {
              if (group.members && Array.isArray(group.members)) {
                console.log(`🔍 Checking group ${group.name} with ${group.members.length} members:`, group.members.map(m => ({
                  userId: m.userId,
                  name: m.userData?.fullName || m.userData?.email
                })));
                
                const member = group.members.find((m: any) => m.userId === expense.paidBy);
                if (member && member.userData) {
                  const memberName = member.userData.fullName || member.userData.email || 'Group Member';
                  paidByData = { fullName: memberName };
                  console.log(`✅ Found payer in group ${group.name}: ${memberName}`);
                  break;
                }
              }
            }
            
            if (!paidByData) {
              console.log(`❌ Payer ${expense.paidBy} not found in friends or groups - will show as Unknown`);
            }
          }
        }
        
        // Ensure dates are properly converted to Date objects
        const enhancedExpense = {
          ...expense,
          paidByData
        };
        
        // Convert Firebase Timestamp objects to JavaScript Date objects
        console.log('📅 Processing date conversion for expense:', enhancedExpense.description);
        
        // Handle Firebase Timestamp objects for date field
        if (enhancedExpense.date) {
          if (enhancedExpense.date._isDate && enhancedExpense.date.iso) {
            // Firebase Timestamp with iso field
            enhancedExpense.date = new Date(enhancedExpense.date.iso);
            console.log(`📅 Converted Firebase Timestamp date: ${enhancedExpense.date}`);
          } else if (enhancedExpense.date.timestamp) {
            // Firebase Timestamp with timestamp field
            enhancedExpense.date = new Date(enhancedExpense.date.timestamp);
            console.log(`📅 Converted Firebase timestamp to Date: ${enhancedExpense.date}`);
          } else if (typeof enhancedExpense.date === 'string') {
            // String date
            enhancedExpense.date = new Date(enhancedExpense.date);
            console.log(`📅 Converted string date to Date object: ${enhancedExpense.date}`);
          } else if (typeof enhancedExpense.date === 'number') {
            // Timestamp number
            enhancedExpense.date = new Date(enhancedExpense.date);
            console.log(`📅 Converted timestamp number to Date: ${enhancedExpense.date}`);
          }
        }

        // Handle Firebase Timestamp objects for createdAt field
        if (enhancedExpense.createdAt) {
          if (enhancedExpense.createdAt._isDate && enhancedExpense.createdAt.iso) {
            // Firebase Timestamp with iso field
            enhancedExpense.createdAt = new Date(enhancedExpense.createdAt.iso);
            console.log(`📅 Converted Firebase Timestamp createdAt: ${enhancedExpense.createdAt}`);
          } else if (enhancedExpense.createdAt.timestamp) {
            // Firebase Timestamp with timestamp field
            enhancedExpense.createdAt = new Date(enhancedExpense.createdAt.timestamp);
            console.log(`📅 Converted Firebase createdAt timestamp: ${enhancedExpense.createdAt}`);
          } else if (typeof enhancedExpense.createdAt === 'string') {
            // String date
            enhancedExpense.createdAt = new Date(enhancedExpense.createdAt);
            console.log(`📅 Converted string createdAt to Date: ${enhancedExpense.createdAt}`);
          }
        }

        // Handle Firebase Timestamp objects for updatedAt field
        if (enhancedExpense.updatedAt) {
          if (enhancedExpense.updatedAt._isDate && enhancedExpense.updatedAt.iso) {
            // Firebase Timestamp with iso field
            enhancedExpense.updatedAt = new Date(enhancedExpense.updatedAt.iso);
            console.log(`📅 Converted Firebase Timestamp updatedAt: ${enhancedExpense.updatedAt}`);
          } else if (enhancedExpense.updatedAt.timestamp) {
            // Firebase Timestamp with timestamp field
            enhancedExpense.updatedAt = new Date(enhancedExpense.updatedAt.timestamp);
            console.log(`📅 Converted Firebase updatedAt timestamp: ${enhancedExpense.updatedAt}`);
          } else if (typeof enhancedExpense.updatedAt === 'string') {
            // String date
            enhancedExpense.updatedAt = new Date(enhancedExpense.updatedAt);
            console.log(`📅 Converted string updatedAt to Date: ${enhancedExpense.updatedAt}`);
          }
        }

        // Ensure we have a valid date for display
        if (!enhancedExpense.date && enhancedExpense.createdAt) {
          enhancedExpense.date = enhancedExpense.createdAt;
          console.log(`📅 Using createdAt as date fallback: ${enhancedExpense.date}`);
        }
        
        if (!enhancedExpense.date) {
          enhancedExpense.date = new Date();
          console.log(`📅 Using current date as final fallback: ${enhancedExpense.date}`);
        }
        
        return enhancedExpense;
      });
      
      // Ensure we always set an array  
      const finalExpenses = Array.isArray(enhancedExpenses) ? enhancedExpenses : [];
      
      // Apply dynamic filtering based on user involvement in expenses
      console.log('🌟 Applying dynamic expense filtering for user:', user?.id);
      let filteredExpenses = finalExpenses;
      
      // For now, show all expenses to all users - proper involvement checking would require
      // tracking when users joined groups and analyzing split data more carefully
      // In a production app, you'd want more sophisticated logic here
      filteredExpenses = finalExpenses; // Show all expenses for now
      
      console.log('✅ Showing all expenses to maintain consistent user experience');
      console.log('✅ Total expenses shown:', filteredExpenses.length);
      console.log('✅ Expense descriptions:', filteredExpenses.map(e => e.description));
      setExpenses(filteredExpenses);
      console.log('✅ loadRecentExpenses: Set expenses array with length:', filteredExpenses.length);
      
      // Check expense data after Firebase Timestamp conversion
      console.log('🕐 FINAL CHECK: Enhanced debug logging at', new Date().toISOString());
      if (finalExpenses.length > 0) {
        const exp = finalExpenses[0];
        console.log('🔍 FINAL EXPENSE OBJECT AFTER CONVERSION:');
        console.log('  📋 Description:', exp.description);
        console.log('  � Date field AFTER conversion:', exp.date, 'Type:', typeof exp.date);
        console.log('  📅 CreatedAt field AFTER conversion:', exp.createdAt, 'Type:', typeof exp.createdAt);
        console.log('  ✅ Date isValid:', exp.date ? !isNaN(new Date(exp.date).getTime()) : false);
        console.log('  ✅ CreatedAt isValid:', exp.createdAt ? !isNaN(new Date(exp.createdAt).getTime()) : false);
      }
    } catch (error) {
      console.error('❌ Load expenses error:', error);
      // Set empty array on error to prevent undefined
      setExpenses([]);
    }
  };

  // FIXED: Load friends and friend requests
  const loadFriendsAndRequests = async (): Promise<Friend[]> => {
    try {
      if (!user?.id) return [];
      
      console.log('🔄 Loading friends and friend requests...');
      
      // Get both friends and friend requests
      const [friendsResponse, requestsData] = await Promise.all([
        apiService.getFriends(),
        apiService.getFriendRequests()
      ]);
      
      console.log('📋 Raw friends response:', friendsResponse);
      console.log('📋 Raw requests data:', requestsData);
      
      // Extract friends array from API response - API returns { success: true, data: friends[] }
      const rawFriendsData = friendsResponse || [];
      console.log('📋 Extracted friends data:', rawFriendsData);
      
      // Transform API data to match our Friend interface
      const transformedFriends: Friend[] = Array.isArray(rawFriendsData) ? 
        rawFriendsData.map((friend: any) => ({
          id: friend.friendshipId || friend.id, // This is the friendship record ID
          friendId: friend.id, // This is the actual friend's user ID (from API response)
          friendData: friend.friendData || {
            id: friend.id, // Use friend.id as the friend's user ID
            fullName: friend.friendName || friend.fullName,
            email: friend.email,
            avatar: friend.avatar
          },
          status: friend.status,
          balance: 0, // Balance will be calculated separately
          createdAt: friend.createdAt ? new Date(friend.createdAt._seconds * 1000) : new Date()
        })) : [];
      
      console.log('🔄 Transformed friends:', transformedFriends);
      
      // Separate accepted vs pending friends
      const accepted = transformedFriends.filter(f => f.status === 'accepted');
      const pending = transformedFriends.filter(f => f.status === 'pending');
      
      // FIXED: Include outgoing friend requests as "pending" friends for UI
      const outgoingRequests = requestsData?.outgoing || [];
      console.log('🔍 Outgoing requests details:', outgoingRequests);
      
      const pendingFromRequests = outgoingRequests.map((request: any) => {
        
        // Firebase Functions returns toUserId and toUser data
        const friendId = request.toUserId || request.recipientId || request.receiverId || request.id;
        const email = request.toUser?.email || request.recipientEmail || request.receiverData?.email || request.toUserData?.email || request.receiverEmail || request.toEmail || request.email || '';
        
        // FIXED: Check multiple possible name fields for backward compatibility
        let displayName = 'Unknown Friend';
        
        // Primary: Firebase Functions toUser.fullName field
        if (request.toUser?.fullName) {
          displayName = request.toUser.fullName;
        }
        // Secondary: API's recipientName field (new system)
        else if (request.recipientName) {
          displayName = request.recipientName;
        }
        // Tertiary: Check legacy receiver data fields
        else if (request.receiverData?.fullName || request.toUserData?.fullName) {
          displayName = request.receiverData?.fullName || request.toUserData?.fullName;
        }
        // Quaternary: Fallback to email
        else if (email) {
          displayName = email;
        }
        // Last resort: mobile number
        else if (request.toMobile || request.mobile || request.phoneNumber) {
          displayName = request.toMobile || request.mobile || request.phoneNumber;
        }
        
        // Determine if this is a new user invite based on available data
        const isNewUserInvite = !request.recipientName && !request.receiverData && !request.toUserData;
        
        console.log('🔍 Processing request:', { 
          friendId, 
          displayName, 
          email, 
          isNewUserInvite,
          request_keys: Object.keys(request),
          recipientName: request.recipientName,
          recipientId: request.recipientId
        });
        
        return {
          id: request.id || `request-${Date.now()}-${Math.random()}`,
          friendId: friendId,
          friendData: {
            id: friendId,
            fullName: displayName,
            email: email,
            avatar: request.recipientAvatar || '' // API might not store avatar for requests
          },
          status: 'pending' as const,
          balance: 0,
          createdAt: request.createdAt ? new Date(request.createdAt) : new Date(),
          requestType: 'sent', // Mark as sent request for UI
          isNewUserInvite: isNewUserInvite // Track if this is invitation to new user
        };
      });
      
      const allPending = [...pending, ...pendingFromRequests];
      const allFriends = [...transformedFriends, ...pendingFromRequests];
      
      console.log('✅ Processed friends:', { 
        accepted: accepted.length, 
        pending: pending.length,
        outgoingRequests: outgoingRequests.length,
        totalPending: allPending.length
      });
      
      setFriends(allFriends);
      setAcceptedFriends(accepted);
      setPendingFriends(allPending);
      setFriendRequests(requestsData || {incoming: [], outgoing: []});
      
      return allFriends;
      
    } catch (error) {
      console.error('Load friends error:', error);
      setFriends([]);
      setAcceptedFriends([]);
      setPendingFriends([]);
      setFriendRequests({incoming: [], outgoing: []});
      return [];
    }
  };

  // FIXED: Unified refresh function
  // OPTIMIZED: Memoize refresh function and reduce parallel calls
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Load data sequentially to avoid overwhelming the server
      const loadedFriends = await loadFriendsAndRequests();
      const loadedGroups = await loadGroups();
      
      // Then refresh balances and other data in parallel
      await Promise.all([
        sharedBalances.forceRefresh(),
        sharedBalances.forceRefresh(),
        loadRecentExpenses(loadedFriends, loadedGroups),
        loadNotifications()
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [sharedBalances, sharedBalances]);

  const markAllNotificationsRead = async () => {
    try {
      if (!user?.id) return;
      
      await apiService.markAllNotificationsAsRead(user.id);
      await loadNotifications(); // Reload notifications instead of clearing
      
      showAnimatedSuccess('All Read! ✅', 'All notifications marked as read');
    } catch (error) {
      console.error('Mark notifications read error:', error);
      showGenericError(
        'Failed to Mark as Read',
        'Unable to mark notifications as read. Please check your connection and try again.',
        'Retry',
        'Cancel',
        () => markAllNotificationsRead()
      );
    }
  };

  // Handle notifications press - FIXED: Don't auto-mark as read
  const handleNotificationsPress = async () => {
    setShowNotifications(true);
    // REMOVED: Auto-marking notifications as read - let users decide when to mark them as read
  };

  // Handle resend invitation - REMOVED DUPLICATE (keeping the better implementation below)

  // Handle remind friend about balance
  const handleRemindFriend = (friend: Friend, balance: number) => {
    setSelectedFriendForRemind(friend);
    setRemindBalance(balance);
    setShowRemindModal(true);
  };

  // Handle sending reminder through different methods
  const handleSendReminder = async (method: 'sms' | 'whatsapp' | 'app', message: string) => {
    try {
      if (!selectedFriendForRemind || !user?.id) return;

      // Create a notification for the reminder action
      await apiService.createNotification({
        userId: selectedFriendForRemind.friendId,
        type: 'payment_request',
        title: 'Payment Reminder',
        message: message,
        data: { 
          fromUserId: user.id,
          amount: Math.abs(remindBalance),
          currency: user.currency || 'USD',
          method: method
        },
        isRead: false,
        createdAt: new Date()
      });

      console.log(`Reminder sent via ${method} to ${selectedFriendForRemind.friendData.fullName}`);
      
    } catch (error) {
      console.error('Error sending reminder:', error);
      throw error;
    }
  };

  // Helper function to show full-screen success animation
  const showFullScreenSuccessAnimation = (
    title: string, 
    message: string, 
    subtitle?: string,
    buttonText?: string,
    onContinue?: () => void
  ) => {
    setFullScreenSuccessProps({ 
      title, 
      message, 
      subtitle,
      buttonText,
      onContinue: onContinue || (() => setShowFullScreenSuccess(false))
    });
    setShowFullScreenSuccess(true);
  };

  // Helper function to show full-screen error
  const showFullScreenErrorAnimation = (
    title: string,
    message: string,
    subtitle?: string,
    errorCode?: string,
    onRestart?: () => void
  ) => {
    const handleRestart = onRestart || (() => {
      // Default restart behavior - you might want to implement app restart logic
      console.log('App restart requested');
      setShowFullScreenError(false);
    });

    setFullScreenErrorProps({
      title,
      message,
      subtitle,
      errorCode,
      onRestart: handleRestart
    });
    setShowFullScreenError(true);
  };

  // Legacy helper function for backward compatibility - now uses full-screen animation
  const showAnimatedSuccess = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    if (type === 'error') {
      showFullScreenErrorAnimation(title, message);
    } else {
      // For 'info', 'warning', and 'success', use the success animation
      showFullScreenSuccessAnimation(title, message);
    }
  };

  // Helper function to show error modal - now uses full-screen error for critical errors
  const showGenericError = (
    title: string, 
    message: string, 
    primaryButtonText?: string,
    secondaryButtonText?: string,
    onPrimaryPress?: () => void,
    onSecondaryPress?: () => void
  ) => {
    // For critical errors, use full-screen error
    if (title.toLowerCase().includes('critical') || title.toLowerCase().includes('restart') || title.toLowerCase().includes('crash')) {
      showFullScreenErrorAnimation(title, message, 'Please restart the app to continue.', 'CRITICAL_ERROR_001');
    } else {
      // For non-critical errors, use the original error modal
      setErrorModalProps({ 
        title, 
        message, 
        primaryButtonText, 
        secondaryButtonText, 
        onPrimaryPress, 
        onSecondaryPress 
      });
      setShowErrorModal(true);
    }
  };

  // Handle export group data
  const handleExportGroup = (group: Group) => {
    setSelectedGroupForExport(group);
    setShowExportModal(true);
  };

  // Handle export completion
  const handleExportComplete = async (format: 'csv' | 'pdf') => {
    try {
      if (!selectedGroupForExport) return;
      
      await ExportService.exportGroupData(selectedGroupForExport, format);
      showAnimatedSuccess('Export Complete! 📄', `Group data exported as ${format.toUpperCase()} file`);
      
    } catch (error: any) {
      console.error('Export error:', error);
      showAnimatedSuccess('Export Failed', error.message || 'Failed to export group data', 'error');
    }
  };

  // NEW: Unified settlement navigation
  const openSettlementScreen = (config: {
    filter: 'all' | 'friends' | 'groups' | 'friend';
    groupId?: string;
    friendId?: string;
  }) => {
    console.log('🔄 Opening settlement screen with config:', config);
    
    // Force a balance refresh before opening settlement
    notifyBalanceChange();
    
    setSettlementConfig(config);
    setShowUnifiedSettlement(true);
  };

  // SUBSCRIPTION-AWARE: Add expense with transaction limit checking
  const handleAddExpense = async (expenseData: any, fromGroupDetails?: Group | null) => {
    try {
      if (!user?.id) return;
      
      // Check transaction limit before proceeding
      const canCreateTransaction = await subscriptionHelper.checkTransactionLimit(user.id);
      if (!canCreateTransaction) {
        // Store the expense data to be processed after the modal allows continuation
        const subscription = await subscriptionHelper.getUserSubscriptionStatus(user.id);
        if (!subscription.isPremium) {
          // Modal will show with 10-second countdown and then allow user to continue
          // We need to set up a way for the modal to trigger the expense creation
          (window as any).pendingExpenseData = { expenseData, fromGroupDetails };
          return;
        } else {
          return; // Premium users shouldn't hit this, but just in case
        }
      }
      
      await proceedWithExpenseCreation();
      
      async function proceedWithExpenseCreation() {
        const response = await apiService.addExpense({
          ...expenseData,
          isSettled: false,
          date: new Date()
        });
        
        const expenseId = response.id;
        
        console.log('Expense added successfully:', expenseId);
        
        // Notify all listeners about the new expense
        ExpenseRefreshService.getInstance().notifyExpenseAdded();
        
        // Force refresh local data and notify balance system
        await Promise.all([
          loadGroups(),
          loadRecentExpenses()
        ]);
        
        // FIXED: Notify unified balance system
        notifyBalanceChange();
        
        setShowAddExpense(false);
        setSelectedGroupForExpense(null);
        
        // Show full-screen success with navigation to group details
        showFullScreenSuccessAnimation(
          'Expense Added! 🧾', 
          'Expense has been added and split successfully!',
          fromGroupDetails ? `Added to ${fromGroupDetails.name}` : 'Check your groups for updates',
          fromGroupDetails ? 'View Group Details' : 'Continue',
          () => {
            setShowFullScreenSuccess(false);
            if (fromGroupDetails) {
              setSelectedGroup(fromGroupDetails);
              setShowGroupDetails(true);
            }
          }
        );
      }
      
    } catch (error: any) {
      console.error('Add expense error:', error);
      showGenericError(
        'Failed to Add Expense',
        error.message || 'Unable to add expense. Please check your data and try again.',
        'Try Again',
        'Cancel'
      );
    }
  };

  // SUBSCRIPTION-AWARE: Add friend with QR code limit checking
  const handleAddFriend = async (email: string, method: 'email' | 'sms' | 'whatsapp' | 'qr', contactData?: ContactData | ContactData[]) => {
    try {
      if (!user?.id) return;
      
      // Check QR code access for premium features
      if (method === 'qr') {
        const hasQRAccess = await subscriptionHelper.checkQRCodeAccess(user.id);
        if (!hasQRAccess) {
          return; // Modal will be shown by the helper
        }
      }
      
      if (method === 'email') {
        const existingCheck = await apiService.checkExistingFriendship(user.id, email);
        
        if (existingCheck.isFriend) {
          const { friendData, status } = existingCheck;
          let alertMessage = '';
          switch (status) {
            case 'accepted':
              alertMessage = `${friendData.fullName} is already in your friends list!`;
              break;
            case 'request_sent':
              alertMessage = `You have already sent a friend request to ${friendData.fullName}. Please wait for them to respond.`;
              break;
            case 'request_received':
              alertMessage = `${friendData.fullName} has already sent you a friend request. Check your notifications to accept it.`;
              break;
            default:
              alertMessage = `You already have a connection with ${friendData.fullName}.`;
          }
          
          showAnimatedSuccess('Already Connected', alertMessage, 'warning');
          setShowAddFriend(false);
          return;
        }
        
        const result = await apiService.sendFriendRequest(user.id, email);
        
        console.log('🤝 Friend request result:', result);
        
        // Handle different response formats from the API
        const success = result?.success !== false; // Default to true unless explicitly false
        const isNewUser = result?.isNewUser || false;
        const message = result?.message || '';
        
        if (success) {
          if (isNewUser) {
            showAnimatedSuccess('Invitation Sent! 📧', message || 'User will receive an email invitation to join Spendy');
          } else {
            showAnimatedSuccess('Friend Request Sent! 🤝', message || 'Friend request sent successfully! They will be notified.');
          }
          
          // Refresh friends list to show new pending request
          setTimeout(async () => {
            await loadFriendsAndRequests();
            notifyBalanceChange();
          }, 1500); // Increased delay to account for database consistency
        } else {
          showAnimatedSuccess('Request Failed', message || 'Failed to send friend request', 'error');
        }
        
        setShowAddFriend(false);
      } else if (method === 'sms' || method === 'whatsapp') {
        if (contactData) {
          const contacts = Array.isArray(contactData) ? contactData : [contactData];
          
          for (const contact of contacts) {
            await createPendingFriendInvitation(contact, method);
          }
          
          const contactNames = contacts.map(c => c.name || 'Friend').join(', ');
          showAnimatedSuccess(
            'Invitation Sent!', 
            `${method.toUpperCase()} invitation${contacts.length > 1 ? 's' : ''} sent to ${contactNames}. They'll appear in your friends list once they join Spendy.`
          );
          
          setShowAddFriend(false);
          
          // Refresh friends to show pending invitations
          setTimeout(async () => {
            await loadFriendsAndRequests();
            notifyBalanceChange();
          }, 500);
        }
      } else if (method === 'qr') {
        setQrScanSource('addFriend');
        setShowQRScanner(true);
        setShowAddFriend(false);
      }
      
      // FIXED: Notify balance system of potential friend addition
      notifyBalanceChange();
      
    } catch (error: any) {
      console.error('Add friend error:', error);
      showAnimatedSuccess('Error', error.message || 'Failed to add friend. Please try again.', 'error');
    }
  };

  // SUBSCRIPTION-AWARE: Create group with limit checking
  const handleCreateGroup = async (groupData: any) => {
    try {
      if (!user?.id) return;
      
      // Check group creation limit
      const canCreateGroup = await subscriptionHelper.checkGroupCreationLimit(user.id);
      if (!canCreateGroup) {
        return; // Modal will be shown by the helper
      }
      
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Map selectedFriends to initialMembers for the API, filtering out null/undefined values
      const initialMembers = groupData.selectedFriends?.map(friend => friend?.id).filter(Boolean) || [];

      const response = await apiService.createGroup({
        name: groupData.name,
        description: groupData.description || '',
        avatar: groupData.avatar,
        initialMembers,
        currency: groupData.currency || user.currency || 'AUD',
        settings: {
          allowMemberInvites: true,
          requireApproval: false,
          currency: user.currency || 'AUD'
        }
      }) as any; // Use any to handle different response formats
      
      console.log('🔍 Group creation response:', response);
      
      // Handle different possible response formats
      let groupId: string | undefined;
      if (response?.group?.id) {
        groupId = response.group.id;
      } else if (response?.id) {
        groupId = response.id;
      } else if (response?.data?.id) {
        groupId = response.data.id;
      } else if (response?.groupId) {
        groupId = response.groupId;
      } else if (response?.data?.groupId) {
        groupId = response.data.groupId;
      } else if (typeof response === 'string') {
        groupId = response;
      }
      
      console.log('🔍 Extracted groupId:', groupId);
      
      if (!groupId) {
        console.error('❌ Group creation failed - response structure:', JSON.stringify(response, null, 2));
        throw new Error('Group creation failed - no group ID returned. Please try again.');
      }
      
      console.log('✅ Group created with ID:', groupId);
      
      // Increment group creation count
      await subscriptionHelper.incrementGroupCreation(user.id);
      
      // Add selected friends to the group (with better error handling)
      let memberAdditionErrors = 0;
      if (groupData.selectedFriends && groupData.selectedFriends.length > 0) {
        console.log('🤝 Adding friends to group:', groupData.selectedFriends);
        for (const friendId of groupData.selectedFriends) {
          try {
            const friend = friends.find(f => f.id === friendId);
            if (friend) {
              // Use the friendId property which is the actual user ID
              const memberUserId = friend.friendId;
              console.log(`👥 Adding friend ${friendId} (userId: ${memberUserId}) to group ${groupId}`);
              if (memberUserId) {
                await apiService.addGroupMember(groupId, memberUserId, 'member');
                console.log(`✅ Successfully added friend ${friendId} to group`);
              } else {
                console.warn(`⚠️ Friend ${friendId} has no valid friendId`);
                memberAdditionErrors++;
              }
            } else {
              console.warn(`⚠️ Friend with ID ${friendId} not found in friends list`);
              memberAdditionErrors++;
            }
          } catch (error) {
            console.error(`Failed to add friend ${friendId} to group:`, error);
            memberAdditionErrors++;
            // Continue with other friends even if one fails
          }
        }
      }
      
      // Force immediate data refresh after group creation
      try {
        // Reload groups and refresh all balance data
        await Promise.all([
          loadGroups(),
          sharedBalances.forceRefresh(),
          sharedBalances.forceRefresh(),
          loadFriendsAndRequests()
        ]);
      } catch (refreshError) {
        console.error('Error refreshing data after group creation:', refreshError);
        // Continue even if refresh fails
      }
      
      setShowCreateGroup(false);
      
      const memberCount = 1 + (groupData.selectedFriends?.length || 0);
      const actualMembersAdded = (groupData.selectedFriends?.length || 0) - memberAdditionErrors;
      
      // Show full-screen success with navigation to group details
      const title = 'Group Created! 🎉';
      const message = `"${groupData.name}" has been created successfully!`;
      let subtitle = `${memberCount} member${memberCount > 1 ? 's' : ''} ready to split expenses`;
      
      // Add warning if some members couldn't be added
      if (memberAdditionErrors > 0) {
        subtitle = `Group created with ${actualMembersAdded + 1} member${actualMembersAdded > 0 ? 's' : ''}. ${memberAdditionErrors} member${memberAdditionErrors > 1 ? 's' : ''} will need to be invited manually.`;
      }
      
      showFullScreenSuccessAnimation(
        title, 
        message,
        subtitle,
        'View Group',
        () => {
          setShowFullScreenSuccess(false);
          // Find and show the newly created group
          setTimeout(async () => {
            await loadGroups(); // Refresh groups to get the new one
            // The group should now be in the groups list, but we'll need the ID
            // For now, just close and let user find it in the groups tab
            setActiveTab('groups');
          }, 100);
        }
      );
    } catch (error: any) {
      console.error('Create group error:', error);
      Alert.alert('Error', error.message || 'Failed to create group');
    }
  };

  // SUBSCRIPTION-AWARE: Analytics access
  const handleAnalyticsAccess = async () => {
    if (!user?.id) return;
    
    const hasAccess = await subscriptionHelper.checkAnalyticsAccess(user.id);
    if (hasAccess) {
      setShowAnalytics(true);
    }
  };

  // SUBSCRIPTION-AWARE: QR Scanner access
  const handleQRScannerAccess = async () => {
    if (!user?.id) return;
    
    const hasAccess = await subscriptionHelper.checkQRCodeAccess(user.id);
    if (hasAccess) {
      setQrScanSource('direct');
      setShowQRScanner(true);
    }
  };

  // SUBSCRIPTION-AWARE: Group Chat access
  const handleGroupChatAccess = async (group: Group) => {
    if (!user?.id) return;
    
    const hasAccess = await subscriptionHelper.checkGroupChatAccess(user.id);
    if (hasAccess) {
      setSelectedGroup(group);
      setShowGroupChat(true);
    }
  };

  // Helper functions (keep existing implementations but add balance notifications where needed)
  const createPendingFriendInvitation = async (contactData: ContactData, method: 'sms' | 'whatsapp') => {
    try {
      if (!user?.id) return;
      
      const fullName = contactData.name?.trim() || 'Friend';
      
      const pendingInvitation = {
        fromUserId: user.id,
        fromUserData: {
          fullName: user.fullName,
          email: user.email,
          avatar: user.profilePicture || '',
          mobile: user.mobile || ''
        },
        toUserData: {
          fullName: fullName,
          email: '',
          mobile: contactData.phoneNumber,
          avatar: ''
        },
        contactMethod: method,
        phoneNumber: contactData.phoneNumber,
        status: 'invited' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await addDoc(collection(db, 'pendingInvitations'), pendingInvitation);
      console.log('Pending invitation created for:', contactData.name);
    } catch (error) {
      console.error('Create pending invitation error:', error);
    }
  };

  // FIXED: Expense update with balance notification
  const handleExpenseUpdate = async (expenseData: any) => {
    try {
      if (!user?.id) return;
      
      console.log('🔄 Updating expense with data:', expenseData);
      
      await apiService.updateExpense(expenseData.id, expenseData);
      console.log('✅ Expense updated successfully in database');
      
      ExpenseRefreshService.getInstance().notifyExpenseAdded();
      
      await Promise.all([
        loadGroups(),
        loadRecentExpenses()
      ]);
      
      // FIXED: Notify balance system
      notifyBalanceChange();
      
      console.log('✅ Local data refreshed after expense update');
      
    } catch (error: any) {
      console.error('❌ Update expense error:', error);
      throw error;
    }
  };

  // Handle various friend and group actions (keep existing implementations but add balance notifications)
  const handleEditExpenseFromDetails = (expense: Expense) => {
    setSelectedExpenseForAction(expense);
    setShowEditExpense(true);
  };

  // New function for pending friend actions
  const showPendingFriendActionsMenu = (friend: Friend) => {
    // Check if this is a received friend request (user can accept/decline)
    if (friend.requestType === 'received' && friend.status === 'pending_incoming') {
      const actions: Array<{
        text: string;
        style?: 'cancel' | 'destructive' | 'default';
        onPress?: () => void;
      }> = [
        {
          text: 'Accept Friend Request',
          onPress: () => friend.requestId && handleAcceptFriendRequest(friend.requestId)
        },
        {
          text: 'Decline Request',
          style: 'destructive',
          onPress: () => friend.requestId && handleDeclineFriendRequest(friend.requestId)
        },
        { text: 'Cancel', style: 'cancel' }
      ];

      Alert.alert(
        `Friend Request from ${friend.friendData.fullName}`,
        'Would you like to accept or decline this friend request?',
        actions
      );
    } else {
      // This is a sent invitation (user can resend/cancel)
      const actions: Array<{
        text: string;
        style?: 'cancel' | 'destructive' | 'default';
        onPress?: () => void;
      }> = [
        {
          text: 'Resend Invitation',
          onPress: () => handleResendInvitation(friend)
        },
        {
          text: 'Cancel Invitation',
          style: 'destructive',
          onPress: () => handleCancelInvitation(friend)
        },
        { text: 'Cancel', style: 'cancel' }
      ];

      Alert.alert(
        `${friend.friendData.fullName}`,
        'Invitation sent - waiting for response',
        actions
      );
    }
  };

  // Function to handle resending invitations
  const handleResendInvitation = async (friend: Friend) => {
    try {
      if (!user?.id) return;
      
      console.log('🔄 Resending invitation:', {
        friendId: friend.id,
        friendName: friend.friendData.fullName,
        inviteMethod: friend.inviteMethod,
        requestId: friend.requestId,
        isNewUser: friend.isNewUser
      });
      
      if (friend.isNewUser || friend.type === 'email_invite') {
        // For new users (not on Spendy yet) - just show a reminder message
        Alert.alert(
          'Invite Pending',
          `${friend.friendData.fullName || friend.friendData.email} hasn't joined Spendy yet. They'll appear as your friend once they sign up and accept your invitation.`,
          [{ text: 'OK' }]
        );
      } else {
        // For existing users - resend the friend request notification
        Alert.alert(
          'Resend Friend Request',
          `Resend friend request notification to ${friend.friendData.fullName}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Resend',
              onPress: async () => {
                try {
                  // Here you could call an API to resend notification
                  showAnimatedSuccess(
                    'Notification Sent!',
                    `Reminded ${friend.friendData.fullName} about your friend request.`
                  );
                } catch (error) {
                  Alert.alert('Error', 'Failed to send reminder.');
                }
              }
            }
          ]
        );
      }
      
      // Refresh friends data
      notifyBalanceChange();
      
    } catch (error: any) {
      console.error('Failed to resend invitation:', error);
      Alert.alert('Error', error.message || 'Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (friend: Friend) => {
    try {
      Alert.alert(
        'Cancel Friend Request',
        `Cancel your friend request to ${friend.friendData.fullName}?`,
        [
          { text: 'Keep Request', style: 'cancel' },
          {
            text: 'Cancel Request',
            style: 'destructive',
            onPress: async () => {
              try {
                if (friend.requestId) {
                  // For existing Spendy users, delete the friend request
                  await apiService.declineFriendRequest(friend.requestId);
                  showAnimatedSuccess(
                    'Request Cancelled',
                    `Friend request to ${friend.friendData.fullName} has been cancelled.`
                  );
                } else {
                  // For new user invites, just remove from local state
                  showAnimatedSuccess(
                    'Invitation Cancelled',
                    `Invitation to ${friend.friendData.fullName} has been cancelled.`
                  );
                }
                await loadFriendsAndRequests();
                notifyBalanceChange();
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to cancel request');
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Failed to cancel invitation:', error);
      Alert.alert('Error', error.message || 'Failed to cancel invitation');
    }
  };

  const handleGroupJoined = async (groupId: string, groupName: string) => {
    try {
      await loadGroups();
      notifyBalanceChange(); // FIXED: Notify balance system
      
      Alert.alert(
        'Welcome to the Group! 🎉',
        `You've joined "${groupName}"!\n\nWould you like to connect with other group members?`,
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Connect with Members',
            onPress: async () => {
              try {
                const result = await apiService.autoConnectGroupMembers(groupId, user!.id);
                
                let message = '';
                if (result.requestsSent > 0) {
                  message += `✅ Sent ${result.requestsSent} friend request(s)\n`;
                }
                if (result.alreadyConnected > 0) {
                  message += `👥 Already connected with ${result.alreadyConnected} member(s)\n`;
                }
                if (result.failed > 0) {
                  message += `⚠️ ${result.failed} request(s) failed\n`;
                }
                
                Alert.alert('Connection Requests Sent! 📤', message);
                notifyBalanceChange(); // FIXED: Notify balance system
                
              } catch (error) {
                Alert.alert('Error', 'Failed to connect with group members.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Handle group joined error:', error);
    }
  };

  // FIXED: Updated Overview tab with unified balance components
  const renderOverviewTab = () => {
    // Add this debug logging
    console.log('🎯 Overview tab rendering with unified balances:', {
      totalOwed: sharedBalances.totalOwed,
      totalOwing: sharedBalances.totalOwing,
      netBalance: sharedBalances.netBalance,
      isLoading: sharedBalances.isLoading,
      allBalances: sharedBalances.allBalances,
      isEmpty: sharedBalances.isEmpty,
      friendsCount: friends.length,
      expensesCount: expenses.length
    });

    return (
      <ScrollView 
        contentContainerStyle={styles.tabContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* FIXED: Use unified balance data */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Your Balance</Text>
          </View>

          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                {getCurrencySymbol(user?.currency || 'USD')}{String(sharedBalances.totalOwed.toFixed(2))}
              </Text>
              <Text style={styles.balanceLabel}>You're owed</Text>
            </View>
            
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                {getCurrencySymbol(user?.currency || 'USD')}{String(sharedBalances.totalOwing.toFixed(2))}
              </Text>
              <Text style={styles.balanceLabel}>You owe</Text>
            </View>
            
            <View style={styles.balanceItem}>
              <Text 
                style={[
                  styles.balanceAmount, 
                  { color: sharedBalances.netBalance >= 0 ? '#FFD700' : '#FFA500' }
                ]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                {sharedBalances.netBalance >= 0 ? '+' : ''}{getCurrencySymbol(user?.currency || 'USD')}{Math.abs(sharedBalances.netBalance).toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>Net balance</Text>
            </View>
          </View>
          
          <TouchableOpacity onPress={() => openSettlementScreen({ filter: 'all' })}>
            <Text style={styles.balanceSubtext}>Tap to view details</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions (updated with subscription checks) */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowAddExpense(true)}
          >
            <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Add Expense</Text>
            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
              Split bills with friends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowCreateGroup(true)}
          >
            <Ionicons name="people" size={24} color="#4F46E5" />
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Create Group</Text>
            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
              Start a new expense group
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowAddFriend(true)}
          >
            <Ionicons name="person-add" size={24} color="#10B981" />
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Add Friend</Text>
            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
              Invite friends to split expenses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => openSettlementScreen({ filter: 'all' })}
          >
            <Ionicons name="cash" size={24} color="#F59E0B" />
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Settlements</Text>
            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
              Manage outstanding balances
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
            onPress={handleAnalyticsAccess}
          >
            <Ionicons name="analytics" size={24} color="#10B981" />
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Analytics</Text>
            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
              View spending insights
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Expenses - keep existing */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity onPress={navigateToExpenses} style={styles.viewAllButton}>
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
         
          {(() => {
            console.log('🔍 Overview expenses rendering: length =', expenses.length);
            return expenses.length === 0;
          })() ? (
            <TouchableOpacity 
              style={styles.emptyStateContainer}
              onPress={() => setShowAddExpense(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="receipt-outline" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                No expenses yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
                Tap to add your first expense
              </Text>
            </TouchableOpacity>
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={styles.expenseCardsList}
            >
              {expenses.slice(0, 5).map((expense) => (
                <TouchableOpacity
                  key={expense.id}
                  style={[styles.expenseCardRow, { backgroundColor: theme.colors.background }]}
                  onPress={() => handleEditExpenseFromDetails(expense)}
                  activeOpacity={0.7}
                >
                  {/* Left: Category Icon */}
                  <View style={[styles.categoryIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Text style={styles.categoryIconText}>
                      {getCategoryIcon(expense.category)}
                    </Text>
                  </View>

                  {/* Center: Expense Details */}
                  <View style={styles.expenseCardDetails}>
                    <Text style={[styles.expenseCardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {expense.description || expense.title || 'No description'}
                    </Text>
                    <View style={styles.expenseCardMeta}>
                      <Text style={[styles.expenseCardPaidBy, { color: theme.colors.textSecondary }]}>
                        Paid by {expense.paidByData?.fullName || (expense.paidBy === user?.id ? 'You' : 'Unknown')}
                      </Text>
                      <Text style={[styles.metaSeparator, { color: theme.colors.textSecondary }]}>•</Text>
                      <Text style={[styles.expenseCardDate, { color: theme.colors.textSecondary }]}>
                        {(() => {
                          try {
                            const expenseDate = expense.date || expense.createdAt;
                            if (!expenseDate) return 'No date';
                            const date = new Date(expenseDate);
                            if (isNaN(date.getTime())) return 'Invalid date';
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          } catch (error) {
                            return 'Invalid date';
                          }
                        })()}
                      </Text>
                      {(() => {
                        const hasUpdated = expense.updatedAt && expense.createdAt;
                        const createdAt = expense.createdAt ? new Date(expense.createdAt) : null;
                        const updatedAt = expense.updatedAt ? new Date(expense.updatedAt) : null;
                        const timeDiff = hasUpdated && createdAt && updatedAt ? Math.abs(updatedAt.getTime() - createdAt.getTime()) : 0;
                        const isEdited = hasUpdated && timeDiff > 1000;
                        
                        return isEdited ? (
                          <>
                            <Text style={[styles.metaSeparator, { color: theme.colors.textSecondary }]}>•</Text>
                            <Text style={[styles.editedTextInline, { color: theme.colors.primary }]}>Edited</Text>
                          </>
                        ) : null;
                      })()}
                    </View>
                  </View>

                  {/* Right: Amount */}
                  <View style={styles.expenseCardAmount}>
                    <Text style={[styles.expenseCardAmountText, { color: theme.colors.text }]}>
                      {getCurrencySymbol(user?.currency || 'USD')}{expense.amount.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Friends Overview with FIXED balance display */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Friends</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity onPress={() => sharedBalances.refresh()} style={styles.refreshButton}>
                <Ionicons name="refresh" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddFriend(true)} style={styles.addButton}>
                <Ionicons name="person-add" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('friends')} style={styles.viewAllButton}>
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          {sharedBalances.allBalances.length === 0 && friends.filter(f => f.status === 'accepted').length === 0 ? (
            <TouchableOpacity 
              style={styles.emptyStateContainer}
              onPress={() => setShowAddFriend(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                No friends yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
                Tap to add your first friend
              </Text>
            </TouchableOpacity>
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={styles.friendCardsList}
            >
              {/* FIXED: Always show all friends, combining those with balances and those without */}
              {(() => {
                const acceptedFriends = friends.filter(f => f.status === 'accepted');
                const balanceEntries = sharedBalances.allBalances || [];
                
                // Create a map of all friends with their balance info
                const friendsWithBalances = acceptedFriends.map(friend => {
                  const existingBalance = balanceEntries.find(entry => entry.userId === friend.friendId);
                  return {
                    userId: friend.friendId,
                    name: friend.friendData?.fullName || 'Unknown',
                    email: friend.friendData?.email || '',
                    balance: existingBalance ? existingBalance.balance : 0,
                    source: 'friend' as const,
                    friend: friend // Keep reference for actions
                  };
                });

                console.log('🔍 Friends overview: Total accepted friends:', acceptedFriends.length);
                console.log('🔍 Friends overview: Balance entries:', balanceEntries.length);
                console.log('🔍 Friends overview: Combined friends with balances:', friendsWithBalances.length);
                
                return friendsWithBalances;
              })().slice(0, 5).map((detail, index) => (
                <TouchableOpacity
                  key={`balance-${detail.userId}-${index}`}
                  style={[styles.friendCardRow, { backgroundColor: theme.colors.background }]}
                  onPress={() => {
                    if (detail.friend) {
                      showFriendActionsMenu(detail.friend);
                    } else {
                      // For group members, switch to friends tab to see more details
                      setActiveTab('friends');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {/* Left: Friend Avatar */}
                  <View style={[styles.friendIconContainer, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.friendIconText}>
                      {(detail.name || 'Unknown').charAt(0).toUpperCase()}
                    </Text>
                    {detail.source === 'group' && (
                      <View style={[styles.groupIndicator, { backgroundColor: theme.colors.primary + '20' }]}>
                        <Ionicons name="people" size={10} color={theme.colors.primary} />
                      </View>
                    )}
                  </View>

                  {/* Center: Friend Details */}
                  <View style={styles.friendCardRowDetails}>
                    <Text style={[styles.friendCardRowName, { color: theme.colors.text }]} numberOfLines={1}>
                      {detail.name || 'Unknown'}
                    </Text>
                    <View style={styles.friendCardRowMeta}>
                      <Text style={[styles.friendCardRowSource, { color: theme.colors.textSecondary }]}>
                        {detail.source === 'group' ? `Group: ${detail.groupName || 'Unknown'}` : 'Friend'}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Balance */}
                  <View style={styles.friendCardRowBalance}>
                    {Math.abs(detail.balance) < 0.01 ? (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.friendCardRowBalanceText, { color: theme.colors.textSecondary }]}>
                          Settled
                        </Text>
                      </>
                    ) : detail.balance > 0 ? (
                      <>
                        <Text style={[styles.friendCardRowBalanceText, { color: theme.colors.success }]}>
                          +{getCurrencySymbol(user?.currency || 'USD')}{String(detail.balance.toFixed(2))}
                        </Text>
                        <Ionicons name="arrow-up-circle" size={16} color={theme.colors.success} />
                      </>
                    ) : (
                      <>
                        <Text style={[styles.friendCardRowBalanceText, { color: theme.colors.error }]}>
                          {getCurrencySymbol(user?.currency || 'USD')}{Math.abs(detail.balance).toFixed(2)}
                        </Text>
                        <Ionicons name="arrow-down-circle" size={16} color={theme.colors.error} />
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

      </ScrollView>
    );
  };

  const renderFriendsTab = () => {
    // Debug logging for friends tab
    console.log('👥 Friends tab rendering with data:', {
      friendsLength: friends.length,
      settlementBalancesLength: settlementBalances.length,
      settlementBalances: settlementBalances,
      friendBalances: sharedBalances.friendBalances,
      groupMemberBalances: sharedBalances.groupMemberBalances,
      allBalances: sharedBalances.allBalances,
      isLoading: sharedBalances.isLoading
    });

    const acceptedFriends = friends.filter(f => f.status === 'accepted');
    
    // Combine outgoing invites (from friends) and incoming requests (from friendRequests.incoming)
    const outgoingInvites = friends.filter(f => f.status === 'invited' || f.status === 'pending');
    const incomingRequests = (friendRequests.incoming || []).map((request: any) => ({
      id: request.id,
      friendId: request.fromUserId,
      friendData: request.fromUser,
      status: 'pending_incoming',
      requestType: 'received',
      requestId: request.id,
      message: request.message,
      createdAt: request.createdAt
    }));
    
    const invitedFriends = [...outgoingInvites, ...incomingRequests];

    console.log('👥 Friend counts:', {
      acceptedFriends: acceptedFriends.length,
      invitedFriends: invitedFriends.length,
      settlementBalances: settlementBalances.length
    });

    return (
      <ScrollView 
        contentContainerStyle={styles.tabContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Simplified header with clean action buttons */}
        <View style={styles.cleanTabHeader}>
          <View style={styles.headerTitleSection}>
            <Text style={[styles.cleanTabTitle, { color: theme.colors.text }]}>Friends</Text>
            <Text style={[styles.cleanTabSubtitle, { color: theme.colors.textSecondary }]}>
              {String(settlementBalances.length)} active • {String(invitedFriends.length)} pending
            </Text>
          </View>
          <View style={styles.cleanHeaderActions}>
            <TouchableOpacity 
              onPress={() => sharedBalances.refresh()} 
              style={[styles.cleanActionButton, { backgroundColor: theme.colors.surface }]}
            >
              <Ionicons name="refresh" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cleanActionButton, { backgroundColor: '#FF6B6B' }]}
              onPress={debugFriendRequests}
            >
              <Ionicons name="bug" size={18} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cleanActionButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowAddFriend(true)}
            >
              <Ionicons name="person-add" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Subtle tab switcher */}
        <View style={[styles.modernTabContainer, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            style={[
              styles.modernTab,
              activeFriendsTab === 'accepted' && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setActiveFriendsTab('accepted')}
          >
            <Text style={[
              styles.modernTabText,
              { color: activeFriendsTab === 'accepted' ? 'white' : theme.colors.textSecondary }
            ]}>
              Active
            </Text>
            <View style={[
              styles.modernTabBadge,
              { backgroundColor: activeFriendsTab === 'accepted' ? 'rgba(255,255,255,0.2)' : theme.colors.primary }
            ]}>
              <Text style={[
                styles.modernTabBadgeText,
                { color: activeFriendsTab === 'accepted' ? 'white' : 'white' }
              ]}>
                {String(settlementBalances.length)}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modernTab,
              activeFriendsTab === 'invited' && { backgroundColor: theme.colors.primary }
            ]}
            onPress={() => setActiveFriendsTab('invited')}
          >
            <Text style={[
              styles.modernTabText,
              { color: activeFriendsTab === 'invited' ? 'white' : theme.colors.textSecondary }
            ]}>
              Pending
            </Text>
            <View style={[
              styles.modernTabBadge,
              { backgroundColor: activeFriendsTab === 'invited' ? 'rgba(255,255,255,0.2)' : theme.colors.warning }
            ]}>
              <Text style={[
                styles.modernTabBadgeText,
                { color: 'white' }
              ]}>
                {String(invitedFriends.length)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {activeFriendsTab === 'accepted' ? (
          // Clean Accepted Friends Design
          acceptedFriends.length === 0 ? (
            <View style={[styles.cleanEmptyState, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.cleanEmptyIcon, { backgroundColor: `${theme.colors.primary}10` }]}>
                <Ionicons name="people-outline" size={32} color={theme.colors.primary} />
              </View>
              <Text style={[styles.cleanEmptyTitle, { color: theme.colors.text }]}>No friends yet</Text>
              <Text style={[styles.cleanEmptySubtitle, { color: theme.colors.textSecondary }]}>
                Add friends to start splitting expenses together
              </Text>
            </View>
          ) : (
            <View style={styles.cleanFriendsList}>
              {/* Show accepted friends regardless of balance status */}
              {acceptedFriends.map((friend, index) => {
                // Get balance from sharedBalances if available, otherwise default to 0
                const balanceEntry = sharedBalances.allBalances.find(b => b.userId === friend.friendId);
                const balance = balanceEntry?.balance || 0;
                const friendName = friend.friendData?.fullName || 'Unknown User';
                const friendEmail = friend.friendData?.email || '';
                const friendInitial = friendName.charAt(0).toUpperCase() || '?';
                
                // Create a unique key
                const entryKey = `friend-${friend.friendId}-${index}`;
                
                // Determine balance status for clean display
                const isSettled = Math.abs(balance) < 0.01;
                const owesYou = balance > 0;
                const youOwe = balance < 0;
                const amount = Math.abs(balance);
                
                return (
                  <TouchableOpacity
                    key={entryKey}
                    style={[styles.cleanFriendCard, { backgroundColor: theme.colors.surface }]}
                    onPress={() => {
                      // If this has a group-specific balance, open settlement screen with group filter
                      if (balanceEntry?.groupId) {
                        openSettlementScreen({ 
                          filter: 'groups', 
                          groupId: balanceEntry.groupId,
                          friendId: friend.friendId 
                        });
                      } else {
                        // For direct friend balances, use friend filter
                        openSettlementScreen({ 
                          filter: 'friends', 
                          friendId: friend.friendId 
                        });
                      }
                    }}
                  >
                    {/* Left section: Avatar + Info */}
                    <View style={styles.cleanFriendLeft}>
                      <View style={[styles.cleanAvatar, { 
                        backgroundColor: isSettled ? theme.colors.success : (owesYou ? theme.colors.success : theme.colors.error)
                      }]}>
                        <Text style={styles.cleanAvatarText}>{friendInitial}</Text>
                      </View>
                      <View style={styles.cleanFriendInfo}>
                        <Text style={[styles.cleanFriendName, { color: theme.colors.text }]} numberOfLines={1}>
                          {friendName}
                        </Text>
                        {balanceEntry?.groupName ? (
                          <View style={styles.cleanGroupIndicator}>
                            <Ionicons name="people" size={12} color={theme.colors.primary} />
                            <Text style={[styles.cleanGroupText, { color: theme.colors.primary }]} numberOfLines={1}>
                              {balanceEntry.groupName}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.cleanDirectText, { color: theme.colors.textSecondary }]}>
                            Direct friendship
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Right section: Balance + Actions */}
                    <View style={styles.cleanFriendRight}>
                      {isSettled ? (
                        <View style={styles.cleanSettledBadge}>
                          <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                          <Text style={[styles.cleanSettledText, { color: theme.colors.success }]}>
                            Settled
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View style={[styles.cleanBalanceBadge, { 
                            backgroundColor: owesYou ? `${theme.colors.success}15` : `${theme.colors.error}15`
                          }]}>
                            <Text style={[styles.cleanBalanceAmount, { 
                              color: owesYou ? theme.colors.success : theme.colors.error 
                            }]}>
                              {getCurrencySymbol(user?.currency || 'USD')}{String(amount.toFixed(2))}
                            </Text>
                            <Text style={[styles.cleanBalanceLabel, { 
                              color: owesYou ? theme.colors.success : theme.colors.error 
                            }]}>
                              {owesYou ? 'owes you' : 'you owe'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.cleanRemindButton, { backgroundColor: theme.colors.warning }]}
                            onPress={() => {
                              if (!user?.id) return;
                              // Use the actual friend object for the reminder function
                              showFriendActionsMenu(friend);
                            }}
                          >
                            <Ionicons name="notifications" size={12} color="white" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
              .filter(Boolean)} {/* Filter out any null entries */}
            </View>
          )
        ) : (
          // Clean Pending Invitations Design
          invitedFriends.length === 0 ? (
            <View style={[styles.cleanEmptyState, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.cleanEmptyIcon, { backgroundColor: `${theme.colors.warning}15` }]}>
                <Ionicons name="mail-outline" size={32} color={theme.colors.warning} />
              </View>
              <Text style={[styles.cleanEmptyTitle, { color: theme.colors.text }]}>No pending invitations</Text>
              <Text style={[styles.cleanEmptySubtitle, { color: theme.colors.textSecondary }]}>
                Friend invitations will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.cleanFriendsList}>
              {invitedFriends.map((friend, index) => {
                // Determine if this is a received friend request or sent invitation
                const isReceivedRequest = friend.requestType === 'received' && friend.status === 'pending_incoming';
                const isSentRequest = !isReceivedRequest && (friend.status === 'pending' || friend.status === 'invited');
                const friendName = friend.friendData?.fullName || friend.friendData?.email || 'Unknown Friend';
                const friendInitial = friendName && typeof friendName === 'string' ? friendName.charAt(0).toUpperCase() : '?';
                
                return (
                  <TouchableOpacity
                    key={`invited-${friend.id}-${index}`}
                    style={[styles.cleanFriendCard, { backgroundColor: theme.colors.surface }]}
                    onPress={() => showPendingFriendActionsMenu(friend)}
                  >
                    {/* Left section: Avatar + Info */}
                    <View style={styles.cleanFriendLeft}>
                      <View style={[styles.cleanAvatar, { 
                        backgroundColor: isReceivedRequest ? theme.colors.success : theme.colors.warning 
                      }]}>
                        <Text style={styles.cleanAvatarText}>{friendInitial}</Text>
                      </View>
                      <View style={styles.cleanFriendInfo}>
                        <Text style={[styles.cleanFriendName, { color: theme.colors.text }]} numberOfLines={1}>
                          {friendName}
                        </Text>
                        <Text style={[styles.cleanDirectText, { 
                          color: isReceivedRequest ? theme.colors.success : theme.colors.warning 
                        }]}>
                          {isReceivedRequest 
                            ? 'Wants to be your friend' 
                            : (friend.isNewUserInvite 
                                ? `Invite sent (waiting for signup)`
                                : `Request sent (waiting for response)`)}
                        </Text>
                      </View>
                    </View>

                    {/* Right section: Action Button */}
                    <View style={styles.cleanFriendRight}>
                      {isReceivedRequest ? (
                        <TouchableOpacity
                          style={[styles.cleanActionButton, { backgroundColor: theme.colors.success }]}
                          onPress={() => {
                            // Create friend request data and open existing modal
                            const friendRequestData = {
                              id: friend.requestId || '',
                              fromUserId: friend.friendId,
                              fromUserData: {
                                fullName: friend.friendData.fullName,
                                email: friend.friendData.email || '',
                                avatar: friend.friendData.avatar || ''
                              },
                              message: `${friend.friendData.fullName} wants to be your friend`,
                              status: 'pending' as const,
                              createdAt: new Date()
                            };
                            setSelectedFriendRequest(friendRequestData);
                            setShowFriendRequest(true);
                          }}
                        >
                          <Ionicons name="chatbubble" size={16} color="white" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.cleanActionButton, { backgroundColor: theme.colors.primary }]}
                          onPress={() => handleResendInvitation(friend)}
                        >
                          <Ionicons name="send" size={16} color="white" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        )}
      </ScrollView>
    );
  };
  
  // FIXED: Groups tab with balance integration and subscription checks
  const renderGroupsTab = () => (
    <ScrollView 
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: theme.colors.text }]}>Your Groups</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowCreateGroup(true)}
          >
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.headerButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {groups.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Groups Yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Create a group to start splitting expenses with friends
          </Text>
          <TouchableOpacity
            style={[styles.addFirstGroupButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowCreateGroup(true)}
          >
            <Text style={styles.addFirstGroupText}>Create Your First Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        groups.map((group) => {
          // Use the calculated group balances instead of empty sharedBalances
          const groupBalance = groupBalances.get(group.id) || 0;
          
          const userShare = Math.abs(groupBalance || 0);
          const shareStatus = groupBalance === 0 ? 'settled' : (groupBalance > 0 ? 'owed' : 'owes');
          
          // Debug logging for group card display
          console.log(`🏷️  Rendering group card: ${group.name}`);
          console.log(`💳 Group balance from overview balances: ${groupBalance}`);
          console.log(`📊 Display: ${shareStatus} ${userShare}`);
                  
          return (
            <TouchableOpacity
              key={group.id}
              style={[styles.groupCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                console.log('🔍 Group clicked:', group.name, group.id);
                setSelectedGroup(group);
                setShowGroupDetails(true);
                console.log('📱 Modal state set to visible');
              }}
            >
              <View style={styles.groupHeader}>
                <View style={styles.groupLeft}>
                  <Text style={styles.groupAvatar}>{group.avatar}</Text>
                  <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, { color: theme.colors.text }]}>
                      {group.name}
                    </Text>
                    <View style={styles.groupMetaRow}>
                      <Text style={[styles.groupMembers, { color: theme.colors.textSecondary }]}>
                        {String(group.members.length)} members
                      </Text>
                      <Text style={[styles.groupDivider, { color: theme.colors.textSecondary }]}>•</Text>
                      <Text style={[styles.groupActivity, { color: theme.colors.textSecondary }]}>
                        {formatTimestamp((group as any).updatedAt || group.createdAt, 'Recently')}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.groupHeaderActions}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleExportGroup(group);
                    }}
                    style={styles.groupActionButton}
                  >
                    <Ionicons name="download" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async (e) => {
                      e.stopPropagation();
                      // Check QR code access before showing
                      const hasAccess = await subscriptionHelper.checkQRCodeAccess(user?.id || '');
                      if (hasAccess) {
                        setSelectedGroup(group);
                        setShowQRCode(true);
                      }
                    }}
                    style={styles.groupActionButton}
                  >
                    <Ionicons name="qr-code" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.groupStats}>
                <View style={styles.groupStat}>
                  <Text style={[styles.groupStatLabel, { color: theme.colors.textSecondary }]}>
                    Total spent
                  </Text>
                  <Text style={[styles.groupStatValue, { color: theme.colors.text }]}>
                    {getCurrencySymbol(group.currency)}{String(((group as any).totalExpenses || 0).toFixed(2))}
                  </Text>
                </View>
                <View style={styles.groupStat}>
                  <Text style={[styles.groupStatLabel, { color: theme.colors.textSecondary }]}>
                    {shareStatus === 'settled' ? 'Settled up' : 
                     shareStatus === 'owed' ? 'You\'re owed' : 'You owe'}
                  </Text>
                  <Text style={[
                    styles.groupStatValue, 
                    { 
                      color: shareStatus === 'settled' ? theme.colors.textSecondary :
                             shareStatus === 'owed' ? theme.colors.success : 
                             theme.colors.error 
                    }
                  ]}>
                    {shareStatus === 'settled' ? '✓' : `${getCurrencySymbol(group.currency)}${(userShare || 0).toFixed(2)}`}
                  </Text>
                </View>
              </View>

              <View style={styles.groupActions}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedGroup(group);
                    setShowGroupDetails(true);
                  }}
                  style={[styles.actionButton, styles.viewDetailsButton, { backgroundColor: theme.colors.primary + '20' }]}
                >
                  <Ionicons name="eye" size={16} color={theme.colors.primary} />
                  <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>View Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleGroupChatAccess(group);
                  }}
                  style={[styles.actionButton, { backgroundColor: theme.colors.primary + '20' }]}
                >
                  <Ionicons name="chatbubbles" size={16} color={theme.colors.primary} />
                  <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>Chat</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    openSettlementScreen({ 
                      filter: 'groups', 
                      groupId: group.id 
                    });
                  }}
                  style={[styles.actionButton, styles.settlementButton, { backgroundColor: theme.colors.success + '20' }]}
                >
                  <Ionicons name="card" size={16} color={theme.colors.success} />
                  <Text style={[styles.actionButtonText, { color: theme.colors.success }]}>Settle</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );

  // Enhanced friend actions menu with payment and management options
  const showFriendActionsMenu = (friend: Friend) => {
    const balanceDetail = sharedBalances.allBalances.find(b => b.userId === friend.friendId);
    const balance = balanceDetail?.balance || 0;
    const hasBalance = Math.abs(balance) > 0.01;

    const actions: Array<{
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }> = [];

    // Only show "Remind Payment Request" if there's a balance
    if (hasBalance) {
      actions.push({
        text: 'Remind Payment Request',
        onPress: () => {
          setSelectedFriendForRemind(friend);
          setRemindBalance(balance);
          setShowRemindModal(true);
        }
      });
    }

    // Always show Remove Friend option
    actions.push({
      text: 'Remove Friend',
      style: 'destructive',
      onPress: () => handleRemoveFriend(friend)
    });

    actions.push({ text: 'Cancel', style: 'cancel' });

    // Show status in the alert title
    const statusDisplay = hasBalance 
      ? balance > 0 
        ? `Owes you ${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(balance).toFixed(2)}`
        : `You owe ${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(balance).toFixed(2)}`
      : 'All settled up';

    CrossPlatformAlert.alert(
      friend.friendData.fullName,
      statusDisplay,
      actions
    );
  };

  // Helper functions (keep existing but add balance notifications where needed)
  const handleRemoveFriend = (friend: Friend) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.friendData.fullName} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.removeFriend(user!.id, friend.friendId);
              Alert.alert('Friend Removed', `${friend.friendData.fullName} has been removed.`);
              notifyBalanceChange(); // FIXED: Notify balance system
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  // Handle payment
  const handlePayment = async (friendId: string, amount: number, method: string) => {
    try {
      if (!user?.id) return;
      
      const friend = friends.find(f => f.friendId === friendId);
      if (!friend) return;
      
      const providers = PaymentService.getAvailableProviders(user.currency, user.country);
      const selectedProvider = providers.find(p => p.id === method);
      
      if (!selectedProvider) {
        Alert.alert('Error', 'Payment method not available');
        return;
      }
      
      const paymentRequest = {
        amount,
        currency: user.currency,
        recipientId: friendId,
        recipientName: friend.friendData.fullName,
        recipientEmail: friend.friendData.email,
        description: `Payment via Spendy`
      };

      await PaymentService.initiatePayment(method, paymentRequest, user.id, friendId);
      
      // FIXED: Notify balance system after payment
      notifyBalanceChange();
      
      setShowPayment(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to initiate payment');
    }
  };

  // Handle manual settlement - REMOVED: Now handled by UnifiedSettlementScreen

  // Handle deep linking navigation from notifications
  const handleNavigationIntent = async (intent: any) => {
    try {
      const { type, action } = intent;
      
      switch (type) {
        case 'group_joined':
          if (intent.groupName) {
            setActiveTab('groups');
            await loadGroups();
            notifyBalanceChange(); // FIXED: Notify balance system
            showAnimatedSuccess('Welcome to the Group! 🎉', `You have successfully joined "${intent.groupName}"`);
          }
          break;

        case 'group_details':
          if (intent.groupId) {
            const group = groups.find(g => g.id === intent.groupId) || 
                        (await apiService.getGroup(intent.groupId));
            if (group) {
              setSelectedGroup(group);
              setShowGroupDetails(true);
              setActiveTab('groups');
            }
          }
          break;

        case 'friend_request':
          console.log('🤝 Handling friend_request navigation intent:', intent);
          setActiveTab('friends');
          if (intent.friendRequestId) {
            console.log('📋 Refreshing friends for friend request:', intent.friendRequestId);
            await loadFriendsAndRequests();
            await loadNotifications(); // Also refresh notifications
            notifyBalanceChange(); // FIXED: Notify balance system
          }
          break;

        case 'friend_request_accepted':
          setActiveTab('friends');
          notifyBalanceChange(); // FIXED: Notify balance system
          if (intent.friendRequestId) {
            Alert.alert('Friend Added! 🎉', 'You are now connected and can split expenses together.');
          }
          break;

        default:
          console.log('Unknown navigation intent type:', type);
          break;
      }
    } catch (error) {
      console.error('Error handling navigation intent:', error);
      Alert.alert('Navigation Error', 'Failed to navigate to the requested content');
    }
  };

  // Handle notification navigation
  const handleNotificationNavigation = async (notification: Notification) => {
    try {
      const { type, data } = notification;
      
      switch (type) {
        case 'friend_request':
          console.log('🤝 Processing friend request notification:', data);
          setActiveTab('friends');
          
          // Refresh friends list to show the received friend request
          try {
            await loadFriendsAndRequests();
            console.log('✅ Friends list refreshed for new friend request');
          } catch (error) {
            console.error('❌ Failed to refresh friends list:', error);
          }
          
          if (data.friendRequestId && data.senderName) {
            console.log('📋 Friend request data:', {
              friendRequestId: data.friendRequestId,
              senderName: data.senderName,
              senderEmail: data.senderEmail,
              fromUserId: data.fromUserId
            });
            
            const friendRequestData = {
              id: data.friendRequestId,
              fromUserId: data.fromUserId || '',
              fromUserData: {
                fullName: data.senderName,
                email: data.senderEmail || '',
                avatar: data.senderAvatar
              },
              message: data.message || `${data.senderName} wants to be your friend`,
              status: 'pending' as const,
              createdAt: new Date() // Add the required createdAt field
            };
            
            console.log('🎯 Opening friend request modal with data:', friendRequestData);
            setSelectedFriendRequest(friendRequestData);
            setShowFriendRequest(true);
          } else {
            console.warn('⚠️ Missing required friend request data:', data);
          }
          break;

        case 'expense_added':
          if (data.groupId) {
            const group = groups.find(g => g.id === data.groupId);
            if (group) {
              setSelectedGroup(group);
              setShowGroupDetails(true);
              if (data.description && data.amount && data.senderName) {
                setTimeout(() => {
                  Alert.alert(
                    'New Expense Added',
                    `${data.senderName} added "${data.description}" for ${getCurrencySymbol(data.currency || 'USD')}${data.amount} in ${data.groupName}`,
                    [{ text: 'OK' }]
                  );
                }, 500);
              }
            }
          }
          break;

        case 'group_invite':
          setActiveTab('groups');
          if (data.inviteCode && data.groupName) {
            Alert.alert(
              'Group Invitation 🎉',
              `${data.senderName || 'Someone'} invited you to join "${data.groupName}"`,
              [
                { text: 'Decline', style: 'cancel' },
                {
                  text: 'Join Group',
                  style: 'default',
                  onPress: async () => {
                    try {
                      if (!user?.id) return;
                      await apiService.joinGroupByInviteCode(data.inviteCode, user.id);
                      await loadGroups();
                      notifyBalanceChange(); // FIXED: Notify balance system
                      showAnimatedSuccess('Welcome! 🎊', `You've successfully joined "${data.groupName}"!`);
                    } catch (error: any) {
                      Alert.alert('Error', error.message || 'Failed to join group');
                    }
                  }
                }
              ]
            );
          }
          break;

        default:
          console.log('Unknown notification type:', type);
          break;
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to navigate to notification content');
    }
  };

  // Handle friend request accept
  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      await apiService.acceptFriendRequest(requestId);
      notifyBalanceChange(); // FIXED: Notify balance system
      
      // Refresh friends list to update UI
      try {
        await loadFriendsAndRequests();
        console.log('✅ Friends list refreshed after accepting friend request');
      } catch (refreshError) {
        console.error('❌ Failed to refresh friends list:', refreshError);
      }
      
      // Reload notifications to remove/update the friend request notification
      await loadNotifications();
      
      setShowFriendRequest(false);
      setSelectedFriendRequest(null);
      
      // Show full-screen success with navigation to friends tab
      showFullScreenSuccessAnimation(
        'Success! 🤝', 
        'Friend request accepted!',
        'You can now split expenses together',
        'View Friends',
        () => {
          setShowFullScreenSuccess(false);
          setActiveTab('friends');
          setActiveFriendsTab('accepted');
        }
      );
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.message || 'Failed to accept friend request');
    }
  };

  // Handle friend request decline
  const handleDeclineFriendRequest = async (requestId: string) => {
    try {
      await apiService.declineFriendRequest(requestId);
      
      // Refresh friends list to update UI
      try {
        await loadFriendsAndRequests();
        console.log('✅ Friends list refreshed after declining friend request');
      } catch (refreshError) {
        console.error('❌ Failed to refresh friends list:', refreshError);
      }
      
      // Reload notifications to remove/update the friend request notification
      await loadNotifications();
      
      setShowFriendRequest(false);
      setSelectedFriendRequest(null);
      showAnimatedSuccess('Request Declined', 'Friend request declined', 'info');
    } catch (error: any) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', error.message || 'Failed to decline friend request');
    }
  };

  // DEBUG: Function to test friend request API directly
  const debugFriendRequests = async () => {
    if (!user?.id) return;
    
    console.log('🔍 DEBUG: Testing friend request APIs directly...');
    
    try {
      // Test API call directly
      console.log('📞 DEBUG: Calling getFriendRequests API...');
      const apiResponse = await apiService.getFriendRequests();
      console.log('📊 DEBUG: Raw API response:', apiResponse);
      
      // Test FriendsManager
      console.log('👥 DEBUG: Testing FriendsManager...');
      const friendsData = friends;
      console.log('📋 DEBUG: FriendsManager current data:', friendsData);
      
      // Force a refresh
      console.log('🔄 DEBUG: Forcing FriendsManager refresh...');
      await loadFriendsAndRequests();
      const refreshedData = friends;
      console.log('📋 DEBUG: FriendsManager after refresh:', refreshedData);
      
      // Check pending friends specifically
      const pendingFriends = refreshedData.filter(f => f.status === 'pending' || f.status === 'invited');
      console.log('⏳ DEBUG: Pending friends found:', pendingFriends);
      
    } catch (error) {
      console.error('❌ DEBUG: Error testing friend requests:', error);
    }
  };

  // Tab navigation
  const tabs = [
    { id: 'overview', title: 'Overview', icon: 'home' },
    { id: 'groups', title: 'Groups', icon: 'people' },
    { id: 'friends', title: 'Friends', icon: 'person-add' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If showCreateGroup is true, render CreateGroupModal as full-screen
  if (showCreateGroup) {
    return (
      <CreateGroupModal
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onSubmit={handleCreateGroup}
        friends={friends}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Splitting</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Track and split expenses
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={handleQRScannerAccess}
          >
            <Ionicons name="qr-code" size={24} color="#8B5CF6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={handleAnalyticsAccess}
          >
            <Ionicons name="analytics" size={24} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerAction}
            onPress={handleNotificationsPress}
          >
            <Ionicons name="notifications" size={24} color="#F59E0B" />
            {notifications.filter(n => !n.isRead).length > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={styles.notificationBadgeText}>
                  {notifications.filter(n => !n.isRead).length > 99 ? '99+' : notifications.filter(n => !n.isRead).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabNavigation, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.segmentedControl, { backgroundColor: theme.colors.surface }]}>
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.segment,
                activeTab === tab.id && [styles.activeSegment, { backgroundColor: theme.colors.primary }],
                index === 0 && styles.firstSegment,
                index === tabs.length - 1 && styles.lastSegment,
              ]}
              onPress={() => handleTabSwitch(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? 'white' : theme.colors.textSecondary}
              />
              <Text style={[
                styles.segmentText,
                { color: activeTab === tab.id ? 'white' : theme.colors.textSecondary }
              ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContainer}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'groups' && renderGroupsTab()}
        {activeTab === 'friends' && renderFriendsTab()}
      </View>

      {/* All Modals - Keep existing modal implementations */}
      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onSubmit={handleAddExpense}
        groups={groups}
        friends={friends}
        preSelectedGroup={selectedGroupForExpense}
      />
      
      <AddFriendModal
        visible={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onSubmit={handleAddFriend}
        onOpenQRScanner={() => {
          setShowAddFriend(false);
          setQrScanSource('addFriend');
          setShowQRScanner(true);
        }}
      />
      
      <GroupDetailsModal
        visible={showGroupDetails}
        onClose={() => setShowGroupDetails(false)}
        group={selectedGroup}
        currentUser={user}
        onAddExpense={() => {
          setSelectedGroupForExpense(selectedGroup);
          setShowGroupDetails(false);
          setShowAddExpense(true);
        }}
        onOpenChat={() => {
          setShowGroupDetails(false);
          handleGroupChatAccess(selectedGroup!);
        }}
        onGroupLeft={() => {
          loadGroups();
          notifyBalanceChange(); // FIXED: Notify balance system
        }}
        onRefresh={() => {
          loadGroups();
          notifyBalanceChange(); // FIXED: Notify balance system
        }}
        friends={friends}
      />
      
      <QRCodeModal
        visible={showQRCode}
        onClose={() => setShowQRCode(false)}
        user={user}
        selectedGroup={selectedGroup}
      />
      
      <PaymentModal
        visible={showPayment}
        onClose={() => setShowPayment(false)}
        friend={selectedFriend}
        onPayment={handlePayment}
        userCurrency={user?.currency || 'AUD'}
        userCountry={user?.country || 'AU'}
      />
      
      <GroupChatModal
        visible={showGroupChat}
        onClose={() => setShowGroupChat(false)}
        group={selectedGroup}
        currentUser={user}
        onAddExpense={() => {
          setShowGroupChat(false);
          setSelectedGroupForExpense(selectedGroup);
          setShowAddExpense(true);
        }}
      />

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onMarkAsRead={async (notificationId) => {
          await apiService.markNotificationAsRead(notificationId);
          await loadNotifications();
        }}
        onMarkAllAsRead={markAllNotificationsRead}
        onNavigateToNotification={handleNotificationNavigation}
      />

      <FriendRequestModal
        visible={showFriendRequest}
        onClose={() => {
          setShowFriendRequest(false);
          setSelectedFriendRequest(null);
        }}
        friendRequest={selectedFriendRequest}
        onAccept={() => selectedFriendRequest && handleAcceptFriendRequest(selectedFriendRequest.id)}
        onDecline={() => selectedFriendRequest && handleDeclineFriendRequest(selectedFriendRequest.id)}
      />

      {/* ImportSplitwiseModal temporarily hidden for MVP
      <ImportSplitwiseModal
        visible={showImportSplitwise}
        onClose={() => setShowImportSplitwise(false)}
        onImportComplete={() => {
          setShowImportSplitwise(false);
          onRefresh(); // Refresh the screen data after import
        }}
      />
      */}



      <EditExpenseModal
        visible={showEditExpense}
        onClose={() => {
          setShowEditExpense(false);
          setSelectedExpenseForAction(null);
        }}
        expense={selectedExpenseForAction}
        onSubmit={handleExpenseUpdate}
        groups={groups}
        isUserAdmin={groups.find(g => g.id === selectedExpenseForAction?.groupId)
          ?.members.find(m => m.userId === user?.id)?.role === 'admin'}
        onExpenseDeleted={() => {
          setShowEditExpense(false);
          setSelectedExpenseForAction(null);
          Promise.all([
            loadGroups(),
            loadRecentExpenses()
          ]);
          notifyBalanceChange(); // FIXED: Notify balance system
          
          // Show success animation for deletion
          showAnimatedSuccess('Expense Deleted! 🗑️', 'Your expense has been deleted successfully');
        }}
      />

      <ExpenseSettlementModal
        visible={showExpenseSettlement}
        onClose={() => setShowExpenseSettlement(false)}
        expense={selectedExpenseForAction}
        currentUser={user}
        onSettlementComplete={() => {
          loadRecentExpenses();
          loadGroups();
          notifyBalanceChange(); // FIXED: Notify balance system
        }}
      />

      <ExpenseDeletionModal
        visible={showExpenseDeletion}
        onClose={() => setShowExpenseDeletion(false)}
        expense={selectedExpenseForAction}
        currentUser={user}
        onDeletionComplete={() => {
          loadRecentExpenses();
          loadGroups();
          notifyBalanceChange(); // FIXED: Notify balance system
        }}
        isUserAdmin={groups.find(g => g.id === selectedExpenseForAction?.groupId)
          ?.members.find(m => m.userId === user?.id)?.role === 'admin'}
      />

      <AnalyticsModal
        visible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        currentUser={user}
      />

      <Modal
        animationType="slide"
        presentationStyle="fullScreen"
        visible={showUnifiedSettlement}
        onRequestClose={() => setShowUnifiedSettlement(false)}
      >
        <UnifiedSettlementScreen
          key={`settlement-${settlementConfig.filter}-${settlementConfig.groupId || 'none'}-${settlementConfig.friendId || 'none'}`}
          mode={settlementConfig.filter === 'groups' && settlementConfig.groupId ? 'group-specific' : 'group-selector'}
          groupId={settlementConfig.groupId}
          groupName={settlementConfig.groupId ? groups.find(g => g.id === settlementConfig.groupId)?.name : undefined}
          onClose={() => {
            setShowUnifiedSettlement(false);
            // Refresh all data after settlement operations
            onRefresh();
          }}
        />
      </Modal>

      <SimpleExpenseListModal
        visible={showSimpleExpenseList}
        onClose={() => setShowSimpleExpenseList(false)}
        title={expenseListTitle}
        onExpensePress={(expense) => {
          setShowSimpleExpenseList(false);
          handleEditExpenseFromDetails(expense);
        }}
      /> 

      <QRCodeScanner
        visible={showQRScanner}
        onClose={() => {
          setShowQRScanner(false);
          setQrScanSource(null);
          const scannerManager = QRScannerManager.getInstance();
          scannerManager.stopScanning();
        }}
        onQRCodeScanned={async (qrData) => {
          const scannerManager = QRScannerManager.getInstance();
          
          if (!user) {
            setShowQRScanner(false);
            setQrScanSource(null);
            Alert.alert('Error', 'User not authenticated');
            return;
          }

          // Handle error cases first
          if (qrData === 'INVALID_QR_FORMAT') {
            Alert.alert(
              'Invalid QR Code',
              'This QR code is not compatible with Spendy. Please scan a valid Spendy QR code.',
              [
                { text: 'Try Again', style: 'default' },
                { text: 'Cancel', style: 'cancel', onPress: () => {
                  setShowQRScanner(false);
                  setQrScanSource(null);
                }}
              ]
            );
            return;
          }

          if (qrData === 'SCAN_ERROR') {
            Alert.alert(
              'Scan Error',
              'Unable to read QR code. Please try again.',
              [
                { text: 'Try Again', style: 'default' },
                { text: 'Cancel', style: 'cancel', onPress: () => {
                  setShowQRScanner(false);
                  setQrScanSource(null);
                }}
              ]
            );
            return;
          }

          // Process valid QR code
          try {
            console.log('🔄 Processing QR code...');
            const result = await scannerManager.processQRCode(qrData, user.id, {
              closeOnSuccess: true,
              navigation: navigation
            });

            // Close scanner immediately on success or failure
            setShowQRScanner(false);
            setQrScanSource(null);

            if (result.success) {
              console.log('✅ QR code processed successfully');
              
              // Refresh data silently
              await Promise.all([
                loadGroups(),
                loadRecentExpenses(),
                loadFriendsAndRequests()
              ]);
              notifyBalanceChange();
              
              // Show animated success message
              showAnimatedSuccess('Success! 🎉', 'QR code processed successfully!');
            } else {
              console.log('❌ QR code processing failed:', result.error);
              Alert.alert(
                'Processing Failed',
                result.error || 'Unable to process this QR code. Please check that it\'s a valid Spendy QR code.',
                [{ text: 'OK' }]
              );
            }
          } catch (error: any) {
            console.error('❌ QR scanner error:', error);
            setShowQRScanner(false);
            setQrScanSource(null);
            
            Alert.alert(
              'Unexpected Error',
              'Something went wrong while processing the QR code. Please try again.',
              [{ text: 'OK' }]
            );
          }
        }}
      />

      <RemindModal
        visible={showRemindModal}
        onClose={() => {
          setShowRemindModal(false);
          setSelectedFriendForRemind(null);
          setRemindBalance(0);
        }}
        friend={selectedFriendForRemind}
        balance={remindBalance}
        currency={user?.currency || 'USD'}
        onSendReminder={handleSendReminder}
        onSuccess={showAnimatedSuccess}
      />

      <SuccessAnimationModal
        visible={showAnimatedModal}
        onClose={() => setShowAnimatedModal(false)}
        title={animatedModalProps.title}
        message={animatedModalProps.message}
        type={animatedModalProps.type}
        autoClose={true}
        duration={2500}
      />

      <GenericErrorModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={errorModalProps.title}
        message={errorModalProps.message}
        primaryButtonText={errorModalProps.primaryButtonText}
        secondaryButtonText={errorModalProps.secondaryButtonText}
        onPrimaryPress={errorModalProps.onPrimaryPress}
        onSecondaryPress={errorModalProps.onSecondaryPress}
      />

      <ExportModal
        visible={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setSelectedGroupForExport(null);
        }}
        group={selectedGroupForExport}
        currentUserId={user?.id || ''}
        onExportComplete={handleExportComplete}
      />

      {/* Full-screen Success Animation */}
      <FullScreenSuccessAnimationSimple
        visible={showFullScreenSuccess}
        title={fullScreenSuccessProps.title}
        message={fullScreenSuccessProps.message}
        subtitle={fullScreenSuccessProps.subtitle}
        buttonText={fullScreenSuccessProps.buttonText}
        onContinue={fullScreenSuccessProps.onContinue || (() => setShowFullScreenSuccess(false))}
        showButton={true}
      />

      {/* Full-screen Error Animation */}
      <FullScreenErrorSimple
        visible={showFullScreenError}
        title={fullScreenErrorProps.title}
        message={fullScreenErrorProps.message}
        subtitle={fullScreenErrorProps.subtitle}
        errorCode={fullScreenErrorProps.errorCode}
        onRestart={fullScreenErrorProps.onRestart}
      />
    </SafeAreaView>
  );
}

const additionalStyles = StyleSheet.create({
  // Pending invitation styles
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '500',
  },
  
  // Resend button styles
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  resendButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Section styles
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  
  // Source indicator for group members
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

// FIXED: Keep existing styles but remove old balance-related styles
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAction: {
    position: 'relative',
    marginLeft: 16,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabNavigation: {
    borderBottomWidth: 0,
    paddingVertical: 8,
  },
  tabContainer: {
    flex: 1,
  },
  tabContent: {
    flexGrow: 1,
    padding: 20,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  actionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 60,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  expenseIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '500',
    flexShrink: 1,
  },
  expenseSubtitle: {
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1,
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  editedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  editedText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyExpenses: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyExpensesText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    borderRadius: 16,
    marginTop: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  addFirstGroupButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstGroupText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeSegment: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  firstSegment: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  lastSegment: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  groupMembers: {
    fontSize: 14,
  },
  groupDivider: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  groupActivity: {
    fontSize: 12,
  },
  groupActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  groupStat: {
    flex: 1,
  },
  groupStatLabel: {
    fontSize: 12,
  },
  groupStatValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  groupActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  settlementButton: {
    flex: 1,
  },
  addExpenseButton: {
    flex: 1,
  },
   // Balance card styles
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  importButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  balanceItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
    maxWidth: '33.33%',
  },
  balanceAmount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  balanceSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },

  // Friend balance item styles
  friendBalanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendRight: {
    alignItems: 'flex-end',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  friendGroup: {
    fontSize: 12,
    marginTop: 2,
  },
  friendBalance: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Balance item styles for friends tab
  balanceItemFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 80, // Ensure consistent height
  },
  balanceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 3, // Increase space for left side
    minWidth: 0,
    marginRight: 16, // Increase margin to prevent overlap
  },
  balanceItemRight: {
    flexDirection: 'column', // Stack balance info vertically for better space usage
    alignItems: 'flex-end',
    gap: 4,
    flex: 2, // Increase right side to accommodate longer balance text
    maxWidth: '45%', // Allow more space for balance text
    justifyContent: 'center',
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  personInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8, // Reduce spacing slightly
    paddingRight: 12, // Increase padding to prevent text from touching the right section
  },
  personName: {
    fontSize: 16,
    fontWeight: '600', // Make name more prominent
    marginBottom: 4,
    lineHeight: 20,
    flexShrink: 1, // Allow name to shrink if very long
  },
  personEmail: {
    fontSize: 12,
    marginBottom: 2,
    opacity: 0.7,
    lineHeight: 16,
  },
  sourceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  balanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap', // Allow wrapping if needed
    justifyContent: 'flex-end',
  },
  balanceText: {
    fontSize: 12, // Make smaller to fit better
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1, // Allow text to shrink if needed
    maxWidth: '100%', // Ensure text doesn't overflow
  },
  balanceBreakdown: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: 2,
    opacity: 0.8,
  },
  // Pending invitation styles
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '500',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resendButtonText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Respond button for friend requests
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  respondButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'white',
  },
  // Invite button styles
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inviteButtonText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Refresh button
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  // Horizontal scrolling styles
horizontalScroll: {
  marginTop: 8,
},
horizontalScrollContent: {
  paddingHorizontal: 16,
  gap: 12,
},

// Expense card styles
expenseCard: {
  width: 160,
  borderRadius: 12,
  padding: 12,
  borderWidth: 1,
  borderColor: '#E5E7EB',
},
expenseCardHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 8,
},
expenseCardIcon: {
  fontSize: 24,
},
expenseCardAmount: {
  alignItems: 'flex-end',
},
expenseCardAmountText: {
  fontSize: 16,
  fontWeight: 'bold',
},
expenseCardContent: {
  flex: 1,
  marginBottom: 8,
},
expenseCardTitle: {
  fontSize: 14,
  fontWeight: '500',
  marginBottom: 4,
  minHeight: 32, // Ensures consistent card height
},
expenseCardDate: {
  fontSize: 12,
  marginBottom: 2,
},
expenseCardPaidBy: {
  fontSize: 11,
},
expenseCardFooter: {
  height: 20,
  justifyContent: 'center',
},
expenseCardSpacer: {
  height: 20,
},
editedBadgeSmall: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 8,
  gap: 2,
},
editedTextSmall: {
  fontSize: 9,
  fontWeight: '500',
},

// Add expense card styles
addExpenseCard: {
  width: 160,
  borderRadius: 12,
  borderWidth: 2,
  borderStyle: 'dashed',
  padding: 12,
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 140,
},
addExpenseCardContent: {
  alignItems: 'center',
  gap: 8,
},
addExpenseCardText: {
  fontSize: 12,
  fontWeight: '500',
  textAlign: 'center',
  lineHeight: 16,
},

// Friend card styles
friendCard: {
  width: 140,
  borderRadius: 12,
  padding: 12,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  justifyContent: 'space-between',
  minHeight: 120,
},
friendCardHeader: {
  alignItems: 'center',
  marginBottom: 8,
  position: 'relative',
},
friendCardAvatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
},
friendCardAvatarText: {
  color: 'white',
  fontSize: 16,
  fontWeight: 'bold',
},
groupIndicator: {
  position: 'absolute',
  top: -2,
  right: -2,
  width: 16,
  height: 16,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
},
friendCardContent: {
  alignItems: 'center',
  marginBottom: 8,
  flex: 1,
  justifyContent: 'center',
},
friendCardName: {
  fontSize: 14,
  fontWeight: '500',
  textAlign: 'center',
  marginBottom: 2,
},
friendCardGroup: {
  fontSize: 10,
  textAlign: 'center',
},
friendCardBalance: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
},
friendCardBalanceText: {
  fontSize: 12,
  fontWeight: '600',
  textAlign: 'center',
},

// Add friend card styles
addFriendCard: {
  width: 140,
  borderRadius: 12,
  borderWidth: 2,
  borderStyle: 'dashed',
  padding: 12,
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 120,
},
addFriendCardContent: {
  alignItems: 'center',
  gap: 8,
},
addFriendCardText: {
  fontSize: 12,
  fontWeight: '500',
  textAlign: 'center',
  lineHeight: 16,
},

// New vertical card row styles (similar to SmartMoneyApp)
viewAllButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
},
viewAllText: {
  fontSize: 14,
  fontWeight: '500',
},
addButton: {
  padding: 4,
  marginRight: 8,
},
emptyStateContainer: {
  alignItems: 'center',
  paddingVertical: 40,
  paddingHorizontal: 20,
},
emptyStateText: {
  fontSize: 16,
  fontWeight: '600',
  marginTop: 12,
  textAlign: 'center',
},
emptyStateSubtext: {
  fontSize: 14,
  marginTop: 4,
  textAlign: 'center',
},

// Expense Card Rows (New Layout)
expenseCardsList: {
  maxHeight: 300,
},
expenseCardRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 16,
  marginVertical: 4,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E5E7EB',
},
categoryIconContainer: {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},
categoryIconText: {
  fontSize: 18,
},
expenseCardDetails: {
  flex: 1,
},
expenseCardMeta: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
},
metaSeparator: {
  fontSize: 13,
  marginHorizontal: 6,
},
editedTextInline: {
  fontSize: 13,
  fontWeight: '500',
},

// Friend Card Rows (New Layout)
friendCardsList: {
  maxHeight: 300,
},
friendCardRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 16,
  marginVertical: 4,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E5E7EB',
},
friendIconContainer: {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},
friendIconText: {
  fontSize: 16,
  fontWeight: 'bold',
  color: 'white',
},
friendCardRowDetails: {
  flex: 1,
},
friendCardRowName: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 4,
},
friendCardRowMeta: {
  flexDirection: 'row',
  alignItems: 'center',
},
friendCardRowSource: {
  fontSize: 13,
  fontWeight: '400',
},
friendCardRowBalance: {
  alignItems: 'flex-end',
},
friendCardRowBalanceText: {
  fontSize: 16,
  fontWeight: 'bold',
},

// New styles for friends subtabs
subTabContainer: {
  flexDirection: 'row',
  marginBottom: 16,
  borderRadius: 8,
  padding: 4,
  marginHorizontal: 16,
},
subTab: {
  flex: 1,
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 6,
  alignItems: 'center',
},
subTabText: {
  fontSize: 14,
  fontWeight: '500',
},
statusText: {
  fontSize: 12,
  fontStyle: 'italic',
  marginTop: 2,
},
friendActions: {
  alignItems: 'center',
  gap: 8,
},
remindButton: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 4,
  gap: 2,
},
remindButtonText: {
  color: 'white',
  fontSize: 10,
  fontWeight: '500',
},
groupHeaderActions: {
  flexDirection: 'row',
  gap: 8,
},
modalHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingVertical: 16,
  minHeight: 64,
},
backButton: {
  padding: 12,
  borderRadius: 12,
  marginRight: 8,
},
modalTitle: {
  fontSize: 18,
  fontWeight: '600',
  flex: 1,
  textAlign: 'center',
},

// NEW: Clean Friends Tab Styles
cleanTabHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingVertical: 16,
  marginBottom: 8,
},
headerTitleSection: {
  flex: 1,
},
cleanTabTitle: {
  fontSize: 24,
  fontWeight: '700',
  marginBottom: 2,
},
cleanTabSubtitle: {
  fontSize: 14,
  fontWeight: '400',
},
cleanHeaderActions: {
  flexDirection: 'row',
  gap: 10,
},
cleanActionButton: {
  width: 44,
  height: 44,
  borderRadius: 22,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},

// Modern tab container
modernTabContainer: {
  flexDirection: 'row',
  marginHorizontal: 20,
  marginBottom: 20,
  padding: 4,
  borderRadius: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
},
modernTab: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 8,
  gap: 8,
},
modernTabText: {
  fontSize: 14,
  fontWeight: '600',
},
modernTabBadge: {
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 10,
  minWidth: 20,
  alignItems: 'center',
},
modernTabBadgeText: {
  fontSize: 12,
  fontWeight: '600',
},

// Clean empty state
cleanEmptyState: {
  alignItems: 'center',
  paddingVertical: 60,
  paddingHorizontal: 40,
  marginHorizontal: 20,
  borderRadius: 16,
  marginBottom: 20,
},
cleanEmptyIcon: {
  width: 80,
  height: 80,
  borderRadius: 40,
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 16,
},
cleanEmptyTitle: {
  fontSize: 18,
  fontWeight: '600',
  marginBottom: 8,
  textAlign: 'center',
},
cleanEmptySubtitle: {
  fontSize: 14,
  textAlign: 'center',
  lineHeight: 20,
},

// Clean friends list
cleanFriendsList: {
  paddingHorizontal: 20,
  gap: 12,
},

// Clean friend card
cleanFriendCard: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 16,
  borderRadius: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 2,
  marginBottom: 4,
},
cleanFriendLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
  marginRight: 12,
},
cleanAvatar: {
  width: 48,
  height: 48,
  borderRadius: 24,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
cleanAvatarText: {
  color: 'white',
  fontSize: 18,
  fontWeight: '700',
},
cleanFriendInfo: {
  flex: 1,
  minWidth: 0,
},
cleanFriendName: {
  fontSize: 16,
  fontWeight: '600',
  marginBottom: 4,
  lineHeight: 20,
},
cleanGroupIndicator: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
},
cleanGroupText: {
  fontSize: 13,
  fontWeight: '500',
},
cleanDirectText: {
  fontSize: 13,
  fontWeight: '400',
},

// Clean friend right section
cleanFriendRight: {
  alignItems: 'flex-end',
  gap: 8,
  minWidth: 100,
},
cleanSettledBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 8,
},
cleanSettledText: {
  fontSize: 13,
  fontWeight: '600',
},
cleanBalanceBadge: {
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 12,
  alignItems: 'center',
  minWidth: 80,
},
cleanBalanceAmount: {
  fontSize: 14,
  fontWeight: '700',
  textAlign: 'center',
},
cleanBalanceLabel: {
  fontSize: 11,
  fontWeight: '500',
  textAlign: 'center',
  marginTop: 2,
},
cleanRemindButton: {
  width: 32,
  height: 32,
  borderRadius: 16,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  elevation: 2,
},
});