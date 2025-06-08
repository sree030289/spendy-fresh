# Spendy Fresh Design System Tokens

## 🎨 Design Tokens (JSON Format for Figma Import)

```json
{
  "colors": {
    "primary": {
      "50": "#EEF2FF",
      "100": "#E0E7FF", 
      "200": "#C7D2FE",
      "300": "#A5B4FC",
      "400": "#818CF8",
      "500": "#6366F1",
      "600": "#4F46E5",
      "700": "#4338CA",
      "800": "#3730A3",
      "900": "#312E81"
    },
    "success": {
      "50": "#ECFDF5",
      "100": "#D1FAE5",
      "200": "#A7F3D0", 
      "300": "#6EE7B7",
      "400": "#34D399",
      "500": "#10B981",
      "600": "#059669",
      "700": "#047857",
      "800": "#065F46",
      "900": "#064E3B"
    },
    "warning": {
      "50": "#FFFBEB",
      "100": "#FEF3C7",
      "200": "#FDE68A",
      "300": "#FCD34D", 
      "400": "#FBBF24",
      "500": "#F59E0B",
      "600": "#D97706",
      "700": "#B45309",
      "800": "#92400E",
      "900": "#78350F"
    },
    "error": {
      "50": "#FEF2F2",
      "100": "#FEE2E2",
      "200": "#FECACA",
      "300": "#FCA5A5",
      "400": "#F87171", 
      "500": "#EF4444",
      "600": "#DC2626",
      "700": "#B91C1C",
      "800": "#991B1B",
      "900": "#7F1D1D"
    },
    "neutral": {
      "0": "#FFFFFF",
      "50": "#F9FAFB",
      "100": "#F3F4F6",
      "200": "#E5E7EB",
      "300": "#D1D5DB",
      "400": "#9CA3AF",
      "500": "#6B7280", 
      "600": "#4B5563",
      "700": "#374151",
      "800": "#1F2937",
      "900": "#111827",
      "950": "#030712"
    }
  },
  "typography": {
    "fontFamily": {
      "primary": "SF Pro Display",
      "secondary": "SF Pro Text",
      "mono": "SF Mono"
    },
    "fontSize": {
      "xs": "12px",
      "sm": "14px", 
      "base": "16px",
      "lg": "18px",
      "xl": "20px",
      "2xl": "24px",
      "3xl": "30px",
      "4xl": "36px",
      "5xl": "48px"
    },
    "fontWeight": {
      "light": 300,
      "regular": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700,
      "heavy": 800
    },
    "lineHeight": {
      "tight": 1.2,
      "normal": 1.5,
      "relaxed": 1.75
    }
  },
  "spacing": {
    "0": "0px",
    "1": "4px",
    "2": "8px", 
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
    "20": "80px"
  },
  "borderRadius": {
    "none": "0px",
    "sm": "4px",
    "md": "8px",
    "lg": "12px", 
    "xl": "16px",
    "2xl": "24px",
    "full": "50%"
  },
  "shadows": {
    "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
  }
}
```

## 🧩 Component Specifications

### Base Button Component
```
Master Component Properties:

Auto Layout:
- Direction: Horizontal
- Alignment: Center
- Padding: 12px 24px
- Gap: 8px

Variants:
- Size: Small (32px), Medium (40px), Large (48px)
- Type: Primary, Secondary, Destructive, Ghost
- State: Default, Hover, Pressed, Disabled, Loading

Primary Button:
- Background: Primary-500 (#6366F1)
- Text: White, Medium weight
- Border: None
- Shadow: shadows.md

Secondary Button:
- Background: Transparent
- Text: Primary-600, Medium weight  
- Border: 1px Primary-300
- Shadow: None

Destructive Button:
- Background: Error-500 (#EF4444)
- Text: White, Medium weight
- Border: None
- Shadow: shadows.md

States:
- Hover: Darken background by 10%
- Pressed: Scale 96%, darken 15%
- Disabled: 50% opacity
- Loading: Show spinner, disable interaction
```

