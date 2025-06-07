# Visual Mockups Guide - Real UI Images

## 🎨 Creating Real Visual Mockups in Figma

### 1. **Setting Up Figma for Real Content**

#### Install Figma Plugins
```
Essential Plugins for Real Content:
1. "Content Reel" - Real user avatars and names
2. "Unsplash" - High-quality stock photos
3. "Iconify" - Thousands of real icons
4. "Lorem Faces" - Diverse user avatars
5. "Figma to HTML/CSS" - Export real code
6. "Auto Layout" - Responsive components
7. "Component Utilities" - Batch operations
8. "Stark" - Accessibility checking
```

#### Real Data Sources
```
User Content:
- Real names: John Smith, Maria Garcia, Alex Chen, Sarah Johnson
- Real emails: john.smith@gmail.com, maria.g@yahoo.com
- Real phone: +1 (555) 123-4567
- Real addresses: 123 Main St, San Francisco, CA

Financial Data:
- Real amounts: $24.67, $156.89, $8.50, $299.99
- Real categories: 🍕 Food & Dining, ⛽ Transportation, 🏠 Housing
- Real merchants: Starbucks, Uber, Target, Amazon, Chipotle

Dates & Times:
- Real timestamps: Dec 15, 2024 at 2:30 PM
- Real date ranges: Last 7 days, This month, Q4 2024
```

### 2. **Creating Real Screen Mockups**

#### Home Dashboard - Real Content
```
Create Frame: iPhone 14 Pro (393 × 852)

Header Section:
- User avatar: Use real photo from Unsplash
- Greeting: "Good morning, Alex!"
- Date: "Tuesday, June 8, 2025"

Balance Cards:
- You owe: $127.45 (red background)
- You are owed: $89.20 (green background)
- Net balance: -$38.25

Recent Activity (Real transactions):
1. 🍕 Chipotle Mexican Grill
   Split with Maria, John, Sarah
   Yesterday, 7:30 PM
   Your share: $12.40

2. ⛽ Shell Gas Station
   Paid by John
   Dec 14, 2024
   You owe: $8.75

3. 🎬 AMC Theater
   Split equally (4 people)
   Dec 13, 2024
   Settled ✓

Quick Actions:
- [+ Add Expense] button with gradient
- [Settle Up] button with green accent
```

#### Add Expense Screen - Real Content
```
Create Frame: iPhone 14 Pro (393 × 852)

Header:
- Title: "Add Expense"
- Cancel (X) and Save buttons

Amount Input:
- Large currency field: $0.00
- Animated cursor
- Keypad overlay

Description Field:
- Placeholder: "What was this expense for?"
- Suggestions: "Dinner", "Gas", "Groceries", "Movie"

Category Selector:
- Grid of real category icons:
  🍽️ Food & Dining    🏠 Housing
  🚗 Transportation   🛍️ Shopping
  🎬 Entertainment    💊 Healthcare
  ✈️ Travel          📱 Utilities

Paid By:
- User avatar + "You" (selected)
- Friend avatars: Maria, John, Sarah

Split Configuration:
- "Split equally between 4 people"
- Individual amounts: $12.50 each
- Toggle for "Unequal split"
```

### 3. **Real UI Component Examples**

#### Expense Card Component
```html
<!-- Real implementation structure -->
<div class="expense-card">
  <div class="expense-icon">
    🍕 <!-- Real category emoji -->
  </div>
  <div class="expense-content">
    <h3>Chipotle Mexican Grill</h3>
    <p>Split with Maria, John (+2 others)</p>
    <span class="date">Yesterday, 7:30 PM</span>
  </div>
  <div class="expense-amount">
    <span class="amount">$49.60</span>
    <span class="your-share">Your share: $12.40</span>
    <span class="status paid">✓ Settled</span>
  </div>
</div>
```

