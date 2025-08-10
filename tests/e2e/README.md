# Spendy API Test Suite

Comprehensive Playwright API test suite for the Spendy expense splitting application.

## Overview

This test suite provides complete coverage of the Spendy API functionality, including:

- **Authentication Flow**: User registration, login, profile management
- **Friend Management**: Search, request, accept/decline friends, relationship management
- **Group Management**: Create, join, leave groups, member management, permissions
- **Expense Management**: Create expenses with multiple split types (equal, custom, percentage)
- **Settlement Flow**: Calculate optimal settlements, record payments, balance tracking
- **Notification System**: Friend requests, group activities, expense alerts, settlement notifications
- **Complete Integration**: End-to-end user journeys combining all features

## Test Structure

```
tests/e2e/
├── helpers/
│   └── api-helpers.js          # API wrapper and test utilities
├── specs/
│   ├── 01-authentication.api.spec.js      # User auth flow
│   ├── 02-friend-management.api.spec.js   # Friend relationships
│   ├── 03-group-management.api.spec.js    # Group operations
│   ├── 04-expense-management.api.spec.js  # Expense creation & splitting
│   ├── 05-settlement-flow.api.spec.js     # Debt resolution
│   ├── 06-notification-system.api.spec.js # Notification handling
│   └── 07-complete-integration.api.spec.js # Full user journeys
├── global-setup.js             # Test environment setup
├── global-teardown.js          # Test cleanup
└── playwright.config.js        # Test configuration
```

## Quick Start

### Prerequisites

- Node.js 16+ installed
- Spendy API server running (Firebase Functions)
- Network access to API endpoints

### Installation

```bash
# Install dependencies
npm install @playwright/test --save-dev

# Install browsers (if needed)
npx playwright install
```

### Running Tests

```bash
# Run all API tests
npx playwright test --config=tests/e2e/playwright.config.js

# Run specific test suite
npx playwright test tests/e2e/specs/01-authentication.api.spec.js

# Run with UI mode for debugging
npx playwright test --ui --config=tests/e2e/playwright.config.js

# Run and show test report
npx playwright test && npx playwright show-report tests/e2e/test-results/html-report
```

### Configuration

Edit `tests/e2e/playwright.config.js` to configure:

- **API Base URL**: Update `BASE_URL` for your environment
- **Timeouts**: Adjust test and expect timeouts
- **Retries**: Configure retry logic for flaky tests
- **Reporters**: Choose output formats (HTML, JSON, console)

```javascript
// Example configuration changes
const config = {
  use: {
    baseURL: 'https://your-api-domain.com',  // Update for your API
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
  timeout: 30000,     // 30 second test timeout
  expect: {
    timeout: 10000    // 10 second assertion timeout
  },
  retries: 2          // Retry failed tests twice
};
```

## Test Features

### Comprehensive API Coverage

✅ **Authentication & User Management**
- User registration with validation
- Login/logout flows
- Profile retrieval and updates
- Token-based authentication
- Input validation and error handling

✅ **Friend Network Management**
- Friend search by email
- Send/receive friend requests
- Accept/decline friend requests
- Friend list management
- Duplicate request prevention
- Friend removal

✅ **Group Operations**
- Group creation and metadata
- Member addition and removal
- Group permissions and roles
- Leave group functionality
- Multiple group membership
- Group listing and details

✅ **Expense Management**
- Equal split expenses
- Custom amount splitting
- Percentage-based splitting
- Multi-currency support
- Expense categories
- Group and user expense queries
- Expense validation and error handling

✅ **Settlement Calculations**
- Optimal settlement algorithms
- Multi-user debt resolution
- Settlement payment recording
- Balance tracking and updates
- Complex debt scenario handling
- Settlement history

✅ **Notification System**
- Friend request notifications
- Group activity alerts
- Expense creation notifications
- Settlement payment alerts
- Notification preferences
- Mark as read functionality

✅ **Integration Scenarios**
- Complete user journeys
- Multi-user group interactions
- Complex expense and settlement flows
- Error handling and edge cases
- Performance validation
- Data integrity checks

### React Native Compatibility

All tests validate React Native timestamp compatibility:

```javascript
// Tests verify timestamps are React Native compatible
expect(expense.createdAt._isDate).toBe(true);
expect(expense.createdAt.timestamp).toBeDefined();
expect(expense.createdAt.iso).toBeDefined();
```

### Test Data Management

The test suite uses dynamic test data generation:

```javascript
// Generate unique test users
const user = generateTestUser('testname');
// Creates: testname_1234567890@example.com

// Generate test groups
const group = generateTestGroup('Trip Group');
// Creates: Trip Group_1234567890

// Generate test expenses  
const expense = generateTestExpense();
// Creates: Test Expense_1234567890
```

