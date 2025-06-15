// src/services/reminders/RemindersService.ts
import { Platform } from 'react-native';
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
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { AIService } from '../ai/AIService';

export interface SmartReminder {
  id: string;
  userId: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate: Date;
  category: string;
  categoryIcon: string;
  status: 'upcoming' | 'overdue' | 'paid' | 'snoozed';
  priority: 'low' | 'medium' | 'high';
  
  // Smart features
  aiPredicted: boolean;
  autoPayEnabled: boolean;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  
  // Notification settings
  notificationEnabled: boolean;
  reminderDays: number[]; // Days before due date to remind
  reminderTimes: string[]; // Times of day to remind (HH:mm format)
  
  // Payment tracking
  lastPaidDate?: Date;
  lastPaidAmount?: number;
  paymentMethod?: string;
  
  // Smart insights
  averageAmount?: number;
  lastAmounts?: number[];
  predictedAmount?: number;
  paymentHistory?: PaymentHistory[];
  
  // Metadata
  autoDetected: boolean;
  confidence?: number;
  linkedTransactionId?: string;
  externalBillId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringPattern {
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number; // Every X frequency units
  dayOfWeek?: number; // For weekly (0-6)
  dayOfMonth?: number; // For monthly (1-31)
  monthOfYear?: number; // For yearly (1-12)
  endDate?: Date;
}

export interface PaymentHistory {
  date: Date;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  wasOnTime: boolean;
  daysLate?: number;
}

export interface ReminderNotification {
  id: string;
  reminderId: string;
  scheduledFor: Date;
  type: 'first_reminder' | 'urgent_reminder' | 'overdue_reminder';
  sent: boolean;
  sentAt?: Date;
}

export class RemindersService {

