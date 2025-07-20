#!/bin/bash

# Script to fix React Native Reanimated version mismatch
# Run this script when you encounter Reanimated version mismatch errors

echo "🔧 Fixing React Native Reanimated version mismatch..."

# Stop any running Metro bundler
echo "📱 Stopping Metro bundler..."
pkill -f "metro" || true

# Clear all caches
echo "🧹 Clearing caches..."
rm -rf node_modules
rm -rf ios/build
rm -rf ios/Pods
rm -rf Podfile.lock
rm -rf yarn.lock
rm -rf package-lock.json

# Clear Expo and Metro caches
npx expo r -c || true
npx expo install --fix || true

# Clear Watchman
watchman watch-del-all || true

# Clean iOS DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData

# Reinstall dependencies
echo "📦 Reinstalling dependencies..."
yarn install

# Reinstall iOS pods
echo "🍎 Reinstalling iOS pods..."
cd ios
pod deintegrate || true
pod clean || true
pod install
cd ..

# Clear system caches
echo "🗂️ Clearing system caches..."
yarn start --reset-cache --clear || npx expo start --clear || true

echo "✅ Fix complete! Now run:"
echo "   npx expo run:ios"
echo "   or"
echo "   npx expo start --clear"

echo ""
echo "If the issue persists, try:"
echo "1. Restart your computer"
echo "2. Update Xcode to the latest version"
echo "3. Run 'npx expo doctor' to check for other issues"
