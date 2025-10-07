# Biometric Login Fix - Integration Test Plan

## Overview
This document provides a comprehensive testing plan to validate the biometric login fixes.

## Test Environment Setup

### Prerequisites
- iOS or Android device with biometric hardware (Face ID, Touch ID, or Fingerprint)
- Biometric authentication enrolled on the device
- App installed in development or production mode
- Test user account credentials

### Test Data
- **Test User 1**: Active user with biometric enabled
- **Test User 2**: New user without biometric enabled
- **Test User 3**: User who recently disabled biometric

## Test Cases

### TC-1: Enable Biometric Authentication
**Objective**: Verify user can enable biometric authentication from ProfileScreen

**Steps**:
1. Login with email and password
2. Navigate to Profile > Account Settings
3. Tap on "Biometric Login" (shows "Disabled")
4. Observe biometric hardware check
5. Perform biometric authentication when prompted
6. Verify success message

**Expected Results**:
- ✅ Hardware validation occurs
- ✅ Biometric prompt appears (Face ID/Touch ID)
- ✅ Success alert shows: "Biometric login has been enabled"
- ✅ Setting shows "Enabled" with green color
- ✅ Preference saved to AsyncStorage
- ✅ No multiple alerts

**Edge Cases**:
- Device without biometric hardware → Shows error
- Biometric not enrolled → Shows error
- Authentication fails → No change, clear error message
- User cancels → No change, no error

---

### TC-2: Biometric Login After Enabling
**Objective**: Verify biometric login works immediately after enabling

**Steps**:
1. Enable biometric (TC-1)
2. Logout from app
3. Relaunch app
4. Observe biometric prompt on LoginScreen
5. Authenticate with biometric
6. Verify successful login

**Expected Results**:
- ✅ Quick Login modal appears with biometric option
- ✅ Biometric authentication prompt shows
- ✅ Session restored successfully
- ✅ User navigated to main app
- ✅ No "Failed to restore session" errors
- ✅ Single alert on any failure

**Performance**:
- Login should complete within 2-3 seconds
- No visible loading delays

---

### TC-3: Token Refresh on Expired Session
**Objective**: Verify fresh token retrieval when stored token expires

**Steps**:
1. Enable biometric and login
2. Wait for 1+ hour (or manually expire Firebase token)
3. Close and reopen app
4. Trigger biometric login
5. Verify successful login with fresh token

**Expected Results**:
- ✅ Firebase session validation occurs
- ✅ Fresh token retrieved automatically
- ✅ API calls succeed with new token
- ✅ Session restored successfully
- ✅ No 401 authentication errors
- ✅ Single success flow, no multiple alerts

**Validation**:
```javascript
// Check logs for these messages:
"🔍 Validating Firebase session for biometric login..."
"✅ Firebase session is valid"
"🔄 Getting fresh Firebase token..."
"✅ Fresh token obtained from Firebase"
```

---

### TC-4: Disable Biometric Authentication
**Objective**: Verify user can disable biometric authentication

**Steps**:
1. Login with biometric enabled
2. Navigate to Profile > Account Settings
3. Tap on "Biometric Login" (shows "Enabled")
4. Verify confirmation or immediate disable
5. Check setting update

**Expected Results**:
- ✅ Setting changes to "Disabled"
- ✅ Success alert shows
- ✅ Preference removed from AsyncStorage
- ✅ Next app launch shows standard login screen

---

### TC-5: Biometric Login Error Handling
**Objective**: Verify proper error handling for various failure scenarios

**Scenarios**:

#### 5.1: User Cancels Biometric
**Steps**: Start biometric login → Cancel authentication
**Expected**: No error alert, return to login screen

#### 5.2: Biometric Authentication Fails
**Steps**: Start biometric login → Fail authentication 3 times
**Expected**: Single clear error alert, option to use password

#### 5.3: Firebase Session Expired
**Steps**: Logout from another device → Try biometric on current device
**Expected**: Single alert: "Session Expired. Please login again."

#### 5.4: No Network Connection
**Steps**: Disable network → Try biometric login
**Expected**: Single alert about network error, graceful fallback

#### 5.5: Manual Login Required
**Steps**: Clear app data → Try biometric
**Expected**: Single alert: "Login Required. Please login with your email and password."

**Validation for all scenarios**:
- ✅ Only ONE alert shown
- ✅ Clear, actionable error message
- ✅ Appropriate fallback action
- ✅ No app crash

---

### TC-6: Multiple User Accounts
**Objective**: Verify biometric preferences are user-specific

