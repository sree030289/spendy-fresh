import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/verify-email', AuthController.verifyEmail);

// Protected routes (authentication required)
router.get('/profile', AuthMiddleware.authenticateJWT, AuthController.getProfile);
router.put('/profile', AuthMiddleware.authenticateJWT, AuthController.updateProfile);
router.post('/change-password', AuthMiddleware.authenticateJWT, AuthController.changePassword);

export default router;
