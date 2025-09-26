export interface User {
  id: string;
  fullName: string;
  email: string;
  country: string;
  mobile: string;
  phoneNumber?: string; // Alias for mobile for compatibility
  currency: string;
  profilePicture?: string;
  profileImage?: string; // Alias for profilePicture for compatibility
  biometricEnabled: boolean;
  isPremium?: boolean;
  subscriptionStatus?: 'active' | 'cancelled' | 'expired' | 'premium';
  createdAt: Date;
  updatedAt: Date;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  phoneCode: string;
  flag: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Unified Invite System Types
export interface UnifiedInvite {
  id: string;
  inviterId: string;
  inviterData: {
    fullName: string;
    email: string;
    profilePicture?: string;
  };
  recipientUserId: string | null; // null for unregistered users
  recipientPhone: string; // E.164 format
  recipientEmail: string | null; // null for unregistered users initially
  status: 'PENDING' | 'SIGNUP_PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  type: 'SMS_REGISTERED_USER' | 'SMS_UNREGISTERED_USER' | 'EMAIL_REGISTERED_USER' | 'EMAIL_UNREGISTERED_USER';
  inviteToken: string; // Unique token for tracking
  sentVia: 'SMS' | 'EMAIL' | 'PUSH' | 'QR';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  convertedFromPendingAt?: Date; // When SIGNUP_PENDING was converted to PENDING/ACCEPTED
}

export interface InviteCreationRequest {
  inviterId: string;
  recipientPhone?: string;
  recipientEmail?: string;
  countryCode?: string; // Required for SMS invites (ISO 3166-1 alpha-2, e.g., 'US', 'AU')
  message?: string;
  sentVia: 'SMS' | 'EMAIL' | 'PUSH' | 'QR';
  autoAccept?: boolean; // For unregistered users who sign up
}

export interface InviteResponse {
  success: boolean;
  invite?: UnifiedInvite;
  isRegisteredUser: boolean;
  friendshipStatus?: 'already_friends' | 'request_pending' | 'request_received' | 'no_relationship';
  message: string;
}

export interface PendingInviteCheckResult {
  hasPendingInvites: boolean;
  invites: UnifiedInvite[];
  autoAcceptedCount: number;
  newFriendships: string[]; // Array of new friend user IDs
}

export interface AppTheme {
  isDark: boolean;
  colors: {
    // Brand colors
    brand: string;
    brandLight: string;
    brandDark: string;
    
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    surfaceSecondary: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;
    border: string;
    borderLight: string;
    divider: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    hover: string;
    pressed: string;
    disabled: string;
    gradientStart: string;
    gradientEnd: string;
    card: string;
    cardElevated: string;
    shadow: string;
    inputBackground: string;
    inputBorder: string;
    inputPlaceholder: string;
    overlay: string;
    modalBackground: string;
    tabActive: string;
    tabInactive: string;
    tabBackground: string;
    primaryLight: string;
    primaryDark: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    full: number;
  };
  shadows: {
    sm: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    md: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    lg: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    xl: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
}


export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  type: 'expense';
  subcategory?: string;
  description?: string;
  recurring?: RecurringType;
}

export interface Income {
  id: string;
  title: string;
  amount: number;
  category: IncomeCategory;
  date: string;
  type: 'income';
  recurring?: RecurringType;
  nextPaymentDate?: string;
}

export interface Reminder {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  category: ReminderCategory;
  recurring: RecurringType;
  autoDetected: boolean;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  emailId?: string; // For Gmail integration
  lastNotified?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'reminder' | 'analytics' | 'salary' | 'expense_reminder';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface Analytics {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  categoryBreakdown: CategoryBreakdown[];
  trends: TrendData[];
  predictions: PredictionData[];
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
  trend: 'up' | 'down' | 'stable';
  previousPeriod?: number;
}

export interface TrendData {
  date: string;
  income: number;
  expenses: number;
  netFlow: number;
}

export interface PredictionData {
  category: string;
  predictedAmount: number;
  confidence: number;
  recommendation: string;
}

export type ExpenseCategory = 
  | 'Housing' | 'Transportation' | 'Food' | 'Utilities' 
  | 'Healthcare' | 'Entertainment' | 'Shopping' | 'Education'
  | 'Insurance' | 'Loans' | 'Other';

export type IncomeCategory = 
  | 'Salary' | 'Freelance' | 'Investment' | 'Business' 
  | 'Rental' | 'Gift' | 'Other';

export type ReminderCategory = 
  | 'Bills' | 'Subscriptions' | 'Insurance' | 'Loans' 
  | 'Taxes' | 'Rent' | 'Utilities' | 'Other';

export type RecurringType = 
  | 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// Group Splitting Types
export interface GroupExpense {
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
  isSettlementTransaction?: boolean; // Flag to mark this as a settlement transaction
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
}

export interface SettlementTransaction {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  date: Date;
  description?: string;
  fromUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
  toUserData: {
    fullName: string;
    email: string;
    avatar?: string;
  };
}
