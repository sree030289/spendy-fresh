#!/bin/bash

# Script to add StoreKit configuration to Xcode project
# This helps resolve RevenueCat issues in development mode

echo "🛠️  Adding StoreKit Configuration to Xcode Project..."

STOREKIT_FILE="ios/SpendyStoreKit.storekit"
XCODEPROJ="ios/MeetNSplitDev.xcodeproj"

if [ ! -f "$STOREKIT_FILE" ]; then
    echo "❌ StoreKit file not found: $STOREKIT_FILE"
    exit 1
fi

if [ ! -d "$XCODEPROJ" ]; then
    echo "❌ Xcode project not found: $XCODEPROJ"
    exit 1
fi

echo "✅ StoreKit file created: $STOREKIT_FILE"
echo "📋 Manual steps required in Xcode:"
echo ""
echo "1. Open project: $XCODEPROJ"
echo "2. Right-click project in navigator → 'Add Files to MeetNSplitDev'"
echo "3. Select: $STOREKIT_FILE"
echo "4. Check 'Add to target' for your app"
echo "5. Click 'Add'"
echo ""
echo "🔧 Configure Scheme:"
echo "1. Product → Scheme → Edit Scheme..."
echo "2. Select 'Run' → 'Options' tab"
echo "3. Under 'StoreKit Configuration' → Select 'SpendyStoreKit.storekit'"
echo "4. Click 'Close'"
echo ""
echo "🚀 Ready! Your app will now use StoreKit for testing in development."
echo ""
echo "📋 Product IDs configured:"
echo "   • Monthly: com.svaag.meetnsplit.dev.Monthly"
echo "   • Yearly:  com.svaag.meetnsplit.dev.Annual"
echo ""
echo "💡 See STOREKIT_SETUP.md for detailed instructions."