### Expense Card Component
```
Master Component (343x80):

Frame Properties:
- Fill: White
- Border: 1px Neutral-200
- Border Radius: 12px
- Shadow: shadows.sm
- Auto Layout: Horizontal, 16px padding

Content Structure:
1. Icon Container (40x40):
   - Background: Category color (light shade)
   - Icon: 24x24 emoji or icon
   - Border Radius: 8px

2. Content Area (Auto Layout, Vertical):
   - Title: fontSize.lg, fontWeight.medium, Neutral-900
   - Subtitle: fontSize.sm, fontWeight.regular, Neutral-500
   - Date: fontSize.xs, fontWeight.regular, Neutral-400

3. Amount Section (Auto Layout, Vertical, Right aligned):
   - Main Amount: fontSize.lg, fontWeight.semibold, Neutral-900
   - Your Share: fontSize.sm, fontWeight.regular, Neutral-600
   - Status: fontSize.xs, colored badge

Variants:
- Status: Settled (Success-500), Pending (Warning-500), Overdue (Error-500)
- Type: Expense, Payment, Settlement
- Interaction: Default, Pressed, Loading

Interactions:
- Tap: Navigate to expense detail
- Long press: Show action menu
- Swipe left: Quick actions (settle/delete)
```

### Balance Display Component
```
Master Component (343x120):

Frame Properties:
- Fill: Gradient based on balance type
- Border Radius: 16px
- Shadow: shadows.lg
- Auto Layout: Vertical, 20px padding

Content Structure:
1. Header (Auto Layout, Horizontal):
   - Label: fontSize.base, fontWeight.medium, White/80%
   - Trend Icon: 16x16, Success/Error color

2. Amount (Center aligned):
   - Currency: fontSize.lg, fontWeight.regular, White/90%
   - Amount: fontSize.4xl, fontWeight.bold, White
   - Decimal: fontSize.2xl, fontWeight.medium, White/90%

3. Trend Text:
   - Text: fontSize.sm, fontWeight.regular, White/80%
   - Change amount: fontSize.sm, fontWeight.medium, Success/Error

4. Actions (Auto Layout, Horizontal, 12px gap):
   - Primary button (smaller size)
   - Secondary button (smaller size)

Gradients:
- Positive: Success-400 to Success-600
- Negative: Error-400 to Error-600
- Zero: Neutral-400 to Neutral-600

Component Properties:
- Balance Type: Positive, Negative, Zero
- Amount: Text override
- Trend: Text override
- Show Actions: Boolean
```

### User Avatar Component
```
Master Component (40x40):

Base Frame:
- Shape: Circle (40x40)
- Fill: Image or initials background
- Border: 2px White
- Shadow: shadows.sm

Variants:
- Size: XS (24px), S (32px), M (40px), L (56px), XL (80px)
- Type: Photo, Initials, Icon, Placeholder
- Status: None, Online (green dot), Away (yellow dot), Offline (gray dot)

Photo Type:
- Fill: User image (use image fill)
- Fit: Cover, center crop

Initials Type:
- Background: Primary-100
- Text: Primary-800, fontWeight.semibold
- Size: 40% of container

Status Indicator:
- Size: 25% of container (positioned bottom-right)
- Border: 2px White
- Colors: Success-500 (online), Warning-500 (away), Neutral-400 (offline)

Component Properties:
- User Name: Text override (for initials)
- Photo URL: Image override
- Status: Variant property
- Size: Variant property
```

### Input Field Component
```
Master Component (343x56):

Frame Properties:
- Fill: White
- Border: 1px Neutral-300
- Border Radius: 8px
- Auto Layout: Horizontal, 16px padding

Content Structure:
1. Leading Icon (Optional):
   - Size: 20x20
   - Color: Neutral-400

2. Input Content (Auto Layout, Vertical):
   - Label: fontSize.xs, fontWeight.medium, Neutral-600
   - Input Text: fontSize.base, fontWeight.regular, Neutral-900
   - Placeholder: fontSize.base, fontWeight.regular, Neutral-400

3. Trailing Element (Optional):
   - Icon, Button, or Text
   - Size: 20x20 for icons

States:
- Default: Border Neutral-300
- Focus: Border Primary-500, Shadow Primary-100
- Error: Border Error-500, Helper text Error-600
- Disabled: Background Neutral-50, Text Neutral-400

Variants:
- Type: Text, Email, Number, Password, Search
- State: Default, Focus, Error, Disabled
- Size: Small (48px), Medium (56px), Large (64px)

Component Properties:
- Label Text: Text override
- Placeholder: Text override
- Helper Text: Text override
- Show Label: Boolean
- Leading Icon: Icon override
- Trailing Element: Component override
```

## 📱 Screen Templates

