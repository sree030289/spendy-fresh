// src/screens/main/RealSplittingScreen.tsx - FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { User } from '@/types';


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
import { getCurrencySymbol } from '@/utils/currency';
import QRCodeScanner from '@/components/QRCodeScanner';
import QRScannerManager from '@/services/qr/QRScannerManager';
import EditExpenseModal from '@/components/modals/EditExpenseModal';

export default function RealSplittingScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  interface ContactData {
    name: string;
    phoneNumber: string;
  }
  
  // Data state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [balances, setBalances] = useState({
    totalOwed: 0,
    totalOwing: 0,
    netBalance: 0
  });
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

  // Reset to overview tab when the screen gains focus (when bottom tab is pressed)
  useFocusEffect(
    useCallback(() => {
      setActiveTab('overview');
    }, [])
  );

  // Handle tab switching with proper data refresh
  const handleTabSwitch = useCallback((tabId: string) => {
    setActiveTab(tabId);
    
    // Refresh friends list when friends tab is selected using FriendsManager
    if (tabId === 'friends') {
      friendsManager.refreshFriends();
    }
    // Refresh groups when groups tab is selected  
    else if (tabId === 'groups') {
      loadGroups();
    }
    // Refresh overview data when overview tab is selected
    else if (tabId === 'overview') {
      Promise.all([
        friendsManager.refreshFriends(),
        loadGroups(), 
        loadRecentExpenses()
      ]);
    }
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribeFriends: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;
    let unsubscribeFriendRequests: (() => void) | undefined;

    const initializeData = async () => {
      try {
        setLoading(true);
        
        // Initialize push notifications
        try {
          const pushService = PushNotificationService.getInstance();
          await pushService.initialize(user.id);
        } catch (pushError) {
          console.warn('Push notification initialization failed:', pushError);
          // Continue without push notifications
        }

        // Process recurring expenses on app startup
      try {
        await SplittingService.processRecurringExpenses();
        console.log('Recurring expenses processed');
      } catch (recurringError) {
        console.warn('Recurring expenses processing failed:', recurringError);
      }
        
        // Initialize FriendsManager with user ID
        await friendsManager.initialize(user.id);
        
        // Get initial friends state from FriendsManager
        const friendsState = friendsManager.getState();
        setFriends(friendsState.friends);
        setBalances({
          totalOwed: friendsState.balances.totalOwed,
          totalOwing: friendsState.balances.totalOwing,
          netBalance: friendsState.balances.netBalance
        });
        
        // Get initial state from FriendsManager
        const initialFriendsState = friendsManager.getState();
        setFriends(initialFriendsState.friends);
        setBalances({
          totalOwed: initialFriendsState.balances.totalOwed,
          totalOwing: initialFriendsState.balances.totalOwing,
          netBalance: initialFriendsState.balances.netBalance
        });
        
        // Load initial data
        await Promise.all([
          loadGroups(),
          loadRecentExpenses(),
          loadNotifications(), // FIX: Add this to load notifications
          loadRecurringExpenses()
        ]);
        
        // Set up real-time listeners
        unsubscribeNotifications = SplittingService.onUserNotifications(
          user.id,
          (newNotifications) => {
            setNotifications(newNotifications);
          }
        );
        
        unsubscribeFriendRequests = SplittingService.onFriendRequests(
          user.id,
          (requests) => {
            // Handle incoming friend requests
            if (requests.length > 0) {
              showFriendRequestAlert(requests[0]);
            }
          }
        );

        // Use FriendsManager for friends updates instead of direct SplittingService
        unsubscribeFriends = friendsManager.addListener((friendsData) => {
          console.log('✅ Friends updated via FriendsManager:', friendsData.friends.length);
          setFriends(friendsData.friends);
          
          // Update balances from FriendsManager state
          setBalances({
            totalOwed: friendsData.balances.totalOwed,
            totalOwing: friendsData.balances.totalOwing,
            netBalance: friendsData.balances.netBalance
          });
        });
        
      } catch (error) {
        console.error('Initialize splitting screen error:', error);
        Alert.alert('Error', 'Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initializeData();

    // Cleanup listeners on unmount
    return () => {
      unsubscribeFriends?.();
      unsubscribeNotifications?.();
      unsubscribeFriendRequests?.();
      
      // Cleanup FriendsManager when component unmounts
      friendsManager.cleanup();
    };
  }, [user?.id]);

  useEffect(() => {
    const refreshService = ExpenseRefreshService.getInstance();
    const unsubscribe = refreshService.addListener(() => {
      console.log('Received expense refresh notification');
      // Refresh all data when an expense is added
      loadRecentExpenses();
      loadGroups();
      friendsManager.notifyBalanceUpdated();
    });

    return () => {
      unsubscribe();
    };
  }, []);

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

    // Check on component mount and when coming back to foreground
    checkNavigationIntent();

    // Set up interval to check for navigation intents
    const interval = setInterval(checkNavigationIntent, 1000);

    return () => clearInterval(interval);
  }, [user?.id]);

  const loadNotifications = async () => {
  try {
    if (!user?.id) return;
    const notificationsData = await SplittingService.getNotifications(user.id);
    
    // Convert Firestore timestamps to proper Date objects
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
const loadRecurringExpenses = async () => {
  try {
    if (!user?.id) return;
    
    // Get user's recurring expenses
    const recurringQuery = query(
      collection(db, 'recurringExpenses'),
      where('createdBy', '==', user.id),
      where('isActive', '==', true),
      orderBy('nextDueDate', 'asc')
    );
    
    const snapshot = await getDocs(recurringQuery);
    const recurringExpenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startDate: doc.data().startDate?.toDate() || new Date(),
      endDate: doc.data().endDate?.toDate() || null,
      nextDueDate: doc.data().nextDueDate?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    }));
    
    console.log('Loaded recurring expenses:', recurringExpenses.length);
    
    // You can add state to store these and display them in UI
    // setRecurringExpenses(recurringExpenses);
    
  } catch (error) {
    console.error('Load recurring expenses error:', error);
  }
};
  

  // Load friends data using FriendsManager
  const loadFriends = async () => {
    try {
      if (!user?.id) return;
      
      console.log('Loading friends via FriendsManager for user:', user.id);
      await friendsManager.refreshFriends();
      
      // Get current state from FriendsManager
      const currentState = friendsManager.getState();
      setFriends(currentState.friends);
      setBalances({
        totalOwed: currentState.balances.totalOwed,
        totalOwing: currentState.balances.totalOwing,
        netBalance: currentState.balances.netBalance
      });
      
      console.log('Friends loaded via FriendsManager:', currentState.friends.length);
    } catch (error) {
      console.error('Load friends error:', error);
      setFriends([]);
    }
  };
  // Recurring expense handler


