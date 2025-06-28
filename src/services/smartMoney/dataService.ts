import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { Expense, Income, Reminder } from '@/types';
import { FirebaseNotificationService } from './firebaseNotificationService';

export class DataService {
  private static instance: DataService;
  
  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  // EXPENSES METHODS
  async getExpenses(): Promise<Expense[]> {
    try {
      console.log('📊 Fetching expenses from Firebase...');
      const expensesRef = collection(db, 'smartMoneyExpenses');
      const snapshot = await getDocs(query(expensesRef, orderBy('date', 'desc')));
      
      const expenses = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          amount: data.amount,
          category: data.category,
          date: data.date || new Date().toISOString().split('T')[0],
          type: 'expense'
        } as Expense;
      });
      
      console.log('✅ Fetched', expenses.length, 'expenses from Firebase');
      return expenses;
    } catch (error) {
      console.log('❌ Firebase not available, using local storage for expenses');
      const stored = await AsyncStorage.getItem('smart_money_expenses');
      const expenses = stored ? JSON.parse(stored) : [];
      console.log('📱 Loaded', expenses.length, 'expenses from local storage');
      return expenses;
    }
  }

  async saveExpense(expense: Expense): Promise<Expense> {
    try {
      console.log('💾 Saving expense to Firebase:', expense.title);
      const expensesRef = collection(db, 'smartMoneyExpenses');
      const docRef = await addDoc(expensesRef, {
        title: expense.title,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        type: 'expense',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const savedExpense = { ...expense, id: docRef.id };
      console.log('✅ Expense saved to Firebase with ID:', docRef.id);
      return savedExpense;
    } catch (error) {
      console.log('❌ Firebase not available, saving to local storage');
      const expenses = await this.getExpenses();
      const newExpense = { ...expense, id: Date.now().toString() };
      expenses.unshift(newExpense);
      await AsyncStorage.setItem('smart_money_expenses', JSON.stringify(expenses));
      console.log('📱 Expense saved to local storage');
      return newExpense;
    }
  }

  async updateExpense(expense: Expense): Promise<Expense> {
    try {
      console.log('🔄 Updating expense in Firebase:', expense.id);
      const expenseRef = doc(db, 'smartMoneyExpenses', expense.id);
      await updateDoc(expenseRef, {
        title: expense.title,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Expense updated in Firebase');
      return expense;
    } catch (error) {
      console.log('❌ Firebase not available, updating in local storage');
      const expenses = await this.getExpenses();
      const index = expenses.findIndex(e => e.id === expense.id);
      if (index !== -1) {
        expenses[index] = expense;
        await AsyncStorage.setItem('smart_money_expenses', JSON.stringify(expenses));
        console.log('📱 Expense updated in local storage');
      }
      return expense;
    }
  }

  async deleteExpense(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting expense from Firebase:', id);
      const expenseRef = doc(db, 'smartMoneyExpenses', id);
      await deleteDoc(expenseRef);
      console.log('✅ Expense deleted from Firebase');
    } catch (error) {
      console.log('❌ Firebase not available, deleting from local storage');
      const expenses = await this.getExpenses();
      const filtered = expenses.filter(e => e.id !== id);
      await AsyncStorage.setItem('smart_money_expenses', JSON.stringify(filtered));
      console.log('📱 Expense deleted from local storage');
    }
  }

  // INCOME METHODS
  async getIncome(): Promise<Income[]> {
    try {
      console.log('📊 Fetching income from Firebase...');
      const incomeRef = collection(db, 'smartMoneyIncome');
      const snapshot = await getDocs(query(incomeRef, orderBy('date', 'desc')));
      
      const income = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          amount: data.amount,
          category: data.category,
          date: data.date || new Date().toISOString().split('T')[0],
          type: 'income'
        } as Income;
      });
      
      console.log('✅ Fetched', income.length, 'income entries from Firebase');
      return income;
    } catch (error) {
      console.log('❌ Firebase not available, using local storage for income');
      const stored = await AsyncStorage.getItem('smart_money_income');
      const income = stored ? JSON.parse(stored) : [];
      console.log('📱 Loaded', income.length, 'income entries from local storage');
      return income;
    }
  }

  async saveIncome(income: Income): Promise<Income> {
    try {
      console.log('💾 Saving income to Firebase:', income.title);
      const incomeRef = collection(db, 'smartMoneyIncome');
      const docRef = await addDoc(incomeRef, {
        title: income.title,
        amount: income.amount,
        category: income.category,
        date: income.date,
        type: 'income',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const savedIncome = { ...income, id: docRef.id };
      console.log('✅ Income saved to Firebase with ID:', docRef.id);
      return savedIncome;
    } catch (error) {
      console.log('❌ Firebase not available, saving to local storage');
      const incomes = await this.getIncome();
      const newIncome = { ...income, id: Date.now().toString() };
      incomes.unshift(newIncome);
      await AsyncStorage.setItem('smart_money_income', JSON.stringify(incomes));
      console.log('📱 Income saved to local storage');
      return newIncome;
    }
  }

  async updateIncome(income: Income): Promise<Income> {
    try {
      console.log('🔄 Updating income in Firebase:', income.id);
      const incomeRef = doc(db, 'smartMoneyIncome', income.id);
      await updateDoc(incomeRef, {
        title: income.title,
        amount: income.amount,
        category: income.category,
        date: income.date,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Income updated in Firebase');
      return income;
    } catch (error) {
      console.log('❌ Firebase not available, updating in local storage');
      const incomes = await this.getIncome();
      const index = incomes.findIndex(i => i.id === income.id);
      if (index !== -1) {
        incomes[index] = income;
        await AsyncStorage.setItem('smart_money_income', JSON.stringify(incomes));
        console.log('📱 Income updated in local storage');
      }
      return income;
    }
  }

  async deleteIncome(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting income from Firebase:', id);
      const incomeRef = doc(db, 'smartMoneyIncome', id);
      await deleteDoc(incomeRef);
      console.log('✅ Income deleted from Firebase');
    } catch (error) {
      console.log('❌ Firebase not available, deleting from local storage');
      const incomes = await this.getIncome();
      const filtered = incomes.filter(i => i.id !== id);
      await AsyncStorage.setItem('smart_money_income', JSON.stringify(filtered));
      console.log('📱 Income deleted from local storage');
    }
  }

  // REMINDERS METHODS
  async getReminders(): Promise<Reminder[]> {
    try {
      console.log('📊 Fetching reminders from Firebase...');
      const remindersRef = collection(db, 'smartMoneyReminders');
      const snapshot = await getDocs(query(remindersRef, orderBy('dueDate', 'asc')));
      
      const reminders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          amount: data.amount,
          dueDate: data.dueDate || new Date().toISOString().split('T')[0],
          status: data.status || 'pending',
          category: data.category,
          recurring: data.recurring || 'none',
          autoDetected: data.autoDetected || false,
          priority: data.priority || 'medium'
        } as Reminder;
      });
      
      console.log('✅ Fetched', reminders.length, 'reminders from Firebase');
      return reminders;
    } catch (error) {
      console.log('❌ Firebase not available, using local storage for reminders');
      const stored = await AsyncStorage.getItem('smart_money_reminders');
      const reminders = stored ? JSON.parse(stored) : [];
      console.log('📱 Loaded', reminders.length, 'reminders from local storage');
      return reminders;
    }
  }

  async saveReminder(reminder: Reminder): Promise<Reminder> {
    try {
      console.log('💾 Saving reminder to Firebase:', reminder.title);
      const remindersRef = collection(db, 'smartMoneyReminders');
      const docRef = await addDoc(remindersRef, {
        title: reminder.title,
        amount: reminder.amount,
        dueDate: reminder.dueDate,
        status: reminder.status,
        category: reminder.category,
        recurring: reminder.recurring,
        autoDetected: reminder.autoDetected,
        priority: reminder.priority,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const savedReminder = { ...reminder, id: docRef.id };
      console.log('✅ Reminder saved to Firebase with ID:', docRef.id);
      
      // Schedule notification for this reminder
      try {
        const notificationService = FirebaseNotificationService.getInstance();
        await notificationService.scheduleBillReminder(savedReminder);
        console.log('🔔 Notification scheduled for reminder');
      } catch (notifError) {
        console.log('⚠️ Failed to schedule notification:', notifError);
      }
      
      return savedReminder;
    } catch (error) {
      console.log('❌ Firebase not available, saving to local storage');
      const reminders = await this.getReminders();
      const newReminder = { ...reminder, id: Date.now().toString() };
      reminders.push(newReminder);
      // Sort by due date
      reminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      await AsyncStorage.setItem('smart_money_reminders', JSON.stringify(reminders));
      
      // Schedule notification
      try {
        const notificationService = FirebaseNotificationService.getInstance();
        await notificationService.scheduleBillReminder(newReminder);
        console.log('🔔 Notification scheduled for reminder');
      } catch (notifError) {
        console.log('⚠️ Failed to schedule notification:', notifError);
      }
      
      console.log('📱 Reminder saved to local storage');
      return newReminder;
    }
  }

  async updateReminder(reminder: Reminder): Promise<Reminder> {
    try {
      console.log('🔄 Updating reminder in Firebase:', reminder.id);
      const reminderRef = doc(db, 'smartMoneyReminders', reminder.id);
      await updateDoc(reminderRef, {
        title: reminder.title,
        amount: reminder.amount,
        dueDate: reminder.dueDate,
        status: reminder.status,
        category: reminder.category,
        recurring: reminder.recurring,
        autoDetected: reminder.autoDetected,
        priority: reminder.priority,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Reminder updated in Firebase');
      return reminder;
    } catch (error) {
      console.log('❌ Firebase not available, updating in local storage');
      const reminders = await this.getReminders();
      const index = reminders.findIndex(r => r.id === reminder.id);
      if (index !== -1) {
        reminders[index] = reminder;
        await AsyncStorage.setItem('smart_money_reminders', JSON.stringify(reminders));
        console.log('📱 Reminder updated in local storage');
      }
      return reminder;
    }
  }

  async deleteReminder(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting reminder from Firebase:', id);
      const reminderRef = doc(db, 'smartMoneyReminders', id);
      await deleteDoc(reminderRef);
      console.log('✅ Reminder deleted from Firebase');
    } catch (error) {
      console.log('❌ Firebase not available, deleting from local storage');
      const reminders = await this.getReminders();
      const filtered = reminders.filter(r => r.id !== id);
      await AsyncStorage.setItem('smart_money_reminders', JSON.stringify(filtered));
      console.log('📱 Reminder deleted from local storage');
    }
  }

  // UTILITY METHODS
  async clearAllData(): Promise<void> {
    try {
      console.log('🧹 Clearing all Smart Money data...');
      await Promise.all([
        AsyncStorage.removeItem('smart_money_expenses'),
        AsyncStorage.removeItem('smart_money_income'),
        AsyncStorage.removeItem('smart_money_reminders')
      ]);
      console.log('✅ All local data cleared');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
    }
  }

  async exportData(): Promise<{
    expenses: Expense[];
    income: Income[];
    reminders: Reminder[];
  }> {
    try {
      const [expenses, income, reminders] = await Promise.all([
        this.getExpenses(),
        this.getIncome(),
        this.getReminders()
      ]);

      return { expenses, income, reminders };
    } catch (error) {
      console.error('❌ Failed to export data:', error);
      return { expenses: [], income: [], reminders: [] };
    }
  }

  async importData(data: {
    expenses?: Expense[];
    income?: Income[];
    reminders?: Reminder[];
  }): Promise<boolean> {
    try {
      console.log('📥 Importing data...');
      
      if (data.expenses && data.expenses.length > 0) {
        for (const expense of data.expenses) {
          await this.saveExpense(expense);
        }
        console.log('✅ Imported', data.expenses.length, 'expenses');
      }

      if (data.income && data.income.length > 0) {
        for (const incomeItem of data.income) {
          await this.saveIncome(incomeItem);
        }
        console.log('✅ Imported', data.income.length, 'income entries');
      }

      if (data.reminders && data.reminders.length > 0) {
        for (const reminder of data.reminders) {
          await this.saveReminder(reminder);
        }
        console.log('✅ Imported', data.reminders.length, 'reminders');
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to import data:', error);
      return false;
    }
  }

  // DATA VALIDATION
  validateExpense(expense: Partial<Expense>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!expense.title || expense.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!expense.amount || expense.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!expense.category || expense.category.trim().length === 0) {
      errors.push('Category is required');
    }

    if (!expense.date) {
      errors.push('Date is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateIncome(income: Partial<Income>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!income.title || income.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!income.amount || income.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!income.category || income.category.trim().length === 0) {
      errors.push('Category is required');
    }

    if (!income.date) {
      errors.push('Date is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateReminder(reminder: Partial<Reminder>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!reminder.title || reminder.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!reminder.amount || reminder.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!reminder.dueDate) {
      errors.push('Due date is required');
    }

    if (!reminder.category || reminder.category.trim().length === 0) {
      errors.push('Category is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}