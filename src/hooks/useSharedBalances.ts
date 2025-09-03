// src/hooks/useSharedBalances.ts - PERFORMANCE OPTIMIZED: Shared Balance Hook
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { ApiService } from '@/services/api/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import the existing balance types and service
import { UnifiedSettlementService } from './useBalances';

// PERFORMANCE: Add caching for expensive settlement calculations
class SettlementCache {
  private static instance: SettlementCache;
  private cache = new Map<string, { result: any; timestamp: number }>();
  private readonly CACHE_DURATION = 60000; // 1 minute cache for settlements

  static getInstance(): SettlementCache {
    if (!SettlementCache.instance) {
      SettlementCache.instance = new SettlementCache();
    }
    return SettlementCache.instance;
  }

  getCachedSettlement(groupId: string, userId1: string, userId2: string): any | null {
    const key = `${groupId}-${userId1}-${userId2}`;
    const cached = this.cache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`⏭️ Using cached settlement: ${key}`);
      return cached.result;
    }
    
    return null;
  }

  setCachedSettlement(groupId: string, userId1: string, userId2: string, result: any): void {
    const key = `${groupId}-${userId1}-${userId2}`;
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Define types locally to avoid circular imports
interface BalanceDetail {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  balance: number;
  source: 'friend' | 'group' | 'mixed';
  groupName?: string;
  groupId?: string;
  lastUpdated: Date;
  breakdown?: {
    fromFriendships: number;
    fromGroups: { [groupId: string]: { groupName: string; balance: number } };
  };
}

interface BalanceSummary {
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  details: BalanceDetail[];
  lastUpdated: Date;
}

interface Friend {
  id: string;
  userId: string;
  friendId: string;
  friendData: {
    id: string;
    fullName: string;
    email: string;
    mobile?: string;
    avatar?: string;
    profilePicture?: string;
  };
  status: 'pending' | 'accepted' | 'blocked' | 'invited';
  balance: number;
  lastActivity: Date;
  createdAt: Date;
}

// Global state manager to share data between hook instances
class SharedBalanceManager {
  private static instance: SharedBalanceManager;
  private subscribers: Set<(data: any) => void> = new Set();
  private balances: BalanceSummary | null = null;
  private friendsData: Friend[] = [];
  private isLoading = true;
  private error: string | null = null;
  private lastRefreshTime = 0;
  private isRefreshing = false;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  static getInstance(): SharedBalanceManager {
    if (!SharedBalanceManager.instance) {
      SharedBalanceManager.instance = new SharedBalanceManager();
      SharedBalanceManager.instance.setupRefreshListeners();
    }
    return SharedBalanceManager.instance;
  }

  private setupRefreshListeners(): void {
    // Listen for balance refresh events from notifications
    if (typeof window !== 'undefined') {
      window.addEventListener('balanceRefreshRequired', () => {
        console.log('💰 SharedBalanceManager: Received balance refresh event from notification');
        // Get the current user ID from stored data
        this.checkAndRefreshFromNotification();
      });
    }
    
    // Check for refresh flags periodically
    setInterval(() => {
      this.checkRefreshFlag();
    }, 5000); // Check every 5 seconds
  }

  private async checkAndRefreshFromNotification(): Promise<void> {
    try {
      // Import AuthProvider to get current user
      const { useAuth } = await import('./useAuth');
      // Since we can't call hooks outside component, we'll check AsyncStorage for user data
      const userData = await AsyncStorage.getItem('@spendy_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        if (user?.id) {
          console.log('💰 Triggering force refresh for user:', user.id);
          await this.forceRefresh(user.id);
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing from notification:', error);
    }
  }

  private async checkRefreshFlag(): Promise<void> {
    try {
      const refreshFlag = await AsyncStorage.getItem('@balance_refresh_required');
      if (refreshFlag) {
        const flagTime = parseInt(refreshFlag);
        const now = Date.now();
        
        // Only refresh if flag is recent (within last 30 seconds) to avoid stale refreshes
        if ((now - flagTime) < 30000) {
          console.log('💰 Found balance refresh flag - triggering refresh');
          await this.checkAndRefreshFromNotification();
        }
        
        // Clear the flag after checking
        await AsyncStorage.removeItem('@balance_refresh_required');
      }
    } catch (error) {
      console.error('❌ Error checking refresh flag:', error);
    }
  }

  subscribe(callback: (data: any) => void): () => void {
    this.subscribers.add(callback);
    
    // Immediately send current state to new subscriber
    callback({
      balances: this.balances,
      friendsData: this.friendsData,
      isLoading: this.isLoading,
      error: this.error
    });
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    const data = {
      balances: this.balances,
      friendsData: this.friendsData,
      isLoading: this.isLoading,
      error: this.error
    };
    
    console.log('📡 SharedBalanceManager: Notifying', this.subscribers.size, 'subscribers with updated data:', {
      totalOwed: this.balances?.totalOwed ?? 0,
      totalOwing: this.balances?.totalOwing ?? 0,
      netBalance: this.balances?.netBalance ?? 0,
      isLoading: this.isLoading
    });
    
    this.subscribers.forEach(callback => callback(data));
  }

  async refresh(userId: string, force: boolean = false): Promise<void> {
    if (!userId) return;
    
    const now = Date.now();
    
    // Prevent multiple simultaneous refreshes
    if (this.isRefreshing) {
      console.log('⏭️ SharedBalanceManager: Already refreshing, skipping');
      return;
    }
    
    // Check cache
    if (!force && (now - this.lastRefreshTime) < this.CACHE_DURATION) {
      console.log('⏭️ SharedBalanceManager: Using cached data');
      return;
    }

    this.isRefreshing = true;
    this.isLoading = true;
    this.error = null;
    this.notifySubscribers();

    try {
      console.log('🔄 SharedBalanceManager: Starting unified refresh');
      
      const apiService = ApiService.getInstance();
      const [freshBalances, friendsResult] = await Promise.all([
        this.calculateUserBalancesWithCache(userId),
        apiService.getFriends()
      ]);
      
      this.balances = freshBalances;
      this.friendsData = Array.isArray(friendsResult) ? friendsResult : [];
      this.lastRefreshTime = now;
      this.error = null;
      
      console.log('✅ SharedBalanceManager: Refresh complete:', {
        totalOwed: freshBalances.totalOwed,
        totalOwing: freshBalances.totalOwing,
        netBalance: freshBalances.netBalance,
        detailCount: freshBalances.details.length,
        friendsCount: this.friendsData.length
      });
      
    } catch (err) {
      console.error('❌ SharedBalanceManager: Refresh error:', err);
      this.error = err instanceof Error ? err.message : 'Failed to load balances';
    } finally {
      this.isLoading = false;
      this.isRefreshing = false;
      this.notifySubscribers();
    }
  }

  // PERFORMANCE: Cached balance calculation
  private async calculateUserBalancesWithCache(userId: string) {
    // Clear settlement cache periodically to prevent stale data
    const now = Date.now();
    if ((now - this.lastRefreshTime) > 300000) { // 5 minutes
      SettlementCache.getInstance().clearCache();
    }
    
    return UnifiedSettlementService.calculateUserBalances(userId);
  }

  // Force clear cache and refresh
  forceRefresh(userId: string): Promise<void> {
    console.log('🚀 SharedBalanceManager: Force refresh requested - clearing all caches');
    this.lastRefreshTime = 0;
    SettlementCache.getInstance().clearCache(); // Clear cache on force refresh
    
    // Immediately notify subscribers with loading state
    this.isLoading = true;
    this.notifySubscribers();
    
    return this.refresh(userId, true);
  }

  // Get current state without subscribing
  getCurrentState() {
    return {
      balances: this.balances,
      friendsData: this.friendsData,
      isLoading: this.isLoading,
      error: this.error
    };
  }
}

// Main hook that uses the shared manager
export const useSharedBalances = () => {
  const { user } = useAuth();
  const manager = useMemo(() => SharedBalanceManager.getInstance(), []);
  const [state, setState] = useState(() => manager.getCurrentState());
  
  // Subscribe to manager updates
  useEffect(() => {
    const unsubscribe = manager.subscribe(setState);
    return unsubscribe;
  }, [manager]);

  // Initial load and refresh functions
  const refresh = useCallback(async (force = false) => {
    if (user?.id) {
      await manager.refresh(user.id, force);
    }
  }, [user?.id, manager]);

  const forceRefresh = useCallback(async () => {
    if (user?.id) {
      await manager.forceRefresh(user.id);
    }
  }, [user?.id, manager]);

  // Auto-refresh on user change
  useEffect(() => {
    if (user?.id) {
      console.log('🚀 useSharedBalances: Starting initial load for user:', user.id);
      refresh();
    } else {
      setState({
        balances: null,
        friendsData: [],
        isLoading: false,
        error: null
      });
    }
  }, [user?.id, refresh]);

  // Memoized computed values
  const friendIds = useMemo(() => {
    return new Set(
      state.friendsData
        .filter(friend => friend.status === 'accepted')
        .map(friend => friend.friendId)
    );
  }, [state.friendsData]);
  
  const friends = useMemo(() => {
    if (!state.balances?.details) return [];
    return state.balances.details.filter(detail => friendIds.has(detail.userId));
  }, [state.balances?.details, friendIds]);
  
  const groupMembers = useMemo(() => {
    if (!state.balances?.details) return [];
    return state.balances.details.filter(detail => 
      !friendIds.has(detail.userId) && (detail.source === 'group' || detail.source === 'mixed')
    );
  }, [state.balances?.details, friendIds]);
  
  const allBalances = useMemo(() => {
    if (!state.balances?.details) return [];
    return state.balances.details.map(detail => ({
      userId: detail.userId,
      name: detail.name,
      email: detail.email,
      balance: detail.balance,
      source: detail.source,
      groupName: detail.groupName,
      groupId: detail.groupId,
      breakdown: detail.breakdown
    }));
  }, [state.balances?.details]);

  return useMemo(() => ({
    // Core balance data
    balances: state.balances,
    isLoading: state.isLoading,
    error: state.error,
    
    // Summary totals
    totalOwed: state.balances?.totalOwed ?? 0,
    totalOwing: state.balances?.totalOwing ?? 0,
    netBalance: state.balances?.netBalance ?? 0,
    
    // Categorized balances
    friendBalances: friends,
    groupMemberBalances: groupMembers,
    allBalances,
    
    // Additional data
    friendsData: state.friendsData,
    
    // Actions
    refresh,
    forceRefresh,
    notifyChange: () => refresh(),
    
    // Status flags
    isEmpty: allBalances.length === 0,
    hasPositiveBalance: (state.balances?.totalOwed ?? 0) > 0,
    hasNegativeBalance: (state.balances?.totalOwing ?? 0) > 0,
    
    // Utilities
    calculateSettlementBalances: UnifiedSettlementService.calculateSettlementBalances
  }), [
    state.balances,
    state.isLoading,
    state.error,
    friends,
    groupMembers,
    allBalances,
    state.friendsData,
    refresh,
    forceRefresh
  ]);
};

// Specialized hooks that use the shared data
export const useOverviewBalances = () => {
  return useSharedBalances();
};

export const useFriendsBalances = () => {
  return useSharedBalances();
};

export default useSharedBalances;