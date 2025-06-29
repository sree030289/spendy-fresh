// services/DealsAPI.ts - Fixed with correct Firebase URLs
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Functions Configuration - CORRECTED URLs
const CONFIG = {
  baseUrl: 'https://us-central1-spendy-97913.cloudfunctions.net',
  endpoints: {
    deals: '/getDeals',
    refresh: '/refreshDeals',
    health: '/healthCheck',
    categories: '/getCategories',
    debug: '/debugScrape', // New debug endpoint
  }
};

const CACHE_KEY = '@ozbargain_deals_cache_';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// OzBargain Categories
export const OZBARGAIN_CATEGORIES = [
  'All Deals',
  'Long Running', 
  'Freebies',
  'Alcohol',
  'Automotive',
  'Books & Magazines',
  'Computing',
  'Dining & Takeaway',
  'Education',
  'Electrical & Electronics',
  'Entertainment',
  'Fashion & Apparel',
  'Financial',
  'Gaming',
  'Groceries',
  'Health & Beauty',
  'Home & Garden',
  'Internet',
  'Mobile',
  'Pets',
  'Sports & Outdoors',
  'Toys & Kids',
  'Travel',
  'Other'
];

export interface Deal {
  id: string;
  title: string;
  description: string;
  category: string;
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
  chatEnabled: boolean;
  isPartnership: boolean;
  businessName?: string;
  location?: string;
  source: 'ozbargain';
  dealUrl: string;
  ozBargainUrl?: string;
  tags?: string[];
  stockLevel?: 'high' | 'medium' | 'low' | 'out';
  categoryIcon?: string;
  timePosted?: string;
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
  category: string;
  availableCategories: string[];
  source: 'ozbargain';
}

