# Meet-n-Split Environment Management System

## Overview

This system provides centralized environment management for the Meet-n-Split app, allowing easy switching between local development (Firebase Emulator), development cloud (spendy-develop), and production (spendy-97913) environments with a single command.

## 🎯 Key Features

- **Single Environment Control**: Change `SPENDY_ENV` variable to switch everything
- **Three Environments**: Local emulator, development cloud, and production
- **Centralized Configuration**: All endpoints managed in one place
- **Firebase Integration**: Automatic emulator/cloud switching
- **Admin-Friendly**: Simple commands for environment switching
- **TypeScript Support**: Full type safety with centralized Firebase services

## 🚀 Quick Start

### Environment Switching Commands

```bash
# Switch to local development (Firebase Emulator)
npm run env:local

# Switch to development cloud (spendy-develop)
npm run env:development

# Switch to production (spendy-97913)
npm run env:production

# Check current environment status
npm run env:status

# Verify environment configuration
npm run env:verify
```

### Manual Environment Control

Edit `.env` file and change `SPENDY_ENV`:

```properties
# Options: local | development | production
SPENDY_ENV=local
```

## 📁 File Structure

### Core Configuration Files

```
config/
├── environments.js          # Master environment configuration
├── 
├── .env                     # Environment control variable
├── app.config.js           # Expo configuration (environment-aware)
└── scripts/
    ├── env-switch.sh       # Environment switching script
    ├── env-status.sh       # Environment status checker
    └── verify-environment.js # Configuration verification
```

### Firebase Service Integration

```
src/services/
├── firebase/
│   ├── config.ts           # Centralized Firebase initialization
│   ├── auth.ts            # Authentication service
│   ├── index.ts           # Service exports
├── database/
│   └── index.ts           # Database service wrapper
└── auth/
    └── index.ts           # Auth service wrapper
```

## 🌍 Environment Details

### Local Development
- **Firebase**: Emulator Suite (localhost)
- **Project**: spendy-develop (emulated)
- **API**: http://127.0.0.1:5001/spendy-develop/us-central1/meetnsplitApi
- **Features**: Full debugging, HTTP allowed, verbose logging
- **Use Case**: Local development and testing

### Development Cloud
- **Firebase**: Cloud Functions
- **Project**: spendy-develop
- **API**: https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi
- **Features**: Debugging enabled, HTTPS only
- **Use Case**: Cloud testing and development

### Production
- **Firebase**: Cloud Functions
- **Project**: spendy-97913
- **API**: https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi
- **Features**: No debugging, HTTPS only, production security
- **Use Case**: Live production environment

## 🔧 Configuration API

### Environment Configuration Access

```javascript
// Import centralized config
import { getConfig, getCurrentEnvironment } from '@/config/environments';

// Get current environment
const env = getCurrentEnvironment();
console.log(env.name); // "Local Development", "Development Cloud", or "Production"

// Get configuration helper methods
const config = getConfig();

// Firebase settings
const firebaseConfig = config.getFirebaseConfig();
const apiUrl = config.getApiBaseUrl();

// Environment checks
if (config.isLocal()) {
  // Local development logic
}

if (config.isProduction()) {
  // Production-specific logic
}
```

### Firebase Service Usage

```typescript
// Import centralized Firebase services
import { 
  getFirebaseApp, 
  getFirebaseAuth, 
  getFirebaseFirestore, 
  getFirebaseStorage 
} from '@/services/firebase/config';

// Services automatically use correct environment
const auth = await getFirebaseAuth();
const db = await getFirebaseFirestore();
const storage = await getFirebaseStorage();
```

## 🛠 Firebase Emulator Setup

### Required for Local Development

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase (one-time setup)
firebase login

# Start emulator suite (automatic ports)
firebase emulators:start

# Or start specific services
firebase emulators:start --only functions,firestore,auth,storage
```

### Emulator Ports (Local Environment)

- **Auth**: localhost:9099
- **Firestore**: localhost:8080
- **Functions**: localhost:5001
- **Storage**: localhost:9199
- **Database**: localhost:9000
- **Hosting**: localhost:5000
- **UI**: localhost:4000

## 📱 Development Workflow

### 1. Local Development
```bash
# Set to local environment
npm run env:local

# Start Firebase emulator
firebase emulators:start

# Start Expo development server
npx expo start --clear
```

### 2. Cloud Testing
```bash
# Switch to development cloud
npm run env:development

# Restart Expo to pick up changes
npx expo start --clear
```

### 3. Production Deployment
```bash
# Switch to production
npm run env:production

# Build for production
npm run build:production
```

## 🔍 Troubleshooting

### Common Issues

1. **Environment not switching**
   ```bash
   # Verify current environment
   npm run env:verify
   
   # Check .env file
   cat .env | grep SPENDY_ENV
   
   # Clear and restart
   npx expo start --clear
   ```

2. **Firebase connection issues**
   ```bash
   # Check Firebase emulator status
   npm run env:status
   
   # Restart emulator
   firebase emulators:start --only functions
   ```

3. **TypeScript errors**
   ```bash
   # Check for compilation errors
   npx tsc --noEmit
   
   # Clear Metro cache
   npx expo start --clear
   ```

### Environment Verification

```bash
# Full environment verification
npm run env:verify

# Check specific environment
SPENDY_ENV=development npm run env:verify
```

## 📋 Environment Status Indicators

### Visual Indicators in App
- **Local**: Green indicator, "LOCAL DEV" badge
- **Development**: Yellow indicator, "DEV CLOUD" badge  
- **Production**: Red indicator, "PRODUCTION" badge

### Log Messages
- Environment switches are logged to console
- Firebase service initialization shows environment details
- API calls include environment context

## 🔐 Security Considerations

### Local Development
- Uses development Firebase project
- HTTP connections allowed
- Debug logging enabled
- Test credentials

### Development Cloud
- Uses development Firebase project
- HTTPS enforced
- Limited debug logging
- Development credentials

### Production
- Uses production Firebase project
- HTTPS enforced
- No debug logging
- Production credentials with secrets

## 🚀 Deployment Guide

### Environment-Specific Builds

```bash
# Local development build
SPENDY_ENV=local npx expo run:ios

# Development cloud build
SPENDY_ENV=development npx expo run:ios

# Production build
SPENDY_ENV=production npx expo run:ios --configuration Release
```

### EAS Build Configuration

The `app.config.js` automatically configures builds based on `SPENDY_ENV`:

```javascript
// Automatic configuration based on environment
const config = {
  name: ENV.isProduction() ? "Meet-n-Split" : `Meet-n-Split (${ENV.environment.name})`,
  // ... other environment-specific settings
};
```

## 📚 Additional Resources

- [Firebase Emulator Documentation](https://firebase.google.com/docs/emulator-suite)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [React Native Firebase](https://rnfirebase.io/)

---

## 🎉 Summary

This environment management system provides:

✅ **Single Command Switching**: Change environments with one command  
✅ **Centralized Configuration**: All settings in one place  
✅ **Firebase Integration**: Automatic emulator/cloud switching  
✅ **TypeScript Support**: Full type safety  
✅ **Admin-Friendly**: Easy for developers and admins  
✅ **Production Ready**: Secure production configuration  

**Result**: You can now easily switch between local emulator, development cloud, and production environments for admin purposes, exactly as requested!
