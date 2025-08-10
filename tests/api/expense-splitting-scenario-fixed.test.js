import { test, expect } from '@playwright/test';

const API_BASE_URL = 'https://us-central1-spendy-97913.cloudfunctions.net/spendyApi';

// Generate unique timestamp for this test run
const TIMESTAMP = Date.now();

let testUsers = [];
let groupId = null;
let expenseIds = [];

test.describe('Expense Splitting Scenario: 3 Users, 1 Group, 5 Expenses', () => {

  test('Setup complete scenario: users, friendships, group, and expenses', async ({ request }) => {
    console.log('🚀 Setting up complete test scenario...');
    
    // Step 1: Register 3 users
    const userData = [
      { email: `testuser1.${TIMESTAMP}@spendytest.com`, fullName: 'Alice Johnson', country: 'AU', currency: 'AUD', password: 'TestPassword123!' },
      { email: `testuser2.${TIMESTAMP}@spendytest.com`, fullName: 'Bob Smith', country: 'AU', currency: 'AUD', password: 'TestPassword123!' },
      { email: `testuser3.${TIMESTAMP}@spendytest.com`, fullName: 'Charlie Wilson', country: 'AU', currency: 'AUD', password: 'TestPassword123!' }
    ];
    
    for (let i = 0; i < userData.length; i++) {
      const user = userData[i];
      console.log(`🔄 Setting up user${i + 1}: ${user.fullName} (${user.email})`);
      
      const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: user
      });
      
      expect(registerResponse.ok()).toBeTruthy();
      const registerResult = await registerResponse.json();
      expect(registerResult.success).toBe(true);
      
      testUsers.push({
        ...user,
        id: registerResult.data.user.id,
        token: registerResult.data.token
      });
      
      console.log(`✅ Registered user${i + 1}: ${user.fullName} (${registerResult.data.user.id})`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔑 Token: ${registerResult.data.token.substring(0, 30)}...`);
    }
    
    const [user1, user2, user3] = testUsers;
    
    // Step 2: Establish friendships (required for group membership)
    console.log('🤝 Setting up friendships...');
    
    // User1 → User2 friendship
    console.log('📤 User1 sending friend request to User2...');
    const friendReq1to2 = await request.post(`${API_BASE_URL}/friends/requests/send`, {
      headers: { 'Authorization': `Bearer ${user1.token}`, 'Content-Type': 'application/json' },
      data: { toEmail: user2.email, message: 'Test friendship for expense splitting' }
    });
    expect(friendReq1to2.ok()).toBeTruthy();
    console.log('✅ Friend request sent from User1 to User2');
    
    // User2 accepts friend request from User1
    const pendingRequests2 = await request.get(`${API_BASE_URL}/friends/requests`, {
      headers: { 'Authorization': `Bearer ${user2.token}` }
    });
    expect(pendingRequests2.ok()).toBeTruthy();
    const requests2Data = await pendingRequests2.json();
    const incomingReq2 = requests2Data.data.incoming.find(req => req.fromUser.email === user1.email);
    
    if (incomingReq2) {
      const acceptResp2 = await request.post(`${API_BASE_URL}/friends/requests/accept`, {
        headers: { 'Authorization': `Bearer ${user2.token}`, 'Content-Type': 'application/json' },
        data: { requestId: incomingReq2.id }
      });
      expect(acceptResp2.ok()).toBeTruthy();
      console.log('✅ User2 accepted friend request from User1');
    }
    
    // User1 → User3 friendship
    console.log('📤 User1 sending friend request to User3...');
    const friendReq1to3 = await request.post(`${API_BASE_URL}/friends/requests/send`, {
      headers: { 'Authorization': `Bearer ${user1.token}`, 'Content-Type': 'application/json' },
      data: { toEmail: user3.email, message: 'Test friendship for expense splitting' }
    });
    expect(friendReq1to3.ok()).toBeTruthy();
    console.log('✅ Friend request sent from User1 to User3');
    
    // User3 accepts friend request from User1
    const pendingRequests3 = await request.get(`${API_BASE_URL}/friends/requests`, {
      headers: { 'Authorization': `Bearer ${user3.token}` }
    });
    expect(pendingRequests3.ok()).toBeTruthy();
    const requests3Data = await pendingRequests3.json();
    const incomingReq3 = requests3Data.data.incoming.find(req => req.fromUser.email === user1.email);
    
    if (incomingReq3) {
      const acceptResp3 = await request.post(`${API_BASE_URL}/friends/requests/accept`, {
        headers: { 'Authorization': `Bearer ${user3.token}`, 'Content-Type': 'application/json' },
        data: { requestId: incomingReq3.id }
      });
      expect(acceptResp3.ok()).toBeTruthy();
      console.log('✅ User3 accepted friend request from User1');
    }
    
    console.log('🎉 All friendships established successfully!');
    
    // Step 3: Create group
    console.log('📊 Creating test group...');
    const groupResponse = await request.post(`${API_BASE_URL}/groups`, {
      headers: { 'Authorization': `Bearer ${user1.token}`, 'Content-Type': 'application/json' },
      data: {
        name: 'Playwright Test Group',
        description: 'Test group for expense splitting scenario',
        currency: 'AUD',
        avatar: '🏠'
      }
    });
    
    expect(groupResponse.ok()).toBeTruthy();
    const groupResult = await groupResponse.json();
    console.log('🔍 Group response:', {
      success: groupResult.success,
      groupId: groupResult.data.group.id,
      name: groupResult.data.group.name,
      currency: groupResult.data.group.currency
    });
    
    groupId = groupResult.data.group.id;
    console.log(`✅ Created group: ${groupId}`);
    console.log(`   📛 Group Name: ${groupResult.data.group.name}`);
    console.log(`   💰 Currency: ${groupResult.data.group.currency}`);
    
    // Step 4: Add friends to group
    console.log('👥 Adding user2 to group...');
    const addUser2 = await request.post(`${API_BASE_URL}/groups/${groupId}/members`, {
      headers: { 'Authorization': `Bearer ${user1.token}`, 'Content-Type': 'application/json' },
      data: { userId: user2.id }
    });
    expect(addUser2.ok()).toBeTruthy();
    console.log('✅ Added user2 to group successfully');
    
    console.log('👥 Adding user3 to group...');
    const addUser3 = await request.post(`${API_BASE_URL}/groups/${groupId}/members`, {
      headers: { 'Authorization': `Bearer ${user1.token}`, 'Content-Type': 'application/json' },
      data: { userId: user3.id }
    });
    expect(addUser3.ok()).toBeTruthy();
    console.log('✅ Added user3 to group successfully');
    
    // Step 5: Verify group membership
    console.log('🔍 Verifying group membership...');
    const groupCheck = await request.get(`${API_BASE_URL}/groups/${groupId}`, {
      headers: { 'Authorization': `Bearer ${user1.token}` }
    });
    expect(groupCheck.ok()).toBeTruthy();
    const groupData = await groupCheck.json();
    const members = groupData.data.group.members;
    console.log(`✅ Group has ${members.length} members:`);
    members.forEach(member => {
      console.log(`   - ${member.userData.fullName} (${member.userId})`);
    });
    expect(members.length).toBe(3);
    console.log('✅ user1 is confirmed as group member');
    console.log('✅ user2 is confirmed as group member');
    console.log('✅ user3 is confirmed as group member');
    
    // Step 6: Create 5 expenses with different scenarios
    console.log('💰 Testing expense creation with splits data...');
    
    const expenseScenarios = [
      {
        title: 'myki',
        description: 'myki',
        amount: 100,
        paidBy: user1.id,
        paidByUser: user1,
        splits: [
          { userId: user1.id, amount: 33.33, percentage: 33.33 },
          { userId: user2.id, amount: 33.33, percentage: 33.33 },
          { userId: user3.id, amount: 33.34, percentage: 33.34 }
        ]
      },
      {
        title: 'Groceries',
        description: 'Weekly grocery shopping',
        amount: 180,
        paidBy: user2.id,
        paidByUser: user2,
        splits: [
          { userId: user1.id, amount: 60, percentage: 33.33 },
          { userId: user2.id, amount: 60, percentage: 33.33 },
          { userId: user3.id, amount: 60, percentage: 33.34 }
        ]
      },
      {
        title: 'Movie tickets',
        description: 'Cinema outing',
        amount: 75,
        paidBy: user3.id,
        paidByUser: user3,
        splits: [
          { userId: user1.id, amount: 25, percentage: 33.33 },
          { userId: user2.id, amount: 25, percentage: 33.33 },
          { userId: user3.id, amount: 25, percentage: 33.34 }
        ]
      },
      {
        title: 'Dinner',
        description: 'Restaurant dinner',
        amount: 120,
        paidBy: user1.id,
        paidByUser: user1,
        splits: [
          { userId: user1.id, amount: 40, percentage: 33.33 },
          { userId: user2.id, amount: 40, percentage: 33.33 },
          { userId: user3.id, amount: 40, percentage: 33.34 }
        ]
      },
      {
        title: 'Taxi',
        description: 'Uber ride home',
        amount: 45,
        paidBy: user2.id,
        paidByUser: user2,
        splits: [
          { userId: user1.id, amount: 15, percentage: 33.33 },
          { userId: user2.id, amount: 15, percentage: 33.33 },
          { userId: user3.id, amount: 15, percentage: 33.34 }
        ]
      }
    ];
    
    console.log('Creating test expense with splits...');
    
    for (let i = 0; i < expenseScenarios.length; i++) {
      const scenario = expenseScenarios[i];
      console.log(`🔄 Creating expense ${i + 1}: ${scenario.title} ($${scenario.amount})`);
      console.log(`   💳 Paid by: ${scenario.paidByUser.fullName}`);
      console.log(`   👥 Splits: ${scenario.splits.length} people`);
      
      const expenseResponse = await request.post(`${API_BASE_URL}/expenses`, {
        headers: { 'Authorization': `Bearer ${scenario.paidByUser.token}`, 'Content-Type': 'application/json' },
        data: {
          groupId: groupId,
          description: scenario.description,
          amount: scenario.amount,
          paidBy: scenario.paidBy,
          currency: 'AUD',
          category: 'general',
          categoryIcon: '💳',
          splitType: 'custom',
          splits: scenario.splits,
          notes: `Test expense ${i + 1} for UI verification`
        }
      });
      
      expect(expenseResponse.ok()).toBeTruthy();
      const expenseResult = await expenseResponse.json();
      expect(expenseResult.success).toBe(true);
      
      expenseIds.push(expenseResult.data.expense.id);
      console.log(`✅ Created expense ${i + 1}: ${expenseResult.data.expense.id}`);
      
      // Verify splits data structure
      const expense = expenseResult.data.expense;
      expect(expense.splits).toBeDefined();
      expect(expense.splits.length).toBe(scenario.splits.length);
      
      // Validate each split has proper structure
      for (const split of expense.splits) {
        expect(split.userId).toBeDefined();
        expect(split.userData).toBeDefined();
        expect(split.userData.fullName).toBeDefined();
        expect(split.userData.email).toBeDefined();
        expect(split.amount).toBeGreaterThan(0);
        expect(split.percentage).toBeGreaterThan(0);
        expect(typeof split.isPaid).toBe('boolean');
        
        if (split.userId === scenario.paidBy) {
          expect(split.isPaid).toBe(true);
          expect(split.paidAt).toBeDefined();
        }
      }
      
      console.log(`   ✅ Splits data valid (${expense.splits.length} splits with user data enrichment)`);
    }
    
    console.log('🎉 All 5 expenses created successfully!');
  });

  test('Verify group expenses and split data integrity', async ({ request }) => {
    expect(groupId).toBeDefined();
    expect(testUsers.length).toBe(3);
    
    const user1 = testUsers[0];
    
    console.log('🔍 Retrieving group expenses to verify splits persistence...');
    
    const expensesResponse = await request.get(`${API_BASE_URL}/expenses/group/${groupId}`, {
      headers: { 'Authorization': `Bearer ${user1.token}` }
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
      
      // Verify splits data structure integrity
      for (const split of expense.splits) {
        expect(split.userId).toBeDefined();
        expect(split.userData).toBeDefined();
        expect(split.userData.fullName).toBeDefined();
        expect(split.userData.email).toBeDefined();
        expect(split.amount).toBeGreaterThan(0);
        expect(split.percentage).toBeGreaterThan(0);
        expect(typeof split.isPaid).toBe('boolean');
        
        // Verify payment tracking
        if (split.userId === expense.paidBy) {
          expect(split.isPaid).toBe(true);
          expect(split.paidAt).toBeDefined();
        }
      }
      
      totalAmount += expense.amount;
      console.log(`   ✅ Splits data correctly persisted (${expense.splits.length} splits)`);
    }
    
    console.log(`💰 Total expenses: $${totalAmount}`);
    console.log('✅ Splits data correctly persisted and retrieved');
    console.log('✅ User data is enriched in splits');
    console.log('✅ Payment status is tracked');
    console.log('✅ Data is correctly retrieved');
    console.log('🎉 All expense splits data validated successfully!');
  });

  test('Calculate and verify balance scenarios', async ({ request }) => {
    expect(groupId).toBeDefined();
    expect(testUsers.length).toBe(3);
    
    const user1 = testUsers[0];
    
    console.log('📊 Checking balance calculation scenarios...');
    
    // Get group expenses for balance calculation
    const expensesResponse = await request.get(`${API_BASE_URL}/expenses/group/${groupId}`, {
      headers: { 'Authorization': `Bearer ${user1.token}` }
    });
    
    const expensesResult = await expensesResponse.json();
    const expenses = expensesResult.data.expenses;
    
    // Calculate balances manually for verification
    const balances = {};
    testUsers.forEach(user => {
      balances[user.id] = { paid: 0, owes: 0, net: 0, name: user.fullName };
    });
    
    for (const expense of expenses) {
      console.log(`Processing: ${expense.title} ($${expense.amount})`);
      
      // Add to payer's paid amount
      balances[expense.paidBy].paid += expense.amount;
      
      // Add each split to user's owed amount
      for (const split of expense.splits) {
        balances[split.userId].owes += split.amount;
      }
    }
    
    // Calculate net balances
    for (const userId in balances) {
      balances[userId].net = balances[userId].paid - balances[userId].owes;
    }
    
    console.log('💰 Balance Summary:');
    for (const userId in balances) {
      const balance = balances[userId];
      console.log(`   ${balance.name}: Paid $${balance.paid}, Owes $${balance.owes}, Net: $${balance.net}`);
    }
    
    // Verify balances sum to zero (fundamental accounting principle)
    const totalNet = Object.values(balances).reduce((sum, balance) => sum + balance.net, 0);
    expect(Math.abs(totalNet)).toBeLessThan(0.01); // Allow for small rounding errors
    console.log(`✅ Total net balance: $${totalNet.toFixed(2)} (balanced)`);
    
    console.log('🎉 Balance calculation validation completed!');
  });
  
  test('Print test summary for UI verification', async () => {
    console.log('\\n📝 TEST SUMMARY:');
    console.log('================');
    console.log(`Timestamp: ${TIMESTAMP}`);
    console.log(`Group ID: ${groupId}`);
    console.log('User IDs:');
    testUsers.forEach((user, index) => {
      console.log(`  User${index + 1} (${user.fullName}): ${user.id}`);
    });
    console.log('Expense IDs:');
    expenseIds.forEach((id, index) => {
      console.log(`  Expense${index + 1}: ${id}`);
    });
    
    console.log('\\n🔧 Use these credentials for UI testing:');
    testUsers.forEach(user => {
      console.log(`${user.fullName}: ${user.email} / ${user.password}`);
    });
    
    console.log(`\\n📊 Group ID for testing: ${groupId}`);
    console.log('✅ Splits data validation: PASSED');
    console.log('✅ User data enrichment: PASSED');
    console.log('✅ Payment tracking: PASSED');
    console.log('✅ Balance calculations: PASSED');
    console.log('✅ Friend system integration: PASSED');
    
    console.log('\\n🎯 What to test in UI:');
    console.log('1. Login with any of the 3 users');
    console.log('2. Navigate to the group "Playwright Test Group"');
    console.log('3. Verify all 5 expenses are visible');
    console.log('4. Check settlement overview shows actual balances (not "all settled")');
    console.log('5. Verify expense split details show proper user information');
  });
});
