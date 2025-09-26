/**
 * Quick integration test for unified invite system
 * 
 * This file provides basic test functions to verify the unified invite API endpoints work correctly.
 * Run this in your development environment to test the backend implementation.
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api';
const TEST_AUTH_TOKEN = 'your-test-jwt-token-here'; // Replace with actual token

// Test data
const TEST_USERS = {
  registered: {
    phone: '+1234567890',
    email: 'registered@example.com',
    userId: 'test-user-1'
  },
  unregistered: {
    phone: '+9876543210',
    email: 'unregistered@example.com'
  },
  inviter: {
    userId: 'test-inviter-1',
    name: 'Test Inviter'
  }
};

// Helper function to make authenticated requests
const apiCall = async (method: string, endpoint: string, data?: any) => {
  try {
    const config: any = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error: any) {
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.response?.data || error.message
    };
  }
};

// Test functions
export const testUnifiedInviteAPI = {
  // Test 1: Search users by contact
  async testSearchUsers() {
    console.log('🔍 Testing user search...');
    
    const phoneResult = await apiCall('GET', `/users/search-contact?q=${TEST_USERS.registered.phone}`);
    const emailResult = await apiCall('GET', `/users/search-contact?q=${TEST_USERS.registered.email}`);
    
    console.log('Phone search result:', phoneResult);
    console.log('Email search result:', emailResult);
    
    return { phoneResult, emailResult };
  },

  // Test 2: Create invite to registered user
  async testCreateInviteRegistered() {
    console.log('📧 Testing invite to registered user...');
    
    const result = await apiCall('POST', '/invites/unified', {
      recipientPhone: TEST_USERS.registered.phone,
      message: 'Test friend request!',
      sentVia: 'SMS'
    });
    
    console.log('Create registered invite result:', result);
    return result;
  },

  // Test 3: Create invite to unregistered user
  async testCreateInviteUnregistered() {
    console.log('📧 Testing invite to unregistered user...');
    
    const result = await apiCall('POST', '/invites/unified', {
      recipientPhone: TEST_USERS.unregistered.phone,
      recipientEmail: TEST_USERS.unregistered.email,
      message: 'Join me on Spendy!',
      sentVia: 'SMS'
    });
    
    console.log('Create unregistered invite result:', result);
    return result;
  },

  // Test 4: Find pending invites
  async testFindPendingInvites() {
    console.log('🔍 Testing find pending invites...');
    
    const phoneResult = await apiCall('GET', `/invites/unified/pending?phone=${TEST_USERS.unregistered.phone}`);
    const emailResult = await apiCall('GET', `/invites/unified/pending?email=${TEST_USERS.unregistered.email}`);
    
    console.log('Phone pending invites:', phoneResult);
    console.log('Email pending invites:', emailResult);
    
    return { phoneResult, emailResult };
  },

  // Test 5: Check registration invites
  async testCheckRegistrationInvites() {
    console.log('🎉 Testing registration invite check...');
    
    const result = await apiCall('POST', '/invites/unified/check-registration', {
      userId: 'new-user-123',
      phoneNumber: TEST_USERS.unregistered.phone,
      email: TEST_USERS.unregistered.email
    });
    
    console.log('Registration check result:', result);
    return result;
  },

  // Test 6: Get invite by ID
  async testGetInvite(inviteId: string) {
    console.log(`📄 Testing get invite: ${inviteId}...`);
    
    const result = await apiCall('GET', `/invites/unified/${inviteId}`);
    
    console.log('Get invite result:', result);
    return result;
  },

  // Test 7: Accept invite
  async testAcceptInvite(inviteId: string) {
    console.log(`✅ Testing accept invite: ${inviteId}...`);
    
    const result = await apiCall('POST', `/invites/unified/${inviteId}/accept`);
    
    console.log('Accept invite result:', result);
    return result;
  },

  // Test 8: Decline invite
  async testDeclineInvite(inviteId: string) {
    console.log(`❌ Testing decline invite: ${inviteId}...`);
    
    const result = await apiCall('POST', `/invites/unified/${inviteId}/decline`);
    
    console.log('Decline invite result:', result);
    return result;
  },

  // Test 9: Create friendship
  async testCreateFriendship() {
    console.log('🤝 Testing create friendship...');
    
    const result = await apiCall('POST', '/invites/unified/create-friendship', {
      userId1: 'user-1',
      userId2: 'user-2'
    });
    
    console.log('Create friendship result:', result);
    return result;
  },

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting unified invite API tests...\n');
    
    try {
      // Test 1: Search users
      await this.testSearchUsers();
      
      // Test 2: Create invite to registered user
      const registeredInvite = await this.testCreateInviteRegistered();
      const registeredInviteId = registeredInvite.data?.invite?.id;
      
      // Test 3: Create invite to unregistered user
      const unregisteredInvite = await this.testCreateInviteUnregistered();
      const unregisteredInviteId = unregisteredInvite.data?.invite?.id;
      
      // Test 4: Find pending invites
      await this.testFindPendingInvites();
      
      // Test 5: Check registration invites
      await this.testCheckRegistrationInvites();
      
      // Test 6: Get invite details
      if (registeredInviteId) {
        await this.testGetInvite(registeredInviteId);
      }
      
      // Test 7: Accept invite (if available)
      if (registeredInviteId) {
        await this.testAcceptInvite(registeredInviteId);
      }
      
      // Test 8: Create friendship
      await this.testCreateFriendship();
      
      console.log('\n✅ All tests completed!');
    } catch (error) {
      console.error('\n❌ Test failed:', error);
    }
  }
};

// Health check function
export const testAPIHealth = async () => {
  console.log('🏥 Testing API health...');
  
  try {
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
    console.log('Health check result:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Health check failed:', error.message);
    return null;
  }
};

// Quick test runner
export const quickTest = async () => {
  console.log('⚡ Running quick unified invite API test...\n');
  
  // Check API health
  const health = await testAPIHealth();
  if (!health) {
    console.error('❌ API is not running. Start your server first.');
    return;
  }
  
  // Test user search (no auth required)
  const searchResult = await testUnifiedInviteAPI.testSearchUsers();
  
  console.log('\n📋 Quick test summary:');
  console.log('- API health:', health.success ? '✅' : '❌');
  console.log('- User search:', searchResult.phoneResult.success ? '✅' : '❌');
  
  if (!TEST_AUTH_TOKEN.includes('your-test')) {
    // Test invite creation if token is provided
    const inviteResult = await testUnifiedInviteAPI.testCreateInviteUnregistered();
    console.log('- Create invite:', inviteResult.success ? '✅' : '❌');
  } else {
    console.log('- Create invite: ⚠️  Skipped (no auth token)');
  }
};

// Export test runner for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testUnifiedInviteAPI,
    testAPIHealth,
    quickTest
  };
}

// Usage instructions
console.log(`
📚 Unified Invite API Test Usage:

1. Update TEST_AUTH_TOKEN with your actual JWT token
2. Update test data in TEST_USERS object
3. Run tests:

   // Quick health check
   await quickTest();
   
   // Full test suite
   await testUnifiedInviteAPI.runAllTests();
   
   // Individual tests
   await testUnifiedInviteAPI.testSearchUsers();
   await testUnifiedInviteAPI.testCreateInviteRegistered();

4. Check console output for results
`);
