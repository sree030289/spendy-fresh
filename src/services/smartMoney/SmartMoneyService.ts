// src/services/smartMoney/SmartMoneyService.ts
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
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { AIService } from '../ai/AIService';
import { BankingService } from '../banking/BankingService';

// Smart Money Types
export interface SmartTransaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  categoryIcon: string;
  merchant: string;
  location: string;
  date: Date;
  source: 'bank_transaction' | 'receipt_scan' | 'manual' | 'recurring';
  account: string;
  accountId?: string;
  aiConfidence: number;
  canSplit: boolean;
  tags: string[];
  receiptUrl?: string;
  receiptData?: ReceiptData;
  bankTransactionId?: string;
  isRecurring?: boolean;
  recurringGroupId?: string;
  splitData?: ExpenseSplit[];
  isSettled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
  isPaid: boolean;
  paidAt?: Date;
}

export interface ReceiptData {
  merchant: string;
  amount: number;
  date: Date;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  tax?: number;
  tip?: number;
  total: number;
  confidence: number;
  rawText?: string;
  receiptUrl?: string;
  location?: string;
}

export interface SmartAnalytics {
  userId: string;
  period: 'week' | 'month' | 'quarter' | 'year';
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  categoryBreakdown: CategoryAnalytics[];
  monthlyTrend: MonthlyTrend[];
  insights: AIInsight[];
  budgetPerformance: BudgetPerformance[];
  predictedExpenses: PredictedExpense[];
  lastUpdated: Date;
}

export interface CategoryAnalytics {
  category: string;
  amount: number;
  percentage: number;
  change: number;
  averageTransaction: number;
  transactionCount: number;
  topMerchants: Array<{ name: string; amount: number }>;
  color: string;
  icon: string;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
}

export interface AIInsight {
  id: string;
  type: 'positive' | 'warning' | 'info' | 'alert';
  title: string;
  description: string;
  icon: string;
  actionable: boolean;
  action?: {
    type: 'create_budget' | 'set_reminder' | 'view_category';
    data: any;
  };
  confidence: number;
  createdAt: Date;
}

export interface BudgetPerformance {
  category: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  percentUsed: number;
  daysRemaining: number;
  projectedOverrun: number;
}

export interface PredictedExpense {
  description: string;
  amount: number;
  category: string;
  confidence: number;
  dueDate: Date;
  source: 'pattern' | 'recurring' | 'seasonal';
}

export class SmartMoneyService {
  
