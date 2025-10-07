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
  Animated,
  Image,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from '../../components/common/Icon';
import DynamicBanner from '../../components/common/DynamicBanner';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { User } from '@/types';
import { MeetNSplitLogo } from '@/components/common/MeetNSplitLogo';
import { BrandHeader } from '@/components/common/BrandHeader';

// Import subscription helper
import { SubscriptionHelper } from '@/utils/SubscriptionHelper';

// Helper function to get active member count
const getActiveMemberCount = (members: any[]): number => {
  if (!members || !Array.isArray(members)) return 0;
  return members.filter(member => member.isActive !== false).length;
};

// FIXED: Import only the unified balance system
import { useSharedBalances } from '@/hooks/useSharedBalances';
import { useOverviewBalances, UnifiedSettlementService } from '@/hooks/useBalances';
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
    mobile?: string;
    avatar?: string;
    profilePicture?: string;
    profileImage?: string;
  };
  status: 'pending' | 'accepted' | 'blocked' | 'invited';
  balance: number;
  createdAt: Date;
  requestId?: string; // For pending friend requests
  requestType?: 'sent' | 'received'; // Type of request
  isNewUser?: boolean; // For new user invites
  type?: string; // Additional type field for invites
  inviteMethod?: string; // Method used for invitation
  message?: string; // Request message
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
import { SimpleNotificationService } from '@/services/notifications/SimpleNotificationService';
import { QRCodeService } from '@/services/qr/QRCodeService';
// REMOVED: friendsManager import - using only API service

