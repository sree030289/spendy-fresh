// src/config/env.ts
import { config } from 'dotenv';

config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  
  // Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'spendy-97913',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Email
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  
  // Google Cloud
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || 'spendy-97913',
  GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY || '',
  
  // Payment APIs
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '',
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
  
  // Banking APIs
  PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID || '',
  PLAID_SECRET: process.env.PLAID_SECRET || '',
  PLAID_ENV: process.env.PLAID_ENV || 'sandbox',
  
  // Security
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  
  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  
  // External APIs
  OZBARGAIN_BASE_URL: 'https://www.ozbargain.com.au',
  GROUPON_API_KEY: process.env.GROUPON_API_KEY || '',
  
  // Push Notifications
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || '',
  
  // AI Services
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  
  // QR Code
  QR_CODE_SIZE: parseInt(process.env.QR_CODE_SIZE || '200'),
  
  // Subscription
  SUBSCRIPTION_WEBHOOK_SECRET: process.env.SUBSCRIPTION_WEBHOOK_SECRET || '',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  isProduction: () => ENV.NODE_ENV === 'production',
  isDevelopment: () => ENV.NODE_ENV === 'development',
  isTest: () => ENV.NODE_ENV === 'test'
};
