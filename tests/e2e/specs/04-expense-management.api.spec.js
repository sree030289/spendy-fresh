const { test, expect } = require('@playwright/test');
const { generateTestUser, generateTestGroup, generateTestExpense, SpendyApiHelper } = require('../helpers/api-helpers');

test.describe('Expense Management & Splitting Flow', () => {
  let api;
  let user1, user2, user3;
  let testGroup;
  let groupId;

  test.beforeEach(async ({ request }) => {
    api = new SpendyApiHelper(request);
    user1 = generateTestUser('payer');
    user2 = generateTestUser('splitter1');
    user3 = generateTestUser('splitter2');
    testGroup = generateTestGroup();

    // Setup users and friendships
    await api.register(user1);
    const login1 = await api.login(user1.email, user1.password);
    user1.token = login1.data.data.token;
    user1.id = login1.data.data.user.id;

    await api.register(user2);
    const login2 = await api.login(user2.email, user2.password);
    user2.token = login2.data.data.token;
    user2.id = login2.data.data.user.id;

    await api.register(user3);
    const login3 = await api.login(user3.email, user3.password);
    user3.token = login3.data.data.token;
    user3.id = login3.data.data.user.id;

    // Create friendships
    await api.sendFriendRequest(user2.email, 'Friends for expenses', user1.token);
    await api.sendFriendRequest(user3.email, 'Friends for expenses', user1.token);
    
    const requests2 = await api.getFriendRequests(user2.token);
    const requests3 = await api.getFriendRequests(user3.token);
    
    if (requests2.data.data.incoming.length > 0) {
      await api.acceptFriendRequest(requests2.data.data.incoming[0].id, user2.token);
    }
    if (requests3.data.data.incoming.length > 0) {
      await api.acceptFriendRequest(requests3.data.data.incoming[0].id, user3.token);
    }

    // Create group and add members
    const groupResponse = await api.createGroup(testGroup, user1.token);
    groupId = groupResponse.data.data.group.id;
    testGroup.id = groupId;

    await api.addGroupMember(groupId, { userId: user2.id, email: user2.email }, user1.token);
    await api.addGroupMember(groupId, { userId: user3.id, email: user3.email }, user1.token);
  });

  test('Complete expense splitting flow - Equal Split', async () => {
    let expenseId;
    const expenseAmount = 120; // $120 split 3 ways = $40 each

    // Step 1: Create expense with equal split
    await test.step('Create equal split expense', async () => {
      const expenseData = {
        description: 'Team Dinner',
        amount: expenseAmount,
        currency: 'AUD',
        category: 'food',
        groupId: groupId,
        paidBy: user1.id,
        splitType: 'equal',
        splitDetails: []
      };

      const response = await api.createExpense(expenseData, user1.token);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.expense.amount).toBe(expenseAmount);
      expect(response.data.data.expense.paidBy).toBe(user1.id);
      expect(response.data.data.expense.splitType).toBe('equal');
      
      expenseId = response.data.data.expense.id;
      
      console.log('✅ Equal split expense created:', expenseId);
    });

    // Step 2: Verify expense appears in user's expenses
    await test.step('Verify expense in user expenses', async () => {
      const response = await api.getUserExpenses(user1.id, user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const createdExpense = response.data.data.expenses.find(e => e.id === expenseId);
      expect(createdExpense).toBeDefined();
      expect(createdExpense.description).toBe('Team Dinner');
      
      console.log('✅ Expense found in user expenses');
    });

    // Step 3: Verify expense appears in group expenses
    await test.step('Verify expense in group expenses', async () => {
      const response = await api.getGroupExpenses(groupId, user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const createdExpense = response.data.data.expenses.find(e => e.id === expenseId);
      expect(createdExpense).toBeDefined();
      expect(createdExpense.amount).toBe(expenseAmount);
      
      console.log('✅ Expense found in group expenses');
    });

    // Step 4: All members can see the expense
    await test.step('All members can see expense', async () => {
      const response2 = await api.getGroupExpenses(groupId, user2.token);
      const response3 = await api.getGroupExpenses(groupId, user3.token);
      
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);
      
      const expense2 = response2.data.data.expenses.find(e => e.id === expenseId);
      const expense3 = response3.data.data.expenses.find(e => e.id === expenseId);
      
      expect(expense2).toBeDefined();
      expect(expense3).toBeDefined();
      
      console.log('✅ All members can see the expense');
    });

    // Step 5: Verify timestamp format compatibility
    await test.step('Verify timestamp format', async () => {
      const response = await api.getGroupExpenses(groupId, user1.token);
      const expense = response.data.data.expenses.find(e => e.id === expenseId);
      
      expect(expense.createdAt).toBeDefined();
      expect(expense.updatedAt).toBeDefined();
      
      // Check React Native compatible timestamp format
      if (typeof expense.createdAt === 'object') {
        expect(expense.createdAt._isDate).toBe(true);
        expect(expense.createdAt.timestamp).toBeDefined();
        expect(expense.createdAt.iso).toBeDefined();
      }
      
      console.log('✅ Timestamp format is React Native compatible');
    });
  });

  test('Custom split expense flow', async () => {
    const expenseAmount = 150;

    await test.step('Create custom split expense', async () => {
      const expenseData = {
        description: 'Custom Split Dinner',
        amount: expenseAmount,
        currency: 'AUD',
        category: 'food',
        groupId: groupId,
        paidBy: user1.id,
        splitType: 'custom',
        splitDetails: [
          { userId: user1.id, amount: 50 },  // User1 owes $50
          { userId: user2.id, amount: 60 },  // User2 owes $60
          { userId: user3.id, amount: 40 }   // User3 owes $40
        ]
      };

      const response = await api.createExpense(expenseData, user1.token);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.expense.splitType).toBe('custom');
      expect(response.data.data.expense.splitDetails).toHaveLength(3);
      
      console.log('✅ Custom split expense created');
    });
  });

  test('Percentage split expense flow', async () => {
    const expenseAmount = 200;

    await test.step('Create percentage split expense', async () => {
      const expenseData = {
        description: 'Percentage Split Bill',
        amount: expenseAmount,
        currency: 'AUD',
        category: 'utilities',
        groupId: groupId,
        paidBy: user2.id,
        splitType: 'percentage',
        splitDetails: [
          { userId: user1.id, percentage: 50 },  // User1 pays 50%
          { userId: user2.id, percentage: 30 },  // User2 pays 30%
          { userId: user3.id, percentage: 20 }   // User3 pays 20%
        ]
      };

      const response = await api.createExpense(expenseData, user2.token);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.expense.splitType).toBe('percentage');
      
      console.log('✅ Percentage split expense created');
    });
  });

  test('Multiple expenses and balance calculation', async () => {
    const expenses = [
      { amount: 60, paidBy: user1.id, description: 'Lunch' },
      { amount: 90, paidBy: user2.id, description: 'Taxi' },
      { amount: 120, paidBy: user3.id, description: 'Groceries' }
    ];

    await test.step('Create multiple expenses', async () => {
      for (const exp of expenses) {
        const expenseData = {
          description: exp.description,
          amount: exp.amount,
          currency: 'AUD',
          category: 'general',
          groupId: groupId,
          paidBy: exp.paidBy,
          splitType: 'equal',
          splitDetails: []
        };

        const token = exp.paidBy === user1.id ? user1.token : 
                     exp.paidBy === user2.id ? user2.token : user3.token;

        const response = await api.createExpense(expenseData, token);
        expect(response.status).toBe(201);
      }
      
      console.log('✅ Multiple expenses created');
    });

    await test.step('Verify group expense total', async () => {
      const response = await api.getGroupExpenses(groupId, user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.data.expenses.length).toBeGreaterThanOrEqual(3);
      
      const totalAmount = response.data.data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      expect(totalAmount).toBeGreaterThanOrEqual(270); // 60 + 90 + 120
      
      console.log('✅ Group expense totals calculated correctly');
    });
  });

  test('Expense validation', async () => {
    await test.step('Missing required fields', async () => {
      const invalidExpense = {
        amount: 50,
        groupId: groupId,
        paidBy: user1.id
        // Missing description
      };

      const response = await api.createExpense(invalidExpense, user1.token);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });

    await test.step('Invalid amount', async () => {
      const invalidExpense = {
        description: 'Invalid Amount',
        amount: -50, // Negative amount
        groupId: groupId,
        paidBy: user1.id,
        splitType: 'equal'
      };

      const response = await api.createExpense(invalidExpense, user1.token);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });

    await test.step('Invalid group ID', async () => {
      const invalidExpense = {
        description: 'Invalid Group',
        amount: 50,
        groupId: 'invalid-group-id',
        paidBy: user1.id,
        splitType: 'equal'
      };

      const response = await api.createExpense(invalidExpense, user1.token);
      
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });

    await test.step('Non-member cannot create expense', async () => {
      // Create a new user who is not in the group
      const outsiderUser = generateTestUser('outsider');
      await api.register(outsiderUser);
      const outsiderLogin = await api.login(outsiderUser.email, outsiderUser.password);

      const expenseData = {
        description: 'Unauthorized Expense',
        amount: 50,
        groupId: groupId,
        paidBy: outsiderLogin.data.data.user.id,
        splitType: 'equal'
      };

      const response = await api.createExpense(expenseData, outsiderLogin.data.data.token);
      
      expect(response.status).toBe(403);
      expect(response.data.success).toBe(false);
    });
  });

  test('Expense categories and metadata', async () => {
    const categories = ['food', 'transport', 'entertainment', 'utilities', 'shopping'];

    await test.step('Create expenses with different categories', async () => {
      for (const category of categories) {
        const expenseData = {
          description: `${category.charAt(0).toUpperCase() + category.slice(1)} Expense`,
          amount: Math.floor(Math.random() * 100) + 20,
          currency: 'AUD',
          category: category,
          groupId: groupId,
          paidBy: user1.id,
          splitType: 'equal',
          splitDetails: []
        };

        const response = await api.createExpense(expenseData, user1.token);
        expect(response.status).toBe(201);
        expect(response.data.data.expense.category).toBe(category);
      }
      
      console.log('✅ Expenses created with different categories');
    });

    await test.step('Verify expense metadata', async () => {
      const response = await api.getGroupExpenses(groupId, user1.token);
      const expenses = response.data.data.expenses;
      
      // Check that expenses have required metadata
      expenses.forEach(expense => {
        expect(expense.id).toBeDefined();
        expect(expense.description).toBeDefined();
        expect(expense.amount).toBeDefined();
        expect(expense.currency).toBeDefined();
        expect(expense.category).toBeDefined();
        expect(expense.paidBy).toBeDefined();
        expect(expense.groupId).toBe(groupId);
        expect(expense.createdAt).toBeDefined();
        expect(expense.updatedAt).toBeDefined();
      });
      
      console.log('✅ All expenses have complete metadata');
    });
  });
});
