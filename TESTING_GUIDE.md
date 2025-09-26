# 🧪 Unified Invite System Testing Guide

## 🎯 Overview

This guide will help you test the complete unified invite system implementation. We've successfully:

✅ **Backend**: Added all unified invite endpoints to Firebase Functions  
✅ **Frontend**: Added automatic invite checking during registration  
✅ **Integration**: Connected frontend registration with backend invite system  

## 🚀 Testing Steps

### Step 1: Verify Deployment
First, ensure your Firebase functions are deployed successfully:

```bash
# Check deployment status
firebase functions:log --limit 10

# Test health endpoint
curl -X GET "https://your-firebase-project.cloudfunctions.net/meetnsplitApi/health"
```

### Step 2: Test Flow 1 - Registered User Invite

#### 2.1: Create invite to existing user
1. **Login as User A** in your app
2. **Go to invite/friends section**
3. **Try to create invite** to a phone number of an existing user (User B)
4. **Expected Result**: Should show "Invite sent to [User B name]" success message

#### 2.2: Test user search
Test the user search endpoint directly:
```bash
curl -X GET "https://your-firebase-project.cloudfunctions.net/meetnsplitApi/users/search-contact?q=%2B1234567890"
```

#### 2.3: Check invite was created
Look in Firestore console:
- Collection: `unifiedInvites`  
- Should see new document with:
  - `status: "PENDING"`
  - `type: "SMS_REGISTERED_USER"`
  - `recipientUserId: "existing-user-id"`

### Step 3: Test Flow 2 - Unregistered User Invite

#### 3.1: Create invite to new phone number
1. **Login as User A**
2. **Create invite** to a phone number that doesn't exist in your users collection
3. **Expected Result**: Should show "Signup invitation sent to +1234567890" message

#### 3.2: Check invite was created
Look in Firestore console:
- Collection: `unifiedInvites`
- Should see new document with:
  - `status: "SIGNUP_PENDING"`
  - `type: "SMS_UNREGISTERED_USER"`  
  - `recipientUserId: null`

#### 3.3: Test registration conversion
1. **Register a new account** using the phone number from step 3.1
2. **During registration**, the system should automatically:
   - Find the pending invite
   - Convert it to accepted status
   - Create friendship between User A and new user
3. **Expected Result**: Check Firestore:
   - `unifiedInvites` document should have `status: "ACCEPTED"`
   - `friendships` collection should have new friendship records

### Step 4: Manual API Testing

If the above UI flows don't work, test the APIs directly:

#### 4.1: Test search users
```bash
curl -X GET "https://your-firebase-project.cloudfunctions.net/meetnsplitApi/users/search-contact?q=test@example.com"
```

#### 4.2: Test create invite (replace YOUR_JWT_TOKEN)
```bash
curl -X POST "https://your-firebase-project.cloudfunctions.net/meetnsplitApi/invites/unified" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientPhone": "+1234567890",
    "message": "Join me on Spendy!",
    "sentVia": "SMS"
  }'
```

#### 4.3: Test find pending invites
```bash
curl -X GET "https://your-firebase-project.cloudfunctions.net/meetnsplitApi/invites/unified/pending?phone=%2B1234567890"
```

#### 4.4: Test registration check
```bash
curl -X POST "https://your-firebase-project.cloudfunctions.net/meetnsplitApi/invites/unified/check-registration" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "new-user-123",
    "phoneNumber": "+1234567890", 
    "email": "test@example.com"
  }'
```

## 🔍 Debugging Common Issues

### Issue 1: "Method not found" errors
**Cause**: Firebase deployment not complete or endpoints not properly added  
**Solution**: 
1. Check `firebase functions:log` for errors
2. Verify functions deployed successfully
3. Test health endpoint first

### Issue 2: Invites not showing success message
**Cause**: Frontend not calling the new unified invite endpoints  
**Solution**: 
1. Check if your frontend invite buttons are using `apiService.createUnifiedInvite()`
2. Verify API service has the unified invite methods
3. Check browser/app console for API call errors

### Issue 3: Registration not checking invites
**Cause**: Registration flow not calling the invite check  
**Solution**: 
1. Verify `useAuth.tsx` has the invite check code after `setUser(user)`
2. Check console logs during registration for "Checking for pending invites" message
3. Verify `apiService.checkPendingInvitesOnRegistration()` method exists

### Issue 4: Database permissions
**Cause**: Firestore security rules may block the `unifiedInvites` collection  
**Solution**: Add to `firestore.rules`:
```javascript
match /unifiedInvites/{inviteId} {
  allow read, write: if request.auth != null;
}
```

### Issue 5: Phone number format issues
**Cause**: Phone numbers not in E.164 format  
**Solution**: 
1. Check that phone numbers include country code (e.g., +1234567890)  
2. Verify normalization is working in the backend
3. Test with different phone number formats

## 📱 Testing with Real Devices

### Test Scenario 1: Complete Flow
1. **User A** (existing): Create invite to +1234567890 (unregistered)
2. **User B** (new): Register with phone +1234567890
3. **Expected**: User B should automatically be friends with User A

### Test Scenario 2: Error Handling
1. **User A**: Try to invite existing friend
2. **Expected**: Should show "Already friends" message
3. **User A**: Try to invite with pending request
4. **Expected**: Should show "Request already pending" message

## 🎉 Success Indicators

✅ **Flow 1 Working**: Registered users receive invites, can accept/decline  
✅ **Flow 2 Working**: Unregistered users' invites auto-convert on signup  
✅ **Error Handling**: Proper messages for duplicates, invalid data  
✅ **Database**: All invite records created correctly in Firestore  
✅ **Friendships**: Bidirectional friendship records created  

## 📊 Monitoring

Check these Firestore collections for data:
- `unifiedInvites`: All invite records
- `friendships`: Auto-created friendships  
- `users`: User data used for lookup

Check Firebase Functions logs:
```bash
firebase functions:log --limit 50
```

Look for log messages:
- `📧 Would send invite notifications`
- `🎉 Auto-converted pending invites`  
- `✅ Invite accepted and friendship created`

---

## 🆘 Need Help?

If any step fails:
1. **Check Firebase Functions logs** for specific error messages
2. **Verify Firestore data** matches expected structure
3. **Test API endpoints directly** using curl commands above
4. **Check browser/app console** for frontend errors

The unified invite system is now fully implemented and ready for testing! 🚀
