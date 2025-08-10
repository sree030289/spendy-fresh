#!/bin/bash

# Run Playwright API Test for Expense Splitting Scenario
echo "🚀 Running Expense Splitting Scenario Test..."
echo "=============================================="

# Check if Playwright is installed
if ! command -v npx playwright &> /dev/null; then
    echo "📦 Installing Playwright..."
    npm install @playwright/test
fi

# Run the test
echo "🧪 Executing test scenario..."
npx playwright test tests/api/expense-splitting-scenario.test.js --headed --reporter=line

echo ""
echo "✅ Test completed!"
echo ""
echo "🔧 User Credentials for UI Testing:"
echo "======================================"
echo "User1 (Alice): testuser1@spendytest.com / TestPassword123!"
echo "User2 (Bob):   testuser2@spendytest.com / TestPassword123!"
echo "User3 (Charlie): testuser3@spendytest.com / TestPassword123!"
echo ""
echo "📝 Login to the app with any of these credentials to verify the split data fixes!"
