# Figma Setup Tutorial - Creating Real UI Mockups

## 🎯 Step-by-Step Figma Setup

### Phase 1: Initial Setup (15 minutes)

#### 1. Create New Figma File
```
1. Go to figma.com
2. Click "New design file"
3. Rename to "Spendy Fresh - Splitting App"
4. Set up pages:
   - Page 1: "Design System"
   - Page 2: "Mobile Screens"
   - Page 3: "User Flows"
   - Page 4: "Prototypes"
```

#### 2. Install Essential Plugins
```
Go to Menu > Plugins > Browse all plugins

Must-have plugins:
✅ Content Reel (for real user data)
✅ Unsplash (for photos)
✅ Iconify (for icons)
✅ Auto Layout (for responsive design)
✅ Stark (for accessibility)
✅ Component Utilities (for management)
✅ Lorem Faces (for diverse avatars)
✅ Fig Tokens (for design tokens)
```

#### 3. Set Up Design Tokens
```
Create styles for:

Colors:
- Primary/Blue: #6366F1
- Success/Green: #10B981
- Warning/Orange: #F59E0B
- Error/Red: #EF4444
- Surface/White: #FFFFFF
- Background/Gray: #F9FAFB

Text Styles:
- Heading/Large: SF Pro Display, 24px, Bold
- Heading/Medium: SF Pro Display, 20px, Semibold
- Body/Large: SF Pro Display, 16px, Regular
- Body/Small: SF Pro Display, 14px, Regular
- Caption: SF Pro Display, 12px, Regular

Effects (Shadows):
- Card: 0 1px 3px rgba(0,0,0,0.1)
- Modal: 0 10px 25px rgba(0,0,0,0.15)
- Button: 0 2px 4px rgba(0,0,0,0.1)
```

### Phase 2: Create Real Components (30 minutes)

#### 1. User Avatar Component
```
Create Master Component:

Base: 40x40 circle
Fill: Use Lorem Faces plugin for real photos
Border: 2px white with shadow

Variants:
- Size: Small (32px), Medium (40px), Large (56px)
- Status: Online (green dot), Offline (gray), Away (yellow)
- Type: Photo, Initials, Placeholder

Properties:
- User name (text override)
- Online status (boolean)
- Photo URL (text override)
```

#### 2. Expense Card Component
```
Create Master Component (343x80):

Layout (Auto Layout, 16px padding):
┌─────────────────────────────────────┐
│ [Icon 24x24] [Content Area] [Amount]│
│              [Subtitle]     [Status]│
└─────────────────────────────────────┘

Icon:
- Category emoji (🍕, ⛽, 🏠, etc.)
- 24x24 circle background
- Use Iconify plugin for consistent icons

Content:
- Title: "Chipotle Mexican Grill" (Body/Large)
- Subtitle: "Split with Maria, John (+2)" (Body/Small, gray)
- Date: "Yesterday, 7:30 PM" (Caption, light gray)

Amount:
- Main amount: "$49.60" (Heading/Medium)
- Your share: "Your share: $12.40" (Body/Small)
- Status: "✓ Settled" or "⏳ Pending" (Caption with color)

Variants:
- Status: Settled, Pending, Overdue
- Type: Your expense, Split expense, Payment
- Size: Default, Compact
```

#### 3. Balance Card Component
```
Create Master Component (343x120):

Layout (Auto Layout, 20px padding):
┌─────────────────────────────────────┐
│           You are owed              │
│            $125.50                  │
│       ↗ +$25 from last week        │
│                                     │
│   [Settle Up]    [Request Money]    │
└─────────────────────────────────────┘

Elements:
- Header: "You are owed" (Body/Large, center)
- Amount: "$125.50" (32px, Bold, center)
- Trend: "↗ +$25 from last week" (Body/Small, green)
- Actions: Two buttons (Auto Layout, 8px gap)

Variants:
- Type: Positive (green), Negative (red), Zero (gray)
- State: Default, Loading, Error
- Actions: With buttons, Without buttons

Component Properties:
- Amount (text override)
- Trend text (text override)
- Type (variant property)
```

### Phase 3: Build Real Screens (45 minutes)

