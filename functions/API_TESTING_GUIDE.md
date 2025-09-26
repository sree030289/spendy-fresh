# Unified Invite API Testing Guide

This guide provides examples for testing all unified invite API endpoints.

## Base URL
```
http://localhost:8000/api
```

## Authentication
All authenticated endpoints require the `Authorization` header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## API Endpoints Tests

### 1. Search Users by Contact
**GET** `/users/search-contact?q={phone_or_email}`

```bash
# Search by phone
curl -X GET "http://localhost:8000/api/users/search-contact?q=+1234567890"

# Search by email
curl -X GET "http://localhost:8000/api/users/search-contact?q=user@example.com"
```

### 2. Create Unified Invite
**POST** `/invites/unified`

```bash
# SMS invite to registered user
curl -X POST "http://localhost:8000/api/invites/unified" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientPhone": "+1234567890",
    "message": "Let'\''s split expenses together!",
    "sentVia": "SMS"
  }'

# SMS invite to unregistered user  
curl -X POST "http://localhost:8000/api/invites/unified" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientPhone": "+9876543210",
    "recipientEmail": "newuser@example.com",
    "message": "Join me on Spendy!",
    "sentVia": "SMS"
  }'

# Push notification invite
curl -X POST "http://localhost:8000/api/invites/unified" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientPhone": "+1234567890",
    "sentVia": "PUSH"
  }'
```

### 3. Get Invite by ID
**GET** `/invites/unified/{inviteId}`

```bash
curl -X GET "http://localhost:8000/api/invites/unified/INVITE_ID_HERE" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Accept Invite
**POST** `/invites/unified/{inviteId}/accept`

```bash
curl -X POST "http://localhost:8000/api/invites/unified/INVITE_ID_HERE/accept" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Decline Invite
**POST** `/invites/unified/{inviteId}/decline`

```bash
curl -X POST "http://localhost:8000/api/invites/unified/INVITE_ID_HERE/decline" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6. Find Pending Invites
**GET** `/invites/unified/pending?phone={phone}&email={email}`

```bash
# Find by phone
curl -X GET "http://localhost:8000/api/invites/unified/pending?phone=+1234567890"

# Find by email
curl -X GET "http://localhost:8000/api/invites/unified/pending?email=user@example.com"

# Find by both
curl -X GET "http://localhost:8000/api/invites/unified/pending?phone=+1234567890&email=user@example.com"
```

### 7. Check Registration Invites
**POST** `/invites/unified/check-registration`

```bash
curl -X POST "http://localhost:8000/api/invites/unified/check-registration" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "NEW_USER_ID",
    "phoneNumber": "+1234567890",
    "email": "newuser@example.com"
  }'
```

### 8. Create Friendship
**POST** `/invites/unified/create-friendship`

```bash
curl -X POST "http://localhost:8000/api/invites/unified/create-friendship" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId1": "USER_1_ID",
    "userId2": "USER_2_ID"
  }'
```

## Expected Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

## Testing Scenarios

### 1. Complete Registered User Flow
1. Search for existing user by phone
2. Create invite with `sentVia: "SMS"` or `sentVia: "PUSH"`
3. Check that invite was created with `PENDING` status
4. Accept the invite as the recipient
5. Verify friendship was created

### 2. Complete Unregistered User Flow  
1. Create invite to non-existent phone/email with `sentVia: "SMS"`
2. Check that invite was created with `SIGNUP_PENDING` status
3. Simulate user registration by calling check-registration
4. Verify invite was auto-accepted and friendship created

### 3. Error Scenarios
1. Try to create invite without phone or email
2. Try to accept expired invite
3. Try to accept invite as wrong user
4. Try to create duplicate friendship

## Postman Collection

Import the following collection to test all endpoints:

```json
{
  "info": {
    "name": "Unified Invite API",
    "description": "Test collection for unified invite system"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:8000/api"
    },
    {
      "key": "authToken",
      "value": "YOUR_JWT_TOKEN"
    }
  ],
  "item": [
    {
      "name": "Search Users",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/users/search-contact?q=+1234567890",
          "host": ["{{baseUrl}}"],
          "path": ["users", "search-contact"],
          "query": [{"key": "q", "value": "+1234567890"}]
        }
      }
    },
    {
      "name": "Create Invite",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Authorization", "value": "Bearer {{authToken}}"},
          {"key": "Content-Type", "value": "application/json"}
        ],
        "body": {
          "raw": "{\n  \"recipientPhone\": \"+1234567890\",\n  \"message\": \"Let's be friends!\",\n  \"sentVia\": \"SMS\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/invites/unified",
          "host": ["{{baseUrl}}"],
          "path": ["invites", "unified"]
        }
      }
    }
  ]
}
```

## Notes

- Replace `YOUR_JWT_TOKEN` with actual JWT token from authentication
- Replace `INVITE_ID_HERE` with actual invite IDs from created invites  
- Replace `USER_ID` values with actual user IDs from your database
- Phone numbers should be in E.164 format (+countrycode+number)
- All timestamps are in ISO 8601 format
- SMS notifications are currently mocked - check server logs for details