// Process recurring expenses (call this on app startup)
const processRecurringExpenses = async () => {
  try {
    await SplittingService.processRecurringExpenses();
  } catch (error) {
    console.error('Process recurring expenses error:', error);
  }
};
const handleExpenseUpdate = async (expenseData: any) => {
  try {
    if (!user?.id) return;
    
    console.log('🔄 Updating expense with data:', expenseData);
    
    // Call the SplittingService updateExpense method
    await SplittingService.updateExpense(expenseData);
    
    console.log('✅ Expense updated successfully in database');
    
    // Notify all listeners about the updated expense
    ExpenseRefreshService.getInstance().notifyExpenseAdded();
    
    // Force refresh local data
    await Promise.all([
      loadGroups(),
      loadRecentExpenses(),
      friendsManager.notifyBalanceUpdated() // Notify FriendsManager about balance changes
    ]);
    
    console.log('✅ Local data refreshed after expense update');
    
    // Note: Success alert is shown in the EditExpenseModal
    
  } catch (error: any) {
    console.error('❌ Update expense error:', error);
    // Re-throw so the modal can handle it
    throw error;
  }
};
const handleEditExpenseFromDetails = (expense: Expense) => {
  setSelectedExpenseForAction(expense);
  setShowEditExpense(true);
};

