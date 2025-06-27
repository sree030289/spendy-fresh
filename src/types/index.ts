export interface User {
  id: string;
  fullName: string;
  email: string;
  country: string;
  mobile: string;
  currency: string;
  profilePicture?: string;
  biometricEnabled: boolean;
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
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string; 
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
