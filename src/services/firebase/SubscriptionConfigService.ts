// src/services/firebase/SubscriptionConfigService.ts
import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import CurrencyConversionService from './CurrencyConversionService';

export interface SubscriptionPricing {
  monthly: {
    price: number;
    currency: string;
    originalPrice?: number; // for showing discounts
  };
  yearly: {
    price: number;
    currency: string;
    originalPrice?: number;
    monthlyEquivalent?: number;
  };
  savings?: {
    percentage: number;
    amount: number;
  };
}

export interface SubscriptionFeatures {
  keyFeatures: string[];
  detailedFeatures: {
    [category: string]: string[];
  };
}

export interface SubscriptionConfig {
  pricing: SubscriptionPricing;
  features: SubscriptionFeatures;
  displayConfig: {
    defaultPlan: 'monthly' | 'yearly';
    showSavings: boolean;
    highlightYearly: boolean;
    promoCodeEnabled: boolean;
  };
  metadata: {
    lastUpdated: Date;
    version: string;
    isActive: boolean;
  };
}

class SubscriptionConfigService {
  private static instance: SubscriptionConfigService;
  private db: any;
  private listeners: ((config: SubscriptionConfig) => void)[] = [];
  private currentConfig: SubscriptionConfig | null = null;
  private unsubscribe: (() => void) | null = null;
  private currencyService: CurrencyConversionService;

  // Default fallback config in case Firebase is unavailable
  private defaultConfig: SubscriptionConfig = {
    pricing: {
      monthly: {
        price: 0.99,
        currency: 'USD'
      },
      yearly: {
        price: 10.99,
        currency: 'USD',
        monthlyEquivalent: 0.92
      },
      savings: {
        percentage: 8,
        amount: 0.89
      }
    },
    features: {
      keyFeatures: [
        'Unlimited Groups & Members',
        'Unlimited Transactions', 
        'AI Receipt Scanning',
        'Advanced Analytics',
        'Export & Integration',
        'Priority Support'
      ],
      detailedFeatures: {
        'Core Features': [
          'Unlimited groups and members',
          'Unlimited daily transactions',
          'Advanced expense tracking'
        ],
        'AI & Automation': [
          'Smart receipt scanning',
          'Auto expense categorization',
          'Intelligent split suggestions'
        ],
        'Analytics & Insights': [
          'Detailed spending analytics',
          'Category-wise breakdowns', 
          'Monthly/yearly reports',
          'Export to CSV/PDF'
        ],
        'Collaboration': [
          'Group chat integration',
          'Email notifications',
          'Payment reminders',
          'Shared expense notifications'
        ]
      }
    },
    displayConfig: {
      defaultPlan: 'yearly',
      showSavings: true,
      highlightYearly: true,
      promoCodeEnabled: true
    },
    metadata: {
      lastUpdated: new Date(),
      version: '1.0.0',
      isActive: true
    }
  };

  static getInstance(): SubscriptionConfigService {
    if (!SubscriptionConfigService.instance) {
      SubscriptionConfigService.instance = new SubscriptionConfigService();
    }
    return SubscriptionConfigService.instance;
  }