### Error Scenario Testing

Comprehensive error handling validation:

- **400 Bad Request**: Invalid input data, missing fields
- **401 Unauthorized**: Invalid tokens, authentication failures  
- **403 Forbidden**: Permission denied, non-member access
- **404 Not Found**: Non-existent resources
- **409 Conflict**: Duplicate requests, constraint violations

## Test Examples

### Basic Authentication Test

```javascript
test('User registration and login flow', async () => {
  const user = generateTestUser('testuser');
  
  // Register new user
  const registerResponse = await api.register(user);
  expect(registerResponse.status).toBe(201);
  
  // Login with credentials
  const loginResponse = await api.login(user.email, user.password);
  expect(loginResponse.status).toBe(200);
  expect(loginResponse.data.data.token).toBeDefined();
});
```

### Complex Expense Splitting

```javascript
test('Custom split expense', async () => {
  const expenseData = {
    description: 'Custom Split Dinner',
    amount: 150,
    groupId: groupId,
    paidBy: user1.id,
    splitType: 'custom',
    splitDetails: [
      { userId: user1.id, amount: 50 },
      { userId: user2.id, amount: 60 },
      { userId: user3.id, amount: 40 }
    ]
  };
  
  const response = await api.createExpense(expenseData, user1.token);
  expect(response.status).toBe(201);
  expect(response.data.data.expense.splitType).toBe('custom');
});
```

### Settlement Flow

```javascript
test('Settlement calculation and payment', async () => {
  // Create expense
  await api.createExpense(expenseData, user1.token);
  
  // Get settlement recommendations
  const settlements = await api.getSettlements(groupId, user1.token);
  expect(settlements.data.data.settlements.length).toBeGreaterThan(0);
  
  // Record settlement payment
  const settlement = settlements.data.data.settlements[0];
  const paymentResponse = await api.recordSettlement({
    fromUserId: settlement.from,
    toUserId: settlement.to,
    amount: settlement.amount,
    groupId: groupId
  }, userToken);
  
  expect(paymentResponse.status).toBe(201);
});
```

## Debugging and Troubleshooting

### View Test Results

```bash
# Generate and view HTML report
npx playwright show-report tests/e2e/test-results/html-report

# View JSON results
cat tests/e2e/test-results/results.json | jq
```

### Debug Failed Tests

```bash
# Run with debug mode
DEBUG=pw:api npx playwright test

# Run specific test with trace
npx playwright test tests/e2e/specs/01-authentication.api.spec.js --trace on

# Run with headed browser for inspection
npx playwright test --headed
```

### Common Issues

**API Connection Errors**
```bash
# Check API server is running
curl http://localhost:5001/api/health

# Verify Firebase Functions deployment
firebase functions:log
```

**Authentication Failures**
- Verify JWT token generation in API
- Check token expiration settings
- Validate user registration flow

**Test Data Conflicts**
- Tests use unique timestamps to avoid conflicts
- Clear test data between runs if needed
- Check for rate limiting on API

## API Helper Reference

The `SpendyApiHelper` class provides all API interactions:

```javascript
const api = new SpendyApiHelper(request);

// Authentication
await api.register(userData);
await api.login(email, password);
await api.getUserProfile(userId, token);

// Friends
await api.sendFriendRequest(email, message, token);
await api.getFriendRequests(token);
await api.acceptFriendRequest(requestId, token);
await api.getFriends(token);

// Groups
await api.createGroup(groupData, token);
await api.addGroupMember(groupId, memberData, token);
await api.getGroupMembers(groupId, token);
await api.leaveGroup(groupId, token);

// Expenses
await api.createExpense(expenseData, token);
await api.getGroupExpenses(groupId, token);
await api.getUserExpenses(userId, token);

// Settlements
await api.getSettlements(groupId, token);
await api.recordSettlement(settlementData, token);

// Notifications
await api.getNotifications(token);
await api.markNotificationRead(notificationId, token);
```

## Contributing

To add new tests:

1. Create test spec in appropriate category
2. Use existing helper functions for API calls
3. Follow naming convention: `##-feature-name.api.spec.js`
4. Include comprehensive error scenarios
5. Validate React Native compatibility
6. Add documentation for new test features

## Test Coverage

Current test coverage includes:

- ✅ All major API endpoints
- ✅ Error handling scenarios  
- ✅ Edge cases and validation
- ✅ Multi-user interactions
- ✅ Complex business logic
- ✅ Performance validation
- ✅ Data integrity checks
- ✅ React Native compatibility

This test suite provides confidence in the Spendy API's reliability and helps prevent regressions during development.
