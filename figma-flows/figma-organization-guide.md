# Figma Workspace Organization Guide

## 📁 File Structure

### Main Figma File: "Spendy Fresh - Complete App"

```
📁 Spendy Fresh Design System
├── 🎨 Design Tokens
│   ├── Colors & Gradients
│   ├── Typography Styles
│   ├── Spacing & Layout
│   ├── Border Radius & Shadows
│   └── Animation Specs
│
├── 🧩 Component Library
│   ├── 📱 Base Components
│   │   ├── Buttons (Primary, Secondary, Ghost, etc.)
│   │   ├── Input Fields (Text, Number, Email, etc.)
│   │   ├── Cards (Base, Elevated, Outlined)
│   │   └── Indicators (Loading, Status, Badge)
│   │
│   ├── 💰 Splitting Components
│   │   ├── Expense Cards
│   │   ├── Balance Displays
│   │   ├── Split Configurators
│   │   ├── Payment Forms
│   │   └── Settlement Cards
│   │
│   ├── 👥 Social Components
│   │   ├── User Avatars
│   │   ├── Friend Cards
│   │   ├── Group Cards
│   │   └── Member Lists
│   │
│   └── 🔔 Feedback Components
│       ├── Modals & Dialogs
│       ├── Toast Notifications
│       ├── Empty States
│       └── Error States
│
├── 📱 Screen Templates
│   ├── 🏠 Core Screens
│   │   ├── Home Dashboard
│   │   ├── Groups List
│   │   ├── Friends List
│   │   └── Profile Screen
│   │
│   ├── 💸 Expense Screens
│   │   ├── Add Expense
│   │   ├── Expense Detail
│   │   ├── Split Configuration
│   │   └── Expense History
│   │
│   ├── 💰 Payment Screens
│   │   ├── Settlement Flow
│   │   ├── Payment Request
│   │   ├── Payment Methods
│   │   └── Transaction History
│   │
│   └── 👥 Social Screens
│       ├── Group Detail
│       ├── Group Settings
│       ├── Add Friends
│       └── Friend Profile
│
└── 🔄 User Flows
    ├── 📊 Flow Diagrams
    │   ├── Complete User Journey
    │   ├── Expense Flow
    │   ├── Settlement Flow
    │   └── Group Management Flow
    │
    ├── 📱 Interactive Prototypes
    │   ├── Main App Flow
    │   ├── Onboarding Flow
    │   ├── Expense Creation Flow
    │   └── Settlement Flow
    │
    └── 🎯 User Scenarios
        ├── New User Journey
        ├── Daily Usage Patterns
        ├── Group Activities
        └── Settlement Scenarios
```

## 🎨 Page Organization

### Page 1: Design System
```
Frame Layout (1920x1080):
┌─────────────────────────────────────┐
│ 🎨 SPENDY FRESH DESIGN SYSTEM      │
├─────────────────────────────────────┤
│                                     │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │Color│ │Type │ │Space│ │Icons│    │
│ │Styles│ │Scale│ │Grid │ │Set │    │
│ └─────┘ └─────┘ └─────┘ └─────┘    │
│                                     │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │Btns │ │Cards│ │Forms│ │Modal│    │
│ │Kit  │ │Kit  │ │Kit  │ │Kit │    │
│ └─────┘ └─────┘ └─────┘ └─────┘    │
│                                     │
└─────────────────────────────────────┘
```

### Page 2: Mobile Screens
```
Frame Layout (iPhone 14 Pro - 393x852):
┌─────────────────────────────────────┐
│ 📱 MOBILE SCREENS                   │
├─────────────────────────────────────┤
│                                     │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐    │
│ │Hme│ │Grp│ │Frd│ │Exp│ │Pro│    │
│ │   │ │   │ │   │ │   │ │   │    │
│ │   │ │   │ │   │ │   │ │   │    │
│ └───┘ └───┘ └───┘ └───┘ └───┘    │
│                                     │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐    │
│ │Add│ │Spl│ │Set│ │Pay│ │Det│    │
│ │Exp│ │it │ │tle│ │Req│ │ail│    │
│ │   │ │   │ │   │ │   │ │   │    │
│ └───┘ └───┘ └───┘ └───┘ └───┘    │
│                                     │
└─────────────────────────────────────┘
```

### Page 3: User Flows
```
Frame Layout (Landscape - 1440x900):
┌─────────────────────────────────────┐
│ 🔄 USER FLOWS & PROTOTYPES         │
├─────────────────────────────────────┤
│                                     │
│ Main User Journey:                  │
│ [Login] → [Home] → [Add Exp] → [✓]  │
│                                     │
│ Expense Flow:                       │
│ [Group] → [+] → [Amount] → [Split]  │
│ → [Review] → [Confirm] → [Success]  │
│                                     │
│ Settlement Flow:                    │
│ [Balance] → [Settle] → [Amount]     │
│ → [Method] → [Confirm] → [Done]     │
│                                     │
└─────────────────────────────────────┘
```

## 🎯 Naming Conventions

### Component Naming
```
Format: [Category]/[Component]/[Variant]

Examples:
- Button/Primary/Large
- Button/Primary/Medium
- Button/Secondary/Large
- Card/Expense/Default
- Card/Expense/Settled
- Input/Amount/Default
- Input/Amount/Error
- Avatar/User/Small
- Avatar/User/Medium
- Avatar/User/Large
```

