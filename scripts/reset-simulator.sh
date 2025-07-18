#!/bin/bash

# iOS Simulator Reset Script for Internet Connectivity Issues
# Run this when simulator loses internet connection

echo "🔄 Resetting iOS Simulator for internet connectivity..."

# Kill all running simulators
echo "1. Shutting down all simulators..."
xcrun simctl shutdown all

# Wait a moment
sleep 2

# Reset network settings for all devices
echo "2. Resetting network settings..."
xcrun simctl spawn booted settings set com.apple.iphonesimulator IPAddress ""
xcrun simctl spawn booted settings set com.apple.iphonesimulator SubnetMask ""
xcrun simctl spawn booted settings set com.apple.iphonesimulator Router ""

# Clear DNS cache
echo "3. Clearing DNS cache..."
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Restart simulator
echo "4. Starting simulator..."
open -a Simulator

# Wait for simulator to boot
sleep 5

echo "✅ Simulator reset complete! Internet should work now."
echo "💡 Run 'npx expo start' to restart your app"