// Import modals
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import AddFriendModal from '@/components/modals/AddFriendModal';
import CreateGroupModal from '@/components/modals/CreateGroupModal';
import JoinGroupModal from '@/components/modals/JoinGroupModal';
import QRCodeModal from '@/components/modals/QRCodeModal';
import GroupChatModal from '@/components/modals/GroupChatModal';
import { GroupChatService } from '@/services/firebase/GroupChatService';
import ReceiptScannerModal from '@/components/modals/ReceiptScannerModal';
import GroupDetailsModal from '@/components/modals/GroupDetailsModal';
import ExpenseRefreshService from '@/services/expenseRefreshService';
import NotificationsModal from '@/components/modals/NotificationsModal';
import SplittingAnalyticsModal from '@/components/modals/SplittingAnalyticsModal';
import ExpenseDeletionModal from '@/components/modals/ExpenseDeletionModal';
import ExpenseSettlementModal from '@/components/modals/ExpenseSettlementModal';
import FriendRequestModal from '@/components/modals/FriendRequestModal';
import UnifiedSettlementScreen from './UnifiedSettlementScreen';
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
import ExpenseDetailModal from '@/components/modals/ExpenseDetailModal';
// SubscriptionModal handled globally by App.tsx
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
  const { calculateSettlementBalances, totalOwed, totalOwing, netBalance, allBalances, groupMemberBalances } = sharedBalances;
  
  // Helper function to get category icon
  const getCategoryIcon = (categoryId: string) => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === categoryId)?.icon || '💰';
  };
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [activeFriendsTab, setActiveFriendsTab] = useState('accepted'); // New state for friends subtabs
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Animation for tab sliding - FIXED: Stable initialization to prevent useInsertion errors
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const tabOpacity = useRef(new Animated.Value(1)).current;
  
  // REMOVED: Problematic animation initialization that could cause useInsertion errors
  // Animation values are now properly initialized in the useRef declarations above
  
  interface ContactData {
    name: string;
    phoneNumber: string;
  }
  
  // Data state - FIXED: Removed all old balance states
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>({});
  
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
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanSource, setQrScanSource] = useState<'direct' | 'addFriend' | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  // Chat unread counts
  const [groupUnreadCounts, setGroupUnreadCounts] = useState<Record<string, number>>({});

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
  
  // Expense detail modal state
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [selectedExpenseForDetail, setSelectedExpenseForDetail] = useState<Expense | null>(null);
  
  // Subscription modal handled by App.tsx globally now
  
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
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
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

  // Function to show subscription modal
  // Handle opening expense detail modal
  const handleExpenseDetail = (expense: Expense) => {
    console.log('👁️ Opening expense detail modal for:', expense.id);
    setSelectedExpenseForDetail(expense);
    setShowExpenseDetail(true);
  };

  // Check if expense is editable (created after last settlement)
  const isExpenseEditable = (expense: Expense): boolean => {
    // TODO: Implement logic to check if expense was created after last settlement
    // For now, we'll assume all expenses are editable
    // In a real implementation, you'd compare expense.createdAt with the last settlement date
    return true;
  };

  // Handle editing expense from detail modal
  const handleEditFromDetail = (expense: Expense) => {
    console.log('✏️ Opening edit modal for expense:', expense.id);
    setSelectedExpenseForAction(expense);
    setShowEditExpense(true);
    setShowExpenseDetail(false);
  };

  // Subscription modal is now handled globally by App.tsx

  // Handle subscription purchase
  // Subscription purchase handled globally by App.tsx

  // Set up subscription helper when component mounts
  useEffect(() => {
    // Removed local subscription modal handler - using global App.tsx handler now

    // Set up global function to refresh friends data (called when profile picture is updated)
    (global as any).refreshFriendsData = () => {
      console.log('🔄 Global refreshFriendsData called - reloading friends');
      loadFriendsAndRequests();
    };

    // Set up global function to open Add Expense modal with subscription check
    (global as any).openAddExpenseModal = async () => {
      console.log('🚀 Global openAddExpenseModal called - checking subscription limits');
      if (!user?.id) {
        console.log('❌ No user ID found');
        return;
      }

      try {
        // Check if we should bypass the transaction limit check (after countdown)
        const shouldBypass = (global as any).bypassTransactionLimitOnce;
        if (shouldBypass) {
          console.log('🎯 BYPASSING transaction limit check when opening modal (flag set after countdown)');
          // DON'T clear the flag here - it will be cleared when actually submitting the expense
          // This allows the bypass to work for the full expense creation flow
          setShowAddExpense(true);
          return;
        }

        console.log('🔍 Checking transaction limit for global expense modal...');
        const canCreate = await subscriptionHelper.canCreateTransaction(user.id);
        console.log('📊 Global expense modal - Can create transaction?', canCreate);

        if (canCreate) {
          console.log('✅ Opening AddExpenseModal via global function');
          setShowAddExpense(true);
        } else {
          console.log('🚫 Transaction limit reached - subscription modal showing for 10 seconds');
          // FIXED: After showing subscription modal (which has 10 sec countdown),
          // still open AddExpenseModal to allow user to submit
          // The modal will auto-close after 10 seconds and then open expense modal
          setTimeout(() => {
            console.log('⏰ Auto-opening AddExpenseModal after subscription modal countdown');
            setShowAddExpense(true);
          }, 10500); // Slightly longer than 10 sec countdown to ensure modal closes first
        }
      } catch (error) {
        console.error('❌ Error checking subscription for global expense modal:', error);
        // Still allow opening the modal if subscription check fails
        setShowAddExpense(true);
      }
    };
    
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
        
        // Show success animation with navigation to group details
        showFullScreenSuccessAnimation(
          'Expense Added! 🧾', 
          'Expense has been added and split successfully!',
          fromGroupDetails ? `Added to ${fromGroupDetails.name}` : 'Check your groups for updates',
          fromGroupDetails ? 'View Group' : 'Continue',
          () => {
            setShowFullScreenSuccess(false);
            if (fromGroupDetails) {
              // Open the specific group's details modal
              setSelectedGroup(fromGroupDetails);
              setShowGroupDetails(true);
            } else {
              // Navigate to groups tab if no specific group context
              setActiveTab('groups');
            }
          }
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
      console.log('🔄 Initializing friends data for user (non-blocking):', user.id);
      // Load friends in background without blocking UI
      setTimeout(() => {
        loadFriendsAndRequests().then(() => {
          console.log('✅ Friends data initialization complete');
        }).catch((error) => {
          console.error('❌ Friends data initialization failed:', error);
        });
      }, 100); // Small delay to allow UI to render first
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
  }, [groups, user?.id]); // FIXED: Removed sharedBalances dependency to prevent useInsertionEffect error

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
        
        // Keep ALL individual entries (don't aggregate yet - will aggregate for display only)
        const allEntries = [...nonZeroBalances, ...settledFriends];

        // Group by userId but keep all entries for each user
        const balancesByUser = new Map();
        allEntries.forEach(entry => {
          if (!balancesByUser.has(entry.userId)) {
            balancesByUser.set(entry.userId, []);
          }
          balancesByUser.get(entry.userId).push(entry);
        });

        // For Friends tab display, create aggregated entries
        friendSettlementBalances = Array.from(balancesByUser.entries()).map(([userId, entries]) => {
          // Sum all balances for this user across all groups
          const totalBalance = entries.reduce((sum, e) => sum + e.balance, 0);
          const firstEntry = entries[0];

          // Use first entry as base, but with aggregated balance
          return {
            userId,
            name: firstEntry.name,
            email: firstEntry.email,
            balance: totalBalance,
            source: entries.length > 1 ? 'mixed' : firstEntry.source,
            groupName: entries.length === 1 ? firstEntry.groupName : undefined,
            groupId: entries.length === 1 ? firstEntry.groupId : undefined,
            // Keep breakdown of individual balances for reference
            breakdown: entries.length > 1 ? {
              entries: entries.map(e => ({
                groupId: e.groupId,
                groupName: e.groupName,
                balance: e.balance,
                source: e.source
              }))
            } : undefined
          };
        });
        
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
          source: b.source,
          hasBreakdown: !!b.breakdown,
          breakdownEntries: b.breakdown?.entries?.length || 0
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
  }, [friends, user?.id]); // FIXED: Removed sharedBalances dependency to prevent useInsertionEffect error
  
  // FIXED: Unified balance change notification with cache clearing
  // FIXED: Use ref for debouncing balance change notifications and friends loading
  const balanceChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const friendsLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingFriendsRef = useRef(false);
  
  const notifyBalanceChange = useCallback(() => {
    console.log('🔄 Notifying balance change and clearing cache...');
    UnifiedSettlementService.clearBalanceCache(); // Clear cache when balance changes
    
    // FIXED: Immediate refresh for critical operations
    sharedBalances.notifyChange();
    
    // Also debounce a force refresh to ensure all components are updated
    if (balanceChangeTimeoutRef.current) {
      clearTimeout(balanceChangeTimeoutRef.current);
    }
    
    balanceChangeTimeoutRef.current = setTimeout(() => {
      sharedBalances.forceRefresh();
      balanceChangeTimeoutRef.current = null;
    }, 100); // Reduced debounce to 100ms for faster response
  }, []); // FIXED: Removed all dependencies to prevent useInsertionEffect error as sharedBalances methods are stable

  // FIXED: Optimized tab switching to prevent useInsertion effect errors
  const handleTabSwitch = useCallback((tabId: string) => {
    if (tabId === activeTab) return; // Don't animate if same tab
    
    // Use a stable reference to prevent timing conflicts
    const previousTab = activeTab;
    
    // Schedule animation in the next frame to avoid timing conflicts
    requestAnimationFrame(() => {
      // First fade out current content
      Animated.timing(tabOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        // Update tab state after fade completes
        setActiveTab(tabId);
        
        // Calculate slide direction
        const tabs = ['overview', 'groups', 'friends'];
        const previousIndex = tabs.indexOf(previousTab);
        const newIndex = tabs.indexOf(tabId);
        const slideDirection = newIndex > previousIndex ? 1 : -1;
        
        // Set initial slide position and animate in
        slideAnimation.setValue(slideDirection * 300);
        
        // Animate slide and fade in together
        Animated.parallel([
          Animated.timing(slideAnimation, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(tabOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
    
    // Handle data loading asynchronously to prevent conflicts
    setTimeout(() => {
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
    }, 50);
  }, [activeTab]);

  // Real-time listeners
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribeFriends: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const initializeData = async () => {
      try {
        setLoading(true);
        
        // Initialize push notifications first
        console.log('⏰ Step 0: Initializing push notifications...');
        try {
          await SimpleNotificationService.initialize();
          console.log('✅ Step 0 complete: Push notifications initialized');
        } catch (notificationError) {
          console.error('⚠️ Push notification initialization failed:', notificationError);
          // Don't fail the entire initialization if notifications fail
        }
        
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
        
        // REMOVED: Aggressive friends refresh interval
        // Friends data is now updated via event-driven notifications when needed
        // This eliminates unnecessary API calls and balance recalculations
        
        // Store cleanup function (no intervals to clean up anymore)
        unsubscribeFriends = () => {
          // No periodic refresh to clean up - using event-driven updates only
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

  // Add focus-based balance refresh for notification-triggered updates
  useFocusEffect(
    useCallback(() => {
      const checkNotificationTriggeredRefresh = async () => {
        try {
          // Check if there's a pending balance refresh flag from notifications
          const refreshFlag = await AsyncStorage.getItem('@balance_refresh_required');
          if (refreshFlag) {
            const flagTime = parseInt(refreshFlag);
            const now = Date.now();
            
            // Only refresh if flag is recent (within last 60 seconds)
            if ((now - flagTime) < 60000) {
              console.log('💰 Found notification-triggered balance refresh flag - refreshing balances');
              await sharedBalances.forceRefresh();
              console.log('✅ Notification-triggered balance refresh completed');
            }
            
            // Clear the flag after checking
            await AsyncStorage.removeItem('@balance_refresh_required');
          }
        } catch (error) {
          console.error('❌ Error checking notification-triggered refresh flag:', error);
        }
      };

      // Small delay to ensure the screen is fully focused before checking
      const timer = setTimeout(checkNotificationTriggeredRefresh, 500);
      
      return () => clearTimeout(timer);
    }, [sharedBalances])
  );

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

  // Listen to unread message counts for all groups
  useEffect(() => {
    if (!user?.id || groups.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    groups.forEach(group => {
      const unsubscribe = GroupChatService.onUnreadCount(group.id, user.id, (count) => {
        setGroupUnreadCounts(prev => ({
          ...prev,
          [group.id]: count
        }));
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user?.id, groups]);

  // Periodic refresh for real-time updates (polls every 2 minutes when app is active)
  // Note: Reduced from 30s to 2 minutes to minimize API/Firebase costs
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔄 Setting up periodic refresh for real-time updates (2 min interval)');
    const intervalId = setInterval(async () => {
      console.log('🔄 Periodic refresh: Updating group data...');
      await Promise.all([
        loadGroups(),
        loadRecentExpenses()
      ]);
      notifyBalanceChange();
    }, 120000); // Refresh every 2 minutes (120 seconds)

    return () => {
      console.log('🛑 Clearing periodic refresh interval');
      clearInterval(intervalId);
    };
  }, [user?.id, notifyBalanceChange]);

  // Handle deep linking from notifications
  useEffect(() => {
    const checkNavigationIntent = async () => {
      try {
        const intent = await SimpleNotificationService.getAndClearNavigationIntent();
        if (intent && user?.id) {
          console.log('Processing navigation intent:', intent);
          await handleNavigationIntent(intent);
        }
      } catch (error) {
        console.error('Error processing navigation intent:', error);
      }
    };

    // REMOVED: Periodic navigation check - use event-driven approach instead
    // This eliminates unnecessary background processing
    checkNavigationIntent(); // Run once on mount only
    // No need for continuous polling - navigation intents are processed immediately when received
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      if (!user?.id) return;
      const notificationsResponse = await apiService.getUserNotifications({ limit: 20 });
      
      console.log('🔔 Notifications response:', notificationsResponse);
      
      // FIXED: Handle the correct response format from backend
      const notificationsData = (notificationsResponse as any).data?.notifications || notificationsResponse.notifications || [];
      
      // Ensure notificationsData is an array before processing
      const dataArray = Array.isArray(notificationsData) ? notificationsData : [];
      
      console.log('🔔 Processing notifications:', dataArray.length);
      
      const processedNotifications = dataArray.map(notification => ({
        ...notification,
        createdAt: notification.createdAt && typeof (notification.createdAt as any).toDate === 'function' 
          ? (notification.createdAt as any).toDate() 
          : new Date(notification.createdAt || Date.now())
      }));
      
      setNotifications(processedNotifications);
      console.log('✅ Notifications loaded:', processedNotifications.length);
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

      // Load individual group balances using backend settlement API
      await loadIndividualGroupBalances(groupsWithTotals);

      return groupsWithTotals;
    } catch (error) {
      console.error('Load groups error:', error);
      setGroups([]);
      return [];
    }
  };

  // Load individual per-group balances (not aggregated)
  const loadIndividualGroupBalances = async (groupsList?: Group[]) => {
    try {
      if (!user?.id) return;
      const groupsToCheck = groupsList || groups;
      const balances: Record<string, number> = {};

      await Promise.all(
        groupsToCheck.map(async (group) => {
          try {
            const result = await apiService.getGroupSettlements(group.id);
            // Find the current user's balance in this specific group
            const userBalance = result.memberBalances?.[user.id] || 0;
            balances[group.id] = userBalance;
            console.log(`💰 Group ${group.name} individual balance: ${userBalance}`);
          } catch (error) {
            console.error(`Error loading balance for group ${group.id}:`, error);
            balances[group.id] = 0;
          }
        })
      );

      setGroupBalances(balances);
    } catch (error) {
      console.error('Error loading individual group balances:', error);
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
        
        // If we get very few expenses (less than expected), consider fallback but don't force it
        // for groups with recent activity - the primary API might be working correctly
        if (expensesData.length === 0 && groupsData.length > 0) {
          console.log('⚠️  Primary API returned no expenses, trying fallback for comprehensive results');
          throw new Error('No primary results - using fallback');
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
            
            // Show ALL expenses from groups user is a member of for transparency
            // Users should see all group activity, not just expenses they're involved in
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
                isInvolvedInEqualSplit = true;
                console.log(`🔍 User assumed involved in equal split: ${expense.description}`);
              } else if (expense.splitType === 'custom') {
                // FIXED: For custom split expenses, show all group expenses for transparency
                // Users should see all expenses in their groups, even if not personally involved
                isInvolvedInEqualSplit = true; // Changed from isPaidBy to true
                console.log(`🔍 Custom split expense, showing for group transparency: ${expense.description}`);
              } else {
                console.log(`🔍 Unknown split type: ${expense.splitType} for expense: ${expense.description}`);
                isInvolvedInEqualSplit = true; // Show by default for unknown types
              }
              
              const isInvolved = isPaidBy || isInSplitData || isInSplitDetails || isInvolvedInEqualSplit;
              
              console.log(`  isInvolvedInEqualSplit: ${isInvolvedInEqualSplit}`);
              console.log(`  Final isInvolved: ${isInvolved}`);
              
              if (isInvolved) {
                console.log(`✅ User can see expense: ${expense.description} (${
                  isPaidBy ? 'paid by user' : 
                  isInSplitData || isInSplitDetails ? 'in split data' : 
                  'group member visibility'
                })`);
              } else {
                console.log(`❌ User cannot see expense: ${expense.description} (should not happen with new logic)`);
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

  // FIXED: Load friends and friend requests with debouncing to prevent multiple rapid calls
  const loadFriendsAndRequests = useCallback(async (): Promise<Friend[]> => {
    try {
      if (!user?.id) return [];
      
      // Prevent multiple simultaneous calls
      if (isLoadingFriendsRef.current) {
        console.log('⚠️ Friends loading already in progress, skipping...');
        return friends; // Return current friends if already loading
      }
      
      isLoadingFriendsRef.current = true;
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
            avatar: friend.avatar || friend.profilePicture || friend.profileImage,
            profilePicture: friend.profilePicture || friend.profileImage || friend.avatar,
            profileImage: friend.profileImage || friend.profilePicture || friend.avatar
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
        // If there's a toUserId, recipientId, or toUserData, it's an existing user
        const isNewUserInvite = !request.toUserId && !request.recipientId && !request.toUserData && !request.receiverData && request.type === 'email_invite';
        
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
            mobile: request.toUser?.phone || request.toPhone || request.mobile || request.phoneNumber || '',
            avatar: request.recipientAvatar || request.recipientProfilePicture || request.recipientProfileImage || '',
            profilePicture: request.recipientProfilePicture || request.recipientProfileImage || request.recipientAvatar || '',
            profileImage: request.recipientProfileImage || request.recipientProfilePicture || request.recipientAvatar || ''
          },
          status: 'pending' as const,
          balance: 0,
          createdAt: request.createdAt ? new Date(request.createdAt) : new Date(),
          requestType: 'sent', // Mark as sent request for UI
          isNewUserInvite: isNewUserInvite, // Track if this is invitation to new user
          // Add required fields for reminder functionality
          requestId: request.id, // Use the request ID for reminders
          inviteMethod: request.type || request.inviteMethod || (isNewUserInvite ? 'email' : 'push'), // Determine method from request type
          isNewUser: isNewUserInvite, // Boolean flag for new user invites
          toPhone: request.toPhone || request.mobile || request.phoneNumber || '' // Store phone for display
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
    } finally {
      isLoadingFriendsRef.current = false;
    }
  }, [user?.id, friends]); // Dependencies for useCallback

  // FIXED: Debounced wrapper for loadFriendsAndRequests to prevent multiple rapid calls
  const debouncedLoadFriends = useCallback(() => {
    if (friendsLoadTimeoutRef.current) {
      clearTimeout(friendsLoadTimeoutRef.current);
    }
    
    friendsLoadTimeoutRef.current = setTimeout(async () => {
      try {
        await loadFriendsAndRequests();
        // Also refresh notifications when friends data changes
        await loadNotifications();
      } catch (error) {
        console.error('Error in debounced friends loading:', error);
      }
      friendsLoadTimeoutRef.current = null;
    }, 500); // 500ms debounce
  }, [loadFriendsAndRequests]);

  // FIXED: Unified refresh function
  // OPTIMIZED: Memoize refresh function and reduce parallel calls
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Check for notification-triggered balance refresh flags
      console.log('💰 Checking for notification-triggered balance refresh...');
      
      // Load data sequentially to avoid overwhelming the server
      const loadedFriends = await loadFriendsAndRequests();
      const loadedGroups = await loadGroups();
      
      // Then refresh balances and other data in parallel
      await Promise.all([
        sharedBalances.forceRefresh(), // Force refresh balances
        loadRecentExpenses(loadedFriends, loadedGroups),
        loadNotifications()
      ]);
      
      console.log('✅ Complete refresh finished - all balance data updated');
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, []); // FIXED: Removed sharedBalances dependencies to prevent useInsertionEffect error

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
      // Close error modal and reset app state
      setShowFullScreenError(false);
      
      // Reset all modal states to clean up any stuck states
      setShowExportModal(false);
      setSelectedGroupForExport(null);
      setShowErrorModal(false);
      setShowAnimatedModal(false);
      setShowFullScreenSuccess(false);
      
      // Navigate back to main tab to ensure clean state
      navigation.navigate('Split' as never);
      
      console.log('App state reset completed');
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
      
      // FIXED: Since transaction limit was already checked when opening the modal,
      // we just need to increment the usage count and create the expense
      console.log('🔍 Creating expense after limit check was already passed');
      
      // Increment usage count since the expense is being created
      await subscriptionHelper.incrementTransactionUsage(user.id);
      
      await proceedWithExpenseCreation();
      
      async function proceedWithExpenseCreation() {
        // Process receipt upload if present
        let processedData = { ...expenseData };
        if (expenseData.receipt && expenseData.receipt.imageUri) {
          console.log('🔍 Processing receipt upload for expense via API...');
          try {
            const uploadResult = await apiService.uploadReceiptImage(expenseData.receipt.imageUri);
            processedData.receiptUrl = uploadResult.receiptUrl;
            console.log('✅ Receipt uploaded successfully:', uploadResult.receiptUrl);
          } catch (receiptError) {
            console.error('❌ Receipt upload failed:', receiptError);
            // Continue without receipt URL - show error to user
            Alert.alert(
              'Receipt Upload Failed',
              'The expense was created but the receipt could not be uploaded. You can try adding it later.',
              [{ text: 'OK' }]
            );
          }
          // Remove the receipt object as it's processed
          delete processedData.receipt;
        }
        
        const response = await apiService.addExpense({
          ...processedData,
          isSettled: false,
          date: new Date()
        });

        console.log('💬 API Response for expense:', JSON.stringify(response));
        const expenseId = response.id || response.expenseId || response._id || response.expense?.id || response.data?.id || `temp_${Date.now()}`;

        console.log('💬 Expense added - ID:', expenseId, 'GroupId:', processedData.groupId, 'User:', user?.fullName);

        // Create chat system message for group expenses
        if (processedData.groupId && user) {
          try {
            console.log('💬 Creating expense chat message...');
            await GroupChatService.createExpenseAddedMessage(
              processedData.groupId,
              user.id,
              user.fullName,
              {
                id: expenseId,
                description: processedData.description,
                amount: processedData.amount,
                currency: processedData.currency || 'USD',
                splitType: processedData.splitType || 'equal',
                expenseDate: processedData.date || new Date()
              }
            );
            console.log('✅ Expense chat message created');
          } catch (chatError) {
            console.error('❌ Failed to create chat message for expense:', chatError);
          }
        } else {
          console.log('⚠️ Skipping chat message - groupId:', processedData.groupId, 'user:', !!user, 'expenseId:', expenseId);
        }

        // Close modal and show success immediately (before data loading)
        setShowAddExpense(false);
        setSelectedGroupForExpense(null);

        // Show full-screen success with navigation to group details
        showFullScreenSuccessAnimation(
          'Expense Added! 🧾',
          'Expense has been added and split successfully!',
          fromGroupDetails ? `Added to ${fromGroupDetails.name}` : 'Check your groups for updates',
          fromGroupDetails ? 'View Expense' : 'Continue',
          () => {
            setShowFullScreenSuccess(false);
            if (fromGroupDetails) {
              // Open the specific group's details modal
              setSelectedGroup(fromGroupDetails);
              setShowGroupDetails(true);
            } else {
              // Navigate to groups tab to see all groups
              setActiveTab('groups');
            }
          }
        );

        // Notify all listeners about the new expense
        ExpenseRefreshService.getInstance().notifyExpenseAdded();

        // Run data refresh in background (non-blocking) after showing success
        Promise.all([
          loadGroups(),
          loadRecentExpenses(),
          // Immediate balance refresh without debounce for critical operations
          (async () => {
            console.log('🔄 EXPENSE ADDED: Forcing immediate balance refresh in background...');
            UnifiedSettlementService.clearBalanceCache();
            await sharedBalances.forceRefresh();
            notifyBalanceChange();
          })()
        ]).catch(error => {
          console.error('⚠️ Background data refresh failed:', error);
        });
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
  const handleAddFriend = async (email: string, method: 'email' | 'sms' | 'qr', contactData?: ContactData | ContactData[]) => {
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
            showAnimatedSuccess('Invitation Sent! 📧', message || 'User will receive an email invitation to join Meet-n-Split');
          } else {
            showAnimatedSuccess('Friend Request Sent! 🤝', message || 'Friend request sent successfully! They will be notified.');
          }
          
          // FIXED: Use debounced loading to prevent multiple rapid refreshes
          setTimeout(() => {
            debouncedLoadFriends();
          }, 800); // Slightly reduced delay for faster UI update
        } else {
          showAnimatedSuccess('Request Failed', message || 'Failed to send friend request', 'error');
        }
        
        setShowAddFriend(false);
      } else if (method === 'sms') {
        if (contactData) {
          const contacts = Array.isArray(contactData) ? contactData : [contactData];
          
          // For SMS invitations, we don't need to create server records
          // since these are local invitations that will be resolved when users sign up
          const contactNames = contacts.map(c => c.name || 'Friend').join(', ');
          showAnimatedSuccess(
            'Invitation Sent!', 
            `SMS invitation${contacts.length > 1 ? 's' : ''} sent to ${contactNames}. They'll appear in your friends list once they join Meet-n-Split.`
          );
          
          setShowAddFriend(false);
          
          console.log(`📱 SMS invitations sent to:`, contacts.map(c => c.name || 'Friend'));
        }
      } else if (method === 'qr') {
        // Show QR code for sharing (not scanning)
        setShowQRCode(true);
        setShowAddFriend(false);
      }
      
      // REMOVED: Duplicate notifyBalanceChange call that was causing multiple refreshes
      
    } catch (error: any) {
      console.error('Add friend error:', error);
      Alert.alert(
        'Add Friend Failed',
        error.message || 'Failed to add friend. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Create group (subscription check is done before opening modal)
  const handleCreateGroup = async (groupData: any) => {
    try {
      if (!user?.id) return;
      
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
          // Find and show the newly created group in GroupDetailsModal
          setTimeout(async () => {
            await loadGroups(); // Refresh groups to get the new one
            // Find the newly created group by ID from the response
            const groupId = response?.group?.id || response?.id;
            if (groupId) {
              try {
                console.log('🔗 Fetching created group with ID:', groupId);
                const createdGroup = await apiService.getGroup(groupId);
                if (createdGroup) {
                  console.log('✅ Opening GroupDetailsModal for created group:', createdGroup.name);
                  setSelectedGroup(createdGroup);
                  setShowGroupDetails(true);
                  setActiveTab('groups'); // Also switch to groups tab for context
                } else {
                  console.warn('❌ Created group not found, falling back to groups tab');
                  setActiveTab('groups');
                }
              } catch (error) {
                console.error('Error fetching created group:', error);
                // Fallback to groups tab
                setActiveTab('groups');
              }
            } else {
              console.warn('❌ No group ID in response, falling back to groups tab');
              console.log('Response structure:', response);
              // Fallback to groups tab
              setActiveTab('groups');
            }
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
      setAnalyticsLoading(true);
      try {
        // Generate splitting analytics from current data
        const splittingAnalytics = generateSplittingAnalytics();
        setAnalyticsData(splittingAnalytics);
      } catch (error) {
        console.log('Error generating splitting analytics, showing empty state');
        // Create empty splitting analytics for errors
        const emptySplittingAnalytics = {
          userId: user.id,
          period: 'month' as const,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          totalSpent: 0,
          totalOwed: 0,
          totalOwing: 0,
          netBalance: 0,
          groupAnalytics: [],
          categoryBreakdown: [],
          monthlyTrends: [],
          friendAnalytics: [],
          insights: [],
          lastUpdated: new Date()
        };
        setAnalyticsData(emptySplittingAnalytics);
      } finally {
        setAnalyticsLoading(false);
      }
      setShowAnalytics(true);
    }
  };

  // Helper function to generate splitting analytics from current app data
  const generateSplittingAnalytics = () => {
    const now = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Calculate totals from shared balances
    const totalOwed = sharedBalances.totalOwed || 0;
    const totalOwing = sharedBalances.totalOwing || 0;
    const netBalance = sharedBalances.netBalance || 0;

    // Calculate total spent from recent expenses
    const totalSpent = expenses.reduce((sum, expense) => {
      // Only count expenses where current user paid
      return expense.paidBy === user?.id ? sum + expense.amount : sum;
    }, 0);

    // Generate group analytics
    const groupAnalytics = groups.map(group => {
      const groupExpenseTotal = expenses
        .filter(expense => expense.groupId === group.id)
        .reduce((sum, expense) => sum + expense.amount, 0);

      // Get user's balance for this group from shared balances
      let userBalance = 0;
      if (allBalances) {
        for (const detail of allBalances) {
          if (detail.groupId === group.id || (detail.breakdown?.fromGroups && detail.breakdown.fromGroups[group.id])) {
            if (detail.groupId === group.id) {
              userBalance += detail.balance;
            } else if (detail.breakdown?.fromGroups?.[group.id]) {
              userBalance += detail.breakdown.fromGroups[group.id].balance;
            }
          }
        }
      }

      return {
        groupName: group.name,
        totalSpent: groupExpenseTotal,
        memberCount: getActiveMemberCount(group.members),
        userBalance: userBalance
      };
    });

    // Generate category breakdown from expenses
    const categoryMap: { [key: string]: { amount: number; count: number; icon: string } } = {};
    expenses.forEach(expense => {
      if (expense.paidBy === user?.id) {
        if (!categoryMap[expense.category]) {
          categoryMap[expense.category] = {
            amount: 0,
            count: 0,
            icon: expense.categoryIcon || '💰'
          };
        }
        categoryMap[expense.category].amount += expense.amount;
        categoryMap[expense.category].count += 1;
      }
    });

    const totalCategorySpent = Object.values(categoryMap).reduce((sum, cat) => sum + cat.amount, 0);
    const categoryBreakdown = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalCategorySpent > 0 ? (data.amount / totalCategorySpent) * 100 : 0,
      count: data.count,
      icon: data.icon,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    })).sort((a, b) => b.amount - a.amount);

    // Generate friend analytics
    const friendAnalytics = friends.filter(f => f.status === 'accepted').map(friend => {
      const sharedExpenses = expenses.filter(expense => 
        expense.splitData?.some(split => split.userId === friend.friendId) ||
        expense.paidBy === friend.friendId
      );

      const totalShared = sharedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      return {
        friendName: friend.friendData.fullName,
        totalShared,
        currentBalance: friend.balance || 0,
        expenseCount: sharedExpenses.length
      };
    }).filter(f => f.expenseCount > 0);

    // Generate monthly trends (simplified)
    const monthlyTrends = [
      {
        month: 'This Month',
        spent: totalSpent,
        settled: Math.abs(totalOwed - totalOwing)
      }
    ];

    // Generate insights
    const insights = [];
    if (totalOwed > totalOwing) {
      insights.push({
        type: 'settlement' as const,
        title: 'You\'re in the green! 💚',
        description: `You're owed ${getCurrencySymbol(user?.currency || 'USD')}${(totalOwed - totalOwing).toFixed(2)} more than you owe. Consider collecting from friends.`,
        icon: '💰'
      });
    } else if (totalOwing > totalOwed) {
      insights.push({
        type: 'settlement' as const,
        title: 'Time to settle up! 💳',
        description: `You owe ${getCurrencySymbol(user?.currency || 'USD')}${(totalOwing - totalOwed).toFixed(2)} more than you're owed. Consider making payments.`,
        icon: '💸'
      });
    }

    if (groupAnalytics.length > 0) {
      const mostActiveGroup = groupAnalytics.reduce((max, group) => 
        group.totalSpent > max.totalSpent ? group : max
      );
      insights.push({
        type: 'spending' as const,
        title: 'Most Active Group 👥',
        description: `"${mostActiveGroup.groupName}" has $${mostActiveGroup.totalSpent.toLocaleString()} in total expenses.`,
        icon: '📊'
      });
    }

    return {
      userId: user?.id || '',
      period: 'month' as const,
      startDate,
      endDate: now,
      totalSpent,
      totalOwed,
      totalOwing,
      netBalance,
      groupAnalytics,
      categoryBreakdown,
      monthlyTrends,
      friendAnalytics,
      insights,
      lastUpdated: now
    };
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

  // FIXED: Expense update with balance notification
  const handleExpenseUpdate = async (expenseData: any) => {
    try {
      if (!user?.id) return;
      
      console.log('🔄 Updating expense with data:', expenseData);
      
      await apiService.updateExpense(expenseData.id, expenseData);
      console.log('✅ Expense updated successfully in database');
      
      // FIXED: Clear settlement cache when expense is updated
      UnifiedSettlementService.clearBalanceCache();
      
      ExpenseRefreshService.getInstance().notifyExpenseAdded();
      
      await Promise.all([
        loadGroups(),
        loadRecentExpenses()
      ]);
      
      // FIXED: Immediate balance refresh for expense updates
      console.log('🔄 EXPENSE UPDATED: Forcing immediate balance refresh...');
      await sharedBalances.forceRefresh();
      
      // Also trigger the regular notification for other components
      notifyBalanceChange();
      
      console.log('✅ Local data refreshed after expense update');
      
    } catch (error: any) {
      console.error('❌ Update expense error:', error);
      throw error;
    }
  };

  // Handle various friend and group actions (keep existing implementations but add balance notifications)
  const handleExpenseDetailFromOverview = (expense: Expense) => {
    setSelectedExpenseForDetail(expense);
    setShowExpenseDetail(true);
  };

  // New function for pending friend actions
  const showPendingFriendActionsMenu = (friend: Friend) => {
    // Check if this is a received friend request (user can accept/decline)
    if (friend.requestType === 'received' && friend.status === 'pending_incoming') {
      // Open FriendRequestModal for received invites
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

  // Function to handle resending invitations - SIMPLIFIED: Auto-send without dialogs
  const handleResendInvitation = async (friend: Friend) => {
    try {
      if (!user?.id) return;
      
      console.log('🔄 Resending invitation:', {
        friendId: friend.id,
        friendName: friend.friendData.fullName,
        inviteMethod: friend.inviteMethod,
        requestId: friend.requestId,
        isNewUser: friend.isNewUser,
        fullFriendObject: friend
      });
      
      if (friend.isNewUser || friend.type === 'email_invite') {
        // For new users - try to send email reminder, fallback to message if no request ID
        if (friend.requestId) {
          await handleSendFriendRequestReminder(friend, 'auto');
        } else {
          Alert.alert(
            'Invite Pending',
            `${friend.friendData.fullName || friend.friendData.email} hasn't joined Meet-n-Split yet. They'll appear as your friend once they sign up and accept your invitation.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        // For existing users - automatically send smart reminder
        await handleSendFriendRequestReminder(friend, 'auto');
      }
      
      // Refresh friends data
      notifyBalanceChange();
      
    } catch (error: any) {
      console.error('Failed to resend invitation:', error);
      Alert.alert('Error', error.message || 'Failed to resend invitation');
    }
  };

  // Function to handle sending friend request reminders
  const handleSendFriendRequestReminder = async (friend: Friend, method: 'auto' | 'push' | 'email' | 'sms') => {
    try {
      // Try to find requestId from different possible sources
      let requestId = friend.requestId || friend.id;

      // If still no requestId, try to get it from the friend object structure
      if (!requestId && typeof friend === 'object') {
        // Check if this is a pending friend request object
        if ('requestType' in friend && friend.requestType === 'sent') {
          requestId = friend.id;
        }
      }

      if (!requestId) {
        console.error('❌ No friend request ID found for:', friend);
        Alert.alert('Error', 'Unable to send reminder - friend request ID not found. Please try refreshing the page.');
        return;
      }

      console.log('📤 Sending friend request reminder:', {
        requestId,
        method,
        friendName: friend.friendData.fullName,
        friendStatus: friend.status,
        friendRequestType: friend.requestType
      });

      const response = await apiService.sendFriendRequestReminder(requestId, method);
      
      console.log('📥 Reminder API response:', {
        success: response.success,
        data: response.data,
        message: response.message,
        fullResponse: response
      });
      
      if (response.success) {
        let successMessage = 'Reminder sent successfully!';
        
        if (response.data) {
          const { method: actualMethod, isUserRegistered, originalInviteMethod, recipient } = response.data;
          
          if (isUserRegistered) {
            successMessage = `✅ Reminder sent via ${actualMethod} to ${friend.friendData.fullName}`;
            if (actualMethod === 'push') {
              successMessage += ' (app notification)';
            } else if (actualMethod === 'email') {
              successMessage += ' (email)';
            } else if (actualMethod === 'sms') {
              successMessage += ' (text message)';
            }
          } else {
            successMessage = `✅ Invitation sent via ${actualMethod} to ${recipient}`;
            successMessage += `\n\n${friend.friendData.fullName} will receive your friend request once they join Meet-n-Split!`;
          }
          
          if (originalInviteMethod && originalInviteMethod !== actualMethod) {
            successMessage += `\n\n📝 Note: Originally invited via ${originalInviteMethod}`;
          }
        }
        
        Alert.alert('Reminder Sent', successMessage);
      } else {
        // Handle specific error cases
        if (response.message?.includes('no longer pending') || response.message?.includes('already accepted')) {
          // Friend request was already accepted - refresh the list
          Alert.alert(
            'Already Friends!',
            `You're already friends with ${friend.friendData.fullName}. Refreshing your friends list...`,
            [{
              text: 'OK',
              onPress: () => {
                // Force refresh friends data
                notifyBalanceChange();
              }
            }]
          );
        } else if (response.isUnregistered && response.availableMethods) {
          // Handle case where user isn't registered yet
          const methods = response.availableMethods.join(', ');
          Alert.alert(
            'User Not Registered',
            `${friend.friendData.fullName} hasn't installed Meet-n-Split yet.\n\nAvailable reminder methods: ${methods}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Failed', response.message || 'Failed to send reminder');
        }
      }

      // Refresh friends data
      notifyBalanceChange();

    } catch (error: any) {
      console.error('Failed to send friend request reminder:', error);

      // Handle specific error message for already accepted requests
      if (error.message?.includes('no longer pending') || error.message?.includes('already accepted')) {
        Alert.alert(
          'Friend Request Status Changed',
          `The friend request to ${friend.friendData.fullName} may have been accepted or is no longer pending. Please refresh your friends list to see the latest status.`,
          [{
            text: 'Refresh Now',
            onPress: () => {
              // Force refresh friends data
              notifyBalanceChange();
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }]
        );
      } else if (error.message?.includes('not found')) {
        Alert.alert(
          'Friend Request Not Found',
          `The friend request could not be found. It may have been cancelled or accepted. Refreshing your friends list...`,
          [{
            text: 'OK',
            onPress: () => {
              notifyBalanceChange();
            }
          }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to send friend request reminder');
      }
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
                console.log('🗑️ Canceling invitation for friend:', {
                  friendId: friend.friendId,
                  requestId: friend.requestId,
                  name: friend.friendData.fullName
                });
                
                if (friend.requestId) {
                  // For existing Meet-n-Split users, delete the friend request
                  console.log('📡 Calling API to decline friend request:', friend.requestId);
                  await apiService.declineFriendRequest(friend.requestId);
                  console.log('✅ API call successful, friend request cancelled');
                  showAnimatedSuccess(
                    'Request Cancelled',
                    `Friend request to ${friend.friendData.fullName} has been cancelled.`
                  );
                } else {
                  // For new user invites, just remove from local state
                  console.log('⚠️ No requestId found, treating as local invite');
                  showAnimatedSuccess(
                    'Invitation Cancelled',
                    `Invitation to ${friend.friendData.fullName} has been cancelled.`
                  );
                }
                
                console.log('🔄 Invitation cancelled, notifying balance change...');
                notifyBalanceChange();
                console.log('✅ Friend request cancelled successfully');
              } catch (error: any) {
                console.error('❌ Failed to cancel invitation:', error);
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* FIXED: Use unified balance data */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Your Balance</Text>
          </View>

          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                <Text>{getCurrencySymbol(user?.currency || 'USD')}</Text><Text>{(totalOwed || 0).toFixed(2)}</Text>
              </Text>
              <Text style={styles.balanceLabel}>You're owed</Text>
            </View>
            
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                <Text>{getCurrencySymbol(user?.currency || 'USD')}</Text><Text>{(totalOwing || 0).toFixed(2)}</Text>
              </Text>
              <Text style={styles.balanceLabel}>You owe</Text>
            </View>
            
            <View style={styles.balanceItem}>
              <Text 
                style={[
                  styles.balanceAmount, 
                  { color: (netBalance || 0) >= 0 ? '#10B981' : '#F97316' }
                ]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                <Text>{(netBalance || 0) >= 0 ? '+' : '-'}</Text><Text>{getCurrencySymbol(user?.currency || 'USD')}</Text><Text>{Math.abs(netBalance || 0).toFixed(2)}</Text>
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
            style={[styles.modernActionCard, { backgroundColor: theme.colors.surface }]}
            onPress={async () => {
              console.log('💰 Split Expense button pressed');
              if (!user?.id) {
                console.log('❌ No user ID found');
                return;
              }
              console.log('🔍 Checking transaction limit for user:', user.id);
              const canCreate = await subscriptionHelper.canCreateTransaction(user.id);
              console.log('📊 Can create transaction?', canCreate);
              if (canCreate) {
                console.log('✅ Opening AddExpenseModal');
                setShowAddExpense(true);
              } else {
                console.log('🚫 Transaction limit reached, modal should be showing');
              }
            }}
          >
            <Icon name="add" size={20} color={theme.colors.brand} />
            <Text style={[styles.modernActionTitle, { color: theme.colors.text, fontSize: 12 }]}>Split Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modernActionCard, { backgroundColor: theme.colors.surface }]}
            onPress={async () => {
              if (!user?.id) return;
              const canCreate = await subscriptionHelper.checkGroupCreationLimit(user.id);
              if (canCreate) {
                setShowCreateGroup(true);
              }
            }}
          >
            <Icon name="people" size={20} color={theme.colors.brand} />
            <Text style={[styles.modernActionTitle, { color: theme.colors.text, fontSize: 12 }]}> Create Groups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modernActionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowAddFriend(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Icon name="people" size={16} color={theme.colors.brand} />
              <View style={{ 
                position: 'absolute', 
                top: -6, 
                right: -6, 
                backgroundColor: theme.colors.brand, 
                borderRadius: 8, 
                width: 14, 
                height: 14, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Icon name="add" size={10} color="white" />
              </View>
            </View>
            <Text style={[styles.modernActionTitle, { color: theme.colors.text, fontSize: 12 }]}>Add Friend</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modernActionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => openSettlementScreen({ filter: 'all' })}
          >
            <Icon name="cash" size={20} color={theme.colors.brand} />
            <Text style={[styles.modernActionTitle, { color: theme.colors.text, fontSize: 12 }]}>Settle Expenses</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modernActionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => {
              setExpenseListTitle('All Expenses');
              setShowSimpleExpenseList(true);
            }}
          >
            <Icon name="receipt" size={20} color={theme.colors.brand} />
            <Text style={[styles.modernActionTitle, { color: theme.colors.text, fontSize: 12 }]}>View All Expenses</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modernActionCard, { backgroundColor: theme.colors.surface }]}
            onPress={handleAnalyticsAccess}
          >
            <Icon name="analytics" size={20} color={theme.colors.brand} />
            <Text style={[styles.modernActionTitle, { color: theme.colors.text, fontSize: 12 }]}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Expenses - keep existing */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity onPress={navigateToExpenses} style={styles.viewAllButton}>
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
                <Icon name="forward" size={16} color={theme.colors.primary}  />
              </TouchableOpacity>
            </View>
          </View>
         
          {(() => {
            console.log('🔍 Overview expenses rendering: length =', expenses.length);
            return expenses.length === 0;
          })() ? (
            <TouchableOpacity 
              style={styles.emptyStateContainer}
              onPress={async () => {
                if (!user?.id) return;
                const canCreate = await subscriptionHelper.canCreateTransaction(user.id);
                if (canCreate) {
                  setShowAddExpense(true);
                }
              }}
              activeOpacity={0.7}
            >
              <Icon name="receipt" size={40} color={theme.colors.textSecondary}  />
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
                  onPress={() => handleExpenseDetailFromOverview(expense)}
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
                        <Text>Paid by </Text><Text>{expense.paidByData?.fullName || (expense.paidBy === user?.id ? 'You' : 'Unknown')}</Text>
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

                  {/* Right: Amount and Receipt Indicator */}
                  <View style={styles.expenseCardAmount}>
                    <Text style={[styles.expenseCardAmountText, { color: theme.colors.text }]}>
                      <Text>{getCurrencySymbol(user?.currency || 'USD')}</Text><Text>{expense.amount.toFixed(2)}</Text>
                    </Text>
                    
                    {/* Receipt Indicator */}
                    {expense.receiptUrl && (
                      <View style={styles.receiptIndicator}>
                        <Icon name="document" size={12} color={theme.colors.primary} />
                      </View>
                    )}
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
                <Icon name="refresh" size={16} color={theme.colors.primary}  />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddFriend(true)} style={styles.addButton}>
                <View style={{ position: 'relative' }}>
                  <Icon name="people" size={16} color={theme.colors.primary} />
                  <View style={{ 
                    position: 'absolute', 
                    top: -4, 
                    right: -4, 
                    backgroundColor: theme.colors.primary, 
                    borderRadius: 6, 
                    width: 10, 
                    height: 10, 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <Icon name="add" size={7} color="white" />
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleTabSwitch('friends')} style={styles.viewAllButton}>
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
                <Icon name="forward" size={16} color={theme.colors.primary}  />
              </TouchableOpacity>
            </View>
          </View>
          
          {sharedBalances.allBalances.length === 0 && friends.filter(f => f.status === 'accepted').length === 0 ? (
            <TouchableOpacity 
              style={styles.emptyStateContainer}
              onPress={() => setShowAddFriend(true)}
              activeOpacity={0.7}
            >
              <Icon name="people" size={40} color={theme.colors.textSecondary}  />
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
                    {(() => {
                      const avatarUri = detail.friend?.friendData?.profilePicture || 
                                       detail.friend?.friendData?.profileImage || 
                                       detail.friend?.friendData?.avatar;
                      
                      const hasValidAvatar = avatarUri && 
                        avatarUri.trim() !== '' && 
                        !avatarUri.startsWith('file://') && 
                        (avatarUri.startsWith('http') || 
                         avatarUri.startsWith('https://') ||
                         avatarUri.includes('firebasestorage.googleapis.com'));
                      
                      if (hasValidAvatar) {
                        return (
                          <Image 
                            source={{ uri: avatarUri }} 
                            style={styles.friendIconImage}
                            resizeMode="cover"
                            onError={() => {
                              console.log('❌ Overview friend avatar failed to load for:', detail.name);
                            }}
                          />
                        );
                      } else {
                        return (
                          <Text style={styles.friendIconText}>
                            {(detail.name || 'Unknown').charAt(0).toUpperCase()}
                          </Text>
                        );
                      }
                    })()}
                    {detail.source === 'group' && (
                      <View style={[styles.groupIndicator, { backgroundColor: theme.colors.primary + '20' }]}>
                        <Icon name="people" size={10} color={theme.colors.primary}  />
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
                        <Icon name="success" size={16} color={theme.colors.textSecondary}  />
                        <Text style={[styles.friendCardRowBalanceText, { color: theme.colors.textSecondary }]}>
                          Settled
                        </Text>
                      </>
                    ) : detail.balance > 0 ? (
                      <>
                        <Text style={[styles.friendCardRowBalanceText, { color: theme.colors.success }]}>
                          <Text>+</Text><Text>{getCurrencySymbol(user?.currency || 'USD')}</Text><Text>{(detail.balance || 0).toFixed(2)}</Text>
                        </Text>
                        <Icon name="arrowUp" size={16} color={theme.colors.success} />
                      </>
                    ) : (
                      <>
                        <Text style={[styles.friendCardRowBalanceText, { color: theme.colors.error }]}>
                          <Text>{getCurrencySymbol(user?.currency || 'USD')}</Text><Text>{Math.abs(detail.balance).toFixed(2)}</Text>
                        </Text>
                        <Icon name="arrowDown" size={16} color={theme.colors.error} />
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Simplified header with clean action buttons */}
        <View style={styles.cleanTabHeader}>
          <View style={styles.headerTitleSection}>
            <Text style={[styles.cleanTabTitle, { color: theme.colors.text }]}>Friends</Text>
            <Text style={[styles.cleanTabSubtitle, { color: theme.colors.textSecondary }]}>
              <Text>{(acceptedFriends?.length || 0)}</Text><Text> active • </Text><Text>{(invitedFriends?.length || 0)}</Text><Text> pending</Text>
            </Text>
          </View>
          <View style={styles.cleanHeaderActions}>
            <TouchableOpacity 
              onPress={() => sharedBalances.refresh()} 
              style={[styles.cleanActionButton, { backgroundColor: theme.colors.surface }]}
            >
              <Icon name="refresh" size={18} color={theme.colors.primary}  />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cleanActionButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowAddFriend(true)}
            >
              <Icon name="add" size={20} color="white" />
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
                {(settlementBalances?.length || 0)}
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
                <Text>{(invitedFriends?.length || 0)}</Text>
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {activeFriendsTab === 'accepted' ? (
          // Clean Accepted Friends Design
          acceptedFriends.length === 0 ? (
            <View style={[styles.cleanEmptyState, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.cleanEmptyIcon, { backgroundColor: `${theme.colors.primary}10` }]}>
                <Icon name="people" size={32} color={theme.colors.primary}  />
              </View>
              <Text style={[styles.cleanEmptyTitle, { color: theme.colors.text }]}>No friends yet</Text>
              <Text style={[styles.cleanEmptySubtitle, { color: theme.colors.textSecondary }]}>
                Add friends to start splitting expenses together
              </Text>
            </View>
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={styles.friendCardsList}
            >
              {/* Show accepted friends with sorting: green amounts first, then red amounts, settled at end */}
              {acceptedFriends
                .map((friend, index) => {
                  // Get balance from settlementBalances (which has breakdown info)
                  const balanceEntry = settlementBalances.find(b => b.userId === friend.friendId);
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
                  
                  return {
                    friend,
                    balance,
                    friendName,
                    friendInitial,
                    entryKey,
                    isSettled,
                    owesYou,
                    youOwe,
                    amount,
                    balanceEntry
                  };
                })
                .sort((a, b) => {
                  // Sort priority: 1) Green amounts (owes you) - highest first, 2) Red amounts (you owe) - lowest first, 3) Settled
                  if (a.isSettled && !b.isSettled) return 1; // Settled goes to end
                  if (!a.isSettled && b.isSettled) return -1;
                  if (a.isSettled && b.isSettled) return 0; // Both settled, maintain order
                  
                  if (a.owesYou && !b.owesYou) return -1; // Green amounts first
                  if (!a.owesYou && b.owesYou) return 1;
                  
                  if (a.owesYou && b.owesYou) {
                    return b.amount - a.amount; // Higher green amounts first
                  }
                  
                  if (a.youOwe && b.youOwe) {
                    return a.amount - b.amount; // Lower red amounts first
                  }
                  
                  return 0;
                })
                .map(({ friend, balance, friendName, friendInitial, entryKey, isSettled, owesYou, youOwe, amount, balanceEntry }) => (
                  <TouchableOpacity
                    key={entryKey}
                    style={styles.simpleFriendItem}
                    onLongPress={() => showFriendActionsMenu(friend)}
                    delayLongPress={500}
                    activeOpacity={0.7}
                  >
                    {/* Main row: Avatar, Name, and Status */}
                    <View style={styles.simpleFriendMainRow}>
                      {/* Left side: Avatar and Name */}
                      <View style={styles.simpleFriendLeft}>
                        <View style={[styles.simpleFriendAvatar, { 
                          backgroundColor: isSettled ? '#E5E7EB' : (owesYou ? theme.colors.success : theme.colors.error)
                        }]}>
                          {(() => {
                            const avatarUri = friend.friendData?.avatar || friend.friendData?.profilePicture || friend.friendData?.profileImage;
                            console.log('🖼️ Friend avatar debug:', { 
                              friendName, 
                              avatarUri, 
                              hasAvatar: !!avatarUri,
                              isLocalFile: avatarUri?.startsWith('file://'),
                              isHttpUrl: avatarUri?.startsWith('http'),
                              friendData: friend.friendData 
                            });
                            
                            // Check if we have a valid avatar URI that's not a local file
                            const hasValidAvatar = avatarUri && 
                              avatarUri.trim() !== '' && 
                              !avatarUri.startsWith('file://') && 
                              (avatarUri.startsWith('http') || 
                               avatarUri.startsWith('https://') ||
                               avatarUri.includes('firebasestorage.googleapis.com'));
                            
                            if (hasValidAvatar) {
                              return (
                                <>
                                  <Image 
                                    source={{ uri: avatarUri }} 
                                    style={styles.simpleFriendAvatarImage}
                                    onError={(error) => {
                                      console.log('❌ Friend avatar failed to load:', error.nativeEvent?.error, 'for friend:', friendName, 'URI:', avatarUri);
                                    }}
                                    onLoad={() => {
                                      console.log('✅ Friend avatar loaded successfully for:', friendName);
                                    }}
                                    resizeMode="cover"
                                  />
                                  <Text style={[styles.simpleFriendAvatarText, { opacity: 0 }]}>{friendInitial}</Text>
                                </>
                              );
                            } else {
                              // Show initials - either no avatar or local file that can't be displayed
                              if (avatarUri?.startsWith('file://')) {
                                console.log('⚠️ Skipping local file avatar for:', friendName, 'URI:', avatarUri);
                              }
                              return (
                                <Text style={styles.simpleFriendAvatarText}>{friendInitial}</Text>
                              );
                            }
                          })()}
                        </View>
                        <Text style={[styles.simpleFriendName, { color: theme.colors.text }]}>
                          {friendName}
                        </Text>
                      </View>

                      {/* Right side: Status indicator */}
                      <View style={styles.simpleFriendRight}>
                        {isSettled ? (
                          <View style={styles.simpleFriendSettledContainer}>
                            <Icon name="check" size={16} color={theme.colors.success} />
                            <Text style={[styles.simpleFriendSettledText, { color: theme.colors.textSecondary }]}>
                              All settled
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.simpleFriendAmountContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <View>
                                <Text style={[styles.simpleFriendAmountLabel, {
                                  color: owesYou ? theme.colors.success : theme.colors.error
                                }]}>
                                  {owesYou ? 'owes you' : 'you owe'}
                                </Text>
                                <Text style={[styles.simpleFriendAmount, {
                                  color: owesYou ? theme.colors.success : theme.colors.error
                                }]}>
                                  {getCurrencySymbol(user?.currency || 'USD')}{amount.toFixed(2)}
                                </Text>
                              </View>
                              {(() => {
                                // Debug log to see breakdown data
                                console.log(`🔍 Rendering info icon check for ${friendName}:`, {
                                  hasBalanceEntry: !!balanceEntry,
                                  hasBreakdown: !!balanceEntry?.breakdown,
                                  hasEntries: !!balanceEntry?.breakdown?.entries,
                                  entriesLength: balanceEntry?.breakdown?.entries?.length,
                                  shouldShowIcon: !!(balanceEntry?.breakdown?.entries && balanceEntry.breakdown.entries.length > 1)
                                });

                                if (balanceEntry?.breakdown?.entries && balanceEntry.breakdown.entries.length > 1) {
                                  console.log(`✅ RENDERING INFO ICON for ${friendName}`);
                                  return (
                                    <TouchableOpacity
                                      style={{
                                        marginLeft: 6,
                                        padding: 2
                                      }}
                                      onPress={() => {
                                        console.log('ℹ️ Info icon clicked for:', friendName);
                                        const breakdown = balanceEntry.breakdown.entries
                                          .map((e: any) => `${e.groupName}: ${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(e.balance).toFixed(2)} ${e.balance > 0 ? 'owed to you' : 'you owe'}`)
                                          .join('\n');
                                        Alert.alert(
                                          `Balance with ${friendName}`,
                                          `Net: ${getCurrencySymbol(user?.currency || 'USD')}${amount.toFixed(2)} ${owesYou ? 'owed to you' : 'you owe'}\n\nBreakdown:\n${breakdown}\n\nTip: Click "Settle up" to see all settlements across groups.`,
                                          [{ text: 'Got it' }]
                                        );
                                      }}
                                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                      <Icon name="information" size={16} color={theme.colors.textSecondary} />
                                    </TouchableOpacity>
                                  );
                                } else {
                                  console.log(`❌ NOT rendering info icon for ${friendName} - condition not met`);
                                  return null;
                                }
                              })()}
                            </View>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Action buttons - only show for unsettled friends */}
                    {!isSettled && (
                      <View style={styles.simpleFriendActions}>
                        <TouchableOpacity
                          style={[styles.simpleFriendButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                          onPress={() => showFriendActionsMenu(friend)}
                        >
                          <Text style={[styles.simpleFriendButtonText, { color: theme.colors.text }]}>
                            Remind...
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.simpleFriendButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                          onPress={() => {
                            // Check if friend appears in multiple groups via breakdown
                            console.log('🔘 Settle button clicked for:', friendName);
                            console.log('📊 Balance entry:', {
                              hasBreakdown: !!balanceEntry?.breakdown,
                              entriesCount: balanceEntry?.breakdown?.entries?.length,
                              groupId: balanceEntry?.groupId,
                              source: balanceEntry?.source
                            });

                            if (balanceEntry?.breakdown?.entries && balanceEntry.breakdown.entries.length > 1) {
                              // Friend in multiple groups - show all settlements
                              console.log('➡️ Opening ALL settlements (multiple groups)');
                              openSettlementScreen({
                                filter: 'all',
                                friendId: friend.friendId
                              });
                            } else if (balanceEntry?.groupId) {
                              // Friend in single group
                              console.log('➡️ Opening SINGLE group settlement:', balanceEntry.groupId);
                              openSettlementScreen({
                                filter: 'groups',
                                groupId: balanceEntry.groupId,
                                friendId: friend.friendId
                              });
                            } else {
                              // Direct friend (no groups)
                              console.log('➡️ Opening FRIEND-only settlement');
                              openSettlementScreen({
                                filter: 'friends',
                                friendId: friend.friendId
                              });
                            }
                          }}
                        >
                          <Text style={[styles.simpleFriendButtonText, { color: theme.colors.text }]}>
                            Settle up
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )
        ) : (
          // Clean Pending Invitations Design
          invitedFriends.length === 0 ? (
            <View style={[styles.cleanEmptyState, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.cleanEmptyIcon, { backgroundColor: `${theme.colors.warning}15` }]}>
                <Icon name="mail" size={32} color={theme.colors.warning}  />
              </View>
              <Text style={[styles.cleanEmptyTitle, { color: theme.colors.text }]}>No pending invitations</Text>
              <Text style={[styles.cleanEmptySubtitle, { color: theme.colors.textSecondary }]}>
                Friend invitations will appear here
              </Text>
            </View>
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={styles.friendCardsList}
            >
              {invitedFriends.map((friend, index) => {
                // Determine if this is a received friend request or sent invitation
                const isReceivedRequest = friend.requestType === 'received' && friend.status === 'pending_incoming';
                const isSentRequest = !isReceivedRequest && (friend.status === 'pending' || friend.status === 'invited');
                // Check for name, email, or full phone number
                const friendName = friend.friendData?.fullName ||
                                   friend.friendData?.email ||
                                   (friend.friendData as any)?.mobile ||
                                   (friend.friendData as any)?.phone ||
                                   (friend.friendData as any)?.phoneNumber ||
                                   (friend as any)?.toPhone ||
                                   'Unknown Friend';
                const friendInitial = friendName && typeof friendName === 'string' ? friendName.charAt(0).toUpperCase() : '?';
                
                return (
                  <TouchableOpacity
                    key={`invited-${friend.id}-${index}`}
                    style={[styles.friendCardRow, { backgroundColor: theme.colors.background }]}
                    onPress={() => showPendingFriendActionsMenu(friend)}
                  >
                    {/* Left: Friend Avatar */}
                    <View style={[styles.friendIconContainer, { 
                      backgroundColor: isReceivedRequest ? theme.colors.success : theme.colors.warning 
                    }]}>
                      {(() => {
                        const avatarUri = friend.friendData?.avatar || friend.friendData?.profilePicture || friend.friendData?.profileImage;
                        
                        const hasValidAvatar = avatarUri && 
                          avatarUri.trim() !== '' && 
                          !avatarUri.startsWith('file://') && 
                          (avatarUri.startsWith('http') || 
                           avatarUri.startsWith('https://') ||
                           avatarUri.includes('firebasestorage.googleapis.com'));
                        
                        if (hasValidAvatar) {
                          return (
                            <Image 
                              source={{ uri: avatarUri }} 
                              style={styles.friendIconImage}
                              resizeMode="cover"
                              onError={() => {
                                console.log('❌ Pending friend avatar failed to load for:', friendName);
                              }}
                            />
                          );
                        } else {
                          return (
                            <Text style={styles.friendIconText}>{friendInitial}</Text>
                          );
                        }
                      })()}
                    </View>

                    {/* Center: Friend Details */}
                    <View style={styles.friendCardRowDetails}>
                      <Text style={[styles.friendCardRowName, { color: theme.colors.text }]} numberOfLines={1}>
                        {friendName}
                      </Text>
                      <View style={styles.friendCardRowMeta}>
                        <Text style={[styles.friendCardRowSource, { 
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

                    {/* Right: Action Button */}
                    <View style={styles.friendCardRowBalance}>
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
                          <Icon name="mail" size={16} color="white" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.cleanActionButton, { backgroundColor: theme.colors.primary }]}
                          onPress={() => handleResendInvitation(friend)}
                        >
                          <Icon name="send" size={16} color="white"  />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
            style={[styles.headerButton, { backgroundColor: theme.colors.primary, marginRight: 8 }]}
            onPress={() => setShowJoinGroup(true)}
          >
            <Icon name="enter" size={18} color="white"  />
            <Text style={styles.headerButtonText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
            onPress={async () => {
              if (!user?.id) return;
              const canCreate = await subscriptionHelper.checkGroupCreationLimit(user.id);
              if (canCreate) {
                setShowCreateGroup(true);
              }
            }}
          >
            <Icon name="add" size={18} color="white"  />
            <Text style={styles.headerButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {groups.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
          <Icon name="people" size={64} color={theme.colors.textSecondary}  />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Groups Yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Create a group to start splitting expenses with friends
          </Text>
          <TouchableOpacity
            style={[styles.addFirstGroupButton, { backgroundColor: theme.colors.primary }]}
            onPress={async () => {
              if (!user?.id) return;
              const canCreate = await subscriptionHelper.checkGroupCreationLimit(user.id);
              if (canCreate) {
                setShowCreateGroup(true);
              }
            }}
          >
            <Text style={styles.addFirstGroupText}>Create Your First Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        groups.map((group) => {
          // Use individual per-group balance (not aggregated)
          const groupBalance = groupBalances[group.id] || 0;

          const userShare = Math.abs(groupBalance || 0);
          const shareStatus = Math.abs(groupBalance) < 0.01 ? 'settled' : (groupBalance > 0 ? 'owed' : 'owes');

          // Debug logging for group card display
          console.log(`🏷️  Rendering group card: ${group.name}`);
          console.log(`💳 Group individual balance: ${groupBalance}`);
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
                        {getActiveMemberCount(group.members)} members
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
                    <Icon name="download" size={20} color={theme.colors.textSecondary}  />
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
                    <Icon name="qrCode" size={20} color={theme.colors.textSecondary}  />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.groupStats}>
                <View style={styles.groupStat}>
                  <Text style={[styles.groupStatLabel, { color: theme.colors.textSecondary }]}>
                    Total spent
                  </Text>
                  <Text style={[styles.groupStatValue, { color: theme.colors.text }]}>
                    <Text>{getCurrencySymbol(user?.currency || 'USD')}</Text><Text>{(((group as any).totalExpenses || 0)).toFixed(2)}</Text>
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
                    {shareStatus === 'settled' ? '✓' : `${getCurrencySymbol(user?.currency || 'USD')}${(userShare || 0).toFixed(2)}`}
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
                  <Icon name="eye" size={16} color={theme.colors.primary}  />
                  <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>View Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleGroupChatAccess(group);
                  }}
                  style={[styles.actionButton, { backgroundColor: theme.colors.primary + '20' }]}
                >
                  <View>
                    <Icon name="chatbubble" size={16} color={theme.colors.primary} />
                    {groupUnreadCounts[group.id] > 0 && (
                      <View style={styles.chatBadge}>
                        <Text style={styles.chatBadgeText}>
                          {groupUnreadCounts[group.id] > 99 ? '99+' : groupUnreadCounts[group.id]}
                        </Text>
                      </View>
                    )}
                  </View>
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
                  <Icon name="card" size={16} color={theme.colors.success}  />
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
    const isSettled = !hasBalance;

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
      text: isSettled ? 'Remove Friend' : 'Remove Friend (Settle first)',
      style: 'destructive',
      onPress: () => handleRemoveFriend(friend)
    });

    actions.push({ text: 'Cancel', style: 'cancel' });

    // Show status in the alert title - make it clearer for settled friends
    let statusDisplay = '';
    if (hasBalance) {
      statusDisplay = balance > 0 
        ? `Owes you ${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(balance).toFixed(2)}`
        : `You owe ${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(balance).toFixed(2)}`;
    } else {
      statusDisplay = '✅ All settled up - Safe to remove';
    }

    CrossPlatformAlert.alert(
      friend.friendData.fullName,
      statusDisplay,
      actions
    );
  };

  // Helper functions (keep existing but add balance notifications where needed)
  const handleRemoveFriend = (friend: Friend) => {
    // Check if there's an outstanding balance
    const balanceEntry = sharedBalances.allBalances.find(b => b.userId === friend.friendId);
    const balance = balanceEntry?.balance || 0;
    const hasBalance = Math.abs(balance) > 0.01;

    if (hasBalance) {
      const balanceText = balance > 0 
        ? `${friend.friendData.fullName} owes you ${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(balance).toFixed(2)}`
        : `You owe ${friend.friendData.fullName} ${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(balance).toFixed(2)}`;

      Alert.alert(
        'Cannot Remove Friend',
        `You cannot remove ${friend.friendData.fullName} because there's an outstanding balance.\n\n${balanceText}\n\nPlease settle all balances before removing this friend.`,
        [
          { text: 'OK' },
          {
            text: 'Settle Now',
            onPress: () => {
              // Open settlement screen for this friend
              if (balanceEntry?.groupId) {
                openSettlementScreen({ 
                  filter: 'groups', 
                  groupId: balanceEntry.groupId,
                  friendId: friend.friendId 
                });
              } else {
                openSettlementScreen({ 
                  filter: 'friends', 
                  friendId: friend.friendId 
                });
              }
            }
          }
        ]
      );
      return;
    }

    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.friendData.fullName} from your friends list?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.removeFriend(user!.id, friend.friendId);
              Alert.alert('Friend Removed', `${friend.friendData.fullName} has been removed from your friends list.`);
              // Refresh data to update UI and counts
              await Promise.all([
                debouncedLoadFriends(),
                sharedBalances.refresh()
              ]);
              notifyBalanceChange(); // FIXED: Notify balance system
              // Force immediate UI update by calling loadFriendsAndRequests directly
              setTimeout(() => loadFriendsAndRequests(), 100);
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
        description: `Payment via Meet-n-Split`
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
            
            // Find and open the specific friend request modal
            setTimeout(() => {
              const friendRequest = friendRequests.incoming?.find(req => req.id === intent.friendRequestId);
              if (friendRequest) {
                console.log('🎯 Opening FriendRequestModal for request:', friendRequest);
                setSelectedFriendRequest(friendRequest);
                setShowFriendRequest(true);
              } else {
                console.log('⚠️ Friend request not found in incoming requests:', intent.friendRequestId);
              }
            }, 500); // Small delay to ensure state has updated
          }
          break;

        case 'friend_request_accepted':
          setActiveTab('friends');
          notifyBalanceChange(); // FIXED: Notify balance system
          if (intent.friendRequestId) {
            Alert.alert('Friend Added! 🎉', 'You are now connected and can split expenses together.');
          }
          break;

        case 'friend_declined':
          console.log('❌ Handling friend_declined navigation intent:', intent);
          setActiveTab('friends');
          await loadFriendsAndRequests();
          await loadNotifications(); // Also refresh notifications
          if (intent.friendName) {
            Alert.alert('Friend Request Declined', `${intent.friendName} declined your friend request.`);
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

        case 'friend_request_reminder':
          console.log('🔔 Processing friend request reminder notification:', data);
          setActiveTab('friends');
          
          // Refresh friends list to show the received friend request
          try {
            await loadFriendsAndRequests();
            console.log('✅ Friends list refreshed for friend request reminder');
          } catch (error) {
            console.error('❌ Failed to refresh friends list:', error);
          }
          
          if (data.friendRequestId && data.friendName) {
            console.log('📋 Friend request reminder data:', {
              friendRequestId: data.friendRequestId,
              friendName: data.friendName,
              friendEmail: data.friendEmail,
              friendId: data.friendId
            });
            
            const friendRequestData = {
              id: data.friendRequestId,
              fromUserId: data.friendId || '',
              fromUserData: {
                fullName: data.friendName,
                email: data.friendEmail || '',
                avatar: data.friendAvatar
              },
              message: `${data.friendName} is still waiting for you to respond to their friend request`,
              status: 'pending' as const,
              createdAt: new Date() // Add the required createdAt field
            };
            
            console.log('🎯 Opening friend request modal with reminder data:', friendRequestData);
            setSelectedFriendRequest(friendRequestData);
            setShowFriendRequest(true);
          } else {
            console.warn('⚠️ Missing required friend request reminder data:', data);
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
                    `${data.senderName} added "${data.description}" for ${getCurrencySymbol(user?.currency || 'USD')}${data.amount} in ${data.groupName}`,
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

  // If showJoinGroup is true, render JoinGroupModal as full-screen
  if (showJoinGroup) {
    return (
      <JoinGroupModal
        visible={showJoinGroup}
        onClose={() => setShowJoinGroup(false)}
        onSuccess={() => {
          // Refresh data after successfully joining a group
          onRefresh();
        }}
        userId={user?.id || ''}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Brand Header with Profile */}
      <BrandHeader 
        height={120}
        showProfileButton={true}
        onProfilePress={() => navigation.navigate('Profile' as never)}
        profileContent={
          <TouchableOpacity 
            style={styles.profileCircleButton}
            onPress={() => navigation.navigate('Profile' as never)}
          >
            {user?.profilePicture || user?.profileImage ? (
              <Image 
                source={{ uri: user.profilePicture || user.profileImage }} 
                style={styles.profileImage}
                onError={() => {
                  // If image fails to load, will show fallback initials
                  console.log('Profile image failed to load, showing initials');
                }}
              />
            ) : (
              <Text style={styles.profileText}>
                {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            )}
          </TouchableOpacity>
        }
      />
      
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
              activeOpacity={0.8}
            >
              <Icon
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

      {/* Tab Content - Animated */}
      <Animated.View 
        style={[
          styles.tabContainer,
          {
            opacity: tabOpacity,
            transform: [{ translateX: slideAnimation }]
          }
        ]}
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'groups' && renderGroupsTab()}
        {activeTab === 'friends' && renderFriendsTab()}
      </Animated.View>

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
        onAddExpense={async () => {
          if (!user?.id) return;
          const canCreate = await subscriptionHelper.canCreateTransaction(user.id);
          if (canCreate) {
            setSelectedGroupForExpense(selectedGroup);
            setShowGroupDetails(false);
            setShowAddExpense(true);
          }
        }}
        onOpenChat={() => {
          setShowGroupDetails(false);
          handleGroupChatAccess(selectedGroup!);
        }}
        onOpenSettlement={(config) => {
          setShowGroupDetails(false);
          openSettlementScreen(config);
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
      
      
      <GroupChatModal
        visible={showGroupChat}
        onClose={() => setShowGroupChat(false)}
        group={selectedGroup}
        currentUser={user}
        onAddExpense={async () => {
          if (!user?.id) return;
          const canCreate = await subscriptionHelper.canCreateTransaction(user.id);
          if (canCreate) {
            setShowGroupChat(false);
            setSelectedGroupForExpense(selectedGroup);
            setShowAddExpense(true);
          }
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
          
          // FIXED: Immediate balance refresh for expense deletion
          console.log('🔄 EXPENSE DELETED: Forcing immediate balance refresh...');
          UnifiedSettlementService.clearBalanceCache();
          sharedBalances.forceRefresh();
          notifyBalanceChange(); // Also trigger the regular notification
          
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
          
          // FIXED: Immediate balance refresh for settlement completion
          console.log('🔄 SETTLEMENT COMPLETED: Forcing immediate balance refresh...');
          UnifiedSettlementService.clearBalanceCache();
          sharedBalances.forceRefresh();
          notifyBalanceChange(); // Also trigger the regular notification
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
          
          // FIXED: Immediate balance refresh for expense deletion
          console.log('🔄 EXPENSE DELETION COMPLETED: Forcing immediate balance refresh...');
          UnifiedSettlementService.clearBalanceCache();
          sharedBalances.forceRefresh();
          notifyBalanceChange(); // Also trigger the regular notification
        }}
        isUserAdmin={groups.find(g => g.id === selectedExpenseForAction?.groupId)
          ?.members.find(m => m.userId === user?.id)?.role === 'admin'}
        selectedGroup={groups.find(g => g.id === selectedExpenseForAction?.groupId)}
      />

      <SplittingAnalyticsModal
        visible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        userId={user?.id || ''}
        initialGroupId={selectedGroup?.id}
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
          handleExpenseDetailFromOverview(expense);
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
              'This QR code is not compatible with Meet-n-Split. Please scan a valid Meet-n-Split QR code.',
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
                result.error || 'Unable to process this QR code. Please check that it\'s a valid Meet-n-Split QR code.',
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


      {/* Expense Detail Modal */}
      <ExpenseDetailModal
        visible={showExpenseDetail}
        onClose={() => setShowExpenseDetail(false)}
        expense={selectedExpenseForDetail}
        onEdit={handleEditFromDetail}
        groups={groups}
        friends={friends}
        isEditable={selectedExpenseForDetail ? isExpenseEditable(selectedExpenseForDetail) : false}
      />

      {/* Subscription Modal handled globally by App.tsx */}
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
  quickActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 50,
    borderBottomWidth: 0.5,
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
    gap: 16,
  },
  headerAction: {
    position: 'relative',
    padding: 8,
    borderRadius: 8,
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
  modernActionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
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
  // New modern card styles to match screenshot
  modernActionCard: {
    width: '30%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  modernActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },


  profileCircle: {
    position: 'absolute',
    top: 35,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profileCircleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  activeSegment: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  firstSegment: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  lastSegment: {
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
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
receiptIndicator: {
  marginTop: 4,
  backgroundColor: 'rgba(59, 130, 246, 0.1)',
  borderRadius: 8,
  paddingHorizontal: 6,
  paddingVertical: 2,
  alignSelf: 'flex-end',
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
  paddingBottom: 20,
  paddingTop: 8,
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
friendIconImage: {
  width: 40,
  height: 40,
  borderRadius: 20,
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
  borderRadius: 16,
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
  borderRadius: 12,
  gap: 8,
  minHeight: 44,
},
modernTabText: {
  fontSize: 15,
  fontWeight: '600',
},
modernTabBadge: {
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  minWidth: 24,
  alignItems: 'center',
},
modernTabBadgeText: {
  fontSize: 13,
  fontWeight: '700',
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
  paddingHorizontal: 8,
  gap: 8,
},

// Clean friend card
cleanFriendCard: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 8,
  borderRadius: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 3,
  marginBottom: 8,
  minHeight: 48,
  marginHorizontal: 4,
},

// Active friend card (for accepted friends - wider but shorter)
cleanActiveFriendCard: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 16,
  borderRadius: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
  marginBottom: 12,
  minHeight: 72,
  marginHorizontal: 16,
},
cleanFriendLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
  marginRight: 16,
},

// Active friend left section (wider spacing)
cleanActiveFriendLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
  marginRight: 16,
},
cleanAvatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
cleanAvatarText: {
  color: 'white',
  fontSize: 14,
  fontWeight: '700',
},

// Active friend avatar (moderate size)
cleanActiveAvatar: {
  width: 52,
  height: 52,
  borderRadius: 26,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 14,
},
cleanActiveAvatarText: {
  color: 'white',
  fontSize: 18,
  fontWeight: '700',
},
cleanActiveAvatarImage: {
  width: 52,
  height: 52,
  borderRadius: 26,
},
cleanFriendInfo: {
  flex: 1,
  minWidth: 0,
},
cleanFriendName: {
  fontSize: 14,
  fontWeight: '600',
  marginBottom: 1,
  lineHeight: 16,
},

// Active friend info (compact text)
cleanActiveFriendInfo: {
  flex: 1,
  minWidth: 0,
  justifyContent: 'center',
},
cleanActiveFriendName: {
  fontSize: 17,
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
  fontSize: 11,
  fontWeight: '500',
},
cleanDirectText: {
  fontSize: 11,
  fontWeight: '400',
},

// Active friend group indicator (compact)
cleanActiveGroupIndicator: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
},
cleanActiveGroupText: {
  fontSize: 13,
  fontWeight: '500',
},
cleanActiveDirectText: {
  fontSize: 13,
  fontWeight: '400',
},

// Clean friend right section
cleanFriendRight: {
  alignItems: 'flex-end',
  gap: 6,
  minWidth: 90,
},

// Active friend right section (wider)
cleanActiveFriendRight: {
  alignItems: 'flex-end',
  gap: 6,
  minWidth: 120,
},
cleanSettledBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 12,
},
cleanSettledText: {
  fontSize: 13,
  fontWeight: '600',
},
cleanBalanceBadge: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 10,
  alignItems: 'center',
  minWidth: 65,
},
cleanBalanceAmount: {
  fontSize: 12,
  fontWeight: '700',
  textAlign: 'center',
  lineHeight: 14,
},
cleanBalanceLabel: {
  fontSize: 9,
  fontWeight: '500',
  textAlign: 'center',
  marginTop: 0,
},

// Active friend balance badge (wider but shorter)
cleanActiveBalanceBadge: {
  paddingHorizontal: 16,
  paddingVertical: 6,
  borderRadius: 12,
  alignItems: 'center',
  minWidth: 95,
},
cleanActiveBalanceAmount: {
  fontSize: 14,
  fontWeight: '700',
  textAlign: 'center',
  lineHeight: 16,
},
cleanActiveBalanceLabel: {
  fontSize: 11,
  fontWeight: '500',
  textAlign: 'center',
  marginTop: 1,
},
cleanRemindButton: {
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 3,
  elevation: 3,
  marginTop: 4,
},

// Simple Friend Item Styles (horizontal layout with status at right)
simpleFriendItem: {
  flexDirection: 'column',
  paddingHorizontal: 24,
  paddingVertical: 16,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(0,0,0,0.06)',
  minHeight: 80,
},
simpleFriendMainRow: {
  flexDirection: 'row',
  alignItems: 'center',
  width: '100%',
  marginBottom: 8,
},
simpleFriendLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
simpleFriendAvatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
  overflow: 'hidden',
},
simpleFriendAvatarImage: {
  width: 40,
  height: 40,
  borderRadius: 20,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
},
simpleFriendAvatarText: {
  color: 'white',
  fontSize: 16,
  fontWeight: 'bold',
},
simpleFriendText: {
  flex: 1,
},
simpleFriendName: {
  fontSize: 17,
  fontWeight: '600',
  lineHeight: 22,
  marginBottom: 2,
},
simpleFriendStatus: {
  fontSize: 15,
  fontWeight: '400',
  lineHeight: 20,
},
simpleFriendRight: {
  alignItems: 'flex-end',
  justifyContent: 'center',
},
simpleFriendSettledContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
simpleFriendSettledText: {
  fontSize: 14,
  fontWeight: '500',
},
simpleFriendAmountContainer: {
  alignItems: 'flex-end',
},
simpleFriendAmountLabel: {
  fontSize: 12,
  fontWeight: '400',
  marginBottom: 2,
},
simpleFriendAmount: {
  fontSize: 16,
  fontWeight: '700',
},
simpleFriendActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  alignSelf: 'flex-end',
},
simpleFriendButton: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 8,
  borderWidth: 1,
},
simpleFriendButtonText: {
  fontSize: 14,
  fontWeight: '500',
},
chatBadge: {
  position: 'absolute',
  top: -4,
  right: -4,
  backgroundColor: '#EF4444',
  borderRadius: 8,
  minWidth: 16,
  height: 16,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 4,
},
chatBadgeText: {
  color: 'white',
  fontSize: 10,
  fontWeight: 'bold',
},
});