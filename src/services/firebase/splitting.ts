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
  writeBatch,
  Timestamp
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
  inviteMethod?: 'email' | 'sms' | 'whatsapp' | 'qr'; // Add this field
  isNewUser?: boolean; // Add this to distinguish existing vs new users
  requestType?: 'sent' | 'received'; // Add this to distinguish sent vs received requests
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
  isSettlementTransaction?: boolean; // Flag to mark this as a settlement transaction (should not affect group totals)
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
export interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  method: string;
  groupId?: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: any;
  settledAt?: any;
}

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
      updatedAt: new Date(),
      source: message?.includes('QR code') ? 'qr_scan' : 'email_invite', // Track invitation source
      inviteMethod: message?.includes('QR code') ? 'qr' : 'email' // Also track the method for UI display
    };
    
    const docRef = await addDoc(collection(db, 'friendRequests'), friendRequest);
    console.log('✅ Friend request created:', docRef.id);
    console.log('🔍 Friend request details:', {
      fromUserId: fromUserId,
      fromUserName: fromUserData?.fullName,
      fromUserEmail: fromUserData?.email,
      toUserId: toUserId,
      toUserName: toUserData?.fullName,
      toUserEmail: toEmail
    });
    
    // Create notification for the recipient
    console.log('📝 Creating in-app notification for friend request...');
    console.log('🎯 Notification will be sent to userId:', toUserId, '(', toUserData?.fullName, ')');
    const notificationMessage = message?.includes('QR code') 
      ? `${fromUserData?.fullName || 'Someone'} scanned your QR code and wants to be your friend`
      : `${fromUserData?.fullName || 'Someone'} wants to be your friend`;
      
    await this.createNotification({
      userId: toUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: notificationMessage,
      data: { 
        friendRequestId: docRef.id,
        fromUserId,
        senderName: fromUserData?.fullName || 'Unknown User',
        senderEmail: fromUserData?.email || '',
        senderAvatar: fromUserData?.profilePicture || '',
        message: notificationMessage,
        source: friendRequest.source
      },
      isRead: false,
      createdAt: new Date()
    });
    console.log('✅ In-app notification created');

    // Send push notification to the recipient
    try {
      console.log('📲 Sending push notification for friend request...');
      console.log('🎯 Push notification will be sent to userId:', toUserId, '(', toUserData?.fullName, ')');
      const { RealNotificationService } = await import('../notifications/RealNotificationService');
      await RealNotificationService.sendFriendRequestNotification(
        toUserId,
        fromUserData?.fullName || 'Someone',
        fromUserId,
        docRef.id,
        fromUserData?.email || '',
        fromUserData?.profilePicture || ''
      );
      console.log('✅ Push notification sent successfully');
    } catch (notificationError) {
      console.warn('Failed to send push notification for friend request:', notificationError);
      // Don't fail the whole request if notification fails
    }

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
    
    // Remove the original friend request notification
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', requestData.toUserId),
        where('type', '==', 'friend_request'),
        where('data.requestId', '==', requestId)
      );
      const notificationSnapshot = await getDocs(notificationsQuery);
      
      if (!notificationSnapshot.empty) {
        const batch2 = writeBatch(db);
        notificationSnapshot.docs.forEach((doc) => {
          batch2.delete(doc.ref);
        });
        await batch2.commit();
        console.log('✅ Removed original friend request notification');
      }
    } catch (notificationError) {
      console.warn('Failed to remove original friend request notification:', notificationError);
    }
    
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

    // Remove the original friend request notification
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', requestData.toUserId),
        where('type', '==', 'friend_request'),
        where('data.requestId', '==', requestId)
      );
      const notificationSnapshot = await getDocs(notificationsQuery);
      
      if (!notificationSnapshot.empty) {
        const batch = writeBatch(db);
        notificationSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('✅ Removed original friend request notification');
      }
    } catch (notificationError) {
      console.warn('Failed to remove original friend request notification:', notificationError);
    }

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

