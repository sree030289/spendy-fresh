#!/bin/bash

# Test Expense Notification System
# Replace these with your actual values
JWT_TOKEN="your-jwt-token-here"
API_URL="https://spendyapi-2fy22mkg6q-uc.a.run.app"
GROUP_ID="xhozbcqRqaYatFdGVNFD"

echo "🧪 Testing Expense Notification System..."

# Create a test expense
echo "💰 Creating test expense..."
curl -X POST "$API_URL/expenses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "description": "Test Notification Expense",
    "amount": 25.50,
    "paidBy": "G1LvPEfuDYqWGSfAsuox",
    "groupId": "'$GROUP_ID'",
    "category": "food",
    "categoryIcon": "🍕",
    "currency": "USD",
    "splitType": "equal",
    "splits": [
      {
        "userId": "G1LvPEfuDYqWGSfAsuox",
        "amount": 12.75,
        "percentage": 50
      },
      {
        "userId": "R8lgO0eVYn7S5BclTvca",
        "amount": 12.75,
        "percentage": 50
      }
    ]
  }'

echo -e "\n\n📧 Checking notifications..."
# Check notifications
curl -X GET "$API_URL/notifications" \
  -H "Authorization: Bearer $JWT_TOKEN"

echo -e "\n\n✅ Test complete!"
