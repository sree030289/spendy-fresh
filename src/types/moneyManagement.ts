// Personal Finance Management Types - Database Schema

export interface PersonalTransaction {
  id: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: PersonalIncomeCategory | PersonalExpenseCategory;
  subcategory?: string;
  date: Date;
  tags: string[];
  isRecurring: boolean;
  recurringId?: string;
  source: 'manual' | 'bank_statement' | 'receipt_scan' | 'auto_recurring';
  paymentMethod?: PaymentMethod;
  location?: string;
  attachments?: string[]; // URLs to receipts/documents
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringTemplate {
  id: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: PersonalIncomeCategory | PersonalExpenseCategory;
  subcategory?: string;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date;
  nextDueDate: Date;
  isActive: boolean;
  notifyBefore: number; // days before to send notification
  autoCreate: boolean; // automatically create transaction or just notify
  tags: string[];
  paymentMethod?: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
}

// Expanded Income Categories
export type PersonalIncomeCategory = 
  | 'Salary'
  | 'Freelance' 
  | 'Business'
  | 'Investment'
  | 'Dividend'
  | 'Rental'
  | 'Bonus'
  | 'Gift'
  | 'Cashback'
  | 'Refund'
  | 'Side Hustle'
  | 'Pension'
  | 'Government Benefits'
  | 'Other';

// Expanded Expense Categories
export type PersonalExpenseCategory = 
  // Housing
  | 'Rent'
  | 'Mortgage'
  | 'Home Maintenance'
  | 'Property Tax'
  | 'Home Insurance'
  
  // Transportation
  | 'Car Payment'
  | 'Car Insurance' 
  | 'Fuel'
  | 'Car Maintenance'
  | 'Public Transport'
  | 'Uber/Taxi'
  | 'Parking'
  
  // Food & Dining
  | 'Groceries'
  | 'Restaurant'
  | 'Coffee'
  | 'Online Food Delivery'
  | 'Office Meals'
  
  // Bills & Utilities
  | 'Electricity'
  | 'Water'
  | 'Gas'
  | 'Internet'
  | 'Mobile Bill'
  
  // Subscriptions
  | 'Netflix'
  | 'Spotify'
  | 'Amazon Prime'
  | 'App Store'
  | 'Software Subscriptions'
  | 'Gym Membership'
  | 'Other Subscriptions'
  
  // Loans & EMIs
  | 'Home Loan EMI'
  | 'Car Loan EMI'
  | 'Personal Loan EMI'
  | 'Credit Card Bill'
  | 'Education Loan EMI'
  
  // Shopping
  | 'Clothing'
  | 'Electronics'
  | 'Home & Garden'
  | 'Books'
  | 'Online Shopping'
  
  // Health & Fitness
  | 'Medical'
  | 'Pharmacy'
  | 'Gym'
  | 'Sports'
  | 'Wellness'
  
  // Entertainment
  | 'Movies'
  | 'Games'
  | 'Hobbies'
  | 'Events'
  
  // Travel
  | 'Flights'
  | 'Hotels'
  | 'Vacation'
  
  // Education
  | 'Courses'
  | 'Books & Learning'
  | 'Professional Development'
  
  // Personal Care
  | 'Haircut'
  | 'Cosmetics'
  | 'Personal Items'
  
  // Insurance
  | 'Life Insurance'
  | 'Health Insurance'
  | 'Term Insurance'
  
  // Taxes & Legal
  | 'Income Tax'
  | 'Professional Services'
  
  // Savings & Investment
  | 'SIP'
  | 'Fixed Deposit'
  | 'PPF'
  | 'Stocks'
  | 'Mutual Funds'
  
