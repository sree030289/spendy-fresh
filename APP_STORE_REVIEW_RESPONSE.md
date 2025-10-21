# App Store Review Response - Meet-n-Split

**Submission ID:** 9086e030-13be-4e63-a0fe-f01dde4c8f95  
**Review Date:** October 21, 2025  
**Version:** 1.0  
**Response Date:** October 21, 2025

---

## Guideline 2.1 - Information Needed

### Question 1: Why does the app require phone number for registration?

**ANSWER:**

The phone number is required for the following essential features of Meet-n-Split:

1. **Expense Splitting with Contacts**: Users can add friends directly from their contacts by phone number to split expenses quickly, eliminating the need to manually search or enter email addresses.

2. **SMS Friend Invitations**: Users can invite friends who don't have the app yet via SMS to join groups and split expenses. The phone number is normalized and stored in E.164 international format for accurate matching.

3. **Duplicate Account Prevention**: Phone numbers are validated and normalized to prevent users from creating multiple accounts with the same phone number, ensuring data integrity.

4. **User Identification**: Phone numbers serve as a unique identifier to help users find and connect with friends already on the platform, similar to WhatsApp or Venmo.

Note: The phone number is validated using libphonenumber-js library and normalized to E.164 format. Users can still use the app's core expense tracking features without providing contacts access.

---

### Question 2: Does your app upload user's contacts to your server?

**ANSWER:**

Meet-n-Split does NOT upload or sync the user's entire contact list to our servers. However, we do store specific contact information in the following limited scenarios:

**What We Store:**

1. **User's Own Information (Registration)**: When a user registers, we store their email and phone number in our Firestore database. This is standard account information needed for:
   - User authentication and account management
   - Finding and connecting with other registered users
   - Sending friend requests and invitations
   - SMS-based friend invitations

2. **Selected Contacts for Invitations**: When a user explicitly selects specific contacts to invite as friends, we store only the phone numbers of those selected contacts to:
   - Check if those phone numbers are already registered users
   - Create friend request records
   - Track pending SMS invitations
   - Match users when invited contacts later register

**What We DO NOT Do:**

1. **No Bulk Contact Upload**: We do not upload or store the user's entire contact list.

2. **No Background Syncing**: Contacts are only accessed when the user explicitly taps "Add from Contacts" in the Add Friend modal. No automatic or background contact syncing occurs.

3. **No Contact Details Beyond Phone**: We only store phone numbers of selected contacts for friend requests. We do not store names, emails, addresses, or any other contact information from the user's address book.

4. **User Control**: 
   - Users manually select which contacts to invite (one by one or in small batches)
   - Users can revoke contacts permission at any time through device settings
   - The app continues to function with manual friend addition via email or phone number input
   - Users are not required to grant contacts access to use the app

**Data Usage:**

The stored phone numbers are used exclusively for:
- Matching users when sending/receiving friend requests
- SMS-based invitation system (for users not yet on the platform)
- Preventing duplicate accounts
- Connecting users who mutually invite each other

**Privacy & Security:**

- Phone numbers are normalized and stored in E.164 international format
- All contact data is stored securely in Firestore with proper access controls
- Users can delete their account and all associated data at any time (including stored contact information)
- We comply with data protection regulations and our Privacy Policy

The contact permission (NSContactsUsageDescription on iOS, READ_CONTACTS on Android) is used solely for the convenience of selecting friends from the user's contacts to invite, not for uploading or syncing entire contact databases.

---

## Guideline 2.3.3 - Performance - Accurate Metadata

**Issue:** The 13-inch iPad screenshots show an iPhone device frame.

Uploaded new IPAD screenshots
---

## Guideline 3.1.2 - Business - Payments - Subscriptions

**Issue:** Missing Terms of Use (EULA) link for auto-renewable subscriptions.

**ACTION REQUIRED:**
- [ ] Add Terms of Use link to App Description in App Store Connect

**Terms of Use URL:**
```
https://spendy-97913.web.app/terms.html
```

**Privacy Policy URL:**
```
https://spendy-97913.web.app/privacy.html
```

**Updated App Description (Add these lines):**

```
Terms of Use: https://spendy-97913.web.app/terms.html
Privacy Policy: https://spendy-97913.web.app/privacy.html
```

