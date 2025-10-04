// API Service for REST API communication
import AsyncStorage from '@react-native-async-storage/async-storage';
import { convertApiTimestamps } from '../../utils/timestamp';

// OPTIMIZATION: Environment-based API URL for cost management
import { ENV } from '@/config/environment';

// Function to determine the correct API base URL
const getApiBaseUrl = (): string => {
  console.log('🔧 Using API URL from environment config:', ENV.api.baseURL);
  return ENV.api.baseURL;
};

const API_BASE_URL = getApiBaseUrl();

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: '@spendy_auth_token',
  LAST_EMAIL: '@spendy_last_email',
  BIOMETRIC_ENABLED: '@spendy_biometric_enabled',
  USER_SESSION: '@spendy_user_session',
};

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    currency: string;
    profileImage?: string;
    isPremium: boolean;
  };
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    currency: string;
    isPremium: boolean;
  };
}

class ApiService {
  private static instance: ApiService;
  private baseURL = API_BASE_URL;
  private token: string | null = null;

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  constructor() {
    this.initializeToken();
  }

  private async initializeToken(): Promise<void> {
    this.token = await this.getAuthToken();
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async setAuthToken(token: string): Promise<void> {
    try {
      this.token = token;
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    } catch (error) {
      console.error('Error setting auth token:', error);
    }
  }

  // Public method to set auth token (for session restoration)
  async restoreAuthToken(token: string): Promise<void> {
    await this.setAuthToken(token);
  }

  private async clearAuthToken(): Promise<void> {
    try {
      this.token = null;
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error clearing auth token:', error);
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = this.token || await this.getAuthToken();
      
      const config: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      };

      console.log(`🌐 API Request: ${options.method || 'GET'} ${endpoint}`);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      
      if (!response.ok) {
        // Try to get the error response body for better error messages
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          // If we can't parse JSON, stick with the original error
          console.log('Could not parse error response as JSON');
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`✅ API Response: ${endpoint}`, data.success ? 'Success' : 'Failed');
      
      // Convert timestamps in the response data
      if (data.success && data.data) {
        data.data = convertApiTimestamps(data.data);
      }
      
      return data;
    } catch (error: any) {
      // Don't spam console with 404 errors for endpoints that might not exist for new users
      const isNewUserEndpoint = endpoint.includes('/money/') || endpoint.includes('/analytics') || endpoint.includes('/usage');
      const is404Error = error.message?.includes('404') || error.message?.includes('HTTP 404');
      
      if (is404Error && isNewUserEndpoint) {
        console.log(`ℹ️ API Info: ${endpoint} - Resource not found (likely new user)`);
      } else {
        console.error(`❌ API Error: ${endpoint}`, error);
      }
      throw error;
    }
  }

