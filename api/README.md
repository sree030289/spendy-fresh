# Spendy API - Complete REST API Backend

A comprehensive REST API backend for the Spendy expense splitting application, built with Express.js, TypeScript, and Firebase Firestore.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (currently tested with Node 18.20.8)
- npm or yarn
- Firebase project setup

### Installation
```bash
cd api
npm install
```

### Environment Setup
Create a `.env` file in the `/api` directory:
```env
NODE_ENV=development
PORT=8000

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-firebase-project-id

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Running the Server
```bash
# Build TypeScript
npm run build

# Start server
npm start

# For development (with auto-reload)
npm run dev
```

The API will be available at `http://localhost:8000`

## 📁 Project Structure

```
api/
├── src/
│   ├── config/
│   │   ├── database.ts       # Firebase Firestore configuration
│   │   ├── env.ts           # Environment variables
│   │   └── firebase.ts      # Firebase Admin SDK setup
│   ├── controllers/
│   │   ├── auth.controller.ts     # Authentication endpoints
│   │   ├── friends.controller.ts  # Friends management
│   │   ├── groups.controller.ts   # Groups management
│   │   └── expenses.controller.ts # Expenses management
│   ├── middleware/
│   │   ├── auth.ts          # JWT authentication middleware
│   │   ├── error.ts         # Error handling middleware
│   │   ├── rateLimiter.ts   # Rate limiting middleware
│   │   └── validation.ts    # Request validation middleware
│   ├── routes/
│   │   ├── auth.routes.ts    # Authentication routes
│   │   ├── friends.routes.ts # Friends routes
│   │   ├── groups.routes.ts  # Groups routes
│   │   └── expenses.routes.ts # Expenses routes
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── utils/
│   │   └── crypto.ts        # JWT and password utilities
│   ├── app.ts              # Express app configuration
│   └── index.ts            # Server entry point
├── dist/                   # Compiled JavaScript (generated)
├── .env                    # Environment variables
├── package.json
├── tsconfig.json
└── spendy-api-postman-collection.json
```

## 🛠 API Architecture

### Core Features
- **Custom Authentication System**: JWT-based auth using Node.js crypto module
- **Custom Middleware Stack**: Rate limiting, validation, error handling (no external dependencies)
- **Firebase Firestore Integration**: Complete database abstraction layer
- **TypeScript Support**: Full type safety and IntelliSense
- **Comprehensive Error Handling**: Structured error responses with proper HTTP status codes
- **Rate Limiting**: Custom implementation without external dependencies
- **Security**: Password hashing, JWT tokens, input validation

### Custom Implementations
We've built custom implementations for common middleware to avoid external dependencies:
- **Authentication**: Custom JWT implementation using Node.js crypto
- **Password Hashing**: Custom implementation using Node.js crypto
- **Rate Limiting**: Custom in-memory rate limiter
- **Request Validation**: Custom validation middleware
- **CORS**: Custom CORS implementation

## 📚 API Documentation

### Base URL
```
http://localhost:8000/api
```

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 🔐 Authentication Endpoints

### POST /api/auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "mobile": "+1234567890",
  "country": "US",
  "currency": "USD"
}
```

### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "fullName": "John Doe",
      "currency": "USD",
      "isPremium": false
    }
  }
}
```

### GET /api/auth/profile
Get current user profile (requires authentication).

### PUT /api/auth/profile
Update user profile (requires authentication).

### POST /api/auth/change-password
Change user password (requires authentication).

### POST /api/auth/forgot-password
Request password reset.

### POST /api/auth/reset-password
Reset password with token.

### POST /api/auth/verify-email
Verify email address.

## 👥 Friends Endpoints

### POST /api/friends/requests/send
Send a friend request.

### POST /api/friends/requests/:requestId/accept
Accept a friend request.

### POST /api/friends/requests/:requestId/reject
Reject a friend request.

### GET /api/friends/requests
Get pending friend requests.

### GET /api/friends
Get user's friends list.

### DELETE /api/friends/:friendId
Remove a friend.

### GET /api/friends/search?query=username
Search for users.

### GET /api/friends/stats
Get friendship statistics.

### GET /api/friends/:friendId/profile
Get friend's profile.

## 🏘 Groups Endpoints

### POST /api/groups
Create a new group.

**Request Body:**
```json
{
  "name": "Trip to Paris",
  "description": "Vacation expenses",
  "category": "travel",
  "currency": "USD"
}
```

### GET /api/groups
Get user's groups.

### GET /api/groups/:groupId
Get group details.

### PUT /api/groups/:groupId
Update group information.

### DELETE /api/groups/:groupId
Delete a group.

### POST /api/groups/:groupId/members
Add member to group.

### DELETE /api/groups/:groupId/members/:memberId
Remove member from group.

### POST /api/groups/join/:inviteCode
Join group by invite code.

### POST /api/groups/:groupId/invite
Generate invite code for group.

### GET /api/groups/:groupId/expenses
Get group expenses.

### GET /api/groups/:groupId/balances
Get group balances.

## 💸 Expenses Endpoints

### POST /api/expenses
Create a new expense.

**Request Body:**
```json
{
  "title": "Dinner at Restaurant",
  "amount": 120.50,
  "paidBy": "user-id",
  "groupId": "group-id",
  "category": "food",
  "description": "Team dinner",
  "splitType": "equal",
  "splitDetails": [
    {
      "userId": "user-1",
      "amount": 40.17
    }
  ]
}
```

