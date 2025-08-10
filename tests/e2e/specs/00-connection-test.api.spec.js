const { test, expect } = require('@playwright/test');

test.describe('API Connection Test', () => {
  test('Basic connection test', async ({ request }) => {
    console.log('🔍 Testing basic API connection...');
    
    // Test health endpoint with absolute URL
    const response = await request.get('http://127.0.0.1:5001/spendy-97913/us-central1/spendyApi/health');
    console.log('📊 Health endpoint status:', response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      console.log('✅ Health response:', data.message);
    }
    
    expect(response.status()).toBe(200);
  });

  test('Registration endpoint test', async ({ request }) => {
    console.log('🔍 Testing registration endpoint...');
    
    const userData = {
      email: `playwright_${Date.now()}@example.com`,
      password: 'testpass123',
      fullName: 'Playwright Test User',
      country: 'AU',
      currency: 'AUD'
    };
    
    const response = await request.post('http://127.0.0.1:5001/spendy-97913/us-central1/spendyApi/auth/register', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: userData
    });
    
    console.log('📊 Register endpoint status:', response.status());
    
    if (response.status() === 201) {
      const data = await response.json();
      console.log('✅ Registration successful:', data.message);
      console.log('🔑 Token received:', !!data.data.token);
    } else {
      const errorData = await response.json();
      console.log('❌ Registration failed:', errorData.message);
    }
    
    expect(response.status()).toBe(201);
  });
});
