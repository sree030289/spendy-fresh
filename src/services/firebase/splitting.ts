// src/services/firebase/splitting.ts
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './config';
import { User } from '../../types';
import { getCurrencySymbol } from '../../utils/currency';
import { PushNotificationData } from '../notifications/PushNotificationService';

// Types for Splitting Features
export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  friendData: {
    id: string;
    fullName: string;
    email: string;
    mobile?: string;
    avatar?: string;
    profilePicture?: string;
  };
  status: 'pending' | 'accepted' | 'blocked' | 'invited';
  balance: number;
  lastActivity: Date;
  createdAt: Date;
  invitedAt?: Date;
  requestId?: string;
  invitationMethod?: 'email' | 'sms' | 'whatsapp' | 'qr'; // Add this field
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar: string;
  createdBy: string;
  members: GroupMember[];
  totalExpenses: number;
  currency: string;
  isActive: boolean;
  inviteCode: string;
  settings: {
    allowMemberInvites: boolean;
    requireApproval: boolean;
    currency: string;
    approvalThreshold?: number; // Amount that requires approval
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  userId: string;
  userData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  role: 'admin' | 'member';
  balance: number;
  joinedAt: Date;
  isActive: boolean;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  categoryIcon: string;
  paidBy: string;
  paidByData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  splitType: 'equal' | 'custom' | 'percentage';
  splitData: ExpenseSplit[];
  receiptUrl?: string;
  receiptData?: ReceiptData;
  tags: string[];
  notes?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  isSettled: boolean;
}

export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
  isPaid: boolean;
  paidAt?: Date;
}

export interface ReceiptData {
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  tax?: number;
  tip?: number;
  merchant?: string;
  date?: Date;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  toUserId: string;
  toUserEmail: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'expense_added' | 'payment_received' | 'group_invite' | 'expense_settled' | 'group_message'|'expense_approval_required'|'expense_approved'|'expense_rejected'|'recurring_expense_created'|'payment_request';
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: Date;
}

export interface Payment {
  id: string;
  fromUserId: string;
  toUserId: string;
  expenseId?: string;
  groupId?: string;
  amount: number;
  currency: string;
  method: 'bank' | 'paypal' | 'gpay' | 'phonepe' | 'paytm' | 'upi' | 'manual_settlement';
  provider?: string;
  transactionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  deepLinkUsed?: boolean;
  description?: string;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
// Chat Message Interface
export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'expense' | 'system';
  expenseData?: {
    id: string;
    description: string;
    amount: number;
    currency: string;
  };
}
// RECURRING EXPENSE METHODS
export interface RecurringExpense {
  id: string;
  templateName: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  categoryIcon: string;
  groupId: string;
  paidBy: string;
  paidByData: {
    fullName: string;
    email: string;
  };
  splitType: 'equal' | 'custom' | 'percentage';
  splitData: ExpenseSplit[];
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  nextDueDate: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastProcessedDate?: Date;
  processedCount: number;
  maxOccurrences?: number;
}

// ANALYTICS AND INSIGHTS
export interface ExpenseAnalytics {
  totalSpent: number;
  totalOwed: number;
  totalOwing: number;
  averageExpense: number;
  expenseCount: number;
  monthlySpending: Array<{ month: string; amount: number }>;
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  groupAnalytics: Array<{ groupName: string; totalSpent: number; memberCount: number }>;
  splitWithMostFrequent: { userId: string; userName: string; count: number };
}

// EXPORT/IMPORT DATA
export interface ExportData {
  expenses: Expense[];
  groups: Group[];
  friends: Friend[];
  exportDate: Date;
  exportedBy: string;
  version: string;
}

// OFFLINE SYNC SUPPORT
export interface OfflineExpense {
  id: string;
  tempId: string;
  expenseData: any;
  status: 'pending' | 'synced' | 'failed';
  createdAt: Date;
  lastSyncAttempt?: Date;
  errorMessage?: string;
  retryCount: number;
}

// EXPENSE APPROVAL SYSTEM
export interface ExpenseApproval {
  id: string;
  expenseId: string;
  groupId: string;
  requestedBy: string;
  requestedByData: {
    fullName: string;
    email: string;
  };
  approvalThreshold: number; // Amount that requires approval
  status: 'pending' | 'approved' | 'rejected';
  approvers: Array<{
    userId: string;
    userName: string;
    decision: 'approved' | 'rejected';
    reason?: string;
    timestamp: Date;
  }>;
  requiredApprovals: number;
  receivedApprovals: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

// EXPENSE TEMPLATES
export interface ExpenseTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryIcon: string;
  defaultAmount?: number;
  splitType: 'equal' | 'custom' | 'percentage';
  defaultSplitData?: ExpenseSplit[];
  tags: string[];
  createdBy: string;
  groupId?: string; // Optional - can be group-specific or personal
  isPublic: boolean; // Can other group members use this template
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}


// SETTLEMENT TRANSACTION INTERFACES
export interface SettlementTransaction {
  id: string;
  fromUserId: string;
  fromUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  toUserId: string;
  toUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  amount: number;
  currency: string;
  description: string;
  groupId?: string;
  groupData?: {
    name: string;
    description?: string;
  };
  expenseId?: string; // Reference to the original expense being settled
  method: 'cash' | 'bank' | 'venmo' | 'paypal' | 'upi' | 'manual_settlement';
  status: 'pending' | 'completed' | 'failed';
  notes?: string;
  settlementDate: Date;
  createdAt: Date;
  updatedAt: Date;
}


// Splitting Service Class
export class SplittingService {
  
  // FRIENDS MANAGEMENT
  static async sendFriendRequest(fromUserId: string, toEmail: string, message?: string): Promise<{ success: boolean; isNewUser?: boolean; message?: string }> {
  try {
    // Get current user data first
    const fromUserDoc = await getDoc(doc(db, 'users', fromUserId));
    if (!fromUserDoc.exists()) {
      throw new Error('Your user account was not found. Please try logging in again.');
    }
    const fromUserData = fromUserDoc.data();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail.toLowerCase())) {
      throw new Error('Please enter a valid email address.');
    }
    
    // Check if trying to add themselves
    if (fromUserData.email.toLowerCase() === toEmail.toLowerCase()) {
      throw new Error('You cannot add yourself as a friend.');
    }
    
    // Check for existing friendship or pending requests
    const existingCheck = await this.checkExistingFriendship(fromUserId, toEmail);
    
    if (existingCheck.isFriend) {
      const { friendData, status } = existingCheck;
      // Find user by email
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', toEmail.toLowerCase())
    );
    const userSnapshot = await getDocs(usersQuery);
    
