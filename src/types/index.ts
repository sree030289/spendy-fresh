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

export interface AppTheme {
  isDark: boolean;
  colors: {
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