  // Unified request method for data operations
  async request(method: string, endpoint: string, data?: any): Promise<any> {
    // Get user session for user ID
    const session = await AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION);
    const userSession = session ? JSON.parse(session) : null;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...(userSession?.user?.id && { 'x-user-id': userSession.user.id }),
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await this.makeRequest(endpoint, options);
      return response.success ? response.data : Promise.reject(new Error(response.message));
    } catch (error: any) {
      // Enhanced error handling to capture full response
      console.log('🔍 Full error details:', {
        message: error.message,
        endpoint: endpoint,
        method: method
      });
      
      // Enhance error messages for common issues
      if (error.message && error.message.includes('400')) {
        if (endpoint.includes('/groups/') && endpoint.includes('/members/') && method === 'DELETE') {
          if (error.message.includes('Cannot remove group creator')) {
            throw new Error('Cannot leave group: You are the group creator. Please transfer ownership to another member first, or delete the group instead.');
          } else if (error.message.includes('pending balances')) {
            throw new Error('Cannot leave group: You have pending balances. Please settle all expenses first.');
          } else {
            throw new Error('Cannot leave group. You might be the group owner or have pending balances. Please settle all expenses or transfer ownership first.');
          }
        } else {
          throw new Error('Bad request (400). Please check your input and try again.');
        }
      } else if (error.message && error.message.includes('404')) {
        if (endpoint.includes('/groups/undefined/')) {
          throw new Error('Invalid group ID. Please refresh and try again.');
        } else if (endpoint.includes('/groups/') && endpoint.includes('/members/')) {
          throw new Error('Group or member not found. You may have already left this group.');
        } else {
          throw new Error('Resource not found (404). Please check if the group still exists.');
        }
      } else if (error.message && error.message.includes('401')) {
        throw new Error('Authentication required. Please log in again.');
      } else if (error.message && error.message.includes('403')) {
        throw new Error('Permission denied. You may not have access to perform this action.');
      }
      throw error;
    }
  }

  // Silent version of makeRequest that doesn't log 404 errors
  private async makeRequestSilent(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    const token = this.token || await this.getAuthToken();
    const url = `${this.baseURL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      
      // Convert timestamps in the response data
      if (responseData.success && responseData.data) {
        responseData.data = convertApiTimestamps(responseData.data);
      }
      
      return responseData;
    } catch (error) {
      // Don't log errors here - let the caller decide
      throw error;
    }
  }

  // Special request method that handles 404s gracefully for GET requests (returns empty array)
  private async requestWithEmptyFallback(method: string, endpoint: string, data?: any): Promise<any> {
    try {
      const response = await this.makeRequestSilent(endpoint, method, data);
      return response.success ? response.data : Promise.reject(new Error(response.message));
    } catch (error: any) {
      // For GET requests that return 404, return empty array for new users
      if (method === 'GET' && error.message && error.message.includes('404')) {
        console.log(`🔄 Expected 404 for new user: ${endpoint} - returning empty array`);
        return [];
      }
      // Log non-404 errors
      console.error(`❌ API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // ========================
  // AUTHENTICATION APIs
  // ========================
  async register(userData: {
    fullName: string;
    email: string;
    mobile: string;
    password: string;
    country: string;
    currency: string;
  }): Promise<RegisterResponse> {
    const response = await this.makeRequest<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.success && response.data) {
      await this.setAuthToken(response.data.token);
      return response.data;
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.makeRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data) {
      await this.setAuthToken(response.data.token);
      return response.data;
    } else {
      throw new Error(response.message || 'Login failed');
    }
  }

  async getProfile(): Promise<LoginResponse['user']> {
    const response = await this.makeRequest<{ user: LoginResponse['user'] }>('/auth/profile');
    if (response.success && response.data) {
      return response.data.user;
    }
    throw new Error(response.message || 'Failed to get profile');
  }

  async updateUserProfile(updates: {
    fullName?: string;
    mobile?: string;
    country?: string;
    currency?: string;
    biometricEnabled?: boolean;
    profilePicture?: string;
  }): Promise<any> {
    const response = await this.makeRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    if (response.success && response.data) {
      return response.data;
    } else {
      throw new Error(response.message || 'Failed to update profile');
    }
  }

  async logout(): Promise<void> {
    await this.clearAuthToken();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health');
      return response.success;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // ========================
  // FRIENDS MANAGEMENT
  // ========================

  // ========================
  // SESSION MANAGEMENT
  // ========================
  async storeUserSession(user: any): Promise<void> {
    try {
      console.log('💾 Storing user session for:', user.email);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_EMAIL, user.email);
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, JSON.stringify(user.biometricEnabled || false));
      
      // Also store biometric preference in the new BiometricAuthService format
      if (user.id && user.biometricEnabled) {
        await AsyncStorage.setItem(`@spendy_biometric_enabled_${user.id}`, 'true');
        console.log('✅ Biometric preference saved for user:', user.id);
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        lastLoginAt: new Date().toISOString(),
        sessionTimestamp: Date.now(),
        biometricEnabled: user.biometricEnabled || false
      }));
      console.log('✅ User session stored successfully');
    } catch (error) {
      console.error('❌ Failed to store user session:', error);
    }
  }

  async getLastEmail(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_EMAIL);
    } catch (error) {
      console.error('Error getting last email:', error);
      return null;
    }
  }

  async getLastBiometricSetting(): Promise<boolean> {
    try {
      const setting = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      return setting ? JSON.parse(setting) : false;
    } catch (error) {
      console.error('Error getting biometric setting:', error);
      return false;
    }
  }

  async getLastUserSession(): Promise<{
    id: string;
    email: string;
    fullName: string;
    lastLoginAt: string;
    sessionTimestamp: number;
    biometricEnabled?: boolean;
  } | null> {
    try {
      const session = await AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Error getting last user session:', error);
      return null;
    }
  }

  async isSessionValid(): Promise<boolean> {
    try {
      const session = await this.getLastUserSession();
      if (!session || !session.sessionTimestamp) return false;

      const now = Date.now();
      const sessionAge = now - session.sessionTimestamp;
      const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

      return sessionAge < SESSION_DURATION;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  }

  async extendUserSession(): Promise<void> {
    try {
      const session = await this.getLastUserSession();
      if (session) {
        session.sessionTimestamp = Date.now();
        await AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(session));
      }
    } catch (error) {
      console.error('Error extending user session:', error);
    }
  }

  async clearUserSession(): Promise<void> {
    try {
      console.log('🧹 Clearing user session data...');
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.LAST_EMAIL,
        STORAGE_KEYS.BIOMETRIC_ENABLED,
        STORAGE_KEYS.USER_SESSION
      ]);
      console.log('✅ User session cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear user session:', error);
    }
  }

  // ========================
  // GROUPS
  // ========================
  async createGroup(groupData: any): Promise<{ id: string }> {
    const response = await this.request('POST', '/groups', groupData);
    return response;
  }

  async getUserGroups(userId?: string): Promise<any[]> {
    // API expects current user's groups via auth token, not userId parameter
    const response = await this.requestWithEmptyFallback('GET', `/groups`);
    
    // The API returns groups nested under data.groups
    if (response && response.groups && Array.isArray(response.groups)) {
      return response.groups;
    }
    
    // Fallback for different response formats
    return Array.isArray(response) ? response : [];
  }

  async getGroup(groupId: string): Promise<any> {
    const response = await this.request('GET', `/groups/${groupId}`);
    // The API returns { group: {...} }, so we need to extract the group object
    return response.group || response;
  }

  async deleteGroup(groupId: string): Promise<void> {
    console.log('🗑️ API: Deleting group', { groupId });
    try {
      await this.request('DELETE', `/groups/${groupId}`);
      console.log('✅ API: Successfully deleted group');
    } catch (error: any) {
      console.error('❌ API: Delete group failed:', error);
      throw error;
    }
  }

  async updateGroup(groupId: string, updateData: { name?: string; description?: string; avatar?: string; settings?: any }): Promise<void> {
    console.log('✏️ API: Updating group', { groupId, updateData });
    try {
      await this.request('PUT', `/groups/${groupId}`, updateData);
      console.log('✅ API: Successfully updated group');
    } catch (error: any) {
      console.error('❌ API: Update group failed:', error);
      throw error;
    }
  }

  async addGroupMember(groupId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    await this.request('POST', `/groups/${groupId}/members`, { userId, role });
  }

  async joinGroupByInviteCode(inviteCode: string, userId?: string): Promise<string> {
    const response = await this.request('POST', `/groups/join/${inviteCode}`, { userId });
    // request() method returns response.data when success is true
    // Backend returns: { success: true, data: { groupId, groupName, friendshipsCreated } }
    if (!response || !response.groupId) {
      console.error('❌ Invalid response from join group:', response);
      throw new Error('Failed to get group ID from response');
    }
    return response.groupId;
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    if (!groupId || groupId === 'undefined') {
      throw new Error('Invalid group ID. Cannot leave group.');
    }
    if (!userId || userId === 'undefined') {
      throw new Error('Invalid user ID. Cannot leave group.');
    }
    
    console.log('🚪 API: Leaving group', { groupId, userId });
    try {
      await this.request('DELETE', `/groups/${groupId}/members/${userId}`);
      console.log('✅ API: Successfully left group');
    } catch (error: any) {
      console.error('❌ API: Leave group failed:', error);
      throw error;
    }
  }

  async updateMemberRole(groupId: string, userId: string, newRole: 'admin' | 'member'): Promise<void> {
    await this.request('PUT', `/groups/${groupId}/members/${userId}/role`, { role: newRole });
  }

  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    await this.request('DELETE', `/groups/${groupId}/members/${userId}`);
  }

  async updateGroupMemberBalance(groupId: string, userId: string, amount: number): Promise<void> {
    await this.request('PUT', `/groups/${groupId}/members/${userId}/balance`, { amount });
  }

  async getGroupBalanceOverview(groupId: string): Promise<any> {
    const response = await this.request('GET', `/groups/${groupId}/balance`);
    return response;
  }

  // ========================
  // EXPENSES
  // ========================
  async addExpense(expenseData: any): Promise<{ id: string }> {
    const response = await this.request('POST', '/expenses', expenseData);
    return response;
  }

  async getGroupExpenses(groupId: string): Promise<any[]> {
    const response = await this.request('GET', `/expenses/group/${groupId}`);
    return response.data?.expenses || response.expenses || response || [];
  }

  async getUserExpenses(userId: string, limit: number = 20): Promise<any[]> {
    const response = await this.requestWithEmptyFallback('GET', `/expenses/user/${userId}?limit=${limit}`);
    // Handle both array response and object response with expenses property
    if (Array.isArray(response)) {
      return response;
    }
    return response?.expenses || response?.data?.expenses || [];
  }

  async updateExpense(expenseId: string, expenseData: any): Promise<void> {
    console.log('🔍 Updating expense:', expenseId, 'with data:', expenseData);
    await this.request('PUT', `/expenses/${expenseId}`, expenseData);
  }

  async deleteExpense(expenseId: string, deletedBy: string): Promise<void> {
    await this.request('DELETE', `/expenses/${expenseId}`, { deletedBy });
  }

  // ========================
  // RECURRING EXPENSES
  // ========================
  async processRecurringExpenses(): Promise<void> {
    try {
      await this.request('POST', '/recurring-expenses/process');
    } catch (error: any) {
      // For new users, 404 is expected - they don't have recurring expenses yet
      if (error.message && error.message.includes('404')) {
        console.log('No recurring expenses to process for new user (404)');
        return;
      }
      throw error;
    }
  }

  // ========================
  // SETTLEMENTS
  // ========================
  async getGroupSettlements(groupId: string): Promise<any> {
    try {
      const response = await this.request('GET', `/settlements/group/${groupId}`);
      return response;
    } catch (error: any) {
      // Handle authentication errors gracefully for settlements
      if (error.message && error.message.includes('401')) {
        console.log('🔄 Settlement API authentication failed, attempting token refresh...');
        
        // Force token refresh by clearing current token
        this.token = null;
        await this.initializeToken();
        
        // Retry the request once with refreshed token
        try {
          const response = await this.request('GET', `/settlements/group/${groupId}`);
          return response;
        } catch (retryError: any) {
          console.error('❌ Settlement API failed even after token refresh:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  }

  async recordSettlement(settlementData: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    groupId: string;
    note?: string;
  }): Promise<any> {
    const response = await this.request('POST', '/settlements', settlementData);
    return response;
  }

  async getSettlementHistory(groupId: string): Promise<any[]> {
    const response = await this.requestWithEmptyFallback('GET', `/settlements/history/${groupId}`);
    return response;
  }

  // ========================
  // NOTIFICATIONS (Legacy - replaced by new methods below)
  // ========================

  // ========================
  // FRIENDS
  // ========================
  async sendFriendRequest(fromUserId: string, toEmail: string, message?: string): Promise<{ success: boolean; isNewUser?: boolean; message?: string }> {
    const response = await this.request('POST', '/friends/requests/send', { recipientEmail: toEmail, message });
    return response;
  }

  // Send friend request with QR tracking
  async sendFriendRequestWithQR(
    fromUserId: string, 
    toUserId: string, 
    toEmail: string, 
    inviteId: string, 
    message?: string
  ): Promise<{ success: boolean; isNewUser?: boolean; message?: string }> {
    console.log('🔍 sendFriendRequestWithQR params:', { fromUserId, toUserId, toEmail, inviteId, message });
    
    if (!toEmail) {
      throw new Error('Recipient email is required for friend request');
    }
    
    const response = await this.request('POST', '/friends/requests/send', {
      recipientEmail: toEmail,
      message: message || 'Added via QR code scan',
      metadata: {
        fromUserId,
        toUserId,
        inviteId,
        source: 'qr_scan'
      }
    });
    return response;
  }

  // Send SMS friend request 
  async sendSMSFriendRequest(
    recipientPhone: string, 
    message?: string, 
    countryCode?: string
  ): Promise<{ 
    success: boolean; 
    isRegistered?: boolean; 
    message?: string; 
    data?: {
      requestId: string;
      recipientPhone: string;
      recipientName?: string;
      smsMessage: string;
    }
  }> {
    console.log('📱 Sending SMS friend request:', { recipientPhone, countryCode, message });
    
    if (!recipientPhone?.trim()) {
      throw new Error('Recipient phone number is required for SMS friend request');
    }
    
    const response = await this.request('POST', '/friends/requests/send-sms', {
      recipientPhone: recipientPhone.trim(),
      message: message || 'Sent via SMS',
      countryCode: countryCode || 'US'
    });
    
    console.log('📱 SMS friend request response:', response);
    return response;
  }

  // Respond to friend request (accept/decline)
  async respondToFriendRequest(requestId: string, userId: string, response: 'accepted' | 'declined'): Promise<any> {
    const result = await this.request('POST', '/friends/requests/respond', {
      requestId,
      userId,
      response
    });
    return result.data || result;
  }

  // Get user profile by ID
  async getUserProfile(userId: string): Promise<any> {
    const response = await this.request('GET', `/users/${userId}`);
    return response.data || response;
  }

  // Send push notification
  async sendPushNotification(userId: string, notification: {
    title: string;
    body: string;
    data?: any;
  }): Promise<void> {
    await this.request('POST', '/notifications/send', {
      userId,
      notification
    });
  }


  async savePushToken(pushToken: string): Promise<void> {
    try {
      console.log('💾 Saving push token to server');
      await this.request('POST', '/user/push-token', { pushToken });
      console.log('✅ Push token saved successfully');
    } catch (error) {
      console.error('❌ Failed to save push token:', error);
      // Don't throw error for push token save failures - they're non-critical
      console.log('⚠️ Push token save failed but continuing app initialization');
    }
  }

  async removePushToken(): Promise<void> {
    try {
      console.log('🗑️ Removing push token from server');
      await this.request('DELETE', '/user/push-token');
      console.log('✅ Push token removed successfully');
    } catch (error) {
      console.error('❌ Failed to remove push token:', error);
      throw error;
    }
  }

  async getFriends(userId?: string): Promise<any[]> {
    // API expects current user's friends via auth token, not userId parameter
    const response = await this.requestWithEmptyFallback('GET', `/friends`);
    // Extract friends array from response data - Firebase Functions returns { success: true, data: { friends: [], totalFriends: n } }
    return response?.data?.friends || response?.friends || response || [];
  }

  async getFriendRequests(): Promise<{ incoming: any[]; outgoing: any[] }> {
    console.log('🔄 ApiService: Getting friend requests from API');
    const response = await this.requestWithEmptyFallback('GET', `/friends/requests`);
    console.log('📄 ApiService: Friend requests response:', response);
    
    // Firebase Functions returns { incoming: [], outgoing: [] }
    const data = response?.data || response;
    
    return {
      incoming: data?.incoming || [],  // incoming = requests TO current user
      outgoing: data?.outgoing || []   // outgoing = requests FROM current user
    };
  }

  async acceptFriendRequest(requestId: string): Promise<void> {
    await this.request('POST', `/friends/requests/accept`, { requestId });
  }

  async declineFriendRequest(requestId: string): Promise<void> {
    await this.request('POST', `/friends/requests/${requestId}/decline`);
  }

  async removeFriend(userId: string, friendId: string, friendRequestId?: string): Promise<void> {
    await this.request('DELETE', `/friends/${friendId}`);
  }

  async checkExistingFriendship(userId: string, friendEmail: string): Promise<{
    isFriend: boolean;
    friendData?: any;
    status?: string;
  }> {
    try {
      // First search for the user by email
      const searchResults = await this.requestWithEmptyFallback('GET', `/friends/search?query=${encodeURIComponent(friendEmail)}`);
      
      // If no user found with this email
      if (!Array.isArray(searchResults) || searchResults.length === 0) {
        return { isFriend: false };
      }
      
      // Find exact email match (search might return partial matches)
      const targetUser = searchResults.find((user: any) => 
        user.email && user.email.toLowerCase() === friendEmail.toLowerCase()
      );
      
      if (!targetUser) {
        return { isFriend: false };
      }
      
      // Get current user's friends list to check if already friends
      const friends = await this.requestWithEmptyFallback('GET', '/friends');
      
      // Check if target user is in friends list
      const existingFriend = Array.isArray(friends) ? 
        friends.find((friend: any) => friend.id === targetUser.id || friend.friendId === targetUser.id) : 
        null;
      
      if (existingFriend) {
        return {
          isFriend: true,
          friendData: {
            id: targetUser.id,
            fullName: targetUser.name,
            email: targetUser.email,
            status: 'accepted'
          },
          status: 'accepted'
        };
      }
      
      // User exists but not friends yet
      return { 
        isFriend: false,
        friendData: {
          id: targetUser.id,
          fullName: targetUser.name,
          email: targetUser.email
        }
      };
      
    } catch (error) {
      console.error('Error checking existing friendship:', error);
      return { isFriend: false };
    }
  }

  async sendFriendRequestReminder(friendRequestId: string, reminderMethod: 'auto' | 'push' | 'email' | 'sms' = 'auto'): Promise<{
    success: boolean;
    isUnregistered?: boolean;
    availableMethods?: string[];
    userInfo?: {
      email: string | null;
      mobile: string | null;
      fullName: string;
    };
    data?: {
      method: string;
      isUserRegistered: boolean;
      originalInviteMethod: string | null;
      availableMethods: string[];
      recipient: string;
    };
    message: string;
  }> {
    try {
      const response = await this.request('POST', `/friends/requests/${friendRequestId}/remind`, { reminderMethod });
      // The request method returns only the data when successful, so we need to wrap it
      return {
        success: true,
        data: response,
        message: 'Reminder sent successfully'
      };
    } catch (error: any) {
      // Handle error responses that might have additional data
      return {
        success: false,
        message: error.message || 'Failed to send reminder'
      };
    }
  }

  async removePendingFriendInvitation(userId: string, friendRequestId: string): Promise<void> {
    await this.request('DELETE', `/friends/requests/${friendRequestId}`);
  }

  async autoConnectGroupMembers(groupId: string, userId: string, showPrompt: boolean = true): Promise<any> {
    const response = await this.request('POST', `/groups/${groupId}/auto-connect`, { userId, showPrompt });
    return response;
  }

  // ========================
  // REMINDERS (NEW API)
  // ========================
  async createReminder(reminderData: {
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    category: string;
    dueDate: string;
    isRecurring?: boolean;
    recurringType?: string;
    reminderDays?: number[];
    notificationEnabled?: boolean;
    autoDetected?: boolean;
    emailSource?: string;
    notes?: string;
  }): Promise<{ id: string }> {
    const response = await this.request('POST', '/reminders', reminderData);
    return response;
  }

  async getReminders(options: {
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{ data: any[]; pagination: any }> {
    const queryParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
    
    const response = await this.requestWithEmptyFallback('GET', `/reminders?${queryParams.toString()}`);
    return {
      data: response.data || [],
      pagination: response.pagination || {}
    };
  }

  async updateReminder(reminderId: string, updates: Partial<{
    title: string;
    description: string;
    amount: number;
    currency: string;
    category: string;
    dueDate: string;
    isRecurring: boolean;
    recurringType: string;
    reminderDays: number[];
    notificationEnabled: boolean;
    notes: string;
  }>): Promise<void> {
    await this.request('PUT', `/reminders/${reminderId}`, updates);
  }

  async deleteReminder(reminderId: string): Promise<void> {
    await this.request('DELETE', `/reminders/${reminderId}`);
  }

  async markReminderAsPaid(reminderId: string, options: {
    paidAmount?: number;
    paymentMethod?: string;
    notes?: string;
  } = {}): Promise<void> {
    await this.request('POST', `/reminders/${reminderId}/mark-paid`, options);
  }

  async getUpcomingReminders(days: number = 7): Promise<{ data: any[]; meta: any }> {
    const response = await this.requestWithEmptyFallback('GET', `/reminders/upcoming?days=${days}`);
    return {
      data: response.data || [],
      meta: response.meta || {}
    };
  }

  // ========================
  // CALENDAR INTEGRATION
  // ========================
  async getCalendarData(month?: number, year?: number): Promise<{
    month: number;
    year: number;
    calendar: { [date: string]: any[] };
    stats: any;
  }> {
    const params = new URLSearchParams();
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());
    
    const response = await this.request('GET', `/calendar?${params.toString()}`);
    return response;
  }

  async getCalendarDataByDate(date: string): Promise<{
    reminders: any[];
    summary: any;
  }> {
    const response = await this.request('GET', `/calendar/${date}`);
    return response;
  }

  // ========================
  // GMAIL INTEGRATION
  // ========================
  async getGmailAuthUrl(): Promise<{ authUrl: string }> {
    const response = await this.request('GET', '/gmail/auth-url');
    return response;
  }

  async connectGmail(authCode: string): Promise<{
    email: string;
    isConnected: boolean;
    autoSync: boolean;
    syncFrequency: string;
  }> {
    const response = await this.request('POST', '/gmail/connect', { code: authCode });
    return response;
  }

  async getGmailStatus(): Promise<{
    isConnected: boolean;
    email?: string;
    lastSyncAt?: string;
    autoSync?: boolean;
    syncFrequency?: string;
  }> {
    const response = await this.request('GET', '/gmail/status');
    return response;
  }

  async syncGmailBills(): Promise<{
    billsFound: number;
    remindersCreated: number;
    duplicatesSkipped: number;
    failures: number;
    bills: any[];
  }> {
    const response = await this.request('POST', '/gmail/sync');
    return response;
  }

  async disconnectGmail(): Promise<void> {
    await this.request('DELETE', '/gmail/disconnect');
  }

  // ========================
  // APP NOTIFICATIONS (UPDATED)
  // ========================
  async getUserNotifications(options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
  } = {}): Promise<{
    notifications: any[];
    total: number;
    unreadCount: number;
  }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    
    const response = await this.request('GET', `/notifications?${params.toString()}`);
    return response;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.request('PUT', `/notifications/${notificationId}/read`);
  }

  async markAllNotificationsAsRead(): Promise<{ markedCount: number }> {
    const response = await this.request('PUT', '/notifications/read-all');
    return response;
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.request('DELETE', `/notifications/${notificationId}`);
  }

  async registerFCMToken(token: string, deviceInfo?: any): Promise<void> {
    await this.request('POST', '/notifications/register-token', { token, deviceInfo });
  }

  async removeFCMToken(token: string): Promise<void> {
    await this.request('DELETE', '/notifications/remove-token', { token });
  }

  async createNotification(notificationData: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    isRead?: boolean;
    createdAt?: Date;
  }): Promise<any> {
    const response = await this.request('POST', '/notifications', notificationData);
    return response;
  }

  async sendPaymentReminder(data: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    expenseId?: string;
    groupId?: string;
    message?: string;
  }): Promise<any> {
    const response = await this.request('POST', '/notifications/payment-reminder', data);
    return response;
  }

  // ========================
  // REGISTRATION INVITE CHECK
  // ========================

  /**
   * Check for pending invites during user registration
   */
  async checkPendingInvitesOnRegistration(data: {
    userId: string;
    phoneNumber: string;
    email: string;
    countryCode?: string;
  }): Promise<any> {
    try {
      // Make direct API call to get full response structure
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      };

      console.log(`🌐 API Request: POST /invites/unified/check-registration`);
      
      const response = await fetch(`${this.baseURL}/invites/unified/check-registration`, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ API Response: /invites/unified/check-registration`, result.success ? 'Success' : 'Failed');
      
      return result; // Return the full response object with hasPendingInvites etc.
    } catch (error) {
      console.error('❌ Check registration invites error:', error);
      return {
        success: false,
        hasPendingInvites: false,
        invites: [],
        autoAcceptedCount: 0,
        newFriendships: [],
        message: 'Failed to check pending invites'
      };
    }
  }

  /**
   * Search for users by phone number or email (for invite system)
   */
  async searchUsersByContact(query: string): Promise<any> {
    const response = await this.request('GET', `/users/search-contact?q=${encodeURIComponent(query)}`);
    return response;
  }

  /**
   * Create friendship between two users
   */
  async createFriendship(userId1: string, userId2: string): Promise<any> {
    const response = await this.request('POST', '/friends/create-friendship', {
      userId1,
      userId2
    });
    return response;
  }

  // Upload receipt image (Premium feature)
  async uploadReceiptImage(imageUri: string, expenseId?: string): Promise<{ receiptUrl: string; receiptId: string }> {
    try {
      console.log('📤 ApiService: Uploading receipt image...');

      // Compress and convert image to base64
      const base64Image = await this.compressAndConvertImage(imageUri);
      console.log('📊 Base64 image length:', base64Image.length, 'characters');

      const response = await this.request('POST', '/receipts/upload', {
        imageData: base64Image,
        expenseId: expenseId || null
      });

      console.log('✅ ApiService: Receipt uploaded successfully', response);
      return {
        receiptUrl: response.receiptUrl,
        receiptId: response.receiptId
      };
    } catch (error) {
      console.error('❌ ApiService: Receipt upload failed:', error);
      throw error;
    }
  }

  // Helper method to compress and convert image to base64
  private async compressAndConvertImage(imageUri: string): Promise<string> {
    try {
      // Use expo-image-manipulator to compress the image
      const ImageManipulator = require('expo-image-manipulator');

      console.log('🔄 Compressing image...');
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }], // Resize to max width 1024px
        {
          compress: 0.7, // 70% quality
          format: ImageManipulator.SaveFormat.JPEG
        }
      );

      console.log('✅ Image compressed, converting to base64...');
      const response = await fetch(manipResult.uri);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          console.log('✅ Base64 conversion complete, size:', Math.round(base64data.length / 1024), 'KB');
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error compressing/converting image:', error);
      throw new Error('Failed to process image');
    }
  }
}

export default ApiService;
export { ApiService };
export type { ApiResponse, LoginResponse, RegisterResponse };
