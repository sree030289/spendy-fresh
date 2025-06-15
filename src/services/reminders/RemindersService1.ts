// src/services/reminders/RemindersService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Reminder, ReminderCategory, ReminderStatus, RecurringType } from '@/types/reminder';
import { RealNotificationService } from '../notifications/RealNotificationService';

// Storage keys
const STORAGE_KEYS = {
  REMINDERS: '@spendy_reminders',
  EMAIL_CONNECTION: '@spendy_email_connection',
  NOTIFICATION_SETTINGS: '@spendy_notification_settings',
  LAST_SYNC: '@spendy_last_sync',
  AUTO_SYNC_ENABLED: '@spendy_auto_sync_enabled',
};

// Utility function to safely extract error messages
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
};

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
        const updatedReminders = await this.updateReminderStatuses(reminders);
        return updatedReminders;
      }
    } catch (error) {
      console.log('Firebase getReminders failed, using local storage:', error);
    }
    
    // Fallback to local storage
    return this.getLocalReminders(userId);
  }
  
  // Get reminders from local storage
  private static async getLocalReminders(userId: string): Promise<Reminder[]> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.REMINDERS}_${userId}`);
      if (stored) {
        const reminders = JSON.parse(stored);
        // Convert date strings back to Date objects
        return reminders.map((reminder: any) => ({
          ...reminder,
          dueDate: new Date(reminder.dueDate),
          createdAt: new Date(reminder.createdAt),
          updatedAt: new Date(reminder.updatedAt),
          paidDate: reminder.paidDate ? new Date(reminder.paidDate) : undefined,
          nextDueDate: reminder.nextDueDate ? new Date(reminder.nextDueDate) : undefined,
        }));
      }
      
      // Initialize with demo data for new users
      const demoReminders = this.getDemoReminders(userId);
      await this.storeLocalReminders(userId, demoReminders);
      return demoReminders;
    } catch (error) {
      console.error('Failed to get local reminders:', error);
      return this.getDemoReminders(userId);
    }
  }
  
  // Store reminders in local storage
  private static async storeLocalReminders(userId: string, reminders: Reminder[]): Promise<void> {
    try {
      await AsyncStorage.setItem(`${STORAGE_KEYS.REMINDERS}_${userId}`, JSON.stringify(reminders));
    } catch (error) {
      console.error('Failed to store local reminders:', error);
    }
  }
  
  // Update reminder statuses based on due dates
  private static async updateReminderStatuses(reminders: Reminder[]): Promise<Reminder[]> {
    const now = new Date();
    let hasChanges = false;
    
    const updatedReminders = reminders.map(reminder => {
      const newStatus = this.calculateReminderStatus(reminder, now);
      
      if (newStatus !== reminder.status) {
        hasChanges = true;
        return { ...reminder, status: newStatus, updatedAt: new Date() };
      }
      
      return reminder;
    });
    
    // If statuses changed, save to storage
    if (hasChanges && updatedReminders.length > 0) {
      const userId = updatedReminders[0].userId;
      await this.storeLocalReminders(userId, updatedReminders);
    }
    
    return updatedReminders;
  }
  
  // Calculate reminder status based on due date
  private static calculateReminderStatus(reminder: Reminder, now: Date = new Date()): ReminderStatus {
    if (reminder.status === 'paid') return 'paid';
    
    const dueDate = new Date(reminder.dueDate);
    
    if (dueDate < now) {
      return 'overdue';
    } else {
      return 'upcoming';
    }
  }
  
  // Get demo reminders for new users
  private static getDemoReminders(userId: string): Reminder[] {
    const now = new Date();
    
    return [
      {
        id: 'demo-1',
        userId,
        title: 'Netflix Subscription',
        description: 'Monthly Netflix Premium subscription',
        amount: 15.99,
        currency: 'USD',
        category: 'entertainment',
        dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        status: 'upcoming',
        isRecurring: true,
        recurringType: 'monthly',
        reminderDays: [1, 3],
        notificationEnabled: true,
        autoDetected: true,
        emailSource: 'netflix@netflix.com',
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        id: 'demo-2',
        userId,
        title: 'Electricity Bill',
        description: 'Monthly electricity bill from City Power',
        amount: 127.45,
        currency: 'USD',
        category: 'utilities',
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: 'upcoming',
        isRecurring: true,
        recurringType: 'monthly',
        reminderDays: [3, 7],
        notificationEnabled: true,
        autoDetected: true,
        emailSource: 'billing@citypower.com',
        createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        id: 'demo-3',
        userId,
        title: 'Credit Card Payment',
        description: 'Visa credit card minimum payment',
        amount: 450.00,
        currency: 'USD',
        category: 'finance',
        dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        status: 'overdue',
        isRecurring: true,
        recurringType: 'monthly',
        reminderDays: [1, 3, 7],
        notificationEnabled: true,
        autoDetected: true,
        emailSource: 'statements@visa.com',
        createdAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        id: 'demo-4',
        userId,
        title: 'Internet Bill',
        description: 'Monthly internet service from TechCorp',
        amount: 89.99,
        currency: 'USD',
        category: 'utilities',
        dueDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        status: 'overdue',
        isRecurring: true,
        recurringType: 'monthly',
        reminderDays: [1, 3],
        notificationEnabled: true,
        autoDetected: true,
        emailSource: 'billing@techcorp.com',
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      },
      {
        id: 'demo-5',
        userId,
        title: 'Spotify Premium',
        description: 'Monthly Spotify Premium subscription',
        amount: 9.99,
        currency: 'USD',
        category: 'entertainment',
        dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        status: 'paid',
        isRecurring: true,
        recurringType: 'monthly',
        reminderDays: [1, 3],
        notificationEnabled: true,
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
      const now = new Date();
      const newReminder: Reminder = {
        id: this.generateId(),
        userId,
        ...reminderData,
        status: this.calculateReminderStatus({ ...reminderData } as Reminder, now),
        createdAt: now,
        updatedAt: now,
      };

      // Try Firebase first
      const db = await initializeFirebase();
      if (db && !userId.startsWith('mock-')) {
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        
        const docRef = await addDoc(collection(db, 'reminders'), {
          ...reminderData,
          userId,
          status: newReminder.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        newReminder.id = docRef.id;
      }

      // Store locally as backup
      const existingReminders = await this.getLocalReminders(userId);
      const updatedReminders = [...existingReminders, newReminder];
      await this.storeLocalReminders(userId, updatedReminders);

      // Schedule notifications for the new reminder with comprehensive error handling
      if (newReminder.notificationEnabled && newReminder.status !== 'paid') {
        try {
          console.log('📅 Scheduling notifications for new reminder:', newReminder.title);
          await RealNotificationService.scheduleReminderNotification(newReminder, userId);
          console.log('✅ Notifications successfully scheduled for reminder:', newReminder.title);
        } catch (notificationError) {
          console.warn('⚠️ Failed to schedule notifications for reminder (non-critical):', {
            reminderId: newReminder.id,
            title: newReminder.title,
            error: notificationError instanceof Error ? notificationError.message : String(notificationError)
          });
          // Don't throw - notification failure shouldn't prevent reminder creation
        }
      } else {
        console.log('📵 Skipping notification scheduling:', {
          enabled: newReminder.notificationEnabled,
          status: newReminder.status,
          title: newReminder.title
        });
      }

      console.log('✅ Successfully created reminder:', {
        id: newReminder.id,
        title: newReminder.title,
        amount: newReminder.amount,
        dueDate: newReminder.dueDate.toISOString(),
        status: newReminder.status
      });

      return newReminder.id;
    } catch (error) {
      console.error('❌ Failed to create reminder:', {
        userId,
        title: reminderData.title,
        error: getErrorMessage(error)
      });
      throw new Error(`Failed to create reminder: ${getErrorMessage(error)}`);
    }
  }
  
  // Update a reminder
  static async updateReminder(reminderId: string, updates: Partial<Reminder>): Promise<void> {
    try {
      const updatedData = {
        ...updates,
        updatedAt: new Date(),
      };

      // Try Firebase first
      const db = await initializeFirebase();
      if (db) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        
        await updateDoc(doc(db, 'reminders', reminderId), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
      }

      // Update locally
      const userId = await this.getUserIdFromReminder(reminderId);
      if (userId) {
        const existingReminders = await this.getLocalReminders(userId);
        const updatedReminders = existingReminders.map(reminder =>
          reminder.id === reminderId
            ? { ...reminder, ...updatedData }
            : reminder
        );
        await this.storeLocalReminders(userId, updatedReminders);

        // Update notifications if reminder settings changed
        const updatedReminder = updatedReminders.find(r => r.id === reminderId);
        if (updatedReminder && (updates.notificationEnabled !== undefined || updates.reminderDays || updates.dueDate)) {
          try {
            console.log('🔄 Updating notifications for reminder:', updatedReminder.title);
            
            // Cancel existing notifications first
            await RealNotificationService.cancelReminderNotifications(reminderId, userId);
            console.log('✅ Cancelled existing notifications for reminder:', reminderId);
            
            // Schedule new notifications if enabled and not paid
            if (updatedReminder.notificationEnabled && updatedReminder.status !== 'paid') {
              await RealNotificationService.scheduleReminderNotification(updatedReminder, userId);
              console.log('✅ Rescheduled notifications for updated reminder:', updatedReminder.title);
            } else {
              console.log('📵 Notifications disabled or reminder is paid, skipping scheduling');
            }
          } catch (notificationError) {
            console.warn('⚠️ Failed to update notifications for reminder (non-critical):', {
              reminderId,
              title: updatedReminder.title,
              error: getErrorMessage(notificationError)
            });
            // Don't throw - notification failure shouldn't prevent reminder update
          }
        }
      }

      console.log('✅ Successfully updated reminder:', {
        id: reminderId,
        updates: Object.keys(updates),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to update reminder:', {
        reminderId,
        updates: Object.keys(updates),
        error: getErrorMessage(error)
      });
      throw new Error(`Failed to update reminder: ${getErrorMessage(error)}`);
    }
  }
  
  // Mark reminder as paid
  static async markAsPaid(reminderId: string): Promise<void> {
    try {
      const now = new Date();
      const updates: Partial<Reminder> = {
        status: 'paid',
        paidDate: now,
        updatedAt: now,
      };

      // Try Firebase first
      const db = await initializeFirebase();
      if (db) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        
        await updateDoc(doc(db, 'reminders', reminderId), {
          status: 'paid',
          paidDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Update locally
      const userId = await this.getUserIdFromReminder(reminderId);
      if (userId) {
        const existingReminders = await this.getLocalReminders(userId);
        const reminderToUpdate = existingReminders.find(r => r.id === reminderId);
        
        if (reminderToUpdate) {
          const updatedReminders = existingReminders.map(reminder =>
            reminder.id === reminderId
              ? { ...reminder, ...updates }
              : reminder
          );
          await this.storeLocalReminders(userId, updatedReminders);

          // Cancel pending notifications
          try {
            console.log('🔕 Cancelling notifications for paid reminder:', reminderToUpdate.title);
            await RealNotificationService.cancelReminderNotifications(reminderId, userId);
            console.log('✅ Successfully cancelled notifications for paid reminder');
          } catch (notificationError) {
            console.warn('⚠️ Failed to cancel notifications for paid reminder (non-critical):', {
              reminderId,
              title: reminderToUpdate.title,
              error: getErrorMessage(notificationError)
            });
          }

          // Send payment confirmation notification
          try {
            console.log('📧 Sending payment confirmation notification');
            await RealNotificationService.sendImmediateNotification(
              '✅ Payment Confirmed',
              `${reminderToUpdate.title} payment of ${reminderToUpdate.currency} ${reminderToUpdate.amount.toFixed(2)} has been recorded`,
              {
                reminderId,
                type: 'payment_confirmation',
                amount: reminderToUpdate.amount,
                currency: reminderToUpdate.currency,
                title: reminderToUpdate.title,
                paidDate: now.toISOString(),
              }
            );
            console.log('✅ Payment confirmation notification sent successfully');
          } catch (notificationError) {
            console.warn('⚠️ Failed to send payment confirmation notification (non-critical):', {
              reminderId,
              title: reminderToUpdate.title,
              error: getErrorMessage(notificationError)
            });
          }

          // Create next recurring reminder if applicable
          if (reminderToUpdate.isRecurring && reminderToUpdate.recurringType) {
            try {
              console.log('🔄 Creating next recurring reminder for:', reminderToUpdate.title);
              await this.createNextRecurringReminder(userId, reminderToUpdate);
              console.log('✅ Next recurring reminder created successfully');
            } catch (recurringError) {
              console.warn('⚠️ Failed to create next recurring reminder (non-critical):', {
                reminderId,
                title: reminderToUpdate.title,
                error: getErrorMessage(recurringError)
              });
            }
          }
        }
      }

      console.log('✅ Successfully marked reminder as paid:', {
        id: reminderId,
        paidDate: now.toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to mark reminder as paid:', {
        reminderId,
        error: getErrorMessage(error)
      });
      throw new Error(`Failed to mark reminder as paid: ${getErrorMessage(error)}`);
    }
  }
  
  // Delete a reminder
  static async deleteReminder(reminderId: string): Promise<void> {
    try {
      // Try Firebase first
      const db = await initializeFirebase();
      if (db) {
        const { doc, deleteDoc } = await import('firebase/firestore');
        
        await deleteDoc(doc(db, 'reminders', reminderId));
      }

      // Delete locally
      const userId = await this.getUserIdFromReminder(reminderId);
      if (userId) {
        const existingReminders = await this.getLocalReminders(userId);
        const reminderToDelete = existingReminders.find(r => r.id === reminderId);
        const updatedReminders = existingReminders.filter(reminder => reminder.id !== reminderId);
        await this.storeLocalReminders(userId, updatedReminders);

        // Cancel notifications
        try {
          console.log('🔕 Cancelling notifications for deleted reminder:', reminderToDelete?.title || reminderId);
          await RealNotificationService.cancelReminderNotifications(reminderId, userId);
          console.log('✅ Successfully cancelled notifications for deleted reminder');
        } catch (notificationError) {
          console.warn('⚠️ Failed to cancel notifications for deleted reminder (non-critical):', {
            reminderId,
            title: reminderToDelete?.title,
            error: getErrorMessage(notificationError)
          });
        }
      }

      console.log('✅ Successfully deleted reminder:', {
        id: reminderId,
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to delete reminder:', {
        reminderId,
        error: getErrorMessage(error)
      });
      throw new Error(`Failed to delete reminder: ${getErrorMessage(error)}`);
    }
  }
  
  // Check if email is connected
  static async isEmailConnected(userId: string): Promise<boolean> {
    try {
      const connected = await AsyncStorage.getItem(`${STORAGE_KEYS.EMAIL_CONNECTION}_${userId}`);
      return connected === 'true';
    } catch (error) {
      console.error('❌ Failed to check email connection:', error);
      return false;
    }
  }
  
  // Connect email for auto-detection
  static async connectEmail(userId: string, provider: 'gmail' | 'outlook'): Promise<void> {
    try {
      if (provider === 'gmail') {
        // For demo purposes, just set as connected
        await AsyncStorage.setItem(`${STORAGE_KEYS.EMAIL_CONNECTION}_${userId}`, 'true');
      } else {
        throw new Error('Only Gmail is currently supported');
      }

      // Enable auto-sync
      await AsyncStorage.setItem(`${STORAGE_KEYS.AUTO_SYNC_ENABLED}_${userId}`, 'true');
      
      console.log(`✅ Connected ${provider} for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to connect email:', error);
      throw error;
    }
  }
  
  // Disconnect email
  static async disconnectEmail(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${STORAGE_KEYS.EMAIL_CONNECTION}_${userId}`);
      await AsyncStorage.removeItem(`${STORAGE_KEYS.AUTO_SYNC_ENABLED}_${userId}`);
      
      console.log(`✅ Disconnected email for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to disconnect email:', error);
      throw error;
    }
  }
  
  // Sync bills from email
  static async syncEmailBills(userId: string): Promise<Reminder[]> {
    try {
      console.log('📧 Starting email bill sync for user:', userId);

      const isConnected = await this.isEmailConnected(userId);
      if (!isConnected) {
        throw new Error('Email not connected. Please connect your email first.');
      }

      // For demo purposes, create some realistic mock synced bills
      const now = new Date();
      const mockSyncedBills = [
        {
          title: 'Adobe Creative Cloud',
          description: 'Monthly subscription for Adobe Creative Suite',
          amount: 52.99,
          currency: 'USD',
          category: 'subscription' as ReminderCategory,
          dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
          status: 'upcoming' as ReminderStatus,
          isRecurring: true,
          recurringType: 'monthly' as RecurringType,
          reminderDays: [1, 3],
          notificationEnabled: true,
          autoDetected: true,
          emailSource: 'billing@adobe.com',
        },
        {
          title: 'Verizon Wireless',
          description: 'Monthly wireless service plan',
          amount: 89.99,
          currency: 'USD',
          category: 'utilities' as ReminderCategory,
          dueDate: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
          status: 'upcoming' as ReminderStatus,
          isRecurring: true,
          recurringType: 'monthly' as RecurringType,
          reminderDays: [3, 7],
          notificationEnabled: true,
          autoDetected: true,
          emailSource: 'billing@verizon.com',
        },
        {
          title: 'AWS Cloud Services',
          description: 'Monthly cloud hosting and compute services',
          amount: 125.50,
          currency: 'USD',
          category: 'subscription' as ReminderCategory,
          dueDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
          status: 'upcoming' as ReminderStatus,
          isRecurring: true,
          recurringType: 'monthly' as RecurringType,
          reminderDays: [1, 3, 7],
          notificationEnabled: true,
          autoDetected: true,
          emailSource: 'aws-billing@amazon.com',
        },
        {
          title: 'Microsoft 365 Business',
          description: 'Business subscription for Office suite and cloud services',
          amount: 22.00,
          currency: 'USD',
          category: 'subscription' as ReminderCategory,
          dueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
          status: 'upcoming' as ReminderStatus,
          isRecurring: true,
          recurringType: 'monthly' as RecurringType,
          reminderDays: [1, 3],
          notificationEnabled: true,
          autoDetected: true,
          emailSource: 'noreply@microsoft.com',
        }
      ];

      // Get existing reminders to check for duplicates
      const existingReminders = await this.getReminders(userId);
      
      // Filter out duplicates based on title and email source
      const uniqueBills = mockSyncedBills.filter(newBill => {
        const isDuplicate = existingReminders.some(existing => 
          existing.title.toLowerCase().includes(newBill.title.toLowerCase()) ||
          existing.emailSource === newBill.emailSource
        );
        return !isDuplicate;
      });

      console.log(`📧 Found ${uniqueBills.length} new bills to import out of ${mockSyncedBills.length} detected`);

      // Create the new reminders
      const createdReminders: Reminder[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (const bill of uniqueBills) {
        try {
          console.log(`📝 Creating reminder for: ${bill.title}`);
          const id = await this.createReminder(userId, bill);
          createdReminders.push({
            ...bill,
            id,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          successCount++;
          console.log(`✅ Successfully imported bill: ${bill.title} (${bill.currency} ${bill.amount})`);
        } catch (createError) {
          failureCount++;
          console.warn(`⚠️ Failed to create reminder from email for ${bill.title}:`, getErrorMessage(createError));
        }
      }

      // Update last sync time
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.LAST_SYNC}_${userId}`,
        new Date().toISOString()
      );

      console.log(`✅ Email sync completed successfully:`, {
        totalDetected: mockSyncedBills.length,
        newBills: uniqueBills.length,
        imported: successCount,
        failed: failureCount,
        syncTime: new Date().toISOString()
      });

      return createdReminders;
      
    } catch (error) {
      console.error('❌ Email sync failed:', {
        userId,
        error: getErrorMessage(error),
        timestamp: new Date().toISOString()
      });
      throw new Error(`Email sync failed: ${getErrorMessage(error)}`);
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
    avgAmount: number;
    categoryBreakdown: Array<{ category: ReminderCategory; count: number; amount: number }>;
    monthlyTrend: Array<{ month: string; count: number; amount: number }>;
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
        avgAmount: 0,
        categoryBreakdown: [] as Array<{ category: ReminderCategory; count: number; amount: number }>,
        monthlyTrend: [] as Array<{ month: string; count: number; amount: number }>,
      };
      
      const categoryMap = new Map<ReminderCategory, { count: number; amount: number }>();
      const monthlyMap = new Map<string, { count: number; amount: number }>();
      
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

        // Monthly trend
        const monthKey = new Date(reminder.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const monthlyExisting = monthlyMap.get(monthKey) || { count: 0, amount: 0 };
        monthlyMap.set(monthKey, {
          count: monthlyExisting.count + 1,
          amount: monthlyExisting.amount + reminder.amount,
        });
      }
      
      // Calculate average
      stats.avgAmount = allReminders.length > 0 ? stats.totalAmount / allReminders.length : 0;
      
      // Convert maps to arrays
      stats.categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        ...data,
      }));

      stats.monthlyTrend = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        ...data,
      }));
      
      return stats;
    } catch (error) {
      console.error('❌ Failed to get reminder stats:', error);
      return {
        total: 0,
        upcoming: 0,
        overdue: 0,
        paid: 0,
        totalAmount: 0,
        overdueAmount: 0,
        avgAmount: 0,
        categoryBreakdown: [],
        monthlyTrend: [],
      };
    }
  }

  // Export reminders data
  static async exportReminders(userId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const reminders = await this.getReminders(userId);
      
      if (format === 'csv') {
        const headers = ['Title', 'Amount', 'Currency', 'Category', 'Due Date', 'Status', 'Description', 'Recurring', 'Created'];
        const csvRows = [
          headers.join(','),
          ...reminders.map(r => [
            `"${r.title}"`,
            r.amount.toString(),
            r.currency,
            r.category,
            r.dueDate.toISOString().split('T')[0],
            r.status,
            `"${r.description || ''}"`,
            r.isRecurring ? 'Yes' : 'No',
            r.createdAt.toISOString().split('T')[0]
          ].join(','))
        ];
        
        return csvRows.join('\n');
      } else {
        return JSON.stringify(reminders, null, 2);
      }
    } catch (error) {
      console.error('❌ Failed to export reminders:', error);
      throw error;
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
        reminder.category.toLowerCase().includes(lowercaseQuery) ||
        reminder.notes?.toLowerCase().includes(lowercaseQuery)
      );
    } catch (error) {
      console.error('❌ Failed to search reminders:', error);
      return [];
    }
  }

  // Import reminders data
  static async importReminders(userId: string, data: string, format: 'json' | 'csv' = 'json'): Promise<{
    imported: number;
    skipped: number;
    errors: number;
  }> {
    try {
      let remindersToImport: any[] = [];
      
      if (format === 'json') {
        remindersToImport = JSON.parse(data);
      } else {
        // Parse CSV
        const lines = data.split('\n');
        const headers = lines[0].split(',');
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const reminder: any = {};
          
          headers.forEach((header, index) => {
            reminder[header.toLowerCase().replace(/[^a-z0-9]/g, '')] = values[index]?.replace(/"/g, '');
          });
          
          remindersToImport.push(reminder);
        }
      }

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (const reminderData of remindersToImport) {
        try {
          // Validate required fields
          if (!reminderData.title || !reminderData.amount) {
            errors++;
            continue;
          }

          // Check for duplicates
          const existing = await this.searchReminders(userId, reminderData.title);
          if (existing.length > 0) {
            skipped++;
            continue;
          }

          // Create reminder
          const newReminder: Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
            title: reminderData.title,
            description: reminderData.description || '',
            amount: parseFloat(reminderData.amount),
            currency: reminderData.currency || 'USD',
            category: reminderData.category || 'other',
            dueDate: new Date(reminderData.dueDate || Date.now()),
            status: reminderData.status || 'upcoming',
            isRecurring: reminderData.isRecurring === 'Yes' || reminderData.isRecurring === true,
            recurringType: reminderData.recurringType || 'monthly',
            reminderDays: [1, 3],
            notificationEnabled: true,
            autoDetected: false,
          };

          await this.createReminder(userId, newReminder);
          imported++;
        } catch (createError) {
          console.warn('Failed to import reminder:', createError);
          errors++;
        }
      }

      return { imported, skipped, errors };
    } catch (error) {
      console.error('❌ Failed to import reminders:', error);
      throw error;
    }
  }

  // Auto-sync if enabled and needed
  static async autoSyncIfNeeded(userId: string): Promise<void> {
    try {
      const autoSyncEnabled = await AsyncStorage.getItem(`${STORAGE_KEYS.AUTO_SYNC_ENABLED}_${userId}`);
      if (autoSyncEnabled !== 'true') {
        return;
      }

      const lastSyncStr = await AsyncStorage.getItem(`${STORAGE_KEYS.LAST_SYNC}_${userId}`);
      const lastSync = lastSyncStr ? new Date(lastSyncStr) : new Date(0);
      const now = new Date();
      const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

      // Auto-sync every 6 hours
      if (hoursSinceLastSync >= 6) {
        await this.syncEmailBills(userId);
      }
    } catch (error) {
      console.log('Auto-sync failed (non-critical):', error);
    }
  }
  
  // Get reminders due soon (for notifications)
  static async getRemindersDueSoon(userId: string, days: number = 7): Promise<Reminder[]> {
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
      console.error('❌ Failed to get reminders due soon:', error);
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
      console.error('❌ Failed to get overdue reminders:', error);
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
        break;
    }
    
    return nextDate;
  }
  
  // Create next recurring reminder
  private static async createNextRecurringReminder(userId: string, paidReminder: Reminder): Promise<void> {
    try {
      if (!paidReminder.isRecurring || !paidReminder.recurringType) {
        return;
      }

      const nextDueDate = this.calculateNextDueDate(paidReminder.dueDate, paidReminder.recurringType);
      
      // Only create if next due date is in the future
      const now = new Date();
      if (nextDueDate <= now) {
        return;
      }

      const nextReminder: Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        title: paidReminder.title,
        description: paidReminder.description,
        amount: paidReminder.amount,
        currency: paidReminder.currency,
        category: paidReminder.category,
        dueDate: nextDueDate,
        status: 'upcoming',
        isRecurring: paidReminder.isRecurring,
        recurringType: paidReminder.recurringType,
        reminderDays: paidReminder.reminderDays,
        notificationEnabled: paidReminder.notificationEnabled,
        autoDetected: false, // Mark as system-generated
        notes: paidReminder.notes,
      };

      await this.createReminder(userId, nextReminder);
      console.log(`✅ Created next recurring reminder for ${paidReminder.title}`);
    } catch (error) {
      console.error('❌ Failed to create next recurring reminder:', error);
    }
  }

  // Process all recurring reminders (called periodically)
  static async processRecurringReminders(userId: string): Promise<void> {
    try {
      const allReminders = await this.getReminders(userId);
      const now = new Date();
      
      for (const reminder of allReminders) {
        if (reminder.isRecurring && reminder.status === 'paid' && reminder.recurringType) {
          // Check if we need to create the next occurrence
          const nextDueDate = this.calculateNextDueDate(reminder.dueDate, reminder.recurringType);
          
          // Create next reminder if it doesn't exist and is due within next 3 months
          const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          if (nextDueDate <= threeMonthsFromNow) {
            const existingNext = allReminders.find(r => 
              r.title === reminder.title &&
              r.status === 'upcoming' &&
              Math.abs(new Date(r.dueDate).getTime() - nextDueDate.getTime()) < 24 * 60 * 60 * 1000
            );

            if (!existingNext) {
              await this.createNextRecurringReminder(userId, reminder);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to process recurring reminders:', error);
    }
  }

  // Background sync
  static async backgroundSync(): Promise<void> {
    try {
      console.log('🔄 Running background sync...');
      
      // Get all users (in production, this would come from your user service)
      const userIds = ['mock-123']; // Demo user
      
      for (const userId of userIds) {
        try {
          // Auto-sync emails if enabled
          await this.autoSyncIfNeeded(userId);
          
          // Process recurring reminders
          await this.processRecurringReminders(userId);
          
          // Update reminder statuses
          const reminders = await this.getReminders(userId);
          await this.updateReminderStatuses(reminders);
          
        } catch (userError) {
          console.warn(`Background sync failed for user ${userId}:`, userError);
        }
      }
      
      console.log('✅ Background sync completed');
    } catch (error) {
      console.error('❌ Background sync failed:', error);
    }
  }

  // Get sync status
  static async getSyncStatus(userId: string): Promise<{
    lastSync: Date | null;
    autoSyncEnabled: boolean;
    emailConnected: boolean;
    pendingSync: boolean;
  }> {
    try {
      const lastSyncStr = await AsyncStorage.getItem(`${STORAGE_KEYS.LAST_SYNC}_${userId}`);
      const lastSync = lastSyncStr ? new Date(lastSyncStr) : null;
      
      const autoSyncEnabledStr = await AsyncStorage.getItem(`${STORAGE_KEYS.AUTO_SYNC_ENABLED}_${userId}`);
      const autoSyncEnabled = autoSyncEnabledStr === 'true';
      
      const emailConnected = await this.isEmailConnected(userId);
      
      // Check if sync is needed (more than 6 hours since last sync)
      const pendingSync = emailConnected && lastSync && 
        (new Date().getTime() - lastSync.getTime()) / (1000 * 60 * 60) >= 6;

      return {
        lastSync,
        autoSyncEnabled,
        emailConnected,
        pendingSync: Boolean(pendingSync),
      };
    } catch (error) {
      console.error('❌ Failed to get sync status:', error);
      return {
        lastSync: null,
        autoSyncEnabled: false,
        emailConnected: false,
        pendingSync: false,
      };
    }
  }

  // Utility methods
  private static generateId(): string {
    return 'reminder-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  }

  private static async getUserIdFromReminder(reminderId: string): Promise<string | null> {
    try {
      // For demo purposes, assume mock user
      return 'mock-123';
    } catch (error) {
      console.error('❌ Failed to get user ID from reminder:', error);
      return null;
    }
  }
}