#!/bin/bash

# Deploy and Test Dev Environment Script
echo "🚀 Starting Dev Environment Deployment and Testing..."

# Set dev environment
export EXPO_PUBLIC_BUILD_TYPE=dev
export NODE_ENV=development

echo "📝 Environment Variables Set:"
echo "EXPO_PUBLIC_BUILD_TYPE=$EXPO_PUBLIC_BUILD_TYPE"
echo "NODE_ENV=$NODE_ENV"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if logged in to Firebase
echo "🔐 Checking Firebase authentication..."
firebase projects:list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Not logged in to Firebase. Please run: firebase login"
    exit 1
fi

echo "✅ Firebase CLI ready"

# Deploy functions to dev project
echo "🔧 Deploying Cloud Functions to spendy-develop..."
firebase deploy --only functions --project dev

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy functions to dev project"
    exit 1
fi

echo "✅ Functions deployed successfully to dev project"

# Wait for deployment to be ready
echo "⏳ Waiting 30 seconds for functions to be ready..."
sleep 30

# Test API connection
echo "🔍 Testing API connection to dev environment..."
API_URL="https://us-central1-spendy-develop.cloudfunctions.net/spendyApi"

# Test health endpoint
echo "Testing health endpoint: $API_URL/health"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ API health check passed"
else
    echo "❌ API health check failed (HTTP $HEALTH_RESPONSE)"
    echo "🔍 Checking function logs..."
    firebase functions:log --project dev --limit 5
fi

# Run API tests against dev environment
echo "🧪 Running API tests against dev environment..."
npm run test:api:dev

if [ $? -eq 0 ]; then
    echo "✅ All API tests passed!"
    echo ""
    echo "🎉 Dev Environment Setup Complete!"
    echo "📊 You can now:"
    echo "  - Start dev server: npm run start:dev"
    echo "  - Monitor dev costs in Firebase Console: https://console.firebase.google.com/project/spendy-develop"
    echo "  - View function logs: firebase functions:log --project dev"
    echo ""
    echo "💰 Expected Cost Impact:"
    echo "  - Dev project reads: ~2-5M/month = $1-3/month"
    echo "  - Prod project reads: ~10-15M/month = $5-8/month"
    echo "  - Total savings: 50-70% vs single project setup"
else
    echo "❌ Some API tests failed. Check the output above."
    echo "🔍 Viewing recent function logs..."
    firebase functions:log --project dev --limit 10
fi

echo "🔧 Deployment script completed."