// src/services/reminders/RemindersService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Reminder, ReminderCategory, ReminderStatus, RecurringType } from '@/types/reminder';

// Storage keys
const STORAGE_KEYS = {
  REMINDERS: '@spendy_reminders',
  EMAIL_CONNECTION: '@spendy_email_connection',
  NOTIFICATION_SETTINGS: '@spendy_notification_settings',
};

// Mock email patterns for demo
const EMAIL_BILL_PATTERNS = [
  {
    sender: 'netflix.com',
    title: 'Netflix Subscription',
    category: 'entertainment' as ReminderCategory,
    amount: 15.99,
    pattern: /netflix.*(\$[\d.]+)/i
  },
  {
    sender: 'spotify.com',
    title: 'Spotify Premium',
    category: 'entertainment' as ReminderCategory,
    amount: 9.99,
    pattern: /spotify.*premium.*(\$[\d.]+)/i
  },
  {
    sender: 'electric@utility.com',
    title: 'Electricity Bill',
    category: 'utilities' as ReminderCategory,
    amount: 127.45,
    pattern: /electricity.*bill.*(\$[\d.]+)/i
  },
  {
    sender: 'visa@bank.com',
    title: 'Credit Card Payment',
    category: 'finance' as ReminderCategory,
    amount: 450.00,
    pattern: /credit.*card.*payment.*(\$[\d.]+)/i
  },
  {
    sender: 'internet@provider.com',
    title: 'Internet Bill',
    category: 'utilities' as ReminderCategory,
    amount: 89.99,
    pattern: /internet.*bill.*(\$[\d.]+)/i
  },
  {
    sender: 'insurance@company.com',
    title: 'Car Insurance',
    category: 'insurance' as ReminderCategory,
    amount: 156.78,
    pattern: /insurance.*premium.*(\$[\d.]+)/i
  }
];

let firebaseDb: any = null;

const initializeFirebase = async () => {
  try {
    if (firebaseDb) return firebaseDb;
    
    const { getFirestore } = await import('firebase/firestore');
    const { getApps } = await import('firebase/app');
    
    if (getApps().length > 0) {
      firebaseDb = getFirestore(getApps()[0]);
      return firebaseDb;
    }
    
    return null;
  } catch (error) {
    console.log('Firebase not available for reminders:', error);
    return null;
  }
};

export class RemindersService {
  
  // Get all reminders for a user
  static async getReminders(userId: string): Promise<Reminder[]> {
    try {
      // Try Firebase first
      const db = await initializeFirebase();
      if (db && !userId.startsWith('mock-')) {
        const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
        
        const remindersRef = collection(db, 'reminders');
        const q = query(
          remindersRef,
          where('userId', '==', userId),
          orderBy('dueDate', 'asc')
        );
        
        const snapshot = await getDocs(q);
        const reminders: Reminder[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          reminders.push({
            id: doc.id,
            ...data,
            dueDate: data.dueDate.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
            paidDate: data.paidDate?.toDate(),
            nextDueDate: data.nextDueDate?.toDate(),
          } as Reminder);
        });
        
        // Update status based on due dates
        const updatedReminders = reminders.map(reminder => ({
          ...reminder,
          status: this.calculateReminderStatus(reminder)
        }));
        
        return updatedReminders;
      }
    } catch (error) {
      console.log('Firebase getReminders failed, using mock data:', error);
    }
    
