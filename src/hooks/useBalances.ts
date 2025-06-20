// src/hooks/useBalances.ts - Unified Balance Hook

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import BalanceManager, { BalanceSummary, BalanceDetail, BalanceDisplayConfig } from '@/services/BalanceManager';

interface UseBalancesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  displayConfig?: BalanceDisplayConfig;
}

interface UseBalancesReturn {
  // Main balance data
  balances: BalanceSummary | null;
  isLoading: boolean;
  error: string | null;
  
  // Formatted data for display
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  
  // Organized balance details
  friendBalances: BalanceDetail[];
  groupMemberBalances: BalanceDetail[];
  allBalances: BalanceDetail[];
  
  // Actions
  refresh: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  notifyChange: () => void;
  
  // Display helpers
  getBalanceText: (balance: number) => { text: string; color: string; symbol: string };
  isEmpty: boolean;
  hasPositiveBalance: boolean;
  hasNegativeBalance: boolean;
}

export const useBalances = (options: UseBalancesOptions = {}): UseBalancesReturn => {
  const { user } = useAuth();
  const balanceManager = BalanceManager.getInstance();
  
  const [balances, setBalances] = useState<BalanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const listenerRef = useRef<(() => void) | null>(null);

  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    displayConfig = {
      showZeroBalances: false,
      sortBy: 'amount',
      sortOrder: 'desc',
      groupSeparately: true
    }
  } = options;

  // Refresh function
  const refresh = useCallback(async (force: boolean = false) => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const freshBalances = await balanceManager.getBalances(user.id, force);
      setBalances(freshBalances);
      
    } catch (err) {
      console.error('Error refreshing balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to load balances');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, balanceManager]);

  const forceRefresh = useCallback(() => refresh(true), [refresh]);

  // Notify balance change
  const notifyChange = useCallback(() => {
    if (user?.id) {
      balanceManager.notifyBalanceChange(user.id);
    }
  }, [user?.id, balanceManager]);

  // Set up listener and initial load
  useEffect(() => {
    if (!user?.id) {
      setBalances(null);
      setIsLoading(false);
      return;
    }

    // Set up listener for balance updates
    listenerRef.current = balanceManager.addListener(user.id, (updatedBalances) => {
      setBalances(updatedBalances);
      setIsLoading(false);
    });

    // Initial load
    refresh();

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [user?.id, refresh, balanceManager]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !user?.id) return;

    refreshIntervalRef.current = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, refresh, user?.id]);

  // Format balances for display
  const formattedBalances = balances ? 
    balanceManager.formatBalancesForDisplay(balances, displayConfig) : 
    { friends: [], groupMembers: [], combined: [] };

  // Helper function for balance display text
  const getBalanceText = useCallback((balance: number) => {
    const result = balanceManager.getBalanceDisplayText(balance);
    
    // Map to theme colors
    const colorMap = {
      positive: '#10B981', // Green for money owed to you
      negative: '#EF4444', // Red for money you owe
      neutral: '#6B7280'   // Gray for settled
    };

    return {
      ...result,
      color: colorMap[result.color]
    };
  }, [balanceManager]);

  // Computed values
  const totalOwed = balances?.totalOwed ?? 0;
  const totalOwing = balances?.totalOwing ?? 0;
  const netBalance = balances?.netBalance ?? 0;
  
  const isEmpty = formattedBalances.combined.length === 0;
  const hasPositiveBalance = totalOwed > 0;
  const hasNegativeBalance = totalOwing > 0;

  return {
    // Main data
    balances,
    isLoading,
    error,
    
    // Computed values
    totalOwed,
    totalOwing,
    netBalance,
    
    // Organized data
    friendBalances: formattedBalances.friends,
    groupMemberBalances: formattedBalances.groupMembers,
    allBalances: formattedBalances.combined,
    
    // Actions
    refresh: () => refresh(false),
    forceRefresh,
    notifyChange,
    
    // Helpers
    getBalanceText,
    isEmpty,
    hasPositiveBalance,
    hasNegativeBalance
  };
};

// Specialized hooks for specific use cases
export const useOverviewBalances = () => {
  return useBalances({
    autoRefresh: true,
    refreshInterval: 15000, // More frequent for overview
    displayConfig: {
      showZeroBalances: false,
      sortBy: 'amount',
      sortOrder: 'desc',
      groupSeparately: false
    }
  });
};

export const useFriendsBalances = () => {
  return useBalances({
    autoRefresh: true,
    refreshInterval: 30000,
    displayConfig: {
      showZeroBalances: false,
      sortBy: 'amount',
      sortOrder: 'desc',
      groupSeparately: true
    }
  });
};

export const useGroupBalances = (groupId?: string) => {
  const { balances, ...rest } = useBalances({
    autoRefresh: true,
    refreshInterval: 20000,
    displayConfig: {
      showZeroBalances: true,
      sortBy: 'name',
      sortOrder: 'asc',
      groupSeparately: false
    }
  });

  // Filter to specific group if provided
  const groupSpecificBalances = groupId && balances ? {
    ...balances,
    details: balances.details.filter(detail => 
      detail.source === 'group' && detail.groupId === groupId
    )
  } : balances;

  return {
    balances: groupSpecificBalances,
    ...rest
  };
};

export default useBalances;