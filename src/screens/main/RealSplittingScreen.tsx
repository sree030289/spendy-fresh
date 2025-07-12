// src/screens/main/RealSplittingScreen.tsx - Updated with subscription limits
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useOverviewBalances, useFriendsBalances } from '@/hooks/useBalances';
import { 
  BalanceCard, 
  BalanceList, 
  BalanceItem, 
  BalanceRefreshButton,
  EmptyBalanceState 
} from '@/components/balance/BalanceComponents';

// Import Firebase functions
import { 
  addDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  orderBy
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';

// Import our real services
import { SplittingService, Friend, Group, Expense, Notification } from '@/services/firebase/splitting';
import { PaymentService } from '@/services/payments/PaymentService';
import { PushNotificationService } from '@/services/notifications/PushNotificationService';
import { RealNotificationService } from '@/services/notifications/RealNotificationService';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { friendsManager } from '@/services/FriendsManager';

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
import RecurringExpenseModal from '@/components/modals/RecurringExpenseModal';
import AnalyticsModal from '@/components/modals/AnalyticsModal';
import ExpenseDeletionModal from '@/components/modals/ExpenseDeletionModal';
import ExpenseSettlementModal from '@/components/modals/ExpenseSettlementModal';
import ManualSettlementModal from '@/components/modals/ManualSettlementModal';
import GroupSettlementModal from '@/components/modals/GroupSettlementModal';
import FriendRequestModal from '@/components/modals/FriendRequestModal';
import ImportSplitwiseModal from '@/components/modals/ImportSplitwise';
import { getCurrencySymbol } from '@/utils/currency';
import QRCodeScanner from '@/components/QRCodeScanner';
import QRScannerManager from '@/services/qr/QRScannerManager';
import EditExpenseModal from '@/components/modals/EditExpenseModal';
import SimpleExpenseListModal from '@/components/modals/SimpleExpenseListModal';

export default function RealSplittingScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // Initialize subscription helper
  const subscriptionHelper = SubscriptionHelper.getInstance();
  
  // FIXED: Use ONLY unified balance hooks
  const overviewBalances = useOverviewBalances();
  const friendsBalances = useFriendsBalances();
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [selectedGroupForExpense, setSelectedGroupForExpense] = useState<Group | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showRecurringExpense, setShowRecurringExpense] = useState(false);

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
  
  // Additional modal states
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showExpenseApproval, setShowExpenseApproval] = useState(false);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [showExpenseSettlement, setShowExpenseSettlement] = useState(false);
  const [showExpenseDeletion, setShowExpenseDeletion] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showManualSettlement, setShowManualSettlement] = useState(false);
  const [showGroupSettlement, setShowGroupSettlement] = useState(false);
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

  // Set up subscription helper when component mounts
  useEffect(() => {
    if ((global as any).showSubscriptionModal) {
      subscriptionHelper.setShowSubscriptionModal((global as any).showSubscriptionModal);
    }
  }, []);

  // Calculate balances for all groups with detailed logging
  useEffect(() => {
    const calculateAllGroupBalances = async () => {
      if (!user?.id || !calculateGroupBalance) {
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
            console.log(`⏭️  Skipping self: ${member.userData.fullName}`);
            continue;
          }
          
          try {
            const pairwiseBalance = await calculateGroupBalance(user.id, member.userId, group.id);
            console.log(`💰 Balance with ${member.userData.fullName}: ${pairwiseBalance}`);
            
            // FIXED: Only add non-zero balances to avoid floating point errors
            if (Math.abs(pairwiseBalance) > 0.01) {
              totalGroupBalance += pairwiseBalance;
            }
          } catch (error) {
            console.error(`❌ Error calculating balance with ${member.userData.fullName}:`, error);
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
  }, [groups, user?.id, calculateGroupBalance]);
  
  // FIXED: Unified balance change notification
  const notifyBalanceChange = useCallback(() => {
    overviewBalances.notifyChange();
    friendsBalances.notifyChange();
  }, [overviewBalances.notifyChange, friendsBalances.notifyChange]);

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
      friendsBalances.refresh();
      friendsManager.refreshFriends().catch(() => {
        console.log('FriendsManager not ready for friends tab refresh');
      });
    } else if (tabId === 'groups') {
      loadGroups();
    } else if (tabId === 'overview') {
      overviewBalances.refresh();
      Promise.all([
        friendsManager.refreshFriends().catch(() => {
          console.log('FriendsManager not ready for overview refresh');
        }),
        loadGroups(), 
        loadRecentExpenses()
      ]);
    }
  }, [overviewBalances.refresh, friendsBalances.refresh]);

  // Real-time listeners
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribeFriends: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const initializeData = async () => {
      try {
        setLoading(true);
        
        // Initialize FriendsManager for the current user
        await friendsManager.initialize(user.id);
        
        // Load basic data (balances handled by unified system)
        await Promise.all([
          loadGroups(),
          loadRecentExpenses(),
          loadNotifications()
        ]);
        
        // Set up listeners
        unsubscribeFriends = friendsManager.addListener(async (friendsData) => {
          console.log('✅ Friends updated, notifying unified balance system');
          setFriends(friendsData.friends);
          
          // FIXED: Notify unified balance system instead of manual refresh
          notifyBalanceChange();
        });
        
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
      friendsManager.cleanup();
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
      const notificationsData = await SplittingService.getNotifications(user.id);
      
      const processedNotifications = notificationsData.map(notification => ({
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
  const loadGroups = async () => {
    try {
      if (!user?.id) return;
      const groupsData = await SplittingService.getUserGroups(user.id);
      setGroups(groupsData);
    } catch (error) {
      console.error('Load groups error:', error);
    }
  };

  // Load recent expenses
  const loadRecentExpenses = async () => {
    try {
      if (!user?.id) return;
      const expensesData = await SplittingService.getUserExpenses(user.id, 10);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Load expenses error:', error);
    }
  };

  // FIXED: Unified refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        overviewBalances.forceRefresh(),
        friendsBalances.forceRefresh(),
        friendsManager.forceRefresh(),
        loadGroups(),
        loadRecentExpenses(),
        loadNotifications()
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle notifications
  const handleNotificationsPress = () => {
    setShowNotifications(true);
  };

  const markAllNotificationsRead = async () => {
    try {
      if (!user?.id) return;
      
      await SplittingService.markAllNotificationsAsRead(user.id);
      setNotifications([]);
      
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Mark notifications read error:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  // SUBSCRIPTION-AWARE: Add expense with transaction limit checking
  const handleAddExpense = async (expenseData: any, fromGroupDetails?: Group | null) => {
    try {
      if (!user?.id) return;
      
      // Check transaction limit before proceeding
      const canCreateTransaction = await subscriptionHelper.checkTransactionLimit(user.id);
      if (!canCreateTransaction) {
        // Allow continuing for free users but show upgrade modal first
        const subscription = await subscriptionHelper.getUserSubscriptionStatus(user.id);
        if (!subscription.isPremium) {
          // Show modal but allow continuing after 5 seconds
          setTimeout(() => {
            proceedWithExpenseCreation();
          }, 5000);
          return;
        } else {
          return; // Premium users shouldn't hit this, but just in case
        }
      }
      
      await proceedWithExpenseCreation();
      
      async function proceedWithExpenseCreation() {
        const expenseId = await SplittingService.addExpense({
          ...expenseData,
          isSettled: false,
          date: new Date()
        });
        
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
        
        Alert.alert('Success', 'Expense added successfully!');
        setShowAddExpense(false);
        setSelectedGroupForExpense(null);
        
        // If expense was added from group details, go back to group details
        if (fromGroupDetails) {
          setTimeout(() => {
            setSelectedGroup(fromGroupDetails);
            setShowGroupDetails(true);
          }, 500);
        }
      }
      
    } catch (error: any) {
      console.error('Add expense error:', error);
      Alert.alert('Error', error.message || 'Failed to add expense');
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
        const existingCheck = await SplittingService.checkExistingFriendship(user.id, email);
        
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
          
          Alert.alert('Already Connected', alertMessage, [{ text: 'OK' }]);
          setShowAddFriend(false);
          return;
        }
        
        const result = await SplittingService.sendFriendRequest(user.id, email);
        
        if (result.isNewUser) {
          Alert.alert('Invitation Saved!', result.message, [{ text: 'OK' }]);
        } else {
          Alert.alert('Success', result.message || 'Friend request sent!');
        }
      } else if (method === 'sms' || method === 'whatsapp') {
        if (contactData) {
          const contacts = Array.isArray(contactData) ? contactData : [contactData];
          
          for (const contact of contacts) {
            await createPendingFriendInvitation(contact, method);
          }
          
          const contactNames = contacts.map(c => c.name || 'Friend').join(', ');
          Alert.alert(
            'Invitation Sent!', 
            `${method.toUpperCase()} invitation${contacts.length > 1 ? 's' : ''} sent to ${contactNames}. They'll appear in your friends list once they join Spendy.`,
            [{ text: 'OK' }]
          );
        }
      } else if (method === 'qr') {
        setShowQRCode(true);
      }
      
      setShowAddFriend(false);
      
      // FIXED: Notify balance system of potential friend addition
      notifyBalanceChange();
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add friend');
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
      
      const groupId = await SplittingService.createGroup({
        name: groupData.name,
        description: groupData.description || '',
        avatar: groupData.avatar,
        createdBy: user.id,
        members: [],
        currency: groupData.currency || user.currency || 'AUD',
        inviteCode,
        totalExpenses: 0,
        isActive: true,
        settings: {
          allowMemberInvites: true,
          requireApproval: false,
          currency: user.currency || 'AUD'
        }
      });
      
      // Increment group creation count
      await subscriptionHelper.incrementGroupCreation(user.id);
      
      if (groupData.selectedFriends && groupData.selectedFriends.length > 0) {
        for (const friendId of groupData.selectedFriends) {
          try {
            const friend = friends.find(f => f.id === friendId);
            if (friend) {
              await SplittingService.addGroupMember(groupId, friend.friendId, 'member');
            }
          } catch (error) {
            console.error(`Failed to add friend ${friendId} to group:`, error);
          }
        }
      }
      
      await loadGroups();
      
      // FIXED: Notify balance system of new group
      notifyBalanceChange();
      
      const memberCount = 1 + (groupData.selectedFriends?.length || 0);
      Alert.alert(
        'Group Created! 🎉', 
        `"${groupData.name}" has been created successfully with ${memberCount} member${memberCount > 1 ? 's' : ''}!\n\nInvite Code: ${inviteCode}\n\nYou can share this code to invite more friends.`,
        [
          {
            text: 'Share Invite Code',
            onPress: () => {
              require('react-native').Share.share({
                message: `Join "${groupData.name}" on Spendy! Use invite code: ${inviteCode} or download the app: https://spendy.app/join/${inviteCode}`
              });
            }
          },
          {
            text: 'Done',
            style: 'default'
          }
        ]
      );
      
      setShowCreateGroup(false);
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
      
      await SplittingService.updateExpense(expenseData);
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
    if (friend.requestType === 'received' && friend.status === 'pending') {
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
      
      if (friend.isNewUser) {
        // For new users (not on Spendy yet)
        if (friend.inviteMethod === 'email') {
          // Resend email invitation to non-Spendy user
          const message = encodeURIComponent('Hi! Join me on Spendy - the best app for splitting expenses with friends! Download it now and let\'s start tracking our shared costs.');
          const subject = encodeURIComponent('Join me on Spendy!');
          const mailtoUrl = `mailto:${friend.friendData.email}?subject=${subject}&body=${message}`;
          
          Alert.alert(
            'Resend Email Invitation',
            `${friend.friendData.fullName} hasn't joined Spendy yet. Would you like to send them another email?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Send Email',
                onPress: () => {
                  Linking.openURL(mailtoUrl).catch(() => {
                    Alert.alert('Error', 'Could not open email app. Please send them a message manually.');
                  });
                }
              }
            ]
          );
        } else if (friend.inviteMethod === 'sms' || friend.inviteMethod === 'whatsapp') {
          // For SMS/WhatsApp to new users
          const methodName = friend.inviteMethod === 'whatsapp' ? 'WhatsApp' : 'SMS';
          Alert.alert(
            `Resend ${methodName} Invitation`, 
            `${friend.friendData.fullName} hasn't joined Spendy yet. You can send them another ${methodName.toLowerCase()} message to remind them to download the app.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: `Open ${methodName}`,
                onPress: () => {
                  const phoneNumber = friend.friendData.mobile || friend.friendData.email;
                  if (phoneNumber) {
                    const message = encodeURIComponent('Hi! Join me on Spendy - the best app for splitting expenses with friends! Download it now and let\'s start tracking our shared costs.');
                    const url = friend.inviteMethod === 'whatsapp' 
                      ? `whatsapp://send?phone=${phoneNumber}&text=${message}`
                      : `sms:${phoneNumber}?body=${message}`;
                    Linking.openURL(url).catch(() => {
                      Alert.alert('Error', `Could not open ${methodName}`);
                    });
                  }
                }
              }
            ]
          );
        }
      } else {
        // For existing Spendy users
        if (friend.inviteMethod === 'email') {
          // Resend email invitation to existing user
          await SplittingService.sendFriendRequest(
            user.id,
            friend.friendData.email,
            `Hi! This is a reminder to connect on Spendy 💰`
          );
          Alert.alert('Reminder Sent! 📧', `Email reminder sent to ${friend.friendData.fullName}`);
        } else if (friend.inviteMethod === 'sms' || friend.inviteMethod === 'whatsapp') {
          // For SMS/WhatsApp to existing users (rare case)
          const methodName = friend.inviteMethod === 'whatsapp' ? 'WhatsApp' : 'SMS';
          Alert.alert(
            `${methodName} Reminder`, 
            `You can send ${friend.friendData.fullName} another ${methodName.toLowerCase()} message to remind them to accept your friend request on Spendy.`,
            [
              { text: 'OK', style: 'default' },
              {
                text: `Open ${methodName}`,
                onPress: () => {
                  const phoneNumber = friend.friendData.mobile;
                  if (phoneNumber) {
                    const message = encodeURIComponent('Hi! Don\'t forget to accept my friend request on Spendy so we can start splitting expenses! 💰');
                    const url = friend.inviteMethod === 'whatsapp' 
                      ? `whatsapp://send?phone=${phoneNumber}&text=${message}`
                      : `sms:${phoneNumber}?body=${message}`;
                    Linking.openURL(url).catch(() => {
                      Alert.alert('Error', `Could not open ${methodName}`);
                    });
                  }
                }
              }
            ]
          );
        } else {
          // Default fallback
          await SplittingService.sendFriendRequest(
            user.id,
            friend.friendData.email,
            `Hi! This is a reminder to connect on Spendy 💰`
          );
          Alert.alert('Reminder Sent! 📤', `Reminder sent to ${friend.friendData.fullName}`);
        }
      }
      
      // Refresh friends data
      notifyBalanceChange();
      
    } catch (error: any) {
      console.error('Failed to resend invitation:', error);
      Alert.alert('Error', error.message || 'Failed to resend invitation');
    }
  };

  // Function to handle canceling invitations
  const handleCancelInvitation = async (friend: Friend) => {
    try {
      if (!user?.id || !friend.requestId) return;
      
      Alert.alert(
        'Cancel Invitation',
        `Are you sure you want to cancel the invitation to ${friend.friendData.fullName}?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: async () => {
              try {
                await SplittingService.removePendingFriendInvitation(user.id, friend.requestId!);
                Alert.alert('Invitation Cancelled', `Invitation to ${friend.friendData.fullName} has been cancelled`);
                notifyBalanceChange();
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to cancel invitation');
              }
            }
          }
        ]
      );
      
    } catch (error: any) {
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
                const result = await SplittingService.autoConnectGroupMembers(groupId, user!.id);
                
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
      totalOwed: overviewBalances.totalOwed,
      totalOwing: overviewBalances.totalOwing,
      netBalance: overviewBalances.netBalance,
      isLoading: overviewBalances.isLoading,
      allBalances: overviewBalances.allBalances
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
            <TouchableOpacity 
              style={styles.importButton}
              onPress={() => setShowImportSplitwise(true)}
            >
              <Ionicons name="cloud-download-outline" size={16} color="white" />
              <Text style={styles.importButtonText}>Import from Splitwise</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                {getCurrencySymbol(user?.currency || 'USD')}{overviewBalances.totalOwed.toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>You're owed</Text>
            </View>
            
            <View style={styles.balanceItem}>
              <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                {getCurrencySymbol(user?.currency || 'USD')}{overviewBalances.totalOwing.toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>You owe</Text>
            </View>
            
            <View style={styles.balanceItem}>
              <Text 
                style={[
                  styles.balanceAmount, 
                  { color: overviewBalances.netBalance >= 0 ? '#FFD700' : '#FFA500' }
                ]} 
                numberOfLines={1} 
                adjustsFontSizeToFit
              >
                {overviewBalances.netBalance >= 0 ? '+' : ''}{getCurrencySymbol(user?.currency || 'USD')}{Math.abs(overviewBalances.netBalance).toFixed(2)}
              </Text>
              <Text style={styles.balanceLabel}>Net balance</Text>
            </View>
          </View>
          
          <TouchableOpacity onPress={() => setActiveTab('friends')}>
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
            onPress={() => setShowRecurringExpense(true)}
          >
            <Ionicons name="repeat" size={24} color="#4F46E5" />
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Recurring</Text>
            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
              Set up recurring expenses
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
              <TouchableOpacity onPress={() => setShowAddExpense(true)} style={styles.addButton}>
                <Ionicons name="add" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={navigateToExpenses} style={styles.viewAllButton}>
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
         
          {expenses.length === 0 ? (
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
                      {expense.categoryIcon}
                    </Text>
                  </View>

                  {/* Center: Expense Details */}
                  <View style={styles.expenseCardDetails}>
                    <Text style={[styles.expenseCardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {expense.description}
                    </Text>
                    <View style={styles.expenseCardMeta}>
                      <Text style={[styles.expenseCardPaidBy, { color: theme.colors.textSecondary }]}>
                        Paid by {expense.paidByData?.fullName || 'Unknown'}
                      </Text>
                      <Text style={[styles.metaSeparator, { color: theme.colors.textSecondary }]}>•</Text>
                      <Text style={[styles.expenseCardDate, { color: theme.colors.textSecondary }]}>
                        {expense.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                      {(() => {
                        const hasUpdated = expense.updatedAt && expense.createdAt;
                        const timeDiff = hasUpdated ? Math.abs(expense.updatedAt.getTime() - expense.createdAt.getTime()) : 0;
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
                    <Text style={[styles.expenseCardAmountText, { color: theme.colors.error }]}>
                      -{getCurrencySymbol(user?.currency || 'USD')}{expense.amount.toFixed(2)}
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
              <TouchableOpacity onPress={overviewBalances.refresh} style={styles.refreshButton}>
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
          
          {overviewBalances.isEmpty ? (
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
              {overviewBalances.allBalances.slice(0, 5).map((detail, index) => (
                <TouchableOpacity
                  key={`balance-${detail.userId}-${index}`}
                  style={[styles.friendCardRow, { backgroundColor: theme.colors.background }]}
                  onPress={() => {
                    if (detail.source === 'friend') {
                      const friend = friends.find(f => f.friendId === detail.userId);
                      if (friend) {
                        showFriendActionsMenu(friend);
                      }
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
                      {detail.name.charAt(0).toUpperCase()}
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
                      {detail.name}
                    </Text>
                    <View style={styles.friendCardRowMeta}>
                      <Text style={[styles.friendCardRowSource, { color: theme.colors.textSecondary }]}>
                        {detail.source === 'group' ? `Group: ${detail.groupName}` : 'Friend'}
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
                          +{getCurrencySymbol(user?.currency || 'USD')}{detail.balance.toFixed(2)}
                        </Text>
                        <Ionicons name="arrow-up-circle" size={16} color={theme.colors.success} />
                      </>
                    ) : (
                      <>
                        <Text style={[styles.friendCardRowBalanceText, { color: theme.colors.error }]}>
                          -{getCurrencySymbol(user?.currency || 'USD')}{Math.abs(detail.balance).toFixed(2)}
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
      friendBalances: friendsBalances.friendBalances,
      groupMemberBalances: friendsBalances.groupMemberBalances,
      allBalances: friendsBalances.allBalances,
      isLoading: friendsBalances.isLoading
    });

    return (
      <ScrollView 
        contentContainerStyle={styles.tabContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.tabHeader}>
          <Text style={[styles.tabTitle, { color: theme.colors.text }]}>Friends & Balances</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={friendsBalances.refresh} style={styles.refreshButton}>
              <Ionicons name="refresh" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowAddFriend(true)}
            >
              <Ionicons name="person-add" size={20} color="white" />
              <Text style={styles.headerButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {friends.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Friends Yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Add friends to start splitting expenses
            </Text>
          </View>
        ) : (
          <>
            {/* Accepted Friends Section */}
            {friends.filter(f => f.status === 'accepted').length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeader, { color: theme.colors.text }]}>
                  Friends ({friends.filter(f => f.status === 'accepted').length})
                </Text>
                {friends
                  .filter(friend => friend.status === 'accepted')
                  .map((friend, index) => {
                    // Get balance from unified balance system
                    const balanceDetail = friendsBalances.allBalances.find(b => b.userId === friend.friendId);
                    const balance = balanceDetail?.balance || 0;
                    
                    return (
                      <TouchableOpacity
                        key={`friend-${friend.id}-${index}`}
                        style={[styles.balanceItemFull, { backgroundColor: theme.colors.surface }]}
                        onPress={() => showFriendActionsMenu(friend)}
                      >
                        <View style={styles.balanceItemLeft}>
                          <View style={[styles.personAvatar, { backgroundColor: theme.colors.primary }]}>
                            <Text style={styles.personAvatarText}>
                              {friend.friendData.fullName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.personInfo}>
                            <Text style={[styles.personName, { color: theme.colors.text }]} numberOfLines={1}>
                              {friend.friendData.fullName}
                            </Text>
                            <Text style={[styles.personEmail, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                              {friend.friendData.email}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.balanceItemRight}>
                          <View style={styles.balanceDisplay}>
                            {Math.abs(balance) < 0.01 ? (
                              <>
                                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                                <Text style={[styles.balanceText, { color: theme.colors.success }]}>
                                  Settled up
                                </Text>
                              </>
                            ) : balance > 0 ? (
                              <>
                                <Ionicons name="arrow-up-circle" size={16} color={theme.colors.success} />
                                <Text style={[styles.balanceText, { color: theme.colors.success }]}>
                                  Owes you {getCurrencySymbol(user?.currency || 'USD')}{Math.abs(balance).toFixed(2)}
                                </Text>
                              </>
                            ) : (
                              <>
                                <Ionicons name="arrow-down-circle" size={16} color={theme.colors.error} />
                                <Text style={[styles.balanceText, { color: theme.colors.error }]}>
                                  You owe {getCurrencySymbol(user?.currency || 'USD')}{Math.abs(balance).toFixed(2)}
                                </Text>
                              </>
                            )}
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}

            {/* Keep existing pending invitations and group members sections... */}
            {/* [Previous code for pending invitations and group members continues here] */}
          </>
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
            style={[styles.headerButton, { backgroundColor: theme.colors.secondary }]}
            onPress={() => setShowImportSplitwise(true)}
          >
            <Ionicons name="cloud-download-outline" size={18} color="white" />
            <Text style={styles.headerButtonText}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.colors.primary, marginLeft: 8 }]}
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
          // FIXED: Use pre-calculated group balances with debug logging
          const userBalance = groupBalances.get(group.id) || 0;
          const userShare = Math.abs(userBalance);
          const shareStatus = userBalance === 0 ? 'settled' : (userBalance > 0 ? 'owed' : 'owes');
          
          // Debug logging for group card display
          console.log(`🏷️  Rendering group card: ${group.name}`);
          console.log(`💳 Group balance from map: ${userBalance}`);
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
                        {group.members.length} members
                      </Text>
                      <Text style={[styles.groupDivider, { color: theme.colors.textSecondary }]}>•</Text>
                      <Text style={[styles.groupActivity, { color: theme.colors.textSecondary }]}>
                        {group.updatedAt.toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </View>
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

              <View style={styles.groupStats}>
                <View style={styles.groupStat}>
                  <Text style={[styles.groupStatLabel, { color: theme.colors.textSecondary }]}>
                    Total spent
                  </Text>
                  <Text style={[styles.groupStatValue, { color: theme.colors.text }]}>
                    {getCurrencySymbol(group.currency)}{group.totalExpenses.toFixed(2)}
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
                    {shareStatus === 'settled' ? '✓' : `${getCurrencySymbol(group.currency)}${userShare.toFixed(2)}`}
                  </Text>
                </View>
              </View>

              <View style={styles.groupActions}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleGroupChatAccess(group);
                  }}
                  style={[styles.actionButton, styles.enhancedChatButton]}
                >
                  <Ionicons name="chatbubbles" size={18} color="white" />
                  <Text style={[styles.actionButtonText, { color: 'white', fontWeight: 'bold' }]}>Chat</Text>
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>2</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedGroup(group);
                    setShowGroupSettlement(true);
                  }}
                  style={[styles.actionButton, styles.settlementButton, { backgroundColor: theme.colors.success + '20' }]}
                >
                  <Ionicons name="card" size={16} color={theme.colors.success} />
                  <Text style={[styles.actionButtonText, { color: theme.colors.success }]}>Settle</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedGroupForExpense(group);
                    setShowAddExpense(true);
                  }}
                  style={[styles.actionButton, styles.addExpenseButton, { backgroundColor: theme.colors.primary }]}
                >
                  <Ionicons name="add" size={16} color="white" />
                  <Text style={[styles.actionButtonText, { color: 'white' }]}>Add Expense</Text>
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
    const balanceDetail = friendsBalances.allBalances.find(b => b.userId === friend.friendId);
    const balance = balanceDetail?.balance || 0;
    const hasBalance = Math.abs(balance) > 0.01;

    const actions: Array<{
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }> = [];

    // Payment actions if there's a balance
    if (hasBalance) {
      if (balance > 0) {
        // Friend owes user
        actions.push({
          text: `Request Payment (${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(balance).toFixed(2)})`,
          onPress: () => {
            setSelectedFriend(friend);
            setShowPayment(true);
          }
        });
      } else {
        // User owes friend
        actions.push({
          text: `Send Payment (${getCurrencySymbol(user?.currency || 'USD')}${Math.abs(balance).toFixed(2)})`,
          onPress: () => {
            setSelectedFriend(friend);
            setShowPayment(true);
          }
        });
      }

      actions.push({
        text: 'Mark as Paid',
        onPress: () => {
          setSelectedFriend(friend);
          setShowManualSettlement(true);
        }
      });
    }

    // Management actions
    actions.push({
      text: friend.status === 'blocked' ? 'Unblock Friend' : 'Block Friend',
      // TODO: Implement block/unblock functionality
      // onPress: () => handleBlockUnblockFriend(friend, friend.status !== 'blocked')
      onPress: () => Alert.alert('Feature Coming Soon', 'Block/Unblock functionality will be available in a future update.')
    });

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

    Alert.alert(
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
              await SplittingService.removeFriend(user!.id, friend.friendId);
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

  // Handle manual settlement
  const handleManualSettlement = async (friendId: string, amount: number, type: 'pay' | 'request', description?: string) => {
    try {
      if (!user?.id) return;

      if (type === 'pay') {
        await SplittingService.markPaymentAsPaid(
          user.id,
          friendId,
          amount,
          undefined,
          description || 'Manual settlement'
        );
      } else {
        await SplittingService.createPaymentRequest({
          fromUserId: user.id,
          toUserId: friendId,
          amount,
          currency: user.currency,
          message: description
        });
      }

      // FIXED: Notify balance system
      notifyBalanceChange();

      setShowManualSettlement(false);
      setSelectedFriend(null);

      Alert.alert('Success', type === 'pay' ? 'Payment marked as paid successfully!' : 'Payment request sent!');
    } catch (error: any) {
      console.error('Manual settlement error:', error);
      Alert.alert('Error', error.message || `Failed to ${type === 'pay' ? 'mark payment as paid' : 'send payment request'}`);
    }
  };

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
            Alert.alert('Welcome to the Group! 🎉', `You have successfully joined "${intent.groupName}"`);
          }
          break;

        case 'group_details':
          if (intent.groupId) {
            const group = groups.find(g => g.id === intent.groupId) || 
                        (await SplittingService.getGroup(intent.groupId));
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
            await friendsManager.refreshFriends();
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
            await friendsManager.forceRefresh();
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
                      await SplittingService.joinGroupByInviteCode(data.inviteCode, user.id);
                      await loadGroups();
                      notifyBalanceChange(); // FIXED: Notify balance system
                      Alert.alert('Welcome! 🎊', `You've successfully joined "${data.groupName}"!`);
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
      await SplittingService.acceptFriendRequest(requestId);
      notifyBalanceChange(); // FIXED: Notify balance system
      
      // Refresh friends list to update UI
      try {
        await friendsManager.forceRefresh();
        console.log('✅ Friends list refreshed after accepting friend request');
      } catch (refreshError) {
        console.error('❌ Failed to refresh friends list:', refreshError);
      }
      
      setShowFriendRequest(false);
      setSelectedFriendRequest(null);
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.message || 'Failed to accept friend request');
    }
  };

  // Handle friend request decline
  const handleDeclineFriendRequest = async (requestId: string) => {
    try {
      await SplittingService.declineFriendRequest(requestId);
      
      // Refresh friends list to update UI
      try {
        await friendsManager.forceRefresh();
        console.log('✅ Friends list refreshed after declining friend request');
      } catch (refreshError) {
        console.error('❌ Failed to refresh friends list:', refreshError);
      }
      
      setShowFriendRequest(false);
      setSelectedFriendRequest(null);
      Alert.alert('Success', 'Friend request declined');
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
            <Ionicons name="qr-code" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setShowRecurringExpense(true)}
          >
            <Ionicons name="repeat" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={handleAnalyticsAccess}
          >
            <Ionicons name="analytics" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerAction}
            onPress={handleNotificationsPress}
          >
            <Ionicons name="notifications" size={24} color={theme.colors.text} />
            {notifications.length > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={styles.notificationBadgeText}>
                  {notifications.length > 99 ? '99+' : notifications.length}
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

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setShowAddExpense(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

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
          await SplittingService.markNotificationAsRead(notificationId);
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

      <ImportSplitwiseModal
        visible={showImportSplitwise}
        onClose={() => setShowImportSplitwise(false)}
        onImportComplete={() => {
          setShowImportSplitwise(false);
          onRefresh(); // Refresh the screen data after import
        }}
      />

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

      <RecurringExpenseModal
        visible={showRecurringExpense}
        onClose={() => setShowRecurringExpense(false)}
        onSubmit={async (recurringData) => {
          await SplittingService.createRecurringExpense(recurringData);
          Alert.alert('Success', 'Recurring expense created!');
          setShowRecurringExpense(false);
        }}
        groups={groups}
        currentUser={user}
      />

      <AnalyticsModal
        visible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        currentUser={user}
      />

      <ManualSettlementModal
        visible={showManualSettlement}
        onClose={() => {
          setShowManualSettlement(false);
          setSelectedFriend(null);
        }}
        friend={selectedFriend}
        userCurrency={user?.currency || 'USD'}
        onSettlement={handleManualSettlement}
      />

      <GroupSettlementModal
        visible={showGroupSettlement}
        onClose={() => {
          setShowGroupSettlement(false);
          setSelectedGroup(null);
        }}
        groupId={selectedGroup?.id || null}
        userCurrency={user?.currency || 'USD'}
        currentUserId={user?.id || ''}
        onRefresh={() => {
          loadRecentExpenses();
          notifyBalanceChange(); // FIXED: Notify balance system
        }}
      />     

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
            Alert.alert('Error', 'User not authenticated');
            setShowQRScanner(false);
            setQrScanSource(null);
            return;
          }

          if (qrData === 'INVALID_QR_FORMAT') {
            Alert.alert(
              'Invalid QR Code',
              'This is not a valid Spendy QR code. Please scan a QR code generated by Spendy.',
              [
                { text: 'Try Again', onPress: () => {} },
                {
                  text: 'Cancel',
                  onPress: () => {
                    setShowQRScanner(false);
                    setQrScanSource(null);
                  }
                }
              ]
            );
            return;
          }

          if (qrData === 'SCAN_ERROR') {
            Alert.alert(
              'Scan Error',
              'An error occurred while scanning. Please try again.',
              [
                { text: 'Try Again', onPress: () => {} },
                {
                  text: 'Cancel',
                  onPress: () => {
                    setShowQRScanner(false);
                    setQrScanSource(null);
                  }
                }
              ]
            );
            return;
          }

          try {
            const result = await scannerManager.processQRCode(qrData, user.id, {
              closeOnSuccess: true,
              navigation: navigation
            });

            if (result.success) {
              setShowQRScanner(false);
              setQrScanSource(null);
              
              setTimeout(() => {
                Alert.alert(
                  'Success',
                  'QR code processed successfully!',
                  [{
                    text: 'OK',
                    onPress: async () => {
                      await Promise.all([
                        loadGroups(),
                        loadRecentExpenses()
                      ]);
                      notifyBalanceChange(); // FIXED: Notify balance system
                    }
                  }]
                );
              }, 100);
            } else {
              Alert.alert(
                'QR Code Error',
                result.error || 'Failed to process QR code',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                      setShowQRScanner(false);
                      setQrScanSource(null);
                    }
                  },
                  { text: 'Try Again', onPress: () => {} }
                ]
              );
            }
          } catch (error: any) {
            Alert.alert(
              'Error',
              error.message || 'Unexpected error occurred',
              [
                {
                  text: 'Cancel',
                  onPress: () => {
                    setShowQRScanner(false);
                    setQrScanSource(null);
                  }
                },
                { text: 'Try Again', onPress: () => {} }
              ]
            );
          }
        }}
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
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
  enhancedChatButton: {
    backgroundColor: '#00C851',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    flex: 1.2,
    justifyContent: 'center',
    minHeight: 40,
    shadowColor: '#00C851',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  },
  balanceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  balanceItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  },
  personName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  personEmail: {
    fontSize: 12,
    marginBottom: 2,
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
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '500',
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
});