const handleEditExpenseFromGroup = (expense: Expense, group: Group) => {
  setSelectedExpenseForAction(expense);
  setSelectedGroup(group);
  setShowEditExpense(true);
};
// Export data handler
const handleExportData = async () => {
  try {
    if (!user?.id) return;
    const exportData = await SplittingService.exportUserData(user.id);
    
    // In a real app, you'd save this to device or share it
    Alert.alert('Data Exported', 'Your expense data has been exported successfully!');
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Failed to export data');
  }
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

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        friendsManager.forceRefresh(),
        loadGroups(),
        loadRecentExpenses(),
        loadNotifications() // FIX: Include notifications in refresh
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // FIX: Handle notifications properly
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

  // Show friend request modal instead of alert
  const showFriendRequestAlert = (request: any) => {
    // If the QRCodeModal (for sharing QR) is currently visible
    if (showQRCode) {
      setShowQRCode(false); // Close it first

      // Use setTimeout to allow the UI to update (close QRCodeModal)
      // before showing the FriendRequestModal. This helps prevent modal conflicts.
      setTimeout(() => {
        setSelectedFriendRequest(request);
        setShowFriendRequest(true);
      }, 100); // Using a 100ms delay, can be adjusted if needed
    } else {
      // If QRCodeModal wasn't open, show the friend request modal directly
      setSelectedFriendRequest(request);
      setShowFriendRequest(true);
    }
  };

  // Handle friend request accept
  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      await SplittingService.acceptFriendRequest(requestId);
      await friendsManager.notifyFriendAdded(); // Notify FriendsManager to refresh
      setShowFriendRequest(false);
      setSelectedFriendRequest(null);
      
      // Show success feedback
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
      setShowFriendRequest(false);
      setSelectedFriendRequest(null);
      
      // Show success feedback
      Alert.alert('Success', 'Friend request declined');
    } catch (error: any) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', error.message || 'Failed to decline friend request');
    }
  };

  // Handle add friend
  const handleAddFriend = async (email: string, method: 'email' | 'sms' | 'whatsapp' | 'qr', contactData?: ContactData) => {
    try {
      if (!user?.id) return;
      
      if (method === 'email') {
        // Check for existing friendship before sending request
        if (email.trim()) {
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
        }
        
        const result = await SplittingService.sendFriendRequest(user.id, email);
        
        if (result.isNewUser) {
          // User not on platform yet - show invitation saved message
          Alert.alert('Invitation Saved!', result.message, [{ text: 'OK' }]);
        } else {
          // User found and friend request sent
          Alert.alert('Success', result.message || 'Friend request sent!');
        }
      } else if (method === 'sms' || method === 'whatsapp') {
        // For SMS/WhatsApp invitations with contact data
        if (contactData) {
          // Create a pending friend entry to track the invitation
          await createPendingFriendInvitation(contactData, method);
          
          Alert.alert(
            'Invitation Sent!', 
            `${method.toUpperCase()} invitation sent to ${contactData.name}. They'll appear in your friends list once they join Spendy.`,
            [{ text: 'OK' }]
          );
        }
      } else if (method === 'qr') {
        // Generate QR code for friend invite
        setShowQRCode(true);
      }
      
      setShowAddFriend(false);
      await friendsManager.notifyFriendAdded(); // Notify FriendsManager to refresh
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add friend');
    }
  };

  const createPendingFriendInvitation = async (contactData: ContactData, method: 'sms' | 'whatsapp') => {
    try {
      if (!user?.id) return;
      
      // Create a pending friend invitation record
      const pendingInvitation = {
        fromUserId: user.id,
        fromUserData: {
          fullName: user.fullName,
          email: user.email,
          avatar: user.profilePicture || '',
          mobile: user.mobile || ''
        },
        toUserData: {
          fullName: contactData.name,
          email: '', // No email for phone invitations
          mobile: contactData.phoneNumber,
          avatar: ''
        },
        contactMethod: method,
        phoneNumber: contactData.phoneNumber,
        status: 'invited' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Store in Firestore
      await addDoc(collection(db, 'pendingInvitations'), pendingInvitation);
      
      console.log('Pending invitation created for:', contactData.name);
    } catch (error) {
      console.error('Create pending invitation error:', error);
      // Don't throw error as the SMS/WhatsApp was already sent successfully
    }
  };

  

  const handleRemoveFriend = (friend: Friend) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.friendData.fullName} from your friends list? This will also clear any pending balances between you.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await SplittingService.removeFriend(user!.id, friend.friendId);
              
              Alert.alert(
                'Friend Removed',
                `${friend.friendData.fullName} has been removed from your friends list.`,
                [{ text: 'OK' }]
              );
              
              // Refresh friends list via FriendsManager
              await friendsManager.notifyFriendRemoved();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  // Handle friend blocking (optional advanced feature)
  const handleBlockFriend = (friend: Friend) => {
    Alert.alert(
      'Block Friend',
      `Are you sure you want to block ${friend.friendData.fullName}? They won't be able to send you friend requests or see your activity.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await SplittingService.blockFriend(user!.id, friend.friendId);
              
              Alert.alert(
                'Friend Blocked',
                `${friend.friendData.fullName} has been blocked.`,
                [{ text: 'OK' }]
              );
              
              // Refresh friends list via FriendsManager
              await friendsManager.notifyFriendRemoved();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to block friend');
            }
          }
        }
      ]
    );
  };

 const showFriendActionsMenu = (friend: Friend) => {
  const actions: Array<{
    text: string;
    style?: 'cancel' | 'destructive' | 'default';
    onPress?: () => void;
  }> = [
    {
      text: 'Cancel',
      style: 'cancel'
    }
  ];

  // Add manual settlement action if there's a balance
  if (friend.balance !== 0 && friend.status === 'accepted') {
    actions.unshift({
      text: 'Mark as Paid',
      onPress: () => {
        setSelectedFriend(friend);
        setShowManualSettlement(true);
      }
    });
  }

  // Add payment action if there's a balance
  if (friend.balance !== 0 && friend.status === 'accepted') {
    actions.unshift({
      text: friend.balance > 0 ? 'Request Payment' : 'Send Payment',
      onPress: () => {
        setSelectedFriend(friend);
        setShowPayment(true);
      }
    });
  }

  // Add remove friend action
  actions.unshift({
    text: 'Remove Friend',
    style: 'destructive',
    onPress: () => handleRemoveFriend(friend)
  });

  // ENHANCED: Add block friend with reason selection
  actions.unshift({
    text: 'Block Friend',
    style: 'destructive',
    onPress: () => showBlockReasonDialog(friend)
  });

  Alert.alert(
    friend.friendData.fullName,
    'Choose an action:',
    actions
  );
};
  const handlePhoneInvitationAccepted = async (phoneNumber: string, newUser: User) => {
    try {
      // Find pending invitation for this phone number
      const pendingQuery = query(
        collection(db, 'pendingInvitations'),
        where('phoneNumber', '==', phoneNumber),
        where('status', '==', 'invited')
      );
      
      const snapshot = await getDocs(pendingQuery);
      
      for (const docSnap of snapshot.docs) {
        const invitationData = docSnap.data();
        
        // Create friend request from the original inviter to the new user
        const friendRequestResult = await SplittingService.sendFriendRequest(
          invitationData.fromUserId,
          newUser.email,
          `Connected via phone invitation to ${invitationData.toUserData.fullName}`
        );
        
        console.log('✅ Auto-connected phone invitation:', friendRequestResult.message);
        
        // Update pending invitation status
        await updateDoc(doc(db, 'pendingInvitations', docSnap.id), {
          status: 'completed',
          completedAt: new Date(),
          newUserId: newUser.id
        });
      }
      
    } catch (error) {
      console.error('Handle phone invitation accepted error:', error);
    }
  };

  // Handle create group
  const handleCreateGroup = async (groupData: any) => {
    try {
      if (!user?.id) return;
      
      // Generate invite code
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const groupId = await SplittingService.createGroup({
        name: groupData.name,
        description: groupData.description || '',
        avatar: groupData.avatar,
        createdBy: user.id,
        members: [], // Initialize with empty array, members will be added separately
        currency: groupData.currency || user.currency || 'AUD',
        inviteCode, // Add the invite code
        totalExpenses: 0,
        isActive: true,
        settings: {
          allowMemberInvites: true,
          requireApproval: false,
          currency: user.currency || 'AUD'
        }
      });
      
      // Add selected friends to the group if any were selected
      if (groupData.selectedFriends && groupData.selectedFriends.length > 0) {
        console.log('Adding selected friends to group:', groupData.selectedFriends);
        
        for (const friendId of groupData.selectedFriends) {
          try {
            // Find the friend data to get their user ID
            const friend = friends.find(f => f.id === friendId);
            if (friend) {
              console.log('Adding friend to group:', friend.friendData.fullName, friend.friendId);
              await SplittingService.addGroupMember(groupId, friend.friendId, 'member');
            }
          } catch (error) {
            console.error(`Failed to add friend ${friendId} to group:`, error);
            // Continue with other friends even if one fails
          }
        }
      }
      
      await loadGroups(); // Refresh groups list
      
      // Show success with invite code and member count
      const memberCount = 1 + (groupData.selectedFriends?.length || 0);
      Alert.alert(
        'Group Created! 🎉', 
        `"${groupData.name}" has been created successfully with ${memberCount} member${memberCount > 1 ? 's' : ''}!\n\nInvite Code: ${inviteCode}\n\nYou can share this code to invite more friends.`,
        [
          {
            text: 'Share Invite Code',
            onPress: () => {
              // Share the invite code
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

  // Handle add expense
  const handleAddExpense = async (expenseData: any, fromGroupDetails?: Group | null) => {
    try {
      if (!user?.id) return;
      
      const expenseId = await SplittingService.addExpense({
        ...expenseData,
        paidBy: user.id,
        paidByData: {
          fullName: user.fullName,
          email: user.email
        },
        isSettled: false,
        date: new Date()
      });
      
      console.log('Expense added successfully:', expenseId);
      
      // Notify all listeners about the new expense
      ExpenseRefreshService.getInstance().notifyExpenseAdded();
      
      // Force refresh local data
      await Promise.all([
        loadGroups(),
        loadRecentExpenses(),
        friendsManager.notifyBalanceUpdated() // Notify FriendsManager about balance changes
      ]);
      
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
      
    } catch (error: any) {
      console.error('Add expense error:', error);
      Alert.alert('Error', error.message || 'Failed to add expense');
    }
  };

  const handleCreateRecurring = async (recurringData: any) => {
  try {
    await SplittingService.createRecurringExpense(recurringData);
    Alert.alert('Success', 'Recurring expense created!');
    setShowRecurringExpense(false);
  } catch (error: any) {
    Alert.alert('Error', error.message);
  }
};

// Handle deep linking navigation from notifications
const handleNavigationIntent = async (intent: any) => {
  try {
    const { type, action } = intent;
    
    switch (type) {
      case 'group_joined':
        // User successfully joined a group via notification
        if (intent.groupName) {
          setActiveTab('groups');
          await loadGroups(); // Refresh groups to show new group
          Alert.alert(
            'Welcome to the Group! 🎉',
            `You have successfully joined "${intent.groupName}"${intent.senderName ? ` invited by ${intent.senderName}` : ''}`,
            [{ text: 'OK' }]
          );
        }
        break;

      case 'group_details':
        // Navigate to specific group details
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

      case 'expense_details':
        // Navigate to expense details (within group context)
        if (intent.expenseId && intent.groupId) {
          const group = groups.find(g => g.id === intent.groupId) || 
                      (await SplittingService.getGroup(intent.groupId));
          if (group) {
            setSelectedGroup(group);
            setShowGroupDetails(true);
            setActiveTab('groups');
          }
        }
        break;

      case 'split_expense':
        // Navigate to split expense interface
        if (intent.groupId) {
          const group = groups.find(g => g.id === intent.groupId);
          if (group) {
            setSelectedGroupForExpense(group);
            setShowAddExpense(true);
          }
        }
        break;

      case 'friend_request':
        // Navigate to friend request
        setActiveTab('friends');
        if (intent.friendRequestId) {
          // The friend request modal will be handled by existing flow
          await loadFriends(); // Refresh to get pending requests
        }
        break;

      case 'friend_request_accepted':
        // Friend request was accepted
        setActiveTab('friends');
        await loadFriends(); // Refresh friends list
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

  const handleNotificationNavigation = async (notification: Notification) => {
    try {
      const { type, data } = notification;
      
      switch (type) {
        case 'friend_request':
          // Navigate to friends tab and show friend request modal
          setActiveTab('friends');
          if (data.friendRequestId && data.senderName) {
            // Create a minimal friend request object from notification data
            const friendRequestData = {
              id: data.friendRequestId,
              fromUserData: {
                fullName: data.senderName,
                email: data.senderEmail || '',
                avatar: data.senderAvatar
              },
              message: data.message || `${data.senderName} wants to be your friend`,
              status: 'pending' as const
            };
            
            setSelectedFriendRequest(friendRequestData);
            setShowFriendRequest(true);
          }
          break;

      case 'expense_added':
        // Navigate to the group and show group details with expenses tab
        if (data.groupId) {
          const group = groups.find(g => g.id === data.groupId);
          if (group) {
            setSelectedGroup(group);
            setShowGroupDetails(true);
            // Show a brief info about the new expense
            if (data.description && data.amount && data.senderName) {
              setTimeout(() => {
                Alert.alert(
                  'New Expense Added',
                  `${data.senderName} added "${data.description}" for ${data.currency || '$'}${data.amount} in ${data.groupName}`,
                  [{ text: 'OK' }]
                );
              }, 500);
            }
          } else {
            Alert.alert('Group Not Found', 'The group for this expense could not be found.');
          }
        }
        break;

      case 'group_invite':
        // Navigate to groups tab and show join group option with enhanced UI
        setActiveTab('groups');
        if (data.inviteCode && data.groupName) {
          Alert.alert(
            'Group Invitation 🎉',
            `${data.senderName || 'Someone'} invited you to join "${data.groupName}"${data.groupDescription ? `\n\n${data.groupDescription}` : ''}`,
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
                    Alert.alert(
                      'Welcome! 🎊', 
                      `You've successfully joined "${data.groupName}"! Start splitting expenses with your group.`,
                      [{ text: 'Awesome!' }]
                    );
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'Failed to join group');
                  }
                }
              }
            ]
          );
        }
        break;

      case 'group_message':
        // Open the group chat
        if (data.groupId) {
          const group = groups.find(g => g.id === data.groupId);
          if (group) {
            setSelectedGroup(group);
            setShowGroupChat(true);
          } else {
            Alert.alert('Group Not Found', 'The group for this message could not be found.');
          }
        }
        break;

      case 'payment_received':
        // Navigate to friends tab and show the relevant friend
        setActiveTab('friends');
        if (data.fromUserId) {
          const friend = friends.find(f => f.friendId === data.fromUserId);
          if (friend) {
            Alert.alert(
              'Payment Received',
              `You received a payment from ${friend.friendData.fullName}`,
              [{ text: 'OK' }]
            );
          }
        }
        break;

      case 'expense_settled':
        // Navigate to expenses tab or group details
        if (data.groupId) {
          const group = groups.find(g => g.id === data.groupId);
          if (group) {
            setSelectedGroup(group);
            setShowGroupDetails(true);
          }
        } else {
          // Navigate to expenses tab
          navigation.navigate('Expenses' as never);
        }
        break;

      case 'expense_approval_required':
        // Open expense approval modal
        if (data.approvalId) {
          setSelectedApprovalId(data.approvalId);
          setShowExpenseApproval(true);
        }
        break;
        
      case 'expense_approved':
      case 'expense_rejected':
        // Show approval result
        Alert.alert(
          type === 'expense_approved' ? 'Expense Approved' : 'Expense Rejected',
          notification.message,
          [{ text: 'OK' }]
        );
        break;
        
      case 'recurring_expense_created':
        // Navigate to recurring expenses view
        Alert.alert('Recurring Expense', notification.message);
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