#### Balance Display Component
```html
<div class="balance-card positive">
  <div class="balance-header">
    <h2>You are owed</h2>
    <span class="trend up">↗ +$15.50</span>
  </div>
  <div class="balance-amount">
    <span class="currency">$</span>
    <span class="amount">89.20</span>
  </div>
  <div class="balance-actions">
    <button class="btn-primary">Request Payment</button>
    <button class="btn-secondary">Remind</button>
  </div>
</div>
```

### 4. **Creating High-Fidelity Mockups**

#### Step 1: Set Up Real Design System
```
Colors (Real app palette):
- Primary: #6366F1 (Indigo)
- Success: #10B981 (Emerald)
- Warning: #F59E0B (Amber)
- Error: #EF4444 (Red)
- Surface: #FFFFFF
- Background: #F9FAFB

Typography (Real fonts):
- Primary: SF Pro Display (iOS) / Roboto (Android)
- Weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

Shadows (Real elevation):
- Card: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
- Modal: 0 10px 25px rgba(0,0,0,0.15)
- FAB: 0 4px 14px rgba(0,0,0,0.25)
```

#### Step 2: Use Real Content in Components
```
Friend List with Real Data:

┌─────────────────────────────────────┐
│ 📱 Friends                    + Add │
├─────────────────────────────────────┤
│                                     │
│ 👨‍💼 Alex Thompson      🟢 Online    │
│    alex.thompson@gmail.com          │
│    Last expense: 3 days ago  $12.50 │
│                                     │
│ 👩‍🦱 Maria Garcia                   │
│    maria.garcia@yahoo.com           │
│    You owe Maria         -$23.75    │
│                                     │
│ 👨‍🎓 John Smith           💬 Active  │
│    john.smith@outlook.com           │
│    John owes you         +$45.00    │
│                                     │
│ 👩‍💻 Sarah Chen                     │
│    sarah.chen@apple.com             │
│    All settled             $0.00    │
│                                     │
└─────────────────────────────────────┘
```

#### Step 3: Create Interactive Prototypes
```
Animation Specifications:

Button Press:
- Scale: 98% on touch down
- Duration: 100ms
- Easing: ease-out
- Haptic: light impact

Card Tap:
- Scale: 96% briefly
- Shadow: increase 2px
- Duration: 150ms
- Transition to detail view

Amount Counter:
- Duration: 800ms
- Easing: ease-out
- Count from 0 to target
- Include comma formatting

Modal Entry:
- Slide up from bottom
- Duration: 300ms
- Spring: 0.8 tension, 0.9 friction
- Background blur + darken
```

### 5. **Real Screen Templates**

#### Group Detail Screen
```
Create this with actual content in Figma:

Header:
- Group photo: Beach vacation group selfie
- Group name: "Cabo Trip 2024"
- 6 members with real profile photos

Balance Summary:
- Total group expenses: $2,847.60
- Your total paid: $945.20
- Your share: $474.60
- You are owed: $470.60

Member Balances:
- Alex (You): +$470.60 [Request Payment]
- Maria: -$156.40 [Settle Up]
- John: +$89.20 [Send Reminder]
- Sarah: -$45.80 [Settled ✓]
- Mike: -$234.70 [Overdue ⚠️]
- Lisa: -$122.90 [Pending 🟡]

Recent Expenses:
1. 🍽️ Dinner at Sunset Grill
   Paid by Alex • Split 6 ways
   June 7, 8:30 PM • $234.60

2. 🚗 Uber to Airport
   Paid by Maria • Alex, John, Sarah
   June 6, 11:15 AM • $45.80

3. 🏨 Airbnb Cleaning Fee
   Paid by Mike • Split equally
   June 6, 10:00 AM • $120.00
```

