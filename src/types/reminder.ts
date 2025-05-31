// src/types/reminder.ts

export type ReminderStatus = 'upcoming' | 'overdue' | 'paid';

export type ReminderCategory = 
  | 'utilities'
  | 'entertainment' 
  | 'finance'
  | 'insurance'
  | 'subscription'
  | 'rent'
  | 'food'
  | 'transport'
  | 'health'
  | 'education'
  | 'shopping'
  | 'other';

export type RecurringType = 
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category: ReminderCategory;
  dueDate: Date;
  status: ReminderStatus;
  
  // Recurring settings
  isRecurring: boolean;
  recurringType?: RecurringType;
  nextDueDate?: Date;
  
  // Auto-detection from email
  autoDetected?: boolean;
  emailSource?: string;
  
  // Payment tracking
  paidDate?: Date;
  paidAmount?: number;
  paymentMethod?: string;
  
  // Notification settings
  reminderDays?: number[]; // Days before due date to remind
  notificationEnabled?: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Optional attachments
  attachments?: ReminderAttachment[];
  notes?: string;
}

export interface ReminderAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
}

export interface ReminderNotification {
  id: string;
  reminderId: string;
  userId: string;
  type: 'due_soon' | 'overdue' | 'paid_confirmation';
  scheduledFor: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
  message: string;
  channels: NotificationChannel[];
}

export type NotificationChannel = 'push' | 'email' | 'sms';

export interface ReminderTemplate {
  id: string;
  name: string;
  title: string;
  category: ReminderCategory;
  defaultAmount?: number;
  isRecurring: boolean;
  recurringType?: RecurringType;
  description?: string;
  reminderDays?: number[];
  isPopular?: boolean;
}

export interface EmailSyncSettings {
  userId: string;
  provider: 'gmail' | 'outlook' | 'yahoo';
  isConnected: boolean;
  lastSyncAt?: Date;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
  autoCreateReminders: boolean;
  keywords: string[];
  excludeKeywords: string[];
  emailFilters: EmailFilter[];
}

export interface EmailFilter {
  id: string;
  senderPattern: string;
  subjectPattern?: string;
  bodyPattern?: string;
  category: ReminderCategory;
  titleTemplate: string;
  amountPattern?: string;
  isActive: boolean;
}

export interface ReminderCalendarEvent {
  id: string;
  reminderId: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  location?: string;
  attendees?: string[];
}

// Statistics and Analytics
export interface ReminderStats {
  total: number;
  upcoming: number;
  overdue: number;
  paid: number;
  totalAmount: number;
  overdueAmount: number;
  avgAmount: number;
  categoryCounts: Record<ReminderCategory, number>;
  monthlyTrend: MonthlyStats[];
  paymentMethods: Record<string, number>;
}

export interface MonthlyStats {
  month: string;
  year: number;
  totalReminders: number;
  totalAmount: number;
  paidOnTime: number;
  paidLate: number;
  missed: number;
}

// Search and Filter
export interface ReminderSearchParams {
  query?: string;
  categories?: ReminderCategory[];
  status?: ReminderStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
  isRecurring?: boolean;
  autoDetected?: boolean;
  sortBy?: 'dueDate' | 'amount' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ReminderFilters {
  categories: ReminderCategory[];
  status: ReminderStatus[];
  dateFilter: 'all' | 'this_week' | 'this_month' | 'next_month' | 'custom';
  customDateRange?: {
    start: Date;
    end: Date;
  };
  amountFilter: 'all' | 'under_50' | '50_to_200' | 'over_200' | 'custom';
  customAmountRange?: {
    min: number;
    max: number;
  };
  recurringOnly: boolean;
  autoDetectedOnly: boolean;
}

// Bulk Operations
export interface BulkReminderOperation {
  type: 'mark_paid' | 'delete' | 'update_category' | 'snooze';
  reminderIds: string[];
  data?: {
    category?: ReminderCategory;
    snoozeUntil?: Date;
    paidDate?: Date;
    notes?: string;
  };
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{
    reminderId: string;
    error: string;
  }>;
}

// Integration Types
export interface CalendarIntegration {
  provider: 'google' | 'apple' | 'outlook';
  isConnected: boolean;
  calendarId?: string;
  syncEnabled: boolean;
  lastSyncAt?: Date;
}

export interface PaymentIntegration {
  provider: string;
  isConnected: boolean;
  accountId?: string;
  autoMarkPaid: boolean;
  lastSyncAt?: Date;
}

// Widget and Dashboard
export interface ReminderWidget {
  id: string;
  type: 'upcoming' | 'overdue' | 'monthly_summary' | 'category_breakdown';
  position: number;
  isVisible: boolean;
  settings: Record<string, any>;
}

export interface DashboardConfig {
  widgets: ReminderWidget[];
  defaultView: 'list' | 'calendar' | 'cards';
  showStats: boolean;
  compactMode: boolean;
  groupByCategory: boolean;
}

// Export/Import
export interface ReminderExport {
  format: 'json' | 'csv' | 'pdf';
  filters?: ReminderSearchParams;
  includeAttachments: boolean;
  dateGenerated: Date;
  totalRecords: number;
}

export interface ReminderImport {
  format: 'json' | 'csv';
  data: string | Reminder[];
  options: {
    skipDuplicates: boolean;
    updateExisting: boolean;
    defaultCategory?: ReminderCategory;
  };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details: Array<{
    row: number;
    status: 'imported' | 'skipped' | 'error';
    message?: string;
  }>;
}