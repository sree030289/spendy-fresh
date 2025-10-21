# Response to Apple App Review Team
**App Name:** Meet-n-Split  
**Submission ID:** 9086e030-13be-4e63-a0fe-f01dde4c8f95  
**Date:** October 22, 2025

---

Dear Apple App Review Team,

Thank you for reviewing Meet-n-Split and providing detailed feedback. We have addressed all the issues mentioned in your rejection message. Below are the changes made and responses to your questions:

---

## ✅ RESOLVED ISSUES

### 1. **iPad Screenshots** (Guideline 2.3.3) - ✅ FIXED
**Issue:** App preview screenshots showed iPhone device frames instead of iPad screenshots.

**Resolution:**
- ✅ Replaced all 13-inch iPad Pro screenshots with proper iPad device screenshots
- ✅ Screenshots now show the app running on actual iPad devices
- ✅ All required iPad screenshot slots have been filled with appropriate images

---

### 2. **Terms of Use Link** (Guideline 3.1.2) - ✅ FIXED
**Issue:** The app description mentioned Terms of Use but did not include a functional link.

**Resolution:**
- ✅ Added functional Terms of Use (EULA) link in app description: https://spendy-97913.web.app/terms.html
- ✅ Added Privacy Policy link: https://spendy-97913.web.app/privacy.html
- ✅ Both documents are accessible, properly formatted, and specific to Meet-n-Split

---

### 3. **Account Deletion** (Guideline 5.1.1(v)) - ✅ IMPLEMENTED & TESTED
**Issue:** App required account deletion capability.

**Resolution:**
We have fully implemented in-app account deletion functionality:

**Implementation Details:**
- ✅ Delete Account option added in: **Profile → Account Settings → Delete Account**
- ✅ User sees confirmation dialog before deletion
- ✅ System checks for pending balances/settlements before allowing deletion
- ✅ If user has unsettled expenses, deletion is blocked with clear message showing pending balances
- ✅ If no pending balances, account is deleted immediately
- ✅ All user data is removed: friendships, friend requests, group memberships, activities, notifications, subscriptions
- ✅ User session is cleared and redirected to login screen
- ✅ Deleted accounts cannot log back in

**Testing Evidence:**
- Feature has been tested and verified working in production
- Backend endpoint: `DELETE /auth/account` at https://meetnsplitapi-k5mlmspqua-uc.a.run.app
- Account deletion completes successfully in ~1.7 seconds
- Session cleanup and navigation work as expected

**User Experience:**
1. User taps "Delete Account" button in Profile
2. System displays confirmation alert with warning message
3. User confirms deletion
4. System checks for pending balances
5. If clear: Account deleted, session cleared, redirected to login
6. If pending: Shows detailed list of unsettled expenses with amounts

---

## 📝 RESPONSES TO YOUR QUESTIONS

### Question 1: Why does the app require phone number for registration?

The phone number is required for the following essential features of Meet-n-Split:

**1. Expense Splitting with Contacts:**
Users can add friends directly from their contacts by phone number to split expenses quickly, eliminating the need to manually search or enter email addresses. This makes the expense splitting process more convenient and faster.

**2. SMS Friend Invitations:**
Users can invite friends who don't have the app yet via SMS to join groups and split expenses. The phone number is normalized and stored in E.164 international format for accurate matching when invited users register.

**3. Duplicate Account Prevention:**
Phone numbers are validated and normalized to prevent users from creating multiple accounts with the same phone number, ensuring data integrity and preventing abuse.

**4. User Identification:**
Phone numbers serve as a unique identifier to help users find and connect with friends already on the platform, similar to how WhatsApp, Venmo, or Splitwise operate.

**Technical Implementation:**
- Phone numbers are validated using the libphonenumber-js library
- All phone numbers are normalized to E.164 international format (+[country code][number])
- Users can still use the app's core expense tracking features without providing contacts access

---

### Question 2: Does your app upload user's contacts to our server?

**Short Answer:** Meet-n-Split does NOT upload or sync the user's entire contact list to our servers.

**Detailed Explanation:**

**WHAT WE STORE:**

1. **User's Own Information (Registration):**
   When a user registers, we store their email and phone number in our Firestore database for:
   - User authentication and account management
   - Finding and connecting with other registered users
   - Sending friend requests and invitations
   - SMS-based friend invitations

2. **Selected Contacts for Invitations (User-Initiated Only):**
   When a user explicitly selects specific contacts to invite as friends, we store only the phone numbers of those selected contacts to:
   - Check if those phone numbers are already registered users
   - Create friend request records in Firestore
   - Track pending SMS invitations
   - Match users when invited contacts later register on the platform

**WHAT WE DO NOT DO:**

1. ❌ **No Bulk Contact Upload:** We do not upload or store the user's entire contact list to our servers.

2. ❌ **No Background Syncing:** Contacts are only accessed when the user explicitly taps "Add from Contacts" in the Add Friend modal. No automatic or background contact syncing occurs.

3. ❌ **No Contact Details Beyond Phone:** We only store phone numbers of selected contacts for friend requests. We do not store names, emails, addresses, or any other contact information from the user's address book.

4. ✅ **Full User Control:**
   - Users manually select which contacts to invite (one by one or in small batches)
   - Users can revoke contacts permission at any time through device Settings
   - The app continues to function with manual friend addition via email or phone number input
   - Users are not required to grant contacts access to use the app
   - All core features work without contacts permission

**DATA USAGE:**

The stored phone numbers are used exclusively for:
- Matching users when sending/receiving friend requests
- SMS-based invitation system (for users not yet on the platform)
- Preventing duplicate accounts
- Connecting users who mutually invite each other

**PRIVACY & SECURITY:**

- Phone numbers are normalized and stored in E.164 international format
- All contact data is stored securely in Firebase Firestore with proper access controls
- Users can delete their account and all associated data at any time (including stored contact information)
- We comply with data protection regulations and our Privacy Policy
- Contact permission is used solely for the convenience of selecting friends to invite

**Technical Architecture:**
- Contact selection happens on-device using iOS Contacts framework
- Only selected phone numbers are transmitted to our backend
- Backend API endpoint: `POST /friends/request` receives individual phone numbers
- No bulk upload endpoint exists in our codebase

---

## 📊 SUMMARY OF CHANGES

| Issue | Status | Evidence |
|-------|--------|----------|
| iPad Screenshots | ✅ Fixed | New screenshots uploaded to App Store Connect |
| Terms of Use Link | ✅ Fixed | Links added in app description |
| Account Deletion | ✅ Implemented | Feature available in Profile → Account Settings |
| Phone Number Usage | ✅ Clarified | Detailed explanation provided above |
| Contact Upload | ✅ Clarified | Explained limited, user-controlled storage |

---

## 🎯 NEXT STEPS

All issues have been resolved and the app is now compliant with Apple's guidelines:

- ✅ Guideline 2.3.3 (iPad Screenshots)
- ✅ Guideline 3.1.2 (Terms of Use)
- ✅ Guideline 5.1.1(v) (Account Deletion)
- ✅ Privacy concerns addressed with detailed explanations

We have uploaded a new build (version 1.0, build X) with the account deletion feature fully implemented and tested. The app is ready for re-review.

Thank you for your thorough review process. We appreciate your guidance in ensuring our app meets Apple's high standards for user privacy and experience.

---

**Sincerely,**  
Meet-n-Split Development Team

**Support Contact:** admin@meetnsplit.com  
**App Website:** https://spendy-97913.web.app  
**Privacy Policy:** https://spendy-97913.web.app/privacy.html  
**Terms of Use:** https://spendy-97913.web.app/terms.html
