// src/screens/main/RealSplittingScreen.tsx
import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';

// Import our real services
import { SplittingService, Friend, Group, Expense, Notification } from '@/services/firebase/splitting';
import { PaymentService } from '@/services/payments/PaymentService';
import { PushNotificationService } from '@/services/notifications/PushNotificationService';
import { QRCodeService } from '@/services/qr/QRCodeService';

// Import modals
import AddExpenseModal from '@/components/modals/AddExpenseModal';
import AddFriendModal from '@/components/modals/AddFriendModal';
import CreateGroupModal from '@/components/modals/CreateGroupModal';
import QRCodeModal from '@/components/modals/QRCodeModal';
import PaymentModal from '@/components/modals/PaymentModal';
import GroupChatModal from '@/components/modals/GroupChatModal';
import ReceiptScannerModal from '@/components/modals/ReceiptScannerModal';
import GroupDetailsModal from '@/components/modals/GroupDetailsModal';

export default function RealSplittingScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
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

  
  // Modal states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

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
        const pushService = PushNotificationService.getInstance();
        await pushService.initialize(user.id);
        
        // Load initial data
        await Promise.all([
          loadFriends(),
          loadGroups(),
          loadRecentExpenses()
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
    };
  }, [user?.id]);

  // Load friends data
const loadFriends = async () => {
  try {
    if (!user?.id) return;
    
    console.log('Loading friends for user:', user.id);
    const friendsData = await SplittingService.getFriends(user.id);
    setFriends(friendsData);
    
    // Calculate balances safely (only for accepted friends)
    const acceptedFriends = friendsData.filter(friend => friend.status === 'accepted');
    const totalOwed = acceptedFriends.reduce((sum, friend) => 
      sum + Math.max(0, friend.balance || 0), 0
    );
    const totalOwing = acceptedFriends.reduce((sum, friend) => 
      sum + Math.max(0, -(friend.balance || 0)), 0
    );
    
    setBalances({
      totalOwed,
      totalOwing,
      netBalance: totalOwed - totalOwing
    });
  } catch (error) {
    console.error('Load friends error:', error);
    setFriends([]); // Set empty array as fallback
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
        loadFriends(),
        loadGroups(),
        loadRecentExpenses()
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Show friend request alert
  const showFriendRequestAlert = (request: any) => {
    Alert.alert(
      'Friend Request',
      `${request.fromUserData.fullName} wants to be your friend`,
      [
        {
          text: 'Decline',
          style: 'cancel'
        },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await SplittingService.acceptFriendRequest(request.id);
              await loadFriends(); // Refresh friends list
              Alert.alert('Success', 'Friend request accepted!');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to accept friend request');
            }
          }
        }
      ]
    );
  };

  // Handle add friend
  const handleAddFriend = async (email: string, method: 'email' | 'sms' | 'whatsapp' | 'qr') => {
    try {
      if (!user?.id) return;
      
      if (method === 'email') {
        await SplittingService.sendFriendRequest(user.id, email);
        Alert.alert('Success', 'Friend request sent!');
      } else if (method === 'qr') {
        // Generate QR code for friend invite
        const qrData = QRCodeService.generateFriendInviteQR(
          user.id,
          {
            fullName: user.fullName,
            email: user.email,
            profilePicture: user.profilePicture
          }
        );
        setShowQRCode(true);
      }
      
      setShowAddFriend(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add friend');
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
      currency: groupData.currency || user.currency || 'AUD',
      inviteCode, // Add the invite code
      totalExpenses: 0,
      isActive: true,
      members: [{
        userId: user.id,
        userData: {
          fullName: user.fullName,
          email: user.email,
          avatar: user.profilePicture || ''
        },
        role: 'admin' as const,
        balance: 0,
        joinedAt: new Date(),
        isActive: true
      }],
      settings: {
        allowMemberInvites: true,
        requireApproval: false,
        currency: user.currency || 'AUD'
      }
    });
    
    await loadGroups(); // Refresh groups list
    
    // Show success with invite code
    Alert.alert(
      'Group Created! 🎉', 
      `"${groupData.name}" has been created successfully!\n\nInvite Code: ${inviteCode}\n\nYou can now invite friends using this code, QR code, or direct invitations.`,
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
const handleAddExpense = async (expenseData: any) => {
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
    
    // Force refresh all data
    console.log('Expense added, refreshing data...');
    await Promise.all([
      loadGroups(),
      loadRecentExpenses(),
      loadFriends()
    ]);
    
    // Additional refresh to ensure UI updates
    setTimeout(() => {
      loadRecentExpenses();
    }, 1000);
    
    Alert.alert('Success', 'Expense added successfully!');
    setShowAddExpense(false);
  } catch (error: any) {
    console.error('Add expense error:', error);
    Alert.alert('Error', error.message || 'Failed to add expense');
  }
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

  // Render overview tab
  const renderOverviewTab = () => (
    <ScrollView 
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Balance Summary */}
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
      </View>

      {/* Recent Expenses */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
          <TouchableOpacity onPress={() => setActiveTab('expenses')}>
            <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {expenses.slice(0, 3).map((expense) => (
          <View key={expense.id} style={styles.expenseItem}>
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
          </View>
        ))}
      </View>

      {/* Friends Overview */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Friends</Text>
          <TouchableOpacity onPress={() => setActiveTab('friends')}>
            <Text style={[styles.sectionLink, { color: theme.colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {friends.slice(0, 3).map((friend) => (
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
                <Text style={[styles.friendBalance, { color: theme.colors.textSecondary }]}>
                  Settled up
                </Text>
              ) : friend.balance > 0 ? (
                <Text style={[styles.friendBalance, { color: theme.colors.success }]}>
                  +${Math.abs(friend.balance).toFixed(2)}
                </Text>
              ) : (
                <Text style={[styles.friendBalance, { color: theme.colors.error }]}>
                  -${Math.abs(friend.balance).toFixed(2)}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // Render groups tab
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

    {groups.map((group) => (
      <TouchableOpacity
        key={group.id}
        style={[styles.groupCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => {
          setSelectedGroup(group);
          setShowGroupDetails(true); // Open details instead of chat
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
                setShowAddExpense(true);
              }}
              style={[styles.addExpenseButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.addExpenseButtonText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    ))}
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

    {friends.map((friend) => (
      <View key={friend.id} style={[styles.friendCard, { backgroundColor: theme.colors.surface }]}>
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
                         friend.status === 'pending' ? theme.colors.primary : theme.colors.textSecondary
                }
              ]}>
                {friend.status === 'accepted' ? '✓ Friends' : 
                 friend.status === 'invited' ? '📤 Invitation Sent' : 
                 friend.status === 'pending' ? '⏳ Pending Response' : 'Unknown'}
              </Text>
            </View>
          </View>
          
          <View style={styles.friendActions}>
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
          </View>
        </View>

        <View style={styles.friendBalance}>
          {friend.status !== 'accepted' ? (
            <Text style={[styles.balanceText, { color: theme.colors.textSecondary }]}>
              {friend.status === 'invited' && friend.invitedAt && 
                `Invited ${friend.invitedAt.toLocaleDateString()}`
              }
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
      </View>
    ))}
  </ScrollView>
);


  // Tab navigation
  const tabs = [
    { id: 'overview', title: 'Overview', icon: 'home' },
    { id: 'groups', title: 'Groups', icon: 'people' },
    { id: 'friends', title: 'Friends', icon: 'person-add' },
    { id: 'expenses', title: 'Expenses', icon: 'receipt' },
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
            onPress={() => setShowQRCode(true)}
          >
            <Ionicons name="qr-code" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction}>
            <Ionicons name="notifications" size={24} color={theme.colors.text} />
            {notifications.length > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={styles.notificationBadgeText}>{notifications.length}</Text>
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
      onPress={() => setActiveTab(tab.id)}
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
        {/* Add other tabs as needed */}
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
      />
      
      <AddFriendModal
        visible={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onSubmit={handleAddFriend}
      />
      
      <CreateGroupModal
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onSubmit={handleCreateGroup}
        friends={friends}
      />
      
      {/* Add the new GroupDetailsModal */}
    <GroupDetailsModal
      visible={showGroupDetails}
      onClose={() => setShowGroupDetails(false)}
      group={selectedGroup}
      currentUser={user}
      onAddExpense={() => {
        setShowGroupDetails(false);
        setShowAddExpense(true);
      }}
      onOpenChat={() => {
        setShowGroupDetails(false);
        setShowGroupChat(true);
      }}
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
      />

      <ReceiptScannerModal
        visible={false}
        onClose={() => {}}
        onReceiptProcessed={(receiptData) => {
          console.log('Receipt processed:', receiptData);
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
    borderBottomWidth: 0, // Remove the problematic border
    paddingVertical: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 20, // More rounded for better look
  },
  activeTab: {
    // Don't put backgroundColor here - it's applied inline with theme
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  actionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
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
  // Add more styles for other components...
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  expenseSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 4,
  },
  expenseStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  groupCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  },
  groupAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupMembers: {
    fontSize: 12,
    marginTop: 2,
  },
  groupActions: {
    flexDirection: 'row',
  },
  groupActionButton: {
    marginLeft: 12,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  friendEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  friendRight: {
    alignItems: 'flex-end',
  },
  friendBalance: {
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
    paddingVertical: 6,
    borderRadius: 6,
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
    gap: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  friendStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});