const showBlockReasonDialog = (friend: Friend) => {
  Alert.alert(
    'Block Friend',
    `Why are you blocking ${friend.friendData.fullName}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Spam/Unwanted Contact', 
        onPress: () => blockFriendWithReason(friend, 'Spam or unwanted contact') 
      },
      { 
        text: 'Inappropriate Behavior', 
        onPress: () => blockFriendWithReason(friend, 'Inappropriate behavior or harassment') 
      },
      { 
        text: 'Privacy Concerns', 
        onPress: () => blockFriendWithReason(friend, 'Privacy and security concerns') 
      },
      { 
        text: 'Other Reason', 
        onPress: () => blockFriendWithReason(friend, 'Other personal reasons') 
      }
    ]
  );
};

const blockFriendWithReason = async (friend: Friend, reason: string) => {
  Alert.alert(
    'Confirm Block',
    `Are you sure you want to block ${friend.friendData.fullName}? This will:\n\n• Prevent them from sending you friend requests\n• Hide your activity from them in shared groups\n• Remove them from your friends list\n\nReason: ${reason}`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await SplittingService.blockFriend(user!.id, friend.friendId, reason);
            
            Alert.alert(
              'Friend Blocked',
              `${friend.friendData.fullName} has been blocked and will no longer be able to contact you.`,
              [{ text: 'OK' }]
            );
            
            // Refresh friends list
            await friendsManager.notifyFriendRemoved();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to block friend');
          }
        }
      }
    ]
  );
};
const showExpenseActionsMenu = (expense: Expense) => {
  // Check if current user is admin of the group this expense belongs to
  const isUserAdmin = groups.find(g => g.id === expense.groupId)
    ?.members.find(m => m.userId === user?.id)?.role === 'admin';
    
  const actions: Array<{
    text: string;
    style?: 'cancel' | 'destructive' | 'default';
    onPress?: () => void;
  }> = [
    {
      text: 'Cancel',
      style: 'cancel'
    }
  ];

  // Add settlement action if not settled
  if (!expense.isSettled) {
    actions.unshift({
      text: 'Settle Expense',
      onPress: () => {
        setSelectedExpenseForAction(expense);
        setShowExpenseSettlement(true);
      }
    });
  }

  // Add edit action
  actions.unshift({
    text: 'Edit Expense',
    onPress: () => {
      setSelectedExpenseForAction(expense);
      setShowEditExpense(true);
    }
  });

  // Add delete action (only for expense creator or admin)
  if (expense.paidBy === user?.id || isUserAdmin) {
    actions.unshift({
      text: 'Delete Expense',
      style: 'destructive',
      onPress: () => {
        setSelectedExpenseForAction(expense);
        setShowExpenseDeletion(true);
      }
    });
  }

  Alert.alert(
    expense.description,
    `${getCurrencySymbol(expense.currency)}${expense.amount.toFixed(2)} • ${expense.date.toLocaleDateString()}`,
    actions
  );
};
  // Handle payment
  const handlePayment = async (friendId: string, amount: number, method: string) => {
    try {
      if (!user?.id) return;
      
      const friend = friends.find(f => f.friendId === friendId);
      if (!friend) return;
      
      // Get available payment providers
      const providers = PaymentService.getAvailableProviders(user.currency, user.country);
      const selectedProvider = providers.find(p => p.id === method);
      
      if (!selectedProvider) {
        Alert.alert('Error', 'Payment method not available');
        return;
      }
      
      // Create payment request
      const paymentRequest = {
        amount,
        currency: user.currency,
        recipientId: friendId,
        recipientName: friend.friendData.fullName,
        recipientEmail: friend.friendData.email,
        description: `Payment via Spendy`
      };

      // Initiate payment
      await PaymentService.initiatePayment(
        method,
        paymentRequest,
        user.id,
        friendId
      );
      
      setShowPayment(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to initiate payment');
    }
  };

  // Handle manual settlement
  const handleManualSettlement = async (friendId: string, amount: number, description?: string) => {
    try {
      if (!user?.id) return;

      await SplittingService.markPaymentAsPaid(
        user.id,
        friendId,
        amount,
        description || 'Manual settlement'
      );

      // Refresh data
      await Promise.all([
        friendsManager.notifyBalanceUpdated(),
        loadRecentExpenses(),
        loadNotifications()
      ]);

      setShowManualSettlement(false);
      setSelectedFriend(null);

      Alert.alert('Success', 'Payment marked as paid successfully!');
    } catch (error: any) {
      console.error('Manual settlement error:', error);
      Alert.alert('Error', error.message || 'Failed to mark payment as paid');
    }
  };

  // Navigate to expenses modal instead of tab
  const navigateToExpenses = () => {
    setShowExpenseModal(true);
  };

  // Render overview tab
  const renderOverviewTab = () => (
    <ScrollView 
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Balance Summary - FIXED */}
      <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.balanceTitle}>Your Balance</Text>
        <View style={styles.balanceGrid}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceAmount}>${balances.totalOwed.toFixed(2)}</Text>
            <Text style={styles.balanceLabel}>You're owed</Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceAmount}>${balances.totalOwing.toFixed(2)}</Text>
            <Text style={styles.balanceLabel}>You owe</Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={[styles.balanceAmount, { color: '#FFD700' }]}>
              ${Math.abs(balances.netBalance).toFixed(2)}
            </Text>
            <Text style={styles.balanceLabel}>Net balance</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
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
          onPress={() => setShowAnalytics(true)}
        >
          <Ionicons name="analytics" size={24} color="#10B981" />
          <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Analytics</Text>
          <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
            View spending insights
          </Text>
        </TouchableOpacity>
      </View> 

      {/* Recent Expenses - FIXED navigation */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
          <TouchableOpacity onPress={navigateToExpenses}>
        <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>
       
        {expenses.length === 0 ? (
          <View style={styles.emptyExpenses}>
        <Text style={[styles.emptyExpensesText, { color: theme.colors.textSecondary }]}>
          No expenses yet. Add your first expense!
        </Text>
          </View>
        ) : (
          
          expenses.slice(0, 3).map((expense) => (
        <TouchableOpacity
          key={expense.id}
          style={styles.expenseItem}
          onPress={() => handleEditExpenseFromDetails(expense)}
        >
          <View style={styles.expenseLeft}>
            <Text style={styles.expenseIcon}>{expense.categoryIcon}</Text>
            <View>
          <Text style={[styles.expenseTitle, { color: theme.colors.text }]}>
            {expense.description}
          </Text>
          <Text style={[styles.expenseSubtitle, { color: theme.colors.textSecondary }]}>
            {expense.date.toLocaleDateString()} • Paid by {expense.paidByData.fullName}
          </Text>
            </View>
          </View>
          <View style={styles.expenseRight}>
            <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
          ${expense.amount.toFixed(2)}
            </Text>
            <View style={[
          styles.expenseStatus,
          { backgroundColor: expense.isSettled ? theme.colors.success + '20' : theme.colors.error + '20' }
            ]}>
          <Text style={[
            styles.expenseStatusText,
            { color: expense.isSettled ? theme.colors.success : theme.colors.error }
          ]}>
            {expense.isSettled ? 'Settled' : 'Pending'}
          </Text>
            </View>
          </View>
        </TouchableOpacity>
          ))
        )}
      </View>

      {/* Friends Overview */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Friends</Text>
          <TouchableOpacity onPress={() => setActiveTab('friends')}>
            <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {friends.length === 0 ? (
          <View style={styles.emptyExpenses}>
            <Text style={[styles.emptyExpensesText, { color: theme.colors.textSecondary }]}>
              No friends yet. Add your first friend!
            </Text>
          </View>
        ) : (
          friends.slice(0, 3).map((friend) => (
            <View key={friend.id} style={styles.friendItem}>
              <View style={styles.friendLeft}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarText}>
                    {friend.friendData.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.friendName, { color: theme.colors.text }]}>
                    {friend.friendData.fullName}
                  </Text>
                  <Text style={[styles.friendEmail, { color: theme.colors.textSecondary }]}>
                    {friend.friendData.email}
                  </Text>
                </View>
              </View>
              <View style={styles.friendRight}>
                {friend.balance === 0 ? (
                  <Text style={[styles.friendBalanceText, { color: theme.colors.textSecondary }]}>
                    Settled up
                  </Text>
                ) : friend.balance > 0 ? (
                  <Text style={[styles.friendBalanceText, { color: theme.colors.success }]}>
                    +${Math.abs(friend.balance).toFixed(2)}
                  </Text>
                ) : (
                  <Text style={[styles.friendBalanceText, { color: theme.colors.error }]}>
                    -${Math.abs(friend.balance).toFixed(2)}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  // FIX: Render groups tab with empty state
  const renderGroupsTab = () => (
    <ScrollView 
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: theme.colors.text }]}>Your Groups</Text>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowCreateGroup(true)}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.headerButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* FIX: Add empty state for groups */}
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
        groups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={[styles.groupCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => {
              setSelectedGroup(group);
              setShowGroupDetails(true);
            }}
          >
            <View style={styles.groupHeader}>
              <View style={styles.groupLeft}>
                <Text style={styles.groupAvatar}>{group.avatar}</Text>
                <View>
                  <Text style={[styles.groupName, { color: theme.colors.text }]}>
                    {group.name}
                  </Text>
                  <Text style={[styles.groupMembers, { color: theme.colors.textSecondary }]}>
                    {group.members.length} members
                  </Text>
                </View>
              </View>
              <View style={styles.groupActions}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedGroup(group);
                    setShowQRCode(true);
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
                  ${group.totalExpenses.toFixed(2)}
                </Text>
              </View>
              <View style={styles.groupStat}>
                <Text style={[styles.groupStatLabel, { color: theme.colors.textSecondary }]}>
                  Your share
                </Text>
                <Text style={[styles.groupStatValue, { color: theme.colors.text }]}>
                  ${(group.totalExpenses / group.members.length).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.groupFooter}>
              <Text style={[styles.groupActivity, { color: theme.colors.textSecondary }]}>
                Last activity: {group.updatedAt.toLocaleDateString()}
              </Text>
              <View style={styles.groupFooterActions}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedGroup(group);
                    setShowGroupChat(true);
                  }}
                  style={[styles.chatButton, { backgroundColor: theme.colors.primary + '20' }]}
                >
                  <Ionicons name="chatbubble" size={16} color={theme.colors.primary} />
                  <Text style={[styles.chatButtonText, { color: theme.colors.primary }]}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedGroup(group);
                    setShowGroupSettlement(true);
                  }}
                  style={[styles.settlementButton, { backgroundColor: theme.colors.success + '20' }]}
                >
                  <Ionicons name="card" size={16} color={theme.colors.success} />
                  <Text style={[styles.settlementButtonText, { color: theme.colors.success }]}>Settle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedGroupForExpense(group);
                    setShowAddExpense(true);
                  }}
                  style={[styles.addExpenseButton, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={styles.addExpenseButtonText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  // Render friends tab
  const renderFriendsTab = () => (
    <ScrollView 
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.tabHeader}>
        <Text style={[styles.tabTitle, { color: theme.colors.text }]}>Friends</Text>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowAddFriend(true)}
        >
          <Ionicons name="person-add" size={20} color="white" />
          <Text style={styles.headerButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {friends.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Friends Yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
            Add friends to start splitting expenses together
          </Text>
          <TouchableOpacity
            style={[styles.addFirstFriendButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowAddFriend(true)}
          >
            <Text style={styles.addFirstFriendText}>Add Your First Friend</Text>
          </TouchableOpacity>
        </View>
      ) : (
        friends.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={[styles.friendCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => showFriendActionsMenu(friend)}
            onLongPress={() => showFriendActionsMenu(friend)}
          >
            <View style={styles.friendCardHeader}>
              <View style={styles.friendLeft}>
                <View style={[styles.friendAvatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.friendAvatarText}>
                    {friend.friendData.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.friendName, { color: theme.colors.text }]}>
                    {friend.friendData.fullName}
                  </Text>
                  <Text style={[styles.friendEmail, { color: theme.colors.textSecondary }]}>
                    {friend.friendData.email}
                  </Text>
                  {/* Show friend status */}
                  <Text style={[
                    styles.friendStatus, 
                    { 
                      color: friend.status === 'accepted' ? theme.colors.success : 
                             friend.status === 'invited' ? theme.colors.primary : 
                             friend.status === 'pending' ? theme.colors.primary : 
                             friend.status === 'blocked' ? theme.colors.error :
                             theme.colors.textSecondary
                    }
                  ]}>
                    {friend.status === 'accepted' ? '✓ Friends' : 
                     friend.status === 'invited' ? '📤 Invitation Sent' : 
                     friend.status === 'pending' ? '⏳ Pending Response' : 
                     friend.status === 'blocked' ? '🚫 Blocked' :
                     'Unknown'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.friendActions}>
                {/* Quick payment button for accepted friends with balance */}
                {friend.balance !== 0 && friend.status === 'accepted' && (
                  <TouchableOpacity
                    style={[styles.payButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                      setSelectedFriend(friend);
                      setShowPayment(true);
                    }}
                  >
                    <Text style={styles.payButtonText}>
                      {friend.balance > 0 ? 'Request' : 'Pay'}
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* Options button */}
                <TouchableOpacity
                  style={styles.optionsButton}
                  onPress={() => showFriendActionsMenu(friend)}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.friendBalance}>
              {friend.status !== 'accepted' ? (
                <Text style={[styles.balanceText, { color: theme.colors.textSecondary }]}>
                  {friend.status === 'invited' && friend.invitedAt && 
                    `Invited ${friend.invitedAt.toLocaleDateString()}`
                  }
                  {friend.status === 'blocked' && 'Blocked'}
                </Text>
              ) : friend.balance === 0 ? (
                <Text style={[styles.balanceText, { color: theme.colors.textSecondary }]}>
                  You're all settled up! 🎉
                </Text>
              ) : friend.balance > 0 ? (
                <Text style={[styles.balanceText, { color: theme.colors.success }]}>
                  {friend.friendData.fullName} owes you ${Math.abs(friend.balance).toFixed(2)}
                </Text>
              ) : (
                <Text style={[styles.balanceText, { color: theme.colors.error }]}>
                  You owe {friend.friendData.fullName} ${Math.abs(friend.balance).toFixed(2)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header - FIXED notifications */}
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
            onPress={() => {
              setQrScanSource('direct');
              setShowQRScanner(true);
            }}
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
            onPress={() => setShowAnalytics(true)}
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

      {/* Modals */}
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
      
      <CreateGroupModal
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onSubmit={handleCreateGroup}
        friends={friends}
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
          setShowGroupChat(true);
        }}
        onGroupLeft={loadGroups}
        onRefresh={loadGroups}
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
          setShowGroupChat(false); // Close chat modal
          setSelectedGroupForExpense(selectedGroup); // Set the group for expense
          setShowAddExpense(true); // Open add expense modal
        }}
      />

      <ReceiptScannerModal
        visible={false}
        onClose={() => {}}
        onReceiptProcessed={(receiptData) => {
          console.log('Receipt processed:', receiptData);
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
          // Refresh data after deletion
          Promise.all([
            loadGroups(),
            loadRecentExpenses(),
            friendsManager.notifyBalanceUpdated()
          ]);
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
        friendsManager.notifyBalanceUpdated();
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
        friendsManager.notifyBalanceUpdated();
      }}
      isUserAdmin={groups.find(g => g.id === selectedExpenseForAction?.groupId)
        ?.members.find(m => m.userId === user?.id)?.role === 'admin'}
    />

    {/* NEW IMPORTANT FLOW MODALS */}
    <RecurringExpenseModal
      visible={showRecurringExpense}
      onClose={() => setShowRecurringExpense(false)}
      onSubmit={handleCreateRecurring}
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
      onRefresh={loadRecentExpenses}
    />      <QRCodeScanner
        visible={showQRScanner}
        onClose={() => {
          setShowQRScanner(false);
          setQrScanSource(null);
          // Reset scanner state
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

          // Handle special error cases from QRCodeScanner
          if (qrData === 'INVALID_QR_FORMAT') {
            Alert.alert(
              'Invalid QR Code',
              'This is not a valid Spendy QR code. Please scan a QR code generated by Spendy.',
              [
                {
                  text: 'Try Again',
                  onPress: () => {
                    // Keep scanner open for retry
                  }
                },
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
                {
                  text: 'Try Again',
                  onPress: () => {
                    // Keep scanner open for retry
                  }
                },
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
              // Close scanner immediately
              setShowQRScanner(false);
              setQrScanSource(null);
              
              // Show success message with slight delay
              setTimeout(() => {
                Alert.alert(
                  'Success',
                  'QR code processed successfully!',
                  [{
                    text: 'OK',
                    onPress: async () => {
                      // Refresh data after successful scan
                      await Promise.all([
                        friendsManager.notifyFriendAdded(),
                        loadGroups(),
                        loadRecentExpenses()
                      ]);
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
                  {
                    text: 'Try Again',
                    onPress: () => {
                      // Keep scanner open for retry
                    }
                  }
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
                {
                  text: 'Try Again',
                  onPress: () => {
                    // Keep scanner open for retry
                  }
                }
              ]
            );
          }
        }}
      />

    </SafeAreaView>
  );
}

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
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  balanceTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceAmount: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
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
    paddingHorizontal: 4, // Add horizontal padding
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 60, // Ensure consistent height
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // Allow flex shrinking
  },
  expenseIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24, // Fixed width for icon alignment
    textAlign: 'center',
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '500',
    flexShrink: 1, // Allow text to shrink if needed
  },
  expenseSubtitle: {
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1, // Allow text to shrink if needed
  },
  expenseRight: {
    alignItems: 'flex-end',
    minWidth: 80, // Ensure minimum width for amounts
    marginLeft: 8,
  },

  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4, // Add horizontal padding
    minHeight: 60, // Ensure consistent height
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // Allow flex shrinking
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#4F46E5', // Consistent background
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    flexShrink: 1, // Allow text to shrink if needed
  },
  friendEmail: {
    fontSize: 12,
    marginTop: 2,
    flexShrink: 1, // Allow text to shrink if needed
  },
  friendRight: {
    alignItems: 'flex-end',
    minWidth: 80, // Ensure minimum width for balance
    marginLeft: 8,
  },
  friendBalance: {
    alignItems: 'flex-end',
  },
  friendBalanceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  friendCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  friendCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  friendActions: {
    flexDirection: 'row',
  },
  payButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  payButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 14,
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
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupActivity: {
    fontSize: 12,
  },
  addExpenseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6, // Keep consistent with other buttons
    borderRadius: 6,
    minHeight: 32, // Add consistent height
    justifyContent: 'center', // Center the text
    alignItems: 'center',
  },
  addExpenseButtonText: {
    color: 'white',
    fontSize: 12,
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
groupFooterActions: {
    flexDirection: 'row',
    alignItems: 'center', // Add this to center align all buttons
    gap: 8,
    flex: 1, // Add this to take remaining space
    justifyContent: 'flex-end', // Add this to align buttons to the right
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6, // Standardize padding
    borderRadius: 6,
    gap: 4,
    minHeight: 32, // Add consistent height
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  settlementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6, // Standardize padding
    borderRadius: 6,
    gap: 4,
    minHeight: 32, // Add consistent height
  },
  settlementButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  friendStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
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
  addFirstFriendButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstFriendText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  optionsButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyExpenses: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyExpensesText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  // Missing styles added
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  expenseStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  friendAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  groupMembers: {
    fontSize: 14,
    opacity: 0.7,
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupActionButton: {
    padding: 8,
    marginLeft: 8,
  },
});