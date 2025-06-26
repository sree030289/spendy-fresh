// services/DealsAPI.ts - Updated for Multi-Source Support
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration for different serverless providers
const SERVERLESS_CONFIGS = {
  firebase: {
    baseUrl: 'https://us-central1-spendy-97913.cloudfunctions.net',
    endpoints: {
      deals: '/getDeals',
      refresh: '/refreshDeals',
      health: '/healthCheck',
      // TODO: Implement these source-specific endpoints in Firebase Functions
      // For now, all requests go through the main /getDeals endpoint with source parameter
      // ozbargain: '/getOzBargainDeals',
      // coles: '/getColesDeals',
      // woolworths: '/getWoolworthsDeals',
      // costco: '/getCostcoDeals',
      // bunnings: '/getBunningsDeals',
      // jbhifi: '/getJBHiFiDeals',
      // goodguys: '/getGoodGuysDeals',
      // harveynorman: '/getHarveyNormanDeals',
    }
  }
};

// Choose your provider here
const PROVIDER = 'firebase';
const CONFIG = SERVERLESS_CONFIGS[PROVIDER];

const CACHE_KEY = '@deals_cache';
const SOURCE_CACHE_KEY = '@source_cache_';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Source-specific cache durations (some sources update more frequently)
const SOURCE_CACHE_DURATIONS = {
  ozbargain: 15 * 60 * 1000, // 15 minutes
  coles: 60 * 60 * 1000, // 1 hour
  woolworths: 60 * 60 * 1000, // 1 hour
  costco: 2 * 60 * 60 * 1000, // 2 hours
  bunnings: 4 * 60 * 60 * 1000, // 4 hours
  jbhifi: 2 * 60 * 60 * 1000, // 2 hours
  goodguys: 2 * 60 * 60 * 1000, // 2 hours
  harveynorman: 2 * 60 * 60 * 1000, // 2 hours
};

export interface Deal {
  id: string;
  title: string;
  description: string;
  category: 'Electronics' | 'Groceries' | 'Home & Garden' | 'Fashion' | 'Entertainment' | 'Sports';
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
  source: 'user' | 'ozbargain' | 'coles' | 'woolworths' | 'costco' | 'bunnings' | 'jbhifi' | 'goodguys' | 'harveynorman';
  dealUrl?: string;
  imageUrl?: string;
  tags?: string[];
  validUntil?: string;
  stockLevel?: 'high' | 'medium' | 'low' | 'out';
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
    [key: string]: number;
  };
  sourceStats?: {
    totalSources: number;
    activeSources: string[];
    lastRefresh: { [key: string]: string };
  };
}

