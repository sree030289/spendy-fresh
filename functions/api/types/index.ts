// src/types/index.ts

// Constants
export const COLLECTIONS = {
  USERS: 'users',
  FRIENDS: 'friends',
  FRIEND_REQUESTS: 'friendRequests',
  GROUPS: 'groups',
  EXPENSES: 'expenses',
  PAYMENTS: 'payments',
  NOTIFICATIONS: 'notifications',
  REMINDERS: 'reminders',
  BANK_ACCOUNTS: 'bankAccounts',
  TRANSACTIONS: 'transactions',
  SUBSCRIPTIONS: 'subscriptions',
  DEALS: 'deals'
} as const;

export const FRIEND_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  BLOCKED: 'blocked'
} as const;

export const GROUP_MEMBER_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  REMOVED: 'removed'
} as const;

export interface User {
  id: string;
  email: string;
  fullName: string;
  name: string; // Alias for fullName for compatibility
  mobile?: string;
  phoneNumber?: string; // Alias for mobile for compatibility
  country: string;
  currency: string;
  profilePicture?: string;
  profileImage?: string; // Alias for profilePicture for compatibility
  biometricEnabled?: boolean;
  isPremium?: boolean;
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'cancelled' | 'expired';
  pushToken?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  friendName: string;
  friendData?: {
    id: string;
    fullName: string;
    email: string;
    mobile?: string;
    avatar?: string;
    profilePicture?: string;
  };
  status: 'pending' | 'accepted' | 'blocked' | 'invited';
  balance?: number;
  lastActivity?: Date;
  createdAt: Date;
  updatedAt: Date;
  invitedAt?: Date;
  requestId?: string;
  inviteMethod?: 'email' | 'sms' | 'whatsapp' | 'qr';
  isNewUser?: boolean;
  requestType?: 'sent' | 'received';
}

export interface FriendRequest {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
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
    approvalThreshold?: number;
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
  splits: ExpenseSplit[];
  date: Date;
  receiptUrl?: string;
  notes?: string;
  isSettled: boolean;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseSplit {
  userId: string;
  userData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  amount: number;
  percentage?: number;
  isPaid: boolean;
  paidAt?: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'expense_added' | 'payment_request' | 'group_invite' | 'expense_settled' | 'reminder';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface Payment {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  method: 'cash' | 'bank_transfer' | 'paypal' | 'stripe' | 'venmo' | 'other';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  expenseId?: string;
  groupId?: string;
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface Reminder {
  id: string;
  userId: string;
  type: 'expense' | 'bill' | 'salary' | 'custom';
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
  dueDate: Date;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  isActive: boolean;
  lastTriggered?: Date;
  nextTrigger?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankAccount {
  id: string;
  userId: string;
  institutionId: string;
  institutionName: string;
  accountId: string;
  accountName: string;
  accountType: 'checking' | 'savings' | 'credit' | 'investment' | 'other';
  balance: number;
  currency: string;
  isActive: boolean;
  lastSyncAt?: Date;
  provider: 'plaid' | 'truelayer' | 'manual';
  accessToken?: string; // Encrypted
  settings: {
    syncEnabled: boolean;
    syncFrequency: 'manual' | 'daily' | 'hourly';
    isPrimary: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  accountId: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  date: Date;
  type: 'debit' | 'credit';
  isExpense?: boolean;
  expenseId?: string;
  merchant?: {
    name: string;
    category: string;
  };
  location?: {
    city: string;
    country: string;
  };
  createdAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  startDate: Date;
  endDate: Date;
  amount: number;
  currency: string;
  provider: 'stripe' | 'paypal' | 'apple' | 'google';
  subscriptionId: string;
  features: {
    maxGroups: number;
    maxMembers: number;
    maxTransactions: number;
    analytics: boolean;
    prioritySupport: boolean;
    qrCode: boolean;
    groupChat: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  category: string;
  merchant: string;
  imageUrl?: string;
  url: string;
  source: 'ozbargain' | 'groupon' | 'catch' | 'custom';
  location?: string;
  validFrom: Date;
  validTo?: Date;
  likes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}
