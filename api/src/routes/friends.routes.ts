// src/routes/friends.routes.ts
import { Router } from 'express';
import { FriendsController } from '../controllers/friends.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Apply rate limiting
router.use(generalLimiter);

// Friend request routes
router.post('/requests/send', 
  validateRequest(['recipientEmail']),
  FriendsController.sendFriendRequest
);

router.post('/requests/:requestId/accept',
  FriendsController.acceptFriendRequest
);

router.post('/requests/:requestId/reject',
  FriendsController.rejectFriendRequest
);

router.get('/requests',
  FriendsController.getFriendRequests
);

// Friends management routes
router.get('/',
  FriendsController.getFriends
);

router.delete('/:friendId',
  FriendsController.removeFriend
);

// Search and discover routes
router.get('/search',
  FriendsController.searchUsers
);

// Friend statistics routes
router.get('/stats',
  FriendsController.getFriendStats
);

router.get('/:friendId/profile',
  FriendsController.getFriendProfile
);

export default router;
