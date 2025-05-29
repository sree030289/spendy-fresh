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
  status: 'pending' | 'accepted' | 'blocked' | 'invited'; // Add 'invited' status
  balance: number;
  lastActivity: Date;
  createdAt: Date;
  invitedAt?: Date; // Track when invitation was sent
  requestId?: string; // Link to friend request
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
  type: 'friend_request' | 'expense_added' | 'payment_received' | 'group_invite' | 'expense_settled';
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
      throw new Error('User not found');
    }
    const fromUserData = fromUserDoc.data();
    
    // Find user by email
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', toEmail.toLowerCase())
    );
    const userSnapshot = await getDocs(usersQuery);
    
    if (userSnapshot.empty) {
      throw new Error('User not found with this email address');
    }
    
    const toUser = userSnapshot.docs[0];
    const toUserId = toUser.id;
    const toUserData = toUser.data();
    
    // Check if already friends or request exists
    const existingQuery = query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      throw new Error('Friend request already sent');
    }
    
    // Create friend request with proper structure
    const friendRequest = {
      fromUserId,
      fromUserData: {
        fullName: fromUserData?.fullName || 'Unknown User',
        email: fromUserData?.email || '',
        avatar: fromUserData?.profilePicture || '',
        mobile: fromUserData?.mobile || '' // Add mobile for SMS
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
    
  } catch (error) {
    console.error('Send friend request error:', error);
    throw error;
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
      
      // Create friendship for both users
      const friendship1: Omit<Friend, 'id'> = {
        userId: requestData.fromUserId,
        friendId: requestData.toUserId,
        friendData: {
          id: requestData.toUserId,
          fullName: 'Friend', // Will be updated with real data
          email: requestData.toUserEmail,
        },
        status: 'accepted',
        balance: 0,
        lastActivity: new Date(),
        createdAt: new Date()
      };
      
      const friendship2: Omit<Friend, 'id'> = {
        userId: requestData.toUserId,
        friendId: requestData.fromUserId,
        friendData: requestData.fromUserData,
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
        message: `You and ${requestData.toUserEmail} are now friends`,
        data: { friendId: requestData.toUserId },
        isRead: false,
        createdAt: new Date()
      });
      
    } catch (error) {
      console.error('Accept friend request error:', error);
      throw error;
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
  
  // GROUPS MANAGEMENT
static async createGroup(groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    // Ensure inviteCode is provided or generate one
    const inviteCode = groupData.inviteCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newGroup: Omit<Group, 'id'> = {
      ...groupData,
      inviteCode,
      totalExpenses: groupData.totalExpenses || 0,
      isActive: groupData.isActive !== undefined ? groupData.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create the group document
    const docRef = await addDoc(collection(db, 'groups'), newGroup);
    
    console.log('Group created successfully with ID:', docRef.id);
    return docRef.id;
    
  } catch (error) {
    console.error('Create group error:', error);
    throw error;
  }
}
  
  static async addGroupMember(groupId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    try {
      // Get user data
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      
      const member: GroupMember = {
        userId,
        userData: {
          fullName: userData?.fullName || 'Unknown User',
          email: userData?.email || '',
          avatar: userData?.profilePicture
        },
        role,
        balance: 0,
        joinedAt: new Date(),
        isActive: true
      };
      
      // Add member to group
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(member),
        updatedAt: new Date()
      });
      
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
    
    // Update member balances
    for (const split of expenseData.splitData) {
      if (split.userId !== expenseData.paidBy) {
        await this.updateFriendBalance(expenseData.paidBy, split.userId, split.amount);
        await this.updateFriendBalance(split.userId, expenseData.paidBy, -split.amount);
      }
    }
    console.log('Friend balances updated');
    
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
      const friendQuery = query(
        collection(db, 'friends'),
        where('userId', '==', userId),
        where('friendId', '==', friendId),
        limit(1)
      );
      
      const snapshot = await getDocs(friendQuery);
      if (!snapshot.empty) {
        const friendDoc = snapshot.docs[0];
        await updateDoc(friendDoc.ref, {
          balance: increment(amount),
          lastActivity: new Date()
        });
      }
    } catch (error) {
      console.error('Update friend balance error:', error);
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
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
    } catch (error) {
      console.error('Get notifications error:', error);
      throw error;
    }
  }
  
  // PAYMENTS
  static async createPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newPayment: Omit<Payment, 'id'> = {
        ...paymentData,
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
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
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
      timestamp: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'groupMessages'), chatMessage);
    
    // Update group's last activity
    await updateDoc(doc(db, 'groups', messageData.groupId), {
      updatedAt: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Send group message error:', error);
    throw error;
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
}
// QR Code Service
export class QRCodeService {
  static generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  
  static generateQRData(type: 'friend' | 'group', userId: string, data?: any): string {
    const qrData = {
      type,
      userId,
      timestamp: Date.now(),
      ...data
    };
    
    return `spendy://${type}?data=${btoa(JSON.stringify(qrData))}`;
  }
  
  static parseQRData(qrString: string): any {
    try {
      if (!qrString.startsWith('spendy://')) {
        throw new Error('Invalid QR code');
      }
      
      const url = new URL(qrString);
      const encodedData = url.searchParams.get('data');
      
      if (!encodedData) {
        throw new Error('No data in QR code');
      }
      
      return JSON.parse(atob(encodedData));
    } catch (error) {
      console.error('Parse QR data error:', error);
      throw new Error('Invalid QR code format');
    }
  }


}