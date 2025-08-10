/**
 * Test script to verify timestamp conversion functionality
 */

// Test the API helpers timestamp conversion
const { convertApiTimestamps } = require('../helpers/api-helpers.js');

console.log('🧪 Testing API Helpers Timestamp Conversion...\n');

// Test data with ISO string timestamps
const testApiResponse = {
  success: true,
  data: {
    expenses: [
      {
        id: 'exp1',
        title: 'Test Expense',
        amount: 50.00,
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
        user: {
          id: 'user1',
          name: 'John Doe',
          joinedAt: '2024-01-01T00:00:00.000Z'
        }
      }
    ],
    group: {
      id: 'group1',
      name: 'Test Group',
      createdAt: '2024-01-01T00:00:00.000Z',
      members: [
        {
          id: 'user1',
          name: 'John',
          lastLoginAt: '2024-01-15T09:00:00.000Z'
        }
      ]
    }
  }
};

// Convert timestamps
const converted = convertApiTimestamps(testApiResponse);

console.log('Original data timestamps:');
console.log('- expense.createdAt:', typeof testApiResponse.data.expenses[0].createdAt, testApiResponse.data.expenses[0].createdAt);
console.log('- expense.updatedAt:', typeof testApiResponse.data.expenses[0].updatedAt, testApiResponse.data.expenses[0].updatedAt);
console.log('- group.createdAt:', typeof testApiResponse.data.group.createdAt, testApiResponse.data.group.createdAt);

console.log('\nConverted data timestamps:');
console.log('- expense.createdAt:', typeof converted.data.expenses[0].createdAt, converted.data.expenses[0].createdAt);
console.log('- expense.updatedAt:', typeof converted.data.expenses[0].updatedAt, converted.data.expenses[0].updatedAt);
console.log('- group.createdAt:', typeof converted.data.group.createdAt, converted.data.group.createdAt);

console.log('\nTesting .getTime() method:');
try {
  const expense = converted.data.expenses[0];
  const timeDiff = Math.abs(expense.updatedAt.getTime() - expense.createdAt.getTime());
  console.log('✅ Time difference calculation successful:', timeDiff + 'ms');
} catch (error) {
  console.log('❌ Time difference calculation failed:', error.message);
}

console.log('\n🎉 Test completed!');