    // Fallback to mock data
    return this.getMockReminders();
  }
  
  // Calculate reminder status based on due date
  private static calculateReminderStatus(reminder: Reminder): ReminderStatus {
    if (reminder.status === 'paid') return 'paid';
    
    const now = new Date();
    const dueDate = new Date(reminder.dueDate);
    
    if (dueDate < now) {
      return 'overdue';
    } else {
      return 'upcoming';
    }
  }
  
  // Get mock reminders for demo
  private static getMockReminders(): Reminder[] {
    const now = new Date();
    
    return [
      {
        id: 'reminder-1',
        userId: 'mock-123',
        title: 'Netflix Subscription',
        description: 'Monthly Netflix Premium subscription',
        amount: 15.99,
        currency: 'USD',
        category: 'entertainment',
        dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
        status: 'upcoming',
        isRecurring: true,
        recurringType: 'monthly',
        autoDetected: true,
        emailSource: 'netflix@netflix.com',
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        id: 'reminder-2',
        userId: 'mock-123',
        title: 'Electricity Bill',
        description: 'Monthly electricity bill from City Power',
        amount: 127.45,
        currency: 'USD',
        category: 'utilities',
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
        status: 'upcoming',
        isRecurring: true,
        recurringType: 'monthly',
        autoDetected: true,
        emailSource: 'billing@citypower.com',
        createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        id: 'reminder-3',
        userId: 'mock-123',
        title: 'Credit Card Payment',
        description: 'Visa credit card minimum payment',
        amount: 450.00,
        currency: 'USD',
        category: 'finance',
        dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // Overdue by 3 days
        status: 'overdue',
        isRecurring: true,
        recurringType: 'monthly',
        autoDetected: true,
        emailSource: 'statements@visa.com',
        createdAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        id: 'reminder-4',
        userId: 'mock-123',
        title: 'Internet Bill',
        description: 'Monthly internet service from TechCorp',
        amount: 89.99,
        currency: 'USD',
        category: 'utilities',
        dueDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Overdue by 1 day
        status: 'overdue',
        isRecurring: true,
        recurringType: 'monthly',
        autoDetected: true,
        emailSource: 'billing@techcorp.com',
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        id: 'reminder-5',
        userId: 'mock-123',
        title: 'Spotify Premium',
        description: 'Monthly Spotify Premium subscription',
        amount: 9.99,
        currency: 'USD',
        category: 'entertainment',
        dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // Paid 5 days ago
        status: 'paid',
        isRecurring: true,
        recurringType: 'monthly',
        autoDetected: true,
        emailSource: 'noreply@spotify.com',
        paidDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    ];
  }
  
  // Create a new reminder
  static async createReminder(userId: string, reminderData: Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const db = await initializeFirebase();
      if (db && !userId.startsWith('mock-')) {
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        
        const docRef = await addDoc(collection(db, 'reminders'), {
          ...reminderData,
          userId,
          status: this.calculateReminderStatus({ ...reminderData } as Reminder),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        return docRef.id;
      }
    } catch (error) {
      console.log('Firebase createReminder failed:', error);
    }
    
    // Mock creation
    const mockId = 'reminder-' + Math.random().toString(36).substr(2, 9);
    console.log('Created mock reminder:', mockId);
    return mockId;
  }
  
  // Update a reminder
  static async updateReminder(reminderId: string, updates: Partial<Reminder>): Promise<void> {
    try {
      const db = await initializeFirebase();
      if (db) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        
        await updateDoc(doc(db, 'reminders', reminderId), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
        
        return;
      }
    } catch (error) {
      console.log('Firebase updateReminder failed:', error);
    }
    
    console.log('Updated mock reminder:', reminderId);
  }
  
  // Mark reminder as paid
  static async markAsPaid(reminderId: string): Promise<void> {
    try {
      const now = new Date();
      
      const db = await initializeFirebase();
      if (db) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        
        await updateDoc(doc(db, 'reminders', reminderId), {
          status: 'paid',
          paidDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        return;
      }
    } catch (error) {
      console.log('Firebase markAsPaid failed:', error);
    }
    
    console.log('Marked mock reminder as paid:', reminderId);
  }
  
  // Delete a reminder
  static async deleteReminder(reminderId: string): Promise<void> {
    try {
      const db = await initializeFirebase();
      if (db) {
        const { doc, deleteDoc } = await import('firebase/firestore');
        
        await deleteDoc(doc(db, 'reminders', reminderId));
        return;
      }
    } catch (error) {
      console.log('Firebase deleteReminder failed:', error);
    }
    
    console.log('Deleted mock reminder:', reminderId);
  }
  
  // Check if email is connected
  static async isEmailConnected(userId: string): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.EMAIL_CONNECTION}_${userId}`);
      return stored === 'true';
    } catch (error) {
      console.log('Error checking email connection:', error);
      return false;
    }
  }
  
  // Connect email for auto-detection
  static async connectEmail(userId: string, provider: 'gmail' | 'outlook'): Promise<void> {
    try {
      // In production, this would integrate with OAuth
      await AsyncStorage.setItem(`${STORAGE_KEYS.EMAIL_CONNECTION}_${userId}`, 'true');
      await AsyncStorage.setItem(`${STORAGE_KEYS.EMAIL_CONNECTION}_${userId}_provider`, provider);
      
      console.log(`Connected ${provider} for user ${userId}`);
    } catch (error) {
      console.log('Error connecting email:', error);
      throw error;
    }
  }
  
  // Disconnect email
  static async disconnectEmail(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${STORAGE_KEYS.EMAIL_CONNECTION}_${userId}`);
      await AsyncStorage.removeItem(`${STORAGE_KEYS.EMAIL_CONNECTION}_${userId}_provider`);
      
      console.log(`Disconnected email for user ${userId}`);
    } catch (error) {
      console.log('Error disconnecting email:', error);
      throw error;
    }
  }
  
  // Sync bills from email (mock implementation)
  static async syncEmailBills(userId: string): Promise<Reminder[]> {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock finding new bills in email
      const newBills: Array<Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = [];
      
      // Randomly generate 0-3 new bills for demo
      const numNewBills = Math.floor(Math.random() * 4);
      
      for (let i = 0; i < numNewBills; i++) {
        const pattern = EMAIL_BILL_PATTERNS[Math.floor(Math.random() * EMAIL_BILL_PATTERNS.length)];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 30) + 1); // 1-30 days from now
        
        newBills.push({
          title: pattern.title,
          description: `Auto-detected from ${pattern.sender}`,
          amount: pattern.amount + (Math.random() - 0.5) * 20, // Vary amount slightly
          currency: 'USD',
          category: pattern.category,
          dueDate,
          status: 'upcoming',
          isRecurring: true,
          recurringType: 'monthly',
          autoDetected: true,
          emailSource: pattern.sender,
        });
      }
      
      // Create the new reminders
      const createdReminders: Reminder[] = [];
      for (const bill of newBills) {
        const id = await this.createReminder(userId, bill);
        createdReminders.push({
          id,
          userId,
          ...bill,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      
      return createdReminders;
      
    } catch (error) {
      console.log('Error syncing email bills:', error);
      throw error;
    }
  }
  
  // Get reminders due soon (for notifications)
  static async getRemindersDueSoon(userId: string, days: number = 3): Promise<Reminder[]> {
    try {
      const allReminders = await this.getReminders(userId);
      const now = new Date();
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      
      return allReminders.filter(reminder => {
        if (reminder.status === 'paid') return false;
        
        const dueDate = new Date(reminder.dueDate);
        return dueDate >= now && dueDate <= futureDate;
      });
    } catch (error) {
      console.log('Error getting reminders due soon:', error);
      return [];
    }
  }
  
  // Get overdue reminders
  static async getOverdueReminders(userId: string): Promise<Reminder[]> {
    try {
      const allReminders = await this.getReminders(userId);
      const now = new Date();
      
      return allReminders.filter(reminder => {
        if (reminder.status === 'paid') return false;
        
        const dueDate = new Date(reminder.dueDate);
        return dueDate < now;
      });
    } catch (error) {
      console.log('Error getting overdue reminders:', error);
      return [];
    }
  }
  
  // Calculate next due date for recurring reminders
  static calculateNextDueDate(dueDate: Date, recurringType: RecurringType): Date {
    const nextDate = new Date(dueDate);
    
    switch (recurringType) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        // No recurring, return same date
        break;
    }
    
    return nextDate;
  }
  
  // Process recurring reminders (called by background task)
  static async processRecurringReminders(userId: string): Promise<void> {
    try {
      const allReminders = await this.getReminders(userId);
      const now = new Date();
      
      for (const reminder of allReminders) {
        if (reminder.isRecurring && reminder.status === 'paid' && reminder.recurringType) {
          const nextDueDate = this.calculateNextDueDate(reminder.dueDate, reminder.recurringType);
          
          // If it's time for the next occurrence
          if (nextDueDate <= now) {
            await this.createReminder(userId, {
              ...reminder,
              dueDate: nextDueDate,
              status: 'upcoming',
              paidDate: undefined,
              autoDetected: false, // Mark as system-generated recurring
            });
          }
        }
      }
    } catch (error) {
      console.log('Error processing recurring reminders:', error);
    }
  }
  
  // Get reminder statistics
  static async getReminderStats(userId: string): Promise<{
    total: number;
    upcoming: number;
    overdue: number;
    paid: number;
    totalAmount: number;
    overdueAmount: number;
    categoryBreakdown: Array<{ category: ReminderCategory; count: number; amount: number }>;
  }> {
    try {
      const allReminders = await this.getReminders(userId);
      
      const stats = {
        total: allReminders.length,
        upcoming: 0,
        overdue: 0,
        paid: 0,
        totalAmount: 0,
        overdueAmount: 0,
        categoryBreakdown: [] as Array<{ category: ReminderCategory; count: number; amount: number }>,
      };
      
      const categoryMap = new Map<ReminderCategory, { count: number; amount: number }>();
      
      for (const reminder of allReminders) {
        // Count by status
        if (reminder.status === 'upcoming') stats.upcoming++;
        else if (reminder.status === 'overdue') stats.overdue++;
        else if (reminder.status === 'paid') stats.paid++;
        
        // Sum amounts
        if (reminder.status !== 'paid') {
          stats.totalAmount += reminder.amount;
          if (reminder.status === 'overdue') {
            stats.overdueAmount += reminder.amount;
          }
        }
        
        // Category breakdown
        const existing = categoryMap.get(reminder.category) || { count: 0, amount: 0 };
        categoryMap.set(reminder.category, {
          count: existing.count + 1,
          amount: existing.amount + reminder.amount,
        });
      }
      
      // Convert category map to array
      stats.categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        ...data,
      }));
      
      return stats;
    } catch (error) {
      console.log('Error getting reminder stats:', error);
      return {
        total: 0,
        upcoming: 0,
        overdue: 0,
        paid: 0,
        totalAmount: 0,
        overdueAmount: 0,
        categoryBreakdown: [],
      };
    }
  }
  
  // Search reminders
  static async searchReminders(userId: string, query: string): Promise<Reminder[]> {
    try {
      const allReminders = await this.getReminders(userId);
      const lowercaseQuery = query.toLowerCase();
      
      return allReminders.filter(reminder =>
        reminder.title.toLowerCase().includes(lowercaseQuery) ||
        reminder.description?.toLowerCase().includes(lowercaseQuery) ||
        reminder.category.toLowerCase().includes(lowercaseQuery)
      );
    } catch (error) {
      console.log('Error searching reminders:', error);
      return [];
    }
  }
  
  // Export reminders data
  static async exportReminders(userId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const reminders = await this.getReminders(userId);
      
      if (format === 'csv') {
        // Convert to CSV format
        const headers = ['Title', 'Amount', 'Currency', 'Category', 'Due Date', 'Status', 'Description'];
        const csvRows = [
          headers.join(','),
          ...reminders.map(r => [
            `"${r.title}"`,
            r.amount.toString(),
            r.currency,
            r.category,
            r.dueDate.toISOString().split('T')[0],
            r.status,
            `"${r.description || ''}"`
          ].join(','))
        ];
        
        return csvRows.join('\n');
      } else {
        // Return as JSON
        return JSON.stringify(reminders, null, 2);
      }
    } catch (error) {
      console.log('Error exporting reminders:', error);
      throw error;
    }
  }
}