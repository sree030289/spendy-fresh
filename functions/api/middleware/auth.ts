// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { ENV } from '../config/env';
import { DatabaseService, COLLECTIONS } from '../config/database';
import { CryptoUtils } from '../utils/crypto';
import { ApiError } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName: string;
    currency?: string;
    profileImage?: string;
    profilePicture?: string;
    isPremium?: boolean;
  };
}

export class AuthMiddleware {
  // JWT Authentication
  static async authenticateJWT(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required',
          error: 'MISSING_TOKEN'
        });
      }

      try {
        const decoded = CryptoUtils.verifyJWTToken(token, ENV.JWT_SECRET);
        
        // Get user from database
        const user = await DatabaseService.getDocument(COLLECTIONS.USERS, decoded.userId) as any;
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found',
            error: 'USER_NOT_FOUND'
          });
        }

        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isPremium: user.isPremium || false
        };

        next();
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
          error: 'INVALID_TOKEN'
        });
      }
    } catch (error) {
      console.error('JWT Auth error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: 'AUTH_ERROR'
      });
    }
  }

  // Firebase Authentication (alternative)
  static async authenticateFirebase(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required',
          error: 'MISSING_TOKEN'
        });
      }

      try {
        const decodedToken = await auth.verifyIdToken(token);
        
        // Get user from database
        const user = await DatabaseService.getDocument(COLLECTIONS.USERS, decodedToken.uid) as any;
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found',
            error: 'USER_NOT_FOUND'
          });
        }

        req.user = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isPremium: user.isPremium || false
        };

        next();
      } catch (firebaseError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Firebase token',
          error: 'INVALID_FIREBASE_TOKEN'
        });
      }
    } catch (error) {
      console.error('Firebase Auth error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: 'AUTH_ERROR'
      });
    }
  }

  // Optional authentication (for endpoints that work with or without auth)
  static async optionalAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        try {
          const decoded = CryptoUtils.verifyJWTToken(token, ENV.JWT_SECRET);
          const user = await DatabaseService.getDocument(COLLECTIONS.USERS, decoded.userId) as any;
          
          if (user) {
            req.user = {
              id: user.id,
              email: user.email,
              fullName: user.fullName,
              isPremium: user.isPremium || false
            };
          }
        } catch (error) {
          // Ignore token errors for optional auth
        }
      }

      next();
    } catch (error) {
      // Ignore errors for optional auth
      next();
    }
  }

  // Check if user is premium
  static requirePremium(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'NOT_AUTHENTICATED'
      });
    }

    if (!req.user.isPremium) {
      return res.status(403).json({
        success: false,
        message: 'Premium subscription required',
        error: 'PREMIUM_REQUIRED'
      });
    }

    next();
  }

  // Check if user owns resource
  static checkResourceOwnership(userIdField: string = 'userId') {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const resourceUserId = req.params[userIdField] || req.body[userIdField];
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'NOT_AUTHENTICATED'
        });
      }

      if (req.user.id !== resourceUserId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          error: 'ACCESS_DENIED'
        });
      }

      next();
    };
  }
}

// Export middleware function for routes
export const authMiddleware = AuthMiddleware.authenticateJWT;