  // REMINDER MANAGEMENT
  static async getReminders(userId: string, includeCompleted: boolean = false): Promise<SmartReminder[]> {
    try {
      let remindersQuery = query(
        collection(db, 'reminders'),
        where('userId', '==', userId),
        orderBy('dueDate', 'asc')
      );

      if (!includeCompleted) {
        remindersQuery = query(
          collection(db, 'reminders'),
          where('userId', '==', userId),
          where('status', 'in', ['upcoming', 'overdue', 'snoozed']),
          orderBy('dueDate', 'asc')
        );
      }

      const snapshot = await getDocs(remindersQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.toDate() || new Date(),
          lastPaidDate: data.lastPaidDate?.toDate(),
          recurringPattern: data.recurringPattern ? {
            ...data.recurringPattern,
            endDate: data.recurringPattern.endDate?.toDate()
          } : undefined,
          paymentHistory: data.paymentHistory?.map((payment: any) => ({
            ...payment,
            date: payment.date?.toDate() || new Date()
          })) || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as SmartReminder[];
    } catch (error) {
      console.error('Get reminders error:', error);
      return [];
    }
  }

  static async createReminder(userId: string, reminderData: Omit<SmartReminder, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Auto-categorize if not provided
      if (!reminderData.category || !reminderData.categoryIcon) {
        const category = await AIService.categorizeExpense(reminderData.title);
        reminderData.category = category.category;
        reminderData.categoryIcon = category.icon;
      }

      // Predict amount if recurring and no amount specified
      if (reminderData.isRecurring && reminderData.amount === 0) {
        const predictedAmount = await this.predictReminderAmount(userId, reminderData.title, reminderData.category);
        if (predictedAmount > 0) {
          reminderData.predictedAmount = predictedAmount;
          reminderData.amount = predictedAmount;
        }
      }

      const newReminder: Omit<SmartReminder, 'id'> = {
        ...reminderData,
        userId,
        status: 'upcoming',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'reminders'), {
        ...newReminder,
        dueDate: Timestamp.fromDate(newReminder.dueDate),
        lastPaidDate: newReminder.lastPaidDate ? Timestamp.fromDate(newReminder.lastPaidDate) : null,
        recurringPattern: newReminder.recurringPattern ? {
          ...newReminder.recurringPattern,
          endDate: newReminder.recurringPattern.endDate ? Timestamp.fromDate(newReminder.recurringPattern.endDate) : null
        } : null,
        paymentHistory: newReminder.paymentHistory?.map(payment => ({
          ...payment,
          date: Timestamp.fromDate(payment.date)
        })) || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Schedule notifications
      if (reminderData.notificationEnabled) {
        const completeReminder: SmartReminder = {
          ...newReminder,
          id: docRef.id
        };
        await this.scheduleReminderNotifications(docRef.id, completeReminder);
      }

      return docRef.id;
    } catch (error) {
      console.error('Create reminder error:', error);
      throw error;
    }
  }

  static async updateReminder(reminderId: string, updates: Partial<SmartReminder>): Promise<void> {
    try {
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      // Handle date conversions
      if (updates.dueDate) {
        updateData.dueDate = Timestamp.fromDate(updates.dueDate);
      }
      if (updates.lastPaidDate) {
        updateData.lastPaidDate = Timestamp.fromDate(updates.lastPaidDate);
      }
      if (updates.recurringPattern?.endDate) {
        updateData.recurringPattern = {
          ...updates.recurringPattern,
          endDate: Timestamp.fromDate(updates.recurringPattern.endDate)
        };
      }
      if (updates.paymentHistory) {
        updateData.paymentHistory = updates.paymentHistory.map(payment => ({
          ...payment,
          date: Timestamp.fromDate(payment.date)
        }));
      }

      await updateDoc(doc(db, 'reminders', reminderId), updateData);

      // Reschedule notifications if notification settings changed
      if (updates.notificationEnabled !== undefined || updates.reminderDays || updates.reminderTimes || updates.dueDate) {
        const reminderDoc = await getDoc(doc(db, 'reminders', reminderId));
        if (reminderDoc.exists()) {
          const reminderData = reminderDoc.data() as SmartReminder;
          await this.cancelReminderNotifications(reminderId);
          if (reminderData.notificationEnabled) {
            await this.scheduleReminderNotifications(reminderId, reminderData);
          }
        }
      }
    } catch (error) {
      console.error('Update reminder error:', error);
      throw error;
    }
  }

  static async deleteReminder(reminderId: string): Promise<void> {
    try {
      // Cancel all scheduled notifications
      await this.cancelReminderNotifications(reminderId);
      
      // Delete the reminder
      await deleteDoc(doc(db, 'reminders', reminderId));
    } catch (error) {
      console.error('Delete reminder error:', error);
      throw error;
    }
  }

  static async markAsPaid(reminderId: string, paymentAmount?: number, paymentMethod?: string): Promise<void> {
    try {
      const reminderDoc = await getDoc(doc(db, 'reminders', reminderId));
      if (!reminderDoc.exists()) {
        throw new Error('Reminder not found');
      }

      const reminder = reminderDoc.data() as SmartReminder;
      const now = new Date();
      const wasOnTime = now <= reminder.dueDate;
      const daysLate = wasOnTime ? 0 : Math.ceil((now.getTime() - reminder.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Create payment history entry
      const paymentEntry: PaymentHistory = {
        date: now,
        amount: paymentAmount || reminder.amount,
        paymentMethod: paymentMethod || 'unknown',
        wasOnTime,
        daysLate: daysLate > 0 ? daysLate : undefined
      };

      const updates: Partial<SmartReminder> = {
        status: 'paid',
        lastPaidDate: now,
        lastPaidAmount: paymentAmount || reminder.amount,
        paymentMethod,
        paymentHistory: [...(reminder.paymentHistory || []), paymentEntry],
        updatedAt: now
      };

      // Update average amount for future predictions
      const allAmounts = [...(reminder.lastAmounts || []), paymentAmount || reminder.amount];
      updates.lastAmounts = allAmounts.slice(-5); // Keep last 5 payments
      updates.averageAmount = allAmounts.reduce((sum, amount) => sum + amount, 0) / allAmounts.length;

      await this.updateReminder(reminderId, updates);

      // Cancel notifications
      await this.cancelReminderNotifications(reminderId);

      // Schedule next occurrence if recurring
      if (reminder.isRecurring && reminder.recurringPattern) {
        await this.createNextRecurringReminder(reminder);
      }
    } catch (error) {
      console.error('Mark as paid error:', error);
      throw error;
    }
  }

  static async snoozeReminder(reminderId: string, snoozeUntil: Date): Promise<void> {
    try {
      await this.updateReminder(reminderId, {
        status: 'snoozed',
        dueDate: snoozeUntil
      });
    } catch (error) {
      console.error('Snooze reminder error:', error);
      throw error;
    }
  }

  // AI-POWERED FEATURES
  static async detectUpcomingBills(userId: string, transactions: any[]): Promise<SmartReminder[]> {
    try {
      const detectedReminders: SmartReminder[] = [];
      
      // Group transactions by merchant and analyze patterns
      const merchantGroups = new Map<string, any[]>();
      
      transactions.forEach(tx => {
        if (tx.category !== 'Income' && tx.amount > 20) { // Only expenses above $20
          const merchant = tx.merchant.toLowerCase();
          if (!merchantGroups.has(merchant)) {
            merchantGroups.set(merchant, []);
          }
          merchantGroups.get(merchant)!.push(tx);
        }
      });

      for (const [merchant, txs] of merchantGroups.entries()) {
        if (txs.length >= 2) { // Need at least 2 transactions to detect pattern
          const recurringPattern = AIService.detectRecurringPattern(txs);
          
          if (recurringPattern.isRecurring && recurringPattern.confidence > 0.7) {
            const lastTx = txs[txs.length - 1];
            const avgAmount = txs.reduce((sum, tx) => sum + tx.amount, 0) / txs.length;
            
            // Check if we already have a reminder for this
            const existingReminders = await this.getReminders(userId);
            const hasExisting = existingReminders.some(r => 
              r.title.toLowerCase().includes(merchant) || 
              merchant.includes(r.title.toLowerCase())
            );

            if (!hasExisting && recurringPattern.nextExpected) {
              const category = await AIService.categorizeExpense(lastTx.description);
              
              detectedReminders.push({
                id: '', // Will be set when created
                userId,
                title: `${lastTx.merchant} Bill`,
                description: `Auto-detected recurring payment`,
                amount: Math.round(avgAmount * 100) / 100,
                currency: 'AUD',
                dueDate: recurringPattern.nextExpected,
                category: category.category,
                categoryIcon: category.icon,
                status: 'upcoming',
                priority: avgAmount > 200 ? 'high' : avgAmount > 50 ? 'medium' : 'low',
                
                aiPredicted: true,
                autoPayEnabled: false,
                isRecurring: true,
                recurringPattern: {
                  frequency: recurringPattern.frequency!,
                  interval: 1
                },
                
                notificationEnabled: true,
                reminderDays: [3, 1],
                reminderTimes: ['09:00'],
                
                averageAmount: avgAmount,
                lastAmounts: txs.slice(-3).map(tx => tx.amount),
                predictedAmount: avgAmount,
                confidence: recurringPattern.confidence,
                
                autoDetected: true,
                paymentHistory: [],
                
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }
        }
      }

      return detectedReminders;
    } catch (error) {
      console.error('Detect upcoming bills error:', error);
      return [];
    }
  }

  static async predictReminderAmount(userId: string, title: string, category: string): Promise<number> {
    try {
      // Get similar reminders from history
      const allReminders = await this.getReminders(userId, true);
      const similarReminders = allReminders.filter(r => 
        r.category === category || 
        r.title.toLowerCase().includes(title.toLowerCase()) ||
        title.toLowerCase().includes(r.title.toLowerCase())
      );

      if (similarReminders.length === 0) return 0;

      // Calculate average from similar reminders
      const amounts = similarReminders
        .filter(r => r.lastAmounts && r.lastAmounts.length > 0)
        .flatMap(r => r.lastAmounts!);

      if (amounts.length === 0) {
        // Fallback to reminder amounts
        const reminderAmounts = similarReminders.map(r => r.amount).filter(a => a > 0);
        if (reminderAmounts.length > 0) {
          return reminderAmounts.reduce((sum, amount) => sum + amount, 0) / reminderAmounts.length;
        }
        return 0;
      }

      return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    } catch (error) {
      console.error('Predict reminder amount error:', error);
      return 0;
    }
  }

  // NOTIFICATION MANAGEMENT
  static async scheduleReminderNotifications(reminderId: string, reminder: SmartReminder): Promise<void> {
    try {
      await this.createNotificationChannel();
      
      for (const daysBefore of reminder.reminderDays) {
        for (const time of reminder.reminderTimes) {
          const [hour, minute] = time.split(':').map(Number);
          const notificationDate = new Date(reminder.dueDate);
          notificationDate.setDate(notificationDate.getDate() - daysBefore);
          notificationDate.setHours(hour, minute, 0, 0);

          // Only schedule if in the future
          if (notificationDate > new Date()) {
            const notificationId = `reminder_${reminderId}_${daysBefore}_${time}`;
            
            await Notifications.scheduleNotificationAsync({
              identifier: notificationId,
              content: {
                title: 'Bill Reminder',
                body: `${reminder.title} - ${reminder.amount} due ${daysBefore === 0 ? 'today' : `in ${daysBefore} day${daysBefore > 1 ? 's' : ''}`}`,
                data: { 
                  reminderId, 
                  type: 'bill_reminder',
                  daysBefore: daysBefore.toString()
                },
                sound: 'default',
                priority: Notifications.AndroidNotificationPriority.HIGH,
                badge: 1
              },
              trigger: {
                type: SchedulableTriggerInputTypes.DATE,
                date: notificationDate
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Schedule reminder notifications error:', error);
    }
  }

  static async cancelReminderNotifications(reminderId: string): Promise<void> {
    try {
      // Get all scheduled notifications
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      // Cancel notifications for this reminder
      const reminderNotifications = scheduledNotifications.filter(n => 
        n.content.data?.reminderId === reminderId
      );

      for (const notification of reminderNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (error) {
      console.error('Cancel reminder notifications error:', error);
    }
  }

  private static async createNotificationChannel(): Promise<void> {
    // Expo Notifications handles channels automatically
    // On Android, we can set a notification channel if needed
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bill-reminders', {
        name: 'Bill Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  // RECURRING REMINDERS
  private static async createNextRecurringReminder(reminder: SmartReminder): Promise<void> {
    if (!reminder.recurringPattern) return;

    const nextDueDate = this.calculateNextDueDate(reminder.dueDate, reminder.recurringPattern);
    
    // Check if we should continue (end date)
    if (reminder.recurringPattern.endDate && nextDueDate > reminder.recurringPattern.endDate) {
      return;
    }

    // Create next occurrence
    await this.createReminder(reminder.userId, {
      ...reminder,
      dueDate: nextDueDate,
      status: 'upcoming',
      amount: reminder.predictedAmount || reminder.averageAmount || reminder.amount
    });
  }

  private static calculateNextDueDate(currentDueDate: Date, pattern: RecurringPattern): Date {
    const nextDate = new Date(currentDueDate);
    
    switch (pattern.frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * pattern.interval));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + pattern.interval);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + (3 * pattern.interval));
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + pattern.interval);
        break;
    }
    
    return nextDate;
  }

  // BULK OPERATIONS
  static async checkOverdueReminders(userId: string): Promise<SmartReminder[]> {
    try {
      const now = new Date();
      const reminders = await this.getReminders(userId);
      const overdueReminders = reminders.filter(r => 
        r.status === 'upcoming' && r.dueDate < now
      );

      // Update status to overdue
      for (const reminder of overdueReminders) {
        await this.updateReminder(reminder.id, { status: 'overdue' });
      }

      return overdueReminders;
    } catch (error) {
      console.error('Check overdue reminders error:', error);
      return [];
    }
  }

  static async processRecurringReminders(): Promise<void> {
    try {
      // This would typically be called by a background service
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get all recurring reminders that are paid and due for next occurrence
      const remindersQuery = query(
        collection(db, 'reminders'),
        where('isRecurring', '==', true),
        where('status', '==', 'paid'),
        where('dueDate', '<=', Timestamp.fromDate(tomorrow))
      );

      const snapshot = await getDocs(remindersQuery);
      
      for (const doc of snapshot.docs) {
        const reminder = doc.data() as SmartReminder;
        if (reminder.recurringPattern) {
          await this.createNextRecurringReminder({
            ...reminder,
            id: doc.id,
            dueDate: reminder.dueDate,
            recurringPattern: {
              ...reminder.recurringPattern,
              endDate: reminder.recurringPattern.endDate
            }
          });
        }
      }
    } catch (error) {
      console.error('Process recurring reminders error:', error);
    }
  }

  // ANALYTICS
  static async getReminderStats(userId: string): Promise<{
    totalReminders: number;
    upcomingCount: number;
    overdueCount: number;
    paidThisMonth: number;
    averagePaymentDelay: number;
    categoriesBreakdown: Array<{ category: string; count: number; totalAmount: number }>;
  }> {
    try {
      const allReminders = await this.getReminders(userId, true);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats = {
        totalReminders: allReminders.length,
        upcomingCount: allReminders.filter(r => r.status === 'upcoming').length,
        overdueCount: allReminders.filter(r => r.status === 'overdue').length,
        paidThisMonth: allReminders.filter(r => 
          r.status === 'paid' && r.lastPaidDate && r.lastPaidDate >= monthStart
        ).length,
        averagePaymentDelay: 0,
        categoriesBreakdown: [] as Array<{ category: string; count: number; totalAmount: number }>
      };

      // Calculate average payment delay
      const paidReminders = allReminders.filter(r => r.paymentHistory && r.paymentHistory.length > 0);
      if (paidReminders.length > 0) {
        const totalDelays = paidReminders.reduce((sum, r) => {
          const avgDelay = r.paymentHistory!.reduce((pSum, payment) => 
            pSum + (payment.daysLate || 0), 0
          ) / r.paymentHistory!.length;
          return sum + avgDelay;
        }, 0);
        stats.averagePaymentDelay = totalDelays / paidReminders.length;
      }

      // Categories breakdown
      const categoriesMap = new Map<string, { count: number; totalAmount: number }>();
      allReminders.forEach(r => {
        const existing = categoriesMap.get(r.category) || { count: 0, totalAmount: 0 };
        categoriesMap.set(r.category, {
          count: existing.count + 1,
          totalAmount: existing.totalAmount + r.amount
        });
      });

      stats.categoriesBreakdown = Array.from(categoriesMap.entries()).map(([category, data]) => ({
        category,
        ...data
      }));

      return stats;
    } catch (error) {
      console.error('Get reminder stats error:', error);
      throw error;
    }
  }

  // REAL-TIME LISTENERS
  static onReminders(userId: string, callback: (reminders: SmartReminder[]) => void): () => void {
    const remindersQuery = query(
      collection(db, 'reminders'),
      where('userId', '==', userId),
      where('status', 'in', ['upcoming', 'overdue', 'snoozed']),
      orderBy('dueDate', 'asc')
    );

    return onSnapshot(remindersQuery, (snapshot) => {
      const reminders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.toDate() || new Date(),
          lastPaidDate: data.lastPaidDate?.toDate(),
          recurringPattern: data.recurringPattern ? {
            ...data.recurringPattern,
            endDate: data.recurringPattern.endDate?.toDate()
          } : undefined,
          paymentHistory: data.paymentHistory?.map((payment: any) => ({
            ...payment,
            date: payment.date?.toDate() || new Date()
          })) || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as SmartReminder[];

      callback(reminders);
    });
  }
}