    if (!userSnapshot.empty) {
      const toUser = userSnapshot.docs[0];
      const toUserId = toUser.id;
      
      // CHECK IF BLOCKED - This prevents spam and harassment
      const isBlocked = await this.isUserBlocked(fromUserId, toUserId);
      if (isBlocked) {
        throw new Error('Unable to send friend request. This user has restricted friend requests.');
      }
    }
      switch (status) {
        case 'accepted':
          throw new Error(`${friendData.fullName} is already in your friends list.`);
        case 'request_sent':
          throw new Error(`You have already sent a friend request to ${friendData.fullName}. Please wait for them to respond.`);
        case 'request_received':
          throw new Error(`${friendData.fullName} has already sent you a friend request. Check your notifications to accept it.`);
        case 'pending':
          throw new Error(`A friend request with ${friendData.fullName} is already pending.`);
        default:
          throw new Error(`You already have a connection with ${friendData.fullName}.`);
      }
    }
    
    // Find user by email
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', toEmail.toLowerCase())
    );
    const userSnapshot = await getDocs(usersQuery);
    
    if (userSnapshot.empty) {
      // User not found - create invitation for when they join
      const invitationResult = await this.createEmailInvitation(fromUserId, fromUserData, toEmail, message);
      return {
        success: true,
        isNewUser: invitationResult.isNewUser,
        message: invitationResult.message
      };
    }
    
    const toUser = userSnapshot.docs[0];
    const toUserId = toUser.id;
    const toUserData = toUser.data();
    
    // Create friend request with proper structure and validation
    const friendRequest = {
      fromUserId,
      fromUserData: {
        fullName: fromUserData?.fullName || 'Unknown User',
        email: fromUserData?.email || '',
        avatar: fromUserData?.profilePicture || '',
        mobile: fromUserData?.mobile || ''
      },
      toUserId,
      toUserData: {
        fullName: toUserData?.fullName || 'Unknown User',
        email: toEmail.toLowerCase(),
        avatar: toUserData?.profilePicture || '',
        mobile: toUserData?.mobile || ''
      },
      message: message || '',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(collection(db, 'friendRequests'), friendRequest);
    console.log('✅ Friend request created:', docRef.id);
    
    // Create notification for the recipient
    await this.createNotification({
      userId: toUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${fromUserData?.fullName || 'Someone'} wants to be your friend`,
      data: { 
        friendRequestId: docRef.id,
        fromUserId,
        senderName: fromUserData?.fullName || 'Unknown User',
        senderEmail: fromUserData?.email || '',
        senderAvatar: fromUserData?.profilePicture || '',
        message: message || `${fromUserData?.fullName || 'Someone'} wants to be your friend`
      },
      isRead: false,
      createdAt: new Date()
    });

    return {
      success: true,
      isNewUser: false,
      message: `Friend request sent to ${toUserData?.fullName || toEmail}!`
    };
    
  } catch (error) {
    console.error('❌ Send friend request error:', error);
    throw error;
  }
}

// Enhanced blocking implementation in splitting.ts
static async blockFriend(userId: string, friendId: string, reason?: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // 1. Update existing friendship to blocked status
    const userFriendshipQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      where('friendId', '==', friendId)
    );
    const userSnapshot = await getDocs(userFriendshipQuery);
    
    userSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'blocked',
        blockedAt: new Date(),
        blockReason: reason || 'No reason provided',
        updatedAt: new Date()
      });
    });
    
    // 2. Create a block record for future prevention
    const blockRecord = {
      blockedBy: userId,
      blockedUser: friendId,
      reason: reason || 'No reason provided',
      createdAt: new Date(),
      isActive: true
    };
    
    batch.set(doc(collection(db, 'blockedUsers')), blockRecord);
    
    // 3. Remove any pending friend requests between users
    const pendingRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('status', '==', 'pending')
    );
    const pendingSnapshot = await getDocs(pendingRequestsQuery);
    
    pendingSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if ((data.fromUserId === userId && data.toUserId === friendId) ||
          (data.fromUserId === friendId && data.toUserId === userId)) {
        batch.update(doc.ref, {
          status: 'blocked',
          blockedAt: new Date()
        });
      }
    });
    
    // 4. Hide user from group member lists (they can still see expenses but not interact)
    // This is handled in the UI layer by filtering out blocked users
    
    await batch.commit();
    
    console.log('Friend blocked successfully with enhanced protection');
    
  } catch (error) {
    console.error('❌ Block friend error:', error);
    throw new Error('Failed to block friend. Please try again.');
  }
}

// Check if a user is blocked before sending friend requests
static async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
  try {
    const blockQuery = query(
      collection(db, 'blockedUsers'),
      where('blockedBy', '==', targetUserId),
      where('blockedUser', '==', userId),
      where('isActive', '==', true)
    );
    
    const blockSnapshot = await getDocs(blockQuery);
    return !blockSnapshot.empty;
  } catch (error) {
    console.error('Check block status error:', error);
    return false;
  }
}

// Get blocked users list for management
static async getBlockedUsers(userId: string): Promise<Array<{
  id: string;
  blockedUser: string;
  blockedUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  reason: string;
  blockedAt: Date;
}>> {
  try {
    const blockedQuery = query(
      collection(db, 'blockedUsers'),
      where('blockedBy', '==', userId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(blockedQuery);
    const blockedUsers = [];
    
    for (const docSnapshot of snapshot.docs) {
      const blockData = docSnapshot.data();
      
      // Get blocked user data
      const userDoc = await getDoc(doc(db, 'users', blockData.blockedUser));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        blockedUsers.push({
          id: docSnapshot.id,
          blockedUser: blockData.blockedUser,
          blockedUserData: {
            fullName: userData.fullName,
            email: userData.email,
            avatar: userData.profilePicture
          },
          reason: blockData.reason,
          blockedAt: blockData.createdAt.toDate()
        });
      }
    }
    
    return blockedUsers;
  } catch (error) {
    console.error('Get blocked users error:', error);
    return [];
  }
}

// Unblock user
static async unblockUser(userId: string, blockedUserId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // 1. Deactivate block record
    const blockQuery = query(
      collection(db, 'blockedUsers'),
      where('blockedBy', '==', userId),
      where('blockedUser', '==', blockedUserId),
      where('isActive', '==', true)
    );
    
    const blockSnapshot = await getDocs(blockQuery);
    blockSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        isActive: false,
        unblockedAt: new Date()
      });
    });
    
    // 2. Update friendship status back to accepted (if it exists)
    const friendshipQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      where('friendId', '==', blockedUserId),
      where('status', '==', 'blocked')
    );
    
    const friendshipSnapshot = await getDocs(friendshipQuery);
    friendshipSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'accepted',
        blockedAt: null,
        blockReason: null,
        updatedAt: new Date()
      });
    });
    
    await batch.commit();
    
    console.log('User unblocked successfully');
    
  } catch (error) {
    console.error('Unblock user error:', error);
    throw new Error('Failed to unblock user. Please try again.');
  }
}

// Unblock a friend
static async unblockFriend(userId: string, friendId: string): Promise<void> {
  try {
    const friendshipQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      where('friendId', '==', friendId),
      where('status', '==', 'blocked')
    );
    const snapshot = await getDocs(friendshipQuery);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'accepted',
        blockedAt: null,
        updatedAt: new Date()
      });
    });
    
    await batch.commit();
    
    console.log('Friend unblocked successfully');
    
  } catch (error) {
    console.error('Unblock friend error:', error);
    throw new Error('Failed to unblock friend. Please try again.');
  }
}

static async createEmailInvitation(fromUserId: string, fromUserData: any, toEmail: string, message?: string): Promise<{ isNewUser: boolean; message: string }> {
  try {
    // Create an email invitation record
    const emailInvitation = {
      fromUserId,
      fromUserData: {
        fullName: fromUserData?.fullName || 'Unknown User',
        email: fromUserData?.email || '',
        avatar: fromUserData?.profilePicture || ''
      },
      toEmail: toEmail.toLowerCase(),
      message: message || '',
      type: 'email_invitation',
      status: 'sent',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
    
    await addDoc(collection(db, 'emailInvitations'), emailInvitation);
    
    console.log(`📧 Email invitation saved for ${toEmail} - will auto-send friend request when they join`);
    
    // TODO: Send actual email invitation via Firebase Functions
    // Return success info instead of throwing error
    return {
      isNewUser: true,
      message: `${toEmail} is not on Spendy yet. We've saved your invitation and will automatically send them a friend request when they join!`
    };
    
  } catch (error) {
    console.error('❌ Create email invitation error:', error);
    throw error;
  }
}

static async processEmailInvitations(newUserEmail: string, newUserId: string): Promise<void> {
  try {
    const invitationsQuery = query(
      collection(db, 'emailInvitations'),
      where('toEmail', '==', newUserEmail.toLowerCase()),
      where('status', '==', 'sent')
    );
    
    const snapshot = await getDocs(invitationsQuery);
    
    for (const invitationDoc of snapshot.docs) {
      const invitation = invitationDoc.data();
      
      // Create friend request
      const result = await this.sendFriendRequest(
        invitation.fromUserId,
        newUserEmail,
        `Welcome to Spendy! ${invitation.fromUserData.fullName} invited you to connect.`
      );
      
      console.log('✅ Processed email invitation:', result.message);
      
      // Mark invitation as processed
      await updateDoc(invitationDoc.ref, {
        status: 'processed',
        processedAt: new Date(),
        newUserId
      });
    }
    
  } catch (error) {
    console.error('❌ Process email invitations error:', error);
    // Don't throw - this is a background process
  }
}
  
static async acceptFriendRequest(requestId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // Get friend request
    const requestDoc = await getDoc(doc(db, 'friendRequests', requestId));
    if (!requestDoc.exists()) {
      throw new Error('Friend request not found');
    }
    
    const requestData = requestDoc.data() as FriendRequest;
    
    // Update request status
    batch.update(doc(db, 'friendRequests', requestId), {
      status: 'accepted',
      updatedAt: new Date()
    });
    
    // Get full user data for both users to avoid undefined fields
    const fromUserDoc = await getDoc(doc(db, 'users', requestData.fromUserId));
    const toUserDoc = await getDoc(doc(db, 'users', requestData.toUserId));
    
    const fromUserData = fromUserDoc.exists() ? fromUserDoc.data() : null;
    const toUserData = toUserDoc.exists() ? toUserDoc.data() : null;
    
    // Create friendship for requester (from -> to)
    const friendship1: Omit<Friend, 'id'> = {
      userId: requestData.fromUserId,
      friendId: requestData.toUserId,
      friendData: {
        id: requestData.toUserId,
        fullName: toUserData?.fullName || 'Unknown User',
        email: toUserData?.email || requestData.toUserEmail || '',
        mobile: toUserData?.mobile || '',
        avatar: toUserData?.profilePicture || '',
        profilePicture: toUserData?.profilePicture || ''
      },
      status: 'accepted',
      balance: 0,
      lastActivity: new Date(),
      createdAt: new Date()
    };
    
    // Create friendship for accepter (to -> from)
    const friendship2: Omit<Friend, 'id'> = {
      userId: requestData.toUserId,
      friendId: requestData.fromUserId,
      friendData: {
        id: requestData.fromUserId,
        fullName: fromUserData?.fullName || requestData.fromUserData?.fullName || 'Unknown User',
        email: fromUserData?.email || requestData.fromUserData?.email || '',
        mobile: fromUserData?.mobile || '',
        avatar: fromUserData?.profilePicture || requestData.fromUserData?.avatar || '',
        profilePicture: fromUserData?.profilePicture || requestData.fromUserData?.avatar || ''
      },
      status: 'accepted',
      balance: 0,
      lastActivity: new Date(),
      createdAt: new Date()
    };
    
    batch.set(doc(collection(db, 'friends')), friendship1);
    batch.set(doc(collection(db, 'friends')), friendship2);
    
    await batch.commit();
    
    // Send notification to requester
    await this.createNotification({
      userId: requestData.fromUserId,
      type: 'friend_request',
      title: 'Friend Request Accepted',
      message: `${friendship2.friendData.fullName} accepted your friend request`,
      data: { friendId: requestData.toUserId },
      isRead: false,
      createdAt: new Date()
    });
    
  } catch (error) {
    console.error('❌ Accept friend request error:', error);
    throw error;
  }
}

static async declineFriendRequest(requestId: string): Promise<void> {
  try {
    // Get friend request
    const requestDoc = await getDoc(doc(db, 'friendRequests', requestId));
    if (!requestDoc.exists()) {
      throw new Error('Friend request not found');
    }

    const requestData = requestDoc.data() as FriendRequest;

    // Update request status to declined
    await updateDoc(doc(db, 'friendRequests', requestId), {
      status: 'declined',
      updatedAt: new Date()
    });

    // Send notification to requester
    await this.createNotification({
      userId: requestData.fromUserId,
      type: 'friend_request',
      title: 'Friend Request Declined',
      message: `Someone declined your friend request`,
      data: { friendRequestId: requestId },
      isRead: false,
      createdAt: new Date()
    });

    console.log('✅ Friend request declined successfully');
    
  } catch (error) {
    console.error('❌ Decline friend request error:', error);
    throw error;
  }
}

static async removeFriend(userId: string, friendId: string, friendRequestId?: string): Promise<void> {
  try {
    console.log('Removing friend:', { userId, friendId, friendRequestId });
    
    // If there's a friend request ID, it's a pending invitation
    if (friendRequestId) {
      await this.removePendingFriendInvitation(userId, friendRequestId);
      return;
    }
    
    const batch = writeBatch(db);
    
    // Find and delete friendship from user's side
    const userFriendshipQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      where('friendId', '==', friendId)
    );
    const userSnapshot = await getDocs(userFriendshipQuery);
    
    // Find and delete friendship from friend's side
    const friendFriendshipQuery = query(
      collection(db, 'friends'),
      where('userId', '==', friendId),
      where('friendId', '==', userId)
    );
    const friendSnapshot = await getDocs(friendFriendshipQuery);
    
    // Delete both friendship records
    userSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    friendSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log('✅ Friend removed successfully');
    
  } catch (error) {
    console.error('❌ Remove friend error:', error);
    throw new Error('Failed to remove friend. Please try again.');
  }
}
  
static async getFriends(userId: string): Promise<Friend[]> {
  try {
    // Get accepted friends
    const friendsQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      where('status', '==', 'accepted'),
      orderBy('lastActivity', 'desc')
    );
    
    const friendsSnapshot = await getDocs(friendsQuery);
    const acceptedFriends = friendsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Friend[];
    
    // Get pending invitations
    const pendingInvitations = await this.getPendingFriendInvitations(userId);
    
    // Combine and return
    return [...acceptedFriends, ...pendingInvitations];
    
  } catch (error) {
    console.error('❌ Get friends error:', error);
    return [];
  }
}

