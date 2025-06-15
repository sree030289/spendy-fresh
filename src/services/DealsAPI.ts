// services/DealsAPI.ts - Updated for Serverless Functions
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration for different serverless providers
const SERVERLESS_CONFIGS = {
  firebase: {
    baseUrl: 'https://us-central1-spendy-97913.cloudfunctions.net',
    endpoints: {
      deals: '/getDeals',
      refresh: '/refreshDeals',
      health: '/healthCheck',
    }
  }
};


// Choose your provider here
const PROVIDER = 'firebase'; // Change to 'firebase', 'vercel', or 'netlify'
const CONFIG = SERVERLESS_CONFIGS[PROVIDER];

const CACHE_KEY = '@deals_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export interface Deal {
  id: string;
  title: string;
  description: string;
  category: 'OTT' | 'Freebies' | 'Group Buying' | 'Local Deals' | 'Partners';
  originalPrice: number;
  discountedPrice: number;
  discount: number;
  expiresAt: string;
  postedBy: string;
  likes: number;
  dislikes: number;
  userLiked?: boolean;
  userDisliked?: boolean;
  isGroupDeal: boolean;
  groupProgress?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  chatEnabled: boolean;
  isPartnership: boolean;
  businessName?: string;
  location?: string;
  source?: 'user' | 'ozbargain' | 'groupon' | 'catch' | 'partner';
  dealUrl?: string;
}

export interface DealsResponse {
  deals: Deal[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalDeals: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    dealsPerPage: number;
  };
  lastUpdated: string;
  sources?: {
    ozbargain?: number;
    groupon?: number;
    catch?: number;
  };
}

interface CachedData {
  data: Deal[];
  timestamp: number;
  lastUpdated: string;
}

export class DealsAPI {
  private static getEndpointUrl(endpoint: keyof typeof CONFIG.endpoints): string {
    return `${CONFIG.baseUrl}${CONFIG.endpoints[endpoint]}`;
  }

  private static async makeRequest(endpoint: keyof typeof CONFIG.endpoints, params?: Record<string, string>): Promise<any> {
    try {
      const url = this.getEndpointUrl(endpoint);
      const queryParams = params ? new URLSearchParams(params).toString() : '';
      const fullUrl = queryParams ? `${url}?${queryParams}` : url;
      
      console.log(`Making request to: ${fullUrl}`);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        // Increase timeout for serverless cold starts
        ...(global as any).fetch && { timeout: 30000 },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`API Response:`, { 
        endpoint, 
        dealsCount: data.deals?.length || 0, 
        totalDeals: data.pagination?.totalDeals || 0 
      });
      
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  static async fetchDeals(
    page: number = 1,
    category?: string,
    forceRefresh: boolean = false
  ): Promise<DealsResponse> {
    try {
      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedData = await this.getCachedDeals();
        if (cachedData) {
          return this.paginateDeals(cachedData.data, page, category, cachedData.lastUpdated);
        }
      }

      // Prepare query parameters
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '10',
      };
      
      if (category && category !== 'All') {
        params.category = category;
      }
      
      if (forceRefresh) {
        params.refresh = 'true';
      }

      const response = await this.makeRequest('deals', params);
      
      // Cache the full dataset if this is page 1 and we got all deals
      if (page === 1 && response.deals) {
        // For serverless, we might get paginated data, so we need to fetch all pages for cache
        await this.cacheDeals(response.deals, response.lastUpdated);
      }

      return response;
    } catch (error) {
      console.error('Failed to fetch deals:', error);
      
      // Fallback to cache if available
      const cachedData = await this.getCachedDeals();
      if (cachedData) {
        console.log('Using cached data as fallback');
        return this.paginateDeals(cachedData.data, page, category, cachedData.lastUpdated);
      }

      // Return empty response as last resort
      return {
        deals: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalDeals: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          dealsPerPage: 10,
        },
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  static async refreshDeals(): Promise<{ success: boolean; message: string; totalDeals?: number }> {
    try {
      console.log('Triggering manual deals refresh...');
      
      // For serverless functions, we'll call the deals endpoint with refresh=true
      // since most serverless platforms don't support separate refresh endpoints easily
      const response = await this.makeRequest('deals', { refresh: 'true', page: '1', limit: '50' });
      
      // Clear cache to force fresh data on next fetch
      await AsyncStorage.removeItem(CACHE_KEY);
      
      // Cache the new data
      if (response.deals) {
        await this.cacheDeals(response.deals, response.lastUpdated);
      }
      
      return {
        success: true,
        message: `Successfully refreshed ${response.pagination?.totalDeals || response.deals?.length || 0} deals`,
        totalDeals: response.pagination?.totalDeals || response.deals?.length || 0,
      };
    } catch (error) {
      console.error('Failed to refresh deals:', error);
      return {
        success: false,
        message: 'Failed to refresh deals. Please check your connection.',
      };
    }
  }

  static async getServerHealth(): Promise<{ status: string; cachedDeals: number; platform?: string }> {
    try {
      const response = await this.makeRequest('health');
      return response;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'ERROR', cachedDeals: 0 };
    }
  }

