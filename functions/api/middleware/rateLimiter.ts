// src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class SimpleRateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;
  private message: any;

  constructor(windowMs: number, maxRequests: number, message: any) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  private getKey(req: Request): string {
    // Use IP address as key
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
    return ip || 'unknown';
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      
      if (!this.store[key] || this.store[key].resetTime < now) {
        // Initialize or reset the counter
        this.store[key] = {
          count: 1,
          resetTime: now + this.windowMs
        };
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.maxRequests.toString(),
          'X-RateLimit-Remaining': (this.maxRequests - 1).toString(),
          'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString()
        });
        
        return next();
      }
      
      this.store[key].count++;
      
      // Set rate limit headers
      const remaining = Math.max(0, this.maxRequests - this.store[key].count);
      res.set({
        'X-RateLimit-Limit': this.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString()
      });
      
      if (this.store[key].count > this.maxRequests) {
        return res.status(429).json(this.message);
      }
      
      next();
    };
  }
}

// Create rate limiter instances
const generalLimiterInstance = new SimpleRateLimiter(
  ENV.RATE_LIMIT_WINDOW_MS, // 15 minutes
  ENV.RATE_LIMIT_MAX_REQUESTS, // 100 requests
  {
    success: false,
    message: 'Too many requests from this IP, please try again later',
    error: 'RATE_LIMIT_EXCEEDED'
  }
);

const authLimiterInstance = new SimpleRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 requests
  {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    error: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
);

const passwordResetLimiterInstance = new SimpleRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // 3 requests
  {
    success: false,
    message: 'Too many password reset attempts, please try again later',
    error: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
  }
);

const uploadLimiterInstance = new SimpleRateLimiter(
  15 * 60 * 1000, // 15 minutes
  20, // 20 requests
  {
    success: false,
    message: 'Too many file uploads, please try again later',
    error: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  }
);

// Export middleware functions
export const generalLimiter = generalLimiterInstance.middleware();
export const authLimiter = authLimiterInstance.middleware();
export const passwordResetLimiter = passwordResetLimiterInstance.middleware();
export const uploadLimiter = uploadLimiterInstance.middleware();