  // TRANSACTION MANAGEMENT
  static async getTransactions(userId: string, limitCount: number = 50): Promise<SmartTransaction[]> {
    try {
      const transactionsQuery = query(
        collection(db, 'smartTransactions'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(transactionsQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as SmartTransaction[];
    } catch (error) {
      console.error('Get transactions error:', error);
      return [];
    }
  }

  static async addTransaction(transactionData: Omit<SmartTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // AI categorization if not already categorized
      if (!transactionData.category || transactionData.aiConfidence < 0.5) {
        const aiCategory = await AIService.categorizeExpense(transactionData.description);
        transactionData.category = aiCategory.category;
        transactionData.categoryIcon = aiCategory.icon;
        transactionData.aiConfidence = aiCategory.confidence;
      }

      const newTransaction: Omit<SmartTransaction, 'id'> = {
        ...transactionData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'smartTransactions'), {
        ...newTransaction,
        date: Timestamp.fromDate(newTransaction.date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update analytics
      await this.updateAnalytics(transactionData.userId);
      
      // Generate AI insights
      await this.generateInsights(transactionData.userId);
      
      return docRef.id;
    } catch (error) {
      console.error('Add transaction error:', error);
      throw error;
    }
  }

  static async updateTransaction(transactionId: string, updates: Partial<SmartTransaction>): Promise<void> {
    try {
      await updateDoc(doc(db, 'smartTransactions', transactionId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      // Update analytics if amount or category changed
      if (updates.amount || updates.category) {
        const transactionDoc = await getDoc(doc(db, 'smartTransactions', transactionId));
        if (transactionDoc.exists()) {
          const transactionData = transactionDoc.data();
          await this.updateAnalytics(transactionData.userId);
        }
      }
    } catch (error) {
      console.error('Update transaction error:', error);
      throw error;
    }
  }

  static async deleteTransaction(transactionId: string): Promise<void> {
    try {
      const transactionDoc = await getDoc(doc(db, 'smartTransactions', transactionId));
      if (transactionDoc.exists()) {
        const transactionData = transactionDoc.data();
        await deleteDoc(doc(db, 'smartTransactions', transactionId));
        await this.updateAnalytics(transactionData.userId);
      }
    } catch (error) {
      console.error('Delete transaction error:', error);
      throw error;
    }
  }

  // ANALYTICS MANAGEMENT
  static async getAnalytics(userId: string, period: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<SmartAnalytics | null> {
    try {
      const analyticsDoc = await getDoc(doc(db, 'smartAnalytics', `${userId}_${period}`));
      
      if (analyticsDoc.exists()) {
        const data = analyticsDoc.data();
        return {
          ...data,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          insights: data.insights?.map((insight: any) => ({
            ...insight,
            createdAt: insight.createdAt?.toDate() || new Date()
          })) || []
        } as SmartAnalytics;
      }
      
      // Generate analytics if doesn't exist
      return await this.generateAnalytics(userId, period);
    } catch (error) {
      console.error('Get analytics error:', error);
      return null;
    }
  }

  static async generateAnalytics(userId: string, period: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<SmartAnalytics> {
    try {
      // Calculate date range
      const now = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Get transactions for period
      const transactionsQuery = query(
        collection(db, 'smartTransactions'),
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(now)),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(transactionsQuery);
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as SmartTransaction[];

      // Calculate totals
      let totalIncome = 0;
      let totalExpenses = 0;
      const categoryMap = new Map<string, CategoryAnalytics>();
      const monthlyMap = new Map<string, MonthlyTrend>();

      transactions.forEach(transaction => {
        if (transaction.category === 'Income') {
          totalIncome += transaction.amount;
        } else {
          totalExpenses += transaction.amount;
        }

        // Category breakdown
        const category = transaction.category;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            amount: 0,
            percentage: 0,
            change: 0,
            averageTransaction: 0,
            transactionCount: 0,
            topMerchants: [],
            color: this.getCategoryColor(category),
            icon: transaction.categoryIcon || '📊'
          });
        }

        const categoryData = categoryMap.get(category)!;
        categoryData.amount += transaction.amount;
        categoryData.transactionCount += 1;

        // Monthly trend
        const monthKey = transaction.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            month: monthKey,
            year: transaction.date.getFullYear(),
            income: 0,
            expenses: 0,
            savings: 0,
            savingsRate: 0
          });
        }

        const monthData = monthlyMap.get(monthKey)!;
        if (transaction.category === 'Income') {
          monthData.income += transaction.amount;
        } else {
          monthData.expenses += transaction.amount;
        }
      });

      // Calculate percentages and averages
      const categoryBreakdown = Array.from(categoryMap.values()).map(cat => {
        cat.percentage = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
        cat.averageTransaction = cat.transactionCount > 0 ? cat.amount / cat.transactionCount : 0;
        return cat;
      }).sort((a, b) => b.amount - a.amount);

      // Calculate monthly trends
      const monthlyTrend = Array.from(monthlyMap.values()).map(month => {
        month.savings = month.income - month.expenses;
        month.savingsRate = month.income > 0 ? (month.savings / month.income) * 100 : 0;
        return month;
      });

      const netSavings = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

      // Generate AI insights
      const insights = await this.generateInsights(userId, transactions, categoryBreakdown);

      const analytics: SmartAnalytics = {
        userId,
        period,
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRate,
        categoryBreakdown,
        monthlyTrend,
        insights,
        budgetPerformance: [], // TODO: Implement budget tracking
        predictedExpenses: [], // TODO: Implement ML predictions
        lastUpdated: new Date()
      };

      // Save analytics
      await this.saveAnalytics(analytics);

      return analytics;
    } catch (error) {
      console.error('Generate analytics error:', error);
      throw error;
    }
  }

  static async updateAnalytics(userId: string): Promise<void> {
    try {
      // Update analytics for different periods
      await Promise.all([
        this.generateAnalytics(userId, 'week'),
        this.generateAnalytics(userId, 'month'),
        this.generateAnalytics(userId, 'quarter'),
        this.generateAnalytics(userId, 'year')
      ]);
    } catch (error) {
      console.error('Update analytics error:', error);
    }
  }

  static async saveAnalytics(analytics: SmartAnalytics): Promise<void> {
    try {
      const docId = `${analytics.userId}_${analytics.period}`;
      await updateDoc(doc(db, 'smartAnalytics', docId), {
        ...analytics,
        lastUpdated: serverTimestamp(),
        insights: analytics.insights.map(insight => ({
          ...insight,
          createdAt: Timestamp.fromDate(insight.createdAt)
        }))
      });
    } catch (error) {
      // If document doesn't exist, create it
      const docId = `${analytics.userId}_${analytics.period}`;
      await addDoc(collection(db, 'smartAnalytics'), {
        ...analytics,
        id: docId,
        lastUpdated: serverTimestamp(),
        insights: analytics.insights.map(insight => ({
          ...insight,
          createdAt: Timestamp.fromDate(insight.createdAt)
        }))
      });
    }
  }

  // AI INSIGHTS GENERATION
  static async generateInsights(userId: string, transactions?: SmartTransaction[], categories?: CategoryAnalytics[]): Promise<AIInsight[]> {
    try {
      const insights: AIInsight[] = [];

      if (!transactions || !categories) {
        // Get recent data if not provided
        const recentTransactions = await this.getTransactions(userId, 100);
        const analytics = await this.getAnalytics(userId);
        transactions = recentTransactions;
        categories = analytics?.categoryBreakdown || [];
      }

      // Spending trend analysis
      const last30Days = transactions.filter(t => {
        const daysDiff = (Date.now() - t.date.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30 && t.category !== 'Income';
      });

      const previous30Days = transactions.filter(t => {
        const daysDiff = (Date.now() - t.date.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff > 30 && daysDiff <= 60 && t.category !== 'Income';
      });

      const currentSpending = last30Days.reduce((sum, t) => sum + t.amount, 0);
      const previousSpending = previous30Days.reduce((sum, t) => sum + t.amount, 0);

      if (previousSpending > 0) {
        const change = ((currentSpending - previousSpending) / previousSpending) * 100;
        
        if (change < -10) {
          insights.push({
            id: `spending_decrease_${Date.now()}`,
            type: 'positive',
            title: 'Great job saving!',
            description: `You spent ${Math.abs(change).toFixed(1)}% less this month`,
            icon: '📈',
            actionable: false,
            confidence: 0.9,
            createdAt: new Date()
          });
        } else if (change > 20) {
          insights.push({
            id: `spending_increase_${Date.now()}`,
            type: 'warning',
            title: 'Spending increased',
            description: `Your spending is up ${change.toFixed(1)}% this month`,
            icon: '⚠️',
            actionable: true,
            action: {
              type: 'view_category',
              data: { period: 'month' }
            },
            confidence: 0.85,
            createdAt: new Date()
          });
        }
      }

      // Category-specific insights
      const topCategory = categories[0];
      if (topCategory && topCategory.percentage > 40) {
        insights.push({
          id: `high_category_${Date.now()}`,
          type: 'info',
          title: `High ${topCategory.category} spending`,
          description: `${topCategory.category} accounts for ${topCategory.percentage.toFixed(1)}% of your expenses`,
          icon: topCategory.icon,
          actionable: true,
          action: {
            type: 'create_budget',
            data: { category: topCategory.category }
          },
          confidence: 0.8,
          createdAt: new Date()
        });
      }

      // Frequent merchant analysis
      const merchantSpending = new Map<string, number>();
      transactions.forEach(t => {
        if (t.category !== 'Income') {
          merchantSpending.set(t.merchant, (merchantSpending.get(t.merchant) || 0) + t.amount);
        }
      });

      const topMerchant = Array.from(merchantSpending.entries())
        .sort((a, b) => b[1] - a[1])[0];

      if (topMerchant && topMerchant[1] > currentSpending * 0.15) {
        insights.push({
          id: `frequent_merchant_${Date.now()}`,
          type: 'info',
          title: `Frequent spending at ${topMerchant[0]}`,
          description: `You've spent $${topMerchant[1].toFixed(2)} at ${topMerchant[0]} recently`,
          icon: '🏪',
          actionable: false,
          confidence: 0.75,
          createdAt: new Date()
        });
      }

      return insights.slice(0, 5); // Return top 5 insights
    } catch (error) {
      console.error('Generate insights error:', error);
      return [];
    }
  }

  // RECEIPT PROCESSING
  static async processReceipt(imageUri: string, userId: string): Promise<ReceiptData> {
    try {
      // Upload receipt image
      const receiptUrl = await this.uploadReceiptImage(imageUri, userId);
      
      // Process with AI
      const receiptData = await AIService.processReceipt(imageUri);
      
      // Add receipt URL to data
      receiptData.receiptUrl = receiptUrl;
      
      return receiptData;
    } catch (error) {
      console.error('Process receipt error:', error);
      throw error;
    }
  }

  static async uploadReceiptImage(imageUri: string, userId: string): Promise<string> {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const filename = `receipts/${userId}/${Date.now()}_receipt.jpg`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Upload receipt error:', error);
      throw error;
    }
  }

  // BANK INTEGRATION HELPERS
  static async syncBankTransactions(userId: string, accountId: string): Promise<void> {
    try {
      const bankTransactions = await BankingService.getTransactions(accountId);
      
      for (const bankTx of bankTransactions) {
        // Check if transaction already exists
        const existingQuery = query(
          collection(db, 'smartTransactions'),
          where('userId', '==', userId),
          where('bankTransactionId', '==', bankTx.id)
        );
        
        const existingSnapshot = await getDocs(existingQuery);
        
        if (existingSnapshot.empty) {
          // Categorize with AI
          const category = await AIService.categorizeExpense(bankTx.description);
          
          // Add new transaction
          await this.addTransaction({
            userId,
            amount: Math.abs(bankTx.amount),
            description: bankTx.description,
            category: bankTx.amount > 0 ? 'Income' : category.category,
            categoryIcon: bankTx.amount > 0 ? '💰' : category.icon,
            merchant: bankTx.merchant || 'Unknown',
            location: bankTx.location || '',
            date: bankTx.date,
            source: 'bank_transaction',
            account: bankTx.accountName,
            accountId: accountId,
            aiConfidence: category.confidence,
            canSplit: bankTx.amount < 0, // Only expenses can be split
            tags: ['bank_sync', category.category.toLowerCase()],
            bankTransactionId: bankTx.id
          });
        }
      }
      
      // Update analytics after sync
      await this.updateAnalytics(userId);
    } catch (error) {
      console.error('Sync bank transactions error:', error);
      throw error;
    }
  }

  // SPLITTING INTEGRATION
  static async createSplitFromTransaction(transactionId: string, participants: string[]): Promise<string> {
    try {
      const transactionDoc = await getDoc(doc(db, 'smartTransactions', transactionId));
      
      if (!transactionDoc.exists()) {
        throw new Error('Transaction not found');
      }
      
      const transaction = transactionDoc.data() as SmartTransaction;
      
      // Use existing splitting service
      const { SplittingService } = await import('../firebase/splitting');
      
      // Find user's groups to determine where to split
      const userGroups = await SplittingService.getUserGroups(transaction.userId);
      let targetGroup = userGroups.find(group => 
        group.members.some(member => participants.includes(member.userId))
      );
      
      if (!targetGroup && userGroups.length > 0) {
        targetGroup = userGroups[0]; // Use first available group
      }
      
      if (!targetGroup) {
        throw new Error('No suitable group found for splitting');
      }
      
      // Create expense in splitting system
      const expenseId = await SplittingService.addExpense({
        description: transaction.description,
        amount: transaction.amount,
        currency: 'AUD', // TODO: Get from user preferences
        category: transaction.category,
        categoryIcon: transaction.categoryIcon,
        groupId: targetGroup.id,
        paidBy: transaction.userId,
        paidByData: {
          fullName: 'Current User', // TODO: Get from user data
          email: 'user@example.com' // TODO: Get from user data
        },
        splitType: 'equal',
        splitData: participants.map(userId => ({
          userId,
          amount: transaction.amount / participants.length,
          isPaid: false
        })),
        receiptUrl: transaction.receiptUrl,
        tags: transaction.tags,
        notes: `Split from Smart Money transaction: ${transaction.description}`,
        date: transaction.date,
        isSettled: false
      });
      
      // Update original transaction with split reference
      await updateDoc(doc(db, 'smartTransactions', transactionId), {
        splitData: participants.map(userId => ({
          userId,
          amount: transaction.amount / participants.length,
          isPaid: false
        })),
        isSettled: false,
        updatedAt: serverTimestamp()
      });
      
      return expenseId;
    } catch (error) {
      console.error('Create split from transaction error:', error);
      throw error;
    }
  }

  // RECURRING TRANSACTIONS
  static async createRecurringTransaction(
    transactionData: Omit<SmartTransaction, 'id' | 'createdAt' | 'updatedAt'>,
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    endDate?: Date
  ): Promise<string> {
    try {
      const recurringId = `recurring_${Date.now()}`;
      
      // Create recurring group
      const recurringGroup = {
        id: recurringId,
        userId: transactionData.userId,
        templateData: transactionData,
        frequency,
        nextDueDate: this.calculateNextDueDate(new Date(), frequency),
        endDate,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await addDoc(collection(db, 'recurringTransactions'), {
        ...recurringGroup,
        nextDueDate: Timestamp.fromDate(recurringGroup.nextDueDate),
        endDate: endDate ? Timestamp.fromDate(endDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Create first transaction
      const firstTransactionId = await this.addTransaction({
        ...transactionData,
        isRecurring: true,
        recurringGroupId: recurringId
      });
      
      return firstTransactionId;
    } catch (error) {
      console.error('Create recurring transaction error:', error);
      throw error;
    }
  }

  static async processRecurringTransactions(): Promise<void> {
    try {
      const now = new Date();
      
      // Get due recurring transactions
      const recurringQuery = query(
        collection(db, 'recurringTransactions'),
        where('isActive', '==', true),
        where('nextDueDate', '<=', Timestamp.fromDate(now))
      );
      
      const snapshot = await getDocs(recurringQuery);
      
      for (const docSnapshot of snapshot.docs) {
        const recurring = docSnapshot.data();
        
        // Check if end date passed
        if (recurring.endDate && recurring.endDate.toDate() < now) {
          await updateDoc(docSnapshot.ref, {
            isActive: false,
            updatedAt: serverTimestamp()
          });
          continue;
        }
        
        // Create new transaction
        await this.addTransaction({
          ...recurring.templateData,
          date: now,
          isRecurring: true,
          recurringGroupId: recurring.id
        });
        
        // Calculate next due date
        const nextDue = this.calculateNextDueDate(
          recurring.nextDueDate.toDate(),
          recurring.frequency
        );
        
        await updateDoc(docSnapshot.ref, {
          nextDueDate: Timestamp.fromDate(nextDue),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Process recurring transactions error:', error);
    }
  }

  private static calculateNextDueDate(currentDate: Date, frequency: string): Date {
    const nextDate = new Date(currentDate);
    
    switch (frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
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
    }
    
    return nextDate;
  }

  // UTILITY METHODS
  private static getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'Food & Drink': '#EF4444',
      'Transport': '#3B82F6',
      'Shopping': '#8B5CF6',
      'Entertainment': '#F59E0B',
      'Bills & Utilities': '#10B981',
      'Health & Fitness': '#06B6D4',
      'Travel': '#EC4899',
      'Education': '#6366F1',
      'Income': '#22C55E',
      'Housing': '#F97316',
      'Other': '#6B7280'
    };
    
    return colors[category] || colors['Other'];
  }

  // REAL-TIME LISTENERS
  static onTransactions(userId: string, callback: (transactions: SmartTransaction[]) => void): () => void {
    const transactionsQuery = query(
      collection(db, 'smartTransactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(50)
    );
    
    return onSnapshot(transactionsQuery, (snapshot) => {
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as SmartTransaction[];
      
      callback(transactions);
    });
  }

  static onAnalytics(userId: string, period: string, callback: (analytics: SmartAnalytics | null) => void): () => void {
    const analyticsDoc = doc(db, 'smartAnalytics', `${userId}_${period}`);
    
    return onSnapshot(analyticsDoc, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const analytics = {
          ...data,
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          insights: data.insights?.map((insight: any) => ({
            ...insight,
            createdAt: insight.createdAt?.toDate() || new Date()
          })) || []
        } as SmartAnalytics;
        
        callback(analytics);
      } else {
        callback(null);
      }
    });
  }

  // SEARCH AND FILTERING
  static async searchTransactions(
    userId: string,
    query: string,
    filters?: {
      categories?: string[];
      dateRange?: { start: Date; end: Date };
      amountRange?: { min: number; max: number };
      sources?: string[];
    }
  ): Promise<SmartTransaction[]> {
    try {
      let transactionsQuery = query(
        collection(db, 'smartTransactions'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );

      // TODO: Implement text search with Algolia or similar
      // For now, get all transactions and filter client-side
      const snapshot = await getDocs(transactionsQuery);
      let transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }) as SmartTransaction[];

      // Apply text search
      if (query) {
        const searchQuery = query.toLowerCase();
        transactions = transactions.filter(t =>
          t.description.toLowerCase().includes(searchQuery) ||
          t.merchant.toLowerCase().includes(searchQuery) ||
          t.category.toLowerCase().includes(searchQuery) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchQuery))
        );
      }

      // Apply filters
      if (filters) {
        if (filters.categories && filters.categories.length > 0) {
          transactions = transactions.filter(t =>
            filters.categories!.includes(t.category)
          );
        }

        if (filters.dateRange) {
          transactions = transactions.filter(t =>
            t.date >= filters.dateRange!.start && t.date <= filters.dateRange!.end
          );
        }

        if (filters.amountRange) {
          transactions = transactions.filter(t =>
            t.amount >= filters.amountRange!.min && t.amount <= filters.amountRange!.max
          );
        }

        if (filters.sources && filters.sources.length > 0) {
          transactions = transactions.filter(t =>
            filters.sources!.includes(t.source)
          );
        }
      }

      return transactions;
    } catch (error) {
      console.error('Search transactions error:', error);
      return [];
    }
  }

  // EXPORT DATA
  static async exportTransactions(
    userId: string,
    format: 'csv' | 'json' = 'csv',
    dateRange?: { start: Date; end: Date }
  ): Promise<string> {
    try {
      let transactions = await this.getTransactions(userId, 1000);

      if (dateRange) {
        transactions = transactions.filter(t =>
          t.date >= dateRange.start && t.date <= dateRange.end
        );
      }

      if (format === 'csv') {
        const headers = [
          'Date', 'Description', 'Amount', 'Category', 'Merchant', 
          'Location', 'Source', 'Account', 'Tags'
        ];
        
        const csvRows = [
          headers.join(','),
          ...transactions.map(t => [
            t.date.toISOString().split('T')[0],
            `"${t.description}"`,
            t.amount.toString(),
            t.category,
            `"${t.merchant}"`,
            `"${t.location}"`,
            t.source,
            `"${t.account}"`,
            `"${t.tags.join(', ')}"`
          ].join(','))
        ];
        
        return csvRows.join('\n');
      } else {
        return JSON.stringify(transactions, null, 2);
      }
    } catch (error) {
      console.error('Export transactions error:', error);
      throw error;
    }
  }

  // BUDGET INTEGRATION
  static async createBudgetFromCategory(
    userId: string,
    category: string,
    amount: number,
    period: 'monthly' | 'weekly' = 'monthly'
  ): Promise<string> {
    try {
      const budget = {
        userId,
        category,
        amount,
        period,
        spent: 0,
        remaining: amount,
        startDate: new Date(),
        endDate: this.calculateBudgetEndDate(new Date(), period),
        isActive: true,
        alerts: {
          at50Percent: true,
          at80Percent: true,
          atLimit: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'budgets'), {
        ...budget,
        startDate: Timestamp.fromDate(budget.startDate),
        endDate: Timestamp.fromDate(budget.endDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error('Create budget error:', error);
      throw error;
    }
  }

  private static calculateBudgetEndDate(startDate: Date, period: string): Date {
    const endDate = new Date(startDate);
    
    switch (period) {
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
    }
    
    return endDate;
  }
}