#### 1. Home Dashboard Screen
```
Create Frame: iPhone 14 Pro (393x852)

Structure (Auto Layout, vertical, 0px gap):

1. Status Bar (393x44) - Use iOS status bar component
2. Header (393x80):
   - Avatar (48px) + "Good morning, Alex!" (20px)
   - Current date (Body/Small, gray)
   - Notifications icon (24px, right aligned)

3. Balance Section (393x200):
   - Two balance cards (Auto Layout, horizontal, 12px gap)
   - Card 1: "You owe" with negative amount (red accent)
   - Card 2: "You are owed" with positive amount (green accent)

4. Quick Actions (393x60):
   - Auto Layout, horizontal, 12px gap, center aligned
   - "+ Add Expense" button (primary)
   - "Settle Up" button (secondary)

5. Recent Activity (393x remaining):
   - Section header: "Recent Activity" + "View All"
   - List of expense cards (Auto Layout, vertical, 8px gap)
   - Use real data:
     * 🍕 "Chipotle Mexican Grill" - $49.60 - Yesterday
     * ⛽ "Shell Gas Station" - $34.20 - Dec 14
     * 🎬 "AMC Theater" - $67.80 - Dec 13

6. Tab Bar (393x83) - Use standard iOS tab bar
```

#### 2. Add Expense Screen
```
Create Frame: iPhone 14 Pro (393x852)

Navigation:
- Modal header with "Cancel" (left) and "Save" (right)
- Title: "Add Expense" (center)

Content (Auto Layout, vertical, 24px gap):

1. Amount Input (393x120):
   - Large $ symbol (left)
   - Amount field: "0.00" (48px font)
   - Currency selector: "USD" (right)

2. Description (393x60):
   - Label: "Description"
   - Input field with placeholder: "What was this for?"
   - Suggestions chips: "Dinner", "Gas", "Groceries"

3. Category (393x140):
   - Label: "Category"
   - Grid layout (4 columns, 2 rows):
     🍽️ Food    🚗 Transport  🏠 Housing   🛍️ Shopping
     🎬 Movie   💊 Health     ✈️ Travel    📱 Utilities

4. Paid By (393x80):
   - Label: "Paid by"
   - Avatar + name: "You" (selected state)
   - Dropdown arrow

5. Split Between (393x160):
   - Label: "Split between"
   - Member list with checkboxes:
     ✅ You (Alex Thompson)
     ✅ Maria Garcia  
     ✅ John Smith
     ⬜ Sarah Chen

6. Split Type (393x100):
   - Segmented control: "Equal" | "Unequal" | "Percentage"
   - Amount breakdown: "$12.50 each" (when equal)

Bottom Action:
- "Add Expense" button (full width, primary style)
```

#### 3. Group Detail Screen
```
Create Frame: iPhone 14 Pro (393x852)

Header (393x200):
- Group cover photo (use Unsplash for beach/vacation image)
- Overlay with group info:
  * Group name: "Cabo Trip 2024"
  * Member count: "6 members"
  * Total expenses: "$2,847.60"

Balance Summary (393x120):
- Your balance card:
  * "You are owed: $470.60"
  * "From 12 expenses"
  * Green accent color

Member List (393x300):
- Section header: "Members" + "Add Member" link
- Member cards (Auto Layout, vertical, 4px gap):
  
  Alex (You) - Admin 👑
  Balance: +$470.60
  [Request Payment] button
  
  Maria Garcia
  Balance: -$156.40  
  [Settle Up] button (red accent)
  
  John Smith
  Balance: +$89.20
  [Send Reminder] button
  
  Sarah Chen - All settled ✓
  Balance: $0.00
  
  Mike Johnson - Overdue ⚠️
  Balance: -$234.70
  [Urgent] label
  
  Lisa Wang - Pending payment 🟡
  Balance: -$122.90

Recent Expenses (393x remaining):
- Section header: "Recent Expenses" + "View All"
- Expense list with real data:
  
  1. 🍽️ Dinner at Sunset Grill
     Paid by Alex • Split 6 ways
     June 7, 8:30 PM • $234.60
     Your share: $39.10
  
  2. 🚗 Uber to Airport  
     Paid by Maria • 4 people
     June 6, 11:15 AM • $45.80
     Your share: $11.45
  
  3. 🏨 Airbnb Cleaning Fee
     Paid by Mike • Split equally
     June 6, 10:00 AM • $120.00
     Your share: $20.00

Floating Action Button:
- "+" Add Expense (bottom right, primary color)
```

### Phase 4: Create Realistic Content (20 minutes)

#### 1. Using Content Reel Plugin
```
Steps:
1. Select text layer
2. Right-click > Plugins > Content Reel
3. Choose data type:
   - Names: First + Last names
   - Emails: Realistic email addresses  
   - Companies: Real business names
   - Addresses: Real street addresses
4. Click "Fill selected layers"

Example results:
- Alex Thompson, alex.thompson@gmail.com
- Maria Garcia, maria.garcia@yahoo.com
- John Smith, john.smith@outlook.com
- Sarah Chen, sarah.chen@apple.com
```

