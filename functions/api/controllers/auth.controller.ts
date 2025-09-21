// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { DatabaseService, COLLECTIONS } from '../config/database';
import { ENV } from '../config/env';
import { CryptoUtils } from '../utils/crypto';
import { 
  BadRequestError, 
  UnauthorizedError, 
  ConflictError, 
  ValidationError,
  NotFoundError 
} from '../middleware/error';
import { AuthenticatedRequest } from '../middleware/auth';
import { User, ApiResponse } from '../types';

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, fullName, mobile, country, currency } = req.body;

      // Validate required fields
      if (!email || !password || !fullName || !country) {
        throw new ValidationError('Email, password, full name, and country are required');
      }

      if (password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters long');
      }

      // Check if user already exists
      const existingUsers = await DatabaseService.queryDocuments(
        COLLECTIONS.USERS,
        { email: email.toLowerCase() }
      );

      if (existingUsers.length > 0) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await CryptoUtils.hashPassword(password);

      // Create user data
      const userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
        email: email.toLowerCase(),
        fullName: fullName.trim(),
        name: fullName.trim(), // Alias
        mobile: mobile || '',
        phoneNumber: mobile || '', // Alias
        country: country.toUpperCase(),
        currency: currency?.toUpperCase() || 'USD',
        biometricEnabled: false,
        isPremium: false,
        subscriptionStatus: 'expired'
      };

      // Create user in Firestore
      const userId = await DatabaseService.createDocument(COLLECTIONS.USERS, {
        ...userData,
        password: hashedPassword
      });

      // Generate JWT token
      const token = CryptoUtils.createJWTToken({ userId, email: userData.email }, ENV.JWT_SECRET);

      const response: ApiResponse = {
        success: true,
        message: 'User registered successfully',
        data: {
          token,
          user: {
            id: userId,
            email: userData.email,
            fullName: userData.fullName,
            currency: userData.currency,
            isPremium: userData.isPremium
          }
        }
      };

      res.status(201).json(response);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      // Find user by email
      const users = await DatabaseService.queryDocuments(
        COLLECTIONS.USERS,
        { email: email.toLowerCase() }
      );

      if (users.length === 0) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const user = users[0] as any;

      // Verify password
      const isValidPassword = await CryptoUtils.verifyPassword(password, user.password);
      if (!isValidPassword) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Generate JWT token
      const token = CryptoUtils.createJWTToken({ userId: user.id, email: user.email }, ENV.JWT_SECRET);

      // Update last login
      await DatabaseService.updateDocument(COLLECTIONS.USERS, user.id, {
        lastLoginAt: new Date()
      });

      const response: ApiResponse = {
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            currency: user.currency,
            profileImage: user.profileImage || user.profilePicture,
            isPremium: user.isPremium
          }
        }
      };

      res.json(response);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user profile
   * GET /api/auth/profile
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const user = await DatabaseService.getDocument(COLLECTIONS.USERS, userId) as any;
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Remove sensitive information
      const { password, resetToken, resetTokenExpiry, verificationCode, ...userProfile } = user;

      const response: ApiResponse = {
        success: true,
        message: 'Profile retrieved successfully',
        data: { user: userProfile }
      };

      res.json(response);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fullName, mobile, country, currency, biometricEnabled, profilePicture, pushToken } = req.body;

      const updateData: any = {
        updatedAt: new Date()
      };

      if (fullName) {
        updateData.fullName = fullName.trim();
        updateData.name = fullName.trim(); // Alias
      }
      if (mobile !== undefined) {
        updateData.mobile = mobile;
        updateData.phoneNumber = mobile; // Alias
      }
      if (country) updateData.country = country.toUpperCase();
      if (currency) updateData.currency = currency.toUpperCase();
      if (biometricEnabled !== undefined) updateData.biometricEnabled = biometricEnabled;
      if (profilePicture !== undefined) {
        updateData.profilePicture = profilePicture;
        updateData.profileImage = profilePicture; // Alias
      }
      if (pushToken !== undefined) {
        updateData.pushToken = pushToken;
        console.log('📱 Updating push token for user:', userId, 'Token:', pushToken ? `${pushToken.substring(0, 20)}...` : 'null');
      }

      await DatabaseService.updateDocument(COLLECTIONS.USERS, userId, updateData);

      const updatedUser = await DatabaseService.getDocument(COLLECTIONS.USERS, userId) as any;
      const { password, resetToken, resetTokenExpiry, verificationCode, ...userProfile } = updatedUser;

      const response: ApiResponse = {
        success: true,
        message: 'Profile updated successfully',
        data: { user: userProfile }
      };

      res.json(response);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Change password for authenticated user
   * POST /api/auth/change-password
   */
  static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      if (!currentPassword || !newPassword) {
        throw new ValidationError('Current password and new password are required');
      }

      if (newPassword.length < 6) {
        throw new ValidationError('New password must be at least 6 characters long');
      }

      // Get user
      const user = await DatabaseService.getDocument(COLLECTIONS.USERS, userId) as any;
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isValidPassword = await CryptoUtils.verifyPassword(currentPassword, user.password);
      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await CryptoUtils.hashPassword(newPassword);

      // Update password
      await DatabaseService.updateDocument(COLLECTIONS.USERS, userId, {
        password: hashedNewPassword,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Forgot password - send reset email
   * POST /api/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        throw new ValidationError('Email is required');
      }

      // Check if user exists
      const users = await DatabaseService.queryDocuments(COLLECTIONS.USERS, { email });
      if (users.length === 0) {
        // Don't reveal if user exists for security
        res.json({
          success: true,
          message: 'If this email is registered, you will receive a password reset link'
        });
        return;
      }

      const user = users[0] as any;

      // Generate reset token
      const resetToken = CryptoUtils.generateToken();
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Save reset token
      await DatabaseService.updateDocument(COLLECTIONS.USERS, user.id, {
        resetToken,
        resetTokenExpiry,
        updatedAt: new Date()
      });

      // TODO: Send email with reset link
      // await EmailService.sendPasswordResetEmail(email, resetToken);

      res.json({
        success: true,
        message: 'If this email is registered, you will receive a password reset link',
        data: { resetToken } // Remove this in production
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset password with token
   * POST /api/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        throw new ValidationError('Reset token and new password are required');
      }

      if (newPassword.length < 6) {
        throw new ValidationError('Password must be at least 6 characters long');
      }

      // Find user by reset token
      const users = await DatabaseService.queryDocuments(COLLECTIONS.USERS, { resetToken });
      if (users.length === 0) {
        throw new ValidationError('Invalid or expired reset token');
      }

      const user = users[0] as any;

      // Check if token is expired
      if (!user.resetTokenExpiry || new Date() > new Date(user.resetTokenExpiry)) {
        throw new ValidationError('Reset token has expired');
      }

      // Hash new password
      const hashedPassword = await CryptoUtils.hashPassword(newPassword);

      // Update password and clear reset token
      await DatabaseService.updateDocument(COLLECTIONS.USERS, user.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify email address
   * POST /api/auth/verify-email
   */
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email, verificationCode } = req.body;

      if (!email || !verificationCode) {
        throw new ValidationError('Email and verification code are required');
      }

      // Find user by email
      const users = await DatabaseService.queryDocuments(COLLECTIONS.USERS, { email });
      if (users.length === 0) {
        throw new NotFoundError('User not found');
      }

      const user = users[0] as any;

      // Check verification code
      if (user.verificationCode !== verificationCode) {
        throw new ValidationError('Invalid verification code');
      }

      // Check if code is expired (valid for 1 hour)
      const codeAge = Date.now() - new Date(user.verificationCodeCreatedAt || user.createdAt).getTime();
      if (codeAge > 3600000) { // 1 hour
        throw new ValidationError('Verification code has expired');
      }

      // Mark email as verified
      await DatabaseService.updateDocument(COLLECTIONS.USERS, user.id, {
        emailVerified: true,
        verificationCode: null,
        verificationCodeCreatedAt: null,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      throw error;
    }
  }
}