### Mobile Screen Template (iPhone 14 Pro - 393x852)
```
Frame Structure:
1. Status Bar (393x44)
   - Background: Transparent or app color
   - Content: iOS status elements

2. Navigation Header (393x60)
   - Background: White
   - Border Bottom: 1px Neutral-200
   - Content: Back button, Title, Action button

3. Content Area (393x665)
   - Background: Neutral-50
   - Padding: 16px sides
   - Scroll behavior: Vertical

4. Tab Bar (393x83)
   - Background: White
   - Border Top: 1px Neutral-200
   - Safe Area: 34px bottom padding

Auto Layout Configuration:
- Direction: Vertical
- Alignment: Fill container
- Spacing: 0px
- Resizing: Fixed width, Hug height
```

### Modal Template (343x Variable)
```
Frame Structure:
1. Handle (36x4)
   - Background: Neutral-300
   - Border Radius: 2px
   - Margin: 12px top, 16px bottom

2. Header (Optional - 343x60)
   - Title: fontSize.xl, fontWeight.semibold
   - Close button: 32x32, top-right

3. Content Area (343xVariable)
   - Padding: 0px 24px
   - Auto Layout: Vertical
   - Gap: 16px

4. Action Area (343x80)
   - Padding: 24px
   - Button: Full width
   - Safe area: 34px bottom

Background:
- Corner Radius: 16px top corners
- Fill: White
- Shadow: shadows.2xl

Animation:
- Entry: Slide up from bottom (300ms, ease-out)
- Exit: Slide down to bottom (250ms, ease-in)
```

## 🎨 Icon Library

### Navigation Icons (24x24)
```
Required Icons:
- Home: house, house.fill
- Groups: person.3, person.3.fill
- Friends: person.2, person.2.fill  
- Expenses: doc.text, doc.text.fill
- Profile: person.circle, person.circle.fill

Tab States:
- Inactive: Outline version, Neutral-400
- Active: Filled version, Primary-600
- Badge: Red dot with count (top-right)
```

### Category Icons (24x24)
```
Food & Dining:
- 🍽️ General dining
- 🍕 Fast food
- ☕ Coffee & drinks
- 🍺 Bars & nightlife

Transportation:
- 🚗 Car & taxi
- ⛽ Gas & fuel
- 🚇 Public transit
- ✈️ Flights

Entertainment:
- 🎬 Movies & shows
- 🎮 Gaming
- 🎵 Music & concerts
- 🏃 Sports & fitness

Shopping:
- 🛍️ General shopping
- 👕 Clothing
- 📱 Electronics
- 🏠 Home & garden

Travel & Lodging:
- 🏨 Hotels
- 🗺️ Travel & vacation
- 🚁 Tours & experiences

Other:
- 💊 Healthcare
- 📚 Education
- 💰 Financial
- 🔧 Services
```

### Action Icons (20x20)
```
Primary Actions:
- plus: Add new item
- minus: Remove item
- pencil: Edit
- trash: Delete
- arrow.right: Navigate forward
- arrow.left: Navigate back
- checkmark: Confirm/Complete
- xmark: Cancel/Close

Secondary Actions:
- ellipsis: More options
- share: Share content
- bell: Notifications
- magnifyingglass: Search
- filter: Filter results
- sort: Sort options
- refresh: Reload content
- gear: Settings
```

### Status Icons (16x16)
```
Payment Status:
- checkmark.circle.fill (Success-500): Paid/Settled
- clock.fill (Warning-500): Pending
- exclamationmark.triangle.fill (Error-500): Overdue
- xmark.circle.fill (Error-600): Failed

Connection Status:
- circle.fill (Success-500): Online
- circle.fill (Warning-500): Away  
- circle.fill (Neutral-400): Offline
- wifi.slash (Error-500): No connection

General Status:
- star.fill: Favorite/Featured
- lock.fill: Private/Secure
- eye: Visible
- eye.slash: Hidden
```

## 🔧 Implementation Guidelines

### Figma Setup Steps
1. Import design tokens using Figma Tokens plugin
2. Create color styles for all color values
3. Create text styles for typography combinations
4. Create effect styles for shadows
5. Build components using auto layout
6. Set up component properties and variants
7. Create instance swap properties for icons
8. Document component usage in descriptions

### Component Organization
```
📁 Design System
├── 🎨 Foundation
│   ├── Colors
│   ├── Typography  
│   ├── Spacing
│   ├── Shadows
│   └── Icons
├── 🧩 Components
│   ├── Buttons
│   ├── Inputs
│   ├── Cards
│   ├── Navigation
│   └── Feedback
└── 📱 Templates
    ├── Screens
    ├── Modals
    └── Overlays
```

This design system provides everything needed to create consistent, professional UI mockups with real visual content instead of placeholder boxes.
