# Spendy Fresh - Splitting Flows for Figma

## 🎯 Overview
Complete user flows for expense splitting functionality in Spendy Fresh app.

---

## 📱 Main Splitting Flows

### 1. **Add New Expense Flow**

#### Flow A: Add Expense from Group
```
1. Group Screen → Tap "Add Expense" FAB
2. Add Expense Screen
   - Expense Amount Input
   - Description Field
   - Category Dropdown
   - Date Picker
   - "Who Paid?" - User Selection
   - "Split Between" - Multi-select Members
3. Split Options Screen
   - Equal Split (default)
   - Unequal Split
   - Percentage Split
   - By Shares
4. Split Details Screen (if unequal)
   - Individual amount inputs
   - Percentage sliders
   - Share inputs
5. Review & Confirm Screen
   - Expense summary
   - Split breakdown
   - "Add Expense" CTA
6. Success Screen → Back to Group
```

#### Flow B: Add Expense from Quick Actions
```
1. Home Screen → "Quick Add" Button
2. Quick Expense Modal
   - Amount
   - Description
   - Select Group
3. Auto-split equally → Confirm
4. Success Toast → Back to Home
```

### 2. **Expense Management Flow**

#### Flow A: View & Edit Expense
```
1. Group Screen → Tap Expense Item
2. Expense Detail Screen
   - Amount & Description
   - Split breakdown
   - Payment status
   - Edit/Delete options
3. Edit Expense Screen (if edit)
   - Modify amount/description
   - Adjust splits
   - Save changes
4. Confirmation → Back to Group
```

#### Flow B: Delete Expense
```
1. Expense Detail → "Delete" Button
2. Delete Confirmation Modal
   - Warning about balance reversal
   - "Cancel" / "Delete" buttons
3. Loading → Success
4. Back to Group with updated balances
```

### 3. **Settlement Flows**

#### Flow A: Manual Settlement
```
1. Friend/Group Balance → "Settle Up" Button
2. Settlement Options Screen
   - Amount to settle
   - Settlement method
   - Add note (optional)
3. Confirm Settlement Screen
   - Payment details
   - "Mark as Paid" CTA
4. Success Screen
   - Updated balance
   - Settlement record
```

#### Flow B: Smart Settlement Suggestions
```
1. Group Screen → "Optimize Debts" Button
2. Settlement Suggestions Screen
   - List of optimized payments
   - Tap to select suggestion
3. Bulk Settlement Screen
   - Multiple settlements
   - "Settle All" option
4. Confirmation → Success
```

### 4. **Payment Request Flow**

#### Flow A: Request Payment
```
1. Balance Screen → "Request Payment"
2. Payment Request Screen
   - Amount input
   - Select recipient
   - Add message
   - Send method (in-app/SMS)
3. Send Confirmation
4. Request Sent Success
```

#### Flow B: Respond to Payment Request
```
1. Notification → Tap Payment Request
2. Payment Request Detail
   - Amount & message
   - Requester info
   - "Pay Now" / "Decline" options
3. Payment Method Selection (if Pay)
4. Payment Confirmation
5. Success → Notification to requester
```

### 5. **Group Management Flow**

#### Flow A: Create Group
```
1. Groups Tab → "Create Group" FAB
2. Group Setup Screen
   - Group name
   - Group image (optional)
   - Privacy settings
3. Add Members Screen
   - Search/invite friends
   - Add from contacts
   - Send invitations
4. Group Created Success
5. Group Dashboard
```

#### Flow B: Join Group
```
1. Invitation Link/QR → Open App
2. Group Invitation Screen
   - Group details
   - Current members
   - "Join Group" CTA
3. Joining Group Loading
4. Welcome to Group Screen
5. Group Dashboard
```

### 6. **Friend Management Flow**

#### Flow A: Add Friend
```
1. Friends Tab → "Add Friend" Button
2. Add Friend Options
   - Search by email/phone
   - Scan QR code
   - Import from contacts
3. Friend Request Screen
   - Friend details
   - Personal message
   - "Send Request" CTA
4. Request Sent Confirmation
```

#### Flow B: Accept Friend Request
```
1. Notification → Friend Request
2. Friend Request Detail
   - Requester profile
   - "Accept" / "Decline" options
3. Accept Confirmation
4. Friend Added Success
5. Updated Friends List
```

---

## 🔄 Navigation Flows

### Tab Navigation Structure
```
Bottom Tabs:
├── Home (Dashboard)
├── Groups
├── Friends
├── Expenses
└── Profile

Floating Actions:
├── Quick Add Expense (Home)
├── Create Group (Groups)
├── Add Friend (Friends)
└── Scan QR (Universal)
```

### Modal Flows
```
Modals Stack:
├── Add Expense Modal
├── Settlement Modal
├── Payment Request Modal
├── Group Settings Modal
├── Expense Detail Modal
└── Profile Edit Modal
```

