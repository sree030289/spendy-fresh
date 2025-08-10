// src/routes/expenses.routes.ts
import { Router } from 'express';
import { ExpensesController } from '../controllers/expenses.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Apply rate limiting
router.use(generalLimiter);

// Expense CRUD operations
router.post('/',
  validateRequest(['title', 'amount', 'paidBy']),
  ExpensesController.createExpense
);

router.get('/',
  ExpensesController.getUserExpenses
);

router.get('/all',
  ExpensesController.getExpenses
);

router.get('/:expenseId',
  ExpensesController.getExpense
);

router.put('/:expenseId',
  ExpensesController.updateExpense
);

router.delete('/:expenseId',
  ExpensesController.deleteExpense
);

// Expense splitting
router.post('/:expenseId/mark-paid',
  ExpensesController.markSplitPaid
);

// Expense categories
router.get('/categories/list',
  ExpensesController.getExpenseCategories
);

// Expense statistics
router.get('/statistics/summary',
  ExpensesController.getExpenseStats
);

export default router;