static async checkExistingFriendship(userId: string, friendEmail: string): Promise<{
  isFriend: boolean;
  friendData?: any;
  status?: string;
}> {
  try {
    // First find the user by email
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', friendEmail.toLowerCase())
    );
    const userSnapshot = await getDocs(usersQuery);
    
    if (userSnapshot.empty) {
      return { isFriend: false };
    }
    
    const targetUser = userSnapshot.docs[0];
    const targetUserId = targetUser.id;
    const targetUserData = targetUser.data();
    
    // Check if they are already friends
    const friendshipQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      where('friendId', '==', targetUserId)
    );
    const friendshipSnapshot = await getDocs(friendshipQuery);
    
    if (!friendshipSnapshot.empty) {
      const friendship = friendshipSnapshot.docs[0].data();
      return {
        isFriend: true,
        friendData: {
          id: targetUserId,
          fullName: targetUserData.fullName,
          email: targetUserData.email,
          status: friendship.status
        },
        status: friendship.status
      };
    }
    
    // Check for pending friend requests
    const pendingRequestQuery = query(
      collection(db, 'friendRequests'),
      where('status', '==', 'pending')
    );
    const pendingSnapshot = await getDocs(pendingRequestQuery);
    
    const existingRequest = pendingSnapshot.docs.find(doc => {
      const data = doc.data();
      return (data.fromUserId === userId && data.toUserId === targetUserId) ||
             (data.fromUserId === targetUserId && data.toUserId === userId);
    });
    
    if (existingRequest) {
      const requestData = existingRequest.data();
      return {
        isFriend: true,
        friendData: {
          id: targetUserId,
          fullName: targetUserData.fullName,
          email: targetUserData.email,
          status: requestData.fromUserId === userId ? 'request_sent' : 'request_received'
        },
        status: requestData.fromUserId === userId ? 'request_sent' : 'request_received'
      };
    }
    
    return { isFriend: false };
    
  } catch (error) {
    console.error('Check existing friendship error:', error);
    return { isFriend: false };
  }
}
  
  // GROUPS MANAGEMENT
static async createGroup(groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    // Ensure inviteCode is provided or generate one
    const inviteCode = groupData.inviteCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create group without members first, then add creator
    const newGroup: Omit<Group, 'id'> = {
      ...groupData,
      inviteCode,
      totalExpenses: groupData.totalExpenses || 0,
      isActive: groupData.isActive !== undefined ? groupData.isActive : true,
      members: [], // Start with empty members array
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create the group document
    const docRef = await addDoc(collection(db, 'groups'), newGroup);
    console.log('Group created successfully with ID:', docRef.id);
    
    // Add the creator as the first member (admin)
    if (groupData.createdBy) {
      await this.addGroupMember(docRef.id, groupData.createdBy, 'admin');
      console.log('Creator added as admin to group');
    }
    
    return docRef.id;
    
  } catch (error) {
    console.error('Create group error:', error);
    throw error;
  }
}
  
  static async addGroupMember(groupId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    try {
      console.log('Adding member to group:', { groupId, userId, role });
      
      // Get user data
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      console.log('Found user data:', userData);
      
      // Get current group data
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data() as Group;
      
      // Check if user is already a member
      const existingMember = groupData.members?.find(member => member.userId === userId);
      if (existingMember) {
        console.log('User is already a member of this group');
        return;
      }
      
      const member: GroupMember = {
        userId,
        userData: {
          fullName: userData?.fullName || 'Unknown User',
          email: userData?.email || '',
          avatar: userData?.profilePicture || ''
        },
        role,
        balance: 0,
        joinedAt: new Date(),
        isActive: true
      };
      
      console.log('Adding member:', member);
      
      // Instead of arrayUnion, manually update the members array
      // This avoids issues with complex object comparison in Firestore
      const updatedMembers = [...(groupData.members || []), member];
      
      await updateDoc(doc(db, 'groups', groupId), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
      
      console.log('Member added successfully to group');
      
      // Trigger refresh notifications for UI updates
      try {
        const ExpenseRefreshService = (await import('@/services/expenseRefreshService')).default;
        const refreshService = ExpenseRefreshService.getInstance();
        refreshService.notifyGroupMembersUpdated();
        refreshService.notifyGroupUpdated();
      } catch (refreshError) {
        console.error('❌ Error triggering refresh notifications:', refreshError);
      }
      
      // Send group invitation notification using NotificationManager
      try {
        // Only send invitation notification if the user is being added by someone else
        // (i.e., not when creating the group as admin)
        if (role === 'member') {
          // Get the group creator or admin who might be adding this member
          const groupAdmin = groupData.members?.find(member => member.role === 'admin');
          
          if (groupAdmin) {
            // Use NotificationManager for enhanced push notifications and in-app notifications
            const { notificationManager } = await import('../NotificationManager');
            
            // Get updated group data for notification
            const updatedGroupDoc = await getDoc(doc(db, 'groups', groupId));
            if (updatedGroupDoc.exists()) {
              const updatedGroupData = updatedGroupDoc.data() as Group;
              await notificationManager.notifyGroupInvitation(updatedGroupData, userId, groupAdmin.userId);
            }
            
            console.log(`✅ Sent group invitation notification to ${userData?.fullName || userId}`);
          }
        }
      } catch (notificationError) {
        console.error('❌ Error sending group invitation notification:', notificationError);
        // Don't throw - member was already added successfully
      }
      
    } catch (error) {
      console.error('Add group member error:', error);
      throw error;
    }
  }
  
  static async joinGroupByInviteCode(inviteCode: string, userId: string): Promise<string> {
    try {
      const groupQuery = query(
        collection(db, 'groups'),
        where('inviteCode', '==', inviteCode.toUpperCase()),
        where('isActive', '==', true),
        limit(1)
      );
      
      const snapshot = await getDocs(groupQuery);
      if (snapshot.empty) {
        throw new Error('Invalid invite code');
      }
      
      const groupDoc = snapshot.docs[0];
      const groupData = groupDoc.data() as Group;
      
      // Check if user is already a member
      const isMember = groupData.members.some(member => member.userId === userId);
      if (isMember) {
        throw new Error('You are already a member of this group');
      }
      
      await this.addGroupMember(groupDoc.id, userId);
      
      return groupDoc.id;
      
    } catch (error) {
      console.error('Join group error:', error);
      throw error;
    }
  }
  
  // EXPENSES MANAGEMENT
static async addExpense(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    console.log('Adding expense:', expenseData.description, 'for group:', expenseData.groupId);
    
    const batch = writeBatch(db);
    
    const newExpense: Omit<Expense, 'id'> = {
      ...expenseData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const expenseRef = doc(collection(db, 'expenses'));
    batch.set(expenseRef, newExpense);
    console.log('Expense document prepared with ID:', expenseRef.id);
    
    // Update group total expenses
    batch.update(doc(db, 'groups', expenseData.groupId), {
      totalExpenses: increment(expenseData.amount),
      updatedAt: serverTimestamp()
    });
    console.log('Group update prepared');
    
    // Add expense notification to group chat
    const expenseMessage = {
      groupId: expenseData.groupId,
      userId: expenseData.paidBy,
      userName: expenseData.paidByData.fullName,
      message: `Added expense: ${expenseData.description}`,
      timestamp: serverTimestamp(),
      type: 'expense',
      expenseData: {
        id: expenseRef.id,
        description: expenseData.description,
        amount: expenseData.amount,
        currency: expenseData.currency
      }
    };
    
    batch.set(doc(collection(db, 'groupMessages')), expenseMessage);
    console.log('Chat message prepared');
    
    // Update member balances in the group
    for (const split of expenseData.splitData) {
      if (split.userId !== expenseData.paidBy) {
        await this.updateGroupMemberBalance(expenseData.groupId, split.userId, split.amount);
        await this.updateGroupMemberBalance(expenseData.groupId, expenseData.paidBy, -split.amount);
        
        // Also update friend balances if they are friends
        try {
          await this.updateFriendBalance(expenseData.paidBy, split.userId, split.amount);
          console.log(`Updated friend balance between ${expenseData.paidBy} and ${split.userId} by ${split.amount}`);
        } catch (error) {
          console.log(`No friendship found between ${expenseData.paidBy} and ${split.userId}, skipping friend balance update`);
        }
      }
    }
    console.log('Group member balances updated');
    
    await batch.commit();
    console.log('✅ Expense added successfully:', expenseRef.id);
    
    // Send notifications to all group members using NotificationManager
    try {
      // Get group data to get member list and group name
      const groupDoc = await getDoc(doc(db, 'groups', expenseData.groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data() as Group;
        
        // Use NotificationManager for push notifications and in-app notifications
        const { notificationManager } = await import('../NotificationManager');
        
        // Create the expense object for notification
        const expense: Expense = {
          id: expenseRef.id,
          ...newExpense,
          date: newExpense.createdAt // Use createdAt as date if not provided
        };
        
        await notificationManager.notifyExpenseAdded(expense, groupData, expenseData.paidBy);
      }
    } catch (error) {
      console.error('❌ Error sending expense notifications:', error);
      // Don't throw - expense was already added successfully
    }
    
    return expenseRef.id;
    
  } catch (error) {
    console.error('❌ Add expense error:', error);
    throw error;
  }
}
  
  static async updateFriendBalance(userId: string, friendId: string, amount: number): Promise<void> {
    try {
      console.log(`Updating balance between ${userId} and ${friendId} by ${amount}`);
      
      // Update both sides of the friendship with opposite amounts
      const batch = writeBatch(db);
      
      // Update user's side (amount owed by friend)
      const userFriendQuery = query(
        collection(db, 'friends'),
        where('userId', '==', userId),
        where('friendId', '==', friendId),
        limit(1)
      );
      
      const userSnapshot = await getDocs(userFriendQuery);
      if (!userSnapshot.empty) {
        const userFriendDoc = userSnapshot.docs[0];
        batch.update(userFriendDoc.ref, {
          balance: increment(amount),
          lastActivity: new Date()
        });
        console.log(`Updated ${userId}'s side: +${amount}`);
      }
      
      // Update friend's side (opposite amount)
      const friendUserQuery = query(
        collection(db, 'friends'),
        where('userId', '==', friendId),
        where('friendId', '==', userId),
        limit(1)
      );
      
      const friendSnapshot = await getDocs(friendUserQuery);
      if (!friendSnapshot.empty) {
        const friendUserDoc = friendSnapshot.docs[0];
        batch.update(friendUserDoc.ref, {
          balance: increment(-amount),
          lastActivity: new Date()
        });
        console.log(`Updated ${friendId}'s side: -${amount}`);
      }
      
      await batch.commit();
      console.log('Balance update completed successfully');
      
    } catch (error) {
      console.error('Update friend balance error:', error);
      throw error;
    }
  }

  static async getGroupExpenses(groupId: string): Promise<Expense[]> {
  try {
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(expensesQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Expense[];
  } catch (error) {
    console.error('Get group expenses error:', error);
    return [];
  }
}

  
  // NOTIFICATIONS
  static async createNotification(notificationData: Omit<Notification, 'id'>): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), notificationData);
      
      // TODO: Send push notification using Firebase Cloud Messaging
      
    } catch (error) {
      console.error('Create notification error:', error);
    }
  }
  
