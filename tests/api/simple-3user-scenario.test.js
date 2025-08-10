import { test, expect } from '@playwright/test';

const API_BASE_URL = 'https://us-central1-spendy-97913.cloudfunctions.net/spendyApi';

// Generate unique timestamp for this test run
const TIMESTAMP = Date.now();

// Test user data
const testUsers = [
  {
    email: `alice.${TIMESTAMP}@spendytest.com`,
    password: 'TestPassword123!',
    fullName: 'Alice Johnson',
    country: 'AU',
    currency: 'AUD'
  },
  {
    email: `bob.${TIMESTAMP}@spendytest.com`,
    password: 'TestPassword123!',
    fullName: 'Bob Smith',
    country: 'AU',
    currency: 'AUD'
  },
  {
    email: `charlie.${TIMESTAMP}@spendytest.com`,
    password: 'TestPassword123!',
    fullName: 'Charlie Wilson',
    country: 'AU',
    currency: 'AUD'
  }
];

let registeredUsers = [];
let groupId = null;

test.describe('Simple 3-User Expense Scenario (Single User Group)', () => {
  
  test('Setup: Register 3 test users', async ({ request }) => {
    console.log('🚀 Registering 3 test users...');
    
    for (const userData of testUsers) {
      console.log(`🔄 Registering: ${userData.fullName} (${userData.email})`);
      
      const response = await request.post(`${API_BASE_URL}/auth/register`, {
        data: userData
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.user.email).toBe(userData.email);
      
      registeredUsers.push({
        ...userData,
        id: result.data.user.id,
        token: result.data.token
      });
      
      console.log(`✅ Registered: ${userData.fullName} (${result.data.user.id})`);
    }
    
    console.log(`✅ All 3 users registered successfully!`);
  });
  
  test('Create group and 5 expenses with splits data', async ({ request }) => {
    expect(registeredUsers.length).toBe(3);
    
    const alice = registeredUsers[0];
    const bob = registeredUsers[1];
    const charlie = registeredUsers[2];
    
    console.log('📊 Creating test group...');
    
    // Create group with Alice as admin
    const groupResponse = await request.post(`${API_BASE_URL}/groups`, {
      headers: {
        'Authorization': `Bearer ${alice.token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Test Expense Group',
        description: 'Testing expense splits functionality',
        avatar: '🧪',
        category: 'general',
        currency: 'AUD'
      }
    });
    
    expect(groupResponse.ok()).toBeTruthy();
    const groupResult = await groupResponse.json();
    expect(groupResult.success).toBe(true);
    
    groupId = groupResult.data.group.id;
    console.log(`✅ Created group: ${groupId}`);
    
    // Test scenarios with different split configurations
    const expenseScenarios = [
      {
        description: 'Pizza Dinner - Equal Split',
        amount: 150,
        paidBy: alice.id,
        splits: [
          { userId: alice.id, amount: 50, percentage: 33.33 },
          { userId: bob.id, amount: 50, percentage: 33.33 },
          { userId: charlie.id, amount: 50, percentage: 33.34 }
        ]
      },
      {
        description: 'Grocery Shopping - Unequal Split',
        amount: 200,
        paidBy: bob.id,
        splits: [
          { userId: alice.id, amount: 80, percentage: 40 },
          { userId: bob.id, amount: 70, percentage: 35 },
          { userId: charlie.id, amount: 50, percentage: 25 }
        ]
      },
      {
        description: 'Movie Tickets - Two Person Split',
        amount: 60,
        paidBy: charlie.id,
        splits: [
          { userId: alice.id, amount: 30, percentage: 50 },
          { userId: charlie.id, amount: 30, percentage: 50 }
        ]
      },
      {
        description: 'Coffee Run - Solo Expense',
        amount: 25,
        paidBy: alice.id,
        splits: [
          { userId: alice.id, amount: 25, percentage: 100 }
        ]
      },
      {
        description: 'Taxi Ride - Custom Split',
        amount: 45,
        paidBy: bob.id,
        splits: [
          { userId: alice.id, amount: 15, percentage: 33.33 },
          { userId: bob.id, amount: 20, percentage: 44.44 },
          { userId: charlie.id, amount: 10, percentage: 22.23 }
        ]
      }
    ];
    
    console.log('💰 Creating 5 test expenses...');
    
    for (let i = 0; i < expenseScenarios.length; i++) {
      const scenario = expenseScenarios[i];
      const payer = registeredUsers.find(u => u.id === scenario.paidBy);
      
      console.log(`🔄 Creating expense ${i + 1}: ${scenario.description}`);
      console.log(`   💳 Paid by: ${payer.fullName}`);
      console.log(`   💰 Amount: $${scenario.amount}`);
      console.log(`   👥 Splits: ${scenario.splits.length} people`);
      
      const expenseResponse = await request.post(`${API_BASE_URL}/expenses`, {
        headers: {
          'Authorization': `Bearer ${payer.token}`,
          'Content-Type': 'application/json'
        },
        data: {
          description: scenario.description,
          amount: scenario.amount,
          paidBy: scenario.paidBy,
          groupId: groupId,
          category: 'test',
          categoryIcon: '🧪',
          currency: 'AUD',
          splitType: 'custom',
          splits: scenario.splits,
          notes: `Test expense ${i + 1} for splits validation`
        }
      });
      
      expect(expenseResponse.ok()).toBeTruthy();
      const expenseResult = await expenseResponse.json();
      
      expect(expenseResult.success).toBe(true);
      expect(expenseResult.data.expense.splits).toBeDefined();
      expect(expenseResult.data.expense.splits.length).toBe(scenario.splits.length);
      
      // Verify splits data structure
      const createdSplits = expenseResult.data.expense.splits;
      for (let j = 0; j < createdSplits.length; j++) {
        const split = createdSplits[j];
        expect(split.userId).toBeDefined();
        expect(split.userData).toBeDefined();
        expect(split.userData.fullName).toBeDefined();
        expect(split.userData.email).toBeDefined();
        expect(split.amount).toBe(scenario.splits[j].amount);
        expect(split.percentage).toBe(scenario.splits[j].percentage);
        expect(split.isPaid).toBeDefined();
        
        if (split.userId === scenario.paidBy) {
          expect(split.isPaid).toBe(true);
          expect(split.paidAt).toBeDefined();
        }
      }
      
      console.log(`✅ Created expense ${i + 1}: ${expenseResult.data.expense.id}`);
    }
    
    console.log('🎉 All 5 expenses created successfully!');
  });
  
  test('Verify group expenses and splits integrity', async ({ request }) => {
    expect(groupId).toBeDefined();
    const alice = registeredUsers[0];
    
    console.log('🔍 Retrieving group expenses...');
    
    const expensesResponse = await request.get(`${API_BASE_URL}/expenses/group/${groupId}`, {
      headers: {
        'Authorization': `Bearer ${alice.token}`
      }
    });
    
    expect(expensesResponse.ok()).toBeTruthy();
    const expensesResult = await expensesResponse.json();
    
    expect(expensesResult.success).toBe(true);
    expect(expensesResult.data.expenses.length).toBe(5);
    
    console.log(`✅ Found ${expensesResult.data.expenses.length} expenses in group`);
    
    // Verify each expense has proper splits data
    let totalAmount = 0;
    for (const expense of expensesResult.data.expenses) {
      console.log(`🔍 Checking expense: ${expense.title} ($${expense.amount})`);
      
      expect(expense.splits).toBeDefined();
      expect(Array.isArray(expense.splits)).toBe(true);
      expect(expense.splits.length).toBeGreaterThan(0);
      
      // Verify splits data structure
      for (const split of expense.splits) {
        expect(split.userId).toBeDefined();
        expect(split.userData).toBeDefined();
        expect(split.userData.fullName).toBeDefined();
        expect(split.userData.email).toBeDefined();
        expect(split.amount).toBeGreaterThan(0);
        expect(split.percentage).toBeGreaterThan(0);
        expect(typeof split.isPaid).toBe('boolean');
      }
      
      totalAmount += expense.amount;
      console.log(`   ✅ Splits data valid (${expense.splits.length} splits)`);
    }
    
    console.log(`💰 Total expenses: $${totalAmount}`);
    console.log('🎉 All expense splits data validated successfully!');
  });
  
  test('Test summary and cleanup info', async () => {
    console.log('\n📝 TEST SUMMARY:');
    console.log('================');
    console.log(`Timestamp: ${TIMESTAMP}`);
    console.log(`Group ID: ${groupId}`);
    console.log('User Credentials:');
    
    for (let i = 0; i < registeredUsers.length; i++) {
      const user = registeredUsers[i];
      console.log(`  User${i + 1} (${user.fullName}): ${user.email} / ${user.password}`);
      console.log(`    ID: ${user.id}`);
    }
    
    console.log('\n🔧 Use these credentials for UI testing:');
    for (const user of registeredUsers) {
      console.log(`${user.fullName}: ${user.email} / ${user.password}`);
    }
    
    console.log(`\n📊 Group ID for testing: ${groupId}`);
    console.log('✅ Splits data validation: PASSED');
    console.log('✅ User data enrichment: PASSED');
    console.log('✅ Payment tracking: PASSED');
  });
});
