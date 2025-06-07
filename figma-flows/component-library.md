# Figma Component Library for Splitting Features

## 🎨 Design System Components

### 1. **Base Components**

#### Color Palette
```css
Primary Colors:
- Primary Blue: #007AFF
- Primary Dark: #0051D0
- Primary Light: #B3D9FF

Secondary Colors:
- Success Green: #34C759
- Warning Orange: #FF9500
- Error Red: #FF3B30
- Info Blue: #5AC8FA

Neutral Colors:
- Black: #000000
- Dark Gray: #1C1C1E
- Medium Gray: #8E8E93
- Light Gray: #F2F2F7
- White: #FFFFFF

Semantic Colors:
- Expense Red: #FF6B6B
- Income Green: #51CF66
- Balance Blue: #339AF0
- Pending Yellow: #FFD43B
```

#### Typography Scale
```css
Headers:
- H1: 32px, Bold, Line Height: 40px
- H2: 24px, Bold, Line Height: 32px
- H3: 20px, Semibold, Line Height: 28px
- H4: 18px, Semibold, Line Height: 24px

Body Text:
- Large: 18px, Regular, Line Height: 24px
- Medium: 16px, Regular, Line Height: 22px
- Small: 14px, Regular, Line Height: 20px
- Caption: 12px, Regular, Line Height: 16px

Interactive:
- Button Large: 18px, Semibold
- Button Medium: 16px, Semibold
- Button Small: 14px, Semibold
- Link: 16px, Medium, Underlined
```

### 2. **Card Components**

#### Expense Card Component
```
Properties:
- Size: Large (80px), Medium (64px), Small (48px)
- Status: Paid, Pending, Overdue
- Type: Personal, Group, Recurring

Structure:
┌────────────────────────────────┐
│ 💰 Icon    Title         $50.00│
│           Subtitle      👤👤👤│
│           Date          Status │
└────────────────────────────────┘

Variants:
- With/Without split indicators
- With/Without category icons
- Settled/Unsettled states
- Your expense/Others expense
```

#### Balance Card Component
```
Properties:
- Type: Positive, Negative, Zero
- Size: Large, Medium, Compact
- Interactive: Yes/No

Structure:
┌────────────────────────────────┐
│         You are owed           │
│         $125.50                │
│    ↑ +$25 from last week      │
│    [Settle Up] [Request]       │
└────────────────────────────────┘

States:
- Loading (skeleton)
- Error (retry button)
- Empty (illustration)
- Success (animated counter)
```

#### Friend Card Component
```
Properties:
- Status: Friend, Pending, Blocked
- Balance: Positive, Negative, Zero
- Online: Yes/No

Structure:
┌────────────────────────────────┐
│ 👤  John Doe        🟢 Online │
│     john@email.com    +$45.50 │
│     [Message] [Settle] [Pay]   │
└────────────────────────────────┘

Interaction States:
- Default
- Pressed
- Loading
- Disabled
```

### 3. **Input Components**

#### Amount Input Component
```
Properties:
- Currency: USD, EUR, GBP, etc.
- Size: Large, Medium, Small
- State: Default, Focus, Error, Disabled

Structure:
┌────────────────────────────────┐
│ Amount                         │
│ $ [     0.00     ]            │
│   Helper text or error         │
└────────────────────────────────┘

Features:
- Auto-formatting
- Currency symbol
- Decimal handling
- Large tap targets
```

#### Split Selector Component
```
Properties:
- Type: Equal, Unequal, Percentage, Shares
- Members: Array of user objects
- Editable: Yes/No

Equal Split:
┌────────────────────────────────┐
│ Split Equally                  │
│ ○ Equal  ● Unequal  ○ %       │
│                                │
│ 👤 You      $16.67            │
│ 👤 John     $16.67            │
│ 👤 Jane     $16.67            │
│                                │
│ Total: $50.00 ✓               │
└────────────────────────────────┘

Unequal Split:
┌────────────────────────────────┐
│ Split by Amount                │
│ ○ Equal  ● Unequal  ○ %       │
│                                │
│ 👤 You      $[20.00]          │
│ 👤 John     $[15.00]          │
│ 👤 Jane     $[15.00]          │
│                                │
│ Total: $50.00 ✓               │
└────────────────────────────────┘
```

### 4. **Action Components**

#### Primary Button Component
```
Properties:
- Size: Large (48px), Medium (40px), Small (32px)
- State: Default, Pressed, Loading, Disabled
- Type: Primary, Secondary, Destructive, Ghost

Large Primary:
┌────────────────────────────────┐
│          Add Expense           │
└────────────────────────────────┘

With Loading:
┌────────────────────────────────┐
│    ⟳   Processing...          │
└────────────────────────────────┘

Icon Button:
┌─────┐
│  +  │ (FAB style)
└─────┘
```

#### Action Sheet Component
```
Structure:
┌────────────────────────────────┐
│ ━━━━━━━━━━━━━━                 │ Handle
│                                │
│ Choose Action                  │ Title
│                                │
│ 📊 View Details               │ Action 1
│ ✏️  Edit Expense              │ Action 2  
│ 🗑️ Delete Expense             │ Action 3
│                                │
│ Cancel                         │ Cancel
└────────────────────────────────┘

Properties:
- Actions: Array of action objects
- Destructive: Index of destructive action
- Title: Optional header text
```

### 5. **Navigation Components**

#### Tab Bar Component
```
Structure:
┌────────────────────────────────┐
│ 🏠   👥   👤   💰   👤        │
│Home Groups Friends Exp Profile│
└────────────────────────────────┘

Properties:
- Active tab index
- Badge counts for notifications
- Icon states (active/inactive)

States:
- Default icons (outline)
- Active icons (filled)
- With badges (red dot with count)
```

