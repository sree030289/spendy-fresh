// src/app.ts
import express from 'express';
import { ENV } from './config/env';
import { errorHandler } from './middleware/error';
import { generalLimiter } from './middleware/rateLimiter';

// Import route files
import authRoutes from './routes/auth.routes';
import friendsRoutes from './routes/friends.routes';
import groupsRoutes from './routes/groups.routes';
import expensesRoutes from './routes/expenses.routes';

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // List of allowed origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8081', // Expo dev server
    'exp://localhost:19000', // Expo dev
    'exp://192.168.1.100:19000' // Expo on local network
  ];

  // Allow requests with no origin (mobile apps, Postman, etc.) or from allowed origins
  if (!origin || ENV.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Global rate limiting (less restrictive for general endpoints)
app.use('/api', generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Spendy API is running',
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV,
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/expenses', expensesRoutes);

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: 'NOT_FOUND'
  });
});

// Global error handler (must be last)
app.use(errorHandler);

const PORT = ENV.PORT || 8000;

// Start server
if (ENV.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Spendy API Server running on port ${PORT}`);
    console.log(`📊 Environment: ${ENV.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API base URL: http://localhost:${PORT}/api`);
  });
}

export default app;
