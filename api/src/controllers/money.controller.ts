// src/controllers/money.controller.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../config/firebase';
import { 
  FieldValue
} from 'firebase-admin/firestore';

// Personal Transactions
export const addTransaction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      type,
      amount,
      description,
      category,
      subcategory,
      date,
      tags = [],
      paymentMethod,
      location,
      notes,
      isRecurring = false,
      recurringId
    } = req.body;

    // Validate required fields
    if (!type || !amount || !description || !category || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, amount, description, category, date'
      });
    }

    // Check daily transaction limit for non-premium users
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.collection('usageTrackers').doc(`${userId}_${today}`);
    const usageDoc = await usageRef.get();
    
    if (usageDoc.exists()) {
      const usage = usageDoc.data();
      // Assume non-premium users have 5 transactions per day limit
      if (usage.transactionsAdded >= 5 && !req.user?.isPremium) {
        return res.status(403).json({
          success: false,
          message: 'Daily transaction limit reached. Upgrade to premium for unlimited transactions.',
          error: 'DAILY_LIMIT_EXCEEDED'
        });
      }
    }

    const transactionData = {
      userId,
      type,
      amount: parseFloat(amount),
      description,
      category,
      subcategory: subcategory || null,
      date: new Date(date),
      tags,
      paymentMethod: paymentMethod || null,
      location: location || null,
      notes: notes || null,
      isRecurring,
      recurringId: recurringId || null,
      source: 'manual',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('personalTransactions').add(transactionData);
    
    // Update usage tracker
    if (usageDoc.exists()) {
      await usageRef.update({
        transactionsAdded: (usageDoc.data().transactionsAdded || 0) + 1,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      await db.collection('usageTrackers').add({
        id: `${userId}_${today}`,
        userId,
        date: today,
        transactionsAdded: 1,
        analyticsViewed: 0,
        exportsGenerated: 0,
        premiumFeaturesUsed: [],
        resetAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        createdAt: serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Transaction added successfully',
      data: {
        id: docRef.id,
        ...transactionData
      }
    });

    // Trigger analytics refresh (async)
    refreshUserAnalytics(userId).catch(console.error);

  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add transaction',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const getTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      page = 1, 
      limit: pageLimit = 50, 
      type, 
      category, 
      startDate, 
      endDate,
      search 
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(pageLimit as string);
    const offset = (pageNum - 1) * limitNum;

    let transactionsQuery = query(
      collection(db, 'personalTransactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );

    // Apply filters
    if (type) {
      transactionsQuery = query(transactionsQuery, where('type', '==', type));
    }

    if (category) {
      transactionsQuery = query(transactionsQuery, where('category', '==', category));
    }

    if (startDate && endDate) {
      transactionsQuery = query(
        transactionsQuery,
        where('date', '>=', Timestamp.fromDate(new Date(startDate as string))),
        where('date', '<=', Timestamp.fromDate(new Date(endDate as string)))
      );
    }

    transactionsQuery = query(transactionsQuery, limit(limitNum));

    const snapshot = await getDocs(transactionsQuery);
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString()
    }));

    // Filter by search term if provided
    let filteredTransactions = transactions;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredTransactions = transactions.filter(t => 
        t.description.toLowerCase().includes(searchTerm) ||
        t.category.toLowerCase().includes(searchTerm) ||
        (t.subcategory && t.subcategory.toLowerCase().includes(searchTerm)) ||
        (t.notes && t.notes.toLowerCase().includes(searchTerm))
      );
    }

    res.json({
      success: true,
      data: filteredTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTransactions.length,
        hasMore: snapshot.docs.length === limitNum
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const getTransaction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const docRef = doc(db, 'personalTransactions', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = docSnap.data();
    
    // Check if user owns this transaction
    if (transaction.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to transaction'
      });
    }

    res.json({
      success: true,
      data: {
        id: docSnap.id,
        ...transaction,
        date: transaction.date?.toDate?.()?.toISOString(),
        createdAt: transaction.createdAt?.toDate?.()?.toISOString(),
        updatedAt: transaction.updatedAt?.toDate?.()?.toISOString()
      }
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const updateTransaction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const docRef = doc(db, 'personalTransactions', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = docSnap.data();
    
    if (transaction.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to transaction'
      });
    }

    // Prepare update data
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    if (updates.date) {
      updateData.date = Timestamp.fromDate(new Date(updates.date));
    }

    if (updates.amount) {
      updateData.amount = parseFloat(updates.amount);
    }

    await updateDoc(docRef, updateData);

    res.json({
      success: true,
      message: 'Transaction updated successfully'
    });

    // Trigger analytics refresh (async)
    refreshUserAnalytics(userId).catch(console.error);

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const deleteTransaction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const docRef = doc(db, 'personalTransactions', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = docSnap.data();
    
    if (transaction.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to transaction'
      });
    }

    await deleteDoc(docRef);

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });

    // Trigger analytics refresh (async)
    refreshUserAnalytics(userId).catch(console.error);

  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const getAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { period = 'month' } = req.query;

    // Check if analytics viewing is allowed (premium feature after first view)
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.collection('usageTrackers').doc(`${userId}_${today}`);
    const usageDoc = await usageRef.get();
    
    if (usageDoc.exists()) {
      const usage = usageDoc.data();
      if (usage.analyticsViewed > 0 && !req.user?.isPremium) {
        return res.status(403).json({
          success: false,
          message: 'Analytics viewing limit reached. Upgrade to premium for unlimited access.',
          error: 'PREMIUM_FEATURE_REQUIRED'
        });
      }
    }

    const analyticsRef = doc(db, 'personalAnalytics', `${userId}_${period}`);
    const analyticsDoc = await getDoc(analyticsRef);

    let analytics;
    if (analyticsDoc.exists()) {
      analytics = analyticsDoc.data();
    } else {
      // Generate analytics if doesn't exist
      analytics = await generateUserAnalytics(userId, period as string);
    }

    // Update usage tracker
    if (usageDoc.exists()) {
      await usageRef.update({
        analyticsViewed: (usageDoc.data().analyticsViewed || 0) + 1,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      await db.collection('usageTrackers').add({
        id: `${userId}_${today}`,
        userId,
        date: today,
        transactionsAdded: 0,
        analyticsViewed: 1,
        exportsGenerated: 0,
        premiumFeaturesUsed: [],
        resetAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        createdAt: serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    res.json({
      success: true,
      data: {
        ...analytics,
        lastUpdated: analytics.lastUpdated?.toDate?.()?.toISOString(),
        startDate: analytics.startDate?.toDate?.()?.toISOString(),
        endDate: analytics.endDate?.toDate?.()?.toISOString()
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// Helper function to generate analytics
const generateUserAnalytics = async (userId: string, period: string) => {
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

  const transactionsQuery = query(
    collection(db, 'personalTransactions'),
    where('userId', '==', userId),
    where('date', '>=', Timestamp.fromDate(startDate)),
    where('date', '<=', Timestamp.fromDate(now)),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(transactionsQuery);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date.toDate()
  }));

  // Calculate analytics
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryMap = new Map();
  const incomeMap = new Map();
  const monthlyTrends = new Map();

  transactions.forEach(transaction => {
    const amount = transaction.amount;
    const category = transaction.category;
    const monthYear = transaction.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    if (transaction.type === 'income') {
      totalIncome += amount;
      if (!incomeMap.has(category)) {
        incomeMap.set(category, { amount: 0, count: 0 });
      }
      const incomeData = incomeMap.get(category);
      incomeData.amount += amount;
      incomeData.count += 1;
    } else {
      totalExpenses += amount;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { amount: 0, count: 0 });
      }
      const categoryData = categoryMap.get(category);
      categoryData.amount += amount;
      categoryData.count += 1;
    }

    // Monthly trends
    if (!monthlyTrends.has(monthYear)) {
      monthlyTrends.set(monthYear, { income: 0, expenses: 0, month: monthYear });
    }
    const trendData = monthlyTrends.get(monthYear);
    if (transaction.type === 'income') {
      trendData.income += amount;
    } else {
      trendData.expenses += amount;
    }
  });

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Category breakdown
  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    amount: data.amount,
    percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
    transactionCount: data.count,
    averageAmount: data.amount / data.count,
    color: getCategoryColor(category),
    icon: getCategoryIcon(category)
  })).sort((a, b) => b.amount - a.amount);

  const incomeBreakdown = Array.from(incomeMap.entries()).map(([category, data]) => ({
    category,
    amount: data.amount,
    percentage: totalIncome > 0 ? (data.amount / totalIncome) * 100 : 0,
    transactionCount: data.count,
    averageAmount: data.amount / data.count,
    color: getCategoryColor(category),
    icon: getCategoryIcon(category)
  })).sort((a, b) => b.amount - a.amount);

  const monthlyTrendsArray = Array.from(monthlyTrends.values()).map(trend => ({
    ...trend,
    savings: trend.income - trend.expenses,
    savingsRate: trend.income > 0 ? ((trend.income - trend.expenses) / trend.income) * 100 : 0
  }));

  const analytics = {
    userId,
    period,
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(now),
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    categoryBreakdown,
    incomeBreakdown,
    monthlyTrends: monthlyTrendsArray,
    aiInsights: generateAIInsights(transactions, categoryBreakdown, totalIncome, totalExpenses),
    upcomingExpenses: [],
    lastUpdated: serverTimestamp()
  };

  // Save analytics
  const analyticsRef = doc(db, 'personalAnalytics', `${userId}_${period}`);
  await updateDoc(analyticsRef, analytics).catch(() => 
    addDoc(collection(db, 'personalAnalytics'), { ...analytics, id: `${userId}_${period}` })
  );

  return analytics;
};

// Helper function to refresh user analytics
const refreshUserAnalytics = async (userId: string) => {
  try {
    await Promise.all([
      generateUserAnalytics(userId, 'week'),
      generateUserAnalytics(userId, 'month'),
      generateUserAnalytics(userId, 'quarter'),
      generateUserAnalytics(userId, 'year')
    ]);
  } catch (error) {
    console.error('Error refreshing analytics:', error);
  }
};

// Helper functions
const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    'Rent': '#FF6B6B',
    'Groceries': '#4ECDC4',
    'Transportation': '#45B7D1',
    'Entertainment': '#96CEB4',
    'Utilities': '#FFEAA7',
    'Healthcare': '#DDA0DD',
    'Shopping': '#98D8C8',
    'Salary': '#6C5CE7',
    'Freelance': '#A29BFE',
    'Investment': '#FD79A8',
    'Business': '#FDCB6E'
  };
  return colors[category] || '#74B9FF';
};

const getCategoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    'Rent': '🏠',
    'Groceries': '🛒',
    'Transportation': '🚗',
    'Entertainment': '🎬',
    'Utilities': '⚡',
    'Healthcare': '🏥',
    'Shopping': '🛍️',
    'Salary': '💰',
    'Freelance': '💼',
    'Investment': '📈',
    'Business': '🏢'
  };
  return icons[category] || '💳';
};

const generateAIInsights = (transactions: any[], categoryBreakdown: any[], totalIncome: number, totalExpenses: number) => {
  const insights = [];

  // Savings rate insight
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  if (savingsRate > 20) {
    insights.push({
      id: 'good_savings',
      type: 'positive',
      title: 'Great Savings Rate!',
      description: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep it up!`,
      icon: '💰',
      priority: 'high',
      confidence: 0.9
    });
  } else if (savingsRate < 10) {
    insights.push({
      id: 'low_savings',
      type: 'warning',
      title: 'Low Savings Rate',
      description: `Your savings rate is ${savingsRate.toFixed(1)}%. Consider reducing expenses or increasing income.`,
      icon: '⚠️',
      priority: 'high',
      confidence: 0.85
    });
  }

  // Top spending category
  if (categoryBreakdown.length > 0) {
    const topCategory = categoryBreakdown[0];
    if (topCategory.percentage > 30) {
      insights.push({
        id: 'high_category_spending',
        type: 'info',
        title: `High ${topCategory.category} Spending`,
        description: `${topCategory.category} accounts for ${topCategory.percentage.toFixed(1)}% of your expenses.`,
        icon: topCategory.icon,
        priority: 'medium',
        confidence: 0.8
      });
    }
  }

  return insights;
};

// Placeholder implementations for other endpoints
export const getAnalyticsByPeriod = async (req: AuthenticatedRequest, res: Response) => {
  // Implementation similar to getAnalytics but with specific period
  res.json({ success: true, message: 'Feature coming soon' });
};

export const refreshAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await refreshUserAnalytics(userId);
    res.json({ success: true, message: 'Analytics refreshed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to refresh analytics' });
  }
};

export const getAIInsights = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'AI Insights feature coming soon' });
};

export const createBudget = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Budget feature coming soon' });
};

export const getBudgets = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: [], message: 'Budget feature coming soon' });
};

export const updateBudget = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Budget feature coming soon' });
};

export const deleteBudget = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Budget feature coming soon' });
};

export const getBudgetPerformance = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: [], message: 'Budget feature coming soon' });
};

export const createRecurringTransaction = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Recurring transactions feature coming soon' });
};

export const getRecurringTransactions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: [], message: 'Recurring transactions feature coming soon' });
};

export const updateRecurringTransaction = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Recurring transactions feature coming soon' });
};

export const deleteRecurringTransaction = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Recurring transactions feature coming soon' });
};

export const pauseRecurringTransaction = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Recurring transactions feature coming soon' });
};

export const resumeRecurringTransaction = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Recurring transactions feature coming soon' });
};

export const createSmartReminder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      description,
      amount,
      currency = 'USD',
      category,
      dueDate,
      isRecurring = false,
      recurringType,
      reminderDays = [1, 3],
      notificationEnabled = true,
      autoDetected = false,
      emailSource,
      notes
    } = req.body;

    // Validate required fields
    if (!title || !amount || !category || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, amount, category, dueDate'
      });
    }

    // Calculate status based on due date
    const now = new Date();
    const dueDateObj = new Date(dueDate);
    let status = 'upcoming';
    if (dueDateObj < now) {
      status = 'overdue';
    }

    const reminderData = {
      userId,
      title,
      description: description || '',
      amount: parseFloat(amount),
      currency,
      category,
      dueDate: Timestamp.fromDate(dueDateObj),
      status,
      isRecurring,
      recurringType: recurringType || null,
      nextDueDate: isRecurring && recurringType ? 
        Timestamp.fromDate(calculateNextDueDate(dueDateObj, recurringType)) : null,
      reminderDays,
      notificationEnabled,
      autoDetected,
      emailSource: emailSource || null,
      notes: notes || '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'reminders'), reminderData);
    
    res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      data: {
        id: docRef.id,
        ...reminderData,
        dueDate: dueDateObj.toISOString(),
        nextDueDate: reminderData.nextDueDate ? reminderData.nextDueDate.toDate().toISOString() : null
      }
    });

    // Schedule notifications (async)
    if (notificationEnabled && status !== 'paid') {
      scheduleReminderNotifications(docRef.id, userId, reminderData).catch(console.error);
    }

  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create reminder',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const getSmartReminders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      status, 
      category, 
      startDate, 
      endDate, 
      page = 1, 
      limit: pageLimit = 50,
      search
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(pageLimit as string);

    let remindersQuery = query(
      collection(db, 'reminders'),
      where('userId', '==', userId),
      orderBy('dueDate', 'asc')
    );

    // Apply filters
    if (status && status !== 'all') {
      remindersQuery = query(remindersQuery, where('status', '==', status));
    }

    if (category) {
      remindersQuery = query(remindersQuery, where('category', '==', category));
    }

    if (startDate && endDate) {
      remindersQuery = query(
        remindersQuery,
        where('dueDate', '>=', Timestamp.fromDate(new Date(startDate as string))),
        where('dueDate', '<=', Timestamp.fromDate(new Date(endDate as string)))
      );
    }

    const snapshot = await getDocs(remindersQuery);
    let reminders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate?.()?.toISOString(),
      nextDueDate: doc.data().nextDueDate?.toDate?.()?.toISOString(),
      paidDate: doc.data().paidDate?.toDate?.()?.toISOString(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString()
    }));

    // Update statuses based on current date
    const now = new Date();
    const batch = writeBatch(db);
    let hasStatusUpdates = false;

    reminders = reminders.map(reminder => {
      if (reminder.status !== 'paid') {
        const dueDate = new Date(reminder.dueDate);
        let newStatus = 'upcoming';
        if (dueDate < now) {
          newStatus = 'overdue';
        }
        
        if (newStatus !== reminder.status) {
          const docRef = doc(db, 'reminders', reminder.id);
          batch.update(docRef, { 
            status: newStatus, 
            updatedAt: FieldValue.serverTimestamp() 
          });
          hasStatusUpdates = true;
          reminder.status = newStatus;
        }
      }
      return reminder;
    });

    // Commit status updates
    if (hasStatusUpdates) {
      await batch.commit();
    }

    // Apply search filter
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      reminders = reminders.filter(r => 
        r.title.toLowerCase().includes(searchTerm) ||
        r.description.toLowerCase().includes(searchTerm) ||
        r.category.toLowerCase().includes(searchTerm) ||
        (r.notes && r.notes.toLowerCase().includes(searchTerm))
      );
    }

    // Apply pagination
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedReminders = reminders.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      data: paginatedReminders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: reminders.length,
        hasMore: startIndex + limitNum < reminders.length
      }
    });

  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const updateSmartReminder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const docRef = doc(db, 'reminders', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    const reminder = docSnap.data();
    
    if (reminder.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to reminder'
      });
    }

    // Prepare update data
    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    if (updates.dueDate) {
      updateData.dueDate = Timestamp.fromDate(new Date(updates.dueDate));
      
      // Recalculate status if due date changed
      if (updates.status !== 'paid') {
        const now = new Date();
        const newDueDate = new Date(updates.dueDate);
        updateData.status = newDueDate < now ? 'overdue' : 'upcoming';
      }
    }

    if (updates.amount) {
      updateData.amount = parseFloat(updates.amount);
    }

    if (updates.isRecurring && updates.recurringType) {
      const dueDate = updates.dueDate ? new Date(updates.dueDate) : new Date(reminder.dueDate.toDate());
      updateData.nextDueDate = Timestamp.fromDate(calculateNextDueDate(dueDate, updates.recurringType));
    }

    await updateDoc(docRef, updateData);

    res.json({
      success: true,
      message: 'Reminder updated successfully'
    });

    // Update notifications if needed (async)
    if (updates.notificationEnabled !== undefined || updates.reminderDays || updates.dueDate) {
      updateReminderNotifications(id, userId, { ...reminder, ...updates }).catch(console.error);
    }

  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reminder',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const deleteSmartReminder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const docRef = doc(db, 'reminders', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    const reminder = docSnap.data();
    
    if (reminder.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to reminder'
      });
    }

    await deleteDoc(docRef);

    res.json({
      success: true,
      message: 'Reminder deleted successfully'
    });

    // Cancel notifications (async)
    cancelReminderNotifications(id, userId).catch(console.error);

  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reminder',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const markReminderAsPaid = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { paidAmount, paymentMethod, notes } = req.body;

    const docRef = doc(db, 'reminders', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    const reminder = docSnap.data();
    
    if (reminder.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to reminder'
      });
    }

    const now = new Date();
    const updateData: any = {
      status: 'paid',
      paidDate: Timestamp.fromDate(now),
      paidAmount: paidAmount ? parseFloat(paidAmount) : reminder.amount,
      paymentMethod: paymentMethod || null,
      updatedAt: serverTimestamp()
    };

    if (notes) {
      updateData.notes = reminder.notes ? `${reminder.notes}\n\nPayment Notes: ${notes}` : `Payment Notes: ${notes}`;
    }

    await updateDoc(docRef, updateData);

    // Create next recurring reminder if applicable
    if (reminder.isRecurring && reminder.recurringType) {
      const nextDueDate = calculateNextDueDate(reminder.dueDate.toDate(), reminder.recurringType);
      
      const nextReminderData = {
        ...reminder,
        dueDate: Timestamp.fromDate(nextDueDate),
        status: 'upcoming',
        paidDate: null,
        paidAmount: null,
        paymentMethod: null,
        createdAt: serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      // Only create if next due date is in the future
      if (nextDueDate > now) {
        const nextDocRef = await addDoc(collection(db, 'reminders'), nextReminderData);
        
        // Schedule notifications for next reminder
        if (reminder.notificationEnabled) {
          scheduleReminderNotifications(nextDocRef.id, userId, nextReminderData).catch(console.error);
        }
      }
    }

    res.json({
      success: true,
      message: 'Reminder marked as paid successfully'
    });

    // Cancel notifications for this reminder (async)
    cancelReminderNotifications(id, userId).catch(console.error);

  } catch (error) {
    console.error('Mark reminder as paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark reminder as paid',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const getUpcomingReminders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { days = 7 } = req.query;
    const daysNum = parseInt(days as string);
    
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);

    const remindersQuery = query(
      collection(db, 'reminders'),
      where('userId', '==', userId),
      where('status', 'in', ['upcoming', 'overdue']),
      where('dueDate', '<=', Timestamp.fromDate(futureDate)),
      orderBy('dueDate', 'asc')
    );

    const snapshot = await getDocs(remindersQuery);
    const reminders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate?.()?.toISOString(),
      nextDueDate: doc.data().nextDueDate?.toDate?.()?.toISOString(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
      daysUntilDue: Math.ceil((doc.data().dueDate.toDate().getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      success: true,
      data: reminders,
      meta: {
        totalUpcoming: reminders.filter(r => r.status === 'upcoming').length,
        totalOverdue: reminders.filter(r => r.status === 'overdue').length,
        totalAmount: reminders.reduce((sum, r) => sum + r.amount, 0)
      }
    });

  } catch (error) {
    console.error('Get upcoming reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming reminders',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const getCalendarData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year } = req.query;

    // Default to current month if not provided
    const now = new Date();
    const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : now.getFullYear();

    // Calculate date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Get reminders for the month
    const remindersQuery = await db.collection('reminders')
      .where('userId', '==', userId)
      .where('dueDate', '>=', startDate)
      .where('dueDate', '<=', endDate)
      .orderBy('dueDate', 'asc')
      .get();

    // Group reminders by date
    const calendarData: { [key: string]: any[] } = {};
    
    remindersQuery.docs.forEach(doc => {
      const reminder = doc.data();
      const dueDate = reminder.dueDate.toDate();
      const dateKey = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      if (!calendarData[dateKey]) {
        calendarData[dateKey] = [];
      }

      calendarData[dateKey].push({
        id: doc.id,
        title: reminder.title,
        amount: reminder.amount,
        currency: reminder.currency,
        category: reminder.category,
        status: reminder.status,
        time: dueDate.toISOString(),
        color: getStatusColor(reminder.status),
        isRecurring: reminder.isRecurring,
        autoDetected: reminder.autoDetected
      });
    });

    // Get monthly statistics
    const allReminders = remindersQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const stats = {
      totalReminders: allReminders.length,
      upcomingCount: allReminders.filter(r => r.status === 'upcoming').length,
      overdueCount: allReminders.filter(r => r.status === 'overdue').length,
      paidCount: allReminders.filter(r => r.status === 'paid').length,
      totalAmount: allReminders
        .filter(r => r.status !== 'paid')
        .reduce((sum, r) => sum + r.amount, 0),
      categoryBreakdown: getCategoryBreakdown(allReminders)
    };

    res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        calendar: calendarData,
        stats
      },
      message: 'Calendar data retrieved successfully'
    });

  } catch (error) {
    console.error('Get calendar data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get calendar data',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const getCalendarDataByDate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { date } = req.params;

    // Parse and validate date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Set date range for the entire day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    // Get reminders for the specific date
    const remindersQuery = await db.collection('reminders')
      .where('userId', '==', userId)
      .where('dueDate', '>=', startDate)
      .where('dueDate', '<=', endDate)
      .orderBy('dueDate', 'asc')
      .get();

    const reminders = remindersQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate.toDate().toISOString(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString(),
      paidDate: doc.data().paidDate?.toDate?.()?.toISOString(),
      nextDueDate: doc.data().nextDueDate?.toDate?.()?.toISOString(),
      color: getStatusColor(doc.data().status)
    }));

    // Calculate daily summary
    const summary = {
      date: targetDate.toISOString().split('T')[0],
      totalReminders: reminders.length,
      totalAmount: reminders
        .filter(r => r.status !== 'paid')
        .reduce((sum, r) => sum + r.amount, 0),
      byStatus: {
        upcoming: reminders.filter(r => r.status === 'upcoming').length,
        overdue: reminders.filter(r => r.status === 'overdue').length,
        paid: reminders.filter(r => r.status === 'paid').length
      },
      byCategory: getCategoryBreakdown(reminders)
    };

    res.json({
      success: true,
      data: {
        reminders,
        summary
      },
      message: 'Calendar data for specific date retrieved successfully'
    });

  } catch (error) {
    console.error('Get calendar data by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get calendar data for date',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// Helper functions for calendar
const getStatusColor = (status: string): string => {
  const colors = {
    upcoming: '#3B82F6', // Blue
    overdue: '#EF4444',  // Red
    paid: '#10B981'      // Green
  };
  return colors[status as keyof typeof colors] || '#6B7280';
};

const getCategoryBreakdown = (reminders: any[]): { [key: string]: number } => {
  return reminders.reduce((acc, reminder) => {
    const category = reminder.category || 'other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
};

export const exportData = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Export feature coming soon' });
};

export const getExportStatus = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Export feature coming soon' });
};

export const downloadExport = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Export feature coming soon' });
};

export const getUsageStats = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: {}, message: 'Usage stats feature coming soon' });
};

export const getDailyUsage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.collection('usageTrackers').doc(`${userId}_${today}`);
    const usageDoc = await usageRef.get();

    if (usageDoc.exists()) {
      const usage = usageDoc.data();
      res.json({
        success: true,
        data: {
          transactions: usage.transactionsAdded || 0,
          analytics: usage.analyticsViewed || 0
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          transactions: 0,
          analytics: 0
        }
      });
    }
  } catch (error) {
    console.error('Get daily usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily usage',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const trackUsage = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Usage tracking feature coming soon' });
};

export const trackAnalyticsUsage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.collection('usageTrackers').doc(`${userId}_${today}`);
    
    const usageDoc = await usageRef.get();
    if (usageDoc.exists()) {
      await usageRef.update({
        analyticsViewed: (usageDoc.data().analyticsViewed || 0) + 1,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      await db.collection('usageTrackers').add({
        id: `${userId}_${today}`,
        userId,
        date: today,
        analyticsViewed: 1,
        transactionsAdded: 0,
        createdAt: serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    res.json({ success: true, message: 'Analytics usage tracked' });
  } catch (error) {
    console.error('Track analytics usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track analytics usage',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// Helper functions for reminders
const calculateNextDueDate = (dueDate: Date, recurringType: string): Date => {
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
};

const scheduleReminderNotifications = async (reminderId: string, userId: string, reminderData: any) => {
  try {
    // Schedule notifications based on reminderDays
    if (!reminderData.reminderDays || !Array.isArray(reminderData.reminderDays)) {
      return;
    }

    const dueDate = reminderData.dueDate.toDate ? reminderData.dueDate.toDate() : new Date(reminderData.dueDate);
    const now = new Date();
    
    for (const daysBefore of reminderData.reminderDays) {
      const notificationDate = new Date(dueDate.getTime() - daysBefore * 24 * 60 * 60 * 1000);
      
      // Only schedule if notification date is in the future
      if (notificationDate > now) {
        const notificationData = {
          userId,
          reminderId,
          type: 'reminder',
          title: `Payment Due ${daysBefore === 0 ? 'Today' : `in ${daysBefore} day${daysBefore === 1 ? '' : 's'}`}`,
          message: `${reminderData.title} - ${reminderData.currency} ${reminderData.amount}`,
          scheduledFor: Timestamp.fromDate(notificationDate),
          status: 'scheduled',
          reminderData: {
            title: reminderData.title,
            amount: reminderData.amount,
            currency: reminderData.currency,
            category: reminderData.category,
            dueDate: dueDate.toISOString()
          },
          createdAt: serverTimestamp()
        };

        await addDoc(collection(db, 'scheduledNotifications'), notificationData);
      }
    }

    // Schedule overdue notification for day after due date
    const overdueDate = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000);
    if (overdueDate > now) {
      const overdueNotificationData = {
        userId,
        reminderId,
        type: 'overdue',
        title: 'Payment Overdue',
        message: `${reminderData.title} was due yesterday - ${reminderData.currency} ${reminderData.amount}`,
        scheduledFor: Timestamp.fromDate(overdueDate),
        status: 'scheduled',
        reminderData: {
          title: reminderData.title,
          amount: reminderData.amount,
          currency: reminderData.currency,
          category: reminderData.category,
          dueDate: dueDate.toISOString()
        },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'scheduledNotifications'), overdueNotificationData);
    }

    console.log(`✅ Scheduled notifications for reminder: ${reminderData.title}`);
  } catch (error) {
    console.error('❌ Failed to schedule reminder notifications:', error);
  }
};

const updateReminderNotifications = async (reminderId: string, userId: string, reminderData: any) => {
  try {
    // Cancel existing notifications
    await cancelReminderNotifications(reminderId, userId);
    
    // Schedule new notifications if enabled and not paid
    if (reminderData.notificationEnabled && reminderData.status !== 'paid') {
      await scheduleReminderNotifications(reminderId, userId, reminderData);
    }
    
    console.log(`✅ Updated notifications for reminder: ${reminderData.title}`);
  } catch (error) {
    console.error('❌ Failed to update reminder notifications:', error);
  }
};

const cancelReminderNotifications = async (reminderId: string, userId: string) => {
  try {
    const notificationsQuery = query(
      collection(db, 'scheduledNotifications'),
      where('userId', '==', userId),
      where('reminderId', '==', reminderId),
      where('status', '==', 'scheduled')
    );

    const snapshot = await getDocs(notificationsQuery);
    const batch = writeBatch(db);

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { status: 'cancelled', cancelledAt: serverTimestamp() });
    });

    if (snapshot.docs.length > 0) {
      await batch.commit();
      console.log(`✅ Cancelled ${snapshot.docs.length} notifications for reminder: ${reminderId}`);
    }
  } catch (error) {
    console.error('❌ Failed to cancel reminder notifications:', error);
  }
};

export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  const incomeCategories = [
    'Salary', 'Freelance', 'Business', 'Investment', 'Dividend', 'Rental',
    'Bonus', 'Gift', 'Cashback', 'Refund', 'Side Hustle', 'Pension',
    'Government Benefits', 'Other'
  ];

  const expenseCategories = [
    'Rent', 'Mortgage', 'Home Maintenance', 'Property Tax', 'Home Insurance',
    'Car Payment', 'Car Insurance', 'Fuel', 'Car Maintenance', 'Public Transport',
    'Uber/Taxi', 'Parking', 'Groceries', 'Restaurant', 'Coffee',
    'Online Food Delivery', 'Office Meals', 'Electricity', 'Water', 'Gas',
    'Internet', 'Mobile Bill', 'Netflix', 'Spotify', 'Amazon Prime',
    'App Store', 'Software Subscriptions', 'Gym Membership', 'Other Subscriptions',
    'Home Loan EMI', 'Car Loan EMI', 'Personal Loan EMI', 'Credit Card Bill',
    'Education Loan EMI', 'Clothing', 'Electronics', 'Home & Garden', 'Books',
    'Online Shopping', 'Medical', 'Pharmacy', 'Gym', 'Sports', 'Wellness',
    'Movies', 'Games', 'Hobbies', 'Events', 'Flights', 'Hotels', 'Vacation',
    'Courses', 'Books & Learning', 'Professional Development', 'Haircut',
    'Cosmetics', 'Personal Items', 'Life Insurance', 'Health Insurance',
    'Term Insurance', 'Income Tax', 'Professional Services', 'SIP',
    'Fixed Deposit', 'PPF', 'Stocks', 'Mutual Funds', 'Cash Withdrawal',
    'Bank Charges', 'Other'
  ];

  res.json({
    success: true,
    data: {
      income: incomeCategories,
      expense: expenseCategories
    }
  });
};

export const getCategorySuggestions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: [], message: 'Category suggestions feature coming soon' });
};

export const searchTransactions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: [], message: 'Search feature coming soon' });
};

export const getFilterOptions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: {}, message: 'Filter options feature coming soon' });
};

export const parseStatement = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Statement parsing feature coming soon' });
};

export const getStatementImportStatus = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Statement parsing feature coming soon' });
};

export const confirmStatementImport = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Statement parsing feature coming soon' });
};

export const importTransactions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Import transactions feature coming soon' });
};

export const bulkAddTransactions = async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, message: 'Bulk add transactions feature coming soon' });
};

// Gmail Integration Endpoints
export const getGmailAuthUrl = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { GmailIntegrationService } = await import('../services/GmailIntegrationService');
    
    const gmailService = GmailIntegrationService.getInstance();
    const authUrl = await gmailService.generateAuthUrl(userId);

    res.json({
      success: true,
      data: { authUrl },
      message: 'Gmail authorization URL generated successfully'
    });

  } catch (error) {
    console.error('Get Gmail auth URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Gmail authorization URL',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const connectGmail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    const { GmailIntegrationService } = await import('../services/GmailIntegrationService');
    const gmailService = GmailIntegrationService.getInstance();
    
    const connection = await gmailService.exchangeCodeForTokens(code, userId);

    res.json({
      success: true,
      data: {
        email: connection.email,
        isConnected: connection.isConnected,
        autoSync: connection.autoSync,
        syncFrequency: connection.syncFrequency
      },
      message: 'Gmail connected successfully'
    });

  } catch (error) {
    console.error('Connect Gmail error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect Gmail',
      error: 'GMAIL_CONNECTION_FAILED'
    });
  }
};

export const getGmailStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { GmailIntegrationService } = await import('../services/GmailIntegrationService');
    
    const gmailService = GmailIntegrationService.getInstance();
    const isConnected = await gmailService.isGmailConnected(userId);
    
    if (isConnected) {
      const connection = await gmailService.getGmailConnection(userId);
      res.json({
        success: true,
        data: {
          isConnected: true,
          email: connection?.email,
          lastSyncAt: connection?.lastSyncAt,
          autoSync: connection?.autoSync,
          syncFrequency: connection?.syncFrequency
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          isConnected: false
        }
      });
    }

  } catch (error) {
    console.error('Get Gmail status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get Gmail status',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const syncGmailBills = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { GmailIntegrationService } = await import('../services/GmailIntegrationService');
    
    const gmailService = GmailIntegrationService.getInstance();
    const bills = await gmailService.syncBillsFromGmail(userId);

    // Convert Gmail bills to reminders
    const createdReminders = [];
    let successCount = 0;
    let failureCount = 0;

    for (const bill of bills) {
      try {
        const reminderData = {
          userId,
          title: bill.title,
          description: `Auto-detected from ${bill.from}`,
          amount: bill.amount,
          currency: bill.currency,
          category: bill.category,
          dueDate: bill.dueDate,
          status: bill.dueDate < new Date() ? 'overdue' : 'upcoming',
          isRecurring: false,
          reminderDays: [1, 3],
          notificationEnabled: true,
          autoDetected: true,
          emailSource: bill.from,
          notes: `Gmail sync - Message ID: ${bill.messageId}\\nCompany: ${bill.company}\\nConfidence: ${Math.round(bill.confidence * 100)}%`,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };

        // Check for duplicates
        const existingQuery = await db.collection('reminders')
          .where('userId', '==', userId)
          .where('emailSource', '==', bill.from)
          .where('amount', '==', bill.amount)
          .get();

        if (existingQuery.empty) {
          const docRef = await db.collection('reminders').add(reminderData);
          
          createdReminders.push({
            id: docRef.id,
            ...bill,
            reminderId: docRef.id
          });
          
          successCount++;
          
          // Schedule notifications (async)
          if (reminderData.notificationEnabled && reminderData.status !== 'paid') {
            scheduleReminderNotifications(docRef.id, userId, reminderData).catch(console.error);
          }
        } else {
          console.log(`Skipping duplicate bill: ${bill.title} from ${bill.from}`);
        }
      } catch (createError) {
        console.error('Failed to create reminder from Gmail bill:', createError);
        failureCount++;
      }
    }

    res.json({
      success: true,
      data: {
        billsFound: bills.length,
        remindersCreated: successCount,
        duplicatesSkipped: bills.length - successCount - failureCount,
        failures: failureCount,
        bills: createdReminders
      },
      message: `Gmail sync completed. Created ${successCount} reminders from ${bills.length} bills found.`
    });

  } catch (error) {
    console.error('Sync Gmail bills error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to sync Gmail bills',
      error: 'GMAIL_SYNC_FAILED'
    });
  }
};

export const disconnectGmail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { GmailIntegrationService } = await import('../services/GmailIntegrationService');
    
    const gmailService = GmailIntegrationService.getInstance();
    await gmailService.disconnectGmail(userId);

    res.json({
      success: true,
      message: 'Gmail disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect Gmail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Gmail',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// Notification Endpoints
export const getUserNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      limit = 20, 
      offset = 0, 
      unreadOnly = false, 
      type 
    } = req.query;

    const { NotificationService } = await import('../services/NotificationService');
    const notificationService = NotificationService.getInstance();

    const result = await notificationService.getUserNotifications(userId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      unreadOnly: unreadOnly === 'true',
      type: type as any
    });

    res.json({
      success: true,
      data: result,
      message: 'Notifications retrieved successfully'
    });

  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const markNotificationAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { NotificationService } = await import('../services/NotificationService');
    const notificationService = NotificationService.getInstance();

    await notificationService.markNotificationAsRead(id, userId);

    res.json({
      success: true,
      message: 'Notification marked as read successfully'
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message,
      error: 'NOTIFICATION_UPDATE_FAILED'
    });
  }
};

export const markAllNotificationsAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const { NotificationService } = await import('../services/NotificationService');
    const notificationService = NotificationService.getInstance();

    const count = await notificationService.markAllNotificationsAsRead(userId);

    res.json({
      success: true,
      data: { markedCount: count },
      message: `${count} notifications marked as read`
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { NotificationService } = await import('../services/NotificationService');
    const notificationService = NotificationService.getInstance();

    await notificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete notification';
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message,
      error: 'NOTIFICATION_DELETE_FAILED'
    });
  }
};

export const registerFCMToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token, deviceInfo } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    const { NotificationService } = await import('../services/NotificationService');
    const notificationService = NotificationService.getInstance();

    await notificationService.registerFCMToken(userId, token, deviceInfo);

    res.json({
      success: true,
      message: 'FCM token registered successfully'
    });

  } catch (error) {
    console.error('Register FCM token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register FCM token',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

export const removeFCMToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    const { NotificationService } = await import('../services/NotificationService');
    const notificationService = NotificationService.getInstance();

    await notificationService.removeFCMToken(token);

    res.json({
      success: true,
      message: 'FCM token removed successfully'
    });

  } catch (error) {
    console.error('Remove FCM token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove FCM token',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};