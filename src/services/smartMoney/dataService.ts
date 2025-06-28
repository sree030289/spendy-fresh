import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
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

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    try {
      const expensesRef = collection(db, 'expenses');
      const snapshot = await getDocs(query(expensesRef, orderBy('date', 'desc')));
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Expense));
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const stored = await AsyncStorage.getItem('smart_money_expenses');
      return stored ? JSON.parse(stored) : [];
    }
  }

  async saveExpense(expense: Expense): Promise<Expense> {
    try {
      const expensesRef = collection(db, 'expenses');
      const docRef = await addDoc(expensesRef, expense);
      return { ...expense, id: docRef.id };
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const expenses = await this.getExpenses();
      const newExpense = { ...expense, id: Date.now().toString() };
      expenses.push(newExpense);
      await AsyncStorage.setItem('smart_money_expenses', JSON.stringify(expenses));
      return newExpense;
    }
  }

  async updateExpense(expense: Expense): Promise<Expense> {
    try {
      const expenseRef = doc(db, 'expenses', expense.id);
      const { id, ...expenseData } = expense;  // Remove id as it's not needed in the data
      await updateDoc(expenseRef, expenseData as any);
      return expense;
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const expenses = await this.getExpenses();
      const index = expenses.findIndex(e => e.id === expense.id);
      if (index !== -1) {
        expenses[index] = expense;
        await AsyncStorage.setItem('smart_money_expenses', JSON.stringify(expenses));
      }
      return expense;
    }
  }

  async deleteExpense(id: string): Promise<void> {
    try {
      const expenseRef = doc(db, 'expenses', id);
      await deleteDoc(expenseRef);
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const expenses = await this.getExpenses();
      const filtered = expenses.filter(e => e.id !== id);
      await AsyncStorage.setItem('smart_money_expenses', JSON.stringify(filtered));
    }
  }

  // Income methods
  async getIncome(): Promise<Income[]> {
    try {
      const incomeRef = collection(db, 'income');
      const snapshot = await getDocs(query(incomeRef, orderBy('date', 'desc')));
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Income));
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const stored = await AsyncStorage.getItem('smart_money_income');
      return stored ? JSON.parse(stored) : [];
    }
  }

  async saveIncome(income: Income): Promise<Income> {
    try {
      const incomeRef = collection(db, 'income');
      const docRef = await addDoc(incomeRef, income);
      return { ...income, id: docRef.id };
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const incomes = await this.getIncome();
      const newIncome = { ...income, id: Date.now().toString() };
      incomes.push(newIncome);
      await AsyncStorage.setItem('smart_money_income', JSON.stringify(incomes));
      return newIncome;
    }
  }

  async deleteIncome(id: string): Promise<void> {
    try {
      const incomeRef = doc(db, 'income', id);
      await deleteDoc(incomeRef);
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const incomes = await this.getIncome();
      const filtered = incomes.filter(i => i.id !== id);
      await AsyncStorage.setItem('smart_money_income', JSON.stringify(filtered));
    }
  }

  // Reminders methods
  async getReminders(): Promise<Reminder[]> {
    try {
      const remindersRef = collection(db, 'reminders');
      const snapshot = await getDocs(query(remindersRef, orderBy('dueDate', 'asc')));
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reminder));
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const stored = await AsyncStorage.getItem('smart_money_reminders');
      return stored ? JSON.parse(stored) : [];
    }
  }

  async saveReminder(reminder: Reminder): Promise<Reminder> {
    try {
      const remindersRef = collection(db, 'reminders');
      const docRef = await addDoc(remindersRef, reminder);
      const savedReminder = { ...reminder, id: docRef.id };
      
      // Schedule notification for this reminder
      const notificationService = FirebaseNotificationService.getInstance();
      await notificationService.scheduleBillReminder(savedReminder);
      
      return savedReminder;
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const reminders = await this.getReminders();
      const newReminder = { ...reminder, id: Date.now().toString() };
      reminders.push(newReminder);
      await AsyncStorage.setItem('smart_money_reminders', JSON.stringify(reminders));
      
      // Schedule notification
      const notificationService = FirebaseNotificationService.getInstance();
      await notificationService.scheduleBillReminder(newReminder);
      
      return newReminder;
    }
  }

  async updateReminder(reminder: Reminder): Promise<Reminder> {
    try {
      const reminderRef = doc(db, 'reminders', reminder.id);
      const { id, ...reminderData } = reminder;  // Remove id as it's not needed in the data
      await updateDoc(reminderRef, reminderData as any);
      return reminder;
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const reminders = await this.getReminders();
      const index = reminders.findIndex(r => r.id === reminder.id);
      if (index !== -1) {
        reminders[index] = reminder;
        await AsyncStorage.setItem('smart_money_reminders', JSON.stringify(reminders));
      }
      return reminder;
    }
  }

  async deleteReminder(id: string): Promise<void> {
    try {
      const reminderRef = doc(db, 'reminders', id);
      await deleteDoc(reminderRef);
    } catch (error) {
      console.log('Firebase not available, using local storage');
      const reminders = await this.getReminders();
      const filtered = reminders.filter(r => r.id !== id);
      await AsyncStorage.setItem('smart_money_reminders', JSON.stringify(filtered));
    }
  }
}