#### Header Component
```
Properties:
- Type: Default, Modal, Search, Profile
- Left Action: Back, Cancel, Menu
- Right Action: Done, Save, More, Profile
- Title: String or custom component

Modal Header:
┌────────────────────────────────┐
│ ✕  Add New Expense      Save  │
└────────────────────────────────┘

Search Header:
┌────────────────────────────────┐
│ ← [    Search friends...    ] │
└────────────────────────────────┘
```

### 6. **Status Components**

#### Payment Status Indicator
```
Properties:
- Status: Paid, Pending, Overdue, Failed
- Size: Large, Medium, Small
- Style: Badge, Chip, Inline

Badge Style:
┌─────────┐
│ ✓ Paid  │ (Green background)
└─────────┘

┌─────────┐
│ ⏱ Pending│ (Yellow background)
└─────────┘

┌─────────┐
│ ⚠ Overdue│ (Red background)
└─────────┘

Chip Style:
• Paid    ○ Pending    ⚠ Overdue
```

#### Balance Indicator Component
```
Properties:
- Amount: Number
- Type: Positive, Negative, Zero
- Size: Large, Medium, Small
- Animated: Yes/No

Large Positive:
┌─────────────┐
│   +$125.50  │ (Green text)
│  You are owed│
└─────────────┘

Large Negative:
┌─────────────┐
│   -$45.50   │ (Red text)
│   You owe    │
└─────────────┘

Zero Balance:
┌─────────────┐
│    $0.00    │ (Gray text)
│  All settled │
└─────────────┘
```

### 7. **List Components**

#### Transaction List Item
```
Properties:
- Type: Expense, Payment, Settlement
- Status: Recent, Old, Highlighted
- Interactive: Yes/No

Structure:
┌────────────────────────────────┐
│ 🍕  Dinner at Tony's      →   │
│     Split with 3 people        │
│     Dec 15, 2024    Your share:│
│                        $16.67  │
└────────────────────────────────┘

Payment Item:
┌────────────────────────────────┐
│ 💳  Payment to John       →   │
│     Via Venmo                  │
│     Dec 14, 2024         $45.50│
└────────────────────────────────┘
```

#### Group Member List Item
```
Properties:
- Role: Admin, Member
- Status: Active, Pending, Offline
- Balance: Positive, Negative, Zero
- Actions: Available action array

Structure:
┌────────────────────────────────┐
│ 👤  John Doe         👑 Admin │
│     john@email.com      +$25.50│
│     Last seen 2 hours ago  ⋯   │
└────────────────────────────────┘

Pending Member:
┌────────────────────────────────┐
│ 📧  jane@email.com     Pending │
│     Invitation sent             │
│     2 days ago            ⋯     │
└────────────────────────────────┘
```

### 8. **Modal Components**

#### Confirmation Modal
```
Properties:
- Title: String
- Message: String
- Primary Action: String and handler
- Secondary Action: String and handler
- Type: Default, Warning, Destructive

Structure:
┌────────────────────────────────┐
│           Delete Expense       │
│                                │
│ Are you sure you want to delete│
│ this expense? This will reverse│
│ all balance calculations.      │
│                                │
│  [Cancel]    [Delete Expense]  │
└────────────────────────────────┘
```

#### Loading Modal
```
Structure:
┌────────────────────────────────┐
│              ⟳                │
│                                │
│      Processing payment...     │
│                                │
│    Please don't close app      │
└────────────────────────────────┘

Properties:
- Message: String
- Cancellable: Boolean
- Progress: Indeterminate or percentage
```

### 9. **Empty State Components**

#### No Expenses State
```
Structure:
┌────────────────────────────────┐
│                                │
│         💸                     │
│    No expenses yet             │
│                                │
│ Start by adding your first     │
│ shared expense with friends    │
│                                │
│      [Add Expense]             │
│                                │
└────────────────────────────────┘
```

#### No Friends State
```
Structure:
┌────────────────────────────────┐
│                                │
│         👥                     │
│    No friends added yet        │
│                                │
│ Add friends to start splitting │
│ expenses and managing money    │
│ together                       │
│                                │
│      [Add Friends]             │
│                                │
└────────────────────────────────┘
```

## 🔧 Component Usage Guidelines

### Implementation Notes
```
1. All components should have proper states:
   - Default
   - Hover (web)
   - Pressed
   - Focused
   - Disabled
   - Loading
   - Error

2. Accessibility requirements:
   - Proper contrast ratios
   - Touch target sizes (44px minimum)
   - Screen reader labels
   - Keyboard navigation support

3. Animation guidelines:
   - Use spring animations for interactive elements
   - Duration: 200-300ms for micro-interactions
   - Easing: ease-out for entrances, ease-in for exits
   - Loading states should have continuous animations

4. Responsive behavior:
   - Components adapt to different screen sizes
   - Text scales appropriately
   - Touch targets remain accessible
   - Content reflows gracefully
```

### Design Tokens
```json
{
  "spacing": {
    "xs": "4px",
    "sm": "8px", 
    "md": "16px",
    "lg": "24px",
    "xl": "32px",
    "xxl": "48px"
  },
  "borderRadius": {
    "sm": "4px",
    "md": "8px", 
    "lg": "12px",
    "xl": "16px",
    "round": "50%"
  },
  "shadows": {
    "sm": "0 1px 2px rgba(0,0,0,0.1)",
    "md": "0 2px 8px rgba(0,0,0,0.15)",
    "lg": "0 4px 16px rgba(0,0,0,0.2)"
  }
}
```

This component library provides a comprehensive foundation for creating consistent, accessible, and beautiful splitting flow interfaces in Figma.