static async getNotifications(userId: string): Promise<Notification[]> {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(notificationsQuery);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(), // Convert Firestore timestamp
      };
    }) as Notification[];
    
  } catch (error) {
    console.error('Get notifications error:', error);
    return [];
  }
}
  
  // Mark single notification as read
  static async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
        readAt: new Date()
      });
      
      console.log('Notification marked as read:', notificationId);
      
    } catch (error) {
      console.error('Mark notification as read error:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  static async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Get all unread notifications for the user
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const snapshot = await getDocs(notificationsQuery);
      
      // Mark each notification as read
      snapshot.docs.forEach(docSnapshot => {
        batch.update(docSnapshot.ref, {
          isRead: true,
          readAt: new Date()
        });
      });
      
      await batch.commit();
      
      console.log(`Marked ${snapshot.docs.length} notifications as read for user:`, userId);
      
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      throw error;
    }
  }
  
  // PAYMENTS
  static async createPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Clean the payment data to ensure no undefined values
      const cleanPaymentData = {
        ...paymentData,
        expenseId: paymentData.expenseId || undefined,
        groupId: paymentData.groupId || undefined,
        transactionId: paymentData.transactionId || undefined,
      };
      
      const newPayment: Omit<Payment, 'id'> = {
        ...cleanPaymentData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'payments'), newPayment);
      
      return docRef.id;
      
    } catch (error) {
      console.error('Create payment error:', error);
      throw error;
    }
  }

  // PAYMENT REQUESTS
  static async createPaymentRequest(requestData: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    message?: string;
  }): Promise<string> {
    try {
      console.log('Creating payment request:', requestData);

      // Get user data for both users
      const [fromUserDoc, toUserDoc] = await Promise.all([
        getDoc(doc(db, 'users', requestData.fromUserId)),
        getDoc(doc(db, 'users', requestData.toUserId))
      ]);

      if (!fromUserDoc.exists() || !toUserDoc.exists()) {
        throw new Error('User data not found');
      }

      const fromUserData = fromUserDoc.data();
      const toUserData = toUserDoc.data();

      // Create payment request record
      const paymentRequest = {
        fromUserId: requestData.fromUserId,
        fromUserData: {
          fullName: fromUserData?.fullName || 'Unknown User',
          email: fromUserData?.email || '',
          avatar: fromUserData?.profilePicture || ''
        },
        toUserId: requestData.toUserId,
        toUserData: {
          fullName: toUserData?.fullName || 'Unknown User',
          email: toUserData?.email || '',
          avatar: toUserData?.profilePicture || ''
        },
        amount: requestData.amount,
        currency: requestData.currency,
        message: requestData.message || '',
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'paymentRequests'), paymentRequest);

      // Send notification to the recipient
      await this.createNotification({
        userId: requestData.toUserId,
        type: 'payment_request',
        title: 'Payment Request',
        message: `${fromUserData?.fullName} requested ${requestData.currency} ${requestData.amount}${requestData.message ? ': ' + requestData.message : ''}`,
        data: {
          requestId: docRef.id,
          fromUserId: requestData.fromUserId,
          amount: requestData.amount,
          currency: requestData.currency,
          message: requestData.message,
          navigationType: 'paymentRequestDetails'
        },
        isRead: false,
        createdAt: new Date()
      });

      // Try to send push notification using the notification service
      try {
        const { PushNotificationService } = await import('../notifications/PushNotificationService');
        
        const pushNotification: PushNotificationData = {
          type: 'payment_request',
          title: 'Payment Request',
          body: `${fromUserData?.fullName} requested ${requestData.currency} ${requestData.amount}`,
          data: {
            requestId: docRef.id,
            fromUserId: requestData.fromUserId,
            amount: requestData.amount,
            currency: requestData.currency,
            message: requestData.message
          }
        };

        await PushNotificationService.sendNotificationToUser(requestData.toUserId, pushNotification);
        console.log('✅ Push notification sent for payment request');
      } catch (error) {
        console.log('❌ Failed to send push notification for payment request:', error);
      }

      console.log('✅ Payment request created successfully:', docRef.id);
      return docRef.id;

    } catch (error) {
      console.error('❌ Create payment request error:', error);
      throw error;
    }
  }
  
  // RECEIPT SCANNING
  static async uploadReceipt(file: File, expenseId: string): Promise<string> {
    try {
      const fileRef = ref(storage, `receipts/${expenseId}/${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      
      return downloadURL;
      
    } catch (error) {
      console.error('Upload receipt error:', error);
      throw error;
    }
  }
  
  // REAL-TIME LISTENERS
  static onGroupExpenses(groupId: string, callback: (expenses: Expense[]) => void): () => void {
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(expensesQuery, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      callback(expenses);
    });
  }
  
  static onUserNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(notificationsQuery, (snapshot) => {
      const notifications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore timestamp to Date object
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date())
        };
      }) as Notification[];
      callback(notifications);
    });
  }
  
  static onFriendRequests(userId: string, callback: (requests: FriendRequest[]) => void): () => void {
    const requestsQuery = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(requestsQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FriendRequest[];
      callback(requests);
    });
  }

  static onFriends(userId: string, callback: (friends: Friend[]) => void): () => void {
    const friendsQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      orderBy('lastActivity', 'desc')
    );
    
    return onSnapshot(friendsQuery, async (snapshot) => {
      try {
        const acceptedFriends = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Ensure proper date conversion
          lastActivity: doc.data().lastActivity?.toDate ? doc.data().lastActivity.toDate() : new Date(doc.data().lastActivity || Date.now()),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
        })) as Friend[];

        // Get pending invitations
        const pendingInvitations = await SplittingService.getPendingFriendInvitations(userId);
        
        // Combine and return
        const allFriends = [...acceptedFriends, ...pendingInvitations];
        callback(allFriends);
      } catch (error) {
        console.error('❌ Friends listener error:', error);
        callback([]);
      }
    }, (error) => {
      console.error('❌ Friends listener Firebase error:', error);
      callback([]);
    });
  }
  
  // GET PENDING FRIEND INVITATIONS
static async getPendingFriendInvitations(userId: string): Promise<Friend[]> {
  try {
    const requestsQuery = query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(requestsQuery);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.fromUserId,
        friendId: data.toUserId,
        friendData: data.toUserData,
        status: 'invited' as const,
        balance: 0,
        lastActivity: data.createdAt?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        invitedAt: data.createdAt?.toDate() || new Date(),
        requestId: doc.id
      };
    }) as Friend[];
  } catch (error) {
    console.error('Get pending invitations error:', error);
    return [];
  }
}

// GET USER BY ID
static async getUserById(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    return {
      id: userDoc.id,
      fullName: userData.fullName,
      email: userData.email,
      country: userData.country || 'US',
      mobile: userData.mobile || '',
      currency: userData.currency || 'USD',
      profilePicture: userData.profilePicture,
      biometricEnabled: userData.biometricEnabled || false,
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date(),
    } as User;
  } catch (error) {
    console.error('Get user by ID error:', error);
    return null;
  }
}

  // GET USER GROUPS
static async getUserGroups(userId: string): Promise<Group[]> {
  try {
    // Simplified query that doesn't require complex indexing
    // Use only isActive filter first, then sort in memory
    const groupsQuery = query(
      collection(db, 'groups'),
      where('isActive', '==', true)
      // Remove orderBy to avoid index requirement while building
    );
    
    const snapshot = await getDocs(groupsQuery);
    const allGroups = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Group[];
    
    // Filter groups where user is a member and sort in memory
    const userGroups = allGroups
      .filter(group => 
        group.members && group.members.some(member => member.userId === userId)
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); // Sort by updatedAt descending
    
    return userGroups;
    
  } catch (error) {
    console.error('Get user groups error:', error);
    // Fallback: return empty array instead of throwing
    return [];
  }
}
// LEAVE GROUP
static async leaveGroup(groupId: string, userId: string): Promise<void> {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Group not found');
    }
    
    const groupData = groupDoc.data() as Group;
    const updatedMembers = groupData.members.filter(member => member.userId !== userId);
    
    if (updatedMembers.length === 0) {
      // If no members left, deactivate the group
      await updateDoc(groupRef, {
        isActive: false,
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
    } else {
      // If user was admin, make another member admin
      const leavingMember = groupData.members.find(member => member.userId === userId);
      if (leavingMember?.role === 'admin' && updatedMembers.length > 0) {
        updatedMembers[0].role = 'admin';
      }
      
      await updateDoc(groupRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
    }
    
    console.log('User left group successfully');
  } catch (error) {
    console.error('Leave group error:', error);
    throw error;
  }
}

  // GET USER EXPENSES
static async getUserExpenses(userId: string, limitCount: number = 20): Promise<Expense[]> {
  try {
    // First get user's groups
    const userGroups = await this.getUserGroups(userId);
    const groupIds = userGroups.map(group => group.id);
    
    if (groupIds.length === 0) {
      return [];
    }
    
    // Import limit function correctly
    const { query, collection, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    
    // Get expenses from user's groups (max 10 groups due to 'in' limitation)
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', 'in', groupIds.slice(0, 10)),
      orderBy('createdAt', 'desc'),
      limit(limitCount) // Use limitCount parameter
    );
    
    const snapshot = await getDocs(expensesQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Expense[];
    
  } catch (error) {
    console.error('Get user expenses error:', error);
    return [];
  }
}

  // GET SINGLE GROUP
  static async getGroup(groupId: string): Promise<Group | null> {
    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      
      if (!groupDoc.exists()) {
        return null;
      }
      
      const groupData = groupDoc.data();
      return {
        id: groupDoc.id,
        ...groupData,
        createdAt: groupData.createdAt?.toDate() || new Date(),
        updatedAt: groupData.updatedAt?.toDate() || new Date(),
      } as Group;
      
    } catch (error) {
      console.error('Get group error:', error);
      return null;
    }
  }
  // REAL TIME MESSAGE LISTENERS
  static onGroupMessages(groupId: string, callback: (messages: ChatMessage[]) => void): () => void {
  const messagesQuery = query(
    collection(db, 'groupMessages'),
    where('groupId', '==', groupId),
    orderBy('timestamp', 'asc'),
    limit(100)
  );
  
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    })) as ChatMessage[];
    callback(messages);
  }, (error) => {
    console.error('Message listener error:', error);
  });
}

  // UPDATE USER (add this method if missing)
  static async updateUser(userId: string, updates: Partial<any>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }
// CHAT METHODS
static async sendGroupMessage(messageData: {
  groupId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  type: 'message' | 'expense' | 'system';
  expenseData?: any;
}): Promise<string> {
  try {
    const chatMessage = {
      ...messageData,
      userAvatar: messageData.userAvatar || '',
      timestamp: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'groupMessages'), chatMessage);
    
    // Update group's last activity
    await updateDoc(doc(db, 'groups', messageData.groupId), {
      updatedAt: serverTimestamp()
    });

    // Send notifications to group members (except sender)
    if (messageData.type === 'message') {
      await this.sendChatNotificationToGroupMembers(
        messageData.groupId,
        messageData.userId,
        messageData.userName,
        messageData.message
      );
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Send group message error:', error);
    throw error;
  }
}

static async sendChatNotificationToGroupMembers(
  groupId: string,
  senderUserId: string,
  senderName: string,
  message: string
): Promise<void> {
  try {
    // Get group data to find all members
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) return;
    
    const groupData = groupDoc.data() as Group;
    
    // Send notification to all members except sender
    const notificationPromises = groupData.members
      .filter(member => member.userId !== senderUserId)
      .map(member => 
        this.createNotification({
          userId: member.userId,
          type: 'group_message',
          title: `${senderName} in ${groupData.name}`,
          message: message.length > 50 ? `${message.substring(0, 50)}...` : message,
          data: { 
            groupId,
            groupName: groupData.name,
            senderId: senderUserId,
            senderName,
            navigationType: 'groupChat'
          },
          isRead: false,
          createdAt: new Date()
        })
      );
    
    await Promise.all(notificationPromises);
    
  } catch (error) {
    console.error('Send chat notification error:', error);
  }
}

static async getGroupMessages(groupId: string, limitCount: number = 50): Promise<ChatMessage[]> {
  try {
    const messagesQuery = query(
      collection(db, 'groupMessages'),
      where('groupId', '==', groupId),
      orderBy('timestamp', 'asc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(messagesQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    })) as ChatMessage[];
  } catch (error) {
    console.error('Get group messages error:', error);
    return [];
  }
}

static async updateGroupMemberBalance(groupId: string, userId: string, amount: number): Promise<void> {
    try {
      console.log(`Updating group member balance: ${userId} in group ${groupId} by ${amount}`);
      
      // Get current group data
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data() as Group;
      
      // Find and update the member's balance
      const updatedMembers = groupData.members.map(member => {
        if (member.userId === userId) {
          return {
            ...member,
            balance: (member.balance || 0) + amount
          };
        }
        return member;
      });
      
      // Update the group with new member balances
      await updateDoc(doc(db, 'groups', groupId), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
      
      console.log(`Updated member ${userId} balance by ${amount}`);
      
    } catch (error) {
      console.error('Update group member balance error:', error);
      throw error;
    }
  }

  // UPDATE MEMBER ROLE
  static async updateMemberRole(groupId: string, userId: string, newRole: 'admin' | 'member'): Promise<void> {
    try {
      console.log(`Updating member role: ${userId} in group ${groupId} to ${newRole}`);
      
      // Get current group data
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }

      const groupData = groupDoc.data() as Group;
      
      // Find and update the member's role
      const updatedMembers = groupData.members.map(member => {
        if (member.userId === userId) {
          return {
            ...member,
            role: newRole
          };
        }
        return member;
      });

      // Update the group with new member roles
      await updateDoc(doc(db, 'groups', groupId), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
      
      console.log(`Updated member ${userId} role to ${newRole}`);
      
    } catch (error) {
      console.error('Update member role error:', error);
      throw error;
    }
  }

  // REMOVE MEMBER FROM GROUP
  static async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    try {
      console.log(`Removing member ${userId} from group ${groupId}`);
      
      // Get current group data
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }

      const groupData = groupDoc.data() as Group;
      
      // Find the member to be removed
      const memberToRemove = groupData.members.find(member => member.userId === userId);
      if (!memberToRemove) {
        throw new Error('Member not found in group');
      }

      // Check if member has pending balances
      if (memberToRemove.balance !== 0) {
        throw new Error(`Cannot remove member with pending balances (${memberToRemove.balance}). Please settle all expenses first.`);
      }

      // Remove the member from the group
      const updatedMembers = groupData.members.filter(member => member.userId !== userId);

      // If removing the last admin and there are other members, make someone else admin
      const remainingAdmins = updatedMembers.filter(member => member.role === 'admin');
      if (remainingAdmins.length === 0 && updatedMembers.length > 0) {
        updatedMembers[0].role = 'admin';
        console.log(`Made ${updatedMembers[0].userData.fullName} admin after removing last admin`);
      }

      // Update the group
      await updateDoc(doc(db, 'groups', groupId), {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });

      // Add system message to group chat
      await this.sendGroupMessage({
        groupId: groupId,
        userId: 'system',
        userName: 'System',
        message: `${memberToRemove.userData.fullName} has been removed from the group`,
        type: 'system'
      });
      
      console.log(`Successfully removed member ${userId} from group ${groupId}`);
      
    } catch (error) {
      console.error('Remove member from group error:', error);
      throw error;
    }
  }

  // UPDATE EXPENSE
  static async updateExpense(expenseData: any): Promise<void> {
    try {
      const expenseId = expenseData.id;
      console.log('Updating expense:', expenseId, expenseData.description);
      
      // Get the current expense to compare amounts for balance adjustments
      const currentExpenseDoc = await getDoc(doc(db, 'expenses', expenseId));
      if (!currentExpenseDoc.exists()) {
        throw new Error('Expense not found');
      }
      
      const currentExpense = {
        id: currentExpenseDoc.id,
        ...currentExpenseDoc.data(),
        date: currentExpenseDoc.data()?.date?.toDate() || new Date(),
        createdAt: currentExpenseDoc.data()?.createdAt?.toDate() || new Date(),
        updatedAt: currentExpenseDoc.data()?.updatedAt?.toDate() || new Date(),
      } as Expense;
      
      const batch = writeBatch(db);
      
      // Update the expense document - remove id field completely
      const { id, ...expenseDataWithoutId } = expenseData;
      const updatedExpense = {
        ...expenseDataWithoutId,
        updatedAt: new Date()
      };
      
      batch.update(doc(db, 'expenses', expenseId), updatedExpense);
      console.log('Expense update prepared');
      
      // Calculate the difference in amount to adjust group total
      const amountDifference = expenseData.amount - currentExpense.amount;
      
      if (amountDifference !== 0) {
        // Update group total expenses
        batch.update(doc(db, 'groups', expenseData.groupId), {
          totalExpenses: increment(amountDifference),
          updatedAt: serverTimestamp()
        });
        console.log('Group total update prepared, difference:', amountDifference);
      }
      
      // Add update notification to group chat
      const updateMessage = {
        groupId: expenseData.groupId,
        userId: expenseData.paidBy,
        userName: currentExpense.paidByData?.fullName || 'Unknown User',
        message: `Updated expense: ${expenseData.description}`,
        timestamp: serverTimestamp(),
        type: 'system' as const,
        expenseData: {
          id: expenseId,
          description: expenseData.description,
          amount: expenseData.amount,
          currency: expenseData.currency
        }
      };
      
      batch.set(doc(collection(db, 'groupMessages')), updateMessage);
      console.log('Update message prepared');
      
      // Handle balance adjustments if amounts changed
      if (amountDifference !== 0 || 
          JSON.stringify(currentExpense.splitData) !== JSON.stringify(expenseData.splitData)) {
        
        console.log('Recalculating balances due to amount or split changes');
        
        // First, reverse the old balance calculations
        for (const oldSplit of currentExpense.splitData) {
          if (oldSplit.userId !== currentExpense.paidBy) {
            // Reverse group member balance
            await this.updateGroupMemberBalance(currentExpense.groupId, oldSplit.userId, -oldSplit.amount);
            await this.updateGroupMemberBalance(currentExpense.groupId, currentExpense.paidBy, oldSplit.amount);
            
            // Reverse friend balance if they are friends
            try {
              await this.updateFriendBalance(currentExpense.paidBy, oldSplit.userId, -oldSplit.amount);
              console.log(`Reversed friend balance between ${currentExpense.paidBy} and ${oldSplit.userId} by ${-oldSplit.amount}`);
            } catch (error) {
              console.log(`No friendship found, skipping friend balance reversal`);
            }
          }
        }
        
        // Then, apply the new balance calculations
        for (const newSplit of expenseData.splitData) {
          if (newSplit.userId !== expenseData.paidBy) {
            // Update group member balance
            await this.updateGroupMemberBalance(expenseData.groupId, newSplit.userId, newSplit.amount);
            await this.updateGroupMemberBalance(expenseData.groupId, expenseData.paidBy, -newSplit.amount);
            
            // Update friend balance if they are friends
            try {
              await this.updateFriendBalance(expenseData.paidBy, newSplit.userId, newSplit.amount);
              console.log(`Updated friend balance between ${expenseData.paidBy} and ${newSplit.userId} by ${newSplit.amount}`);
            } catch (error) {
              console.log(`No friendship found, skipping friend balance update`);
            }
          }
        }
        
        console.log('Balance recalculation completed');
      }
      
      await batch.commit();
      console.log('✅ Expense updated successfully:', expenseId);
      
    } catch (error) {
      console.error('❌ Update expense error:', error);
      throw error;
    }
  }


// EXPENSE SETTLEMENT METHODS
static async updateExpenseSettlement(expenseId: string, settlementData: {
  splitData: ExpenseSplit[];
  isSettled: boolean;
  lastSettlementDate: Date;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // Update the expense document
    batch.update(doc(db, 'expenses', expenseId), {
      splitData: settlementData.splitData,
      isSettled: settlementData.isSettled,
      lastSettlementDate: settlementData.lastSettlementDate,
      updatedAt: new Date()
    });
    
    await batch.commit();
    console.log('Expense settlement updated successfully');
    
  } catch (error) {
    console.error('Update expense settlement error:', error);
    throw error;
  }
}

// EXPENSE DELETION METHODS
static async deleteExpense(expenseId: string, deletedBy: string): Promise<void> {
  try {
    console.log('Deleting expense:', expenseId);
    
    // Get the expense first to reverse balances
    const expenseDoc = await getDoc(doc(db, 'expenses', expenseId));
    if (!expenseDoc.exists()) {
      throw new Error('Expense not found');
    }
    
    const expense = {
      id: expenseDoc.id,
      ...expenseDoc.data(),
      date: expenseDoc.data()?.date?.toDate() || new Date(),
      createdAt: expenseDoc.data()?.createdAt?.toDate() || new Date(),
      updatedAt: expenseDoc.data()?.updatedAt?.toDate() || new Date(),
    } as Expense;
    
    const batch = writeBatch(db);
    
    // 1. Delete the expense document
    batch.delete(doc(db, 'expenses', expenseId));
    
    // 2. Reverse group total expenses
    batch.update(doc(db, 'groups', expense.groupId), {
      totalExpenses: increment(-expense.amount),
      updatedAt: serverTimestamp()
    });
    
    // 3. Reverse all balance calculations
    for (const split of expense.splitData) {
      if (split.userId !== expense.paidBy) {
        // Reverse group member balances
        await this.updateGroupMemberBalance(expense.groupId, split.userId, -split.amount);
        await this.updateGroupMemberBalance(expense.groupId, expense.paidBy, split.amount);
        
        // Reverse friend balances if they are friends
        try {
          await this.updateFriendBalance(expense.paidBy, split.userId, -split.amount);
          console.log(`Reversed friend balance between ${expense.paidBy} and ${split.userId}`);
        } catch (error) {
          console.log(`No friendship found, skipping friend balance reversal`);
        }
      }
    }
    
    // 4. Add deletion message to group chat
    const deletionMessage = {
      groupId: expense.groupId,
      userId: deletedBy,
      userName: 'System',
      message: `Expense "${expense.description}" was deleted and balances have been reversed`,
      timestamp: serverTimestamp(),
      type: 'system' as const
    };
    
    batch.set(doc(collection(db, 'groupMessages')), deletionMessage);
    
    await batch.commit();
    console.log('✅ Expense deleted successfully and balances reversed');
    
  } catch (error) {
    console.error('❌ Delete expense error:', error);
    throw error;
  }
}



static async createRecurringExpense(recurringData: Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt' | 'processedCount'>): Promise<string> {
  try {
    // Ensure all undefined fields are properly handled for Firebase
    const sanitizedData = {
      ...recurringData,
      endDate: recurringData.endDate || null, // Convert undefined to null for Firebase
      maxOccurrences: recurringData.maxOccurrences || null, // Convert undefined to null for Firebase
      processedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(collection(db, 'recurringExpenses'), sanitizedData);
    console.log('Recurring expense created:', docRef.id);
    return docRef.id;
    
  } catch (error) {
    console.error('Create recurring expense error:', error);
    throw error;
  }
}

static async processRecurringExpenses(): Promise<void> {
  try {
    const today = new Date();
    
    // Get all active recurring expenses that are due
    const recurringQuery = query(
      collection(db, 'recurringExpenses'),
      where('isActive', '==', true),
      where('nextDueDate', '<=', today)
    );
    
    const snapshot = await getDocs(recurringQuery);
    
    for (const docSnapshot of snapshot.docs) {
      const recurring = { id: docSnapshot.id, ...docSnapshot.data() } as RecurringExpense;
      
      // Check if we've reached max occurrences (only if maxOccurrences is set)
      if (recurring.maxOccurrences && recurring.processedCount >= recurring.maxOccurrences) {
        await updateDoc(doc(db, 'recurringExpenses', recurring.id), {
          isActive: false,
          updatedAt: new Date()
        });
        continue;
      }
      
      // Create the expense
      await this.addExpense({
        description: recurring.description,
        amount: recurring.amount,
        currency: recurring.currency,
        category: recurring.category,
        categoryIcon: recurring.categoryIcon,
        groupId: recurring.groupId,
        paidBy: recurring.paidBy,
        paidByData: recurring.paidByData,
        splitType: recurring.splitType,
        splitData: recurring.splitData,
        notes: `Recurring: ${recurring.templateName}`,
        tags: ['recurring'],
        date: new Date(),
        isSettled: false
      });
      
      // Calculate next due date
      const nextDue = new Date(recurring.nextDueDate);
      switch (recurring.frequency) {
        case 'weekly':
          nextDue.setDate(nextDue.getDate() + 7);
          break;
        case 'monthly':
          nextDue.setMonth(nextDue.getMonth() + 1);
          break;
        case 'quarterly':
          nextDue.setMonth(nextDue.getMonth() + 3);
          break;
        case 'yearly':
          nextDue.setFullYear(nextDue.getFullYear() + 1);
          break;
      }
      
      // Update recurring expense
      await updateDoc(doc(db, 'recurringExpenses', recurring.id), {
        nextDueDate: nextDue,
        lastProcessedDate: new Date(),
        processedCount: recurring.processedCount + 1,
        updatedAt: new Date()
      });
    } // End of for loop
    
  } catch (error) {
    console.error('Process recurring expenses error:', error);
  }
}



static async createExpenseTemplate(templateData: Omit<ExpenseTemplate, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>): Promise<string> {
  try {
    const newTemplate: Omit<ExpenseTemplate, 'id'> = {
      ...templateData,
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(collection(db, 'expenseTemplates'), newTemplate);
    return docRef.id;
    
  } catch (error) {
    console.error('Create expense template error:', error);
    throw error;
  }
}

static async getExpenseTemplates(userId: string, groupId?: string): Promise<ExpenseTemplate[]> {
  try {
    let templatesQuery = query(
      collection(db, 'expenseTemplates'),
      where('createdBy', '==', userId),
      orderBy('useCount', 'desc')
    );
    
    const snapshot = await getDocs(templatesQuery);
    const userTemplates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as ExpenseTemplate[];
    
    // If groupId provided, also get public group templates
    if (groupId) {
      const groupTemplatesQuery = query(
        collection(db, 'expenseTemplates'),
        where('groupId', '==', groupId),
        where('isPublic', '==', true),
        where('createdBy', '!=', userId),
        orderBy('useCount', 'desc')
      );
      
      const groupSnapshot = await getDocs(groupTemplatesQuery);
      const groupTemplates = groupSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as ExpenseTemplate[];
      
      return [...userTemplates, ...groupTemplates];
    }
    
    return userTemplates;
    
  } catch (error) {
    console.error('Get expense templates error:', error);
    return [];
  }
}

static async useExpenseTemplate(templateId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'expenseTemplates', templateId), {
      useCount: increment(1),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Use expense template error:', error);
  }
}


static async requestExpenseApproval(expenseData: any): Promise<string> {
  try {
    // Check if expense amount requires approval
    const group = await this.getGroup(expenseData.groupId);
    if (!group) throw new Error('Group not found');
    
    const approvalThreshold = group.settings.approvalThreshold || 100; // Default $100
    
    if (expenseData.amount < approvalThreshold) {
      // No approval needed, create expense directly
      return await this.addExpense(expenseData);
    }
    
    // Create approval request
    const approvalData: Omit<ExpenseApproval, 'id'> = {
      expenseId: 'pending',
      groupId: expenseData.groupId,
      requestedBy: expenseData.paidBy,
      requestedByData: expenseData.paidByData,
      approvalThreshold,
      status: 'pending',
      approvers: [],
      requiredApprovals: Math.ceil(group.members.filter(m => m.role === 'admin').length / 2), // Majority of admins
      receivedApprovals: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const docRef = await addDoc(collection(db, 'expenseApprovals'), approvalData);
    return docRef.id;

  } catch (error) {
    console.error('Request expense approval error:', error);
    throw error;
  }
}

// EXPORT USER DATA METHOD
static async exportUserData(userId: string): Promise<ExportData> {
  try {
    console.log('Exporting user data for user:', userId);
    
    // Get user's expenses from all groups
    const userExpenses = await this.getUserExpenses(userId, 1000); // Get up to 1000 expenses
    
    // Get user's groups
    const userGroups = await this.getUserGroups(userId);
    
    // Get user's friends
    const userFriends = await this.getFriends(userId);
    
    // Create export data object
    const exportData: ExportData = {
      expenses: userExpenses,
      groups: userGroups,
      friends: userFriends,
      exportDate: new Date(),
      exportedBy: userId,
      version: '1.0'
    };
    
    console.log('User data export completed successfully');
    return exportData;
    
  } catch (error) {
    console.error('Export user data error:', error);
    throw new Error('Failed to export user data. Please try again.');
  }
}

static async getExpenseAnalytics(userId: string, timeframe: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<{
  totalSpent: number;
  totalOwed: number;
  totalOwing: number;
  averageExpense: number;
  expenseCount: number;
  monthlySpending: Array<{ month: string; amount: number }>;
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  groupAnalytics: Array<{ groupName: string; totalSpent: number; memberCount: number }>;
  splitWithMostFrequent: { userId: string; userName: string; count: number };
}> {
  try {
    console.log('Getting expense analytics for user:', userId, 'timeframe:', timeframe);
    
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    console.log('Date range:', startDate, 'to', now);

    // First get user's groups to find relevant expenses
    const userGroups = await this.getUserGroups(userId);
    const groupIds = userGroups.map(group => group.id);
    
    console.log('User groups found:', groupIds.length);
    
    if (groupIds.length === 0) {
      console.log('No groups found for user, returning empty analytics');
      return {
        totalSpent: 0,
        totalOwed: 0,
        totalOwing: 0,
        averageExpense: 0,
        expenseCount: 0,
        monthlySpending: [],
        categoryBreakdown: [],
        groupAnalytics: [],
        splitWithMostFrequent: { userId: '', userName: '', count: 0 }
      };
    }

    // Get user's expenses within timeframe from their groups
    // Since we need to handle the 'in' limitation and date filtering, we'll do this in batches
    let allExpenses: Expense[] = [];
    
    // Process groups in batches of 10 (Firestore 'in' limitation)
    for (let i = 0; i < groupIds.length; i += 10) {
      const batchGroupIds = groupIds.slice(i, i + 10);
      
      try {
        const expensesQuery = query(
          collection(db, 'expenses'),
          where('groupId', 'in', batchGroupIds),
          orderBy('createdAt', 'desc'),
          limit(1000) // Limit per batch to avoid too much data
        );
        
        const expensesSnapshot = await getDocs(expensesQuery);
        const batchExpenses = expensesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: data.date?.toDate() || data.createdAt?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };
        }) as Expense[];
        
        // Filter by date range (since we can't use both 'in' and 'where' with orderBy on different fields)
        const filteredBatchExpenses = batchExpenses.filter(expense => 
          expense.date >= startDate && expense.date <= now
        );
        
        allExpenses = [...allExpenses, ...filteredBatchExpenses];
        
      } catch (error) {
        console.error(`Error fetching expenses for batch ${i}:`, error);
        // Continue with other batches
      }
    }
    
    // Filter expenses where user is involved (paidBy or in splitData)
    const expenses = allExpenses.filter(expense => 
      expense.paidBy === userId || 
      expense.splitData?.some((split: ExpenseSplit) => split.userId === userId)
    );

    console.log('Total relevant expenses found:', expenses.length);

    // Calculate totals with proper fallbacks
    let totalSpent = 0;
    let totalOwed = 0;
    let totalOwing = 0;
    const splitCounts: { [key: string]: { userId: string; userName: string; count: number } } = {};

    expenses.forEach(expense => {
      if (expense.paidBy === userId) {
        totalSpent += expense.amount || 0;
      }
      
      const userSplit = expense.splitData?.find((split: ExpenseSplit) => split.userId === userId);
      if (userSplit) {
        if (expense.paidBy === userId) {
          // User paid, so others owe them
          const othersOwe = (expense.amount || 0) - (userSplit.amount || 0);
          totalOwed += othersOwe;
        } else if (!userSplit.isPaid) {
          // User owes money and hasn't paid yet
          totalOwing += userSplit.amount || 0;
        }
      }

      // Track split frequency
      expense.splitData?.forEach((split: ExpenseSplit) => {
        if (split.userId !== userId) {
          const key = split.userId;
          if (!splitCounts[key]) {
            splitCounts[key] = { userId: split.userId, userName: 'Unknown', count: 0 };
          }
          splitCounts[key].count++;
        }
      });
    });

    // Calculate average expense (only for expenses user paid)
    const userPaidExpenses = expenses.filter(exp => exp.paidBy === userId);
    const expenseCount = userPaidExpenses.length;
    const averageExpense = expenseCount > 0 ? totalSpent / expenseCount : 0;

    console.log('Calculated totals:', { totalSpent, totalOwed, totalOwing, expenseCount, averageExpense });

    // Monthly spending analysis
    const monthlyData: { [key: string]: number } = {};
    expenses.forEach(expense => {
      if (expense.paidBy === userId) {
        const monthKey = expense.date.toISOString().substring(0, 7); // YYYY-MM
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (expense.amount || 0);
      }
    });

    const monthlySpending = Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months

    // Category breakdown
    const categoryData: { [key: string]: number } = {};
    expenses.forEach(expense => {
      if (expense.paidBy === userId) {
        const category = expense.category || 'Other';
        categoryData[category] = (categoryData[category] || 0) + (expense.amount || 0);
      }
    });

    const totalCategorySpent = Object.values(categoryData).reduce((sum, amount) => sum + amount, 0);
    const categoryBreakdown = Object.entries(categoryData)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalCategorySpent > 0 ? (amount / totalCategorySpent) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Group analytics
    const groupAnalytics = userGroups.map(group => {
      const groupExpenses = expenses.filter(exp => exp.groupId === group.id);
      const groupSpent = groupExpenses
        .filter(exp => exp.paidBy === userId)
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
      return {
        groupName: group.name,
        totalSpent: groupSpent,
        memberCount: group.members.length
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);

    // Most frequent split partner - get name from group members or friends
    let splitWithMostFrequent = { userId: '', userName: '', count: 0 };
    
    if (Object.values(splitCounts).length > 0) {
      const mostFrequentSplit = Object.values(splitCounts).reduce((max, current) => 
        current.count > max.count ? current : max
      );
      
      // Try to get the actual user name
      let userName = 'Unknown';
      
      // Check in group members
      for (const group of userGroups) {
        const member = group.members.find(m => m.userId === mostFrequentSplit.userId);
        if (member) {
          userName = member.userData.fullName;
          break;
        }
      }
      
      // If not found in groups, try friends
      if (userName === 'Unknown') {
        try {
          const friends = await this.getFriends(userId);
          const friend = friends.find(f => f.friendId === mostFrequentSplit.userId);
          if (friend) {
            userName = friend.friendData.fullName;
          }
        } catch (error) {
          console.log('Could not fetch friends for split partner name');
        }
      }
      
      splitWithMostFrequent = {
        userId: mostFrequentSplit.userId,
        userName,
        count: mostFrequentSplit.count
      };
    }

    console.log('Analytics calculation completed successfully');

    return {
      totalSpent: totalSpent || 0,
      totalOwed: totalOwed || 0,
      totalOwing: totalOwing || 0,
      averageExpense: averageExpense || 0,
      expenseCount: expenseCount || 0,
      monthlySpending,
      categoryBreakdown,
      groupAnalytics,
      splitWithMostFrequent
    };
  } catch (error) {
    console.error('Get expense analytics error:', error);
    
    // Return safe defaults to prevent toFixed() errors
    return {
      totalSpent: 0,
      totalOwed: 0,
      totalOwing: 0,
      averageExpense: 0,
      expenseCount: 0,
      monthlySpending: [],
      categoryBreakdown: [],
      groupAnalytics: [],
      splitWithMostFrequent: { userId: '', userName: '', count: 0 }
    };
  }
}

static async removePendingFriendInvitation(userId: string, friendRequestId: string): Promise<void> {
  try {
    console.log('Removing pending friend invitation:', friendRequestId);
    
    // Delete the friend request
    await deleteDoc(doc(db, 'friendRequests', friendRequestId));
    
    // Also remove any pending invitation records
    const pendingQuery = query(
      collection(db, 'emailInvitations'),
      where('fromUserId', '==', userId),
      where('status', '==', 'sent')
    );
    
    const pendingSnapshot = await getDocs(pendingQuery);
    const batch = writeBatch(db);
    
    pendingSnapshot.docs.forEach(docSnapshot => {
      batch.delete(docSnapshot.ref);
    });
    
    if (pendingSnapshot.docs.length > 0) {
      await batch.commit();
    }
    
    console.log('✅ Pending friend invitation removed successfully');
    
  } catch (error) {
    console.error('❌ Remove pending friend invitation error:', error);
    throw new Error('Failed to remove pending invitation. Please try again.');
  }
}

// SETTLEMENT TRANSACTION METHODS
// Fix for Settlement Transaction undefined fields error in splitting.ts
// Replace the createSettlementTransaction method with this fixed version

static async createSettlementTransaction(settlementData: {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  description: string;
  groupId?: string;
  expenseId?: string;
  method: 'cash' | 'bank' | 'venmo' | 'paypal' | 'upi' | 'manual_settlement';
  notes?: string;
}): Promise<string> {
  try {
    console.log('Creating settlement transaction:', settlementData);
    
    // Get user data for both users
    const [fromUserDoc, toUserDoc] = await Promise.all([
      getDoc(doc(db, 'users', settlementData.fromUserId)),
      getDoc(doc(db, 'users', settlementData.toUserId))
    ]);
    
    if (!fromUserDoc.exists() || !toUserDoc.exists()) {
      throw new Error('User data not found');
    }
    
    const fromUserData = fromUserDoc.data();
    const toUserData = toUserDoc.data();
    
    // Get group data if groupId is provided
    let groupData = undefined;
    if (settlementData.groupId && settlementData.groupId !== 'personal') {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', settlementData.groupId));
        if (groupDoc.exists()) {
          const group = groupDoc.data() as Group;
          groupData = {
            name: group.name || 'Unknown Group',
            description: group.description
          };
        }
      } catch (error) {
        console.log('Failed to fetch group data:', error);
      }
    }
    
    const batch = writeBatch(db);
    
    // 1. Create the settlement transaction record - FIXED: Handle undefined fields properly
    const settlementTransaction: Omit<SettlementTransaction, 'id'> = {
      fromUserId: settlementData.fromUserId,
      fromUserData: {
        fullName: fromUserData?.fullName || 'Unknown User',
        email: fromUserData?.email || '',
        avatar: fromUserData?.profilePicture || ''
      },
      toUserId: settlementData.toUserId,
      toUserData: {
        fullName: toUserData?.fullName || 'Unknown User',
        email: toUserData?.email || '',
        avatar: toUserData?.profilePicture || ''
      },
      amount: settlementData.amount,
      currency: settlementData.currency,
      description: settlementData.description || `Settlement payment to ${toUserData?.fullName}`,
      // FIXED: Convert undefined to null for Firebase
      groupId: settlementData.groupId || null,
      groupData: groupData || null,
      expenseId: settlementData.expenseId || null,
      method: settlementData.method,
      status: 'completed',
      notes: settlementData.notes || '',
      settlementDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const settlementRef = doc(collection(db, 'settlementTransactions'));
    batch.set(settlementRef, settlementTransaction);
    
    // 2. Create a special settlement expense record for tracking
    const settlementExpense: Omit<Expense, 'id'> = {
      description: `Settlement: ${settlementData.description || 'Payment'}`,
      amount: settlementData.amount,
      currency: settlementData.currency,
      category: 'settlement',
      categoryIcon: '💸',
      groupId: settlementData.groupId || 'personal',
      paidBy: settlementData.fromUserId,
      paidByData: {
        fullName: fromUserData?.fullName || 'Unknown User',
        email: fromUserData?.email || '',
        avatar: fromUserData?.profilePicture || ''
      },
      splitType: 'equal',
      splitData: [{
        userId: settlementData.toUserId,
        amount: settlementData.amount,
        percentage: 100,
        isPaid: true,
        paidAt: new Date()
      }],
      notes: `Settlement payment via ${settlementData.method}${settlementData.notes ? '. ' + settlementData.notes : ''}`,
      tags: ['settlement', 'payment'],
      date: new Date(),
      isSettled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const expenseRef = doc(collection(db, 'expenses'));
    batch.set(expenseRef, settlementExpense);
    
    // 3. Update friend balances if they are friends
    try {
      await this.updateFriendBalance(settlementData.toUserId, settlementData.fromUserId, -settlementData.amount);
      console.log(`Updated friend balance after settlement: ${settlementData.fromUserId} paid ${settlementData.toUserId} ${settlementData.amount}`);
    } catch (error) {
      console.log('No friendship found, skipping friend balance update');
    }
    
    // 4. Update group member balances if in a group
    if (settlementData.groupId && settlementData.groupId !== 'personal') {
      await this.updateGroupMemberBalance(settlementData.groupId, settlementData.fromUserId, -settlementData.amount);
      await this.updateGroupMemberBalance(settlementData.groupId, settlementData.toUserId, settlementData.amount);
      
      // Add settlement message to group chat
      await this.sendGroupMessage({
        groupId: settlementData.groupId,
        userId: settlementData.fromUserId,
        userName: fromUserData?.fullName || 'Unknown User',
        message: `💸 Settled ${settlementData.currency} ${settlementData.amount} with ${toUserData?.fullName}`,
        type: 'system'
      });
    }
    
    await batch.commit();
    
    // 5. Send notifications
    await this.sendSettlementNotifications(settlementRef.id, settlementTransaction);
    
    console.log('✅ Settlement transaction created successfully:', settlementRef.id);
    return settlementRef.id;
    
  } catch (error) {
    console.error('❌ Create settlement transaction error:', error);
    throw error;
  }
}

static async sendSettlementNotifications(settlementId: string, settlement: Omit<SettlementTransaction, 'id'>): Promise<void> {
  try {
    // Notification to the receiver
    await this.createNotification({
      userId: settlement.toUserId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `${settlement.fromUserData.fullName} sent you ${settlement.currency} ${settlement.amount}`,
      data: {
        settlementId,
        fromUserId: settlement.fromUserId,
        amount: settlement.amount,
        currency: settlement.currency,
        method: settlement.method,
        groupId: settlement.groupId,
        navigationType: 'settlementDetails'
      },
      isRead: false,
      createdAt: new Date()
    });
    
    // Notification to the sender (confirmation)
    await this.createNotification({
      userId: settlement.fromUserId,
      type: 'expense_settled',
      title: 'Payment Sent',
      message: `Your payment of ${settlement.currency} ${settlement.amount} to ${settlement.toUserData.fullName} has been recorded`,
      data: {
        settlementId,
        toUserId: settlement.toUserId,
        amount: settlement.amount,
        currency: settlement.currency,
        method: settlement.method,
        groupId: settlement.groupId,
        navigationType: 'settlementDetails'
      },
      isRead: false,
      createdAt: new Date()
    });

    // Send push notifications using the PushNotificationService
    const { PushNotificationService } = await import('../notifications/PushNotificationService');
    
    // Push notification to receiver
    const receiverNotification = PushNotificationService.createExpenseSettledNotification(
      settlement.fromUserData.fullName,
      settlement.amount,
      settlement.currency,
      `Settlement for ${settlement.method} payment`,
      settlementId,
      settlement.groupId,
      settlement.groupData?.name,
      settlement.fromUserData.avatar
    );
    
    await PushNotificationService.sendNotificationToUser(settlement.toUserId, receiverNotification);
    
    // Push notification to sender (confirmation)
    const senderNotification = PushNotificationService.createExpenseSettledNotification(
      'System',
      settlement.amount,
      settlement.currency,
      `Payment confirmation`,
      settlementId,
      settlement.groupId,
      settlement.groupData?.name
    );
    senderNotification.title = 'Payment Confirmed';
    senderNotification.body = `Your payment of ${settlement.currency} ${settlement.amount} to ${settlement.toUserData.fullName} has been confirmed`;
    
    await PushNotificationService.sendNotificationToUser(settlement.fromUserId, senderNotification);
    
    console.log('✅ Settlement notifications sent');
    
  } catch (error) {
    console.error('❌ Send settlement notifications error:', error);
  }
}

static async getSettlementTransactions(userId: string, limitCount: number = 20): Promise<SettlementTransaction[]> {
  try {
    // Get settlements where user is either sender or receiver
    const sentQuery = query(
      collection(db, 'settlementTransactions'),
      where('fromUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount / 2)
    );
    
    const receivedQuery = query(
      collection(db, 'settlementTransactions'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount / 2)
    );
    
    const [sentSnapshot, receivedSnapshot] = await Promise.all([
      getDocs(sentQuery),
      getDocs(receivedQuery)
    ]);
    
    const sentSettlements = sentSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      settlementDate: doc.data().settlementDate?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as SettlementTransaction[];
    
    const receivedSettlements = receivedSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      settlementDate: doc.data().settlementDate?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as SettlementTransaction[];
    
    // Combine and sort by creation date
    const allSettlements = [...sentSettlements, ...receivedSettlements];
    allSettlements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return allSettlements.slice(0, limitCount);
    
  } catch (error) {
    console.error('❌ Get settlement transactions error:', error);
    return [];
  }
}

static async getGroupSettlementTransactions(groupId: string): Promise<SettlementTransaction[]> {
  try {
    const settlementsQuery = query(
      collection(db, 'settlementTransactions'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(settlementsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      settlementDate: doc.data().settlementDate?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as SettlementTransaction[];
    
  } catch (error) {
    console.error('❌ Get group settlement transactions error:', error);
    return [];
  }
}

// GROUP SETTLEMENT SUGGESTIONS - Calculate optimal settlement suggestions for all group members
// Fix for Settlement Suggestions in splitting.ts
// Replace the getGroupSettlementSuggestions method with this corrected version

static async getGroupSettlementSuggestions(groupId: string): Promise<Array<{
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  toUserId: string;
  toUserName: string;
  toUserAvatar?: string;
  amount: number;
}>> {
  try {
    console.log('🔄 Calculating settlement suggestions for group:', groupId);
    
    // Get group data
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) {
      throw new Error('Group not found');
    }
    
    const groupData = groupDoc.data() as Group;
    const activeMembers = groupData.members.filter(member => member.isActive);
    
    // Filter out members with zero balances and create debt matrix
    const membersWithBalances = activeMembers.filter(member => Math.abs(member.balance) > 0.01);
    
    if (membersWithBalances.length === 0) {
      return [];
    }
    
    // FIXED: Correct interpretation of balances
    // Positive balance = they are OWED money (creditor)
    // Negative balance = they OWE money (debtor)
    const creditors = membersWithBalances
      .filter(member => member.balance > 0.01) // People who are OWED money
      .map(member => ({
        userId: member.userId,
        userName: member.userData.fullName,
        userAvatar: member.userData.avatar,
        amount: member.balance // Amount they are owed
      }))
      .sort((a, b) => b.amount - a.amount); // Largest creditor first
    
    const debtors = membersWithBalances
      .filter(member => member.balance < -0.01) // People who OWE money
      .map(member => ({
        userId: member.userId,
        userName: member.userData.fullName,
        userAvatar: member.userData.avatar,
        amount: Math.abs(member.balance) // Amount they owe (convert negative to positive)
      }))
      .sort((a, b) => b.amount - a.amount); // Largest debtor first
    
    console.log('Creditors (people owed money):', creditors.length, 'Debtors (people who owe):', debtors.length);
    
    // Generate optimal settlement suggestions using debt minimization algorithm
    const settlements: Array<{
      fromUserId: string;
      fromUserName: string;
      fromUserAvatar?: string;
      toUserId: string;
      toUserName: string;
      toUserAvatar?: string;
      amount: number;
    }> = [];
    
    // Create working copies
    const workingCreditors = [...creditors];
    const workingDebtors = [...debtors];
    
    // Settlement algorithm: match largest debtor with largest creditor
    while (workingCreditors.length > 0 && workingDebtors.length > 0) {
      const creditor = workingCreditors[0]; // Person who is owed money
      const debtor = workingDebtors[0]; // Person who owes money
      
      // Calculate settlement amount (minimum of what creditor is owed and what debtor owes)
      const settlementAmount = Math.min(creditor.amount, debtor.amount);
      
      if (settlementAmount > 0.01) { // Only create settlements for amounts > 1 cent
        // FIXED: Correct direction - FROM debtor TO creditor
        settlements.push({
          fromUserId: debtor.userId, // Person who owes (pays)
          fromUserName: debtor.userName,
          fromUserAvatar: debtor.userAvatar,
          toUserId: creditor.userId, // Person who is owed (receives)
          toUserName: creditor.userName,
          toUserAvatar: creditor.userAvatar,
          amount: parseFloat(settlementAmount.toFixed(2))
        });
      }
      
      // Update balances
      creditor.amount -= settlementAmount; // Reduce what they're owed
      debtor.amount -= settlementAmount; // Reduce what they owe
      
      // Remove settled parties
      if (creditor.amount <= 0.01) {
        workingCreditors.shift();
      }
      if (debtor.amount <= 0.01) {
        workingDebtors.shift();
      }
    }
    
    console.log(`✅ Generated ${settlements.length} settlement suggestions`);
    return settlements;
    
  } catch (error) {
    console.error('❌ Get group settlement suggestions error:', error);
    throw error;
  }
}

// MARK PAYMENT AS PAID - Process settlement payment for groups or friends
static async markPaymentAsPaid(
  fromUserId: string,
  toUserId: string,
  amount: number,
  groupId?: string,
  description?: string
): Promise<void> {
  try {
    console.log('🔄 Marking payment as paid:', { fromUserId, toUserId, amount, groupId, description });
    
    // Get user data for both parties
    const [fromUserDoc, toUserDoc] = await Promise.all([
      getDoc(doc(db, 'users', fromUserId)),
      getDoc(doc(db, 'users', toUserId))
    ]);
    
    if (!fromUserDoc.exists() || !toUserDoc.exists()) {
      throw new Error('One or both users not found');
    }
    
    const fromUserData = fromUserDoc.data();
    const toUserData = toUserDoc.data();
    
    // Determine currency - use group currency if available, otherwise default
    let currency = 'USD';
    let groupData = undefined;
    
    if (groupId && groupId !== 'personal') {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (groupDoc.exists()) {
        const group = groupDoc.data() as Group;
        currency = group.currency || 'USD';
        groupData = {
          name: group.name || 'Unknown Group',
          description: group.description
        };
      }
    }
    
    // Create settlement transaction
    const settlementData = {
      fromUserId,
      toUserId,
      amount,
      currency,
      description: description || 'Manual settlement',
      groupId,
      method: 'manual_settlement' as const,
      notes: 'Marked as paid via settlement modal'
    };
    
    const settlementId = await this.createSettlementTransaction(settlementData);
    
    console.log('✅ Settlement transaction created:', settlementId);
    
    // Send confirmation notifications using NotificationManager
    try {
      const { notificationManager } = await import('../NotificationManager');
      
      // Send payment settlement notification
      await notificationManager.notifyPaymentSettled(
        fromUserId,
        toUserId,
        amount,
        currency,
        description || 'Manual settlement',
        settlementId,
        groupId,
        groupData?.name
      );
      
      console.log('✅ Payment settlement notifications sent via NotificationManager');
    } catch (notificationError) {
      console.error('❌ Error sending payment settlement notifications:', notificationError);
      
      // Fallback to direct notification creation if NotificationManager fails
      await this.createNotification({
        userId: toUserId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `${fromUserData.fullName} marked a payment of ${currency} ${amount} as paid`,
        data: {
          settlementId,
          fromUserId,
          amount,
          currency,
          method: 'manual_settlement',
          groupId,
          navigationType: 'settlementDetails'
        },
        isRead: false,
        createdAt: new Date()
      });

      await this.createNotification({
        userId: fromUserId,
        type: 'expense_settled',
        title: 'Payment Confirmed',
        message: `Your payment of ${currency} ${amount} to ${toUserData.fullName} has been recorded`,
        data: {
          settlementId,
          toUserId,
          amount,
          currency,
          method: 'manual_settlement',
          groupId,
          navigationType: 'settlementDetails'
        },
        isRead: false,
        createdAt: new Date()
      });
    }
    
    // Add settlement message to group chat if in a group
    if (groupId && groupId !== 'personal' && groupData) {
      await this.sendGroupMessage({
        groupId,
        userId: fromUserId,
        userName: fromUserData.fullName,
        message: `💰 Settled ${currency} ${amount} with ${toUserData.fullName}`,
        type: 'system'
      });
    }
    
    console.log('✅ Payment marked as paid successfully');
    
  } catch (error) {
    console.error('❌ Mark payment as paid error:', error);
    throw error;
  }
}
}

// Export individual functions for testing
export const getGroupSettlementSuggestions = (groupId: string) => SplittingService.getGroupSettlementSuggestions(groupId);
export const markPaymentAsPaid = (fromUserId: string, toUserId: string, amount: number, groupId?: string, description?: string) => 
  SplittingService.markPaymentAsPaid(fromUserId, toUserId, amount, groupId, description);
