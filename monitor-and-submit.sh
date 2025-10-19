#!/bin/bash

BUILD_ID="8ecac3f6-0a5e-462a-843d-54c0d48e8a51"
echo "🔍 Monitoring build: $BUILD_ID"
echo "📱 Build logs: https://expo.dev/accounts/sree030289/projects/spendy/builds/$BUILD_ID"
echo ""

while true; do
  STATUS=$(eas build:view $BUILD_ID --json 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$STATUS" = "finished" ]; then
    echo "✅ Build completed successfully!"
    echo "🚀 Submitting to App Store..."
    eas submit --platform ios --latest --non-interactive
    exit 0
  elif [ "$STATUS" = "errored" ] || [ "$STATUS" = "canceled" ]; then
    echo "❌ Build failed with status: $STATUS"
    echo "Check logs: https://expo.dev/accounts/sree030289/projects/spendy/builds/$BUILD_ID"
    exit 1
  else
    echo "⏳ Build status: $STATUS (checking again in 30 seconds...)"
    sleep 30
  fi
done
