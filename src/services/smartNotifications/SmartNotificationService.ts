import { ApiService } from '@/services/api/ApiService';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalTransaction, SmartReminder } from '@/types/moneyManagement';

interface NotificationRule {
  id: string;
  type: 'salary' | 'emi' | 'bill' | 'subscription' | 'budget_limit';
  title: string;
  body: string;
  trigger: {
    type: 'date' | 'recurring' | 'condition';
    date?: Date;
    interval?: 'daily' | 'weekly' | 'monthly';
    dayOfMonth?: number;
    condition?: string;
  };
  isActive: boolean;
  userId: string;
}

export class SmartNotificationService {
  private static instance: SmartNotificationService;
  private apiService: ApiService;
  private notificationRules: NotificationRule[] = [];

  private constructor() {
    this.apiService = ApiService.getInstance();
    this.setupNotifications();
  }

  public static getInstance(): SmartNotificationService {
    if (!SmartNotificationService.instance) {
      SmartNotificationService.instance = new SmartNotificationService();
    }
    return SmartNotificationService.instance;
  }

  private async setupNotifications() {
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted');
      return;
    }

    // Configure notification handling
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  async analyzeTransactionsForSmartReminders(transactions: PersonalTransaction[]): Promise<SmartReminder[]> {
    const reminders: SmartReminder[] = [];

    try {
      // Analyze salary patterns
      const salaryTransactions = transactions.filter(t => 
        t.type === 'income' && 
        (t.category === 'Salary' || t.description.toLowerCase().includes('salary'))
      );

      if (salaryTransactions.length > 0) {
        const lastSalary = salaryTransactions[0];
        const avgSalaryDay = this.calculateAverageSalaryDay(salaryTransactions);
        
        if (avgSalaryDay) {
          reminders.push({
            id: `salary_reminder_${Date.now()}`,
            userId: lastSalary.userId,
            type: 'salary',
            title: 'Salary Expected',
            description: `Your salary is typically received around the ${avgSalaryDay}th of each month`,
            amount: lastSalary.amount,
            category: 'Salary',
            dueDate: this.getNextSalaryDate(avgSalaryDay),
            isRecurring: true,
            recurringPattern: 'monthly',
            priority: 'medium',
            isActive: true,
            notificationSettings: {
              enabled: true,
              reminderDays: [2, 0], // 2 days before and on the day
              reminderTimes: ['09:00']
            },
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      // Analyze EMI patterns
      const emiTransactions = transactions.filter(t => 
        t.type === 'expense' && 
        (t.category.includes('EMI') || t.description.toLowerCase().includes('emi'))
      );

      for (const emiCategory of ['Home Loan EMI', 'Car Loan EMI', 'Personal Loan EMI']) {
        const categoryEmis = emiTransactions.filter(t => t.category === emiCategory);
        if (categoryEmis.length > 0) {
          const lastEmi = categoryEmis[0];
          const avgEmiDay = this.calculateAverageEmiDay(categoryEmis);
          
          if (avgEmiDay) {
            reminders.push({
              id: `emi_reminder_${emiCategory}_${Date.now()}`,
              userId: lastEmi.userId,
              type: 'emi',
              title: `${emiCategory} Due`,
              description: `Your ${emiCategory.toLowerCase()} payment is due`,
              amount: lastEmi.amount,
              category: emiCategory,
              dueDate: this.getNextEmiDate(avgEmiDay),
              isRecurring: true,
              recurringPattern: 'monthly',
              priority: 'high',
              isActive: true,
              notificationSettings: {
                enabled: true,
                reminderDays: [5, 3, 1], // 5, 3, and 1 day before
                reminderTimes: ['10:00', '15:00']
              },
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      }

      // Analyze subscription patterns
      const subscriptionTransactions = transactions.filter(t => 
        t.type === 'expense' && 
        (t.category.includes('Subscription') || 
         ['Netflix', 'Spotify', 'Amazon Prime', 'Gym Membership'].includes(t.category))
      );

      for (const sub of subscriptionTransactions) {
        const nextDue = this.calculateNextSubscriptionDate(sub);
        if (nextDue) {
          reminders.push({
            id: `subscription_reminder_${sub.category}_${Date.now()}`,
            userId: sub.userId,
            type: 'subscription',
            title: `${sub.category} Renewal`,
            description: `Your ${sub.category} subscription will renew soon`,
            amount: sub.amount,
            category: sub.category,
            dueDate: nextDue,
            isRecurring: true,
            recurringPattern: 'monthly',
            priority: 'low',
            isActive: true,
            notificationSettings: {
              enabled: true,
              reminderDays: [3], // 3 days before
              reminderTimes: ['18:00']
            },
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      return reminders;
    } catch (error) {
      console.error('Error analyzing transactions for smart reminders:', error);
      return [];
    }
  }

  private calculateAverageSalaryDay(salaryTransactions: PersonalTransaction[]): number | null {
    if (salaryTransactions.length === 0) return null;
    
    const days = salaryTransactions.map(t => new Date(t.date).getDate());
    const avgDay = Math.round(days.reduce((sum, day) => sum + day, 0) / days.length);
    
    return avgDay;
  }

  private calculateAverageEmiDay(emiTransactions: PersonalTransaction[]): number | null {
    if (emiTransactions.length === 0) return null;
    
    const days = emiTransactions.map(t => new Date(t.date).getDate());
    const avgDay = Math.round(days.reduce((sum, day) => sum + day, 0) / days.length);
    
    return avgDay;
  }

  private getNextSalaryDate(avgDay: number): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, avgDay);
    
    // If the average day has already passed this month, use next month
    if (now.getDate() > avgDay) {
      return nextMonth;
    } else {
      return new Date(now.getFullYear(), now.getMonth(), avgDay);
    }
  }

  private getNextEmiDate(avgDay: number): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, avgDay);
    
    // EMI is usually due on a specific date each month
    if (now.getDate() > avgDay) {
      return nextMonth;
    } else {
      return new Date(now.getFullYear(), now.getMonth(), avgDay);
    }
  }

  private calculateNextSubscriptionDate(transaction: PersonalTransaction): Date | null {
    // For simplicity, assume monthly subscriptions
    const transactionDate = new Date(transaction.date);
    const nextDate = new Date(transactionDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    
    return nextDate;
  }

  async scheduleSmartReminders(reminders: SmartReminder[]): Promise<void> {
    try {
      // Cancel existing reminders
      await Notifications.cancelAllScheduledNotificationsAsync();

      for (const reminder of reminders) {
        if (!reminder.isActive || !reminder.notificationSettings.enabled) continue;

        for (const daysBefore of reminder.notificationSettings.reminderDays) {
          for (const time of reminder.notificationSettings.reminderTimes) {
            const [hours, minutes] = time.split(':').map(Number);
            const notificationDate = new Date(reminder.dueDate);
            notificationDate.setDate(notificationDate.getDate() - daysBefore);
            notificationDate.setHours(hours, minutes, 0, 0);

            // Only schedule future notifications
            if (notificationDate > new Date()) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: reminder.title,
                  body: daysBefore === 0 
                    ? reminder.description 
                    : `${reminder.description} (Due in ${daysBefore} day${daysBefore !== 1 ? 's' : ''})`,
                  data: {
                    reminderId: reminder.id,
                    type: reminder.type,
                    amount: reminder.amount
                  },
                },
                trigger: notificationDate,
              });
            }
          }
        }
      }

      // Store reminders locally
      await AsyncStorage.setItem('smart_reminders', JSON.stringify(reminders));
    } catch (error) {
      console.error('Error scheduling smart reminders:', error);
    }
  }

  async getStoredReminders(): Promise<SmartReminder[]> {
    try {
      const stored = await AsyncStorage.getItem('smart_reminders');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting stored reminders:', error);
      return [];
    }
  }

  async updateReminderStatus(reminderId: string, isActive: boolean): Promise<void> {
    try {
      const reminders = await this.getStoredReminders();
      const updatedReminders = reminders.map(r => 
        r.id === reminderId ? { ...r, isActive, updatedAt: new Date() } : r
      );
      
      await AsyncStorage.setItem('smart_reminders', JSON.stringify(updatedReminders));
      
      // Reschedule notifications
      await this.scheduleSmartReminders(updatedReminders);
    } catch (error) {
      console.error('Error updating reminder status:', error);
    }
  }

  async detectBudgetAlerts(transactions: PersonalTransaction[], budgets: any[]): Promise<void> {
    // Implementation for budget limit alerts
    for (const budget of budgets) {
      const currentSpending = transactions
        .filter(t => 
          t.type === 'expense' && 
          t.category === budget.category &&
          new Date(t.date).getMonth() === new Date().getMonth()
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const percentage = (currentSpending / budget.limit) * 100;

      if (percentage >= 80 && percentage < 100) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Budget Alert',
            body: `You've used ${percentage.toFixed(0)}% of your ${budget.category} budget`,
            data: { type: 'budget_warning', category: budget.category }
          },
          trigger: null, // Immediate notification
        });
      } else if (percentage >= 100) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 Budget Exceeded',
            body: `You've exceeded your ${budget.category} budget by ${(percentage - 100).toFixed(0)}%`,
            data: { type: 'budget_exceeded', category: budget.category }
          },
          trigger: null, // Immediate notification
        });
      }
    }
  }
}

export default SmartNotificationService;