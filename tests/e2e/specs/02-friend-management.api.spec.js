const { test, expect } = require('@playwright/test');
const { generateTestUser, SpendyApiHelper } = require('../helpers/api-helpers');

test.describe('Friend Management Flow', () => {
  let api;
  let user1, user2;

  test.beforeEach(async ({ request }) => {
    api = new SpendyApiHelper(request);
    user1 = generateTestUser('user1');
    user2 = generateTestUser('user2');

    // Register and login both users
    await api.register(user1);
    const login1 = await api.login(user1.email, user1.password);
    user1.token = login1.data.data.token;
    user1.id = login1.data.data.user.id;

    await api.register(user2);
    const login2 = await api.login(user2.email, user2.password);
    user2.token = login2.data.data.token;
    user2.id = login2.data.data.user.id;
  });

  test('Complete friend management flow', async () => {
    let friendRequestId;

    // Step 1: User1 searches for User2
    await test.step('Search for friends', async () => {
      const response = await api.searchFriends(user2.email, user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.length).toBe(1);
      expect(response.data.data[0].email).toBe(user2.email);
      
      console.log('✅ Friend search successful');
    });

    // Step 2: User1 sends friend request to User2
    await test.step('Send friend request', async () => {
      const response = await api.sendFriendRequest(
        user2.email, 
        'Hey! Let\'s be friends on Spendy!', 
        user1.token
      );
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      
      console.log('✅ Friend request sent successfully');
    });

    // Step 3: User2 checks incoming friend requests
    await test.step('Check incoming friend requests', async () => {
      const response = await api.getFriendRequests(user2.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.incoming.length).toBe(1);
      
      const request = response.data.data.incoming[0];
      expect(request.fromUser.email).toBe(user1.email);
      expect(request.message).toBe('Hey! Let\'s be friends on Spendy!');
      
      friendRequestId = request.id;
      console.log('✅ Incoming friend request found:', friendRequestId);
    });

    // Step 4: User1 checks outgoing friend requests
    await test.step('Check outgoing friend requests', async () => {
      const response = await api.getFriendRequests(user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.outgoing.length).toBe(1);
      
      console.log('✅ Outgoing friend request confirmed');
    });

    // Step 5: User2 accepts friend request
    await test.step('Accept friend request', async () => {
      const response = await api.acceptFriendRequest(friendRequestId, user2.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      console.log('✅ Friend request accepted');
    });

    // Step 6: Both users check friends list
    await test.step('Verify friendship - User1 perspective', async () => {
      const response = await api.getFriends(user1.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.friends.length).toBe(1);
      expect(response.data.data.friends[0].email).toBe(user2.email);
      
      console.log('✅ User1 friends list verified');
    });

    await test.step('Verify friendship - User2 perspective', async () => {
      const response = await api.getFriends(user2.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.friends.length).toBe(1);
      expect(response.data.data.friends[0].email).toBe(user1.email);
      
      console.log('✅ User2 friends list verified');
    });

    // Step 7: Verify no pending requests remain
    await test.step('Verify no pending requests', async () => {
      const response1 = await api.getFriendRequests(user1.token);
      const response2 = await api.getFriendRequests(user2.token);
      
      expect(response1.data.data.outgoing.length).toBe(0);
      expect(response2.data.data.incoming.length).toBe(0);
      
      console.log('✅ No pending requests remain');
    });
  });

  test('Friend request decline flow', async () => {
    let friendRequestId;

    // Send friend request
    await api.sendFriendRequest(user2.email, 'Test decline', user1.token);

    // Get the request ID
    const requestsResponse = await api.getFriendRequests(user2.token);
    friendRequestId = requestsResponse.data.data.incoming[0].id;

    // Decline the request
    await test.step('Decline friend request', async () => {
      const response = await api.declineFriendRequest(friendRequestId, user2.token);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      console.log('✅ Friend request declined');
    });

    // Verify no friendship created
    await test.step('Verify no friendship created', async () => {
      const friends1 = await api.getFriends(user1.token);
      const friends2 = await api.getFriends(user2.token);
      
      expect(friends1.data.data.friends.length).toBe(0);
      expect(friends2.data.data.friends.length).toBe(0);
      
      console.log('✅ No friendship created after decline');
    });
  });

  test('Duplicate friend request prevention', async () => {
    // Send first request
    const response1 = await api.sendFriendRequest(user2.email, 'First request', user1.token);
    expect(response1.status).toBe(201);

    // Try to send duplicate request
    await test.step('Prevent duplicate friend request', async () => {
      const response2 = await api.sendFriendRequest(user2.email, 'Duplicate request', user1.token);
      
      expect(response2.status).toBe(200);
      expect(response2.data.success).toBe(false);
      expect(response2.data.message).toContain('already sent');
      
      console.log('✅ Duplicate request prevention working');
    });
  });

  test('Friend request to non-existent user', async () => {
    await test.step('Send request to non-existent user', async () => {
      const response = await api.sendFriendRequest('nonexistent@test.com', 'Test', user1.token);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.isNewUser).toBe(true);
      
      console.log('✅ New user invitation created');
    });
  });

  test('Friend request validation', async () => {
    await test.step('Missing email', async () => {
      const response = await api.sendFriendRequest('', 'Test', user1.token);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });

    await test.step('Invalid request ID for accept', async () => {
      const response = await api.acceptFriendRequest('invalid-id', user2.token);
      
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });

    await test.step('Invalid request ID for decline', async () => {
      const response = await api.declineFriendRequest('invalid-id', user2.token);
      
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });
});
