// src/routes/groups.routes.ts
import { Router } from 'express';
import { GroupsController } from '../controllers/groups.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Apply rate limiting
router.use(generalLimiter);

// Group CRUD operations
router.post('/',
  validateRequest(['name']),
  GroupsController.createGroup
);

router.get('/',
  GroupsController.getUserGroups
);

router.get('/:groupId',
  GroupsController.getGroup
);

router.put('/:groupId',
  GroupsController.updateGroup
);

router.delete('/:groupId',
  GroupsController.deleteGroup
);

// Group member management
router.post('/:groupId/members',
  validateRequest(['userId']),
  GroupsController.addMember
);

router.delete('/:groupId/members/:memberId',
  GroupsController.removeMember
);

// Group joining
router.post('/join/:inviteCode',
  GroupsController.joinGroup
);

router.post('/:groupId/invite',
  GroupsController.generateInviteCode
);

// Group expenses
router.get('/:groupId/expenses',
  GroupsController.getGroupExpenses
);

// Group balances
router.get('/:groupId/balances',
  GroupsController.getGroupBalances
);

export default router;
