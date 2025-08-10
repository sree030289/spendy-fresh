// src/index.ts
import app from './app';
import { ENV } from './config/env';

// Initialize Firebase Admin SDK
import './config/firebase';

const PORT = ENV.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Spendy API Server started on port ${PORT}`);
  console.log(`📊 Environment: ${ENV.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API base URL: http://localhost:${PORT}/api`);
  console.log(`🔥 Firebase Project: ${ENV.FIREBASE_PROJECT_ID}`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
    const newPort = PORT + 1;
    const newServer = app.listen(newPort, () => {
      console.log(`🚀 Spendy API Server started on port ${newPort}`);
      console.log(`📊 Environment: ${ENV.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${newPort}/health`);
      console.log(`📚 API base URL: http://localhost:${newPort}/api`);
      console.log(`🔥 Firebase Project: ${ENV.FIREBASE_PROJECT_ID}`);
    });
    
    // Graceful shutdown for new server
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      newServer.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received. Shutting down gracefully...');
      newServer.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown for original server
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

export default app;