#### Settlement Flow Screens
```
Screen 1: Select Settlement Amount
┌─────────────────────────────────────┐
│ ← Settle with Maria                 │
├─────────────────────────────────────┤
│                                     │
│ 👩‍🦱 Maria Garcia                   │
│    maria.garcia@yahoo.com           │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │     You owe Maria               │ │
│ │       $156.40                   │ │
│ │   ↓ From 3 shared expenses      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Settlement Amount:                  │
│ ┌─────────────────────────────────┐ │
│ │ $     156.40                    │ │
│ └─────────────────────────────────┘ │
│ □ Partial payment                   │
│                                     │
│ Add a note (optional):              │
│ ┌─────────────────────────────────┐ │
│ │ Settlement for Cabo trip        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │         Mark as Paid            │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

Screen 2: Payment Success
┌─────────────────────────────────────┐
│                                     │
│                ✅                   │
│         Payment Recorded            │
│                                     │
│        You paid Maria               │
│          $156.40                    │
│                                     │
│    Your balance is now settled!     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │         Done                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│         View Receipt                │
│                                     │
└─────────────────────────────────────┘
```

### 6. **Tools for Creating Real Mockups**

#### Figma Plugins to Install
```bash
# Search and install these in Figma:
1. Content Reel - Real user data
2. Unsplash - Stock photos
3. Iconify - Icon library
4. Stark - Accessibility
5. Figma to Code - Export to React/Flutter
6. Component Utilities - Batch operations
7. Auto Layout - Responsive design
8. Lorem Faces - Diverse avatars
```

#### External Tools
```bash
# For creating custom assets:
1. Sketch - Alternative design tool
2. Adobe XD - UI/UX design
3. Principle - Advanced prototyping
4. Framer - Interactive prototypes
5. InVision - Collaboration
6. Maze - User testing
7. Zeplin - Design handoff
8. Abstract - Version control
```

### 7. **Creating Real App Icons & Illustrations**

#### App Icons Needed
```
Navigation Icons:
- Home: House outline/filled
- Groups: People outline/filled  
- Friends: Person outline/filled
- Expenses: Receipt outline/filled
- Profile: User circle outline/filled

Category Icons:
- Food: 🍽️ Restaurant, 🍕 Pizza, ☕ Coffee
- Transport: 🚗 Car, ⛽ Gas, 🚇 Transit
- Entertainment: 🎬 Movie, 🎮 Games, 🎵 Music
- Shopping: 🛍️ Bags, 👕 Clothing, 📱 Electronics
- Travel: ✈️ Flight, 🏨 Hotel, 🗺️ Maps

Action Icons:
- Add: + Plus circle
- Split: Divide symbol
- Settle: Handshake
- Request: Hand with dollar
- Send: Paper plane
- Edit: Pencil
- Delete: Trash
- More: Three dots
```

#### Custom Illustrations
```
Empty States:
1. No expenses: Person with empty wallet
2. No friends: People connecting
3. No groups: Team collaboration
4. All settled: Celebration/checkmark

Success States:
1. Payment sent: Money flying
2. Expense added: Receipt with checkmark
3. Friend added: Handshake
4. Group created: Team high-five

Error States:
1. Payment failed: Credit card with X
2. Network error: Disconnected wifi
3. Invalid amount: Calculator with error
4. Permission denied: Lock icon
```

### 8. **Responsive Design Examples**

#### Mobile Layouts (375px width)
```
Stack components vertically:
- Header (60px height)
- Balance cards (120px each)
- Recent activity list (remaining space)
- Tab bar (80px height)

Touch targets: Minimum 44px
Padding: 16px sides, 8px vertical
Font sizes: 14px body, 18px headers
```

#### Tablet Layouts (768px width)
```
Two-column layout:
- Left: Navigation + Balance summary
- Right: Expense list + details
- Modal overlays: 500px max width

Touch targets: Minimum 44px
Padding: 24px sides, 12px vertical
Font sizes: 16px body, 24px headers
```

This guide will help you create real, visual mockups instead of ASCII art boxes. The key is using actual content, real design assets, and proper Figma setup to create high-fidelity designs that stakeholders and developers can actually visualize and understand.
