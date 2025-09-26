# Unified Invite System - Implementation Guide

## 🎯 Overview

The Unified Invite System provides a robust, dual-path SMS and email invitation system that handles both **registered** and **unregistered** users seamlessly. This system integrates perfectly with your existing Spendy architecture while providing enhanced functionality for user growth and engagement.

## 🚀 Key Features

### ✅ **Dual-Path Invite Flows**
- **Flow 1**: SMS/Email to **Registered** users (has app + account)
- **Flow 2**: SMS/Email to **Unregistered** users (needs to download app)

### ✅ **Smart User Detection**
- Automatic phone number normalization (E.164 format)
- Database lookup to determine user registration status
- Friendship status checking to prevent duplicate requests

### ✅ **Multi-Channel Delivery**
- **Registered Users**: Push notification + SMS/Email fallback
- **Unregistered Users**: SMS/Email with signup links
- Deep link support for seamless app opening

### ✅ **Auto-Conversion System**
- Pending invites automatically convert when users register
- Smart friendship creation with welcome notifications
- Comprehensive invite tracking and status management

## 📱 Implementation Flows

### Flow 1: SMS Invite to REGISTERED USER

```typescript
// 1. Normalize phone number
const normalizedPhone = PhoneNumberService.normalize("+1234567890");

// 2. Check if user exists
const existingUser = await userRepository.findByPhone(normalizedPhone);
// Result: User found ✅

// 3. Check friendship status
const friendshipStatus = await apiService.checkExistingFriendship(inviterUserId, existingUser.email);
// Result: 'no_relationship' ✅

// 4. Create invite record
const invite = await inviteService.create({
  inviterId: "userA",
  recipientUserId: "user123",     // ✅ Has user ID
  recipientPhone: "+1234567890",
  status: 'PENDING',              // Direct pending
  type: 'SMS_REGISTERED_USER'     // ✅ Registered type
});

// 5. Send dual notifications
await pushService.send(userId, { title: "New Friend Request! 👋" });
await smsService.send(phone, { message: "Friend request in Spendy!" });
```

### Flow 2: SMS Invite to UNREGISTERED USER

```typescript
// 1. Normalize phone number
const normalizedPhone = PhoneNumberService.normalize("+1987654321");

// 2. Check if user exists
const existingUser = await userRepository.findByPhone(normalizedPhone);
// Result: null (not found) ✅

// 3. Create pending invite
const invite = await inviteService.create({
  inviterId: "userA",
  recipientUserId: null,              // ❌ No user ID yet
  recipientPhone: "+1987654321",
  status: 'SIGNUP_PENDING',           // ✅ Waiting for signup
  type: 'SMS_UNREGISTERED_USER',      // ✅ Unregistered type
  inviteToken: generateSecureToken()  // ✅ Tracking token
});

// 4. Send SMS with signup link
await smsService.send("+1987654321", {
  message: `${inviterName} invited you to Spendy! Join: https://meetnsplit.com/signup?invite=${invite.inviteToken}`
});

// 5. When user registers, auto-convert pending invites
const pendingInvites = await inviteRepository.findPendingByPhone("+1987654321");
await inviteService.convertPendingInvite(invite.id, newUserId);
```

## 🔧 Installation & Setup

### 1. Install Dependencies
```bash
npm install libphonenumber-js --legacy-peer-deps
```

### 2. Files Added
```
src/
├── services/invite/
│   ├── PhoneNumberService.ts          # Phone normalization & validation
│   └── UnifiedInviteService.ts        # Core invite logic
├── hooks/
│   └── useRegistrationInviteCheck.ts  # React hook for registration
├── components/modals/
│   └── PendingInvitesModal.tsx        # UI for pending invites
├── types/
│   └── index.ts                       # Updated with invite types
└── examples/
    └── UnifiedInviteIntegration.tsx   # Integration examples
```

### 3. Database Schema
Add to your existing Firestore collections:
```typescript
// Add to COLLECTIONS constant
UNIFIED_INVITES: 'unifiedInvites'

