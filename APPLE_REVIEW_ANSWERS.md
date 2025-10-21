# 📋 COPY-PASTE ANSWERS FOR APPLE APP REVIEW

**Submission ID:** 9086e030-13be-4e63-a0fe-f01dde4c8f95  
**Date:** October 21, 2025

---

## ✅ QUESTION 1: Why does the app require phone number for registration?

**COPY THIS ANSWER:**

```
The phone number is required for the following essential features of Meet-n-Split:

1. Expense Splitting with Contacts: Users can add friends directly from their contacts by phone number to split expenses quickly, eliminating the need to manually search or enter email addresses.

2. SMS Friend Invitations: Users can invite friends who don't have the app yet via SMS to join groups and split expenses. The phone number is normalized and stored in E.164 international format for accurate matching.

3. Duplicate Account Prevention: Phone numbers are validated and normalized to prevent users from creating multiple accounts with the same phone number, ensuring data integrity.

4. User Identification: Phone numbers serve as a unique identifier to help users find and connect with friends already on the platform, similar to WhatsApp or Venmo.

Note: The phone number is validated using libphonenumber-js library and normalized to E.164 format. Users can still use the app's core expense tracking features without providing contacts access.
```

---

## ✅ QUESTION 2: Does your app upload user's contacts to your server?

**COPY THIS ANSWER:**

```
Meet-n-Split does NOT upload or sync the user's entire contact list to our servers. However, we do store specific contact information in the following limited scenarios:

WHAT WE STORE:

1. User's Own Information (Registration): When a user registers, we store their email and phone number in our Firestore database. This is standard account information needed for:
   - User authentication and account management
   - Finding and connecting with other registered users
   - Sending friend requests and invitations
   - SMS-based friend invitations

2. Selected Contacts for Invitations: When a user explicitly selects specific contacts to invite as friends, we store only the phone numbers of those selected contacts to:
   - Check if those phone numbers are already registered users
   - Create friend request records
   - Track pending SMS invitations
   - Match users when invited contacts later register

WHAT WE DO NOT DO:

1. No Bulk Contact Upload: We do not upload or store the user's entire contact list.

2. No Background Syncing: Contacts are only accessed when the user explicitly taps "Add from Contacts" in the Add Friend modal. No automatic or background contact syncing occurs.

3. No Contact Details Beyond Phone: We only store phone numbers of selected contacts for friend requests. We do not store names, emails, addresses, or any other contact information from the user's address book.

4. User Control:
   - Users manually select which contacts to invite (one by one or in small batches)
   - Users can revoke contacts permission at any time through device settings
   - The app continues to function with manual friend addition via email or phone number input
   - Users are not required to grant contacts access to use the app

DATA USAGE:

The stored phone numbers are used exclusively for:
- Matching users when sending/receiving friend requests
- SMS-based invitation system (for users not yet on the platform)
- Preventing duplicate accounts
- Connecting users who mutually invite each other

PRIVACY & SECURITY:

- Phone numbers are normalized and stored in E.164 international format
- All contact data is stored securely in Firestore with proper access controls
- Users can delete their account and all associated data at any time (including stored contact information)
- We comply with data protection regulations and our Privacy Policy

The contact permission (NSContactsUsageDescription on iOS, READ_CONTACTS on Android) is used solely for the convenience of selecting friends from the user's contacts to invite, not for uploading or syncing entire contact databases.
```

---

## 📱 HOW TO SUBMIT THESE ANSWERS

### In App Store Connect:

1. Go to **App Store Connect** → **My Apps** → **Meet-n-Split**
2. Click on the version **1.0** (currently in review)
3. Scroll to **App Review Information** section
4. Click **Reply to App Review in Resolution Center**
5. Copy and paste Question 1 answer in the response field
6. Add a separator line (or submit separately)
7. Copy and paste Question 2 answer
8. Click **Submit**

---

## 📝 ADDITIONAL NOTES TO INCLUDE

You can add this at the end of your response:

```
ADDITIONAL INFORMATION:

We have also implemented the following changes to address all review guidelines:

1. Account Deletion Feature: We have added a full account deletion feature in Profile → Account Settings → Delete Account that:
   - Checks for pending financial settlements before deletion
   - Provides clear warnings if balances exist
   - Completely removes all user data upon confirmation
   - Clears the session and redirects to login

2. Terms of Use & Privacy Policy: Our app description includes links to:
   - Terms of Use: https://spendy-97913.web.app/terms.html
   - Privacy Policy: https://spendy-97913.web.app/privacy.html

3. iPad Screenshots: We will upload proper iPad screenshots showing the app on actual iPad devices (currently in progress).

We believe these changes fully address all concerns raised in the review and comply with Apple's App Store Guidelines.

Thank you for your time and consideration.
```

---

## ⚠️ IMPORTANT REMINDERS

Before submitting your response:

1. ✅ Make sure account deletion is deployed to production
2. ✅ Add Terms of Use link to App Description
3. ✅ Upload iPad screenshots
4. ✅ Test the account deletion feature works
5. ✅ Verify Terms/Privacy URLs are accessible

---

**Ready to copy and paste into App Store Connect!** 🚀
