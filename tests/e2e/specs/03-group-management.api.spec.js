const { test, expect } = require('@playwright/test');
const { generateTestUser, generateTestGroup, SpendyApiHelper } = require('../helpers/api-helpers');

test.describe('Group Management Flow', () => {
  let api;
  let user1, user2, user3;
  let testGroup;

  test.beforeEach(async ({ request }) => {
    api = new SpendyApiHelper(request);
    user1 = generateTestUser('groupAdmin');
    user2 = generateTestUser('groupMember1');
    user3 = generateTestUser('groupMember2');
    testGroup = generateTestGroup();

    // Register and login all users
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

    // Make users friends (required for group membership)
    await api.sendFriendRequest(user2.email, 'Friend for group', user1.token);
    await api.sendFriendRequest(user3.email, 'Friend for group', user1.token);
    
    const requests2 = await api.getFriendRequests(user2.token);
    const requests3 = await api.getFriendRequests(user3.token);
    
    if (requests2.data.data.incoming.length > 0) {
      await api.acceptFriendRequest(requests2.data.data.incoming[0].id, user2.token);
    }
    if (requests3.data.data.incoming.length > 0) {
      await api.acceptFriendRequest(requests3.data.data.incoming[0].id, user3.token);
    }
  });

  test('Complete group management flow', async () => {
    let groupId;

    // Step 1: User1 creates a group
    await test.step('Create group', async () => {
      const response = await api.createGroup(testGroup, user1.token);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.group.name).toBe(testGroup.name);
      expect(response.data.data.group.createdBy).toBe(user1.id);
      expect(response.data.data.group.members.length).toBe(1);
      expect(response.data.data.group.members[0].role).toBe('admin');
      
      groupId = response.data.data.group.id;
      testGroup.id = groupId;
      
      console.log('✅ Group created successfully:', groupId);
    });

    // Step 2: Get user groups
    await test.step('Get user groups', async () => {
      const response = await api.getGroups(user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.groups.length).toBeGreaterThanOrEqual(1);
      
      const createdGroup = response.data.data.groups.find(g => g.id === groupId);
      expect(createdGroup).toBeDefined();
      expect(createdGroup.name).toBe(testGroup.name);
      
      console.log('✅ User groups retrieved successfully');
    });

    // Step 3: Get specific group details
    await test.step('Get group details', async () => {
      const response = await api.getGroup(groupId, user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.id).toBe(groupId);
      expect(response.data.name).toBe(testGroup.name);
      expect(response.data.members.length).toBe(1);
      
      console.log('✅ Group details retrieved successfully');
    });

    // Step 4: Add User2 to group
    await test.step('Add member to group', async () => {
      const response = await api.addGroupMember(groupId, {
        userId: user2.id,
        email: user2.email
      }, user1.token);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      
      console.log('✅ Member added to group successfully');
    });

    // Step 5: Verify User2 can see the group
    await test.step('Verify member can see group', async () => {
      const response = await api.getGroups(user2.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const memberGroup = response.data.data.groups.find(g => g.id === groupId);
      expect(memberGroup).toBeDefined();
      expect(memberGroup.name).toBe(testGroup.name);
      
      console.log('✅ Member can see group');
    });

    // Step 6: Add User3 to group
    await test.step('Add second member to group', async () => {
      const response = await api.addGroupMember(groupId, {
        email: user3.email
      }, user1.token);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      
      console.log('✅ Second member added to group');
    });

    // Step 7: Verify group has 3 members
    await test.step('Verify group membership', async () => {
      const response = await api.getGroup(groupId, user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.members.length).toBe(3);
      
      const adminMember = response.data.members.find(m => m.role === 'admin');
      const regularMembers = response.data.members.filter(m => m.role === 'member');
      
      expect(adminMember.userId).toBe(user1.id);
      expect(regularMembers.length).toBe(2);
      
      console.log('✅ Group membership verified - 3 members total');
    });

    // Step 8: User2 leaves group
    await test.step('Member leaves group', async () => {
      const response = await api.leaveGroup(groupId, user2.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      console.log('✅ Member left group successfully');
    });

    // Step 9: Verify User2 no longer has access
    await test.step('Verify member no longer has access', async () => {
      const response = await api.getGroup(groupId, user2.token);
      
      expect(response.status).toBe(403);
      expect(response.data.success).toBe(false);
      
      console.log('✅ Former member no longer has access');
    });

    // Step 10: Verify group now has 2 members
    await test.step('Verify updated membership', async () => {
      const response = await api.getGroup(groupId, user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.members.length).toBe(2);
      
      const activeMembers = response.data.members.filter(m => m.isActive);
      expect(activeMembers.length).toBe(2);
      
      console.log('✅ Group membership updated - 2 active members');
    });
  });

  test('Group creation validation', async () => {
    await test.step('Missing group name', async () => {
      const invalidGroup = { ...testGroup };
      delete invalidGroup.name;
      
      const response = await api.createGroup(invalidGroup, user1.token);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });

    await test.step('Empty group name', async () => {
      const invalidGroup = { ...testGroup, name: '' };
      
      const response = await api.createGroup(invalidGroup, user1.token);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });
  });

  test('Group access permissions', async () => {
    // Create group with user1
    const createResponse = await api.createGroup(testGroup, user1.token);
    const groupId = createResponse.data.data.group.id;

    await test.step('Non-member cannot access group', async () => {
      const response = await api.getGroup(groupId, user2.token);
      
      expect(response.status).toBe(403);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toBe('ACCESS_DENIED');
    });

    await test.step('Invalid group ID', async () => {
      const response = await api.getGroup('invalid-group-id', user1.token);
      
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  test('Group member management permissions', async () => {
    // Create group with user1
    const createResponse = await api.createGroup(testGroup, user1.token);
    const groupId = createResponse.data.data.group.id;

    await test.step('Non-admin cannot add members', async () => {
      // First add user2 as regular member
      await api.addGroupMember(groupId, { userId: user2.id, email: user2.email }, user1.token);
      
      // Try to add user3 using user2's token (non-admin)
      const response = await api.addGroupMember(groupId, {
        userId: user3.id,
        email: user3.email
      }, user2.token);
      
      expect(response.status).toBe(403);
      expect(response.data.success).toBe(false);
    });

    await test.step('Cannot add non-friend to group', async () => {
      // Create a new user who is not friends with user1
      const strangerUser = generateTestUser('stranger');
      await api.register(strangerUser);
      const strangerLogin = await api.login(strangerUser.email, strangerUser.password);
      
      const response = await api.addGroupMember(groupId, {
        userId: strangerLogin.data.data.user.id,
        email: strangerUser.email
      }, user1.token);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });
  });

  test('Multiple groups per user', async () => {
    const group1 = generateTestGroup();
    const group2 = generateTestGroup();

    await test.step('Create multiple groups', async () => {
      const response1 = await api.createGroup(group1, user1.token);
      const response2 = await api.createGroup(group2, user1.token);
      
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      
      group1.id = response1.data.data.group.id;
      group2.id = response2.data.data.group.id;
    });

    await test.step('Verify user sees all groups', async () => {
      const response = await api.getGroups(user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.data.groups.length).toBeGreaterThanOrEqual(2);
      
      const groupIds = response.data.data.groups.map(g => g.id);
      expect(groupIds).toContain(group1.id);
      expect(groupIds).toContain(group2.id);
      
      console.log('✅ User can manage multiple groups');
    });
  });
});