  // Other
  | 'Cash Withdrawal'
  | 'Bank Charges'
  | 'Other';

export type RecurringFrequency = 
  | 'daily' 
  | 'weekly' 
  | 'bi-weekly'
  | 'monthly' 
  | 'quarterly' 
  | 'semi-annually'
  | 'annually';

export type PaymentMethod = 
  | 'Cash'
  | 'Debit Card'
  | 'Credit Card' 
  | 'Bank Transfer'
  | 'UPI'
  | 'Digital Wallet'
  | 'Check'
  | 'Other';

// Analytics and Insights
export interface PersonalAnalytics {
  userId: string;
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number; // percentage
  categoryBreakdown: CategoryBreakdown[];
  incomeBreakdown: CategoryBreakdown[];
  monthlyTrends: MonthlyTrend[];
  aiInsights: AIInsight[];
  budgetPerformance: BudgetPerformance[];
  upcomingExpenses: UpcomingExpense[];
  lastUpdated: Date;
}

export type AnalyticsPeriod = 'week' | 'month' | 'quarter' | 'year';

export interface CategoryBreakdown {
  category: PersonalIncomeCategory | PersonalExpenseCategory;
  amount: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  color: string;
  icon: string;
  subcategories?: SubcategoryBreakdown[];
}

export interface SubcategoryBreakdown {
  subcategory: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  topExpenseCategory: string;
}

export interface AIInsight {
  id: string;
  type: 'positive' | 'warning' | 'info' | 'alert' | 'tip';
  title: string;
  description: string;
  icon: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  action?: {
    type: 'create_budget' | 'set_reminder' | 'view_category' | 'export_data';
    data: any;
  };
  confidence: number;
  category?: PersonalIncomeCategory | PersonalExpenseCategory;
  createdAt: Date;
}

export interface BudgetPerformance {
  category: PersonalExpenseCategory;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  percentageUsed: number;
  daysRemaining: number;
  projectedAmount: number;
  status: 'on_track' | 'over_budget' | 'under_budget';
}

export interface UpcomingExpense {
  description: string;
  amount: number;
  category: PersonalExpenseCategory;
  dueDate: Date;
  confidence: number;
  source: 'recurring' | 'pattern_analysis' | 'manual_reminder';
  isRecurring: boolean;
  recurringId?: string;
}

// Budget Management
export interface Budget {
  id: string;
  userId: string;
  category: PersonalExpenseCategory;
  amount: number;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  spent: number;
  remaining: number;
  alertThresholds: {
    fifty: boolean; // 50% threshold
    seventyFive: boolean; // 75% threshold
    ninety: boolean; // 90% threshold
    exceeded: boolean; // over budget
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Templates
export interface SmartReminder {
  id: string;
  userId: string;
  type: 'income_reminder' | 'expense_reminder' | 'budget_alert' | 'bill_due';
  title: string;
  message: string;
  triggerDate: Date;
  category?: PersonalIncomeCategory | PersonalExpenseCategory;
  amount?: number;
  isRecurring: boolean;
  recurringPattern?: RecurringFrequency;
  isActive: boolean;
  lastSent?: Date;
  relatedTransactionId?: string;
  relatedBudgetId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Usage Tracking (for subscription limits)
export interface UsageTracker {
  userId: string;
  date: string; // YYYY-MM-DD format
  transactionsAdded: number;
  analyticsViewed: number;
  exportsGenerated: number;
  premiumFeaturesUsed: string[]; // list of premium features used
  resetAt: Date; // when the counter resets (daily)
}

// Statement Parsing
export interface StatementImport {
  id: string;
  userId: string;
  fileName: string;
  fileType: 'pdf' | 'csv' | 'excel';
  bankName?: string;
  accountType?: 'checking' | 'savings' | 'credit_card';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  transactionsParsed: number;
  transactionsImported: number;
  errors?: string[];
  importedAt: Date;
  parsedData?: ParsedTransaction[];
}

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  balance?: number;
  suggestedCategory: PersonalIncomeCategory | PersonalExpenseCategory;
  confidence: number;
  shouldImport: boolean;
  matchedTransactionId?: string; // if already exists
}

// Calendar View Data
export interface CalendarData {
  date: string; // YYYY-MM-DD
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  transactionCount: number;
  hasReminders: boolean;
  topCategory: PersonalIncomeCategory | PersonalExpenseCategory;
  transactions: PersonalTransaction[];
}

// Export Data Structure
export interface ExportData {
  userId: string;
  exportType: 'csv' | 'pdf' | 'excel';
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  filters?: {
    categories?: (PersonalIncomeCategory | PersonalExpenseCategory)[];
    transactionTypes?: ('income' | 'expense')[];
    paymentMethods?: PaymentMethod[];
    minAmount?: number;
    maxAmount?: number;
  };
  includeAnalytics: boolean;
  exportedAt: Date;
  fileUrl?: string;
  downloadCount: number;
}