---

## 🎨 Screen Templates

### 1. **Expense List Screen**
```
Components:
- Header with group name & balance
- Filter/Sort options
- Expense cards with:
  - Amount & description
  - Split participants (avatars)
  - Payment status indicator
  - Date
- FAB for "Add Expense"
- Empty state for no expenses
```

### 2. **Balance Summary Screen**
```
Components:
- Overall balance card
- Individual friend balances
- Settlement suggestions
- Recent activity feed
- Quick actions (Settle Up, Request Payment)
```

### 3. **Split Configuration Screen**
```
Components:
- Split type selector (Equal/Unequal/Percentage)
- Member list with amounts/percentages
- Total validation indicator
- Advanced options toggle
- Continue/Save button
```

### 4. **Payment Flow Screen**
```
Components:
- Payment amount (large)
- Recipient information
- Payment method selector
- Security verification
- Confirmation button
- Transaction receipt
```

---

## 🌟 Enhanced Features

### 1. **Recurring Expenses**
```
Flow:
1. Add Expense → "Make Recurring" Toggle
2. Recurring Settings
   - Frequency (weekly/monthly/custom)
   - End date or occurrence count
   - Auto-split settings
3. Recurring Expense Created
4. Automatic processing notifications
```

### 2. **Expense Templates**
```
Flow:
1. Add Expense → "Save as Template"
2. Template Settings
   - Template name
   - Default participants
   - Category & split type
3. Use Template Flow
   - Select from template list
   - Modify if needed
   - Quick add
```

### 3. **Analytics & Insights**
```
Flow:
1. Profile → "Spending Analytics"
2. Analytics Dashboard
   - Spending trends
   - Category breakdown
   - Group comparisons
   - Settlement patterns
3. Detailed Reports
4. Export options
```

### 4. **Expense Approval Flow**
```
Flow:
1. Add Large Expense → Auto-approval trigger
2. Approval Request Screen
3. Admin Notification
4. Approval/Rejection Flow
5. Expense processed/rejected
```

---

## 🔔 Notification Flows

### In-App Notifications
```
1. New expense added
2. Payment received
3. Settlement completed
4. Friend request
5. Group invitation
6. Payment reminder
7. Expense approval needed
```

### Push Notifications
```
1. Payment request received
2. Large expense needs approval
3. Weekly spending summary
4. Outstanding balance reminder
5. Friend activity updates
```

---

## 💡 Interaction Patterns

### Gestures
- **Swipe right**: Quick settle on balance item
- **Swipe left**: Delete/Archive expense
- **Long press**: Multi-select mode
- **Pull to refresh**: Update balances
- **Pinch zoom**: Expense receipt view

### Micro-interactions
- **Loading states**: Skeleton screens
- **Success animations**: Checkmark with bounce
- **Error states**: Shake animation
- **Balance updates**: Number counter animation
- **Settlement**: Money transfer animation

### Accessibility
- **VoiceOver**: Screen reader support
- **Large text**: Dynamic type support
- **High contrast**: Color scheme variants
- **Voice control**: Siri shortcuts
- **Haptic feedback**: Settlement confirmations

---

## 🎯 Key User Journeys

### New User Onboarding
```
1. Welcome → Sign Up → Verification
2. Profile Setup → Profile Picture
3. Add First Friend → Create First Group
4. Add First Expense → Tutorial Complete
```

### Daily Usage Patterns
```
1. Check balances (Home)
2. Add quick expense
3. Review group activity
4. Settle up weekly
5. Check spending analytics
```

### Power User Features
```
1. Bulk expense management
2. Advanced splitting rules
3. Multi-currency handling
4. Expense export/reporting
5. API integrations
```

---

## 📋 Figma Organization Tips

### Frame Structure
```
📁 Spendy Fresh Splitting
├── 🏠 Flows
│   ├── Add Expense Flow
│   ├── Settlement Flow
│   ├── Payment Request Flow
│   └── Group Management Flow
├── 📱 Screens
│   ├── Expense Screens
│   ├── Balance Screens
│   ├── Group Screens
│   └── Profile Screens
├── 🧩 Components
│   ├── Expense Cards
│   ├── Balance Components
│   ├── User Avatars
│   └── Action Buttons
└── 🎨 Design System
    ├── Colors & Typography
    ├── Icons & Illustrations
    ├── Spacing & Layout
    └── Animation Specs
```

### Component Library
```
✅ Reusable Components:
- Expense Card Component
- User Avatar Component
- Balance Display Component
- Action Button Component
- Modal Container Component
- Input Field Component
- Settlement Card Component
- Notification Component
```

This comprehensive flow documentation will help you create detailed Figma prototypes that cover all splitting functionality in your Spendy Fresh app. Each flow includes the complete user journey with decision points, error states, and success paths.
