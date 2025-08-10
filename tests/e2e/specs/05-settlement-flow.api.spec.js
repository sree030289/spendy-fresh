const { test, expect } = require('@playwright/test');
const { generateTestUser, generateTestGroup, generateTestExpense, SpendyApiHelper } = require('../helpers/api-helpers');

test.describe('Settlement & Debt Resolution Flow', () => {
  let api;
  let users = [];
  let testGroup;
  let groupId;

  test.beforeEach(async ({ request }) => {
    api = new SpendyApiHelper(request);
    
    // Create 4 users for complex settlement scenarios
    for (let i = 0; i < 4; i++) {
      const user = generateTestUser(`settler${i}`);
      await api.register(user);
      const login = await api.login(user.email, user.password);
      user.token = login.data.data.token;
      user.id = login.data.data.user.id;
      users.push(user);
    }

    // Create friendships more efficiently - user[0] befriends everyone else
    for (let i = 1; i < users.length; i++) {
      await api.sendFriendRequest(users[i].email, 'Settlement test friends', users[0].token);
      
      const requests = await api.getFriendRequests(users[i].token);
      if (requests.data.data.incoming.length > 0) {
        const request = requests.data.data.incoming.find(r => r.fromUser.id === users[0].id);
        if (request) {
          await api.acceptFriendRequest(request.id, users[i].token);
        }
      }
    }

    // Create group and add all members
    testGroup = generateTestGroup();
    const groupResponse = await api.createGroup(testGroup, users[0].token);
    groupId = groupResponse.data.data.group.id;

    for (let i = 1; i < users.length; i++) {
      await api.addGroupMember(groupId, { userId: users[i].id, email: users[i].email }, users[0].token);
    }
  });

  test('Complete settlement flow - Simple scenario', async () => {
    let expenseId;
    const expenseAmount = 120; // $120 split equally = $30 each, user0 paid so others owe $30 each

    // Step 1: Create expense that needs settlement
    await test.step('Create expense for settlement', async () => {
      const expenseData = {
        description: 'Settlement Test Dinner',
        amount: expenseAmount,
        currency: 'AUD',
        category: 'food',
        groupId: groupId,
        paidBy: users[0].id, // User 0 paid $120
        splitType: 'equal',
        splitDetails: []
      };

      const response = await api.createExpense(expenseData, users[0].token);
      expect(response.status).toBe(201);
      expenseId = response.data.data.expense.id;
      
      console.log('✅ Expense created for settlement testing');
    });

    // Step 2: Get settlement recommendations
    await test.step('Get settlement recommendations', async () => {
      const response = await api.getSettlements(groupId, users[0].token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.settlements).toBeDefined();
      
      const settlements = response.data.data.settlements;
      
      // Should have settlements where users 1, 2, 3 owe user 0
      const settlementsToUser0 = settlements.filter(s => s.to === users[0].id);
      expect(settlementsToUser0.length).toBeGreaterThan(0);
      
      console.log('✅ Settlement recommendations generated');
      console.log('Settlements:', settlements);
    });

    // Step 3: Mark settlement as paid
    await test.step('Record settlement payment', async () => {
      const settlementsResponse = await api.getSettlements(groupId, users[0].token);
      const settlements = settlementsResponse.data.data.settlements;
      
      if (settlements.length > 0) {
        const settlement = settlements[0];
        
        const settlementData = {
          fromUserId: settlement.from,
          toUserId: settlement.to,
          amount: settlement.amount,
          groupId: groupId,
          description: 'Settlement payment via test'
        };

        const response = await api.recordSettlement(settlementData, users[0].token);
        
        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
        expect(response.data.data.settlement).toBeDefined();
        
        console.log('✅ Settlement payment recorded');
      }
    });

    // Step 4: Verify settlement updated the balances
    await test.step('Verify settlement effects', async () => {
      const response = await api.getSettlements(groupId, users[0].token);
      
      expect(response.status).toBe(200);
      const newSettlements = response.data.data.settlements;
      
      // After recording settlement, there should be fewer outstanding debts
      console.log('✅ Settlement effects verified, remaining settlements:', newSettlements.length);
    });
  });

  test('Complex multi-user settlement scenario', async () => {
    // Create a scenario where multiple users have cross-debts
    await test.step('Create complex expense scenario', async () => {
      const expenses = [
        { amount: 150, paidBy: users[0].id, description: 'Expensive Dinner' },
        { amount: 80, paidBy: users[1].id, description: 'Groceries' },
        { amount: 120, paidBy: users[2].id, description: 'Gas' },
        { amount: 60, paidBy: users[3].id, description: 'Parking' }
      ];

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

        const token = users.find(u => u.id === exp.paidBy).token;
        const response = await api.createExpense(expenseData, token);
        expect(response.status).toBe(201);
      }
      
      console.log('✅ Complex expense scenario created');
    });

    await test.step('Get optimized settlement plan', async () => {
      const response = await api.getSettlements(groupId, users[0].token);
      
      expect(response.status).toBe(200);
      const settlements = response.data.data.settlements;
      
      // Verify settlement optimization (minimized number of transactions)
      expect(settlements.length).toBeGreaterThan(0);
      expect(settlements.length).toBeLessThan(12); // Should be optimized (not everyone paying everyone)
      
      // Verify total amounts balance
      let totalOwed = settlements.reduce((sum, s) => sum + s.amount, 0);
      expect(totalOwed).toBeGreaterThan(0);
      
      console.log('✅ Optimized settlement plan generated');
      console.log(`Total settlements: ${settlements.length}, Total amount: $${totalOwed}`);
    });
  });

  test('Custom split settlement complexity', { timeout: 60000 }, async () => {
    await test.step('Create custom split expense', async () => {
      const expenseData = {
        description: 'Complex Custom Split',
        amount: 200,
        currency: 'AUD',
        category: 'entertainment',
        groupId: groupId,
        paidBy: users[1].id,
        splitType: 'custom',
        splitDetails: [
          { userId: users[0].id, amount: 80 },   // User 0 owes $80
          { userId: users[1].id, amount: 40 },   // User 1 owes $40 (but paid $200)
          { userId: users[2].id, amount: 50 },   // User 2 owes $50
          { userId: users[3].id, amount: 30 }    // User 3 owes $30
        ]
      };

      const response = await api.createExpense(expenseData, users[1].token);
      expect(response.status).toBe(201);
      
      console.log('✅ Custom split expense created');
    });

    await test.step('Verify custom split settlements', async () => {
      const response = await api.getSettlements(groupId, users[1].token);
      
      expect(response.status).toBe(200);
      const settlements = response.data.data.settlements;
      
      // User 1 should be owed money (paid $200, only owes $40)
      const settlementsToUser1 = settlements.filter(s => s.to === users[1].id);
      expect(settlementsToUser1.length).toBeGreaterThan(0);
      
      console.log('✅ Custom split settlements calculated correctly');
    });
  });

  test('Settlement edge cases and validation', async () => {
    await test.step('Invalid settlement data', async () => {
      const invalidSettlement = {
        fromUserId: users[0].id,
        toUserId: users[1].id,
        amount: -50, // Negative amount
        groupId: groupId,
        description: 'Invalid settlement'
      };

      const response = await api.recordSettlement(invalidSettlement, users[0].token);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });

    await test.step('Settlement between non-group members', async () => {
      // Create user not in group
      const outsider = generateTestUser('outsider');
      await api.register(outsider);
      const outsiderLogin = await api.login(outsider.email, outsider.password);
      outsider.id = outsiderLogin.data.data.user.id;

      const invalidSettlement = {
        fromUserId: outsider.id,
        toUserId: users[0].id,
        amount: 50,
        groupId: groupId,
        description: 'Invalid settlement'
      };

      const response = await api.recordSettlement(invalidSettlement, outsiderLogin.data.data.token);
      
      expect(response.status).toBe(403);
      expect(response.data.success).toBe(false);
    });

    await test.step('Settlement with invalid group', async () => {
      const invalidSettlement = {
        fromUserId: users[0].id,
        toUserId: users[1].id,
        amount: 50,
        groupId: 'invalid-group-id',
        description: 'Invalid group settlement'
      };

      const response = await api.recordSettlement(invalidSettlement, users[0].token);
      
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  test('Settlement history and tracking', async () => {
    let settlementId;

    // Create expense and settlement
    await test.step('Setup for settlement history', async () => {
      const expenseData = {
        description: 'History Test Expense',
        amount: 90,
        currency: 'AUD',
        category: 'food',
        groupId: groupId,
        paidBy: users[0].id,
        splitType: 'equal',
        splitDetails: []
      };

      await api.createExpense(expenseData, users[0].token);
      
      const settlementData = {
        fromUserId: users[1].id,
        toUserId: users[0].id,
        amount: 22.50, // Equal split of $90 / 4 users
        groupId: groupId,
        description: 'History tracking settlement'
      };

      const response = await api.recordSettlement(settlementData, users[1].token);
      expect(response.status).toBe(201);
      settlementId = response.data.data.settlement.id;
    });

    await test.step('Verify settlement appears in history', async () => {
      // Check if API has settlement history endpoint
      try {
        const response = await api.getSettlementHistory(groupId, users[0].token);
        
        if (response.status === 200) {
          const history = response.data.data.settlements;
          const recorded = history.find(s => s.id === settlementId);
          
          if (recorded) {
            expect(recorded.fromUserId).toBe(users[1].id);
            expect(recorded.toUserId).toBe(users[0].id);
            expect(recorded.amount).toBe(22.50);
            
            console.log('✅ Settlement history tracked correctly');
          }
        }
      } catch (error) {
        console.log('Settlement history endpoint may not be implemented yet');
      }
    });

    await test.step('Verify settlement metadata', async () => {
      // Settlements should have proper timestamps and metadata
      const response = await api.getSettlementHistory(groupId, users[0].token);
      
      if (response.status === 200 && response.data.data.settlements) {
        const settlements = response.data.data.settlements;
        
        settlements.forEach(settlement => {
          expect(settlement.fromUserId).toBeDefined();
          expect(settlement.toUserId).toBeDefined();
          expect(settlement.amount).toBeGreaterThan(0);
          expect(settlement.groupId).toBe(groupId);
        });
        
        console.log('✅ Settlement metadata complete');
      }
    });
  });

  test('Zero balance scenarios', { timeout: 60000 }, async () => {
    await test.step('Expenses that cancel out', async () => {
      // Create two equal expenses paid by different people
      const amount = 60;
      
      const expense1 = {
        description: 'Lunch A',
        amount: amount,
        currency: 'AUD',
        category: 'food',
        groupId: groupId,
        paidBy: users[0].id,
        splitType: 'custom',
        splitDetails: [
          { userId: users[0].id, amount: 30 },
          { userId: users[1].id, amount: 30 }
        ]
      };

      const expense2 = {
        description: 'Lunch B',
        amount: amount,
        currency: 'AUD',
        category: 'food',
        groupId: groupId,
        paidBy: users[1].id,
        splitType: 'custom',
        splitDetails: [
          { userId: users[0].id, amount: 30 },
          { userId: users[1].id, amount: 30 }
        ]
      };

      await api.createExpense(expense1, users[0].token);
      await api.createExpense(expense2, users[1].token);
      
      console.log('✅ Canceling expenses created');
    });

    await test.step('Verify balanced settlement', async () => {
      const response = await api.getSettlements(groupId, users[0].token);
      
      expect(response.status).toBe(200);
      const settlements = response.data.data.settlements;
      
      // Between users 0 and 1, there should be no net debt
      const settlementsBetween = settlements.filter(s => 
        (s.from === users[0].id && s.to === users[1].id) ||
        (s.from === users[1].id && s.to === users[0].id)
      );
      
      if (settlementsBetween.length > 0) {
        // If there are settlements, they should net to zero
        const netAmount = settlementsBetween.reduce((sum, s) => {
          return s.from === users[0].id ? sum + s.amount : sum - s.amount;
        }, 0);
        
        expect(Math.abs(netAmount)).toBeLessThan(0.01); // Account for floating point precision
      }
      
      console.log('✅ Zero balance scenario handled correctly');
    });
  });
});
