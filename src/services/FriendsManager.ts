/**
 * FriendsManager - Centralized friends management with caching and reactive updates
 * Handles Issue #5: Friends List Refresh Issues
 */

import { SplittingService, Friend } from '@/services/firebase/splitting';

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
    
    // Set up real-time listener for automatic updates
    this.realtimeUnsubscribe = SplittingService.onFriends(
      userId,
      (updatedFriends) => {
        console.log('🔄 FriendsManager: Real-time friends update received', updatedFriends.length);
        this.updateFriendsState(updatedFriends);
        this.updateCache(userId, updatedFriends);
      }
    );

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
      console.log('🔄 FriendsManager: Fetching fresh friends data from Firebase');
      const friends = await SplittingService.getFriends(this.userId);
      
      this.updateFriendsState(friends);
      this.updateCache(this.userId, friends);
      
      console.log('✅ FriendsManager: Friends data refreshed successfully', friends.length);
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

  private calculateBalances(friends: Friend[]) {
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
