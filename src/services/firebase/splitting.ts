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
    avatar?: string;
    profilePicture?: string;
  };
  status: 'pending' | 'accepted' | 'blocked';
  balance: number; // positive = friend owes you, negative = you owe friend
  lastActivity: Date;
  createdAt: Date;
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

// Splitting Service Class
export class SplittingService {
  
  // FRIENDS MANAGEMENT
  static async sendFriendRequest(fromUserId: string, toEmail: string, message?: string): Promise<void> {
    try {
      // Find user by email
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', toEmail.toLowerCase()),
        limit(1)
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
      
      // Get sender data
      const fromUserDoc = await getDoc(doc(db, 'users', fromUserId));
      const fromUserData = fromUserDoc.data();
      
      // Create friend request
      const friendRequest: Omit<FriendRequest, 'id'> = {
        fromUserId,
        fromUserData: {
          fullName: fromUserData?.fullName || 'Unknown User',
          email: fromUserData?.email || '',
          avatar: fromUserData?.profilePicture
        },
        toUserId,
        toUserEmail: toEmail.toLowerCase(),
        message,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'friendRequests'), friendRequest);
      
      // Send notification to recipient
      await this.createNotification({
        userId: toUserId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${fromUserData?.fullName} wants to be your friend`,
        data: { friendRequestId: docRef.id, fromUserId },
        isRead: false,
        createdAt: new Date()
      });
      
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
      const friendsQuery = query(
        collection(db, 'friends'),
        where('userId', '==', userId),
        where('status', '==', 'accepted'),
        orderBy('lastActivity', 'desc')
      );
      
      const snapshot = await getDocs(friendsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Friend[];
      
    } catch (error) {
      console.error('Get friends error:', error);
      throw error;
    }
  }
  
  // GROUPS MANAGEMENT
  static async createGroup(groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'inviteCode'>): Promise<string> {
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const newGroup: Omit<Group, 'id'> = {
        ...groupData,
        inviteCode,
        totalExpenses: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'groups'), newGroup);
      
      // Add creator as admin member
      await this.addGroupMember(docRef.id, groupData.createdBy, 'admin');
      
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
      const batch = writeBatch(db);
      
      const newExpense: Omit<Expense, 'id'> = {
        ...expenseData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const expenseRef = doc(collection(db, 'expenses'));
      batch.set(expenseRef, newExpense);
      
      // Update group total expenses
      batch.update(doc(db, 'groups', expenseData.groupId), {
        totalExpenses: increment(expenseData.amount),
        updatedAt: new Date()
      });
      
      // Update member balances
      expenseData.splitData.forEach(split => {
        if (split.userId !== expenseData.paidBy) {
          // Update friend relationships
          this.updateFriendBalance(expenseData.paidBy, split.userId, split.amount);
          this.updateFriendBalance(split.userId, expenseData.paidBy, -split.amount);
        }
      });
      
      await batch.commit();
      
      // Send notifications to group members
      const group = await getDoc(doc(db, 'groups', expenseData.groupId));
      const groupData = group.data() as Group;
      
      const notifications = groupData.members
        .filter(member => member.userId !== expenseData.paidBy)
        .map(member => 
          this.createNotification({
            userId: member.userId,
            type: 'expense_added',
            title: 'New Expense Added',
            message: `${expenseData.paidByData.fullName} added "${expenseData.description}" for $${expenseData.amount}`,
            data: { expenseId: expenseRef.id, groupId: expenseData.groupId },
            isRead: false,
            createdAt: new Date()
          })
        );
      
      await Promise.all(notifications);
      
      return expenseRef.id;
      
    } catch (error) {
      console.error('Add expense error:', error);
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

  // GET USER GROUPS
  static async getUserGroups(userId: string): Promise<Group[]> {
    try {
      const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains-any', [{ userId }]),
        where('isActive', '==', true),
        orderBy('updatedAt', 'desc')
      );
      
      const snapshot = await getDocs(groupsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Group[];
      
    } catch (error) {
      console.error('Get user groups error:', error);
      // Fallback query if array-contains-any doesn't work
      try {
        const allGroupsQuery = query(
          collection(db, 'groups'),
          where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(allGroupsQuery);
        const allGroups = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Group[];
        
        // Filter groups where user is a member
        return allGroups.filter(group => 
          group.members.some(member => member.userId === userId)
        );
        
      } catch (fallbackError) {
        console.error('Fallback get user groups error:', fallbackError);
        return [];
      }
    }
  }

  // GET USER EXPENSES
  static async getUserExpenses(userId: string, limit: number = 20): Promise<Expense[]> {
    try {
      // First get user's groups
      const userGroups = await this.getUserGroups(userId);
      const groupIds = userGroups.map(group => group.id);
      
      if (groupIds.length === 0) {
        return [];
      }
      
      // Get expenses from user's groups
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('groupId', 'in', groupIds.slice(0, 10)), // Firestore 'in' limit is 10
        orderBy('createdAt', 'desc'),
        limit(limit)
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