interface CachedData {
  data: Deal[];
  timestamp: number;
  lastUpdated: string;
  source?: string;
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
          'User-Agent': 'Spendy-App/1.0',
        },
        // Increase timeout for serverless cold starts
        ...(global as any).fetch && { timeout: 45000 },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`API Response:`, { 
        endpoint, 
        dealsCount: data.deals?.length || 0, 
        totalDeals: data.pagination?.totalDeals || 0,
        source: params?.source || 'all'
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
    source: string = 'all',
    forceRefresh: boolean = false
  ): Promise<DealsResponse> {
    try {
      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedData = await this.getCachedDeals(source);
        if (cachedData) {
          return this.paginateDeals(cachedData.data, page, category, cachedData.lastUpdated, source);
        }
      }

      // Prepare query parameters
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '20',
      };
      
      if (category && category !== 'All') {
        params.category = category;
      }

      if (source && source !== 'all') {
        params.source = source;
      }
      
      if (forceRefresh) {
        params.refresh = 'true';
      }

      // For now, always use the main deals endpoint since source-specific endpoints don't exist yet
      // TODO: Implement source-specific endpoints in Firebase Functions
      const endpoint: keyof typeof CONFIG.endpoints = 'deals';
      
      const response = await this.makeRequest(endpoint, params);
      
      // Cache the data
      if (response.deals) {
        await this.cacheDeals(response.deals, response.lastUpdated, source);
      }

      return response;
    } catch (error) {
      console.error('Failed to fetch deals:', error);
      
      // Fallback to cache if available
      const cachedData = await this.getCachedDeals(source);
      if (cachedData) {
        console.log('Using cached data as fallback');
        return this.paginateDeals(cachedData.data, page, category, cachedData.lastUpdated, source);
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
          dealsPerPage: 20,
        },
        lastUpdated: new Date().toISOString(),
        sources: {},
      };
    }
  }

  static async refreshDeals(source: string = 'all'): Promise<{ success: boolean; message: string; totalDeals?: number }> {
    try {
      console.log(`Triggering manual deals refresh for source: ${source}...`);
      
      // For now, refresh using the main endpoint since source-specific endpoints don't exist
      // The backend should filter by source parameter
      const params: Record<string, string> = { 
        refresh: 'true', 
        page: '1', 
        limit: '50' 
      };
      
      if (source !== 'all') {
        params.source = source;
      }

      const response = await this.makeRequest('deals', params);
      
      // Clear cache to force fresh data on next fetch
      await AsyncStorage.removeItem(CACHE_KEY);
      if (source !== 'all') {
        await AsyncStorage.removeItem(`${SOURCE_CACHE_KEY}${source}`);
      }
      
      // Cache the new data
      if (response.deals) {
        await this.cacheDeals(response.deals, response.lastUpdated, source);
      }
      
      return {
        success: true,
        message: `Successfully refreshed ${response.pagination?.totalDeals || response.deals?.length || 0} deals from ${source}`,
        totalDeals: response.pagination?.totalDeals || response.deals?.length || 0,
      };
    } catch (error) {
      console.error('Failed to refresh deals:', error);
      return {
        success: false,
        message: `Failed to refresh deals from ${source}. Please check your connection.`,
      };
    }
  }

  static async getServerHealth(): Promise<{ 
    status: string; 
    cachedDeals: number; 
    platform?: string;
    sources?: { [key: string]: { status: string; lastUpdate: string; count: number } };
  }> {
    try {
      const response = await this.makeRequest('health');
      return response;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'ERROR', cachedDeals: 0 };
    }
  }

  private static async getCachedDeals(source: string = 'all'): Promise<CachedData | null> {
    try {
      const cacheKey = source === 'all' ? CACHE_KEY : `${SOURCE_CACHE_KEY}${source}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const cachedData: CachedData = JSON.parse(cached);
      const cacheDuration = source === 'all' ? CACHE_DURATION : (SOURCE_CACHE_DURATIONS[source as keyof typeof SOURCE_CACHE_DURATIONS] || CACHE_DURATION);
      const isExpired = Date.now() - cachedData.timestamp > cacheDuration;
      
      if (isExpired) {
        console.log(`Cache expired for ${source}, removing...`);
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
      
      console.log(`Using cached data for ${source}: ${cachedData.data.length} deals`);
      return cachedData;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  private static async cacheDeals(deals: Deal[], lastUpdated: string, source: string = 'all'): Promise<void> {
    try {
      const cacheKey = source === 'all' ? CACHE_KEY : `${SOURCE_CACHE_KEY}${source}`;
      const cacheData: CachedData = {
        data: deals,
        timestamp: Date.now(),
        lastUpdated,
        source,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`Cached ${deals.length} deals for ${source}`);
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  private static paginateDeals(
    deals: Deal[], 
    page: number, 
    category?: string, 
    lastUpdated?: string,
    source?: string
  ): DealsResponse {
    let filteredDeals = deals;
    
    // Filter by category
    if (category && category !== 'All') {
      filteredDeals = deals.filter(deal => deal.category === category);
    }

    // Sort deals by relevance and freshness
    filteredDeals.sort((a, b) => {
      // Priority: Partnership deals, then by likes, then by recency
      if (a.isPartnership && !b.isPartnership) return -1;
      if (!a.isPartnership && b.isPartnership) return 1;
      if (a.likes !== b.likes) return b.likes - a.likes;
      return new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime();
    });

    // Pagination
    const dealsPerPage = 20;
    const startIndex = (page - 1) * dealsPerPage;
    const endIndex = startIndex + dealsPerPage;
    const paginatedDeals = filteredDeals.slice(startIndex, endIndex);

    const totalPages = Math.ceil(filteredDeals.length / dealsPerPage);

    // Calculate source statistics
    const sourceStats = deals.reduce((acc, deal) => {
      acc[deal.source] = (acc[deal.source] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

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
      sources: sourceStats,
      sourceStats: {
        totalSources: Object.keys(sourceStats).length,
        activeSources: Object.keys(sourceStats),
        lastRefresh: { [source || 'all']: lastUpdated || new Date().toISOString() },
      },
    };
  }

  // Enhanced method to get deals by source with better filtering
  static async getDealsBySource(source: string, category?: string, page: number = 1): Promise<DealsResponse> {
    return this.fetchDeals(page, category, source, false);
  }

  // Method to get trending deals across all sources
  static async getTrendingDeals(limit: number = 10): Promise<Deal[]> {
    try {
      const cachedData = await this.getCachedDeals('all');
      if (cachedData) {
        return cachedData.data
          .sort((a, b) => (b.likes + b.discount * 0.1) - (a.likes + a.discount * 0.1))
          .slice(0, limit);
      }
      return [];
    } catch (error) {
      console.error('Error getting trending deals:', error);
      return [];
    }
  }

  // Method to search deals across all sources
  static async searchDeals(query: string, source?: string): Promise<Deal[]> {
    try {
      const cachedData = await this.getCachedDeals(source || 'all');
      if (cachedData) {
        const searchTerms = query.toLowerCase().split(' ');
        return cachedData.data.filter(deal => {
          const searchableText = `${deal.title} ${deal.description} ${deal.businessName || ''}`.toLowerCase();
          return searchTerms.some(term => searchableText.includes(term));
        });
      }
      return [];
    } catch (error) {
      console.error('Error searching deals:', error);
      return [];
    }
  }

  // Utility method to get deal by ID (for chat, details, etc.)
  static async getDealById(dealId: string): Promise<Deal | null> {
    try {
      const allSources = ['all', 'ozbargain', 'coles', 'woolworths', 'costco', 'bunnings', 'jbhifi', 'goodguys', 'harveynorman'];
      
      for (const source of allSources) {
        const cachedData = await this.getCachedDeals(source);
        if (cachedData) {
          const deal = cachedData.data.find(d => d.id === dealId);
          if (deal) return deal;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting deal by ID:', error);
      return null;
    }
  }

  // Enhanced interaction tracking with source consideration
  static async updateDealInteraction(
    dealId: string, 
    interaction: { liked?: boolean; disliked?: boolean }
  ): Promise<void> {
    try {
      const allSources = ['all', 'ozbargain', 'coles', 'woolworths', 'costco', 'bunnings', 'jbhifi', 'goodguys', 'harveynorman'];
      
      for (const source of allSources) {
        const cachedData = await this.getCachedDeals(source);
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

            await this.cacheDeals(cachedData.data, cachedData.lastUpdated, source);
          }
        }
      }
    } catch (error) {
      console.error('Error updating deal interaction:', error);
    }
  }

  // Method to clear cache for specific source or all
  static async clearCache(source?: string): Promise<void> {
    try {
      if (source) {
        const cacheKey = source === 'all' ? CACHE_KEY : `${SOURCE_CACHE_KEY}${source}`;
        await AsyncStorage.removeItem(cacheKey);
        console.log(`Cache cleared for ${source}`);
      } else {
        // Clear all caches
        const allSources = ['all', 'ozbargain', 'coles', 'woolworths', 'costco', 'bunnings', 'jbhifi', 'goodguys', 'harveynorman'];
        for (const src of allSources) {
          const cacheKey = src === 'all' ? CACHE_KEY : `${SOURCE_CACHE_KEY}${src}`;
          await AsyncStorage.removeItem(cacheKey);
        }
        console.log('All caches cleared');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Enhanced cache info with source-specific details
  static async getCacheInfo(): Promise<{
    total: { size: number; age: number; lastUpdated: string | null };
    sources: { [key: string]: { size: number; age: number; lastUpdated: string | null } };
  }> {
    try {
      const result = {
        total: { size: 0, age: 0, lastUpdated: null as string | null },
        sources: {} as { [key: string]: { size: number; age: number; lastUpdated: string | null } },
      };

      const allSources = ['all', 'ozbargain', 'coles', 'woolworths', 'costco', 'bunnings', 'jbhifi', 'goodguys', 'harveynorman'];
      
      for (const source of allSources) {
        const cachedData = await this.getCachedDeals(source);
        if (cachedData) {
          const info = {
            size: cachedData.data.length,
            age: Math.floor((Date.now() - cachedData.timestamp) / 1000),
            lastUpdated: cachedData.lastUpdated,
          };
          
          result.sources[source] = info;
          
          if (source === 'all') {
            result.total = info;
          }
        } else {
          result.sources[source] = { size: 0, age: 0, lastUpdated: null };
        }
      }

      return result;
    } catch (error) {
      return {
        total: { size: 0, age: 0, lastUpdated: null },
        sources: {},
      };
    }
  }

  // Configuration helper
  static getConfig() {
    return {
      provider: PROVIDER,
      baseUrl: CONFIG.baseUrl,
      endpoints: CONFIG.endpoints,
      supportedSources: Object.keys(CONFIG.endpoints).filter(key => 
        !['deals', 'refresh', 'health'].includes(key)
      ),
    };
  }
}

// Enhanced hook for multi-source deals management
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
  cacheInfo: {
    total: { size: number; age: number; lastUpdated: string | null };
    sources: { [key: string]: { size: number; age: number; lastUpdated: string | null } };
  };
  sourceStats: DealsResponse['sourceStats'] | null;
}

export const useDeals = (category: string = 'All', source: string = 'all'): UseDealsResult => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<DealsResponse['pagination'] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sourceStats, setSourceStats] = useState<DealsResponse['sourceStats'] | null>(null);
  const [cacheInfo, setCacheInfo] = useState({
    total: { size: 0, age: 0, lastUpdated: null as string | null },
    sources: {} as { [key: string]: { size: number; age: number; lastUpdated: string | null } },
  });

  const updateCacheInfo = useCallback(async () => {
    const info = await DealsAPI.getCacheInfo();
    setCacheInfo(info);
  }, []);

  const loadDeals = useCallback(async (page: number = 1, forceRefresh: boolean = false, append: boolean = false) => {
    try {
      if (!append) setLoading(true);
      setError(null);

      console.log(`Loading deals: page=${page}, category=${category}, source=${source}, forceRefresh=${forceRefresh}, append=${append}`);

      const response = await DealsAPI.fetchDeals(page, category, source, forceRefresh);
      
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
      setSourceStats(response.sourceStats || null);
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
          const sourceCache = cacheInfo.sources[source];
          if (sourceCache && sourceCache.size > 0) {
            console.log('Attempting to use cached data after error');
            const cachedResponse = await DealsAPI.fetchDeals(1, category, source, false);
            setDeals(cachedResponse.deals);
            setPagination(cachedResponse.pagination);
            setLastUpdated(cachedResponse.lastUpdated);
            setSourceStats(cachedResponse.sourceStats || null);
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
  }, [category, source, updateCacheInfo]);

  const refreshDeals = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      console.log(`Manual refresh triggered for source: ${source}`);
      const refreshResult = await DealsAPI.refreshDeals(source);
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
  }, [loadDeals, source]);

  const loadMore = useCallback(async () => {
    if (pagination && pagination.hasNextPage && !loading && !isRefreshing) {
      console.log(`Loading more deals: page ${currentPage + 1} for source ${source}`);
      await loadDeals(currentPage + 1, false, true);
    }
  }, [pagination, currentPage, loading, isRefreshing, loadDeals, source]);

  // Initial load and dependency change effect
  useEffect(() => {
    console.log(`useDeals effect triggered: category=${category}, source=${source}`);
    setCurrentPage(1);
    setDeals([]);
    loadDeals(1);
  }, [category, source]); // Depend on both category and source

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
    sourceStats,
  };
};

// Debug helper hook with enhanced source tracking
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

  const clearCache = useCallback(async (source?: string) => {
    await DealsAPI.clearCache(source);
    await getDebugInfo();
  }, [getDebugInfo]);

  const refreshSource = useCallback(async (source: string) => {
    const result = await DealsAPI.refreshDeals(source);
    await getDebugInfo();
    return result;
  }, [getDebugInfo]);

  return {
    debugInfo,
    getDebugInfo,
    clearCache,
    refreshSource,
  };
};