  constructor() {
    this.currencyService = CurrencyConversionService.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Firestore
      const { getFirestore } = await import('firebase/firestore');
      this.db = getFirestore();
      
      // Initialize currency conversion service
      await this.currencyService.initialize();
      
      // Start listening to real-time updates
      this.startListening();
    } catch (error) {
      console.error('Failed to initialize SubscriptionConfigService:', error);
      // Use default config as fallback
      this.currentConfig = this.defaultConfig;
    }
  }

  private startListening(): void {
    if (!this.db) return;

    try {
      const configDoc = doc(this.db, 'appConfig', 'subscriptionConfig');
      
      this.unsubscribe = onSnapshot(configDoc, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          console.log('🔥 Firebase subscription config received:', JSON.stringify(data, null, 2));
          const config = this.parseConfigFromFirebase(data);
          console.log('📊 Parsed subscription config:', JSON.stringify(config.pricing, null, 2));
          this.currentConfig = config;
          this.notifyListeners(config);
        } else {
          // Document doesn't exist, use default config
          console.log('Subscription config not found in Firebase, using default');
          this.currentConfig = this.defaultConfig;
          this.notifyListeners(this.defaultConfig);
        }
      }, (error) => {
        console.error('Error listening to subscription config:', error);
        // Fallback to default config
        this.currentConfig = this.defaultConfig;
        this.notifyListeners(this.defaultConfig);
      });
    } catch (error) {
      console.error('Error setting up config listener:', error);
      this.currentConfig = this.defaultConfig;
    }
  }

  private parseConfigFromFirebase(data: any): SubscriptionConfig {
    try {
      // Helper function to get pricing data with flexible key matching
      const getMonthlyData = () => {
        return data.pricing?.monthly || data.pricing?.['monthly '] || {};
      };
      
      const getYearlyData = () => {
        return data.pricing?.yearly || data.pricing?.['yearly '] || {};
      };

      const monthlyData = getMonthlyData();
      const yearlyData = getYearlyData();

      console.log('🔍 Monthly data extracted:', monthlyData);
      console.log('🔍 Yearly data extracted:', yearlyData);

      // Parse and validate the Firebase data
      const config: SubscriptionConfig = {
        pricing: {
          monthly: {
            price: monthlyData.price !== undefined ? monthlyData.price : this.defaultConfig.pricing.monthly.price,
            currency: monthlyData.currency || this.defaultConfig.pricing.monthly.currency,
            originalPrice: monthlyData.originalPrice
          },
          yearly: {
            price: yearlyData.price !== undefined ? yearlyData.price : this.defaultConfig.pricing.yearly.price,
            currency: yearlyData.currency || this.defaultConfig.pricing.yearly.currency,
            originalPrice: yearlyData.originalPrice,
            monthlyEquivalent: yearlyData.monthlyEquivalent || 
              (yearlyData.price !== undefined ? yearlyData.price : this.defaultConfig.pricing.yearly.price) / 12
          },
          savings: data.pricing?.savings || this.calculateSavings(
            monthlyData.price !== undefined ? monthlyData.price : this.defaultConfig.pricing.monthly.price,
            yearlyData.price !== undefined ? yearlyData.price : this.defaultConfig.pricing.yearly.price
          )
        },
        features: {
          keyFeatures: data.features?.keyFeatures || this.defaultConfig.features.keyFeatures,
          detailedFeatures: data.features?.detailedFeatures || this.defaultConfig.features.detailedFeatures
        },
        displayConfig: {
          defaultPlan: data.displayConfig?.defaultPlan || this.defaultConfig.displayConfig.defaultPlan,
          showSavings: data.displayConfig?.showSavings !== undefined ? 
            data.displayConfig.showSavings : this.defaultConfig.displayConfig.showSavings,
          highlightYearly: data.displayConfig?.highlightYearly !== undefined ?
            data.displayConfig.highlightYearly : this.defaultConfig.displayConfig.highlightYearly,
          promoCodeEnabled: data.displayConfig?.promoCodeEnabled !== undefined ?
            data.displayConfig.promoCodeEnabled : this.defaultConfig.displayConfig.promoCodeEnabled
        },
        metadata: {
          lastUpdated: data.metadata?.lastUpdated?.toDate() || new Date(),
          version: data.metadata?.version || this.defaultConfig.metadata.version,
          isActive: data.metadata?.isActive !== undefined ? 
            data.metadata.isActive : this.defaultConfig.metadata.isActive
        }
      };

      return config;
    } catch (error) {
      console.error('Error parsing config from Firebase:', error);
      return this.defaultConfig;
    }
  }

  private calculateSavings(monthlyPrice: number, yearlyPrice: number): { percentage: number; amount: number } {
    const yearlyMonthly = monthlyPrice * 12;
    const amount = yearlyMonthly - yearlyPrice;
    const percentage = Math.round((amount / yearlyMonthly) * 100);
    return { percentage, amount };
  }

  getCurrentConfig(): SubscriptionConfig {
    return this.currentConfig || this.defaultConfig;
  }

  /**
   * Get current config with pricing converted to user's currency
   */
  getCurrentConfigForUser(userCurrency: string): SubscriptionConfig {
    const config = this.getCurrentConfig();
    
    // If user currency is same as config currency, return as-is
    if (config.pricing.monthly.currency === userCurrency.toUpperCase()) {
      return config;
    }

    // Convert pricing to user's currency
    const convertedPricing = this.currencyService.convertSubscriptionPricing(
      config.pricing,
      userCurrency
    );

    return {
      ...config,
      pricing: convertedPricing
    };
  }

  onConfigUpdate(callback: (config: SubscriptionConfig) => void): () => void {
    this.listeners.push(callback);
    
    // Immediately call with current config if available
    if (this.currentConfig) {
      callback(this.currentConfig);
    }

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(config: SubscriptionConfig): void {
    this.listeners.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('Error in config update callback:', error);
      }
    });
  }

  // Method to refresh config manually
  async refreshConfig(): Promise<SubscriptionConfig> {
    if (!this.db) {
      await this.initialize();
    }

    try {
      const configDoc = doc(this.db, 'appConfig', 'subscriptionConfig');
      const docSnapshot = await getDoc(configDoc);
      
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const config = this.parseConfigFromFirebase(data);
        this.currentConfig = config;
        this.notifyListeners(config);
        return config;
      } else {
        return this.defaultConfig;
      }
    } catch (error) {
      console.error('Error refreshing config:', error);
      return this.defaultConfig;
    }
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners = [];
    this.currentConfig = null;
  }
}

export default SubscriptionConfigService;
