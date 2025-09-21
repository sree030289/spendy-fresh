// src/services/DeepLinkingService.ts
import { Linking, Platform } from 'react-native';
import { CrossPlatformAlert } from '@/utils/alertUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Deep linking configuration
const DEEP_LINK_CONFIG = {
  scheme: 'letssplit',
  host: 'app.meetnsplit.com',
  appStore: {
    ios: 'https://apps.apple.com/au/app/spendy/id123456789', // Replace with actual App Store ID
    android: 'https://play.google.com/store/apps/details?id=com.meetnsplit.app', // Replace with actual package name
  },
  fallbackUrl: 'https://meetnsplit.com',
};

// Link types that the app can handle
export enum LinkType {
  DEAL = 'deal',
  CATEGORY = 'category',
  SOURCE = 'source',
  USER_PROFILE = 'profile',
  CHAT = 'chat',
  SEARCH = 'search',
}

export interface DeepLinkData {
  type: LinkType;
  id?: string;
  params?: { [key: string]: string };
  fallbackUrl?: string;
}

export interface ShareOptions {
  title: string;
  message: string;
  url?: string;
  imageUrl?: string;
  dealId?: string;
  source?: string;
}

export class DeepLinkingService {
  private static listeners: Array<(data: DeepLinkData) => void> = [];
  private static isInitialized = false;

