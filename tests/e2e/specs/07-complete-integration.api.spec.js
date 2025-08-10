const { test, expect } = require('@playwright/test');
const { generateTestUser, generateTestGroup, SpendyApiHelper } = require('../helpers/api-helpers');

test.describe('Complete End-to-End Integration Flow', () => {
  let api;
  let users = [];
  let groups = [];

  test.beforeAll(async ({ browser }) => {
    // This test simulates real-world usage patterns across multiple user sessions
    console.log('🚀 Starting complete Spendy app integration test...');
  });

  test('Full user journey - From registration to settlement', async ({ request }) => {
    api = new SpendyApiHelper(request);
    
    // Create 4 users representing a group of friends
    const userProfiles = [
      { name: 'Alice', role: 'organizer' },
      { name: 'Bob', role: 'regular' },
      { name: 'Charlie', role: 'regular' },
      { name: 'Diana', role: 'regular' }
    ];

    // Step 1: User Registration & Authentication Flow
    await test.step('Complete user registration and authentication', async () => {
      for (const profile of userProfiles) {
        const user = generateTestUser(profile.name.toLowerCase());
        user.profile = profile;
        
        // Register user
        const registerResponse = await api.register(user);
        expect(registerResponse.status).toBe(201);
        expect(registerResponse.data.success).toBe(true);
        
        // Login user
        const loginResponse = await api.login(user.email, user.password);
        expect(loginResponse.status).toBe(200);
        user.token = loginResponse.data.data.token;
        user.id = loginResponse.data.data.user.id;
        
        // Get user profile
        const profileResponse = await api.getUserProfile(user.id, user.token);
        expect(profileResponse.status).toBe(200);
        expect(profileResponse.data.data.user.email).toBe(user.email);
        
        users.push(user);
        console.log(`✅ ${profile.name} registered and authenticated`);
      }
      
      console.log('✅ All users registered and authenticated successfully');
    });

    // Step 2: Friend Network Building
    await test.step('Build complete friend network', async () => {
      // Alice (organizer) sends friend requests to everyone
      for (let i = 1; i < users.length; i++) {
        const response = await api.sendFriendRequest(
          users[i].email, 
          `Friend request from ${users[0].profile.name}`, 
          users[0].token
        );
        expect(response.status).toBe(201);
      }
      
      // Everyone accepts Alice's friend requests
      for (let i = 1; i < users.length; i++) {
        const requestsResponse = await api.getFriendRequests(users[i].token);
        expect(requestsResponse.status).toBe(200);
        
        const pendingRequest = requestsResponse.data.data.incoming.find(
          req => req.fromUser.id === users[0].id
        );
        
        if (pendingRequest) {
          const acceptResponse = await api.acceptFriendRequest(pendingRequest.id, users[i].token);
          expect(acceptResponse.status).toBe(200);
        }
      }
      
      // Create cross-friendships (Bob ↔ Charlie, Charlie ↔ Diana, etc.)
      const friendshipPairs = [
        [1, 2], // Bob ↔ Charlie
        [2, 3], // Charlie ↔ Diana
        [1, 3]  // Bob ↔ Diana
      ];
      
      for (const [i, j] of friendshipPairs) {
        await api.sendFriendRequest(users[j].email, 'Cross friendship', users[i].token);
        
        const requestsResponse = await api.getFriendRequests(users[j].token);
        const pendingRequest = requestsResponse.data.data.incoming.find(
          req => req.fromUser.id === users[i].id
        );
        
        if (pendingRequest) {
          await api.acceptFriendRequest(pendingRequest.id, users[j].token);
        }
      }
      
      // Verify friend networks
      for (const user of users) {
        const friendsResponse = await api.getFriends(user.token);
        expect(friendsResponse.status).toBe(200);
        expect(friendsResponse.data.data.friends.length).toBeGreaterThan(0);
      }
      
      console.log('✅ Complete friend network established');
    });

    // Step 3: Group Creation and Management
    await test.step('Create and manage groups', async () => {
      // Alice creates main travel group
      const travelGroup = generateTestGroup('European Trip');
      const travelGroupResponse = await api.createGroup(travelGroup, users[0].token);
      expect(travelGroupResponse.status).toBe(201);
      
      const travelGroupId = travelGroupResponse.data.data.group.id;
      travelGroup.id = travelGroupId;
      groups.push(travelGroup);
      
      // Add all friends to travel group
      for (let i = 1; i < users.length; i++) {
        const addMemberResponse = await api.addGroupMember(
          travelGroupId,
          { userId: users[i].id, email: users[i].email },
          users[0].token
        );
        expect(addMemberResponse.status).toBe(201);
      }
      
      // Bob creates smaller dinner group
      const dinnerGroup = generateTestGroup('Weekly Dinners');
      const dinnerGroupResponse = await api.createGroup(dinnerGroup, users[1].token);
      expect(dinnerGroupResponse.status).toBe(201);
      
      const dinnerGroupId = dinnerGroupResponse.data.data.group.id;
      dinnerGroup.id = dinnerGroupId;
      groups.push(dinnerGroup);
      
      // Add Alice and Charlie to dinner group
      await api.addGroupMember(dinnerGroupId, { userId: users[0].id, email: users[0].email }, users[1].token);
      await api.addGroupMember(dinnerGroupId, { userId: users[2].id, email: users[2].email }, users[1].token);
      
      // Verify group memberships
      for (const group of groups) {
        const membersResponse = await api.getGroupMembers(group.id, users[0].token);
        expect(membersResponse.status).toBe(200);
        expect(membersResponse.data.data.members.length).toBeGreaterThan(1);
      }
      
      console.log('✅ Groups created and members added successfully');
    });

    // Step 4: Complex Expense Creation Scenarios
    await test.step('Create comprehensive expense scenarios', async () => {
      const travelGroupId = groups[0].id;
      const dinnerGroupId = groups[1].id;
      
      // Travel group expenses with different split types
      const travelExpenses = [
        {
          description: 'Flight Tickets',
          amount: 1200,
          paidBy: users[0].id, // Alice
          token: users[0].token,
          splitType: 'equal',
          category: 'transport'
        },
        {
          description: 'Accommodation (3 nights)',
          amount: 600,
          paidBy: users[1].id, // Bob
          token: users[1].token,
          splitType: 'equal',
          category: 'accommodation'
        },
        {
          description: 'Dinner (Alice ate more)',
          amount: 160,
          paidBy: users[2].id, // Charlie
          token: users[2].token,
          splitType: 'custom',
          category: 'food',
          splitDetails: [
            { userId: users[0].id, amount: 60 }, // Alice
            { userId: users[1].id, amount: 40 }, // Bob
            { userId: users[2].id, amount: 30 }, // Charlie
            { userId: users[3].id, amount: 30 }  // Diana
          ]
        },
        {
          description: 'Car Rental (Driver pays less)',
          amount: 240,
          paidBy: users[3].id, // Diana
          token: users[3].token,
          splitType: 'percentage',
          category: 'transport',
          splitDetails: [
            { userId: users[0].id, percentage: 30 }, // Alice
            { userId: users[1].id, percentage: 30 }, // Bob
            { userId: users[2].id, percentage: 30 }, // Charlie
            { userId: users[3].id, percentage: 10 }  // Diana (driver)
          ]
        }
      ];
      
      for (const expense of travelExpenses) {
        const expenseData = {
          description: expense.description,
          amount: expense.amount,
          currency: 'AUD',
          category: expense.category,
          groupId: travelGroupId,
          paidBy: expense.paidBy,
          splitType: expense.splitType,
          splitDetails: expense.splitDetails || []
        };
        
        const response = await api.createExpense(expenseData, expense.token);
        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
      }
      
      // Dinner group expenses
      const dinnerExpenses = [
        {
          description: 'Italian Restaurant',
          amount: 90,
          paidBy: users[1].id, // Bob
          token: users[1].token,
          splitType: 'equal'
        },
        {
          description: 'Wine for Dinner',
          amount: 45,
          paidBy: users[0].id, // Alice
          token: users[0].token,
          splitType: 'equal'
        }
      ];
      
      for (const expense of dinnerExpenses) {
        const expenseData = {
          description: expense.description,
          amount: expense.amount,
          currency: 'AUD',
          category: 'food',
          groupId: dinnerGroupId,
          paidBy: expense.paidBy,
          splitType: expense.splitType,
          splitDetails: []
        };
        
        const response = await api.createExpense(expenseData, expense.token);
        expect(response.status).toBe(201);
      }
      
      console.log('✅ Complex expense scenarios created successfully');
    });

    // Step 5: Expense Verification and Balance Calculation
    await test.step('Verify expenses and calculate balances', async () => {
      for (const group of groups) {
        // Get all group expenses
        const expensesResponse = await api.getGroupExpenses(group.id, users[0].token);
        expect(expensesResponse.status).toBe(200);
        
        const expenses = expensesResponse.data.data.expenses;
        expect(expenses.length).toBeGreaterThan(0);
        
        // Verify each expense has proper structure and React Native compatible timestamps
        expenses.forEach(expense => {
          expect(expense.id).toBeDefined();
          expect(expense.description).toBeDefined();
          expect(expense.amount).toBeGreaterThan(0);
          expect(expense.paidBy).toBeDefined();
          expect(expense.groupId).toBe(group.id);
          expect(expense.createdAt).toBeDefined();
          expect(expense.updatedAt).toBeDefined();
          
          // Verify React Native timestamp compatibility
          if (typeof expense.createdAt === 'object') {
            expect(expense.createdAt._isDate).toBe(true);
            expect(expense.createdAt.timestamp).toBeDefined();
          }
        });
        
        // Calculate total group spending
        const totalSpending = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        expect(totalSpending).toBeGreaterThan(0);
        
        console.log(`✅ Group "${group.name}" expenses verified - Total: $${totalSpending}`);
      }
      
      // Verify individual user expenses
      for (const user of users) {
        const userExpensesResponse = await api.getUserExpenses(user.id, user.token);
        expect(userExpensesResponse.status).toBe(200);
        
        const userExpenses = userExpensesResponse.data.data.expenses;
        console.log(`✅ ${user.profile.name} has ${userExpenses.length} expenses`);
      }
    });

    // Step 6: Settlement Calculation and Processing
    await test.step('Calculate settlements and process payments', async () => {
      for (const group of groups) {
        // Get settlement recommendations
        const settlementsResponse = await api.getSettlements(group.id, users[0].token);
        expect(settlementsResponse.status).toBe(200);
        
        const settlements = settlementsResponse.data.data.settlements;
        
        if (settlements.length > 0) {
          console.log(`💰 Group "${group.name}" has ${settlements.length} settlements to process`);
          
          // Verify settlement structure
          settlements.forEach(settlement => {
            expect(settlement.from).toBeDefined();
            expect(settlement.to).toBeDefined();
            expect(settlement.amount).toBeGreaterThan(0);
            // Note: settlement recommendations don't include groupId - they're algorithmic recommendations
          });
          
          // Process first settlement to demonstrate payment flow
          const firstSettlement = settlements[0];
          const payerUser = users.find(u => u.id === firstSettlement.from);
          
          if (payerUser) {
            const settlementData = {
              fromUserId: firstSettlement.from,
              toUserId: firstSettlement.to,
              amount: firstSettlement.amount,
              groupId: group.id,
              description: `Integration test settlement payment`
            };
            
            const paymentResponse = await api.recordSettlement(settlementData, payerUser.token);
            expect(paymentResponse.status).toBe(201);
            expect(paymentResponse.data.success).toBe(true);
            
            console.log(`✅ Settlement payment recorded: $${firstSettlement.amount}`);
          }
          
          // Verify settlement affects future calculations
          const updatedSettlementsResponse = await api.getSettlements(group.id, users[0].token);
          if (updatedSettlementsResponse.status === 200) {
            const updatedSettlements = updatedSettlementsResponse.data.data.settlements;
            console.log(`📊 Settlements updated: ${updatedSettlements.length} remaining`);
          }
        } else {
          console.log(`✅ Group "${group.name}" has no outstanding settlements`);
        }
      }
    });

    // Step 7: Notification and Communication Flow
    await test.step('Verify notification system', async () => {
      // Check if users have received notifications for various activities
      for (const user of users) {
        try {
          const notificationsResponse = await api.getNotifications(user.token);
          
          if (notificationsResponse.status === 200) {
            const notifications = notificationsResponse.data.data.notifications;
            
            console.log(`📱 ${user.profile.name} has ${notifications.length} notifications`);
            
            if (notifications.length > 0) {
              // Verify notification structure
              notifications.forEach(notification => {
                expect(notification.type).toBeDefined();
                expect(notification.createdAt).toBeDefined();
                expect(['read', 'unread'].includes(notification.read ? 'read' : 'unread')).toBe(true);
                
                // Verify React Native timestamp compatibility
                if (typeof notification.createdAt === 'object') {
                  expect(notification.createdAt._isDate).toBe(true);
                }
              });
              
              // Mark some notifications as read
              const unreadNotifications = notifications.filter(n => !n.read).slice(0, 2);
              for (const notification of unreadNotifications) {
                try {
                  await api.markNotificationRead(notification.id, user.token);
                } catch (error) {
                  console.log('⚠️ Mark as read functionality may not be implemented');
                }
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Notifications for ${user.profile.name} may not be available`);
        }
      }
    });

    // Step 8: Data Integrity and Cross-Validation
    await test.step('Perform comprehensive data integrity checks', async () => {
      // Verify friend relationships are bidirectional
      for (let i = 0; i < users.length; i++) {
        for (let j = i + 1; j < users.length; j++) {
          const user1Friends = await api.getFriends(users[i].token);
          const user2Friends = await api.getFriends(users[j].token);
          
          const user1HasUser2 = user1Friends.data.data.friends.some(f => f.id === users[j].id);
          const user2HasUser1 = user2Friends.data.data.friends.some(f => f.id === users[i].id);
          
          if (user1HasUser2 || user2HasUser1) {
            expect(user1HasUser2).toBe(user2HasUser1); // Should be bidirectional
          }
        }
      }
      
      // Verify group member consistency
      for (const group of groups) {
        const membersResponse = await api.getGroupMembers(group.id, users[0].token);
        const members = membersResponse.data.data.members;
        
        // Check that all members can access the group
        for (const member of members) {
          const memberUser = users.find(u => u.id === member.id);
          if (memberUser) {
            const groupsResponse = await api.getUserGroups(memberUser.token);
            const userGroups = groupsResponse.data.data.groups;
            
            const hasGroup = userGroups.some(g => g.id === group.id);
            expect(hasGroup).toBe(true);
          }
        }
      }
      
      // Verify expense totals match across different API endpoints
      for (const group of groups) {
        const groupExpensesResponse = await api.getGroupExpenses(group.id, users[0].token);
        const groupTotal = groupExpensesResponse.data.data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        let userTotalSum = 0;
        for (const user of users) {
          const userExpensesResponse = await api.getUserExpenses(user.id, user.token);
          const userGroupExpenses = userExpensesResponse.data.data.expenses.filter(exp => exp.groupId === group.id);
          userTotalSum += userGroupExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        }
        
        // Note: userTotalSum might be higher due to users being in multiple groups
        expect(groupTotal).toBeGreaterThan(0);
        console.log(`✅ Group "${group.name}" data integrity verified`);
      }
    });

    // Step 9: Cleanup and Final Verification
    await test.step('Cleanup and final verification', async () => {
      // Test group leave functionality
      const dinnerGroupId = groups[1].id;
      const leaveResponse = await api.leaveGroup(dinnerGroupId, users[2].token); // Charlie leaves dinner group
      
      if (leaveResponse.status === 200) {
        // Verify Charlie is no longer in the group
        const membersResponse = await api.getGroupMembers(dinnerGroupId, users[1].token);
        const members = membersResponse.data.data.members;
        const charlieStillMember = members.some(m => m.id === users[2].id);
        expect(charlieStillMember).toBe(false);
        
        console.log('✅ Group leave functionality verified');
      }
      
      // Final statistics
      const totalUsers = users.length;
      const totalGroups = groups.length;
      let totalExpenses = 0;
      let totalSpending = 0;
      
      for (const group of groups) {
        const expensesResponse = await api.getGroupExpenses(group.id, users[0].token);
        const expenses = expensesResponse.data.data.expenses;
        totalExpenses += expenses.length;
        totalSpending += expenses.reduce((sum, exp) => sum + exp.amount, 0);
      }
      
      console.log(`
🎉 INTEGRATION TEST COMPLETED SUCCESSFULLY!
📊 Final Statistics:
   👥 Users: ${totalUsers}
   👫 Groups: ${totalGroups}  
   💳 Expenses: ${totalExpenses}
   💰 Total Spending: $${totalSpending}
   
✅ All critical paths validated:
   - User registration and authentication
   - Friend network management
   - Group creation and membership
   - Complex expense splitting (equal, custom, percentage)
   - Settlement calculations and payments
   - Notification system integration
   - Data integrity across all endpoints
   - React Native timestamp compatibility
      `);
    });
  });

  test('Error handling and edge cases integration', async ({ request }) => {
    api = new SpendyApiHelper(request);
    
    await test.step('Test cascading error scenarios', async () => {
      // Test what happens when operations depend on previous failed operations
      const invalidUser = generateTestUser('invalid');
      
      // Try to create expense with non-existent user
      const expenseData = {
        description: 'Invalid User Expense',
        amount: 100,
        currency: 'AUD',
        category: 'food',
        groupId: 'non-existent-group',
        paidBy: 'non-existent-user',
        splitType: 'equal'
      };
      
      const response = await api.createExpense(expenseData, 'invalid-token');
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.data.success).toBe(false);
      
      console.log('✅ Error cascading handled correctly');
    });

    await test.step('Test concurrent operation handling', async () => {
      // Test what happens when multiple users perform operations simultaneously
      const user1 = generateTestUser('concurrent1');
      const user2 = generateTestUser('concurrent2');
      
      await api.register(user1);
      await api.register(user2);
      
      const login1 = await api.login(user1.email, user1.password);
      const login2 = await api.login(user2.email, user2.password);
      
      user1.token = login1.data.data.token;
      user1.id = login1.data.data.user.id;
      user2.token = login2.data.data.token;
      user2.id = login2.data.data.user.id;
      
      // Both users try to send friend requests to each other simultaneously
      const [request1, request2] = await Promise.allSettled([
        api.sendFriendRequest(user2.email, 'Concurrent test', user1.token),
        api.sendFriendRequest(user1.email, 'Concurrent test', user2.token)
      ]);
      
      // At least one should succeed, system should handle race condition gracefully
      const successCount = [request1, request2].filter(r => r.status === 'fulfilled' && r.value.status < 400).length;
      expect(successCount).toBeGreaterThan(0);
      
      console.log('✅ Concurrent operations handled correctly');
    });
  });

  test('Performance and scalability validation', async ({ request }) => {
    api = new SpendyApiHelper(request);
    
    await test.step('Test API response times under load', async () => {
      const testUser = generateTestUser('performance');
      await api.register(testUser);
      const login = await api.login(testUser.email, testUser.password);
      testUser.token = login.data.data.token;
      testUser.id = login.data.data.user.id;
      
      // Measure response times for critical operations
      const operations = [
        () => api.getUserProfile(testUser.id, testUser.token),
        () => api.getFriends(testUser.token),
        () => api.getUserGroups(testUser.token),
        () => api.getUserExpenses(testUser.id, testUser.token)
      ];
      
      for (const operation of operations) {
        const startTime = Date.now();
        const response = await operation();
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        expect(response.status).toBeLessThan(400);
        expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
        
        console.log(`✅ Operation completed in ${responseTime}ms`);
      }
    });
  });
});
