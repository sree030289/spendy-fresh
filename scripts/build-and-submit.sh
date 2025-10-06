#!/bin/bash

# Build and Submit Script for iOS Production
# This script builds the iOS app and automatically submits to TestFlight/App Store

set -e  # Exit on any error

echo "🚀 Starting iOS Production Build and Submit Process..."
echo ""

# Step 1: Build the app
echo "📦 Step 1: Building iOS app with production profile..."
eas build -p ios --profile production --non-interactive

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo ""
    
    # Step 2: Submit to App Store
    echo "📤 Step 2: Submitting to App Store..."
    eas submit -p ios --latest
    
    if [ $? -eq 0 ]; then
        echo "✅ Submission completed successfully!"
        echo ""
        echo "🎉 Build and submission complete!"
        echo "📱 Check TestFlight or App Store Connect for your build"
    else
        echo "❌ Submission failed!"
        exit 1
    fi
else
    echo "❌ Build failed!"
    exit 1
fi
