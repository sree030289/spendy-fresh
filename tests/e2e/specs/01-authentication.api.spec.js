const { test, expect } = require('@playwright/test');
const { generateTestUser, SpendyApiHelper } = require('../helpers/api-helpers');

test.describe('Authentication Flow', () => {
  let testUser;

  test.beforeEach(async () => {
    testUser = generateTestUser('auth');
  });

  test('Complete authentication flow: register → login → profile', async ({ request }) => {
    const api = new SpendyApiHelper(request);
    
    // Step 1: Register new user
    console.log('Step 1: Register new user');
    const registerResponse = await api.register(testUser);
    
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.data.success).toBe(true);
    expect(registerResponse.data.data.token).toBeDefined();
    expect(registerResponse.data.data.user.email).toBe(testUser.email);
    expect(registerResponse.data.data.user.fullName).toBe(testUser.fullName);
    
    console.log('✅ User registered successfully:', registerResponse.data.data.user.id);

    // Step 2: Login with credentials
    console.log('Step 2: Login with credentials');
    const loginResponse = await api.login(testUser.email, testUser.password);
      
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.data.success).toBe(true);
    expect(loginResponse.data.data.token).toBeDefined();
    expect(loginResponse.data.data.user.email).toBe(testUser.email);
    
    testUser.token = loginResponse.data.data.token;
    testUser.id = loginResponse.data.data.user.id;
    
    console.log('✅ User logged in successfully:', testUser.id);

    // Step 3: Get user profile
    console.log('Step 3: Get user profile');
    const profileResponse = await api.getProfile(testUser.token);
    
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.data.success).toBe(true);
    expect(profileResponse.data.data.user.email).toBe(testUser.email);
    expect(profileResponse.data.data.user.fullName).toBe(testUser.fullName);
    
    console.log('✅ Profile retrieved successfully');
  });

  test('Registration validation - Missing email', async ({ request }) => {
    const api = new SpendyApiHelper(request);
    const invalidUser = { ...testUser };
    delete invalidUser.email;
    
    const response = await api.register(invalidUser);
    expect(response.status).toBe(400);
    expect(response.data.success).toBe(false);
  });

  test('Registration validation - Missing password', async ({ request }) => {
    const api = new SpendyApiHelper(request);
    const invalidUser = { ...testUser };
    delete invalidUser.password;
    
    const response = await api.register(invalidUser);
    expect(response.status).toBe(400);
    expect(response.data.success).toBe(false);
  });

  test('Registration validation - Short password', async ({ request }) => {
    const api = new SpendyApiHelper(request);
    const invalidUser = { ...testUser, password: '123' };
    
    const response = await api.register(invalidUser);
    expect(response.status).toBe(400);
    expect(response.data.success).toBe(false);
  });

  test('Login validation - Invalid email', async ({ request }) => {
    const api = new SpendyApiHelper(request);
    
    // Register user first
    await api.register(testUser);

    const response = await api.login('nonexistent@test.com', testUser.password);
    expect(response.status).toBe(401);
    expect(response.data.success).toBe(false);
  });

  test('Login validation - Invalid password', async ({ request }) => {
    const api = new SpendyApiHelper(request);
    
    // Register user first
    await api.register(testUser);

    const response = await api.login(testUser.email, 'wrongpassword');
    expect(response.status).toBe(401);
    expect(response.data.success).toBe(false);
  });

  test('Profile access without token', async ({ request }) => {
    const api = new SpendyApiHelper(request);
    
    const response = await api.getProfile(null);
    expect(response.status).toBe(401);
    expect(response.data.success).toBe(false);
  });

  test('Profile access with invalid token', async ({ request }) => {
    const api = new SpendyApiHelper(request);
    
    const response = await api.getProfile('invalid-token');
    expect(response.status).toBe(401);
    expect(response.data.success).toBe(false);
  });
});