### GET /api/expenses
Get user's expenses.

### GET /api/expenses/all
Get all expenses (with filters).

### GET /api/expenses/:expenseId
Get expense details.

### PUT /api/expenses/:expenseId
Update expense.

### DELETE /api/expenses/:expenseId
Delete expense.

### POST /api/expenses/:expenseId/mark-paid
Mark split as paid.

### GET /api/expenses/categories/list
Get expense categories.

### GET /api/expenses/statistics/summary
Get expense statistics.

## 🔧 Utility Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "message": "Spendy API is running",
  "timestamp": "2024-08-02T12:00:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

## 📮 Postman Collection

Import the included `spendy-api-postman-collection.json` file into Postman to test all API endpoints.

### Using the Postman Collection
1. Import `spendy-api-postman-collection.json` into Postman
2. Set the `base_url` variable to `http://localhost:8000/api`
3. First, register a user or login to get an auth token
4. The collection will automatically set the auth token for subsequent requests
5. Test all endpoints with the provided examples

## 🗄 Database Schema

### Collections in Firestore

#### users
```typescript
{
  id: string;
  email: string;
  fullName: string;
  name: string; // alias for fullName
  mobile: string;
  phoneNumber: string; // alias for mobile
  country: string;
  currency: string;
  biometricEnabled: boolean;
  isPremium: boolean;
  subscriptionStatus: string;
  profileImage?: string;
  profilePicture?: string; // alias
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### friendRequests
```typescript
{
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}
```

#### friendships
```typescript
{
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: Date;
  status: 'active' | 'blocked';
}
```

#### groups
```typescript
{
  id: string;
  name: string;
  description?: string;
  category: string;
  currency: string;
  createdBy: string;
  members: string[];
  inviteCode?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### expenses
```typescript
{
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  groupId?: string;
  category: string;
  description?: string;
  currency: string;
  date: Date;
  splitType: 'equal' | 'percentage' | 'custom';
  splitDetails: Array<{
    userId: string;
    amount: number;
    percentage?: number;
    isPaid: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

## 🛡 Security Features

### Authentication
- JWT-based authentication using Node.js crypto module
- Password hashing with salt using Node.js crypto
- Secure token generation for password resets

### Rate Limiting
- Custom rate limiter implementation
- Different limits for auth vs general endpoints
- IP-based rate limiting

### Input Validation
- Custom validation middleware
- Required field validation
- Type checking for request bodies

### Error Handling
- Structured error responses
- No sensitive information exposure
- Proper HTTP status codes

## 🚀 Deployment

### Building for Production
```bash
npm run build
```

### Environment Variables for Production
Update `.env` with production values:
```env
NODE_ENV=production
PORT=8000
FIREBASE_PROJECT_ID=your-production-firebase-project
JWT_SECRET=your-production-jwt-secret
```

### Docker Support
You can create a Dockerfile for containerized deployment:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 8000
CMD ["node", "dist/index.js"]
```

## 🔄 Integration with Frontend

### React Native Integration
```typescript
// Example API service
class ApiService {
  private baseURL = 'http://localhost:8000/api';
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'API Error');
    }

    return data;
  }

  // Auth methods
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getProfile() {
    return this.request('/auth/profile');
  }

  // Friends methods
  async getFriends() {
    return this.request('/friends');
  }

  // Groups methods
  async createGroup(groupData: any) {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    });
  }

  // Expenses methods
  async createExpense(expenseData: any) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData),
    });
  }
}
```

## 📊 API Response Format

All API responses follow this consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "details": {
    // Additional error details (if any)
  }
}
```

## 🐛 Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `UNAUTHORIZED`: Authentication required or invalid
- `FORBIDDEN`: Access denied
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource already exists
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Server error

## 📈 Performance & Monitoring

### Rate Limiting
- General endpoints: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes for sensitive operations
- Password reset: 3 requests per hour

### Database Optimization
- Indexed queries on frequently accessed fields
- Efficient data structure for quick lookups
- Proper error handling for database operations

## 🧪 Testing

### Health Check
```bash
curl http://localhost:8000/health
```

### API Testing with curl
```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","fullName":"Test User","country":"US"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 📝 API Summary

### Total Endpoints: 45+

#### Authentication (8 endpoints)
- User registration and login
- Profile management
- Password reset flow
- Email verification

#### Friends (9 endpoints)
- Friend request management
- Friends list and search
- Friend statistics and profiles

#### Groups (11 endpoints)
- Group creation and management
- Member management
- Invite system
- Group expenses and balances

#### Expenses (9 endpoints)
- Expense creation and management
- Split management
- Categories and statistics

#### Utility (1 endpoint)
- Health check

### Key Features Implemented
✅ Complete authentication system with JWT
✅ Custom middleware stack (no external dependencies)
✅ Firebase Firestore integration
✅ Comprehensive error handling
✅ Rate limiting and security
✅ TypeScript support with full type safety
✅ RESTful API design
✅ Postman collection for testing
✅ Production-ready architecture

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if necessary
5. Submit a pull request

## 📄 License

This project is part of the Spendy expense splitting application.

---

**Built with ❤️ using Express.js, TypeScript, and Firebase**
