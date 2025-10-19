#!/bin/bash

BUILD_ID="08a59847-3b8c-4742-a8e2-7ce156e88317"
CHECK_INTERVAL=30

echo "🔍 Monitoring Build #28 (with opaque icon fix)..."
echo "Build ID: $BUILD_ID"
echo "Checking every $CHECK_INTERVAL seconds..."
echo ""

while true; do
    # Get the latest build status
    STATUS=$(eas build:list --platform ios --limit 1 --non-interactive 2>/dev/null | grep "$BUILD_ID" -A 2 | grep "Status" | awk '{print $2}')
    
    echo "[$(date '+%H:%M:%S')] Build status: $STATUS"
    
    if [ "$STATUS" = "finished" ]; then
        echo ""
        echo "✅ Build #28 completed successfully!"
        echo "📤 Submitting to App Store..."
        echo ""
        
        eas submit --platform ios --latest --non-interactive
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "🎉 Successfully submitted to App Store!"
            echo "✓ App name: Meet n Split"
            echo "✓ Build number: 28"
            echo "✓ Opaque icon (no alpha channel) included"
        else
            echo ""
            echo "❌ Submission failed. Please check the error above."
        fi
        
        exit 0
    elif [ "$STATUS" = "errored" ] || [ "$STATUS" = "canceled" ]; then
        echo ""
        echo "❌ Build failed with status: $STATUS"
        echo "Check logs at: https://expo.dev/accounts/sree030289/projects/spendy/builds/$BUILD_ID"
        exit 1
    fi
    
    sleep $CHECK_INTERVAL
done
