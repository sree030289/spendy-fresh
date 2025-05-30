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
import { User } from '@/types';

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
  type: 'friend_request' | 'expense_added' | 'payment_received' | 'group_invite' | 'expense_settled' | 'group_message';
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
  method: 'bank' | 'paypal' | 'gpay' | 'phonepe' | 'paytm' | 'upi';
  provider: string;
  transactionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  deepLinkUsed: boolean;
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
// Splitting Service Class
export class SplittingService {
  
  // FRIENDS MANAGEMENT
static async sendFriendRequest(fromUserId: string, toEmail: string, message?: string): Promise<void> {
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
      await this.createEmailInvitation(fromUserId, fromUserData, toEmail, message);
      return;
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
    console.log('Friend request created:', docRef.id);
    
    // Create notification for the recipient
    await this.createNotification({
      userId: toUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${fromUserData?.fullName || 'Someone'} wants to be your friend`,
      data: { 
        friendRequestId: docRef.id,
        fromUserId,
        fromUserName: fromUserData?.fullName || 'Unknown User'
      },
      isRead: false,
      createdAt: new Date()
    });
    
  } catch (error) {
    console.error('Send friend request error:', error);
    throw error;
  }
}

static async blockFriend(userId: string, friendId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // Find existing friendship records
    const userFriendshipQuery = query(
      collection(db, 'friends'),
      where('userId', '==', userId),
      where('friendId', '==', friendId)
    );
    const userSnapshot = await getDocs(userFriendshipQuery);
    
    // Update status to blocked instead of deleting
    userSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'blocked',
        blockedAt: new Date(),
        updatedAt: new Date()
      });
    });
    
    await batch.commit();
    
    console.log('Friend blocked successfully');
    
  } catch (error) {
    console.error('Block friend error:', error);
    throw new Error('Failed to block friend. Please try again.');
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

static async createEmailInvitation(fromUserId: string, fromUserData: any, toEmail: string, message?: string): Promise<void> {
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
    
    // TODO: Send actual email invitation via Firebase Functions
    // For now, we'll just throw a helpful error
    throw new Error(`${toEmail} is not on Spendy yet. We've saved your invitation and will automatically send them a friend request when they join!`);
    
  } catch (error) {
    console.error('Create email invitation error:', error);
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
      await this.sendFriendRequest(
        invitation.fromUserId,
        newUserEmail,
        `Welcome to Spendy! ${invitation.fromUserData.fullName} invited you to connect.`
      );
      
      // Mark invitation as processed
      await updateDoc(invitationDoc.ref, {
        status: 'processed',
        processedAt: new Date(),
        newUserId
      });
    }
    
  } catch (error) {
    console.error('Process email invitations error:', error);
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
    console.error('Accept friend request error:', error);
    throw error;
  }
}

static async removeFriend(userId: string, friendId: string): Promise<void> {
  try {
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
    
    console.log('Friend removed successfully');
    
  } catch (error) {
    console.error('Remove friend error:', error);
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
    console.error('Get friends error:', error);
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

}