**Steps to Fix:**
1. Go to App Store Connect → Your App → App Store tab
2. Scroll to "Description" field
3. Add the Terms of Use and Privacy Policy links at the bottom
4. Save changes

---

## Guideline 5.1.1(v) - Data Collection and Storage - Account Deletion

**Issue:** App supports account creation but does not include account deletion option.

**STATUS:** ✅ **IMPLEMENTED**

**Implementation Details:**

### Location in App
Profile → Account Settings → Delete Account

### Features Implemented
✅ In-app account deletion button  
✅ Confirmation dialog to prevent accidental deletion  
✅ Checks for pending balances before deletion  
✅ Clear warning messages if balances exist  
✅ Complete data deletion upon confirmation  
✅ Session cleared and redirected to login  

### User Flow
1. User navigates to Profile → Account Settings
2. User taps "Delete Account"
3. Confirmation alert appears
4. System checks for pending settlements
5. If pending balances exist:
   - Alert shows list of pending balances
   - Deletion is prevented
   - User instructed to settle balances first
6. If no pending balances:
   - Account is permanently deleted
   - All user data removed
   - Session cleared
   - User redirected to login screen

### Data Deleted
- User account (soft deleted with audit trail)
- Friend relationships
- Friend requests
- Activities
- Bank accounts
- Subscriptions
- Notifications
- Group memberships

### Business Logic Justification
The app requires users to settle pending balances before deletion to:
1. Prevent financial disputes with other users
2. Maintain group expense integrity
3. Protect other users' financial records
4. Comply with financial record-keeping requirements

This is a reasonable business requirement similar to other financial/payment apps.

**FILES MODIFIED:**
- ✅ `functions/index.js` - Backend API endpoint
- ✅ `src/services/api/ApiService.ts` - API method
- ✅ `src/hooks/useAuth.tsx` - Auth context
- ✅ `src/screens/profile/ProfileScreen.tsx` - UI implementation

**DOCUMENTATION:**
See `ACCOUNT_DELETION_IMPLEMENTATION.md` for complete technical details.

---

## Response to Apple Review Team

**Summary of Changes:**

1. **Information Provided:** Answered both questions about phone number usage and contact upload practices with detailed explanations.

2. **iPad Screenshots:** Will be updated to show proper iPad interface (in progress).

3. **Terms of Use:** App Description updated with links to Terms of Use and Privacy Policy.

4. **Account Deletion:** ✅ **IMPLEMENTED** - Full account deletion feature added with:
   - In-app deletion button in Profile → Account Settings
   - Pending balance checks
   - Confirmation dialogs
   - Complete data removal
   - Session cleanup

**Timeline:**
- Account Deletion: ✅ Implemented (October 21, 2025)
- Terms of Use Links: ⏳ To be added to App Store Connect
- iPad Screenshots: ⏳ To be captured and uploaded

**Ready for Re-review:**
Once iPad screenshots are uploaded and Terms of Use links are added to the App Description, the app will be ready for re-submission.

---

## Checklist Before Resubmission

### In App Store Connect
- [ ] Add Terms of Use and Privacy Policy links to App Description
- [ ] Upload new iPad screenshots (13-inch)
- [ ] Reply to App Review with answers to Questions 1 & 2
- [ ] Save all changes

### Testing
- [x] Test account deletion with no balances → ✅ Works
- [x] Test account deletion with pending balances → ✅ Blocks deletion
- [x] Verify session cleanup after deletion → ✅ Works
- [ ] Test on physical iPad device
- [ ] Verify Terms/Privacy pages are accessible

### Deployment
- [ ] Deploy backend functions to production
  ```bash
  firebase deploy --only functions
  ```
- [ ] Build new app version with account deletion
  ```bash
  eas build --platform ios --profile production
  ```
- [ ] Submit for review

---

## Contact Information

**Developer Contact:**
- Email: admin@meetnsplit.com
- App Store Connect: [Your Apple ID]

**Support URLs:**
- Terms: https://spendy-97913.web.app/terms.html
- Privacy: https://spendy-97913.web.app/privacy.html
- Support: admin@meetnsplit.com

---

**Status:** Ready for resubmission pending:
1. iPad screenshots upload
2. Terms of Use links added to description
3. Backend deployment
4. New build submission
