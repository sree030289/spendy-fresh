# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Main Project (React Native Expo)
```bash
# Development
yarn start                    # Start Expo development server
yarn android                 # Run on Android device/emulator
yarn ios                     # Run on iOS device/simulator
yarn web                     # Run on web browser

# Testing
yarn test                     # Run Jest tests

# Package management
yarn install                  # Install dependencies
```

### Firebase Cloud Functions
```bash
# Located in /functions directory
cd functions
npm run serve                 # Start Firebase emulators
npm run deploy               # Deploy functions to Firebase
npm run logs                 # View function logs
npm run lint                 # Run ESLint (currently disabled - exits 0)
```

## Project Architecture

### Tech Stack
- **Frontend**: React Native with Expo SDK 53
- **Backend**: Firebase Cloud Functions (Serverless)
- **Database**: Firebase Firestore
- **Authentication**: Custom JWT implementation via API Service
- **Navigation**: React Navigation 7 with bottom tabs + swipe support
- **State Management**: React Context (AuthProvider, ThemeProvider)
- **Notifications**: Expo Notifications + Custom Smart Money system

### Core Architecture Patterns

#### Serverless Architecture
The project uses Firebase Cloud Functions as the primary backend. All data operations go through `ApiService.ts` singleton:

```typescript
// Data flow
App -> useAuth/Components -> ApiService -> Firebase Functions -> Firestore
```

#### Firebase Functions Backend
- **Primary**: Firebase Cloud Functions (`/functions/index.js`) - handles all API operations
- **Features**: auth, CRUD operations, friends, groups, expenses, notifications, scheduled tasks
- **Serverless**: No server infrastructure to maintain

#### Navigation Structure
- **Main App**: Bottom tab navigator with 5 tabs (Split, Smart Money, Add Action, Reminders, Profile)
- **Add Action**: Central floating action button that opens unified modal
- **Swipe Navigation**: Custom pan gesture handler enables swipe between tabs
- **Modal System**: Extensive modal system for all user interactions

#### Authentication Flow
- Custom JWT authentication via ApiService
- Session persistence in AsyncStorage
- Profile data synced between API and local storage
- Biometric authentication support (not fully implemented)

### Key Service Classes

#### ApiService (`src/services/api/ApiService.ts`)
Singleton handling all API communication:
- REST endpoints for auth, groups, expenses, friends
- Token management and session persistence
- Error handling with graceful 404 fallbacks for new users
- Request/response logging

#### AuthProvider (`src/hooks/useAuth.tsx`)
React Context managing authentication state:
- Login/register/logout operations
- User profile management
- Token persistence and validation
- Session restoration on app startup

#### NotificationManager & Smart Money Services
Complex notification system with multiple layers:
- `RealNotificationService`: Push notification handling
- `SmartMoneyService`: Financial analytics and insights
- `FirebaseNotificationService`: Firebase-based scheduled notifications
- `NotificationManager`: Centralized notification orchestration

### Component Architecture

#### Modal System
Comprehensive modal architecture with 20+ specialized modals:
- **AddExpenseModal**: Expense creation with group/friend splitting
- **UnifiedActionModal**: Central action dispatcher
- **SubscriptionModal**: Premium feature gating
- **GroupDetailsModal**: Group management interface
- **AnalyticsModal**: Financial insights display

#### Screen Structure
Main screens follow consistent patterns:
- **Split Screen** (`RealSplittingScreen`): Group expense management
- **Smart Money** (`SmartMoneyApp`): Personal finance analytics
- **Reminders** (`RemindersScreen`): Bill and payment reminders
- **Profile** (`ProfileScreen`): User settings and preferences

### Data Models

#### Core Types (`src/types/index.ts`)
- **User**: Profile with subscription status, biometric settings
- **Expense/Income**: Financial transactions with categorization
- **Reminder**: Scheduled payment reminders with recurring support
- **Analytics**: Financial insights with predictions and trends

### Development Patterns

#### Path Aliases
Uses `@/` alias pointing to `src/` directory for clean imports:
```typescript
import { ApiService } from '@/services/api/ApiService';
import { useAuth } from '@/hooks/useAuth';
```

#### State Management
Follows React Context pattern with providers:
- `AuthProvider`: User authentication state
- `ThemeProvider`: Dark/light theme management

#### Error Handling
- API calls use try/catch with graceful fallbacks
- 404 errors for new users return empty arrays instead of throwing
- User-facing error messages through Alert.alert()

#### Testing
- Jest configuration with React Native testing library
- Integration tests for settlement algorithms
- Component tests for modals

## Firebase Functions Integration Notes

### Base URLs
- **Production**: `https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi`
- **Development**: `https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi`

### Key API Patterns
- All requests include JWT Bearer token when authenticated
- Consistent response format: `{ success: boolean, message: string, data?: any }`
- Rate limiting and validation on Firebase Functions
- Graceful handling of new user scenarios (empty data arrays)

### Firebase Integration
- Firestore as primary database
- Firebase Functions for all API endpoints and background tasks
- Push notifications via Firebase Cloud Messaging
- File storage for profile pictures (planned)
- Scheduled functions for notifications and cleanup

## Important Development Notes

### Package Manager
Uses **Yarn** as primary package manager (configured in packageManager field)

### Build System
- **Expo CLI** for React Native builds
- **Firebase Functions** for serverless backend deployment
- **Metro** bundler for React Native
- **Jest** for testing

### Environment Variables
Firebase Functions require `.env` configuration with Firebase project ID, JWT secrets, and other service credentials.