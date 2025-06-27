import { Expense, Income, Reminder } from "@/types";
import { NotificationService } from "./notificationService";

export class DataService {
  private static instance: DataService;
  private baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';
  
  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    try {
      const response = await fetch(`${this.baseUrl}/expenses`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('API not available, using local storage');
    }
    
    return JSON.parse(localStorage.getItem('expenses') || '[]');
  }

  async saveExpense(expense: Expense): Promise<Expense> {
    try {
      const response = await fetch(`${this.baseUrl}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense)
      });
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('API not available, using local storage');
    }

    const expenses = await this.getExpenses();
    expenses.push(expense);
    localStorage.setItem('expenses', JSON.stringify(expenses));
    return expense;
  }

  async updateExpense(expense: Expense): Promise<Expense> {
    try {
      const response = await fetch(`${this.baseUrl}/expenses/${expense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense)
      });
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('API not available, using local storage');
    }

    const expenses = await this.getExpenses();
    const index = expenses.findIndex(e => e.id === expense.id);
    if (index !== -1) {
      expenses[index] = expense;
      localStorage.setItem('expenses', JSON.stringify(expenses));
    }
    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/expenses/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        return;
      }
    } catch (error) {
      console.log('API not available, using local storage');
    }

    const expenses = await this.getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    localStorage.setItem('expenses', JSON.stringify(filtered));
  }

  // Income methods (similar pattern)
  async getIncome(): Promise<Income[]> {
    try {
      const response = await fetch(`${this.baseUrl}/income`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('API not available, using local storage');
    }
    
    return JSON.parse(localStorage.getItem('income') || '[]');
  }

  async saveIncome(income: Income): Promise<Income> {
    const incomes = await this.getIncome();
    incomes.push(income);
    localStorage.setItem('income', JSON.stringify(incomes));
    return income;
  }

  // Reminders methods (similar pattern)
  async getReminders(): Promise<Reminder[]> {
    return JSON.parse(localStorage.getItem('reminders') || '[]');
  }

  async saveReminder(reminder: Reminder): Promise<Reminder> {
    const reminders = await this.getReminders();
    reminders.push(reminder);
    localStorage.setItem('reminders', JSON.stringify(reminders));
    
    // Schedule notification for this reminder
    NotificationService.getInstance().scheduleReminder(reminder);
    
    return reminder;
  }

  // Sync with external APIs
  async syncWithBank(): Promise<void> {
    // Integration with Plaid, Yodlee, or other banking APIs
    console.log('Bank sync would be implemented here');
  }

  async syncWithCreditCards(): Promise<void> {
    // Integration with credit card APIs
    console.log('Credit card sync would be implemented here');
  }
}