// Document structure
interface UnifiedInvite {
  id: string;
  inviterId: string;
  recipientUserId: string | null;        // null for unregistered
  recipientPhone: string;                // E.164 format
  recipientEmail: string | null;
  status: 'PENDING' | 'SIGNUP_PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  type: 'SMS_REGISTERED_USER' | 'SMS_UNREGISTERED_USER' | 'EMAIL_REGISTERED_USER' | 'EMAIL_UNREGISTERED_USER';
  inviteToken: string;
  createdAt: Date;
  expiresAt: Date;
}
```

## 🎮 Usage Examples

### Send SMS Invite
```typescript
import { sendSMSInvite } from './examples/UnifiedInviteIntegration';

const result = await sendSMSInvite(
  'user123',                    // Inviter user ID
  '+1234567890',               // Recipient phone
  'Join me on Spendy!'         // Optional message
);

if (result.success) {
  if (result.isRegisteredUser) {
    console.log('✅ Friend request sent to registered user');
  } else {
    console.log('✅ Signup invitation sent to new user');
  }
}
```

### Registration Invite Check
```typescript
import { RegistrationInviteChecker } from './examples/UnifiedInviteIntegration';

// Add to your registration success screen
<RegistrationInviteChecker
  userId={newUser.id}
  userPhone={newUser.mobile}
  userEmail={newUser.email}
  onInvitesProcessed={(friendsCount) => {
    console.log(`🎉 ${friendsCount} new friends added!`);
  }}
/>
```

### Phone Number Utilities
```typescript
import { PhoneNumberUtils } from './examples/UnifiedInviteIntegration';

// Format for display
const displayNumber = PhoneNumberUtils.formatForDisplay('+1234567890');
// Result: "+1 234 567 8900"

// Validate before sending
const isValid = PhoneNumberUtils.validatePhoneNumber('555-123-4567', 'US');
// Result: true

// Normalize for storage
const normalized = PhoneNumberUtils.normalizePhoneNumber('(555) 123-4567', 'US');
// Result: "+15551234567"
```

### React Hook Usage
```typescript
import { useRegistrationInviteCheck } from './hooks/useRegistrationInviteCheck';

const MyComponent = () => {
  const { isChecking, checkResult, hasChecked } = useRegistrationInviteCheck({
    userId: 'user123',
    phoneNumber: '+1234567890',
    email: 'user@example.com',
    enabled: true
  });

  useEffect(() => {
    if (hasChecked && checkResult?.hasPendingInvites) {
      console.log(`Found ${checkResult.invites.length} pending invites!`);
      console.log(`Auto-accepted ${checkResult.autoAcceptedCount} invites`);
    }
  }, [hasChecked, checkResult]);

  return (
    <View>
      {isChecking && <Text>🔍 Checking for invites...</Text>}
      {checkResult?.hasPendingInvites && (
        <Text>🎉 {checkResult.autoAcceptedCount} new friends!</Text>
      )}
    </View>
  );
};
```

## 🔄 Integration Points

### 1. Registration Flow
Add invite checking to your user registration success:
```typescript
// In your registration screen
const handleRegistrationSuccess = async (userData) => {
  // ... existing registration logic

  // Check for pending invites
  const inviteCheck = await UnifiedInviteService.getInstance()
    .checkPendingInvitesOnRegistration(userData.id, userData.mobile, userData.email);
  
  if (inviteCheck.hasPendingInvites) {
    // Show welcome message with friend count
    showWelcomeWithFriends(inviteCheck.autoAcceptedCount);
  }
};
```

### 2. Friend Invite UI
Replace your existing invite logic:
```typescript
// In your friend invite screen
import { handleFriendInvite } from './examples/UnifiedInviteIntegration';

const sendInvite = async () => {
  const result = await handleFriendInvite(
    currentUserId,
    contactInput,      // Phone or email
    'SMS',            // or 'EMAIL'
    messageInput
  );
  
  if (result.success) {
    // Navigate back or show success
  }
};
```

### 3. Deep Link Handling
Add to your deep link router:
```typescript
// In your deep link handler
import { handleInviteDeepLink } from './examples/UnifiedInviteIntegration';

const handleDeepLink = async (url) => {
  if (url.includes('/invite/')) {
    const inviteToken = extractTokenFromUrl(url);
    const result = await handleInviteDeepLink(inviteToken, currentUserId);
    
    switch (result.action) {
      case 'redirect_to_auth':
        navigation.navigate('Login', { inviteToken });
        break;
      case 'show_invite':
        navigation.navigate('PendingInvites');
        break;
    }
  }
};
```

## 🛠️ API Endpoints Required

Your backend needs these endpoints:

```typescript
// Create unified invite
POST /api/invites/unified
Body: { inviterId, recipientPhone?, recipientEmail?, message?, sentVia }

