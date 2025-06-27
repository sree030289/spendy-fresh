import { Reminder } from "@/types";

export class NotificationService {
  private static instance: NotificationService;
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermission(): Promise<boolean> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  async scheduleReminder(reminder: Reminder): Promise<void> {
    const dueDate = new Date(reminder.dueDate);
    const now = new Date();
    const timeDiff = dueDate.getTime() - now.getTime();

    if (timeDiff > 0) {
      // Schedule notification 1 day before due date
      const notifyTime = timeDiff - (24 * 60 * 60 * 1000);
      
      if (notifyTime > 0) {
        setTimeout(() => {
          this.showNotification(
            `Payment Reminder: ${reminder.title}`,
            `$${reminder.amount.toFixed(2)} due tomorrow`,
            'reminder'
          );
        }, notifyTime);
      }
    }
  }

  async scheduleDailyExpenseReminder(): Promise<void> {
    const now = new Date();
    const next8PM = new Date();
    next8PM.setHours(20, 0, 0, 0); // 8 PM
    
    if (now.getHours() >= 20) {
      next8PM.setDate(next8PM.getDate() + 1);
    }

    const timeUntil8PM = next8PM.getTime() - now.getTime();
    
    setTimeout(() => {
      this.showNotification(
        'Daily Expense Check',
        'Don\'t forget to log your expenses for today!',
        'expense_reminder'
      );
      
      // Schedule for next day
      setInterval(() => {
        this.showNotification(
          'Daily Expense Check',
          'Don\'t forget to log your expenses for today!',
          'expense_reminder'
        );
      }, 24 * 60 * 60 * 1000);
    }, timeUntil8PM);
  }

  async scheduleSalaryReminder(salaryDate: Date): Promise<void> {
    const nextSalary = new Date(salaryDate);
    nextSalary.setMonth(nextSalary.getMonth() + 1);
    
    const morningTime = new Date(nextSalary);
    morningTime.setHours(9, 0, 0, 0); // 9 AM on salary day
    
    const timeUntilSalary = morningTime.getTime() - Date.now();
    
    if (timeUntilSalary > 0) {
      setTimeout(() => {
        this.showNotification(
          'Salary Day! 💰',
          'Your salary should be credited today. Don\'t forget to update your income!',
          'salary'
        );
      }, timeUntilSalary);
    }
  }

  async scheduleWeeklyAnalytics(): Promise<void> {
    const now = new Date();
    const nextSunday = new Date();
    const daysUntilSunday = 7 - now.getDay();
    
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(10, 0, 0, 0); // 10 AM on Sunday
    
    const timeUntilSunday = nextSunday.getTime() - now.getTime();
    
    setTimeout(() => {
      this.showNotification(
        'Weekly Financial Summary',
        'Check out your weekly spending analysis and insights!',
        'analytics'
      );
      
      // Schedule for next week
      setInterval(() => {
        this.showNotification(
          'Weekly Financial Summary',
          'Check out your weekly spending analysis and insights!',
          'analytics'
        );
      }, 7 * 24 * 60 * 60 * 1000);
    }, timeUntilSunday);
  }

  private showNotification(title: string, body: string, type: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: type,
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }

  async getUpcomingReminders(days: number = 7): Promise<Reminder[]> {
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return reminders.filter((reminder: Reminder) => {
      const dueDate = new Date(reminder.dueDate);
      return dueDate >= now && dueDate <= futureDate && reminder.status === 'pending';
    });
  }
}
