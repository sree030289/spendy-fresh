// src/routes/money.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as moneyController from '../controllers/money.controller';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Personal Transactions
router.post('/transactions', moneyController.addTransaction);
router.get('/transactions', moneyController.getTransactions);
router.get('/transactions/:id', moneyController.getTransaction);
router.put('/transactions/:id', moneyController.updateTransaction);
router.delete('/transactions/:id', moneyController.deleteTransaction);
router.post('/transactions/import', moneyController.importTransactions);
router.post('/transactions/bulk', moneyController.bulkAddTransactions);

// Analytics
router.get('/analytics', moneyController.getAnalytics);
router.get('/analytics/:period', moneyController.getAnalyticsByPeriod);
router.post('/analytics/refresh', moneyController.refreshAnalytics);
router.get('/insights', moneyController.getAIInsights);

// Budget Management
router.post('/budgets', moneyController.createBudget);
router.get('/budgets', moneyController.getBudgets);
router.put('/budgets/:id', moneyController.updateBudget);
router.delete('/budgets/:id', moneyController.deleteBudget);
router.get('/budgets/performance', moneyController.getBudgetPerformance);

// Recurring Transactions
router.post('/recurring', moneyController.createRecurringTransaction);
router.get('/recurring', moneyController.getRecurringTransactions);
router.put('/recurring/:id', moneyController.updateRecurringTransaction);
router.delete('/recurring/:id', moneyController.deleteRecurringTransaction);
router.post('/recurring/:id/pause', moneyController.pauseRecurringTransaction);
router.post('/recurring/:id/resume', moneyController.resumeRecurringTransaction);

// Smart Reminders
router.post('/reminders', moneyController.createSmartReminder);
router.get('/reminders', moneyController.getSmartReminders);
router.put('/reminders/:id', moneyController.updateSmartReminder);
router.delete('/reminders/:id', moneyController.deleteSmartReminder);
router.get('/reminders/upcoming', moneyController.getUpcomingReminders);

// Calendar Data
router.get('/calendar', moneyController.getCalendarData);
router.get('/calendar/:date', moneyController.getCalendarDataByDate);

// Data Export
router.post('/export', moneyController.exportData);
router.get('/export/:exportId', moneyController.getExportStatus);
router.get('/export/:exportId/download', moneyController.downloadExport);

// Usage Tracking
router.get('/usage', moneyController.getUsageStats);
router.post('/usage/track', moneyController.trackUsage);

// Categories
router.get('/categories', moneyController.getCategories);
router.get('/categories/suggestions', moneyController.getCategorySuggestions);

// Search & Filters
router.post('/search', moneyController.searchTransactions);
router.get('/filters', moneyController.getFilterOptions);

// Statement Parsing
router.post('/statements/parse', moneyController.parseStatement);
router.get('/statements/:importId', moneyController.getStatementImportStatus);
router.post('/statements/:importId/confirm', moneyController.confirmStatementImport);

export default router;
