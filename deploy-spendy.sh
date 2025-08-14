#!/bin/bash

# Comprehensive deployment script for Spendy application
echo "🚀 Starting Spendy Deployment Process..."

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in to Firebase
echo "🔐 Checking Firebase authentication..."
firebase projects:list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Not logged in to Firebase. Please run: firebase login"
    exit 1
fi

echo "✅ Prerequisites checked"

# Set environment for development
echo "📝 Setting environment variables..."
export EXPO_PUBLIC_BUILD_TYPE=dev
export NODE_ENV=development

# Step 1: Build and deploy Firebase Functions
echo "🔧 Step 1: Building and deploying Firebase Functions..."
cd functions
npm install
npm run build

echo "🔧 Deploying to spendy-develop project..."
firebase deploy --only functions --project spendy-develop

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy functions"
    exit 1
fi

echo "✅ Functions deployed successfully"

# Step 2: Build and deploy API
echo "🔧 Step 2: Building and deploying API..."
cd ../api
npm install
npm run build

# Deploy the API as well
firebase deploy --only functions --project spendy-develop

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy API"
    exit 1
fi

echo "✅ API deployed successfully"

# Step 3: Return to main directory and install dependencies
echo "🔧 Step 3: Installing main app dependencies..."
cd ..
npm install

# Step 4: Test API endpoints
echo "🔍 Step 4: Testing API connectivity..."
sleep 10  # Wait for deployment to be ready

# Test the health endpoint
API_URL="https://us-central1-spendy-develop.cloudfunctions.net/spendyApi"
echo "Testing API at: $API_URL/health"

response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$response" -eq 200 ]; then
    echo "✅ API health check passed"
else
    echo "⚠️  API health check returned: $response"
fi

echo "🎉 Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Run 'npm run start:dev' to start the development server"
echo "2. Test the application thoroughly"
echo "3. Check that edit/delete expense functions work properly"
echo ""
echo "🔗 Useful URLs:"
echo "- API Base: $API_URL"
echo "- Firebase Console: https://console.firebase.google.com/project/spendy-develop"