#### 2. Using Unsplash Plugin
```
Steps:
1. Select image/rectangle
2. Right-click > Plugins > Unsplash
3. Search terms:
   - "group friends" for group photos
   - "restaurant food" for meal categories
   - "user profile" for avatars
   - "vacation beach" for group covers
4. Click image to apply

Use consistent photo style:
- Bright, natural lighting
- People-focused for social features
- High contrast for readability
```

#### 3. Real Financial Data
```
Expense amounts (realistic ranges):
- Coffee/Snacks: $3.50 - $12.99
- Fast food: $8.99 - $24.50
- Restaurants: $45.00 - $120.00
- Gas: $25.00 - $65.00
- Groceries: $35.00 - $150.00
- Entertainment: $15.00 - $80.00
- Travel: $200.00 - $1,500.00

Date patterns:
- Recent: "2 hours ago", "Yesterday", "3 days ago"
- This week: "Monday", "Tuesday", "Wednesday"
- Older: "Dec 15", "Nov 28", "Oct 3"

Merchant names:
- Food: Starbucks, Chipotle, Olive Garden, McDonald's
- Gas: Shell, Chevron, BP, Exxon
- Shopping: Target, Amazon, Walmart, Costco
- Entertainment: AMC, Netflix, Spotify, Steam
```

### Phase 5: Interactive Prototyping (25 minutes)

#### 1. Setting Up Interactions
```
Home to Add Expense:
1. Select "Add Expense" button on Home screen
2. In right panel, click "+" next to Interactions
3. Trigger: On tap
4. Action: Navigate to
5. Destination: Add Expense frame
6. Animation: Slide in from bottom
7. Easing: Ease out
8. Duration: 300ms

Add Expense Flow:
1. Connect each "Continue" button to next step
2. Use "Slide in from right" animation
3. Connect "Back" buttons with "Slide in from left"
4. Final "Add Expense" button goes to success state

Tab Navigation:
1. Select each tab icon
2. Create interaction to respective screen
3. Use "Instant" animation (no transition)
4. Maintain scroll position
```

#### 2. Micro-interactions
```
Button Press States:
1. Select button component
2. Create "Pressed" variant
3. Scale to 96% of original size
4. Add slight shadow increase
5. Set interaction:
   - While pressing: Change to Pressed variant
   - After delay: 100ms, Change back to Default

Card Hover (for web):
1. Create "Hover" variant of expense card
2. Increase shadow elevation
3. Subtle scale to 101%
4. Interaction: On mouse enter/leave

Loading States:
1. Create loading variant with spinner
2. Use "Smart Animate" between variants
3. Spinner rotates continuously (360° rotation)
```

### Phase 6: Accessibility & Testing (15 minutes)

#### 1. Using Stark Plugin
```
Steps:
1. Select all frames
2. Run Stark plugin
3. Check contrast ratios:
   - Text vs background: minimum 4.5:1
   - Large text: minimum 3:1
   - Interactive elements: minimum 3:1
4. Fix any failing combinations

Common fixes:
- Make text darker
- Increase background contrast
- Use accessible color combinations
```

#### 2. Touch Target Verification
```
Minimum sizes:
- Buttons: 44x44px minimum
- Tab icons: 44x44px touch area
- List items: 44px minimum height
- Form inputs: 44px minimum height

Use guides to check:
1. Create 44x44px rectangle
2. Place over interactive elements
3. Ensure full coverage
```

#### 3. Testing Prototype
```
Test scenarios:
1. Complete expense flow start to finish
2. Navigate between all tabs
3. Try settlement process
4. Test error states
5. Verify back navigation works
6. Check modal dismissal

Share prototype:
1. Click "Share" in top right
2. Copy link with "Anyone with link can view"
3. Test on mobile device
4. Get feedback from stakeholders
```

## 🎨 Final Result Preview

After following this tutorial, you'll have:

✅ **Real visual mockups** instead of ASCII boxes
✅ **Interactive prototype** with smooth animations  
✅ **Consistent design system** with reusable components
✅ **Realistic content** using real names, photos, and data
✅ **Accessible design** meeting contrast and touch requirements
✅ **Professional presentation** ready for stakeholder review

The key difference is that instead of seeing placeholder boxes, you'll have actual UI that looks like a real app with real content, making it much easier to visualize and validate the user experience.