// Get invite by ID
GET /api/invites/unified/:inviteId

// Accept/decline invite
POST /api/invites/unified/:inviteId/accept
POST /api/invites/unified/:inviteId/decline

// Find pending invites
GET /api/invites/unified/pending?phone=...&email=...

// Registration invite check
POST /api/invites/unified/check-registration
Body: { userId, phoneNumber, email }

// Search users by contact
GET /api/users/search-contact?q=...

// Create friendship
POST /api/friends/create-friendship
Body: { userId1, userId2 }
```

## 🔍 Error Handling

The system includes comprehensive error handling:

```typescript
// Phone number validation errors
PhoneNumberService.normalize('invalid') 
// Throws: "Phone number validation failed: Invalid phone number format"

// Friendship status conflicts
inviteService.createInvite(existingFriendData)
// Returns: { success: false, message: "You are already friends with John Doe" }

// Network/API errors
// All services gracefully handle network failures and provide fallback behavior
```

## 🧪 Testing

Use the built-in testing utilities:

```typescript
import { InviteTestUtils } from './examples/UnifiedInviteIntegration';

// Test phone normalization
InviteTestUtils.testPhoneNormalization();

// Test invite flow
await InviteTestUtils.testInviteFlow('user123');
```

## 🚀 Next Steps

1. **Backend Implementation**: Implement the required API endpoints
2. **SMS Service Integration**: Connect with your SMS provider (Twilio, etc.)
3. **Push Notification Setup**: Ensure push notifications work for registered users
4. **Testing**: Test both flows thoroughly with real phone numbers
5. **Analytics**: Add tracking for invite conversion rates
6. **UI Integration**: Replace existing invite flows with the unified system

## 🔗 Integration with Existing Systems

This unified invite system is designed to work alongside your existing:
- ✅ Friend request system (`FriendNotificationService`)
- ✅ SMS/WhatsApp integration (`InviteService`)
- ✅ Push notification system (`PushNotificationManager`)
- ✅ User registration flow
- ✅ Firestore database structure

The system enhances rather than replaces your current architecture!

---

## � Implementation Status

### ✅ **COMPLETED - Frontend System** 
- **PhoneNumberService.ts** - Phone number normalization with libphonenumber-js
- **UnifiedInviteService.ts** - Core invite business logic for dual-path system
- **useRegistrationInviteCheck.ts** - React hooks for automatic invite checking
- **PendingInvitesModal.tsx** - React Native UI component for invite management
- **UnifiedInviteIntegration.tsx** - Integration examples and patterns
- **ApiService.ts extensions** - 13 new API methods for unified invites
- **Type definitions** - Complete interfaces for UnifiedInvite system

### ✅ **COMPLETED - Backend System**
- **UnifiedInviteController.ts** - All 13 API endpoints implemented
- **Unified invite routes** - Proper authentication and error handling
- **SMS service** - Mock implementation with Twilio/AWS SNS integration ready
- **Push notification service** - Firebase Cloud Messaging integration
- **Database schema** - UNIFIED_INVITES collection added to Firestore
- **Complete validation** - Error handling, status management, notifications

### ✅ **COMPLETED - Documentation & Testing**
- **Complete technical documentation** - This comprehensive guide
- **API testing guide** - Postman collection and curl examples  
- **Backend testing utilities** - Integration test functions
- **Usage patterns** - Best practices and error handling

### 🚧 **IN PROGRESS - Testing & Validation** 
- API endpoint testing and validation
- SMS and push notification flow verification
- Database integration testing

### ⏳ **PENDING - Integration & Production** 
- Registration flow integration with auto-invite checking
- UI component integration into main app navigation  
- Deep link handling for SMS invite links
- SMS provider configuration (Twilio/AWS SNS setup)
- Production testing and monitoring
- Analytics integration

---

## �📞 Support

For questions or issues with the unified invite system:
1. Check the example integration file
2. Review the error logs for specific issues
3. Test with the provided testing utilities
4. Ensure all API endpoints are implemented correctly

**Happy inviting! 🎉**