### Screen Naming
```
Format: [Section]/[Screen]/[State]

Examples:
- Home/Dashboard/Default
- Home/Dashboard/Loading
- Groups/List/Default
- Groups/List/Empty
- Groups/Detail/Default
- Expense/Add/Step1-Amount
- Expense/Add/Step2-Split
- Expense/Add/Step3-Review
- Payment/Settlement/Form
- Payment/Settlement/Success
```

### Layer Naming
```
Format: [Element Type]/[Description]

Examples:
- Background/Primary
- Header/Navigation
- Content/Expense List
- Button/Add Expense
- Text/Amount Display
- Icon/Category
- Image/User Avatar
```

## 🔗 Prototyping Setup

### Main Navigation Prototype
```
Connections:
┌─────────────┐    ┌─────────────┐
│ Home Tab    │ ←→ │ Groups Tab  │
└─────────────┘    └─────────────┘
       ↕                  ↕
┌─────────────┐    ┌─────────────┐
│ Profile Tab │ ←→ │ Friends Tab │
└─────────────┘    └─────────────┘

Interactions:
- Tab Tap: Switch to target screen
- Transition: Instant (no animation)
- Maintain scroll position on return
```

### Add Expense Flow Prototype
```
Flow Steps:
1. Group Screen → FAB Tap → Add Expense Modal
2. Amount Entry → Continue → Split Configuration
3. Split Config → Continue → Review Screen
4. Review → Confirm → Success Modal
5. Success → Done → Back to Group (updated)

Interactions:
- Modal Entry: Slide up from bottom
- Step Progression: Slide left to right
- Back Navigation: Slide right to left
- Success: Fade in with checkmark animation
- Exit: Slide down to bottom
```

### Settlement Flow Prototype
```
Flow Steps:
1. Balance Card → Settle Button → Settlement Form
2. Amount/Method → Continue → Confirmation
3. Confirm → Process → Success Animation
4. Success → Done → Updated Balance View

Interactions:
- Form Entry: Push from right
- Processing: Loading spinner overlay
- Success: Checkmark with bounce
- Balance Update: Number counter animation
```

## 🎨 Animation Specifications

### Micro-interactions
```
Button Press:
- Scale: 0.95 on press
- Duration: 100ms
- Easing: ease-out

Card Tap:
- Scale: 0.98 on press
- Shadow: Increase on press
- Duration: 150ms

Modal Transitions:
- Entry: Slide up with spring
- Exit: Slide down with ease-in
- Duration: 300ms
- Background: Fade to 80% black

Loading States:
- Skeleton: Shimmer animation
- Spinner: Continuous rotation
- Progress: Smooth fill animation
```

### Page Transitions
```
Tab Switch:
- Type: Instant
- Preserve: Scroll position
- No animation (platform standard)

Modal Presentation:
- Type: Slide up from bottom
- Duration: 300ms
- Easing: spring(0.8, 0.9)
- Background: Fade overlay

Navigation Push:
- Type: Slide from right
- Duration: 250ms
- Easing: ease-out
- Shadow: Card elevation

Flow Steps:
- Type: Slide horizontal
- Duration: 200ms
- Easing: ease-in-out
```

## 📋 Design Review Checklist

### Before Review
```
✅ All screens have consistent spacing
✅ Typography follows style guide
✅ Colors match design tokens
✅ Components are properly detached/linked
✅ Prototypes work on all flows
✅ Accessibility requirements met
✅ States covered (empty, loading, error)
✅ Responsive behavior defined
✅ Animation specs documented
✅ Icon consistency checked
```

### Review Areas
```
🎨 Visual Design:
- Color usage and contrast
- Typography hierarchy
- Spacing consistency
- Component alignment

🔄 User Experience:
- Flow logic and progression
- Navigation clarity
- Error handling
- Success feedback

📱 Usability:
- Touch target sizes
- Reachability on mobile
- Information hierarchy
- Cognitive load

⚡ Performance:
- Loading states
- Offline scenarios
- Error recovery
- Animation smoothness
```

## 🚀 Handoff Preparation

### Developer Assets
```
Export Settings:
- PNG: 1x, 2x, 3x for iOS
- SVG: Icons and illustrations
- PDF: Vector assets
- JSON: Animation specs (Lottie)

Naming Convention:
- iOS: icon_name@2x.png
- Android: ic_name.xml
- Web: icon-name.svg

Organization:
📁 Assets Export
├── 📱 iOS
│   ├── icons/
│   ├── images/
│   └── animations/
├── 🤖 Android
│   ├── drawable/
│   ├── mipmap/
│   └── animations/
└── 🌐 Web
    ├── icons/
    ├── images/
    └── animations/
```

### Specification Document
```
Include:
1. Design token values
2. Component specifications
3. Animation parameters
4. Interaction patterns
5. Responsive breakpoints
6. Accessibility requirements
7. Error state handling
8. Loading state specs
9. Empty state copy
10. Success message copy
```

This organization guide will help you create a well-structured, maintainable Figma workspace that effectively communicates your splitting flow designs to developers and stakeholders.