interface CachedData {
  data: Deal[];
  timestamp: number;
  lastUpdated: string;
  category: string;
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
          'User-Agent': 'Spendy-App/2.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`API Response:`, { 
        endpoint, 
        dealsCount: data.deals?.length || 0, 
        totalDeals: data.pagination?.totalDeals || 0,
        category: data.category || params?.category || 'unknown'
      });
      
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  static async fetchDeals(
    page: number = 1,
    category: string = 'All Deals',
    forceRefresh: boolean = false
  ): Promise<DealsResponse> {
    try {
      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedData = await this.getCachedDeals(category);
        if (cachedData) {
          return this.paginateDeals(cachedData.data, page, category, cachedData.lastUpdated);
        }
      }

      // Prepare query parameters
      const params: Record<string, string> = {
        page: page.toString(),
        limit: '50',
        category: category
      };
      
      if (forceRefresh) {
        params.refresh = 'true';
      }

      const response = await this.makeRequest('deals', params);
      
      // Cache the data
      if (response.deals) {
        await this.cacheDeals(response.deals, response.lastUpdated, category);
      }

      return response;
    } catch (error) {
      console.error('Failed to fetch deals:', error);
      
      // Fallback to cache if available
      const cachedData = await this.getCachedDeals(category);
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
          dealsPerPage: 20,
        },
        lastUpdated: new Date().toISOString(),
        category: category,
        availableCategories: OZBARGAIN_CATEGORIES,
        source: 'ozbargain',
      };
    }
  }

  static async refreshDeals(category: string = 'All Deals'): Promise<{ success: boolean; message: string; totalDeals?: number }> {
    try {
      console.log(`Triggering manual deals refresh for category: ${category}...`);
      
      const params: Record<string, string> = { 
        category: category
      };

      const response = await this.makeRequest('refresh', params);
      
      // Clear cache to force fresh data on next fetch
      await AsyncStorage.removeItem(`${CACHE_KEY}${category.toLowerCase().replace(/\s+/g, '_')}`);
      
      return {
        success: true,
        message: response.message || `Successfully refreshed ${response.totalDeals || 0} deals for ${category}`,
        totalDeals: response.totalDeals || 0,
      };
    } catch (error) {
      console.error('Failed to refresh deals:', error);
      return {
        success: false,
        message: `Failed to refresh deals for ${category}. Please check your connection.`,
      };
    }
  }

  static async debugScrape(category: string = 'All Deals'): Promise<any> {
    try {
      console.log(`Running debug scrape for category: ${category}...`);
      
      const params: Record<string, string> = { 
        category: category
      };

      const response = await this.makeRequest('debug', params);
      return response;
    } catch (error) {
      console.error('Debug scrape failed:', error);
      throw error;
    }
  }

  static async getServerHealth(): Promise<{ 
    status: string; 
    cachedDeals: number; 
    platform?: string;
    availableCategories?: string[];
    categoryHealth?: { [key: string]: any };
  }> {
    try {
      const response = await this.makeRequest('health');
      return response;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'ERROR', cachedDeals: 0 };
    }
  }

  static async getAvailableCategories(): Promise<string[]> {
    try {
      const response = await this.makeRequest('categories');
      return response.categories || OZBARGAIN_CATEGORIES;
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      return OZBARGAIN_CATEGORIES;
    }
  }

  private static async getCachedDeals(category: string): Promise<CachedData | null> {
    try {
      const cacheKey = `${CACHE_KEY}${category.toLowerCase().replace(/\s+/g, '_')}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const cachedData: CachedData = JSON.parse(cached);
      const isExpired = Date.now() - cachedData.timestamp > CACHE_DURATION;
      
      if (isExpired) {
        console.log(`Cache expired for ${category}, removing...`);
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
      
      console.log(`Using cached data for ${category}: ${cachedData.data.length} deals`);
      return cachedData;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  private static async cacheDeals(deals: Deal[], lastUpdated: string, category: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_KEY}${category.toLowerCase().replace(/\s+/g, '_')}`;
      const cacheData: CachedData = {
        data: deals,
        timestamp: Date.now(),
        lastUpdated,
        category,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`Cached ${deals.length} deals for ${category}`);
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  private static paginateDeals(
    deals: Deal[], 
    page: number, 
    category: string,
    lastUpdated?: string
  ): DealsResponse {
    // Sort deals by relevance (likes first, then by recency)
    const sortedDeals = deals.sort((a, b) => {
      if (a.likes !== b.likes) return b.likes - a.likes;
      return new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime();
    });

    // Pagination
    const dealsPerPage = 20;
    const startIndex = (page - 1) * dealsPerPage;
    const endIndex = startIndex + dealsPerPage;
    const paginatedDeals = sortedDeals.slice(startIndex, endIndex);

    const totalPages = Math.ceil(sortedDeals.length / dealsPerPage);

    return {
      deals: paginatedDeals,
      pagination: {
        currentPage: page,
        totalPages,
        totalDeals: sortedDeals.length,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        dealsPerPage,
      },
      lastUpdated: lastUpdated || new Date().toISOString(),
      category: category,
      availableCategories: OZBARGAIN_CATEGORIES,
      source: 'ozbargain',
    };
  }

  // Get deals by category
  static async getDealsByCategory(category: string, page: number = 1): Promise<DealsResponse> {
    return this.fetchDeals(page, category, false);
  }

  // Search deals within a category
  static async searchDeals(query: string, category?: string): Promise<Deal[]> {
    try {
      const searchCategory = category || 'All Deals';
      const cachedData = await this.getCachedDeals(searchCategory);
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

  // Get deal by ID
  static async getDealById(dealId: string): Promise<Deal | null> {
    try {
      for (const category of OZBARGAIN_CATEGORIES) {
        const cachedData = await this.getCachedDeals(category);
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

  // Update deal interaction (likes/dislikes)
  static async updateDealInteraction(
    dealId: string, 
    interaction: { liked?: boolean; disliked?: boolean }
  ): Promise<void> {
    try {
      for (const category of OZBARGAIN_CATEGORIES) {
        const cachedData = await this.getCachedDeals(category);
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

            await this.cacheDeals(cachedData.data, cachedData.lastUpdated, category);
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error updating deal interaction:', error);
    }
  }

  // Clear cache for specific category or all
  static async clearCache(category?: string): Promise<void> {
    try {
      if (category) {
        const cacheKey = `${CACHE_KEY}${category.toLowerCase().replace(/\s+/g, '_')}`;
        await AsyncStorage.removeItem(cacheKey);
        console.log(`Cache cleared for ${category}`);
      } else {
        // Clear all category caches
        for (const cat of OZBARGAIN_CATEGORIES) {
          const cacheKey = `${CACHE_KEY}${cat.toLowerCase().replace(/\s+/g, '_')}`;
          await AsyncStorage.removeItem(cacheKey);
        }
        console.log('All caches cleared');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Get cache information
  static async getCacheInfo(): Promise<{
    total: { size: number; age: number; lastUpdated: string | null };
    categories: { [key: string]: { size: number; age: number; lastUpdated: string | null } };
  }> {
    try {
      const result = {
        total: { size: 0, age: 0, lastUpdated: null as string | null },
        categories: {} as { [key: string]: { size: number; age: number; lastUpdated: string | null } },
      };

      for (const category of OZBARGAIN_CATEGORIES) {
        const cachedData = await this.getCachedDeals(category);
        if (cachedData) {
          const info = {
            size: cachedData.data.length,
            age: Math.floor((Date.now() - cachedData.timestamp) / 1000),
            lastUpdated: cachedData.lastUpdated,
          };
          
          result.categories[category] = info;
          result.total.size += info.size;
          
          if (!result.total.lastUpdated || 
              (cachedData.lastUpdated && new Date(cachedData.lastUpdated) > new Date(result.total.lastUpdated))) {
            result.total.lastUpdated = cachedData.lastUpdated;
            result.total.age = info.age;
          }
        } else {
          result.categories[category] = { size: 0, age: 0, lastUpdated: null };
        }
      }

      return result;
    } catch (error) {
      return {
        total: { size: 0, age: 0, lastUpdated: null },
        categories: {},
      };
    }
  }

  // Configuration helper
  static getConfig() {
    return {
      baseUrl: CONFIG.baseUrl,
      endpoints: CONFIG.endpoints,
      supportedCategories: OZBARGAIN_CATEGORIES,
      cacheConfig: {
        duration: CACHE_DURATION,
        keyPrefix: CACHE_KEY,
      },
    };
  }
}

// Enhanced hook for OzBargain deals management
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
    categories: { [key: string]: { size: number; age: number; lastUpdated: string | null } };
  };
  availableCategories: string[];
}

export const useDeals = (category: string = 'All Deals'): UseDealsResult => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<DealsResponse['pagination'] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>(OZBARGAIN_CATEGORIES);
  const [cacheInfo, setCacheInfo] = useState({
    total: { size: 0, age: 0, lastUpdated: null as string | null },
    categories: {} as { [key: string]: { size: number; age: number; lastUpdated: string | null } },
  });

  const updateCacheInfo = useCallback(async () => {
    const info = await DealsAPI.getCacheInfo();
    setCacheInfo(info);
  }, []);

  const loadDeals = useCallback(async (page: number = 1, forceRefresh: boolean = false, append: boolean = false) => {
    try {
      if (!append) setLoading(true);
      setError(null);

      console.log(`Loading OzBargain deals: page=${page}, category=${category}, forceRefresh=${forceRefresh}, append=${append}`);

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
      setAvailableCategories(response.availableCategories);
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
          const categoryCache = cacheInfo.categories[category];
          if (categoryCache && categoryCache.size > 0) {
            console.log('Attempting to use cached data after error');
            const cachedResponse = await DealsAPI.fetchDeals(1, category, false);
            setDeals(cachedResponse.deals);
            setPagination(cachedResponse.pagination);
            setLastUpdated(cachedResponse.lastUpdated);
            setAvailableCategories(cachedResponse.availableCategories);
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
      console.log(`Manual refresh triggered for category: ${category}`);
      const refreshResult = await DealsAPI.refreshDeals(category);
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
  }, [loadDeals, category]);

  const loadMore = useCallback(async () => {
    if (pagination && pagination.hasNextPage && !loading && !isRefreshing) {
      console.log(`Loading more deals: page ${currentPage + 1} for category ${category}`);
      await loadDeals(currentPage + 1, false, true);
    }
  }, [pagination, currentPage, loading, isRefreshing, loadDeals, category]);

  // Initial load and category change effect
  useEffect(() => {
    console.log(`useDeals effect triggered: category=${category}`);
    setCurrentPage(1);
    setDeals([]);
    loadDeals(1);
  }, [category]);

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
    availableCategories,
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

  const clearCache = useCallback(async (category?: string) => {
    await DealsAPI.clearCache(category);
    await getDebugInfo();
  }, [getDebugInfo]);

  const refreshCategory = useCallback(async (category: string) => {
    const result = await DealsAPI.refreshDeals(category);
    await getDebugInfo();
    return result;
  }, [getDebugInfo]);

  const debugScrape = useCallback(async (category: string) => {
    const result = await DealsAPI.debugScrape(category);
    await getDebugInfo();
    return result;
  }, [getDebugInfo]);

  return {
    debugInfo,
    getDebugInfo,
    clearCache,
    refreshCategory,
    debugScrape,
  };
};