  // Initialize deep linking service
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if app was opened via deep link
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('App opened with initial URL:', initialUrl);
        await this.handleDeepLink(initialUrl);
      }

      // Listen for incoming deep links while app is running
      const subscription = Linking.addEventListener('url', (event) => {
        console.log('Deep link received:', event.url);
        this.handleDeepLink(event.url);
      });

      this.isInitialized = true;
      console.log('Deep linking service initialized');
    } catch (error) {
      console.error('Failed to initialize deep linking:', error);
    }
  }

  // Parse and handle incoming deep links
  private static async handleDeepLink(url: string): Promise<void> {
    try {
      const linkData = this.parseDeepLink(url);
      if (linkData) {
        // Store the link data for processing after app is ready
        await AsyncStorage.setItem('@pending_deep_link', JSON.stringify(linkData));
        
        // Notify listeners
        this.listeners.forEach(listener => listener(linkData));
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
    }
  }

  // Parse deep link URL into structured data
  private static parseDeepLink(url: string): DeepLinkData | null {
    try {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment.length > 0);
      
      if (pathSegments.length === 0) return null;

      const type = pathSegments[0] as LinkType;
      const id = pathSegments[1];
      
      // Parse query parameters
      const params: { [key: string]: string } = {};
      parsedUrl.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return {
        type,
        id,
        params,
        fallbackUrl: params.fallback || DEEP_LINK_CONFIG.fallbackUrl,
      };
    } catch (error) {
      console.error('Error parsing deep link:', error);
      return null;
    }
  }

  // Register a listener for deep link events
  static addListener(listener: (data: DeepLinkData) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Generate deep link for sharing
  static generateDeepLink(type: LinkType, id?: string, params?: { [key: string]: string }): string {
    let path = `/${type}`;
    if (id) path += `/${id}`;

    const url = new URL(`${DEEP_LINK_CONFIG.scheme}:/${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }

  // Generate universal link (web fallback)
  static generateUniversalLink(type: LinkType, id?: string, params?: { [key: string]: string }): string {
    let path = `/${type}`;
    if (id) path += `/${id}`;

    const url = new URL(`https://${DEEP_LINK_CONFIG.host}${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    // Add app store links as fallback
    url.searchParams.set('ios_store', DEEP_LINK_CONFIG.appStore.ios);
    url.searchParams.set('android_store', DEEP_LINK_CONFIG.appStore.android);

    return url.toString();
  }

  // Enhanced deal sharing with smart link generation
  static async shareDeal(deal: any, options?: Partial<ShareOptions>): Promise<void> {
    try {
      const deepLink = this.generateDeepLink(LinkType.DEAL, deal.id, {
        source: deal.source || 'unknown',
        category: deal.category || 'general',
      });

      const universalLink = this.generateUniversalLink(LinkType.DEAL, deal.id, {
        source: deal.source || 'unknown',
        category: deal.category || 'general',
        title: encodeURIComponent(deal.title),
        discount: deal.discount?.toString() || '0',
      });

      // Create smart share message that works across platforms
      const shareMessage = options?.message || this.generateShareMessage(deal, universalLink);

      const shareOptions = {
        title: options?.title || `${deal.title} - ${deal.discount}% OFF`,
        message: shareMessage,
        url: universalLink,
        ...options,
      };

      // Use React Native's Share API
      const { Share } = require('react-native');
      await Share.share(shareOptions);

      // Track sharing analytics
      this.trackShareEvent('deal', deal.id, deal.source);

    } catch (error) {
      console.error('Error sharing deal:', error);
      CrossPlatformAlert.alert('Share Failed', 'Unable to share this deal. Please try again.');
    }
  }

  // Generate smart share message based on deal and platform
  private static generateShareMessage(deal: any, universalLink: string): string {
    const savings = deal.originalPrice && deal.discountedPrice 
      ? (deal.originalPrice - deal.discountedPrice).toFixed(2)
      : '0.00';

    return `🔥 AMAZING DEAL from Spendy! 🔥

${deal.title}

💰 Was: ${deal.originalPrice?.toFixed(2) || '0.00'}
✨ Now: ${deal.discountedPrice?.toFixed(2) || '0.00'}
🎯 Save ${deal.discount || 0}% (Save ${savings})

${deal.description ? deal.description.substring(0, 100) + '...' : ''}

${deal.businessName ? `🏪 ${deal.businessName}` : ''}
${deal.location ? `📍 ${deal.location}` : ''}

📱 Open in Spendy: ${universalLink}

Don't have Spendy? Download it now and discover thousands of deals from your favorite Australian retailers!

#SpeendyDeals #${deal.source || 'Deals'} #AustralianDeals`;
  }

  // Check if user has the app installed (for smart redirects)
  static async checkAppInstalled(): Promise<boolean> {
    try {
      const canOpen = await Linking.canOpenURL(`${DEEP_LINK_CONFIG.scheme}://`);
      return canOpen;
    } catch (error) {
      return false;
    }
  }

  // Get app store URL based on platform
  static getAppStoreUrl(): string {
    return Platform.OS === 'ios' 
      ? DEEP_LINK_CONFIG.appStore.ios 
      : DEEP_LINK_CONFIG.appStore.android;
  }

  // Handle incoming links when app becomes active
  static async processPendingDeepLink(): Promise<DeepLinkData | null> {
    try {
      const pendingLink = await AsyncStorage.getItem('@pending_deep_link');
      if (pendingLink) {
        await AsyncStorage.removeItem('@pending_deep_link');
        return JSON.parse(pendingLink);
      }
      return null;
    } catch (error) {
      console.error('Error processing pending deep link:', error);
      return null;
    }
  }

  // Share category or source page
  static async shareCategory(category: string, source?: string): Promise<void> {
    try {
      const params: { [key: string]: string } = {};
      if (source) params.source = source;

      const universalLink = this.generateUniversalLink(LinkType.CATEGORY, category, params);
      
      const shareMessage = `🛍️ Check out amazing ${category} deals on Meet-n-Split!

${source ? `From ${source} and other top retailers` : 'From all your favorite Australian retailers'}

📱 ${universalLink}

Download Spendy to never miss a deal!`;

      const { Share } = require('react-native');
      await Share.share({
        title: `${category} Deals on Meet-n-Split`,
        message: shareMessage,
        url: universalLink,
      });

      this.trackShareEvent('category', category, source);
    } catch (error) {
      console.error('Error sharing category:', error);
      CrossPlatformAlert.alert('Share Failed', 'Unable to share this category. Please try again.');
    }
  }

  // Share source/store page
  static async shareSource(source: string): Promise<void> {
    try {
      const universalLink = this.generateUniversalLink(LinkType.SOURCE, source);
      
      const sourceNames: { [key: string]: string } = {
        'ozbargain': 'OzBargain',
        'coles': 'Coles',
        'woolworths': 'Woolworths',
        'costco': 'Costco',
        'bunnings': 'Bunnings',
        'jbhifi': 'JB Hi-Fi',
        'goodguys': 'Good Guys',
        'harveynorman': 'Harvey Norman',
      };

      const sourceName = sourceNames[source] || source;
      
      const shareMessage = `🏪 Amazing deals from ${sourceName} on Meet-n-Split!

Discover the latest offers, discounts, and special promotions.

📱 ${universalLink}

Download Spendy to access deals from ${sourceName} and hundreds of other Australian retailers!`;

      const { Share } = require('react-native');
      await Share.share({
        title: `${sourceName} Deals on Spendy`,
        message: shareMessage,
        url: universalLink,
      });

      this.trackShareEvent('source', source);
    } catch (error) {
      console.error('Error sharing source:', error);
      CrossPlatformAlert.alert('Share Failed', 'Unable to share this store. Please try again.');
    }
  }

  // Share search results
  static async shareSearch(query: string, resultCount?: number): Promise<void> {
    try {
      const universalLink = this.generateUniversalLink(LinkType.SEARCH, undefined, {
        q: encodeURIComponent(query),
        count: resultCount?.toString() || '0',
      });
      
      const shareMessage = `🔍 Found amazing deals for "${query}" on Spendy!

${resultCount ? `${resultCount} deals found` : 'Check out what I discovered'}

📱 ${universalLink}

Download Spendy to search thousands of deals from Australian retailers!`;

      const { Share } = require('react-native');
      await Share.share({
        title: `"${query}" Deals on Spendy`,
        message: shareMessage,
        url: universalLink,
      });

      this.trackShareEvent('search', query);
    } catch (error) {
      console.error('Error sharing search:', error);
      CrossPlatformAlert.alert('Share Failed', 'Unable to share search results. Please try again.');
    }
  }

  // Open external deal URL with tracking
  static async openDealUrl(deal: any): Promise<void> {
    try {
      if (!deal.dealUrl) {
        CrossPlatformAlert.alert('No Link Available', 'This deal does not have a direct link.');
        return;
      }

      const canOpen = await Linking.canOpenURL(deal.dealUrl);
      if (canOpen) {
        await Linking.openURL(deal.dealUrl);
        
        // Track deal click
        this.trackClickEvent(deal.id, deal.source, deal.dealUrl);
      } else {
        CrossPlatformAlert.alert('Cannot Open Link', 'Unable to open this deal link.');
      }
    } catch (error) {
      console.error('Error opening deal URL:', error);
      CrossPlatformAlert.alert('Error', 'Failed to open deal link. Please try again.');
    }
  }

  // Handle deep link navigation within the app
  static handleNavigation(linkData: DeepLinkData, navigate: (screen: string, params?: any) => void): void {
    try {
      switch (linkData.type) {
        case LinkType.DEAL:
          if (linkData.id) {
            navigate('DealDetails', { 
              dealId: linkData.id,
              source: linkData.params?.source,
            });
          }
          break;

        case LinkType.CATEGORY:
          // Deals functionality removed - navigate to main screen
          navigate('Main');
          break;

        case LinkType.SOURCE:
          // Deals functionality removed - navigate to main screen
          navigate('Main');
          break;

        case LinkType.SEARCH:
          navigate('Search', { 
            query: linkData.params?.q ? decodeURIComponent(linkData.params.q) : '',
          });
          break;

        case LinkType.CHAT:
          if (linkData.id) {
            navigate('DealChat', { 
              dealId: linkData.id,
            });
          }
          break;

        case LinkType.USER_PROFILE:
          navigate('Profile', { 
            userId: linkData.id,
          });
          break;

        default:
          navigate('Main');
          break;
      }
    } catch (error) {
      console.error('Error handling navigation:', error);
      navigate('Main'); // Fallback to main screen
    }
  }

  // Analytics tracking methods
  private static trackShareEvent(type: string, itemId: string, source?: string): void {
    try {
      // Implement your analytics tracking here
      console.log('Share event tracked:', { type, itemId, source, timestamp: new Date().toISOString() });
      
      // Example: Firebase Analytics, Mixpanel, etc.
      // analytics().logEvent('share_content', {
      //   content_type: type,
      //   item_id: itemId,
      //   source: source || 'unknown',
      // });
    } catch (error) {
      console.error('Error tracking share event:', error);
    }
  }

  private static trackClickEvent(dealId: string, source: string, url: string): void {
    try {
      // Implement your analytics tracking here
      console.log('Click event tracked:', { dealId, source, url, timestamp: new Date().toISOString() });
      
      // Example: Firebase Analytics
      // analytics().logEvent('select_content', {
      //   content_type: 'deal',
      //   item_id: dealId,
      //   source: source,
      // });
    } catch (error) {
      console.error('Error tracking click event:', error);
    }
  }

  // Validate and sanitize URLs for security
  private static isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  // Get sharing metadata for social platforms
  static getSharingMetadata(deal: any): { [key: string]: string } {
    return {
      'og:title': `${deal.title} - ${deal.discount}% OFF`,
      'og:description': deal.description || `Amazing deal from ${deal.businessName || 'Spendy'}`,
      'og:image': deal.imageUrl || 'https://app.spendy.com.au/assets/default-deal-image.jpg',
      'og:url': this.generateUniversalLink(LinkType.DEAL, deal.id),
      'og:type': 'product',
      'og:site_name': 'Spendy',
      'twitter:card': 'summary_large_image',
      'twitter:title': `${deal.title} - ${deal.discount}% OFF`,
      'twitter:description': deal.description || `Amazing deal from ${deal.businessName || 'Spendy'}`,
      'twitter:image': deal.imageUrl || 'https://app.spendy.com.au/assets/default-deal-image.jpg',
    };
  }

  // Cleanup method
  static cleanup(): void {
    this.listeners = [];
    this.isInitialized = false;
  }

  // Get configuration for debugging
  static getConfig(): typeof DEEP_LINK_CONFIG {
    return DEEP_LINK_CONFIG;
  }
}

// React hook for easy deep linking integration
import { useEffect, useState, useCallback } from 'react';

export interface UseDeepLinkingResult {
  pendingLink: DeepLinkData | null;
  isAppInstalled: boolean;
  processPendingLink: () => Promise<void>;
  shareDeal: (deal: any, options?: Partial<ShareOptions>) => Promise<void>;
  shareCategory: (category: string, source?: string) => Promise<void>;
  shareSource: (source: string) => Promise<void>;
  openDealUrl: (deal: any) => Promise<void>;
}

export const useDeepLinking = (
  onDeepLink?: (data: DeepLinkData) => void
): UseDeepLinkingResult => {
  const [pendingLink, setPendingLink] = useState<DeepLinkData | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Initialize deep linking on mount
  useEffect(() => {
    const initializeDeepLinking = async () => {
      await DeepLinkingService.initialize();
      const appInstalled = await DeepLinkingService.checkAppInstalled();
      setIsAppInstalled(appInstalled);
      
      // Check for pending deep links
      const pending = await DeepLinkingService.processPendingDeepLink();
      if (pending) {
        setPendingLink(pending);
        onDeepLink?.(pending);
      }
    };

    initializeDeepLinking();

    // Add listener for incoming deep links
    const unsubscribe = DeepLinkingService.addListener((data) => {
      setPendingLink(data);
      onDeepLink?.(data);
    });

    return () => {
      unsubscribe();
      DeepLinkingService.cleanup();
    };
  }, [onDeepLink]);

  const processPendingLink = useCallback(async () => {
    const pending = await DeepLinkingService.processPendingDeepLink();
    if (pending) {
      setPendingLink(pending);
      onDeepLink?.(pending);
    }
  }, [onDeepLink]);

  const shareDeal = useCallback(async (deal: any, options?: Partial<ShareOptions>) => {
    await DeepLinkingService.shareDeal(deal, options);
  }, []);

  const shareCategory = useCallback(async (category: string, source?: string) => {
    await DeepLinkingService.shareCategory(category, source);
  }, []);

  const shareSource = useCallback(async (source: string) => {
    await DeepLinkingService.shareSource(source);
  }, []);

  const openDealUrl = useCallback(async (deal: any) => {
    await DeepLinkingService.openDealUrl(deal);
  }, []);

  return {
    pendingLink,
    isAppInstalled,
    processPendingLink,
    shareDeal,
    shareCategory,
    shareSource,
    openDealUrl,
  };
};