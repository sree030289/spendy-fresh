// src/routes/settlements.routes.ts
import { Router } from 'express';
import { SettlementsController } from '../controllers/settlements.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Apply rate limiting
router.use(generalLimiter);

// Settlement operations
router.post('/',
  validateRequest(['fromUserId', 'toUserId', 'amount', 'groupId']),
  SettlementsController.recordSettlement
);

router.get('/group/:groupId',
  SettlementsController.getGroupSettlements
);

router.get('/history/:groupId',
  SettlementsController.getSettlementHistory
);

router.get('/stats',
  SettlementsController.getSettlementStats
);

export default router;