  private static async getCachedDeals(): Promise<CachedData | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const cachedData: CachedData = JSON.parse(cached);
      const isExpired = Date.now() - cachedData.timestamp > CACHE_DURATION;
      
      if (isExpired) {
        console.log('Cache expired, removing...');
        await AsyncStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      console.log(`Using cached data: ${cachedData.data.length} deals`);
      return cachedData;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  private static async cacheDeals(deals: Deal[], lastUpdated: string): Promise<void> {
    try {
      const cacheData: CachedData = {
        data: deals,
        timestamp: Date.now(),
        lastUpdated,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log(`Cached ${deals.length} deals`);
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  private static paginateDeals(
    deals: Deal[], 
    page: number, 
    category?: string, 
    lastUpdated?: string
  ): DealsResponse {
    let filteredDeals = deals;
    
    // Filter by category
    if (category && category !== 'All') {
      filteredDeals = deals.filter(deal => deal.category === category);
    }

    // Pagination
    const dealsPerPage = 10;
    const startIndex = (page - 1) * dealsPerPage;
    const endIndex = startIndex + dealsPerPage;
    const paginatedDeals = filteredDeals.slice(startIndex, endIndex);

    const totalPages = Math.ceil(filteredDeals.length / dealsPerPage);

    return {
      deals: paginatedDeals,
      pagination: {
        currentPage: page,
        totalPages,
        totalDeals: filteredDeals.length,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        dealsPerPage,
      },
      lastUpdated: lastUpdated || new Date().toISOString(),
    };
  }

  // Utility method to get deal by ID (for chat, details, etc.)
  static async getDealById(dealId: string): Promise<Deal | null> {
    try {
      const cachedData = await this.getCachedDeals();
      if (cachedData) {
        return cachedData.data.find(deal => deal.id === dealId) || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting deal by ID:', error);
      return null;
    }
  }

  // Method to track user interactions (likes, etc.)
  static async updateDealInteraction(
    dealId: string, 
    interaction: { liked?: boolean; disliked?: boolean }
  ): Promise<void> {
    try {
      const cachedData = await this.getCachedDeals();
      if (cachedData) {
        const dealIndex = cachedData.data.findIndex(deal => deal.id === dealId);
        if (dealIndex !== -1) {
          const deal = cachedData.data[dealIndex];
          
          if (interaction.liked !== undefined) {
            if (interaction.liked && !deal.userLiked) {
              deal.likes += 1;
              if (deal.userDisliked) {
                deal.dislikes -= 1;
                deal.userDisliked = false;
              }
            } else if (!interaction.liked && deal.userLiked) {
              deal.likes -= 1;
            }
            deal.userLiked = interaction.liked;
          }

          if (interaction.disliked !== undefined) {
            if (interaction.disliked && !deal.userDisliked) {
              deal.dislikes += 1;
              if (deal.userLiked) {
                deal.likes -= 1;
                deal.userLiked = false;
              }
            } else if (!interaction.disliked && deal.userDisliked) {
              deal.dislikes -= 1;
            }
            deal.userDisliked = interaction.disliked;
          }

          await this.cacheDeals(cachedData.data, cachedData.lastUpdated);
        }
      }
    } catch (error) {
      console.error('Error updating deal interaction:', error);
    }
  }

  // Method to clear cache (useful for debugging)
  static async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      console.log('Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Method to get cache info
  static async getCacheInfo(): Promise<{ size: number; age: number; lastUpdated: string | null }> {
    try {
      const cachedData = await this.getCachedDeals();
      if (cachedData) {
        return {
          size: cachedData.data.length,
          age: Math.floor((Date.now() - cachedData.timestamp) / 1000),
          lastUpdated: cachedData.lastUpdated,
        };
      }
      return { size: 0, age: 0, lastUpdated: null };
    } catch (error) {
      return { size: 0, age: 0, lastUpdated: null };
    }
  }

  // Configuration helper
  static getConfig() {
    return {
      provider: PROVIDER,
      baseUrl: CONFIG.baseUrl,
      endpoints: CONFIG.endpoints,
    };
  }
}

// Hook for easier integration with serverless functions
import { useState, useEffect, useCallback } from 'react';

export interface UseDealsResult {
  deals: Deal[];
  loading: boolean;
  error: string | null;
  pagination: DealsResponse['pagination'] | null;
  lastUpdated: string | null;
  refreshDeals: () => Promise<void>;
  loadMore: () => Promise<void>;
  canLoadMore: boolean;
  cacheInfo: { size: number; age: number; lastUpdated: string | null };
}

export const useDeals = (category: string = 'All'): UseDealsResult => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<DealsResponse['pagination'] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheInfo, setCacheInfo] = useState({ size: 0, age: 0, lastUpdated: null });

  const updateCacheInfo = useCallback(async () => {
    const info = await DealsAPI.getCacheInfo();
    setCacheInfo(info);
  }, []);

  const loadDeals = useCallback(async (page: number = 1, forceRefresh: boolean = false, append: boolean = false) => {
    try {
      if (!append) setLoading(true);
      setError(null);

      console.log(`Loading deals: page=${page}, category=${category}, forceRefresh=${forceRefresh}, append=${append}`);

      const response = await DealsAPI.fetchDeals(page, category, forceRefresh);
      
      if (append) {
        setDeals(prev => {
          // Avoid duplicates when appending
          const existingIds = new Set(prev.map(deal => deal.id));
          const newDeals = response.deals.filter(deal => !existingIds.has(deal.id));
          return [...prev, ...newDeals];
        });
      } else {
        setDeals(response.deals);
      }
      
      setPagination(response.pagination);
      setLastUpdated(response.lastUpdated);
      setCurrentPage(page);
      
      await updateCacheInfo();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load deals';
      setError(errorMessage);
      console.error('Error loading deals:', err);
      
      // If it's the first load and we have cache, try to use it
      if (!append && page === 1) {
        try {
          const cacheInfo = await DealsAPI.getCacheInfo();
          if (cacheInfo.size > 0) {
            console.log('Attempting to use cached data after error');
            const cachedResponse = await DealsAPI.fetchDeals(1, category, false);
            setDeals(cachedResponse.deals);
            setPagination(cachedResponse.pagination);
            setLastUpdated(cachedResponse.lastUpdated);
            setError('Using cached data - some deals may be outdated');
          }
        } catch (cacheError) {
          console.error('Failed to load cached data:', cacheError);
        }
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [category, updateCacheInfo]);

  const refreshDeals = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      console.log('Manual refresh triggered');
      const refreshResult = await DealsAPI.refreshDeals();
      if (refreshResult.success) {
        await loadDeals(1, true, false);
        setCurrentPage(1);
        console.log('Refresh completed successfully');
      } else {
        setError(refreshResult.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh deals';
      setError(errorMessage);
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDeals]);

  const loadMore = useCallback(async () => {
    if (pagination && pagination.hasNextPage && !loading && !isRefreshing) {
      console.log(`Loading more deals: page ${currentPage + 1}`);
      await loadDeals(currentPage + 1, false, true);
    }
  }, [pagination, currentPage, loading, isRefreshing, loadDeals]);

  // Initial load and category change effect
  useEffect(() => {
    console.log(`useDeals effect triggered: category=${category}`);
    setCurrentPage(1);
    setDeals([]);
    loadDeals(1);
  }, [category]); // Only depend on category, not loadDeals to avoid infinite loops

  // Update cache info on mount
  useEffect(() => {
    updateCacheInfo();
  }, [updateCacheInfo]);

  return {
    deals,
    loading: loading || isRefreshing,
    error,
    pagination,
    lastUpdated,
    refreshDeals,
    loadMore,
    canLoadMore: pagination?.hasNextPage || false,
    cacheInfo,
  };
};

// Debug helper hook
export const useDealsDebug = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const getDebugInfo = useCallback(async () => {
    const config = DealsAPI.getConfig();
    const cacheInfo = await DealsAPI.getCacheInfo();
    const healthInfo = await DealsAPI.getServerHealth();

    setDebugInfo({
      config,
      cache: cacheInfo,
      server: healthInfo,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const clearCache = useCallback(async () => {
    await DealsAPI.clearCache();
    await getDebugInfo();
  }, [getDebugInfo]);

  return {
    debugInfo,
    getDebugInfo,
    clearCache,
  };
};