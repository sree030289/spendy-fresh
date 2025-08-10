/**
 * FriendsManager - Centralized friends management with caching and reactive updates
 * Handles Issue #5: Friends List Refresh Issues
 */

import { Friend } from '@/services/firebase/splitting-disabled';
import { ApiService } from '@/services/api/ApiService';

interface FriendsState {
  friends: Friend[];
  lastUpdated: number;
  loading: boolean;
  error: string | null;
  balances: {
    totalOwed: number;
    totalOwing: number;
    netBalance: number;
  };
}

type FriendsUpdateListener = (state: FriendsState) => void;

export class FriendsManager {
  private static instance: FriendsManager;
  private apiService: ApiService = ApiService.getInstance();
  private state: FriendsState = {
    friends: [],
    lastUpdated: 0,
    loading: false,
    error: null,
    balances: {
      totalOwed: 0,
      totalOwing: 0,
      netBalance: 0
    }
  };
  
  private listeners: Set<FriendsUpdateListener> = new Set();
  private userId: string | null = null;
  private realtimeUnsubscribe: (() => void) | null = null;
  private cache: Map<string, { data: Friend[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private refreshPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): FriendsManager {
    if (!FriendsManager.instance) {
      FriendsManager.instance = new FriendsManager();
    }
    return FriendsManager.instance;
  }

  /**
   * Initialize the friends manager for a specific user
   */
  async initialize(userId: string): Promise<void> {
    if (this.userId === userId && this.realtimeUnsubscribe) {
      return; // Already initialized for this user
    }

    // Clean up previous initialization
    this.cleanup();
    
    this.userId = userId;
    
    // TODO: Implement real-time listener for automatic updates with API
    // Set up real-time listener for automatic updates
    this.realtimeUnsubscribe = null; // SplittingService.onFriends(
    //   userId,
    //   (updatedFriends) => {
    //     console.log('🔄 FriendsManager: Real-time friends update received', updatedFriends.length);
    //     this.updateFriendsState(updatedFriends);
    //     this.updateCache(userId, updatedFriends);
    //   }
    // );

    // Load initial data
    await this.refreshFriends(true);
  }

  /**
   * Add a listener for friends state updates
   */
  addListener(listener: FriendsUpdateListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current friends state
   */
  getState(): FriendsState {
    return { ...this.state };
  }

  /**
   * Get current friends list
   */
  getFriends(): Friend[] {
    return [...this.state.friends];
  }

  /**
   * Get current balances
   */
  getBalances() {
    return { ...this.state.balances };
  }

  /**
   * Refresh friends data with optional cache bypass
   */
  async refreshFriends(forceRefresh: boolean = false): Promise<void> {
    if (!this.userId) {
      throw new Error('FriendsManager not initialized');
    }

    // Prevent multiple simultaneous refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh(forceRefresh);
    
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Force refresh friends list (bypasses cache)
   */
  async forceRefresh(): Promise<void> {
    return this.refreshFriends(true);
  }

  /**
   * Notify that a friend was added/modified (trigger refresh)
   */
  async notifyFriendAdded(): Promise<void> {
    console.log('🔄 FriendsManager: Friend added notification');
    await this.refreshFriends(true);
  }

  /**
   * Notify that a friend was removed (trigger refresh)
   */
  async notifyFriendRemoved(): Promise<void> {
    console.log('🔄 FriendsManager: Friend removed notification');
    await this.refreshFriends(true);
  }

  /**
   * Notify that friend balances may have changed (trigger refresh)
   */
  async notifyBalanceUpdated(): Promise<void> {
    console.log('🔄 FriendsManager: Balance updated notification');
    await this.refreshFriends(true);
  }

  /**
   * Check if data is stale and needs refresh
   */
  isDataStale(): boolean {
    const now = Date.now();
    return (now - this.state.lastUpdated) > this.CACHE_DURATION;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    this.listeners.clear();
    this.cache.clear();
    this.userId = null;
    this.refreshPromise = null;
  }

  // Private methods

  private async performRefresh(forceRefresh: boolean): Promise<void> {
    if (!this.userId) return;

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cachedData = this.getCachedData(this.userId);
      if (cachedData) {
        console.log('📦 FriendsManager: Using cached friends data');
        this.updateFriendsState(cachedData);
        return;
      }
    }

    this.updateLoadingState(true);

    try {
      console.log('🔄 FriendsManager: Fetching fresh friends and friend requests from API');
      
      // Load both friends and friend requests in parallel
      const [friends, friendRequests] = await Promise.all([
        this.apiService.getFriends(),
        this.apiService.getFriendRequests()
      ]);
      
      console.log('🔍 FriendsManager: Raw API responses:', {
        friends: friends?.length || 0,
        friendRequests,
        incomingCount: friendRequests?.incoming?.length || 0,
        outgoingCount: friendRequests?.outgoing?.length || 0
      });
      
      // Handle the case where friends is undefined (graceful 404 handling)
      const friendsArray = Array.isArray(friends) ? friends : [];
      
      // Convert friend requests to Friend format for UI compatibility
      const allFriends = [...friendsArray];
      
      // Add incoming friend requests (requests TO this user)
      if (friendRequests.incoming?.length > 0) {
        const incomingFriends = friendRequests.incoming.map((request: any) => ({
          id: request.id,
          userId: this.userId!,
          friendId: request.fromUserId,
          friendData: {
            id: request.fromUser.id,
            fullName: request.fromUser.fullName,
            email: request.fromUser.email,
            profilePicture: request.fromUser.profileImage
          },
          status: 'pending' as const,
          balance: 0,
          lastActivity: new Date(),
          createdAt: request.createdAt || new Date(),
          updatedAt: new Date(),
          requestId: request.id,
          requestType: 'received' as const
        }));
        allFriends.push(...incomingFriends);
      }
      
      // Add outgoing friend requests (requests FROM this user)
      if (friendRequests.outgoing?.length > 0) {
        const outgoingFriends = friendRequests.outgoing.map((request: any) => ({
          id: request.id,
          userId: this.userId!,
          friendId: request.toUserId,
          friendData: {
            id: request.toUser.id,
            fullName: request.toUser.fullName,
            email: request.toUser.email,
            profilePicture: request.toUser.profileImage
          },
          status: 'invited' as const,
          balance: 0,
          lastActivity: new Date(),
          createdAt: request.createdAt || new Date(),
          updatedAt: new Date(),
          requestId: request.id,
          requestType: 'sent' as const
        }));
        allFriends.push(...outgoingFriends);
      }
      
      this.updateFriendsState(allFriends);
      this.updateCache(this.userId, allFriends);
      
      console.log('✅ FriendsManager: Friends data refreshed successfully', {
        acceptedFriends: friendsArray.length,
        incomingRequests: friendRequests.incoming?.length || 0,
        outgoingRequests: friendRequests.outgoing?.length || 0,
        totalFriends: allFriends.length
      });
    } catch (error) {
      console.error('❌ FriendsManager: Error refreshing friends', error);
      this.updateErrorState(error instanceof Error ? error.message : 'Failed to refresh friends');
    } finally {
      this.updateLoadingState(false);
    }
  }

  private updateFriendsState(friends: Friend[]): void {
    const balances = this.calculateBalances(friends);
    
    this.state = {
      ...this.state,
      friends: [...friends],
      lastUpdated: Date.now(),
      balances,
      error: null
    };

    this.notifyListeners();
  }

  private updateLoadingState(loading: boolean): void {
    this.state = {
      ...this.state,
      loading
    };
    this.notifyListeners();
  }

  private updateErrorState(error: string): void {
    this.state = {
      ...this.state,
      error,
      loading: false
    };
    this.notifyListeners();
  }

  private calculateBalances(friends: Friend[] | undefined | null) {
    // Safety check: ensure friends is an array
    if (!Array.isArray(friends)) {
      console.log('⚠️  FriendsManager: calculateBalances received non-array friends:', friends);
      return {
        totalOwed: 0,
        totalOwing: 0,
        netBalance: 0
      };
    }
    
    const acceptedFriends = friends.filter(friend => friend.status === 'accepted');
    
    const totalOwed = acceptedFriends.reduce((sum, friend) => 
      sum + Math.max(0, friend.balance || 0), 0
    );
    
    const totalOwing = acceptedFriends.reduce((sum, friend) => 
      sum + Math.max(0, -(friend.balance || 0)), 0
    );

    return {
      totalOwed,
      totalOwing,
      netBalance: totalOwed - totalOwing
    };
  }

  private getCachedData(userId: string): Friend[] | null {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(userId);
      return null;
    }

    return cached.data;
  }

  private updateCache(userId: string, friends: Friend[]): void {
    this.cache.set(userId, {
      data: [...friends],
      timestamp: Date.now()
    });
  }

  private notifyListeners(): void {
    const stateCopy = { ...this.state };
    this.listeners.forEach(listener => {
      try {
        listener(stateCopy);
      } catch (error) {
        console.error('Error in friends state listener:', error);
      }
    });
  }
}

// Singleton instance export
export const friendsManager = FriendsManager.getInstance();
