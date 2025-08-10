const { test, expect } = require('@playwright/test');

// Timestamp conversion utility for API responses
const convertApiTimestamps = (obj) => {
  if (!obj) return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => convertApiTimestamps(item));
  }
  
  // Handle primitive values
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const converted = { ...obj };
  
  // Convert common timestamp fields from ISO strings to Date objects
  const timestampFields = ['createdAt', 'updatedAt', 'date', 'joinedAt', 'leftAt', 'lastLoginAt', 'readAt'];
  
  timestampFields.forEach(field => {
    if (converted[field] && typeof converted[field] === 'string') {
      const parsed = new Date(converted[field]);
      if (!isNaN(parsed.getTime())) {
        converted[field] = parsed;
      }
    }
  });
  
  // Recursively process nested objects and arrays
  Object.keys(converted).forEach(key => {
    if (converted[key] && typeof converted[key] === 'object' && !timestampFields.includes(key)) {
      converted[key] = convertApiTimestamps(converted[key]);
    }
  });
  
  return converted;
};

// Test data generators
const generateTestUser = (prefix = 'user') => ({
  email: `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@spendytest.com`,
  password: 'TestPassword123!',
  fullName: `Test ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`,
  mobile: '+61412345678',
  country: 'AU',
  currency: 'AUD'
});

const generateTestGroup = () => ({
  name: `Test Group ${Date.now()}`,
  description: 'Automated test group',
  category: 'general',
  currency: 'AUD',
  avatar: '🍕'
});

const generateTestExpense = (groupId, paidBy) => ({
  description: `Test Expense ${Date.now()}`,
  amount: Math.floor(Math.random() * 200) + 10, // Random amount between 10-210
  currency: 'AUD',
  category: 'food',
  groupId: groupId,
  paidBy: paidBy,
  splitType: 'equal',
  splitDetails: []
});

// API Helper Class
class SpendyApiHelper {
  constructor(request) {
    this.request = request;
    // Use the Firebase emulator URL directly
    this.baseURL = 'http://127.0.0.1:5001/spendy-97913/us-central1/spendyApi';
  }

  async post(endpoint, data, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await this.request.post(`${this.baseURL}${endpoint}`, {
      headers,
      data
    });
    
    const responseData = await response.json();
    
    return {
      status: response.status(),
      data: convertApiTimestamps(responseData)
    };
  }

  async get(endpoint, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await this.request.get(`${this.baseURL}${endpoint}`, {
      headers
    });
    
    const responseData = await response.json();
    
    return {
      status: response.status(),
      data: convertApiTimestamps(responseData)
    };
  }

  async put(endpoint, data, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await this.request.put(`${this.baseURL}${endpoint}`, {
      headers,
      data
    });
    
    const responseData = await response.json();
    
    return {
      status: response.status(),
      data: convertApiTimestamps(responseData)
    };
  }

  async delete(endpoint, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await this.request.delete(`${this.baseURL}${endpoint}`, {
      headers
    });
    
    const responseData = await response.json();
    
    return {
      status: response.status(),
      data: convertApiTimestamps(responseData)
    };
  }

  // Authentication methods
  async register(userData) {
    return this.post('/auth/register', userData);
  }

  async login(email, password) {
    return this.post('/auth/login', { email, password });
  }

  async getProfile(token) {
    return this.get('/auth/profile', token);
  }

  // Friend management methods
  async searchFriends(query, token) {
    return this.get(`/friends/search?query=${encodeURIComponent(query)}`, token);
  }

  async sendFriendRequest(toEmail, message, token) {
    return this.post('/friends/requests/send', { toEmail, message }, token);
  }

  async getFriendRequests(token) {
    return this.get('/friends/requests', token);
  }

  async acceptFriendRequest(requestId, token) {
    return this.post('/friends/requests/accept', { requestId }, token);
  }

  async declineFriendRequest(requestId, token) {
    return this.post('/friends/requests/decline', { requestId }, token);
  }

  async getFriends(token) {
    return this.get('/friends', token);
  }

  // Group management methods
  async createGroup(groupData, token) {
    return this.post('/groups', groupData, token);
  }

  async getGroups(token) {
    return this.get('/groups', token);
  }

  async getGroup(groupId, token) {
    return this.get(`/groups/${groupId}`, token);
  }

  async getGroupMembers(groupId, token) {
    const groupResponse = await this.get(`/groups/${groupId}`, token);
    return {
      status: groupResponse.status,
      data: {
        data: {
          members: groupResponse.data.members || []
        }
      }
    };
  }

  async addGroupMember(groupId, memberData, token) {
    return this.post(`/groups/${groupId}/members`, memberData, token);
  }

  async leaveGroup(groupId, token) {
    return this.post(`/groups/${groupId}/leave`, {}, token);
  }

  // Expense management methods
  async createExpense(expenseData, token) {
    return this.post('/expenses', expenseData, token);
  }

  async getExpenses(token) {
    return this.get('/expenses', token);
  }

  async getUserExpenses(userId, token) {
    return this.get(`/expenses/user/${userId}`, token);
  }

  async getGroupExpenses(groupId, token) {
    return this.get(`/expenses/group/${groupId}`, token);
  }

  // Settlement methods
  async getSettlements(groupId, token) {
    return this.get(`/settlements/group/${groupId}`, token);
  }

  async getSettlementRecommendations(groupId, token) {
    return this.get(`/settlements/group/${groupId}`, token);
  }

  async recordSettlement(settlementData, token) {
    return this.post('/settlements', settlementData, token);
  }

  async createSettlement(settlementData, token) {
    return this.post('/settlements', settlementData, token);
  }

  async getSettlementHistory(groupId, token) {
    return this.get(`/settlements/history/${groupId}`, token);
  }

  async markSettlementAsPaid(settlementId, token) {
    return this.post(`/settlements/${settlementId}/pay`, {}, token);
  }

  // User profile methods
  async getUserProfile(userId, token) {
    return this.get('/auth/profile', token);
  }

  // Group member management
  async removeGroupMember(groupId, userId, token) {
    return this.delete(`/groups/${groupId}/members/${userId}`, token);
  }

  // Get user groups (alias)
  async getUserGroups(token) {
    return this.get('/groups', token);
  }

  // Notifications methods
  async getNotifications(userId, token) {
    return this.get(`/notifications/${userId}`, token);
  }

  async markNotificationAsRead(notificationId, token) {
    return this.post(`/notifications/${notificationId}/read`, {}, token);
  }

  async clearAllNotifications(userId, token) {
    return this.delete(`/notifications/${userId}/all`, token);
  }

  async getUnreadNotificationCount(userId, token) {
    return this.get(`/notifications/${userId}/unread-count`, token);
  }

  // DELETE method helper
  async delete(endpoint, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await this.request.delete(`${this.baseURL}${endpoint}`, {
      headers
    });
    
    return {
      status: response.status(),
      data: await response.json()
    };
  }
}

module.exports = {
  generateTestUser,
  generateTestGroup,
  generateTestExpense,
  SpendyApiHelper
};
