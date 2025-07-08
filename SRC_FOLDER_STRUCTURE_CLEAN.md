# Spendy Fresh - Source Code Structure Documentation

## Table of Contents

1. [Overview](#overview)
2. [Components](#components)
3. [Services](#services)
4. [Screens](#screens)
5. [Hooks](#hooks)
6. [Types](#types)
7. [Utils](#utils)
8. [Constants](#constants)
9. [Contexts](#contexts)
10. [Navigation](#navigation)
11. [Configuration](#configuration)
12. [Data](#data)

---

## Overview

The `src` folder contains the main application code for Spendy Fresh, a comprehensive expense splitting and smart money management application. The architecture follows React Native best practices with clear separation of concerns.

---

## Components

### Core Components

#### QRCodeScanner.tsx

**Purpose**: QR code scanning functionality for sharing expenses and invites

**Key Functions**:
- `QRCodeScanner`: Main scanner component
- QR code detection and parsing
- Camera permission handling
- Barcode format validation

### Balance Components (balance/)

**Purpose**: Balance calculation and display components

**Key Components**:
- Balance overview displays
- Settlement summaries
- Debt/credit visualizations

### Common Components (common/)

**Purpose**: Reusable UI components across the app

**Key Components**:
- `Button`: Styled button component
- `Input`: Form input components
- `Card`: Card layout components
- `LoadingSpinner`: Loading indicators
- `Modal`: Base modal component

### Modal Components (modals/)

**Purpose**: Modal dialogs for various functionalities

#### AddExpenseModal.tsx

**Functions**:
- `AddExpenseModal`: Create new expenses
- Category selection (Food, Transport, Entertainment, etc.)
- Amount input and validation
- Member selection for splitting

#### EditExpenseModal.tsx

**Functions**:
- `EditExpenseModal`: Edit existing expenses
- Expense modification and validation
- Category updates
- Settlement status changes

#### ExpenseModal.tsx

**Functions**:
- `ExpenseModal`: Display expense details
- Expense analytics integration
- Filter and view toggles
- Smart banner integration

#### ImportExpensesModal.tsx

**Functions**:
- `ImportExpensesModal`: Import expenses from CSV
- CSV file parsing and validation
- Group member mapping
- Category mapping automation
- Import progress tracking

#### ImportSplitwise.tsx

**Functions**:
- `ImportSplitwiseModal`: Import data from Splitwise
- Splitwise CSV parsing
- Participant mapping
- Group creation/selection
- Data migration handling

#### Other Modal Components

- `CreateGroupModal.tsx`: Group creation interface
- `AddFriendModal.tsx`: Friend invitation system
- `PaymentModal.tsx`: Payment recording
- `QRCodeModal.tsx`: QR code generation for sharing
- `GroupDetailsModal.tsx`: Group information display
- `NotificationsModal.tsx`: Notification center
- `AnalyticsModal.tsx`: Expense analytics dashboard

### Reminder Components (reminders/)

**Purpose**: Reminder system components

#### AddReminderModal.tsx

**Functions**:
- `AddReminderModal`: Create new reminders
- Reminder scheduling
- Notification settings

#### EditReminderModal.tsx

**Functions**:
- `EditReminderModal`: Edit existing reminders
- Reminder modification
- Status updates

### Other Component Folders

- **offline/**: Offline functionality components
- **smartMoney/**: Smart money management components
- **splitting/**: Expense splitting components
- **subscription/**: Subscription management components
- **tour/**: App onboarding and tour components

---

## Services

### Core Services

#### BalanceManager.ts

**Purpose**: Balance calculation and management

**Key Functions**:
- `calculateBalances()`: Calculate user balances
- `getSettlementSuggestions()`: Generate settlement recommendations
- `updateBalance()`: Update balance records

#### DealsAPI.ts

**Purpose**: OzBargain deals integration

**Key Functions**:
- `DealsAPI.getDeals()`: Fetch deals from OzBargain
- `DealsAPI.searchDeals()`: Search deals by category
- `DealsAPI.getCachedDeals()`: Get cached deals
- `useDeals()`: React hook for deals management

**Interfaces**:
- `Deal`: Deal structure
- `DealsResponse`: API response format
- `UseDealsResult`: Hook return type

#### DeepLinkingService.ts

**Purpose**: Deep linking functionality

**Key Functions**:
- Deep link parsing
- Navigation handling
- Link generation

#### FriendsManager.ts

**Purpose**: Friend management system

**Key Functions**:
- Friend invitation handling
- Friend request management
- Contact integration

#### NotificationManager.ts

**Purpose**: Notification system management

**Key Functions**:
- Notification scheduling
- Push notification handling
- Notification history

#### SubscriptionService.ts

**Purpose**: Subscription and payment management

**Key Functions**:
- Subscription validation
- Payment processing
- Feature access control

#### Receipt and OCR Services

- `ocrService.ts`: OCR for receipt scanning
- `receiptParser.ts`: Receipt parsing and data extraction
- `useReceiptScanner.ts`: Receipt scanning hook

### AI Services (ai/)

#### AIService.ts

**Purpose**: AI processing and categorization

**Key Functions**:
- `AIService.categorizeExpense()`: Categorize expenses using AI
- `AIService.extractReceiptData()`: Extract data from receipts
- `AIService.generateInsights()`: Generate spending insights

**Interfaces**:
- `CategoryResult`: Categorization result
- `ReceiptData`: Receipt data structure
- `SpendingInsight`: Insight data

### Firebase Services (firebase/)

#### splitting.ts

**Purpose**: Firebase-based splitting functionality

**Key Functions**:
- `SplittingService`: Main splitting service
- `SplittingService.createExpense()`: Create new expenses
- `SplittingService.updateExpense()`: Update expenses
- `SplittingService.deleteExpense()`: Delete expenses
- `SplittingService.getUserGroups()`: Get user groups
- `SplittingService.createGroup()`: Create new groups
- `SplittingService.addFriend()`: Add friends
- `SplittingService.exportUserData()`: Export user data
- `SplittingService.getExpenseAnalytics()`: Get expense analytics

**Interfaces**:
- `Friend`: Friend data structure
- `Group`: Group data structure
- `Expense`: Expense data structure
- `ExpenseSplit`: Split data structure
- `ExportData`: Export data format

### Import Services (import/)

#### CSVImportService.ts

**Purpose**: CSV file import functionality

**Key Functions**:
- `CSVImportService.readCSVFile()`: Read CSV files
- `CSVImportService.parseCSVData()`: Parse CSV data
- `CSVImportService.importExpensesToGroup()`: Import expenses to group

**Interfaces**:
- `CSVExpenseData`: CSV expense structure
- `ImportResult`: Import result summary

### Notification Services (notifications/)

#### NotificationService.ts

**Purpose**: Comprehensive notification management

**Key Functions**:
- `NotificationService.scheduleNotification()`: Schedule notifications
- `NotificationService.cancelNotification()`: Cancel notifications
- `NotificationService.getNotificationSettings()`: Get settings
- `NotificationService.exportSettings()`: Export settings
- `NotificationService.importSettings()`: Import settings

### QR Code Services (qr/)

#### QRCodeService.ts

**Purpose**: QR code generation and parsing

**Key Functions**:
- `QRCodeService.generateQR()`: Generate QR codes
- `QRCodeService.parseQR()`: Parse QR codes
- QR code validation

**Interfaces**:
- `QRData`: QR code data structure
- `QRGenerationOptions`: QR generation options

### Smart Money Services (smartMoney/)

#### SmartMoneyService.ts

**Purpose**: Core smart money functionality

**Key Functions**:
- `SmartMoneyService.getTransactions()`: Get transactions
- `SmartMoneyService.analyzeSpending()`: Analyze spending patterns
- `SmartMoneyService.generateInsights()`: Generate AI insights
- `SmartMoneyService.predictExpenses()`: Predict future expenses
- `SmartMoneyService.exportTransactions()`: Export transaction data
- `SmartMoneyService.createBudgetFromCategory()`: Create budgets

**Interfaces**:
- `SmartTransaction`: Transaction structure
- `SmartAnalytics`: Analytics data
- `CategoryAnalytics`: Category analysis
- `MonthlyTrend`: Monthly trend data
- `AIInsight`: AI-generated insights
- `BudgetPerformance`: Budget performance metrics
- `PredictedExpense`: Expense predictions

#### dataService.ts

**Purpose**: Data management for smart money

**Key Functions**:
- `DataService.getInstance()`: Singleton instance
- `DataService.getExpenses()`: Get expenses
- `DataService.saveExpense()`: Save expenses
- `DataService.getIncome()`: Get income
- `DataService.saveIncome()`: Save income
- `DataService.getReminders()`: Get reminders
- `DataService.exportData()`: Export all data

### Other Service Folders

- **banking/**: Banking integration services
- **biometric/**: Biometric authentication
- **gmail/**: Gmail integration for bill detection
- **offline/**: Offline functionality services
- **payments/**: Payment processing services
- **reminders/**: Reminder services
- **subscription/**: Subscription management services

---

## Screens

### Authentication Screens (auth/)

**Purpose**: Authentication screens

**Key Screens**:
- `LoginScreen`: User login
- `RegisterScreen`: User registration
- `ForgotPasswordScreen`: Password reset
- `SplashScreen`: App loading

### Main Screens (main/)

**Purpose**: Main application screens

#### ExpensesScreen.tsx

**Purpose**: Main expenses display and management

**Key Functions**:
- `ExpensesScreen`: Main component
- Expense list display
- Category filtering
- Settlement tracking
- Location-based expenses

#### SmartMoneyApp.tsx

**Purpose**: Smart money management interface

**Key Functions**:
- Smart analytics dashboard
- AI-powered insights
- Budget management
- Predictive analysis

#### DealsHubScreen.tsx

**Purpose**: Deals and offers display

**Key Functions**:
- Deal browsing
- Category filtering
- Deal search
- Favorite deals

#### RealSplittingScreen.tsx

**Purpose**: Comprehensive splitting interface

**Key Functions**:
- `RealSplittingScreen`: Main splitting component
- Group management
- Expense splitting
- Friend management
- Settlement processing

#### RemindersScreen.tsx

**Purpose**: Reminders management

**Key Functions**:
- Reminder list display
- Reminder creation
- Status management
- Notification settings

### Profile Screens (profile/)

**Purpose**: User profile screens

**Key Screens**:
- Profile management
- Settings configuration
- Account preferences

---

## Hooks

### useAuth.tsx

**Purpose**: Authentication state management

**Key Functions**:
- `useAuth()`: Authentication hook
- `AuthProvider`: Auth context provider
- Login/logout handling
- User state management

### useBalances.ts

**Purpose**: Balance calculation and management

**Key Functions**:
- `useBalances()`: Main balance hook
- `useOverviewBalances()`: Overview-specific balances
- `useFriendsBalances()`: Friends-specific balances
- Balance calculations
- Settlement suggestions

### useTheme.tsx

**Purpose**: Theme management

**Key Functions**:
- `useTheme()`: Theme hook
- `ThemeProvider`: Theme context provider
- Dark/light mode switching
- Theme customization

---

## Types

### index.ts

**Purpose**: Core type definitions

**Key Types**:
- `User`: User data structure
- `AuthState`: Authentication state
- `AppTheme`: Theme configuration
- `Expense`: Expense data structure
- `Income`: Income data structure
- `Reminder`: Reminder data structure
- `Notification`: Notification structure
- `Analytics`: Analytics data
- `CategoryBreakdown`: Category analysis
- `TrendData`: Trend information
- `PredictionData`: Prediction results

### theme.ts

**Purpose**: Theme-specific type definitions

**Key Types**:
- `AppTheme`: Comprehensive theme interface
- `ShadowStyle`: Shadow styling
- Theme color definitions
- Spacing and layout types

### reminder.ts

**Purpose**: Reminder-specific types

**Key Types**:
- `ReminderSearchParams`: Search parameters
- `ReminderFilters`: Filter options
- `BulkReminderOperation`: Bulk operations
- `CalendarIntegration`: Calendar integration
- `ReminderExport`: Export functionality
- `ImportResult`: Import results

---

## Utils

### Purpose

Utility functions and helpers

**Key Functions**:
- Date formatting utilities
- Currency conversion
- Data validation
- Number formatting
- String manipulation

---

## Constants

### theme.ts

**Purpose**: Theme constants and configuration

**Key Constants**:
- `LIGHT_THEME`: Light theme configuration
- `DARK_THEME`: Dark theme configuration
- `COMMON_COLORS`: Shared color palette
- `GRADIENT_COLORS`: Gradient definitions
- `GRADIENTS`: Predefined gradients
- `createLinearGradient()`: Gradient utility function

### countries.ts

**Purpose**: Country and currency data

**Key Constants**:
- `COUNTRIES`: Country list with currency information
- Country codes and phone codes
- Currency symbols and flags

---

## Contexts

### Purpose

React context providers

**Key Contexts**:
- Authentication context
- Theme context
- Tour context
- Notification context

---

## Navigation

### MainTabNavigator.tsx

**Purpose**: Main navigation structure

**Key Functions**:
- Tab navigation setup
- Screen routing
- Navigation state management

---

## Configuration

### Purpose

App configuration files

**Key Files**:
- API endpoints
- Environment variables
- Feature flags
- Default settings

---

## Data

### Purpose

Static data and mock data

**Key Files**:
- Mock data for development
- Static configuration data
- Default values

---

## Additional Files

### fix-demo-data.js

**Purpose**: Demo data utilities

**Key Functions**:
- Demo data generation
- Data seeding
- Development utilities

---

## Architecture Overview

### Key Patterns Used

1. **Service Layer Architecture**: Clear separation between UI components and business logic
2. **Context API**: State management across the application
3. **Custom Hooks**: Reusable stateful logic
4. **TypeScript**: Strong typing throughout the application
5. **Modular Design**: Components organized by feature
6. **Firebase Integration**: Real-time data synchronization
7. **Offline Support**: Offline-first architecture with sync capabilities

### Data Flow

1. **Components** → Use **Hooks** → Call **Services** → Update **Contexts**
2. **Services** → Handle business logic → Firebase/API calls → Data processing
3. **Types** → Ensure type safety across all layers
4. **Utils** → Provide helper functions for common operations

This architecture provides a scalable, maintainable, and feature-rich foundation for the Spendy Fresh application.
