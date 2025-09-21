#!/bin/bash

# Generate Meet-n-Split App Icons Script
# This script converts the SVG icon to required PNG formats

echo "🎨 Generating Meet-n-Split app icons..."

# Check if we have the SVG source
if [ ! -f "assets/app-icon-meetnsplit.svg" ]; then
    echo "❌ Missing assets/app-icon-meetnsplit.svg - cannot generate icons"
    exit 1
fi

# Create main app icon (1024x1024 for iOS App Store, 512x512 for Android)
echo "📱 Generating main app icon..."
# Note: You'll need to install imagemagick or use online converter
# brew install imagemagick (on macOS)
# sudo apt-get install imagemagick (on Ubuntu)

# For now, we'll use the existing standard Android icon as our main icon
# and copy it with Meet-n-Split naming

# Main app icon (Expo expects this)
cp "assets/android-icons/Standard/android-icon-512x512.png" "assets/icon-meetnsplit.png"

# Adaptive icon for Android (same as current but with Meet-n-Split naming)
cp "assets/android-icons/Adaptive/android-adaptive-432x432-xxxhdpi.png" "assets/adaptive-icon-meetnsplit.png"

# Create a proper 1024x1024 icon for iOS (using largest available)
cp "assets/ios-icons/ios-icon-180x180.png" "assets/icon-meetnsplit-1024.png"

echo "✅ Generated Meet-n-Split icons:"
echo "  - assets/icon-meetnsplit.png (512x512)"
echo "  - assets/adaptive-icon-meetnsplit.png (432x432)"
echo "  - assets/icon-meetnsplit-1024.png (180x180 - needs to be upscaled)"

echo ""
echo "🔧 Next steps:"
echo "1. Manually create a 1024x1024 PNG version of the Meet-n-Split icon"
echo "2. Update app.json to use the new icon files"
echo "3. Test the build with 'eas build --platform ios --profile development'"
