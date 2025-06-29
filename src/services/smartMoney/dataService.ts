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
  async getExpenses(userId?: string): Promise<Expense[]> {
    try {
      console.log('📊 Fetching expenses from Firebase...');
      const expensesRef = collection(db, 'smartMoneyExpenses');
      let expensesQuery;
      
      if (userId) {
        expensesQuery = query(
          expensesRef, 
          where('userId', '==', userId),
          orderBy('date', 'desc')
        );
      } else {
        expensesQuery = query(expensesRef, orderBy('date', 'desc'));
      }
      
      const snapshot = await getDocs(expensesQuery);
      
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
      
      console.log('✅ Fetched', expenses.length, 'expenses from Firebase for user:', userId || 'all users');
      return expenses;
    } catch (error) {
      console.log('❌ Firebase not available, using local storage for expenses');
      const stored = await AsyncStorage.getItem(`smart_money_expenses_${userId || 'default'}`);
      const expenses = stored ? JSON.parse(stored) : [];
      console.log('📱 Loaded', expenses.length, 'expenses from local storage for user:', userId || 'default');
      return expenses;
    }
  }

  async saveExpense(expense: Expense, userId?: string): Promise<Expense> {
    try {
      console.log('💾 Saving expense to Firebase:', expense.title);
      const expensesRef = collection(db, 'smartMoneyExpenses');
      const docRef = await addDoc(expensesRef, {
        title: expense.title,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        type: 'expense',
        userId: userId, // Add user ID to the expense
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const savedExpense = { ...expense, id: docRef.id };
      console.log('✅ Expense saved to Firebase with ID:', docRef.id);
      return savedExpense;
    } catch (error) {
      console.log('❌ Firebase not available, saving to local storage');
      const expenses = await this.getExpenses(userId);
      const newExpense = { ...expense, id: Date.now().toString() };
      expenses.unshift(newExpense);
      await AsyncStorage.setItem(`smart_money_expenses_${userId || 'default'}`, JSON.stringify(expenses));
      console.log('📱 Expense saved to local storage');
      return newExpense;
    }
  }

  async updateExpense(expense: Expense, userId?: string): Promise<Expense> {
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
      const expenses = await this.getExpenses(userId);
      const index = expenses.findIndex(e => e.id === expense.id);
      if (index !== -1) {
        expenses[index] = expense;
        await AsyncStorage.setItem(`smart_money_expenses_${userId || 'default'}`, JSON.stringify(expenses));
        console.log('📱 Expense updated in local storage');
      }
      return expense;
    }
  }

  async deleteExpense(id: string, userId?: string): Promise<void> {
    try {
      console.log('🗑️ Deleting expense from Firebase:', id);
      const expenseRef = doc(db, 'smartMoneyExpenses', id);
      await deleteDoc(expenseRef);
      console.log('✅ Expense deleted from Firebase');
    } catch (error) {
      console.log('❌ Firebase not available, deleting from local storage');
      const expenses = await this.getExpenses(userId);
      const filtered = expenses.filter(e => e.id !== id);
      await AsyncStorage.setItem(`smart_money_expenses_${userId || 'default'}`, JSON.stringify(filtered));
      console.log('📱 Expense deleted from local storage');
    }
  }

  // INCOME METHODS
  async getIncome(userId?: string): Promise<Income[]> {
    try {
      console.log('📊 Fetching income from Firebase...');
      const incomeRef = collection(db, 'smartMoneyIncome');
      let incomeQuery;
      
      if (userId) {
        incomeQuery = query(
          incomeRef, 
          where('userId', '==', userId),
          orderBy('date', 'desc')
        );
      } else {
        incomeQuery = query(incomeRef, orderBy('date', 'desc'));
      }
      
      const snapshot = await getDocs(incomeQuery);
      
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
      
      console.log('✅ Fetched', income.length, 'income entries from Firebase for user:', userId || 'all users');
      return income;
    } catch (error) {
      console.log('❌ Firebase not available, using local storage for income');
      const stored = await AsyncStorage.getItem(`smart_money_income_${userId || 'default'}`);
      const income = stored ? JSON.parse(stored) : [];
      console.log('📱 Loaded', income.length, 'income entries from local storage for user:', userId || 'default');
      return income;
    }
  }

  async saveIncome(income: Income, userId?: string): Promise<Income> {
    try {
      console.log('💾 Saving income to Firebase:', income.title);
      const incomeRef = collection(db, 'smartMoneyIncome');
      const docRef = await addDoc(incomeRef, {
        title: income.title,
        amount: income.amount,
        category: income.category,
        date: income.date,
        type: 'income',
        userId: userId, // Add user ID to the income
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const savedIncome = { ...income, id: docRef.id };
      console.log('✅ Income saved to Firebase with ID:', docRef.id);
      return savedIncome;
    } catch (error) {
      console.log('❌ Firebase not available, saving to local storage');
      const incomes = await this.getIncome(userId);
      const newIncome = { ...income, id: Date.now().toString() };
      incomes.unshift(newIncome);
      await AsyncStorage.setItem(`smart_money_income_${userId || 'default'}`, JSON.stringify(incomes));
      console.log('📱 Income saved to local storage');
      return newIncome;
    }
  }

  async updateIncome(income: Income, userId?: string): Promise<Income> {
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
      const incomes = await this.getIncome(userId);
      const index = incomes.findIndex(i => i.id === income.id);
      if (index !== -1) {
        incomes[index] = income;
        await AsyncStorage.setItem(`smart_money_income_${userId || 'default'}`, JSON.stringify(incomes));
        console.log('📱 Income updated in local storage');
      }
      return income;
    }
  }

  async deleteIncome(id: string, userId?: string): Promise<void> {
    try {
      console.log('🗑️ Deleting income from Firebase:', id);
      const incomeRef = doc(db, 'smartMoneyIncome', id);
      await deleteDoc(incomeRef);
      console.log('✅ Income deleted from Firebase');
    } catch (error) {
      console.log('❌ Firebase not available, deleting from local storage');
      const incomes = await this.getIncome(userId);
      const filtered = incomes.filter(i => i.id !== id);
      await AsyncStorage.setItem(`smart_money_income_${userId || 'default'}`, JSON.stringify(filtered));
      console.log('📱 Income deleted from local storage');
    }
  }

  // REMINDERS METHODS
  async getReminders(userId?: string): Promise<Reminder[]> {
    try {
      console.log('📊 Fetching reminders from Firebase...');
      const remindersRef = collection(db, 'smartMoneyReminders');
      let remindersQuery;
      
      if (userId) {
        remindersQuery = query(
          remindersRef, 
          where('userId', '==', userId),
          orderBy('dueDate', 'asc')
        );
      } else {
        remindersQuery = query(remindersRef, orderBy('dueDate', 'asc'));
      }
      
      const snapshot = await getDocs(remindersQuery);
      
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
      
      console.log('✅ Fetched', reminders.length, 'reminders from Firebase for user:', userId || 'all users');
      return reminders;
    } catch (error) {
      console.log('❌ Firebase not available, using local storage for reminders');
      const stored = await AsyncStorage.getItem(`smart_money_reminders_${userId || 'default'}`);
      const reminders = stored ? JSON.parse(stored) : [];
      console.log('📱 Loaded', reminders.length, 'reminders from local storage for user:', userId || 'default');
      return reminders;
    }
  }

  async saveReminder(reminder: Reminder, userId?: string): Promise<Reminder> {
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
        userId: userId, // Add user ID to the reminder
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
      const reminders = await this.getReminders(userId);
      const newReminder = { ...reminder, id: Date.now().toString() };
      reminders.push(newReminder);
      // Sort by due date
      reminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      await AsyncStorage.setItem(`smart_money_reminders_${userId || 'default'}`, JSON.stringify(reminders));
      
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

  async updateReminder(reminder: Reminder, userId?: string): Promise<Reminder> {
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
      const reminders = await this.getReminders(userId);
      const index = reminders.findIndex(r => r.id === reminder.id);
      if (index !== -1) {
        reminders[index] = reminder;
        await AsyncStorage.setItem(`smart_money_reminders_${userId || 'default'}`, JSON.stringify(reminders));
        console.log('📱 Reminder updated in local storage');
      }
      return reminder;
    }
  }

  async deleteReminder(id: string, userId?: string): Promise<void> {
    try {
      console.log('🗑️ Deleting reminder from Firebase:', id);
      const reminderRef = doc(db, 'smartMoneyReminders', id);
      await deleteDoc(reminderRef);
      console.log('✅ Reminder deleted from Firebase');
    } catch (error) {
      console.log('❌ Firebase not available, deleting from local storage');
      const reminders = await this.getReminders(userId);
      const filtered = reminders.filter(r => r.id !== id);
      await AsyncStorage.setItem(`smart_money_reminders_${userId || 'default'}`, JSON.stringify(filtered));
      console.log('📱 Reminder deleted from local storage');
    }
  }

  // UTILITY METHODS
  async clearAllData(userId?: string): Promise<void> {
    try {
      console.log('🧹 Clearing all Smart Money data for user:', userId || 'default');
      const userSuffix = userId || 'default';
      await Promise.all([
        AsyncStorage.removeItem(`smart_money_expenses_${userSuffix}`),
        AsyncStorage.removeItem(`smart_money_income_${userSuffix}`),
        AsyncStorage.removeItem(`smart_money_reminders_${userSuffix}`)
      ]);
      console.log('✅ All local data cleared for user');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
    }
  }

  async exportData(userId?: string): Promise<{
    expenses: Expense[];
    income: Income[];
    reminders: Reminder[];
  }> {
    try {
      const [expenses, income, reminders] = await Promise.all([
        this.getExpenses(userId),
        this.getIncome(userId),
        this.getReminders(userId)
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
  }, userId?: string): Promise<boolean> {
    try {
      console.log('📥 Importing data for user:', userId || 'default');
      
      if (data.expenses && data.expenses.length > 0) {
        for (const expense of data.expenses) {
          await this.saveExpense(expense, userId);
        }
        console.log('✅ Imported', data.expenses.length, 'expenses');
      }

      if (data.income && data.income.length > 0) {
        for (const incomeItem of data.income) {
          await this.saveIncome(incomeItem, userId);
        }
        console.log('✅ Imported', data.income.length, 'income entries');
      }

      if (data.reminders && data.reminders.length > 0) {
        for (const reminder of data.reminders) {
          await this.saveReminder(reminder, userId);
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