// Check friendship status by email - simplified version for QR code scanning
static async checkFriendshipStatus(userId: string, friendEmail: string): Promise<string | null> {
  try {
    const existingCheck = await this.checkExistingFriendship(userId, friendEmail);
    return existingCheck.isFriend ? existingCheck.status || null : null;
  } catch (error) {
    console.error('Check friendship status error:', error);
    return null;
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

// Ensure friendship exists between two users
static async ensureFriendship(userId1: string, userId2: string): Promise<void> {
  try {
    // Get user data for both users
    const [user1Doc, user2Doc] = await Promise.all([
      getDoc(doc(db, 'users', userId1)),
      getDoc(doc(db, 'users', userId2))
    ]);
    
    if (!user1Doc.exists() || !user2Doc.exists()) {
      throw new Error('One or both users not found');
    }
    
    const user1Data = user1Doc.data();
    const user2Data = user2Doc.data();
    
    // Check if friendship already exists
    const existingCheck = await this.checkExistingFriendship(userId1, user2Data.email);
    
    if (existingCheck.isFriend) {
      console.log('Friendship already exists');
      return;
    }
    
    // Create friendship for both users
    const friendship1: Omit<Friend, 'id'> = {
      userId: userId1,
      friendId: userId2,
      friendData: {
        id: userId2,
        fullName: user2Data.fullName || 'Unknown User',
        email: user2Data.email || '',
        mobile: '',
        avatar: user2Data.profilePicture || '',
        profilePicture: user2Data.profilePicture || ''
      },
      status: 'accepted',
      balance: 0,
      lastActivity: new Date(),
      createdAt: new Date()
    };
    
    const friendship2: Omit<Friend, 'id'> = {
      userId: userId2,
      friendId: userId1,
      friendData: {
        id: userId1,
        fullName: user1Data.fullName || 'Unknown User',
        email: user1Data.email || '',
        mobile: '',
        avatar: user1Data.profilePicture || '',
        profilePicture: user1Data.profilePicture || ''
      },
      status: 'accepted',
      balance: 0,
      lastActivity: new Date(),
      createdAt: new Date()
    };
    
    await addDoc(collection(db, 'friends'), friendship1);
    await addDoc(collection(db, 'friends'), friendship2);
    
    console.log('Friendship created between users');
  } catch (error) {
    console.error('Ensure friendship error:', error);
    throw error;
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
      
      // 🔥 CRITICAL FIX: Auto-create friendships between all group members
      // This ensures that group expenses can update friend balances properly
      console.log('🤝 Auto-creating friendships between group members...');
      
      for (const existingMember of groupData.members) {
        if (existingMember.userId === userId) continue; // Skip self
        
        try {
          // Check if friendship already exists
          const existingCheck = await this.checkExistingFriendship(existingMember.userId, userData?.email || '');
          
          if (!existingCheck.isFriend) {
            console.log(`🔗 Creating friendship between ${userId} and ${existingMember.userId}`);
            
            // Create friendship in both directions
            const friendship1: Omit<Friend, 'id'> = {
              userId: userId,
              friendId: existingMember.userId,
              friendData: {
                id: existingMember.userId,
                fullName: existingMember.userData.fullName,
                email: existingMember.userData.email,
                mobile: '',
                avatar: existingMember.userData.avatar || '',
                profilePicture: existingMember.userData.avatar || ''
              },
              status: 'accepted',
              balance: 0,
              lastActivity: new Date(),
              createdAt: new Date()
            };
            
            const friendship2: Omit<Friend, 'id'> = {
              userId: existingMember.userId,
              friendId: userId,
              friendData: {
                id: userId,
                fullName: userData?.fullName || 'Unknown User',
                email: userData?.email || '',
                mobile: '',
                avatar: userData?.profilePicture || '',
                profilePicture: userData?.profilePicture || ''
              },
              status: 'accepted',
              balance: 0,
              lastActivity: new Date(),
              createdAt: new Date()
            };
            
            // Add both friendships
            await addDoc(collection(db, 'friends'), friendship1);
            await addDoc(collection(db, 'friends'), friendship2);
            
            console.log(`✅ Auto-created friendship between ${userId} and ${existingMember.userId}`);
          } else {
            console.log(`🔗 Friendship already exists between ${userId} and ${existingMember.userId}`);
          }
        } catch (friendshipError) {
          console.error(`❌ Failed to create friendship between ${userId} and ${existingMember.userId}:`, friendshipError);
          // Don't throw - group member addition should succeed even if friendship creation fails
        }
      }
      
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
              const updatedGroupData = { id: updatedGroupDoc.id, ...updatedGroupDoc.data() } as Group;
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
    console.log('🔍 SplittingService - Received paidBy:', expenseData.paidBy);
    console.log('🔍 SplittingService - Split data:', expenseData.splitData.map(s => `${s.userId}: ${s.amount}`));
    
    const batch = writeBatch(db);
    
    // Sanitize paidByData to ensure no undefined values
    const sanitizedPaidByData = {
      fullName: expenseData.paidByData?.fullName || 'Unknown User',
      email: expenseData.paidByData?.email || '',
      avatar: expenseData.paidByData?.avatar || ''
    };
    
    const newExpense: Omit<Expense, 'id'> = {
      ...expenseData,
      paidByData: sanitizedPaidByData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const expenseRef = doc(collection(db, 'expenses'));
    batch.set(expenseRef, newExpense);
    console.log('Expense document prepared with ID:', expenseRef.id);
    
    // Update group total expenses - skip for settlement transactions
    if (!expenseData.isSettlementTransaction) {
      batch.update(doc(db, 'groups', expenseData.groupId), {
        totalExpenses: increment(expenseData.amount),
        updatedAt: serverTimestamp()
      });
      console.log('Group update prepared - updated total expenses');
    } else {
      // Just update the timestamp for settlement transactions
      batch.update(doc(db, 'groups', expenseData.groupId), {
        updatedAt: serverTimestamp()
      });
      console.log('Group update prepared - settlement transaction (not affecting total)');
    }
    
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
    console.log('🔍 SplittingService - Starting balance updates with paidBy:', expenseData.paidBy);
    for (const split of expenseData.splitData) {
      console.log(`🔍 Processing split for ${split.userId}, amount: ${split.amount}`);
      if (split.userId !== expenseData.paidBy) {
        console.log(`🔍 ${split.userId} != ${expenseData.paidBy}, updating balances`);
        // FIXED: Correct balance direction
        // Split members OWE money (negative balance)
        await this.updateGroupMemberBalance(expenseData.groupId, split.userId, -split.amount);
        // Payer is OWED money (positive balance)
        await this.updateGroupMemberBalance(expenseData.groupId, expenseData.paidBy, split.amount);
        
        // Also update friend balances if they are friends
        try {
          await this.updateFriendBalance(expenseData.paidBy, split.userId, split.amount);
          console.log(`Updated friend balance between ${expenseData.paidBy} and ${split.userId} by ${split.amount}`);
        } catch (error) {
          console.log(`No friendship found between ${expenseData.paidBy} and ${split.userId}, skipping friend balance update`);
        }
      } else {
        console.log(`🔍 ${split.userId} === ${expenseData.paidBy}, skipping (payer doesn't owe themselves)`);
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
        const groupData = { 
          id: groupDoc.id, 
          ...groupDoc.data() 
        } as Group;
        
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
static async debugFriendBalance(userId1: string, userId2: string): Promise<void> {
  try {
    console.log('🔍 DEBUG: Checking friend balance state');
    
    // Check friends collection
    const friendshipQuery1 = query(
      collection(db, 'friends'),
      where('userId', '==', userId1),
      where('friendId', '==', userId2),
      limit(1)
    );
    
    const friendshipQuery2 = query(
      collection(db, 'friends'),
      where('userId', '==', userId2),
      where('friendId', '==', userId1),
      limit(1)
    );
    
    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(friendshipQuery1),
      getDocs(friendshipQuery2)
    ]);
    
    if (!snapshot1.empty) {
      const data1 = snapshot1.docs[0].data();
      console.log(`📊 ${userId1}'s view of ${userId2}:`, {
        balance: data1.balance,
        status: data1.status,
        docId: snapshot1.docs[0].id
      });
    } else {
      console.log(`❌ No friendship found from ${userId1} to ${userId2}`);
    }
    
    if (!snapshot2.empty) {
      const data2 = snapshot2.docs[0].data();
      console.log(`📊 ${userId2}'s view of ${userId1}:`, {
        balance: data2.balance,
        status: data2.status,
        docId: snapshot2.docs[0].id
      });
    } else {
      console.log(`❌ No friendship found from ${userId2} to ${userId1}`);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
};

static async updateFriendBalance(
  userId1: string, 
  userId2: string, 
  amount: number,
  isSettlement: boolean = false
): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    console.log(`🔄 Updating friend balance: ${userId1} <-> ${userId2}, amount: ${amount}, isSettlement: ${isSettlement}`);
    
    // First, ensure the friendship exists in the friends collection
    const friendshipQuery1 = query(
      collection(db, 'friends'),
      where('userId', '==', userId1),
      where('friendId', '==', userId2),
      limit(1)
    );
    
    const friendshipQuery2 = query(
      collection(db, 'friends'),
      where('userId', '==', userId2),
      where('friendId', '==', userId1),
      limit(1)
    );
    
    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(friendshipQuery1),
      getDocs(friendshipQuery2)
    ]);
    
    if (isSettlement) {
      console.log(`💰 Processing settlement: ${userId1} pays ${userId2} $${amount}`);
      
      // Update user1's view (they paid, so their debt decreases)
      if (!snapshot1.empty) {
        const doc1 = snapshot1.docs[0];
        const currentBalance1 = doc1.data().balance || 0;
        const newBalance1 = currentBalance1 + amount; // If they owed money (negative), this makes it less negative
        
        console.log(`📊 ${userId1}'s balance: ${currentBalance1} → ${newBalance1}`);
        batch.update(doc1.ref, { 
          balance: newBalance1,
          lastActivity: new Date(),
          lastSettlementDate: new Date() // Add this to track settlements
        });
      }
      
      // Update user2's view (they received payment, so what they're owed decreases)
      if (!snapshot2.empty) {
        const doc2 = snapshot2.docs[0];
        const currentBalance2 = doc2.data().balance || 0;
        const newBalance2 = currentBalance2 - amount; // If they were owed money (positive), this reduces it
        
        console.log(`📊 ${userId2}'s balance: ${currentBalance2} → ${newBalance2}`);
        batch.update(doc2.ref, { 
          balance: newBalance2,
          lastActivity: new Date(),
          lastSettlementDate: new Date() // Add this to track settlements
        });
      }
    } else {
      // Regular expense update
      console.log(`📝 Processing expense: ${userId1} is owed ${amount} by ${userId2}`);
      
      if (!snapshot1.empty) {
        const doc1 = snapshot1.docs[0];
        const currentBalance1 = doc1.data().balance || 0;
        const newBalance1 = currentBalance1 + amount;
        
        console.log(`📊 ${userId1}'s balance: ${currentBalance1} → ${newBalance1}`);
        batch.update(doc1.ref, { 
          balance: newBalance1,
          lastActivity: new Date()
        });
      }
      
      if (!snapshot2.empty) {
        const doc2 = snapshot2.docs[0];
        const currentBalance2 = doc2.data().balance || 0;
        const newBalance2 = currentBalance2 - amount;
        
        console.log(`📊 ${userId2}'s balance: ${currentBalance2} → ${newBalance2}`);
        batch.update(doc2.ref, { 
          balance: newBalance2,
          lastActivity: new Date()
        });
      }
    }
    
    await batch.commit();
    console.log('✅ Friend balance update completed');
    
    // Force a refresh of the balance data
    try {
      const ExpenseRefreshService = (await import('@/services/expenseRefreshService')).default;
      const refreshService = ExpenseRefreshService.getInstance();
      refreshService.notifyBalanceChange();
      refreshService.notifyExpenseChange(); // Also notify expense change
    } catch (error) {
      console.log('Could not notify balance change:', error);
    }
    
  } catch (error) {
    console.error('❌ Error updating friend balance:', error);
    throw error;
  }
};


  static async getGroupExpenses(groupId: string): Promise<Expense[]> {
  try {
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(expensesQuery);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date && typeof data.date.toDate === 'function' ? data.date.toDate() : new Date(),
        createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date(),
      };
    }) as Expense[];
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

      // Ensure message field is never undefined
      const safeMessage = requestData.message || '';

      // Send notification to the recipient with safe data
      await this.createNotification({
        userId: requestData.toUserId,
        type: 'payment_request',
        title: 'Payment Request',
        message: `${fromUserData?.fullName || 'Someone'} requested ${requestData.currency} ${requestData.amount}${safeMessage ? ': ' + safeMessage : ''}`,
        data: {
          requestId: docRef.id,
          fromUserId: requestData.fromUserId,
          amount: requestData.amount,
          currency: requestData.currency,
          message: safeMessage,
          navigationType: 'paymentRequestDetails'
        },
        isRead: false,
        createdAt: new Date()
      });

      // Try to send push notification using the notification service
      try {
        const { PushNotificationService } = await import('../notifications/PushNotificationService');
        
        // Ensure message field is never undefined
        const safeMessage = requestData.message || '';
        
        const pushNotification: PushNotificationData = {
          type: 'payment_request',
          title: 'Payment Request',
          body: `${fromUserData?.fullName} requested ${requestData.currency} ${requestData.amount}`,
          data: {
            requestId: docRef.id,
            fromUserId: requestData.fromUserId,
            amount: requestData.amount,
            currency: requestData.currency,
            message: safeMessage
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
  
  // GET PENDING FRIEND INVITATIONS (EMAIL + SMS/WHATSAPP + EMAIL TO NON-USERS)
static async getPendingFriendInvitations(userId: string): Promise<Friend[]> {
  try {
    console.log('🔍 Fetching pending invitations for user:', userId);
    
    // 1. Get email-based friend requests SENT BY the user (for existing Spendy users)
    const sentEmailRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const sentEmailSnapshot = await getDocs(sentEmailRequestsQuery);
    console.log('📧 Found', sentEmailSnapshot.docs.length, 'sent email friend requests (existing users)');
    
    const sentEmailInvitations = sentEmailSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('📋 Email pending invitation SENT (existing user):', {
        id: doc.id,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        toUserData: data.toUserData,
        status: data.status
      });
      
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
        requestId: doc.id,
        inviteMethod: 'email',
        isNewUser: false, // Existing Spendy user
        requestType: 'sent' // Mark as sent request
      };
    }) as Friend[];

    // 2. Get email-based friend requests RECEIVED BY the user (for existing Spendy users)
    const receivedEmailRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const receivedEmailSnapshot = await getDocs(receivedEmailRequestsQuery);
    console.log('📧 Found', receivedEmailSnapshot.docs.length, 'received email friend requests (existing users)');
    
    const receivedEmailInvitations = receivedEmailSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('📋 Email pending invitation RECEIVED (existing user):', {
        id: doc.id,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        fromUserData: data.fromUserData,
        status: data.status
      });
      
      return {
        id: doc.id,
        userId: data.toUserId, // The current user is the recipient
        friendId: data.fromUserId, // The sender is the friend
        friendData: data.fromUserData, // Display sender's data
        status: 'pending' as const, // Use 'pending' to distinguish from 'invited'
        balance: 0,
        lastActivity: data.createdAt?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        invitedAt: data.createdAt?.toDate() || new Date(),
        requestId: doc.id,
        inviteMethod: 'email',
        isNewUser: false, // Existing Spendy user
        requestType: 'received' // Mark as received request
      };
    }) as Friend[];

    // 2. Get email invitations for non-existing users
    const emailInvitationsQuery = query(
      collection(db, 'emailInvitations'),
      where('fromUserId', '==', userId),
      where('status', '==', 'sent'),
      orderBy('createdAt', 'desc')
    );
    
    const emailInvitationsSnapshot = await getDocs(emailInvitationsQuery);
    console.log('📧 Found', emailInvitationsSnapshot.docs.length, 'email invitations (new users)');
    
    const emailNewUserInvitations = emailInvitationsSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('📋 Email invitation (new user):', {
        id: doc.id,
        fromUserId: data.fromUserId,
        toEmail: data.toEmail,
        status: data.status
      });
      
      return {
        id: doc.id,
        userId: data.fromUserId,
        friendId: `temp_email_${doc.id}`, // Temporary ID for non-registered users
        friendData: {
          id: `temp_email_${doc.id}`,
          fullName: data.toEmail.split('@')[0], // Use email prefix as name
          email: data.toEmail,
          avatar: ''
        },
        status: 'invited' as const,
        balance: 0,
        lastActivity: data.createdAt?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        invitedAt: data.createdAt?.toDate() || new Date(),
        requestId: doc.id,
        inviteMethod: 'email',
        isNewUser: true, // New user (not yet on Spendy)
        requestType: 'sent' // Mark as sent request
      };
    }) as Friend[];

    // 3. Get SMS/WhatsApp-based pending invitations
    const smsRequestsQuery = query(
      collection(db, 'pendingInvitations'),
      where('fromUserId', '==', userId),
      where('status', '==', 'invited'),
      orderBy('createdAt', 'desc')
    );
    
    const smsSnapshot = await getDocs(smsRequestsQuery);
    console.log('📱 Found', smsSnapshot.docs.length, 'pending SMS/WhatsApp invitations');
    
    const smsInvitations = smsSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('📋 SMS/WhatsApp pending invitation:', {
        id: doc.id,
        fromUserId: data.fromUserId,
        toUserData: data.toUserData,
        contactMethod: data.contactMethod,
        status: data.status
      });
      
      return {
        id: doc.id,
        userId: data.fromUserId,
        friendId: `temp_${doc.id}`, // Temporary ID for non-registered users
        friendData: data.toUserData,
        status: 'invited' as const,
        balance: 0,
        lastActivity: data.createdAt?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        invitedAt: data.createdAt?.toDate() || new Date(),
        requestId: doc.id,
        inviteMethod: data.contactMethod || 'sms',
        isNewUser: true, // SMS/WhatsApp invites are always to new users
        requestType: 'sent' // Mark as sent request
      };
    }) as Friend[];
    
    const allInvitations = [...sentEmailInvitations, ...receivedEmailInvitations, ...emailNewUserInvitations, ...smsInvitations];
    console.log('✅ Returning', allInvitations.length, 'total pending invitations:', {
      sentExistingUsers: sentEmailInvitations.length,
      receivedExistingUsers: receivedEmailInvitations.length,
      newEmailUsers: emailNewUserInvitations.length, 
      smsWhatsApp: smsInvitations.length
    });
    return allInvitations;
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
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date && typeof data.date.toDate === 'function' ? data.date.toDate() : new Date(),
        createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(),
        updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date(),
      };
    }) as Expense[];
    
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

  static async getGroupBalanceOverview(groupId: string): Promise<{
    memberRelationships: Array<{
      memberId: string;
      memberName: string;
      memberEmail: string;
      memberAvatar?: string;
      balance: number;
      otherMemberName?: string;
    }>;
    totalGroupDebt: number;
    totalGroupCredit: number;
    netBalance: number;
    isBalanced: boolean;
    groupName: string;
    memberCount: number;
  }> {
    try {
      console.log('🔄 Getting group balance overview for group:', groupId);
      
      // Get group data
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        throw new Error('Group not found');
      }
      
      const groupData = groupDoc.data() as Group;
      
      // Get all expenses for this specific group only
      const expenses = await this.getGroupExpenses(groupId);

      console.log(`💰 Found ${expenses.length} expenses in group ${groupData.name}`);
      
      // Get active members only from this group
      const allMembers = groupData.members || [];
      const activeMembers = allMembers.filter(member => member.isActive !== false);
      
      console.log('👥 Active members in group:', activeMembers.length);
      
      if (activeMembers.length === 0) {
        console.warn('⚠️ No active members found in group');
        return {
          memberRelationships: [],
          totalGroupDebt: 0,
          totalGroupCredit: 0,
          netBalance: 0,
          isBalanced: true,
          groupName: groupData.name,
          memberCount: 0
        };
      }
      
      // Calculate balances from expenses for this group only
      const memberBalances = new Map<string, number>();
      
      // Initialize all members with 0 balance
      activeMembers.forEach(member => {
        memberBalances.set(member.userId, 0);
      });
      
      // Process each expense for this group
      expenses.forEach(expense => {
        const totalAmount = expense.amount || 0;
        const paidBy = expense.paidBy;
        const splitMembers = expense.splitData || [];
        
        if (splitMembers.length === 0) return;
        
        console.log(`� Processing expense: ${expense.description} - $${totalAmount} paid by ${paidBy}`);
        console.log(`📊 Split data:`, splitMembers.map(s => `${s.userId}: ${s.amount} (paid: ${s.isPaid})`));
        
        // The payer is owed the total amount
        if (memberBalances.has(paidBy)) {
          memberBalances.set(paidBy, (memberBalances.get(paidBy) || 0) + totalAmount);
        }
        
        // Each split member owes their share
        splitMembers.forEach((split) => {
          if (memberBalances.has(split.userId)) {
            memberBalances.set(split.userId, (memberBalances.get(split.userId) || 0) - split.amount);
          }
        });
      });
      
      console.log('💰 Calculated member balances:');
      memberBalances.forEach((balance, userId) => {
        const member = activeMembers.find(m => m.userId === userId);
        console.log(`  ${member?.userData?.fullName || userId}: $${balance.toFixed(2)}`);
      });
      
      // Create member relationships with proper structure for the modal
      const memberRelationships = activeMembers.map(member => {
        const balance = memberBalances.get(member.userId) || 0;
        const roundedBalance = Math.round(balance * 100) / 100;
        
        return {
          memberId: member.userId,
          memberName: member.userData?.fullName || 'Unknown',
          memberEmail: member.userData?.email || '',
          memberAvatar: member.userData?.avatar || '',
          balance: roundedBalance,
          otherMemberName: 'undefined' // This will be shown in the "vs" line
        };
      });
      
      // Calculate totals for the group
      const totalGroupCredit = memberRelationships
        .filter(member => member.balance > 0.01)
        .reduce((sum, member) => sum + member.balance, 0);
      
      const totalGroupDebt = Math.abs(memberRelationships
        .filter(member => member.balance < -0.01)
        .reduce((sum, member) => sum + member.balance, 0));
      
      const netBalance = totalGroupCredit - totalGroupDebt;
      const isBalanced = Math.abs(netBalance) < 0.01;
      
      console.log('✅ Group balance overview calculated from expenses:', {
        groupName: groupData.name,
        memberCount: activeMembers.length,
        totalGroupCredit: Math.round(totalGroupCredit * 100) / 100,
        totalGroupDebt: Math.round(totalGroupDebt * 100) / 100,
        netBalance: Math.round(netBalance * 100) / 100,
        isBalanced,
        memberBalances: memberRelationships.map(m => ({ name: m.memberName, balance: m.balance }))
      });
      
      return {
        memberRelationships,
        totalGroupCredit: Math.round(totalGroupCredit * 100) / 100,
        totalGroupDebt: Math.round(totalGroupDebt * 100) / 100,
        netBalance: Math.round(netBalance * 100) / 100,
        isBalanced,
        groupName: groupData.name,
        memberCount: activeMembers.length
      };
      
    } catch (error) {
      console.error('Get group balance overview error:', error);
      throw error;
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
        updatedAt: new Date() // Ensure we always set a new timestamp
      };
      
      batch.update(doc(db, 'expenses', expenseId), updatedExpense);
      console.log('Expense update prepared with new timestamp:', updatedExpense.updatedAt);
      
      // Calculate the difference in amount to adjust group total
      const amountDifference = expenseData.amount - currentExpense.amount;
      
      if (amountDifference !== 0) {
        // Only update group totals for regular expenses, not settlements
        if (!currentExpense.isSettlementTransaction && !expenseData.isSettlementTransaction) {
          // Update group total expenses
          batch.update(doc(db, 'groups', expenseData.groupId), {
            totalExpenses: increment(amountDifference),
            updatedAt: serverTimestamp()
          });
          console.log('Group total update prepared, difference:', amountDifference);
        } else {
          // Just update timestamp for settlement transactions
          batch.update(doc(db, 'groups', expenseData.groupId), {
            updatedAt: serverTimestamp()
          });
          console.log('Group timestamp updated, settlement transaction not affecting total');
        }
      }
      
      // Add update notification to group chat
      const updateMessage = {
          groupId: expenseData.groupId,
          userId: expenseData.paidBy,
          userName: expenseData.paidByData?.fullName || 'Unknown User',
          userAvatar: expenseData.paidByData?.avatar || '',
          message: `Edited expense: ${expenseData.description}`,
          timestamp: serverTimestamp(),
          type: 'expense' as const, // Changed from 'system' to 'expense'
          isEdit: true, // Add this flag to distinguish edited expenses
          expenseData: {
            id: expenseId,
            description: expenseData.description,
            amount: expenseData.amount,
            currency: expenseData.currency,
            expenseDate: expenseData.expenseDate
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
            // Reverse group member balance (undo the wrong signs)
            await this.updateGroupMemberBalance(currentExpense.groupId, oldSplit.userId, oldSplit.amount);
            await this.updateGroupMemberBalance(currentExpense.groupId, currentExpense.paidBy, -oldSplit.amount);
            
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
            // FIXED: Correct balance direction
            // Split members OWE money (negative balance)
            await this.updateGroupMemberBalance(expenseData.groupId, newSplit.userId, -newSplit.amount);
            // Payer is OWED money (positive balance)
            await this.updateGroupMemberBalance(expenseData.groupId, expenseData.paidBy, newSplit.amount);
            
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
    
    // 2. Reverse group total expenses - but only for regular expenses, not settlements
    if (!expense.isSettlementTransaction) {
      batch.update(doc(db, 'groups', expense.groupId), {
        totalExpenses: increment(-expense.amount),
        updatedAt: serverTimestamp()
      });
    } else {
      // Just update timestamp for settlement transactions
      batch.update(doc(db, 'groups', expense.groupId), {
        updatedAt: serverTimestamp()
      });
    }
    
    // 3. Reverse all balance calculations
    for (const split of expense.splitData) {
      if (split.userId !== expense.paidBy) {
        // Reverse group member balances (undo the wrong signs)
        await this.updateGroupMemberBalance(expense.groupId, split.userId, split.amount);
        await this.updateGroupMemberBalance(expense.groupId, expense.paidBy, -split.amount);
        
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
      const data = docSnapshot.data();
      
      // Convert Firebase Timestamps to JavaScript Dates
      const recurring = { 
        id: docSnapshot.id, 
        ...data,
        startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate),
        endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
        nextDueDate: data.nextDueDate?.toDate ? data.nextDueDate.toDate() : new Date(data.nextDueDate),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        lastProcessedDate: data.lastProcessedDate?.toDate ? data.lastProcessedDate.toDate() : (data.lastProcessedDate ? new Date(data.lastProcessedDate) : undefined)
      } as RecurringExpense;
      
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
        paidByData: {
          fullName: recurring.paidByData?.fullName || 'Unknown User',
          email: recurring.paidByData?.email || '',
          avatar: '' // RecurringExpense paidByData doesn't have avatar field
        },
        splitType: recurring.splitType,
        splitData: recurring.splitData,
        notes: `Recurring: ${recurring.templateName}`,
        tags: ['recurring'],
        date: new Date(),
        isSettled: false
      });
      
      // Calculate next due date with proper validation
      let nextDue: Date;
      try {
        // Handle Firebase Timestamp objects
        if (recurring.nextDueDate && typeof recurring.nextDueDate === 'object' && 'toDate' in recurring.nextDueDate) {
          nextDue = (recurring.nextDueDate as any).toDate();
        } else {
          nextDue = new Date(recurring.nextDueDate);
        }
        
        // Validate the date
        if (isNaN(nextDue.getTime())) {
          console.error('Invalid nextDueDate for recurring expense:', recurring.id, recurring.nextDueDate);
          // Skip this recurring expense and mark it as inactive
          await updateDoc(doc(db, 'recurringExpenses', recurring.id), {
            isActive: false,
            updatedAt: new Date()
          });
          continue;
        }
      } catch (dateError) {
        console.error('Date parsing error for recurring expense:', recurring.id, dateError);
        // Skip this recurring expense and mark it as inactive
        await updateDoc(doc(db, 'recurringExpenses', recurring.id), {
          isActive: false,
          updatedAt: new Date()
        });
        continue;
      }
      
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
      
      // Validate the computed next due date
      if (isNaN(nextDue.getTime())) {
        console.error('Invalid computed nextDueDate for recurring expense:', recurring.id);
        // Mark as inactive to prevent further processing
        await updateDoc(doc(db, 'recurringExpenses', recurring.id), {
          isActive: false,
          updatedAt: new Date()
        });
        continue;
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
          
          // Safe date parsing function
          const parseDate = (dateField: any): Date => {
            try {
              if (!dateField) {
                return new Date();
              }
              
              if (dateField instanceof Date) {
                return dateField;
              }
              
              if (typeof dateField === 'object' && typeof dateField.toDate === 'function') {
                return dateField.toDate();
              }
              
              if (typeof dateField === 'string' || typeof dateField === 'number') {
                const parsed = new Date(dateField);
                return isNaN(parsed.getTime()) ? new Date() : parsed;
              }
              
              return new Date();
            } catch (error) {
              console.warn('Date parsing error:', error, 'for field:', dateField);
              return new Date();
            }
          };
          
          return {
            id: doc.id,
            ...data,
            date: parseDate(data.date) || parseDate(data.createdAt) || new Date(),
            createdAt: parseDate(data.createdAt) || new Date(),
            updatedAt: parseDate(data.updatedAt) || new Date(),
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

// Send friend request reminder via app notification
static async sendFriendRequestReminder(fromUserId: string, toUserId: string, notificationData: any): Promise<void> {
  try {
    console.log('Sending friend request reminder:', { fromUserId, toUserId });
    
    // Get user data for the reminder
    const fromUserDoc = await getDoc(doc(db, 'users', fromUserId));
    const fromUserData = fromUserDoc.data();
    
    // Create notification in Firestore
    const notificationRef = await addDoc(collection(db, 'notifications'), {
      userId: toUserId,
      fromUserId: fromUserId,
      type: 'friend_request_reminder',
      title: notificationData.title || 'Friend Request Reminder',
      message: notificationData.message || `${fromUserData?.fullName || 'Someone'} is waiting for you to accept their friend request!`,
      data: {
        ...notificationData.data,
        fromUserName: fromUserData?.fullName || 'Someone',
        fromUserEmail: fromUserData?.email || '',
        fromUserAvatar: fromUserData?.profilePicture || ''
      },
      read: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Friend request reminder notification created:', notificationRef.id);
    
    // Send push notification to the target user
    try {
      const { RealNotificationService } = await import('../notifications/RealNotificationService');
      await RealNotificationService.sendFriendRequestNotification(
        toUserId,
        fromUserData?.fullName || 'Someone',
        fromUserId,
        notificationData.data?.requestId || '',
        fromUserData?.email || '',
        fromUserData?.profilePicture || ''
      );
      console.log('✅ Push notification reminder sent successfully');
    } catch (notificationError) {
      console.warn('Failed to send push notification reminder:', notificationError);
      // Don't fail the whole operation if push notification fails
    }
    
  } catch (error) {
    console.error('❌ Send friend request reminder error:', error);
    throw new Error('Failed to send reminder. Please try again.');
  }
}

static async markPaymentAsPaid(
  fromUserId: string,
  toUserId: string,
  amount: number,
  groupId?: string,
  description?: string
): Promise<void> {
  try {
    console.log('🔄 ENHANCED: Marking payment as paid with full synchronization');
    console.log(`💰 Payment: ${fromUserId} pays ${toUserId} $${amount}`);
    
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
    
    // 1. Create settlement transaction first
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
    
    // Create the settlement record FIRST
    const settlementId = await this.createSettlementTransaction(
      fromUserId,
      toUserId,
      amount,
      'manual_settlement',
      groupId,
      description || 'Manual settlement',
      currency
    );
    
    // 2. Update expense splits to mark them as paid (if any)
    await this.updateExpenseSplitsForSettlement(fromUserId, toUserId, amount, groupId);
    
    // 3. Add settlement message to group chat
    if (groupId && groupId !== 'personal' && groupData) {
      await this.sendGroupMessage({
        groupId,
        userId: fromUserId,
        userName: fromUserData.fullName,
        message: `💰 Settled ${currency} ${amount} with ${toUserData.fullName}`,
        type: 'system'
      });
    }
    
    // 4. Force a complete refresh of all balances
    try {
      const ExpenseRefreshService = (await import('@/services/expenseRefreshService')).default;
      const refreshService = ExpenseRefreshService.getInstance();
      
      // Notify multiple times to ensure UI updates
      setTimeout(() => {
        refreshService.notifyBalanceChange();
        refreshService.notifyExpenseChange();
        refreshService.notifyGroupUpdated();
      }, 100);
      
      setTimeout(() => {
        refreshService.notifyBalanceChange();
        refreshService.notifyExpenseChange();
      }, 500);
      
      setTimeout(() => {
        refreshService.notifyBalanceChange();
      }, 1000);
    } catch (error) {
      console.error('Could not trigger refresh notifications:', error);
    }
    
    console.log('✅ ENHANCED: Payment marked as paid with full synchronization');
    
  } catch (error) {
    console.error('❌ Enhanced mark payment as paid error:', error);
    throw error;
  }
}



// Sync friend balance after settlement to ensure consistency
static async syncFriendBalanceAfterSettlement(
  fromUserId: string,
  toUserId: string,
  amount: number
): Promise<void> {
  try {
    console.log('🔄 SYNC: Updating friend balance for settlement');
    console.log(`📝 ${fromUserId} pays ${toUserId} $${amount}`);
    console.log(`💡 This should REDUCE ${fromUserId}'s debt to ${toUserId}`);
    
    // Use the existing syncFriendBalanceForSettlement method
    await this.syncFriendBalanceForSettlement(fromUserId, toUserId, amount);
    
    console.log('✅ SYNC: Friend balance updated for settlement');
  } catch (error) {
    console.error('❌ SYNC: Error updating friend balance:', error);
    throw error;
  }
};

// SETTLEMENT TRANSACTION METHODS
// Fix for Settlement Transaction undefined fields error in splitting.ts
// Replace the createSettlementTransaction method with this fixed version

static async createSettlementTransaction(
  fromUserId: string,
  toUserId: string,
  amount: number,
  method: string = 'manual_settlement',
  groupId?: string,
  description?: string,
  currency: string = 'USD'
): Promise<string> {
  try {
    console.log('Creating settlement transaction:', {
      fromUserId,
      toUserId,
      amount,
      method,
      groupId,
      description,
      currency
    });

    // Create the settlement record first
    const settlement: Settlement = {
      id: '',
      fromUserId,
      toUserId,
      amount,
      currency,
      method,
      description: description || `Settlement for ${method} payment`,
      status: 'completed',
      createdAt: Timestamp.now(),
      settledAt: Timestamp.now()
    };

    // Only add groupId if it's defined and not null/empty
    if (groupId && groupId !== 'personal') {
      (settlement as any).groupId = groupId;
    }

    const docRef = await addDoc(collection(db, 'settlements'), settlement);
    
    // Then update the balance
    console.log(`🔄 Settlement balance update: ${fromUserId} pays ${toUserId} ${amount}`);
    console.log(`📝 This should REDUCE ${fromUserId}'s debt to ${toUserId}`);
    
    // Check if they are friends first
    await this.ensureFriendship(fromUserId, toUserId);
    
    // Update friend balance - pass true for isSettlement
    await this.updateFriendBalance(fromUserId, toUserId, amount, true);
    console.log(`✅ Updated friend balance after settlement: ${fromUserId} paid ${toUserId} ${amount}`);
    
    // Send notifications
    await this.sendSettlementNotifications(docRef.id, {
      fromUserId,
      toUserId,
      amount,
      currency,
      description: description || settlement.description,
      method: method as 'manual_settlement' | 'cash' | 'bank' | 'venmo' | 'paypal' | 'upi',
      groupId,
      fromUserData: { fullName: 'User', email: '', avatar: '' },
      toUserData: { fullName: 'User', email: '', avatar: '' },
      status: 'completed',
      settlementDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`✅ Settlement transaction created successfully: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Error creating settlement transaction:', error);
    throw error;
  }
};

static async sendSettlementNotifications(settlementId: string, settlement: Omit<SettlementTransaction, 'id'>): Promise<void> {
  try {
    // Prepare base data for notifications, conditionally including groupId
    const baseReceiverData: any = {
      settlementId,
      fromUserId: settlement.fromUserId,
      amount: settlement.amount,
      currency: settlement.currency,
      method: settlement.method,
      navigationType: 'settlementDetails'
    };
    
    const baseSenderData: any = {
      settlementId,
      toUserId: settlement.toUserId,
      amount: settlement.amount,
      currency: settlement.currency,
      method: settlement.method,
      navigationType: 'settlementDetails'
    };
    
    // Only include groupId if it's defined (not undefined)
    if (settlement.groupId !== undefined) {
      baseReceiverData.groupId = settlement.groupId;
      baseSenderData.groupId = settlement.groupId;
    }
    
    // Notification to the receiver
    await this.createNotification({
      userId: settlement.toUserId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `${settlement.fromUserData.fullName} sent you ${settlement.currency} ${settlement.amount}`,
      data: baseReceiverData,
      isRead: false,
      createdAt: new Date()
    });
    
    // Notification to the sender (confirmation)
    await this.createNotification({
      userId: settlement.fromUserId,
      type: 'expense_settled',
      title: 'Payment Sent',
      message: `Your payment of ${settlement.currency} ${settlement.amount} to ${settlement.toUserData.fullName} has been recorded`,
      data: baseSenderData,
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
// FIXED: Use consolidated friend balances instead of raw group calculations to match UnifiedSettlementScreen

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
    console.log('🔄 DEBUG: Group settlement calculation for group:', groupId);
    
    // Get group data
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) {
      throw new Error('Group not found');
    }
    
    const groupData = groupDoc.data() as Group;
    const activeMembers = groupData.members.filter(member => member.isActive);
    console.log(`👥 DEBUG: Found ${activeMembers.length} active members in group`);
    
    // NEW APPROACH: Use consolidated friend balances instead of raw group calculations
    // This matches the logic used by UnifiedSettlementScreen for consistency
    console.log('🔧 DEBUG: Using consolidated friend balances (matching UnifiedSettlementScreen logic)');
    
    const memberBalances = new Map<string, { balance: number; name: string; avatar?: string; email: string }>();
    
    // For each group member, get their consolidated balance with every other member
    for (const member of activeMembers) {
      const userId = member.userId;
      console.log(`🔍 DEBUG: Getting consolidated balances for user ${member.userData.fullName} (${userId})`);
      
      // Get all friends for this user to find consolidated balances
      const userFriends = await this.getFriends(userId);
      console.log(`📊 DEBUG: User has ${userFriends.length} friends total`);
      
      // Initialize member balance
      if (!memberBalances.has(userId)) {
        memberBalances.set(userId, {
          balance: 0,
          name: member.userData.fullName,
          avatar: member.userData.avatar,
          email: member.userData.email
        });
      }
      
      // Calculate net balance with other group members using consolidated friend relationships
      for (const otherMember of activeMembers) {
        if (otherMember.userId === userId) continue;
        
        // Find friendship with this other member
        const friendship = userFriends.find(f => 
          f.friendId === otherMember.userId && f.status === 'accepted'
        );
        
        if (friendship) {
          // Use consolidated friendship balance (includes all expenses between these users)
          console.log(`🤝 DEBUG: Found friendship balance between ${member.userData.fullName} and ${otherMember.userData.fullName}: ${friendship.balance}`);
          
          const currentBalance = memberBalances.get(userId)!;
          currentBalance.balance += friendship.balance;
          console.log(`📊 DEBUG: Updated ${member.userData.fullName} total balance to: ${currentBalance.balance}`);
        } else {
          // No direct friendship - calculate group-specific balance for this pair
          console.log(`💭 DEBUG: No friendship found between ${member.userData.fullName} and ${otherMember.userData.fullName}, calculating group-specific balance`);
          
          // Get expenses where both users participated in this group
          const expenses = await this.getGroupExpenses(groupId);
          let pairwiseBalance = 0;
          
          expenses.forEach((expense) => {
            const userSplit = expense.splitData?.find(s => s.userId === userId);
            const otherSplit = expense.splitData?.find(s => s.userId === otherMember.userId);
            
            // Only process if both users participated in this expense
            if (userSplit && otherSplit) {
              if (expense.paidBy === userId) {
                // User paid, they should get credit
                pairwiseBalance += otherSplit.amount;
              } else if (expense.paidBy === otherMember.userId) {
                // Other user paid, user owes them
                pairwiseBalance -= userSplit.amount;
              }
            }
          });
          
          console.log(`📊 DEBUG: Group-specific balance between ${member.userData.fullName} and ${otherMember.userData.fullName}: ${pairwiseBalance}`);
          
          const currentBalance = memberBalances.get(userId)!;
          currentBalance.balance += pairwiseBalance;
          console.log(`📊 DEBUG: Updated ${member.userData.fullName} total balance to: ${currentBalance.balance}`);
        }
      }
    }
    
    console.log('📊 DEBUG: Final consolidated balances:');
    memberBalances.forEach((memberData, userId) => {
      console.log(`  ${memberData.name}: $${memberData.balance.toFixed(2)}`);
    });
    
    // Filter out members with zero balances
    const membersWithBalances = activeMembers.filter(member => {
      const memberData = memberBalances.get(member.userId);
      const balance = memberData?.balance || 0;
      return Math.abs(balance) > 0.01;
    });
    
    if (membersWithBalances.length === 0) {
      console.log('✅ DEBUG: All members are settled - no settlements needed');
      return [];
    }
    
    // Generate settlement suggestions using consolidated balances
    const creditors = membersWithBalances
      .filter(member => {
        const memberData = memberBalances.get(member.userId);
        const balance = memberData?.balance || 0;
        return balance > 0.01;
      })
      .map(member => {
        const memberData = memberBalances.get(member.userId)!;
        return {
          userId: member.userId,
          userName: memberData.name,
          userAvatar: memberData.avatar,
          amount: memberData.balance
        };
      })
      .sort((a, b) => b.amount - a.amount);
    
    const debtors = membersWithBalances
      .filter(member => {
        const memberData = memberBalances.get(member.userId);
        const balance = memberData?.balance || 0;
        return balance < -0.01;
      })
      .map(member => {
        const memberData = memberBalances.get(member.userId)!;
        return {
          userId: member.userId,
          userName: memberData.name,
          userAvatar: memberData.avatar,
          amount: Math.abs(memberData.balance)
        };
      })
      .sort((a, b) => b.amount - a.amount);
    
    console.log(`💰 DEBUG: Found ${creditors.length} creditors (owed money) and ${debtors.length} debtors (owe money)`);
    
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
        settlements.push({
          fromUserId: debtor.userId, // Person who owes (pays)
          fromUserName: debtor.userName,
          fromUserAvatar: debtor.userAvatar,
          toUserId: creditor.userId, // Person who is owed (receives)
          toUserName: creditor.userName,
          toUserAvatar: creditor.userAvatar,
          amount: parseFloat(settlementAmount.toFixed(2))
        });
        
        console.log(`💸 DEBUG: Settlement suggestion: ${debtor.userName} pays $${settlementAmount.toFixed(2)} to ${creditor.userName}`);
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
    
    console.log(`✅ DEBUG: Generated ${settlements.length} settlement suggestions using consolidated balances`);
    return settlements;
    
  } catch (error) {
    console.error('❌ Get group settlement suggestions error:', error);
    throw error;
  }
}

/**
 * NEW: Direct friend balance synchronization for settlements
 */
static async syncFriendBalanceForSettlement(
  fromUserId: string,
  toUserId: string,
  settlementAmount: number
): Promise<void> {
  try {
    console.log(`🔄 SYNC: Updating friend balance for settlement`);
    console.log(`📝 ${fromUserId} pays ${toUserId} $${settlementAmount}`);
    console.log(`💡 This should REDUCE ${fromUserId}'s debt to ${toUserId}`);
    
    // Ensure friendship exists
    const toUserDoc = await getDoc(doc(db, 'users', toUserId));
    const toUserData = toUserDoc.data();
    
    const existingCheck = await this.checkExistingFriendship(fromUserId, toUserData?.email || '');
    
    if (!existingCheck.isFriend) {
      console.log('🔗 Creating friendship for settlement...');
      const fromUserDoc = await getDoc(doc(db, 'users', fromUserId));
      const fromUserData = fromUserDoc.data();
      
      // Create friendship
      const friendship1: Omit<Friend, 'id'> = {
        userId: fromUserId,
        friendId: toUserId,
        friendData: {
          id: toUserId,
          fullName: toUserData?.fullName || 'Unknown User',
          email: toUserData?.email || '',
          mobile: '',
          avatar: toUserData?.profilePicture || '',
          profilePicture: toUserData?.profilePicture || ''
        },
        status: 'accepted',
        balance: 0,
        lastActivity: new Date(),
        createdAt: new Date()
      };
      
      const friendship2: Omit<Friend, 'id'> = {
        userId: toUserId,
        friendId: fromUserId,
        friendData: {
          id: fromUserId,
          fullName: fromUserData?.fullName || 'Unknown User',
          email: fromUserData?.email || '',
          mobile: '',
          avatar: fromUserData?.profilePicture || '',
          profilePicture: fromUserData?.profilePicture || ''
        },
        status: 'accepted',
        balance: 0,
        lastActivity: new Date(),
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'friends'), friendship1);
      await addDoc(collection(db, 'friends'), friendship2);
    }
    
    // Update friend balances with settlement
    // When fromUserId pays toUserId, we SUBTRACT the amount from the balance
    await this.updateFriendBalance(fromUserId, toUserId, -settlementAmount);
    console.log(`✅ SYNC: Friend balance updated for settlement`);
    
  } catch (error) {
    console.error('❌ Sync friend balance error:', error);
    throw error;
  }
}


/**
 * DIAGNOSTIC: Check balance consistency between systems
 */
static async diagnoseBalanceConsistency(userId1: string, userId2: string, groupId?: string): Promise<{
  friendBalance: number;
  groupBalance: number;
  expenseBalance: number;
  isConsistent: boolean;
  discrepancy: number;
}> {
  try {
    console.log(`🔍 DIAGNOSTIC: Checking balance consistency`);
    console.log(`👤 User 1: ${userId1}`);
    console.log(`👤 User 2: ${userId2}`);
    console.log(`🏢 Group: ${groupId || 'N/A'}`);
    
    // 1. Get friend balance
    let friendBalance = 0;
    try {
      const friendshipQuery = query(
        collection(db, 'friends'),
        where('userId', '==', userId1),
        where('friendId', '==', userId2),
        limit(1)
      );
      const friendSnapshot = await getDocs(friendshipQuery);
      
      if (!friendSnapshot.empty) {
        friendBalance = friendSnapshot.docs[0].data().balance || 0;
      }
    } catch (error) {
      console.log('No friendship found');
    }
    
    // 2. Get group balance (if applicable)
    let groupBalance = 0;
    if (groupId) {
      groupBalance = await this.calculatePairwiseBalance(userId1, userId2, groupId);
    }
    
    // 3. Calculate balance from expense splits
    let expenseBalance = 0;
    const expenses = groupId 
      ? await this.getGroupExpenses(groupId)
      : await this.getUserExpenses(userId1, 100);
    
    expenses.forEach(expense => {
      if (expense.isSettlementTransaction) return;
      
      if (expense.paidBy === userId1) {
        const user2Split = expense.splitData.find(s => s.userId === userId2);
        if (user2Split && !user2Split.isPaid) {
          expenseBalance += user2Split.amount;
        }
      } else if (expense.paidBy === userId2) {
        const user1Split = expense.splitData.find(s => s.userId === userId1);
        if (user1Split && !user1Split.isPaid) {
          expenseBalance -= user1Split.amount;
        }
      }
    });
    
    const maxBalance = Math.max(Math.abs(friendBalance), Math.abs(groupBalance), Math.abs(expenseBalance));
    const isConsistent = Math.abs(friendBalance - expenseBalance) < 0.01;
    const discrepancy = Math.abs(friendBalance - expenseBalance);
    
    console.log(`📊 DIAGNOSTIC RESULTS:`);
    console.log(`   Friend Balance: ${friendBalance}`);
    console.log(`   Group Balance: ${groupBalance}`);
    console.log(`   Expense Balance: ${expenseBalance}`);
    console.log(`   Consistent: ${isConsistent}`);
    console.log(`   Discrepancy: ${discrepancy}`);
    
    return {
      friendBalance,
      groupBalance,
      expenseBalance,
      isConsistent,
      discrepancy
    };
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    return {
      friendBalance: 0,
      groupBalance: 0,
      expenseBalance: 0,
      isConsistent: false,
      discrepancy: 0
    };
  }
}

/**
 * REPAIR: Fix balance inconsistencies
 */
static async repairBalanceInconsistencies(userId1: string, userId2: string, groupId?: string): Promise<void> {
  try {
    console.log(`🔧 REPAIR: Fixing balance inconsistencies`);
    
    const diagnosis = await this.diagnoseBalanceConsistency(userId1, userId2, groupId);
    
    if (diagnosis.isConsistent) {
      console.log('✅ No repair needed - balances are consistent');
      return;
    }
    
    console.log(`🔧 Repairing discrepancy of ${diagnosis.discrepancy}`);
    
    // Set friend balance to match expense balance (source of truth)
    const adjustment = diagnosis.expenseBalance - diagnosis.friendBalance;
    
    if (Math.abs(adjustment) > 0.01) {
      await this.updateFriendBalance(userId1, userId2, adjustment);
      console.log(`✅ REPAIR: Adjusted friend balance by ${adjustment}`);
    }
    
  } catch (error) {
    console.error('❌ Repair error:', error);
    throw error;
  }
}



/**
 * UTILITY: Bulk repair for all relationships in a group
 */
static async repairGroupBalanceConsistencies(groupId: string): Promise<{
  repairsNeeded: number;
  repairsCompleted: number;
  errors: number;
}> {
  try {
    console.log(`🔧 BULK REPAIR: Fixing all balances in group ${groupId}`);
    
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');
    
    let repairsNeeded = 0;
    let repairsCompleted = 0;
    let errors = 0;
    
    // Check all pairs of users
    for (let i = 0; i < group.members.length; i++) {
      for (let j = i + 1; j < group.members.length; j++) {
        const user1 = group.members[i].userId;
        const user2 = group.members[j].userId;
        
        try {
          const diagnosis = await this.diagnoseBalanceConsistency(user1, user2, groupId);
          
          if (!diagnosis.isConsistent) {
            repairsNeeded++;
            console.log(`🔧 Repairing ${group.members[i].userData.fullName} vs ${group.members[j].userData.fullName}`);
            
            await this.repairBalanceInconsistencies(user1, user2, groupId);
            repairsCompleted++;
          }
        } catch (error) {
          errors++;
          console.error(`❌ Error repairing ${user1} vs ${user2}:`, error);
        }
      }
    }
    
    console.log(`✅ BULK REPAIR COMPLETE: ${repairsCompleted}/${repairsNeeded} repairs successful, ${errors} errors`);
    
    return {
      repairsNeeded,
      repairsCompleted,
      errors
    };
    
  } catch (error) {
    console.error('❌ Bulk repair error:', error);
    throw error;
  }
}

/**
 * ENHANCED: Update expense splits with friend balance sync
 */
static async updateExpenseSplitsForSettlement(
  fromUserId: string,
  toUserId: string,
  settlementAmount: number,
  groupId?: string
): Promise<void> {
  try {
    console.log('🔄 ENHANCED: Updating expense splits with friend sync');
    
    const expenses = (groupId && groupId !== 'personal')
      ? await this.getGroupExpenses(groupId)
      : await this.getUserExpenses(fromUserId, 50);
    
    // Filter relevant unpaid expenses
    const relevantExpenses = expenses.filter(expense => {
      if (expense.isSettlementTransaction) return false;
      if (expense.paidBy !== toUserId) return false;
      
      const fromUserSplit = expense.splitData.find(split => 
        split.userId === fromUserId && !split.isPaid
      );
      
      return !!fromUserSplit;
    });
    
    console.log(`📋 Found ${relevantExpenses.length} relevant expenses to update`);
    
    let remainingAmount = settlementAmount;
    const batch = writeBatch(db);
    let updatesCount = 0;
    
    // Sort by date (oldest first)
    relevantExpenses.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (const expense of relevantExpenses) {
      if (remainingAmount <= 0) break;
      
      const fromUserSplit = expense.splitData.find(split => 
        split.userId === fromUserId && !split.isPaid
      );
      
      if (!fromUserSplit) continue;
      
      const splitAmount = fromUserSplit.amount;
      
      if (remainingAmount >= splitAmount) {
        console.log(`✅ Marking expense split as paid: ${expense.description} (${splitAmount})`);
        
        const updatedSplitData = expense.splitData.map(split => 
          split.userId === fromUserId 
            ? { ...split, isPaid: true, paidAt: new Date() }
            : split
        );
        
        batch.update(doc(db, 'expenses', expense.id), {
          splitData: updatedSplitData,
          updatedAt: new Date()
        });
        
        updatesCount++;
        remainingAmount -= splitAmount;
      }
    }
    
    if (updatesCount > 0) {
      await batch.commit();
      console.log(`✅ ENHANCED: Updated ${updatesCount} expense splits`);
    }
    
  } catch (error) {
    console.error('❌ Enhanced update expense splits error:', error);
    throw error;
  }
}

// ==========================================
// PHASE 1: COMPREHENSIVE BALANCE CALCULATION
// ==========================================

// Add this new service method to SplittingService (in splitting.ts)
static async getComprehensiveUserBalances(userId: string): Promise<{
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  friendBalances: Array<{
    userId: string;
    name: string;
    email: string;
    avatar?: string;
    balance: number;
    source: 'friend' | 'group';
    groupName?: string;
    groupId?: string;
  }>;
}> {
  try {
    let totalOwed = 0;
    let totalOwing = 0;
    const balanceDetails: Array<{
      userId: string;
      name: string;
      email: string;
      avatar?: string;
      balance: number;
      source: 'friend' | 'group';
      groupName?: string;
      groupId?: string;
    }> = [];

    // 1. Get balances from existing friends
    const friends = await this.getFriends(userId);
    const friendUserIds = new Set(friends.map(f => f.friendId));

    friends.forEach(friend => {
      if (friend.status === 'accepted' && Math.abs(friend.balance) > 0.01) {
        balanceDetails.push({
          userId: friend.friendId,
          name: friend.friendData.fullName,
          email: friend.friendData.email,
          avatar: friend.friendData.avatar,
          balance: friend.balance,
          source: 'friend'
        });

        if (friend.balance > 0) {
          totalOwed += friend.balance;
        } else {
          totalOwing += Math.abs(friend.balance);
        }
      }
    });

    // 2. Get balances from groups for non-friend members
    const userGroups = await this.getUserGroups(userId);
    
    for (const group of userGroups) {
      const userMember = group.members.find(member => member.userId === userId);
      if (!userMember) continue;

      // Calculate balances with each group member
      for (const otherMember of group.members) {
        if (otherMember.userId === userId) continue;
        
        // Skip if already counted as friend
        if (friendUserIds.has(otherMember.userId)) continue;

        // Calculate actual balance between these two users in this group
        const balance = await this.calculatePairwiseBalance(userId, otherMember.userId, group.id);
        
        if (Math.abs(balance) > 0.01) {
          // Check if we already have this user from another group
          const existingIndex = balanceDetails.findIndex(b => 
            b.userId === otherMember.userId && b.source === 'group'
          );

          if (existingIndex >= 0) {
            // Combine balances if user appears in multiple groups
            balanceDetails[existingIndex].balance += balance;
            balanceDetails[existingIndex].groupName += `, ${group.name}`;
          } else {
            // Add new non-friend group member
            balanceDetails.push({
              userId: otherMember.userId,
              name: otherMember.userData.fullName,
              email: otherMember.userData.email,
              avatar: otherMember.userData.avatar,
              balance: balance,
              source: 'group',
              groupName: group.name,
              groupId: group.id
            });
          }

          if (balance > 0) {
            totalOwed += balance;
          } else {
            totalOwing += Math.abs(balance);
          }
        }
      }
    }

    const netBalance = totalOwed - totalOwing;

    return {
      totalOwed: parseFloat(totalOwed.toFixed(2)),
      totalOwing: parseFloat(totalOwing.toFixed(2)),
      netBalance: parseFloat(netBalance.toFixed(2)),
      friendBalances: balanceDetails
    };

  } catch (error) {
    console.error('❌ Get comprehensive balances error:', error);
    return {
      totalOwed: 0,
      totalOwing: 0,
      netBalance: 0,
      friendBalances: []
    };
  }
}

// Helper method to calculate balance between two users in a specific group
static async calculatePairwiseBalance(userId1: string, userId2: string, groupId: string): Promise<number> {
  try {
    // Get all expenses in this group
    const expenses = await this.getGroupExpenses(groupId);
    let balance = 0;

    expenses.forEach(expense => {
      // Case 1: userId1 paid, userId2 owes
      if (expense.paidBy === userId1) {
        const user2Split = expense.splitData.find(split => split.userId === userId2);
        if (user2Split) {
          balance += user2Split.amount; // userId2 owes userId1
        }
      }
      
      // Case 2: userId2 paid, userId1 owes
      if (expense.paidBy === userId2) {
        const user1Split = expense.splitData.find(split => split.userId === userId1);
        if (user1Split) {
          balance -= user1Split.amount; // userId1 owes userId2
        }
      }
    });

    return parseFloat(balance.toFixed(2));
  } catch (error) {
    console.error('Calculate pairwise balance error:', error);
    return 0;
  }
}

// ==========================================
// PHASE 2: AUTO-FRIEND INTEGRATION
// ==========================================

// Enhanced auto-add function with better UX
static async autoConnectGroupMembers(groupId: string, userId: string, showPrompt: boolean = true): Promise<{
  success: boolean;
  requestsSent: number;
  alreadyConnected: number;
  failed: number;
}> {
  try {
    console.log('🔄 Auto-connecting group members for user:', userId, 'in group:', groupId);
    
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    const currentUserDoc = await getDoc(doc(db, 'users', userId));
    if (!currentUserDoc.exists()) throw new Error('User not found');

    let requestsSent = 0;
    let alreadyConnected = 0;
    let failed = 0;

    // Process each member
    for (const member of group.members) {
      if (member.userId === userId) continue; // Skip self
      
      try {
        // Check existing friendship
        const existingCheck = await this.checkExistingFriendship(userId, member.userData.email);
        
        if (existingCheck.isFriend) {
          alreadyConnected++;
          console.log(`👥 Already connected with ${member.userData.fullName}`);
        } else {
          // 🔥 CRITICAL FIX: Auto-create friendship instead of sending friend request
          console.log(`🔗 Auto-creating friendship with ${member.userData.fullName}`);
          
          const currentUserData = currentUserDoc.data();
          
          // Create friendship in both directions
          const friendship1: Omit<Friend, 'id'> = {
            userId: userId,
            friendId: member.userId,
            friendData: {
              id: member.userId,
              fullName: member.userData.fullName,
              email: member.userData.email,
              mobile: '',
              avatar: member.userData.avatar || '',
              profilePicture: member.userData.avatar || ''
            },
            status: 'accepted',
            balance: 0,
            lastActivity: new Date(),
            createdAt: new Date()
          };
          
          const friendship2: Omit<Friend, 'id'> = {
            userId: member.userId,
            friendId: userId,
            friendData: {
              id: userId,
              fullName: currentUserData?.fullName || 'Unknown User',
              email: currentUserData?.email || '',
              mobile: '',
              avatar: currentUserData?.profilePicture || '',
              profilePicture: currentUserData?.profilePicture || ''
            },
            status: 'accepted',
            balance: 0,
            lastActivity: new Date(),
            createdAt: new Date()
          };
          
          // Add both friendships
          await addDoc(collection(db, 'friends'), friendship1);
          await addDoc(collection(db, 'friends'), friendship2);
          
          requestsSent++; // Count as "connection created"
          console.log(`✅ Auto-created friendship with ${member.userData.fullName}`);
        }
      } catch (error) {
        failed++;
        console.log(`❌ Error processing ${member.userData.fullName}:`, error);
      }
    }

    return {
      success: true,
      requestsSent,
      alreadyConnected,
      failed
    };

  } catch (error) {
    console.error('❌ Auto-connect group members error:', error);
    return {
      success: false,
      requestsSent: 0,
      alreadyConnected: 0,
      failed: 0
    };
  }
}

// 🔥 NEW: Utility function to auto-create friendships for existing groups
static async createFriendshipsForExistingGroup(groupId: string): Promise<{
  success: boolean;
  friendshipsCreated: number;
  alreadyConnected: number;
  failed: number;
}> {
  try {
    console.log('🔄 Creating friendships for existing group:', groupId);
    
    const group = await this.getGroup(groupId);
    if (!group) throw new Error('Group not found');

    let friendshipsCreated = 0;
    let alreadyConnected = 0;
    let failed = 0;

    // Create friendships between all pairs of members
    for (let i = 0; i < group.members.length; i++) {
      for (let j = i + 1; j < group.members.length; j++) {
        const member1 = group.members[i];
        const member2 = group.members[j];
        
        try {
          // Check if friendship already exists
          const existingCheck = await this.checkExistingFriendship(member1.userId, member2.userData.email);
          
          if (existingCheck.isFriend) {
            alreadyConnected++;
            console.log(`👥 Already connected: ${member1.userData.fullName} <-> ${member2.userData.fullName}`);
          } else {
            console.log(`🔗 Creating friendship: ${member1.userData.fullName} <-> ${member2.userData.fullName}`);
            
            // Create friendship in both directions
            const friendship1: Omit<Friend, 'id'> = {
              userId: member1.userId,
              friendId: member2.userId,
              friendData: {
                id: member2.userId,
                fullName: member2.userData.fullName,
                email: member2.userData.email,
                mobile: '',
                avatar: member2.userData.avatar || '',
                profilePicture: member2.userData.avatar || ''
              },
              status: 'accepted',
              balance: 0,
              lastActivity: new Date(),
              createdAt: new Date()
            };
            
            const friendship2: Omit<Friend, 'id'> = {
              userId: member2.userId,
              friendId: member1.userId,
              friendData: {
                id: member1.userId,
                fullName: member1.userData.fullName,
                email: member1.userData.email,
                mobile: '',
                avatar: member1.userData.avatar || '',
                profilePicture: member1.userData.avatar || ''
              },
              status: 'accepted',
              balance: 0,
              lastActivity: new Date(),
              createdAt: new Date()
            };
            
            // Add both friendships
            await addDoc(collection(db, 'friends'), friendship1);
            await addDoc(collection(db, 'friends'), friendship2);
            
            friendshipsCreated++;
            console.log(`✅ Created friendship: ${member1.userData.fullName} <-> ${member2.userData.fullName}`);
          }
        } catch (error) {
          failed++;
          console.error(`❌ Error creating friendship between ${member1.userData.fullName} and ${member2.userData.fullName}:`, error);
        }
      }
    }

    return {
      success: true,
      friendshipsCreated,
      alreadyConnected,
      failed
    };

  } catch (error) {
    console.error('❌ Create friendships for existing group error:', error);
    return {
      success: false,
      friendshipsCreated: 0,
      alreadyConnected: 0,
      failed: 0
    };
  }
}

// Add these functions to the SplittingService class in splitting.ts

// ENHANCED EXPENSE FILTERING AND SEARCH METHODS

// Main filtering function with comprehensive options
static async getFilteredExpenses(userId: string, filters: {
  searchQuery?: string;
  category?: string;
  groupId?: string;
  friendId?: string;
  dateRange?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  status?: 'settled' | 'pending' | 'all';
  sortBy?: 'date' | 'amount' | 'category' | 'description';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
} = {}): Promise<Expense[]> {
  try {
    console.log('Getting filtered expenses for user:', userId, 'with filters:', filters);
    
    // Get all user expenses first
    const allExpenses = await this.getUserExpenses(userId, filters.limit || 1000);
    let filteredExpenses = [...allExpenses];
    
    // Apply search filter
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filteredExpenses = filteredExpenses.filter(expense => 
        expense.description.toLowerCase().includes(query) ||
        expense.paidByData.fullName.toLowerCase().includes(query) ||
        expense.notes?.toLowerCase().includes(query) ||
        expense.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (filters.category && filters.category !== 'all') {
      filteredExpenses = filteredExpenses.filter(expense => expense.category === filters.category);
    }
    
    // Apply group filter
    if (filters.groupId && filters.groupId !== 'all') {
      filteredExpenses = filteredExpenses.filter(expense => expense.groupId === filters.groupId);
    }
    
    // Apply friend filter
    if (filters.friendId && filters.friendId !== 'all') {
      filteredExpenses = filteredExpenses.filter(expense => 
        expense.paidBy === filters.friendId || 
        expense.splitData.some(split => split.userId === filters.friendId)
      );
    }
    
    // Apply date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      const startDate = new Date();
      
      switch (filters.dateRange) {
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
      
      filteredExpenses = filteredExpenses.filter(expense => expense.date >= startDate);
    }
    
    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      const isSettled = filters.status === 'settled';
      filteredExpenses = filteredExpenses.filter(expense => expense.isSettled === isSettled);
    }
    
    // Apply sorting
    const sortBy = filters.sortBy || 'date';
    const sortOrder = filters.sortOrder || 'desc';
    
    filteredExpenses.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'date':
          compareValue = a.date.getTime() - b.date.getTime();
          break;
        case 'amount':
          compareValue = a.amount - b.amount;
          break;
        case 'category':
          compareValue = a.category.localeCompare(b.category);
          break;
        case 'description':
          compareValue = a.description.localeCompare(b.description);
          break;
        default:
          compareValue = a.date.getTime() - b.date.getTime();
      }
      
      return sortOrder === 'desc' ? -compareValue : compareValue;
    });
    
    console.log(`Filtered ${allExpenses.length} expenses down to ${filteredExpenses.length}`);
    return filteredExpenses;
    
  } catch (error) {
    console.error('Get filtered expenses error:', error);
    return [];
  }
}

// Get expense statistics for the modal
static async getExpenseStatistics(userId: string, expenses?: Expense[]): Promise<{
  totalAmount: number;
  pendingAmount: number;
  settledAmount: number;
  expenseCount: number;
  categoryBreakdown: Array<{ category: string; amount: number; count: number; percentage: number }>;
  monthlyTrend: Array<{ month: string; amount: number; count: number }>;
}> {
  try {
    const expenseList = expenses || await this.getUserExpenses(userId, 1000);
    
    let totalAmount = 0;
    let pendingAmount = 0;
    let settledAmount = 0;
    const categoryData: { [key: string]: { amount: number; count: number } } = {};
    const monthlyData: { [key: string]: { amount: number; count: number } } = {};
    
    expenseList.forEach(expense => {
      totalAmount += expense.amount;
      
      if (expense.isSettled) {
        settledAmount += expense.amount;
      } else {
        pendingAmount += expense.amount;
      }
      
      // Category breakdown
      const category = expense.category || 'other';
      if (!categoryData[category]) {
        categoryData[category] = { amount: 0, count: 0 };
      }
      categoryData[category].amount += expense.amount;
      categoryData[category].count += 1;
      
      // Monthly trend
      const monthKey = expense.date.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { amount: 0, count: 0 };
      }
      monthlyData[monthKey].amount += expense.amount;
      monthlyData[monthKey].count += 1;
    });
    
    // Process category breakdown with percentages
    const categoryBreakdown = Object.entries(categoryData)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
    
    // Process monthly trend (last 6 months)
    const monthlyTrend = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months
    
    return {
      totalAmount,
      pendingAmount,
      settledAmount,
      expenseCount: expenseList.length,
      categoryBreakdown,
      monthlyTrend
    };
    
  } catch (error) {
    console.error('Get expense statistics error:', error);
    return {
      totalAmount: 0,
      pendingAmount: 0,
      settledAmount: 0,
      expenseCount: 0,
      categoryBreakdown: [],
      monthlyTrend: []
    };
  }
}

// Search expenses with advanced options
static async searchExpenses(userId: string, query: string, options: {
  includeNotes?: boolean;
  includeTags?: boolean;
  includePeople?: boolean;
  includeGroups?: boolean;
  fuzzyMatch?: boolean;
} = {}): Promise<Expense[]> {
  try {
    if (!query.trim()) return [];
    
    const expenses = await this.getUserExpenses(userId, 1000);
    const searchTerm = query.toLowerCase();
    
    return expenses.filter(expense => {
      const matches: boolean[] = [];
      
      // Always search description
      matches.push(expense.description.toLowerCase().includes(searchTerm));
      
      // Search notes if enabled
      if (options.includeNotes !== false && expense.notes) {
        matches.push(expense.notes.toLowerCase().includes(searchTerm));
      }
      
      // Search tags if enabled
      if (options.includeTags !== false && expense.tags) {
        matches.push(expense.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
      }
      
      // Search people if enabled
      if (options.includePeople !== false) {
        matches.push(expense.paidByData.fullName.toLowerCase().includes(searchTerm));
      }
      
      // Search groups if enabled (we'd need to get group name)
      if (options.includeGroups !== false) {
        // This would require getting group data, but for now we can skip
      }
      
      return matches.some(match => match);
    });
    
  } catch (error) {
    console.error('Search expenses error:', error);
    return [];
  }
}

// Get expenses by specific category with analytics
static async getExpensesByCategory(userId: string, category: string): Promise<{
  expenses: Expense[];
  totalAmount: number;
  averageAmount: number;
  expenseCount: number;
}> {
  try {
    const allExpenses = await this.getUserExpenses(userId, 1000);
    const categoryExpenses = allExpenses.filter(expense => expense.category === category);
    
    const totalAmount = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const averageAmount = categoryExpenses.length > 0 ? totalAmount / categoryExpenses.length : 0;
    
    return {
      expenses: categoryExpenses,
      totalAmount,
      averageAmount,
      expenseCount: categoryExpenses.length
    };
    
  } catch (error) {
    console.error('Get expenses by category error:', error);
    return {
      expenses: [],
      totalAmount: 0,
      averageAmount: 0,
      expenseCount: 0
    };
  }
}

// Get expenses for a specific friend across all groups
static async getExpensesWithFriend(userId: string, friendId: string): Promise<{
  expenses: Expense[];
  totalAmount: number;
  userOwes: number;
  friendOwes: number;
  netBalance: number;
}> {
  try {
    const allExpenses = await this.getUserExpenses(userId, 1000);
    const friendExpenses = allExpenses.filter(expense => 
      expense.paidBy === friendId || 
      expense.splitData.some(split => split.userId === friendId)
    );
    
    let totalAmount = 0;
    let userOwes = 0;
    let friendOwes = 0;
    
    friendExpenses.forEach(expense => {
      totalAmount += expense.amount;
      
      if (expense.paidBy === userId) {
        // User paid, friend might owe
        const friendSplit = expense.splitData.find(split => split.userId === friendId);
        if (friendSplit) {
          friendOwes += friendSplit.amount;
        }
      } else if (expense.paidBy === friendId) {
        // Friend paid, user might owe
        const userSplit = expense.splitData.find(split => split.userId === userId);
        if (userSplit) {
          userOwes += userSplit.amount;
        }
      }
    });
    
    const netBalance = friendOwes - userOwes; // Positive means friend owes user
    
    return {
      expenses: friendExpenses,
      totalAmount,
      userOwes,
      friendOwes,
      netBalance
    };
    
  } catch (error) {
    console.error('Get expenses with friend error:', error);
    return {
      expenses: [],
      totalAmount: 0,
      userOwes: 0,
      friendOwes: 0,
      netBalance: 0
    };
  }
}

// Get expense trends and insights
static async getExpenseTrends(userId: string, timeframe: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<{
  currentPeriod: { amount: number; count: number };
  previousPeriod: { amount: number; count: number };
  percentageChange: number;
  topCategories: Array<{ category: string; amount: number; change: number }>;
  spendingPattern: Array<{ period: string; amount: number }>;
}> {
  try {
    const expenses = await this.getUserExpenses(userId, 1000);
    const now = new Date();
    
    // Calculate periods based on timeframe
    let currentStart = new Date();
    let previousStart = new Date();
    
    switch (timeframe) {
      case 'week':
        currentStart.setDate(now.getDate() - 7);
        previousStart.setDate(now.getDate() - 14);
        break;
      case 'month':
        currentStart.setMonth(now.getMonth() - 1);
        previousStart.setMonth(now.getMonth() - 2);
        break;
      case 'quarter':
        currentStart.setMonth(now.getMonth() - 3);
        previousStart.setMonth(now.getMonth() - 6);
        break;
      case 'year':
        currentStart.setFullYear(now.getFullYear() - 1);
        previousStart.setFullYear(now.getFullYear() - 2);
        break;
    }
    
    const currentExpenses = expenses.filter(e => e.date >= currentStart);
    const previousExpenses = expenses.filter(e => e.date >= previousStart && e.date < currentStart);
    
    const currentPeriod = {
      amount: currentExpenses.reduce((sum, e) => sum + e.amount, 0),
      count: currentExpenses.length
    };
    
    const previousPeriod = {
      amount: previousExpenses.reduce((sum, e) => sum + e.amount, 0),
      count: previousExpenses.length
    };
    
    const percentageChange = previousPeriod.amount > 0 
      ? ((currentPeriod.amount - previousPeriod.amount) / previousPeriod.amount) * 100 
      : 0;
    
    // Calculate top categories with changes
    const currentCategories: { [key: string]: number } = {};
    const previousCategories: { [key: string]: number } = {};
    
    currentExpenses.forEach(e => {
      currentCategories[e.category] = (currentCategories[e.category] || 0) + e.amount;
    });
    
    previousExpenses.forEach(e => {
      previousCategories[e.category] = (previousCategories[e.category] || 0) + e.amount;
    });
    
    const topCategories = Object.entries(currentCategories)
      .map(([category, amount]) => ({
        category,
        amount,
        change: previousCategories[category] 
          ? ((amount - previousCategories[category]) / previousCategories[category]) * 100 
          : 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    // Generate spending pattern (simplified)
    const spendingPattern = expenses
      .reduce((acc: { [key: string]: number }, expense) => {
        const monthKey = expense.date.toISOString().substring(0, 7);
        acc[monthKey] = (acc[monthKey] || 0) + expense.amount;
        return acc;
      }, {});
    
    const spendingPatternArray = Object.entries(spendingPattern)
      .map(([period, amount]) => ({ period, amount }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12); // Last 12 periods
    
    return {
      currentPeriod,
      previousPeriod,
      percentageChange,
      topCategories,
      spendingPattern: spendingPatternArray
    };
    
  } catch (error) {
    console.error('Get expense trends error:', error);
    return {
      currentPeriod: { amount: 0, count: 0 },
      previousPeriod: { amount: 0, count: 0 },
      percentageChange: 0,
      topCategories: [],
      spendingPattern: []
    };
  }
}

  // BALANCE SYNCHRONIZATION - Fix historical data inconsistencies
  static async synchronizeFriendBalancesWithExpenses(groupId: string): Promise<void> {
    try {
      console.log('🔄 Synchronizing friend balances with expense splits for group:', groupId);
      
      const group = await this.getGroup(groupId);
      if (!group) {
        throw new Error('Group not found');
      }
      
      const expenses = await this.getGroupExpenses(groupId);
      console.log(`📊 Found ${expenses.length} expenses to analyze`);
      
      // For each pair of users in the group
      for (let i = 0; i < group.members.length; i++) {
        for (let j = i + 1; j < group.members.length; j++) {
          const user1 = group.members[i].userId;
          const user2 = group.members[j].userId;
          const user1Name = group.members[i].userData.fullName;
          const user2Name = group.members[j].userData.fullName;
          
          console.log(`\n🔍 Calculating actual balance: ${user1Name} vs ${user2Name}`);
          
          // Calculate actual balance based on expense splits
          let actualBalance = 0;
          
          for (const expense of expenses) {
            if (expense.isSettlementTransaction) {
              console.log(`⏭️ Skipping settlement: ${expense.description}`);
              continue;
            }
            
            if (expense.paidBy === user1) {
              const user2Split = expense.splitData.find(s => s.userId === user2);
              if (user2Split) {
                if (!user2Split.isPaid) {
                  console.log(`➕ ${expense.description}: ${user2Name} owes ${user2Split.amount} (unpaid)`);
                  actualBalance += user2Split.amount;
                } else {
                  console.log(`✅ ${expense.description}: ${user2Name} paid ${user2Split.amount} (already paid)`);
                }
              }
            } else if (expense.paidBy === user2) {
              const user1Split = expense.splitData.find(s => s.userId === user1);
              if (user1Split) {
                if (!user1Split.isPaid) {
                  console.log(`➖ ${expense.description}: ${user1Name} owes ${user1Split.amount} (unpaid)`);
                  actualBalance -= user1Split.amount;
                } else {
                  console.log(`✅ ${expense.description}: ${user1Name} paid ${user1Split.amount} (already paid)`);
                }
              }
            }
          }
          
          // Get current friend balance using the correct method
          const currentBalance = await this.calculatePairwiseBalance(user1, user2, groupId);
          
          console.log(`📊 Current friend balance: ${currentBalance}`);
          console.log(`📊 Calculated balance from expenses: ${actualBalance}`);
          
          if (Math.abs(currentBalance - actualBalance) > 0.01) {
            console.log(`🔧 MISMATCH DETECTED! Updating balance from ${currentBalance} to ${actualBalance}`);
            
            // Set the correct balance using updateFriendBalance
            const adjustment = actualBalance - currentBalance;
            await this.updateFriendBalance(user1, user2, adjustment);
            console.log(`✅ Updated ${user1Name} vs ${user2Name} balance to: ${actualBalance}`);
          } else {
            console.log(`✅ Balance already correct for ${user1Name} vs ${user2Name}`);
          }
        }
      }
      
      console.log('✅ Friend balances synchronized with expense splits');
    } catch (error) {
      console.error('❌ Failed to sync balances:', error);
      throw error;
    }
  }
}

// Export individual functions for testing
export const getGroupSettlementSuggestions = (groupId: string) => SplittingService.getGroupSettlementSuggestions(groupId);
export const markPaymentAsPaid = (fromUserId: string, toUserId: string, amount: number, groupId?: string, description?: string) => 
  SplittingService.markPaymentAsPaid(fromUserId, toUserId, amount, groupId, description);
