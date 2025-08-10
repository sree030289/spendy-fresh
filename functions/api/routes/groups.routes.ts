// src/routes/groups.routes.ts
import { Router } from 'express';
import { GroupsController } from '../controllers/groups.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest, ValidationRules } from '../middleware/validation';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Apply rate limiting
router.use(generalLimiter);

// Group CRUD operations
router.post('/', 
  (req, res, next) => {
    console.log('🔍 Groups POST route hit, about to validate');
    next();
  },
  validateRequest(ValidationRules.createGroup),
  (req, res, next) => {
    console.log('🔍 Groups POST route validation passed, calling controller');
    next();
  },
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
  validateRequest(ValidationRules.validateUserId),
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
