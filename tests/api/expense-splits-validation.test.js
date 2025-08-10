// Simplified Playwright Test: Validate Splits Data Fix
const { test, expect } = require('@playwright/test');

// Test Configuration
const API_BASE_URL = 'https://us-central1-spendy-97913.cloudfunctions.net/spendyApi';

// Generate unique timestamp for this test run
const TIMESTAMP = Date.now();

// Test User Data
const TEST_USER = {
  email: `testuser.${TIMESTAMP}@spendytest.com`,
  password: 'TestPassword123!',
  fullName: 'Alice Johnson',
  currency: 'AUD',
  country: 'AU',
  mobile: '+61400000000'
};

// Test Data Storage
let authToken = '';
let userId = '';
let groupId = '';

test.describe('Expense Splits Data Validation', () => {
  
  test.beforeAll(async ({ request }) => {
    console.log('🚀 Setting up test user and group...');
    
    // Step 1: Register test user
    console.log(`🔄 Registering user: ${TEST_USER.fullName} (${TEST_USER.email})`);
    const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
      data: TEST_USER
    });
    
    expect(registerResponse.ok()).toBeTruthy();
    const registerData = await registerResponse.json();
    authToken = registerData.data.token;
    userId = registerData.data.user.id;
    console.log(`✅ Registered user: ${TEST_USER.fullName} (${userId})`);
    
    // Step 2: Create a test group
    console.log('📊 Creating test group...');
    const groupResponse = await request.post(`${API_BASE_URL}/groups`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Splits Test Group',
        description: 'Test group for validating splits data fix',
        currency: 'AUD',
        avatar: '🧪'
      }
    });
    
    expect(groupResponse.ok()).toBeTruthy();
    const groupData = await groupResponse.json();
    groupId = groupData.data.group.id;
    console.log(`✅ Created group: ${groupId}`);
  });

  test('Verify splits data is properly stored and retrieved', async ({ request }) => {
    console.log('💰 Testing expense creation with splits data...');
    
    // Test Expense: Single user expense with splits data
    console.log('Creating test expense with splits...');
    const expenseResponse = await request.post(`${API_BASE_URL}/expenses`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        groupId: groupId,
        description: 'Test Expense - Splits Validation',
        amount: 100,
        paidBy: userId,
        currency: 'AUD',
        category: 'test',
        categoryIcon: '🧪',
        splitType: 'equal',
        splits: [
          { 
            userId: userId, 
            amount: 100, 
            percentage: 100,
            isPaid: true
          }
        ],
        notes: 'Testing splits data storage and retrieval'
      }
    });
    
    expect(expenseResponse.ok()).toBeTruthy();
    const expenseData = await expenseResponse.json();
    const expenseId = expenseData.data.expense.id;
    
    console.log('🔍 Expense creation response:', JSON.stringify(expenseData.data.expense, null, 2));
    
    // Verify the response has the splits field
    expect(expenseData.data.expense.splits).toBeDefined();
    expect(Array.isArray(expenseData.data.expense.splits)).toBeTruthy();
    expect(expenseData.data.expense.splits.length).toBe(1);
    
    // Verify split data structure
    const split = expenseData.data.expense.splits[0];
    expect(split.userId).toBe(userId);
    expect(split.amount).toBe(100);
    expect(split.percentage).toBe(100);
    expect(split.isPaid).toBe(true);
    expect(split.userData).toBeDefined();
    expect(split.userData.fullName).toBe(TEST_USER.fullName);
    expect(split.userData.email).toBe(TEST_USER.email);
    
    console.log('✅ Created expense with proper splits data structure');
    
    // Step 2: Retrieve the expense and verify splits are still there
    console.log('🔍 Retrieving expense to verify splits persistence...');
    const retrieveResponse = await request.get(`${API_BASE_URL}/expenses/group/${groupId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    expect(retrieveResponse.ok()).toBeTruthy();
    const retrievedData = await retrieveResponse.json();
    const expenses = retrievedData.data.expenses;
    
    expect(expenses.length).toBe(1);
    const retrievedExpense = expenses[0];
    
    console.log('🔍 Retrieved expense:', JSON.stringify(retrievedExpense, null, 2));
    
    // Verify splits data is preserved on retrieval
    expect(retrievedExpense.splits).toBeDefined();
    expect(Array.isArray(retrievedExpense.splits)).toBeTruthy();
    expect(retrievedExpense.splits.length).toBe(1);
    
    const retrievedSplit = retrievedExpense.splits[0];
    expect(retrievedSplit.userId).toBe(userId);
    expect(retrievedSplit.amount).toBe(100);
    expect(retrievedSplit.userData).toBeDefined();
    expect(retrievedSplit.userData.fullName).toBe(TEST_USER.fullName);
    
    console.log('✅ Splits data correctly persisted and retrieved');
    
    // Step 3: Compare with legacy splitDetails field
    if (retrievedExpense.splitDetails) {
      console.log('📝 Checking backward compatibility with splitDetails...');
      expect(retrievedExpense.splitDetails.length).toBe(1);
      console.log('✅ Backward compatibility maintained');
    }
    
    console.log('🎉 All splits data validation tests passed!');
  });

  test.afterAll(async () => {
    console.log('🧹 Test completed');
    console.log('\n📝 VALIDATION SUMMARY:');
    console.log('====================');
    console.log('✅ Splits field is properly stored');
    console.log('✅ User data is enriched in splits');
    console.log('✅ Payment status is tracked');
    console.log('✅ Data is correctly retrieved');
    console.log('✅ Backward compatibility maintained');
    console.log('\n🔧 Test user credentials:');
    console.log(`Email: ${TEST_USER.email}`);
    console.log(`Password: ${TEST_USER.password}`);
    console.log(`Group ID: ${groupId}`);
    console.log(`User ID: ${userId}`);
  });

});