**Steps**:
1. Login as User A, enable biometric
2. Logout
3. Login as User B (different account), don't enable biometric
4. Logout
5. Relaunch app
6. Biometric should work for User A only

**Expected Results**:
- ✅ User A sees biometric prompt
- ✅ User B sees standard login
- ✅ Preferences don't mix between users
- ✅ Correct user session restored

---

### TC-7: Session Restoration Flow
**Objective**: Verify complete session restoration with fresh token

**Steps**:
1. Enable biometric and close app
2. Monitor console logs
3. Reopen app and trigger biometric
4. Validate each step in logs

**Expected Log Flow**:
```
🔄 Restoring session after biometric authentication
🔑 Getting fresh Firebase token...
🔍 Validating Firebase session for biometric login...
✅ Firebase session is valid
🔄 Getting fresh Firebase token...
✅ Fresh token obtained from Firebase
🔍 Session restore - calling API getProfile to verify fresh token...
✅ Session restored successfully after biometric auth with verified token
```

**Expected Results**:
- ✅ All validation steps complete
- ✅ Fresh token used (not stale AsyncStorage token)
- ✅ Profile data fetched successfully
- ✅ User state updated
- ✅ Navigation to main app

---

### TC-8: Hardware Validation
**Objective**: Verify proper hardware checks before enabling biometric

**Test Devices**:
- ✅ iPhone with Face ID
- ✅ iPhone with Touch ID
- ✅ Android with Fingerprint
- ✅ Device without biometric (should show error)

**Steps**:
1. Attempt to enable biometric on each device
2. Verify appropriate prompt/error

**Expected Results**:
- Face ID device: "Authenticate with Face ID"
- Touch ID device: "Authenticate with Touch ID"
- Android: "Authenticate with Fingerprint"
- No biometric: "Biometric authentication is not available..."

---

### TC-9: Concurrent Token Refresh
**Objective**: Verify token refresh doesn't cause race conditions

**Steps**:
1. Enable biometric
2. Make multiple API calls simultaneously
3. Trigger biometric login during API calls
4. Verify all operations complete successfully

**Expected Results**:
- ✅ No race conditions
- ✅ Token refresh synchronized
- ✅ All API calls succeed
- ✅ No duplicate token refreshes

---

### TC-10: Backward Compatibility
**Objective**: Verify existing users aren't affected negatively

**Steps**:
1. Simulate app update (existing user with biometric enabled)
2. Launch updated app
3. Verify biometric still works

**Expected Results**:
- ✅ Existing biometric preferences preserved
- ✅ First login may prompt for re-authentication
- ✅ Subsequent logins work smoothly
- ✅ No data loss

---

## Performance Benchmarks

### Target Metrics
- **Biometric Login Time**: < 3 seconds
- **Token Refresh Time**: < 1 second
- **Session Validation**: < 500ms
- **Error Response Time**: Immediate (<100ms)

### Monitoring Points
```javascript
console.time('biometric-login');
// ... biometric flow ...
console.timeEnd('biometric-login');
```

---

## Automated Test Execution

### Run Unit Tests
```bash
cd /home/runner/work/spendy-fresh/spendy-fresh
yarn test src/services/api/__tests__/ApiService.token.test.ts
yarn test src/services/biometric/__tests__/BiometricAuthService.firebase.test.ts
```

### Run Validation Script
```bash
./scripts/validate-biometric-fix.sh
```

---

## Bug Report Template

If issues are found:

```markdown
**Issue**: [Brief description]
**Test Case**: TC-X
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**: 
**Actual Behavior**: 
**Device**: [iOS/Android version, device model]
**App Version**: 
**Logs**: 
[Paste relevant console logs]

**Screenshots**: 
[Attach if applicable]
```

---

## Sign-Off Criteria

Before marking this fix as complete:

- [ ] All test cases (TC-1 through TC-10) pass
- [ ] No regression in existing functionality
- [ ] Performance benchmarks met
- [ ] All edge cases handled gracefully
- [ ] Unit tests pass (100% coverage for new code)
- [ ] Validation script passes
- [ ] Documentation reviewed
- [ ] Code review completed
- [ ] User acceptance testing completed

---

## Rollback Plan

If critical issues are found:

1. Revert commits: `git revert b68faeb..1a0dfdc`
2. Disable biometric for all users via backend flag
3. Deploy hotfix with reverted changes
4. Investigate and fix root cause
5. Re-test thoroughly before re-deployment

---

**Test Plan Version**: 1.0  
**Last Updated**: December 2024  
**Test Coverage**: Comprehensive (10 test cases, multiple scenarios)
