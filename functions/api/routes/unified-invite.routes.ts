import express from 'express';
import { UnifiedInviteController } from '../controllers/unified-invite.controller';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const router = express.Router();

/**
 * Unified Invite Routes
 * 
 * This router handles all unified invite operations including:
 * - Creating invites for both registered and unregistered users
 * - Accepting and declining invites
 * - Finding pending invites during registration
 * - Managing friendships through invite flow
 */

// ====== PUBLIC ROUTES (no auth required) ======

/**
 * Find pending invites by phone/email
 * GET /api/invites/unified/pending?phone=...&email=...
 * 
 * Used during user registration to check for pending invites
 */
router.get('/pending', asyncHandler(UnifiedInviteController.findPendingInvites));

/**
 * Check for pending invites during registration
 * POST /api/invites/unified/check-registration
 * 
 * Auto-converts pending invites when a user signs up
 */
router.post('/check-registration', asyncHandler(UnifiedInviteController.checkRegistrationInvites));

/**
 * Search users by contact info
 * GET /api/users/search-contact?q=...
 * 
 * Search for existing users by phone number or email
 */
router.get('/search-contact', asyncHandler(UnifiedInviteController.searchUsersByContact));

// ====== AUTHENTICATED ROUTES ======

/**
 * Create a unified invite
 * POST /api/invites/unified
 * 
 * Body: {
 *   recipientPhone?: string,
 *   recipientEmail?: string,
 *   message?: string,
 *   sentVia: 'SMS' | 'EMAIL' | 'PUSH' | 'QR',
 *   autoAccept?: boolean
 * }
 */
router.post('/', authMiddleware, asyncHandler(UnifiedInviteController.createUnifiedInvite));

/**
 * Get invite by ID
 * GET /api/invites/unified/:inviteId
 */
router.get('/:inviteId', authMiddleware, asyncHandler(UnifiedInviteController.getUnifiedInvite));

/**
 * Accept a unified invite
 * POST /api/invites/unified/:inviteId/accept
 */
router.post('/:inviteId/accept', authMiddleware, asyncHandler(UnifiedInviteController.acceptUnifiedInvite));

/**
 * Decline a unified invite
 * POST /api/invites/unified/:inviteId/decline
 */
router.post('/:inviteId/decline', authMiddleware, asyncHandler(UnifiedInviteController.declineUnifiedInvite));

/**
 * Create friendship directly (helper endpoint)
 * POST /api/friends/create-friendship
 * 
 * Body: {
 *   userId1: string,
 *   userId2: string
 * }
 */
router.post('/create-friendship', authMiddleware, asyncHandler(UnifiedInviteController.createFriendshipEndpoint));

export default router;
