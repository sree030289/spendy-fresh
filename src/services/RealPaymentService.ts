// src/services/RealPaymentService.ts
import Purchases, { 
  PurchasesOffering, 
  PurchasesStoreProduct, 
  CustomerInfo,
  PurchasesPackage,
  INTRO_ELIGIBILITY_STATUS,
  PRORATION_MODE
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase/config';
import { ENV } from '../config/environment';

// Type for promotional offers (iOS discount / Android subscription option)
type PromotionalOffer = any;

export interface PaymentProduct {
  identifier: string;
  description: string;
  title: string;
  price: string;
  priceString: string;
  currencyCode: string;
  introPrice?: {
    price: string;
    priceString: string;
    period: string;
    cycles: number;
  };
}

export interface PromoCode {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  validFrom: Date;
  validUntil: Date;
  usageLimit?: number;
  usedCount: number;
  applicablePlans: string[];
  isActive: boolean;
  currency?: string;
}

export interface PaymentResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  userCancelled?: boolean;
  error?: string;
}

class RealPaymentService {
  private static instance: RealPaymentService;
  private isInitialized = false;
  private currentOfferings: PurchasesOffering | null = null;

  // RevenueCat Configuration
  private readonly REVENUECAT_API_KEY = Platform.select({
    ios: ENV.revenueCat.apiKeys.apple,
    android: ENV.revenueCat.apiKeys.google,
  }) || '';

  // Product identifiers for App Store and Play Store
  // CRITICAL: Must match EXACTLY what's in App Store Connect and RevenueCat
  // Note: "annualy1099" has intentional typo matching App Store Connect configuration
  private readonly PRODUCT_IDS = {
    monthly: Platform.select({
      ios: 'monthly199',
      android: 'monthly199:monthly-base',
    }) || '',
    yearly: Platform.select({
      ios: 'annualy1099', // ✅ FIXED: Match App Store Connect product ID (with typo)
      android: 'annualy1099:yearly-base', // ✅ Match RevenueCat Android product
    }) || '',
    lifetime: Platform.select({
      ios: 'com.meetnsplit.app.Lifetime',
      android: 'meetnsplit_lifetime_subscription',
    }) || '',
  };

  static getInstance(): RealPaymentService {
    if (!RealPaymentService.instance) {
      RealPaymentService.instance = new RealPaymentService();
    }
    return RealPaymentService.instance;
  }

  /**
   * Initialize RevenueCat SDK
   */
  async initialize(userId?: string): Promise<void> {
    try {
      console.log('════════════════════════════════════════════════════════');
      console.log('🚀 INITIALIZING REAL PAYMENT SERVICE');
      console.log('════════════════════════════════════════════════════════');
      console.log('📱 Platform:', Platform.OS);
      console.log('🔧 Environment:', ENV.environment);
      console.log('🔧 isProduction:', ENV.isProduction);
      console.log('🔧 isDevelopment:', ENV.isDevelopment);
      console.log('👤 User ID:', userId || 'NOT PROVIDED');
      console.log('────────────────────────────────────────────────────────');
      console.log('🔑 RevenueCat Configuration:');
      console.log('  - API Key (first 20 chars):', this.REVENUECAT_API_KEY?.substring(0, 20) + '...');
      console.log('  - API Key length:', this.REVENUECAT_API_KEY?.length);
      console.log('  - API Key starts with:', this.REVENUECAT_API_KEY?.substring(0, 5));
      console.log('  - App ID (iOS):', ENV.revenueCat.appIds.apple);
      console.log('  - App ID (Android):', ENV.revenueCat.appIds.google);
      console.log('────────────────────────────────────────────────────────');
      console.log('📦 Product IDs Configuration:');
      console.log('  - Monthly:', this.PRODUCT_IDS.monthly);
      console.log('  - Yearly:', this.PRODUCT_IDS.yearly);
      console.log('  - Lifetime:', this.PRODUCT_IDS.lifetime);
      console.log('════════════════════════════════════════════════════════');
      
      if (this.isInitialized) {
        console.log('✅ RealPaymentService already initialized');
        
        // CRITICAL: If userId is provided and different, switch user
        if (userId) {
          try {
            const currentInfo = await Purchases.getCustomerInfo();
            if (currentInfo.originalAppUserId !== userId) {
              console.log('🔄 User ID changed, switching RevenueCat user...');
              console.log('  - Old user:', currentInfo.originalAppUserId);
              console.log('  - New user:', userId);
              await Purchases.logIn(userId);
              console.log('✅ RevenueCat user switched successfully');
            } else {
              console.log('✅ Same user, no need to switch');
            }
          } catch (error) {
            console.error('⚠️ Failed to check/switch user:', error);
          }
        }
        
        return;
      }

      // Validate API Key
      if (!this.REVENUECAT_API_KEY || this.REVENUECAT_API_KEY.length < 20) {
        console.error('❌ CRITICAL: Invalid RevenueCat API key!');
        console.error('  - Key length:', this.REVENUECAT_API_KEY?.length || 0);
        console.error('  - Key value:', this.REVENUECAT_API_KEY || 'EMPTY');
        throw new Error('Invalid RevenueCat API key configuration');
      }

      // Validate API Key format
      const expectedPrefix = Platform.OS === 'ios' ? 'appl_' : 'goog_';
      if (!this.REVENUECAT_API_KEY.startsWith(expectedPrefix)) {
        console.error('❌ CRITICAL: Wrong API key type!');
        console.error('  - Expected prefix:', expectedPrefix);
        console.error('  - Actual prefix:', this.REVENUECAT_API_KEY.substring(0, 5));
        console.error('  - Make sure you are using PUBLIC SDK keys, not SECRET keys!');
        throw new Error(`Wrong RevenueCat API key type for ${Platform.OS}`);
      }

      console.log('✅ API Key validation passed');

      // Set log level to verbose for debugging
      await Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
      console.log('✅ RevenueCat log level set to VERBOSE');
      
      // Configure RevenueCat
      console.log('⚙️ Configuring RevenueCat SDK...');
      await Purchases.configure({ 
        apiKey: this.REVENUECAT_API_KEY, 
        appUserID: userId 
      });
      console.log('✅ RevenueCat SDK configured successfully');

      // Set user attributes for analytics
      if (userId) {
        console.log('📝 Setting user attributes...');
        await Purchases.setAttributes({
          '$displayName': userId,
          'platform': Platform.OS,
          'environment': ENV.environment,
        });
        console.log('✅ User attributes set');
      }

      // Verify configuration by getting customer info
      console.log('🔍 Verifying configuration by fetching customer info...');
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('✅ Customer info fetched successfully:', {
        originalAppUserId: customerInfo.originalAppUserId,
        activeSubscriptions: Object.keys(customerInfo.activeSubscriptions),
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
      });

      this.isInitialized = true;
      console.log('✅ RealPaymentService initialized successfully');
      console.log('════════════════════════════════════════════════════════');
      
      // Load current offerings
      await this.loadOfferings();
    } catch (error: any) {
      console.error('════════════════════════════════════════════════════════');
      console.error('❌ FAILED TO INITIALIZE REALPAYMENTSERVICE');
      console.error('════════════════════════════════════════════════════════');
      console.error('Error type:', error.constructor?.name || 'Unknown');
      console.error('Error message:', error.message || 'No message');
      console.error('Error code:', error.code || 'No code');
      console.error('Full error:', JSON.stringify(error, null, 2));
      console.error('════════════════════════════════════════════════════════');
      throw new Error(`Payment service initialization failed: ${error.message}`);
    }
  }

  /**
   * Load available subscription offerings from stores
   */
  async loadOfferings(): Promise<PurchasesOffering | null> {
    try {
      console.log('════════════════════════════════════════════════════════');
      console.log('📦 LOADING SUBSCRIPTION OFFERINGS');
      console.log('════════════════════════════════════════════════════════');
      console.log('📱 Platform:', Platform.OS);
      console.log('🔑 Using API Key:', this.REVENUECAT_API_KEY?.substring(0, 20) + '...');
      console.log('────────────────────────────────────────────────────────');
      
      console.log('⏳ Calling Purchases.getOfferings()...');
      const offerings = await Purchases.getOfferings();
      
      console.log('────────────────────────────────────────────────────────');
      console.log('📦 RAW OFFERINGS RESPONSE:');
      console.log(JSON.stringify(offerings, null, 2));
      console.log('────────────────────────────────────────────────────────');
      console.log('📊 Offerings Summary:');
      console.log('  - Current offering exists:', !!offerings.current);
      console.log('  - Current offering ID:', offerings.current?.identifier || 'NONE');
      console.log('  - All offerings count:', offerings.all ? Object.keys(offerings.all).length : 0);
      console.log('  - All offerings IDs:', offerings.all ? Object.keys(offerings.all) : 'NONE');
      console.log('────────────────────────────────────────────────────────');
      
      if (offerings.current) {
        console.log('✅ CURRENT OFFERING FOUND!');
        console.log('  - Identifier:', offerings.current.identifier);
        console.log('  - Server Description:', offerings.current.serverDescription);
        console.log('  - Available Packages:', offerings.current.availablePackages.length);
        console.log('────────────────────────────────────────────────────────');
        
        if (offerings.current.availablePackages.length === 0) {
          console.error('⚠️ WARNING: Current offering has ZERO packages!');
          console.error('This means:');
          console.error('  1. Products are not attached to packages in RevenueCat');
          console.error('  2. Products may not have entitlements attached');
          console.error('  3. Offering configuration is incomplete');
        } else {
          console.log('📦 PACKAGES IN CURRENT OFFERING:');
          offerings.current.availablePackages.forEach((pkg, idx) => {
            console.log(`\n  Package ${idx + 1}:`);
            console.log('    - Package Identifier:', pkg.identifier);
            console.log('    - Package Type:', pkg.packageType);
            console.log('    - Product ID:', pkg.product.identifier);
            console.log('    - Product Title:', pkg.product.title);
            console.log('    - Product Description:', pkg.product.description);
            console.log('    - Price:', pkg.product.priceString);
            console.log('    - Currency:', pkg.product.currencyCode);
            console.log('    - Subscription Period:', pkg.product.subscriptionPeriod || 'N/A');
          });
        }
      } else {
        console.error('❌ NO CURRENT OFFERING FOUND!');
        console.error('This is a CRITICAL issue. Possible causes:');
        console.error('  1. No offering is marked as "current" in RevenueCat dashboard');
        console.error('  2. API key is incorrect or doesn\'t have access to offerings');
        console.error('  3. RevenueCat project configuration issue');
        console.error('');
        console.error('Available offerings:', offerings.all ? Object.keys(offerings.all).join(', ') : 'NONE');
        
        if (offerings.all && Object.keys(offerings.all).length > 0) {
          console.error('');
          console.error('⚠️ Offerings exist but none is marked as CURRENT!');
          console.error('Fix: Go to RevenueCat Dashboard → Offerings → Set one as current');
        }
      }
      
      console.log('════════════════════════════════════════════════════════');
      
      // Platform-specific debugging
      if (Platform.OS === 'android') {
        console.log('🤖 ANDROID-SPECIFIC DEBUG INFO:');
        console.log('  - Expected Monthly ID:', this.PRODUCT_IDS.monthly);
        console.log('  - Expected Yearly ID:', this.PRODUCT_IDS.yearly);
        console.log('  - Note: Android uses "productId:basePlanId" format');
        console.log('════════════════════════════════════════════════════════');
      } else if (Platform.OS === 'ios') {
        console.log('🍎 iOS-SPECIFIC DEBUG INFO:');
        console.log('  - Expected Monthly ID:', this.PRODUCT_IDS.monthly);
        console.log('  - Expected Yearly ID:', this.PRODUCT_IDS.yearly);
        console.log('  - App Store Connect Status: Check if products are "Approved"');
        console.log('  - Sandbox Testing: Make sure sandbox tester is signed in');
        console.log('════════════════════════════════════════════════════════');
      }
      
      this.currentOfferings = offerings.current;
      
      if (!this.currentOfferings) {
        console.error('❌ Setting currentOfferings to NULL due to missing current offering');
      }

      return this.currentOfferings;
    } catch (error: any) {
      console.error('════════════════════════════════════════════════════════');
      console.error('❌ FAILED TO LOAD OFFERINGS');
      console.error('════════════════════════════════════════════════════════');
      console.error('Error type:', error.constructor?.name || 'Unknown');
      console.error('Error message:', error.message || 'No message');
      console.error('Error code:', error.code || 'No code');
      console.error('Error userInfo:', error.userInfo || 'No userInfo');
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('────────────────────────────────────────────────────────');
      console.error('Common causes:');
      console.error('  1. Network connectivity issues');
      console.error('  2. Invalid API key');
      console.error('  3. RevenueCat service outage');
      console.error('  4. App configuration mismatch (bundle ID / package name)');
      console.error('════════════════════════════════════════════════════════');
      return null;
    }
  }

  /**
   * Get available products with current pricing
   */
  async getAvailableProducts(): Promise<PaymentProduct[]> {
    try {
      console.log('════════════════════════════════════════════════════════');
      console.log('💰 GETTING AVAILABLE PRODUCTS');
      console.log('════════════════════════════════════════════════════════');
      console.log('__DEV__ mode:', __DEV__);
      console.log('Current offerings exists:', !!this.currentOfferings);
      
      if (!this.currentOfferings) {
        console.log('⚠️ No offerings cached, attempting to load...');
        await this.loadOfferings();
      }

      if (!this.currentOfferings) {
        const errorMsg = 'No subscription offerings available from RevenueCat.\n\n' +
                        'Checklist:\n' +
                        '  ✓ Products configured in RevenueCat dashboard\n' +
                        '  ✓ Products have entitlements attached\n' +
                        '  ✓ Offering "default" is marked as CURRENT\n' +
                        '  ✓ Packages exist in the offering\n' +
                        '  ✓ API keys are correct\n\n' +
                        'Expected Product IDs:\n' +
                        `  - Monthly: ${this.PRODUCT_IDS.monthly}\n` +
                        `  - Yearly: ${this.PRODUCT_IDS.yearly}\n`;
        console.error('❌ ' + errorMsg);
        
        // DEVELOPMENT MOCK: Return mock products for UI testing
        if (__DEV__) {
          console.log('🎭 DEV MODE: Returning MOCK PRODUCTS for UI testing');
          console.log('   (These are NOT real products from stores)');
          return [
            {
              identifier: this.PRODUCT_IDS.monthly,
              description: 'Monthly subscription for unlimited groups, members, and transactions',
              title: 'Monthly Premium',
              price: '0.99',
              priceString: '$0.99',
              currencyCode: 'USD',
            },
            {
              identifier: this.PRODUCT_IDS.yearly,
              description: 'Annual subscription - Save 8% compared to monthly!',
              title: 'Annual Premium',
              price: '10.99',
              priceString: '$10.99',
              currencyCode: 'USD',
            },
          ];
        }
        
        throw new Error(errorMsg);
      }

      const products: PaymentProduct[] = [];

      console.log('📦 Processing', this.currentOfferings.availablePackages.length, 'packages...');
      
      for (const pkg of this.currentOfferings.availablePackages) {
        const product = pkg.product;
        
        console.log('────────────────────────────────────────────────────────');
        console.log('Processing package:', pkg.identifier);
        console.log('  - Product ID:', product.identifier);
        console.log('  - Title:', product.title);
        console.log('  - Price:', product.priceString);
        console.log('  - Currency:', product.currencyCode);

        const paymentProduct: PaymentProduct = {
          identifier: product.identifier,
          description: product.description,
          title: product.title,
          price: product.price.toString(),
          priceString: product.priceString,
          currencyCode: product.currencyCode,
        };

        // Add intro pricing if available
        if (product.introPrice) {
          console.log('  - Has intro price:', product.introPrice.priceString);
          paymentProduct.introPrice = {
            price: product.introPrice.price.toString(),
            priceString: product.introPrice.priceString,
            period: product.introPrice.periodUnit,
            cycles: product.introPrice.periodNumberOfUnits,
          };
        }

        products.push(paymentProduct);
      }

      console.log('════════════════════════════════════════════════════════');
      console.log('✅ Successfully retrieved', products.length, 'products');
      console.log('Product IDs:', products.map(p => p.identifier).join(', '));
      console.log('════════════════════════════════════════════════════════');
      
      return products;
    } catch (error: any) {
      console.error('════════════════════════════════════════════════════════');
      console.error('❌ FAILED TO GET PRODUCTS');
      console.error('════════════════════════════════════════════════════════');
      console.error('Error:', error.message || error);
      console.error('════════════════════════════════════════════════════════');

      // DEVELOPMENT FALLBACK
      if (__DEV__) {
        console.log('🎭 DEV MODE: Returning MOCK PRODUCTS after error');
        return [
          {
            identifier: this.PRODUCT_IDS.monthly,
            description: 'Monthly subscription for unlimited groups, members, and transactions',
            title: 'Monthly Premium',
            price: '0.99',
            priceString: '$0.99',
            currencyCode: 'USD',
          },
          {
            identifier: this.PRODUCT_IDS.yearly,
            description: 'Annual subscription - Save 8% compared to monthly!',
            title: 'Annual Premium',
            price: '10.99',
            priceString: '$10.99',
            currencyCode: 'USD',
          },
        ];
      }

      return [];
    }
  }

  /**
   * Purchase a subscription with optional promo code
   * Supports store-configured promotional offers from App Store Connect / Play Console
   */
  async purchaseSubscription(
    plan: 'monthly' | 'yearly',
    promoCode?: string
  ): Promise<PaymentResult> {
    try {
      console.log('════════════════════════════════════════════════════════');
      console.log('💳 INITIATING PURCHASE');
      console.log('════════════════════════════════════════════════════════');
      console.log('Plan:', plan);
      console.log('Promo code:', promoCode || 'None');
      console.log('Platform:', Platform.OS);
      console.log('────────────────────────────────────────────────────────');
      
      if (!this.currentOfferings) {
        console.log('⚠️ No currentOfferings cached, loading now...');
        await this.loadOfferings();
      }

      if (!this.currentOfferings) {
        console.error('❌ CRITICAL: Still no currentOfferings after loadOfferings()!');
        console.error('Cannot proceed with purchase');
        return {
          success: false,
          error: 'No subscription plans available'
        };
      }

      // Find the appropriate package
      const targetProductId = this.PRODUCT_IDS[plan];
      console.log('🔍 Looking for product ID:', targetProductId);
      console.log('Available packages:', this.currentOfferings.availablePackages.length);
      
      const purchasePackage = this.currentOfferings.availablePackages.find(
        pkg => pkg.product.identifier === targetProductId
      );

      if (!purchasePackage) {
        console.error('❌ Package not found for product ID:', targetProductId);
        console.error('Available product IDs:', 
          this.currentOfferings.availablePackages.map(p => p.product.identifier).join(', ')
        );
        return {
          success: false,
          error: `${plan} subscription not available`
        };
      }

      console.log('✅ Found package:', purchasePackage.identifier);
      console.log('   Product:', purchasePackage.product.title);
      console.log('   Price:', purchasePackage.product.priceString);
      
      // Handle promo code if provided - only check store promotional offers
      if (promoCode) {
        console.log('🏷️ Processing promo code from App Store/Play Store...');
        
        // Check for store-configured promotional offers (iOS/Android)
        // These are configured in App Store Connect or Google Play Console
        const storePromoResult = await this.checkStorePromotionalOffer(
          purchasePackage, 
          promoCode
        );
        
        if (storePromoResult.available) {
          console.log('✅ Found store-configured promotional offer!');
          console.log('   Discount will be applied by App Store/Play Store');
          
          // Attempt purchase with promotional offer
          try {
            const purchaseResult = await this.purchaseWithStorePromo(
              purchasePackage,
              promoCode,
              storePromoResult.promotionalOffer
            );
            
            console.log('════════════════════════════════════════════════════════');
            console.log('✅ PURCHASE WITH PROMO SUCCESSFUL!');
            console.log('════════════════════════════════════════════════════════');
            console.log('Customer Info:');
            console.log('  - User ID:', purchaseResult.customerInfo.originalAppUserId);
            console.log('  - Active Subscriptions:', Object.keys(purchaseResult.customerInfo.activeSubscriptions));
            console.log('  - Active Entitlements:', Object.keys(purchaseResult.customerInfo.entitlements.active));
            console.log('════════════════════════════════════════════════════════');

            // Record promo code usage in Firebase
            if (Object.keys(purchaseResult.customerInfo.activeSubscriptions).length > 0) {
              await this.recordPromoCodeUsage(promoCode, purchaseResult.customerInfo.originalAppUserId);
            }

            // Update user subscription
            await this.updateUserSubscriptionFromPurchase(
              purchaseResult.customerInfo,
              plan,
              promoCode,
              undefined // No custom discount - store handles pricing
            );

            return {
              success: true,
              customerInfo: purchaseResult.customerInfo,
              userCancelled: false
            };
            
          } catch (promoError: any) {
            console.error('❌ Purchase with store promo failed:', promoError.message);
            // Don't fallback - just return error
            return {
              success: false,
              error: 'Failed to apply promotional offer. Please try again.'
            };
          }
        } else {
          // No store promo found - reject the code
          console.error('❌ Promo code not found in App Store/Play Store');
          return {
            success: false,
            error: 'Invalid promo code. Please check and try again.'
          };
        }
      }

      console.log('────────────────────────────────────────────────────────');

      // Attempt regular purchase (without store promo)
      console.log('🛒 Calling Purchases.purchasePackage()...');
      const purchaseResult = await Purchases.purchasePackage(purchasePackage);

      console.log('════════════════════════════════════════════════════════');
      console.log('✅ PURCHASE SUCCESSFUL!');
      console.log('════════════════════════════════════════════════════════');
      console.log('Customer Info:');
      console.log('  - User ID:', purchaseResult.customerInfo.originalAppUserId);
      console.log('  - Active Subscriptions:', Object.keys(purchaseResult.customerInfo.activeSubscriptions));
      console.log('  - Active Entitlements:', Object.keys(purchaseResult.customerInfo.entitlements.active));
      console.log('════════════════════════════════════════════════════════');

      // Record promo code usage if used and purchase was successful
      if (promoCode && Object.keys(purchaseResult.customerInfo.activeSubscriptions).length > 0) {
        await this.recordPromoCodeUsage(promoCode, purchaseResult.customerInfo.originalAppUserId);
      }

      // Update user subscription in Firebase
      await this.updateUserSubscriptionFromPurchase(
        purchaseResult.customerInfo,
        plan,
        promoCode,
        undefined // Store handles all pricing
      );

      return {
        success: true,
        customerInfo: purchaseResult.customerInfo,
        userCancelled: false
      };

    } catch (error: any) {
      console.error('════════════════════════════════════════════════════════');
      console.error('❌ PURCHASE FAILED');
      console.error('════════════════════════════════════════════════════════');
      console.error('Error type:', error.constructor?.name || 'Unknown');
      console.error('Error message:', error.message || 'No message');
      console.error('Error code:', error.code || 'No code');
      console.error('User cancelled:', error.userCancelled || false);
      console.error('Full error:', JSON.stringify(error, null, 2));
      console.error('════════════════════════════════════════════════════════');

      // Handle user cancellation
      if (error.userCancelled) {
        console.log('ℹ️ User cancelled the purchase');
        return {
          success: false,
          userCancelled: true,
          error: 'Purchase cancelled by user'
        };
      }

      // Handle other errors
      let errorMessage = 'Purchase failed';
      if (error.code === Purchases.PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR) {
        errorMessage = 'This subscription is not available in your region';
      } else if (error.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
        errorMessage = 'Purchases are not allowed on this device';
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error('Returning error to user:', errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if a store-configured promotional offer is available for the promo code
   * This checks App Store Connect (iOS) or Google Play Console (Android) promotional offers
   */
  private async checkStorePromotionalOffer(
    purchasePackage: PurchasesPackage,
    promoCode: string
  ): Promise<{ available: boolean; promotionalOffer?: PromotionalOffer | null }> {
    try {
      console.log('🔍 Checking for store promotional offer...');
      console.log('   Promo code:', promoCode);
      console.log('   Platform:', Platform.OS);
      
      if (Platform.OS === 'ios') {
        // iOS: Check for promotional offers configured in App Store Connect
        // These are fetched automatically by RevenueCat with the offering
        const product = purchasePackage.product as any;
        
        // Check if product has discount/promotional offers
        if (product.discounts && product.discounts.length > 0) {
          console.log('📋 Found', product.discounts.length, 'promotional offers');
          
          // Debug: Log all discount identifiers
          product.discounts.forEach((offer: any, index: number) => {
            console.log(`   Discount ${index}:`, {
              identifier: offer.identifier,
              offerIdentifier: offer.offerIdentifier,
              price: offer.price,
              priceString: offer.priceString
            });
          });
          
          // Look for matching promo code (case-insensitive)
          // Try both 'identifier' and 'offerIdentifier' properties
          const matchingOffer = product.discounts.find(
            (offer: any) => {
              const offerId = offer.identifier || offer.offerIdentifier;
              return offerId?.toLowerCase() === promoCode.toLowerCase();
            }
          );
          
          if (matchingOffer) {
            console.log('✅ Found matching promotional offer:', matchingOffer.identifier || matchingOffer.offerIdentifier);
            return { 
              available: true, 
              promotionalOffer: matchingOffer as PromotionalOffer 
            };
          }
        }
        
        console.log('ℹ️ No matching iOS promotional offer found');
        return { available: false };
        
      } else if (Platform.OS === 'android') {
        // Android: Check for promotional offers (base plan offers)
        // In RevenueCat v7+, Android promotional offers are in product.subscriptionOptions
        const product = purchasePackage.product as any;
        
        if (product.subscriptionOptions && product.subscriptionOptions.length > 0) {
          console.log('📋 Found', product.subscriptionOptions.length, 'subscription options');
          
          // Look for offer with matching tag (promo code)
          const matchingOption = product.subscriptionOptions.find(
            (option: any) => 
              option.tags?.includes(promoCode.toLowerCase()) ||
              option.offerId?.toLowerCase() === promoCode.toLowerCase()
          );
          
          if (matchingOption) {
            console.log('✅ Found matching Android promotional offer:', matchingOption.offerId);
            return { 
              available: true, 
              promotionalOffer: matchingOption 
            };
          }
        }
        
        console.log('ℹ️ No matching Android promotional offer found');
        return { available: false };
      }
      
      return { available: false };
      
    } catch (error) {
      console.error('❌ Error checking store promotional offer:', error);
      return { available: false };
    }
  }

  /**
   * Purchase subscription with store-configured promotional offer
   */
  private async purchaseWithStorePromo(
    purchasePackage: PurchasesPackage,
    promoCode: string,
    promotionalOffer?: PromotionalOffer | null
  ): Promise<{ customerInfo: CustomerInfo }> {
    console.log('🛒 Purchasing with store promotional offer...');
    console.log('   Platform:', Platform.OS);
    console.log('   Promo code:', promoCode);
    
    if (Platform.OS === 'ios') {
      // iOS: For App Store Connect promotional OFFER CODES (not subscription offers)
      // We need to use the StoreKit redemption flow
      // RevenueCat handles this automatically when we call purchasePackage
      
      console.log('📱 iOS: Purchasing with App Store Connect promo code');
      console.log('   Note: User will be prompted to redeem the code in App Store');
      
      try {
        // For promotional offer codes from App Store Connect:
        // 1. User must redeem the code in App Store first, OR
        // 2. Present the code redemption sheet
        
        // Check if this is a promotional offer discount vs offer code
        if (promotionalOffer && (promotionalOffer as any).identifier) {
          // This is a subscription offer (introductory/promotional pricing)
          console.log('💳 Using purchaseDiscountedPackage for subscription offer...');
          console.log('   Discount:', {
            identifier: (promotionalOffer as any).identifier,
            price: (promotionalOffer as any).priceString,
          });
          
          const result = await Purchases.purchaseDiscountedPackage(
            purchasePackage,
            promotionalOffer as any
          );
          
          console.log('✅ Purchase completed with promotional pricing');
          return { customerInfo: result.customerInfo };
        } else {
          // This is an offer code - present redemption sheet
          console.log('🎟️ Presenting App Store offer code redemption sheet...');
          
          // For offer codes, we need to present the StoreKit redemption sheet
          // RevenueCat v7+ supports this via presentCodeRedemptionSheet
          if (Purchases.presentCodeRedemptionSheet) {
            await Purchases.presentCodeRedemptionSheet();
            // After user redeems, we need to refresh customer info
            const customerInfo = await Purchases.getCustomerInfo();
            return { customerInfo };
          } else {
            // Fallback: Try regular purchase (user may have already redeemed)
            console.log('⚠️ Code redemption sheet not available, trying regular purchase...');
            const result = await Purchases.purchasePackage(purchasePackage);
            return { customerInfo: result.customerInfo };
          }
        }
      } catch (error: any) {
        console.error('❌ Purchase with promo error:', error);
        console.error('   Error message:', error.message);
        console.error('   Error code:', error.code);
        throw error;
      }
      
    } else if (Platform.OS === 'android') {
      // Android: Use purchasePackage with subscription option
      // The promotional pricing is applied automatically by the subscription option
      console.log('🤖 Android: Using purchasePackage() with promotional option');
      
      // For Android, the promotional offer is already part of the package
      // Just purchase normally - the discount is applied via the subscription option
      const result = await Purchases.purchasePackage(purchasePackage);
      
      return { customerInfo: result.customerInfo };
    }
    
    throw new Error(`Platform ${Platform.OS} not supported for promotional offers`);
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<PaymentResult> {
    try {
      console.log('════════════════════════════════════════════════════════');
      console.log('🔄 RESTORING PURCHASES');
      console.log('════════════════════════════════════════════════════════');
      
      const customerInfo = await Purchases.restorePurchases();
      
      console.log('✅ Restore successful');
      console.log('  - User ID:', customerInfo.originalAppUserId);
      console.log('  - Active Subscriptions:', Object.keys(customerInfo.activeSubscriptions));
      console.log('  - Active Entitlements:', Object.keys(customerInfo.entitlements.active));
      console.log('════════════════════════════════════════════════════════');

      // Update subscription status in Firebase based on restored purchases
      if (Object.keys(customerInfo.activeSubscriptions).length > 0) {
        await this.syncSubscriptionWithFirebase(customerInfo);
      }

      return {
        success: true,
        customerInfo
      };

    } catch (error: any) {
      console.error('════════════════════════════════════════════════════════');
      console.error('❌ RESTORE FAILED');
      console.error('════════════════════════════════════════════════════════');
      console.error('Error:', error.message || error);
      console.error('════════════════════════════════════════════════════════');
      return {
        success: false,
        error: error.message || 'Failed to restore purchases'
      };
    }
  }

  /**
   * Get current customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('❌ Failed to get customer info:', error);
      return null;
    }
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      if (!customerInfo) return false;

      // Check for 'premium' entitlement (this is the correct way)
      const hasPremiumEntitlement = customerInfo.entitlements.active['premium'] !== undefined;
      
      console.log('🔐 Subscription check:', {
        hasPremiumEntitlement,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        activeSubscriptions: Object.keys(customerInfo.activeSubscriptions)
      });
      
      return hasPremiumEntitlement;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Validate promo code and calculate discount
   */
  /**
   * Validate promo code using CouponService (unified validation)
   */
  async validatePromoCodeWithCouponService(
    code: string, 
    plan: 'monthly' | 'yearly',
    originalPrice: number,
    currency: string
  ): Promise<{
    valid: boolean;
    error?: string;
    discountedPrice?: number;
    originalPrice?: number;
  }> {
    try {
      console.log('🏷️ Validating promo code with CouponService:', code);
      
      // Use CouponService for validation
      const CouponServiceModule = await import('@/services/firebase/CouponService');
      const couponService = CouponServiceModule.default.getInstance();
      await couponService.initialize();
      
      const validation = await couponService.validateCoupon(
        code,
        plan,
        originalPrice,
        currency
      );
      
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error
        };
      }
      
      console.log('✅ Promo code valid:', {
        code,
        originalPrice,
        discountedPrice: validation.discountedPrice,
        discount: validation.discountAmount
      });
      
      return {
        valid: true,
        discountedPrice: validation.discountedPrice,
        originalPrice
      };
      
    } catch (error) {
      console.error('❌ Failed to validate promo code:', error);
      return { valid: false, error: 'Failed to validate promo code' };
    }
  }
  
  /**
   * @deprecated Use validatePromoCodeWithCouponService instead
   * Legacy method - validates against old promoCodes collection
   */
  async validatePromoCode(code: string, plan: 'monthly' | 'yearly'): Promise<{
    valid: boolean;
    error?: string;
    discountedPrice?: number;
    originalPrice?: number;
  }> {
    try {
      console.log('⚠️ Using legacy promo code validation');
      console.log('🏷️ Validating promo code:', code);

      const promoDoc = await getDoc(doc(db, 'promoCodes', code.toUpperCase()));
      
      if (!promoDoc.exists()) {
        return { valid: false, error: 'Invalid promo code' };
      }

      const promoData = promoDoc.data() as PromoCode;
      
      if (!promoData.isActive) {
        return { valid: false, error: 'Promo code is no longer active' };
      }

      const now = new Date();
      if (now < promoData.validFrom || now > promoData.validUntil) {
        return { valid: false, error: 'Promo code has expired' };
      }

      if (promoData.usageLimit && promoData.usedCount >= promoData.usageLimit) {
        return { valid: false, error: 'Promo code usage limit reached' };
      }

      if (!promoData.applicablePlans.includes(plan) && !promoData.applicablePlans.includes('all')) {
        return { valid: false, error: `Promo code not valid for ${plan} plan` };
      }

      const products = await this.getAvailableProducts();
      const targetProductId = this.PRODUCT_IDS[plan];
      const product = products.find(p => p.identifier === targetProductId);
      
      if (!product) {
        return { valid: false, error: 'Product not found' };
      }

      const originalPrice = parseFloat(product.price);
      let discountedPrice = originalPrice;

      if (promoData.discountType === 'percentage') {
        discountedPrice = originalPrice * (1 - promoData.discountValue / 100);
      } else if (promoData.discountType === 'fixed') {
        discountedPrice = Math.max(0, originalPrice - promoData.discountValue);
      }

      console.log('✅ Promo code valid:', {
        code,
        originalPrice,
        discountedPrice,
        discount: originalPrice - discountedPrice
      });

      return {
        valid: true,
        discountedPrice,
        originalPrice
      };

    } catch (error) {
      console.error('❌ Failed to validate promo code:', error);
      return { valid: false, error: 'Failed to validate promo code' };
    }
  }

  /**
   * Record promo code usage via CouponService
   */
  private async recordPromoCodeUsage(code: string, userId: string): Promise<void> {
    try {
      console.log('📝 Recording promo code usage via CouponService:', code);
      
      // Use CouponService to record usage
      const CouponServiceModule = await import('@/services/firebase/CouponService');
      const couponService = CouponServiceModule.default.getInstance();
      await couponService.initialize();
      
      const applied = await couponService.applyCoupon(code);
      
      if (applied) {
        console.log('✅ Promo code usage recorded successfully');
      } else {
        console.warn('⚠️ Failed to record promo code usage');
      }
    } catch (error) {
      console.error('❌ Failed to record promo code usage:', error);
      
      // Fallback to legacy method if CouponService fails
      try {
        const promoDocRef = doc(db, 'promoCodes', code.toUpperCase());
        await updateDoc(promoDocRef, {
          usedCount: (await getDoc(promoDocRef)).data()?.usedCount + 1 || 1,
          lastUsed: Timestamp.now(),
          lastUsedBy: userId
        });
        console.log('📝 Recorded via legacy method');
      } catch (legacyError) {
        console.error('❌ Legacy recording also failed:', legacyError);
      }
    }
  }

  /**
   * Update user subscription in Firebase after successful purchase
   */
  private async updateUserSubscriptionFromPurchase(
    customerInfo: CustomerInfo,
    plan: 'monthly' | 'yearly',
    promoCode?: string,
    discountedPrice?: number
  ): Promise<void> {
    try {
      const userId = customerInfo.originalAppUserId;
      
      console.log('💾 Updating Firebase subscription for user:', userId);
      
      const now = new Date();
      const periodEnd = new Date(now);
      
      if (plan === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // 1. Update subscriptions collection
      const subscriptionRef = doc(db, 'subscriptions', userId);
      
      const subscriptionData = {
        userId,
        plan: 'premium',
        status: 'active',
        subscriptionType: plan,
        currentPeriodStart: Timestamp.fromDate(now),
        currentPeriodEnd: Timestamp.fromDate(periodEnd),
        cancelAtPeriodEnd: false,
        paymentProvider: 'revenuecat',
        subscriptionId: customerInfo.originalPurchaseDate,
        updatedAt: Timestamp.now(),
        promoCode: promoCode || null,
        discountApplied: discountedPrice ? true : false,
        paidAmount: discountedPrice || null
      };

      await setDoc(subscriptionRef, subscriptionData, { merge: true });
      console.log('✅ Subscription document updated');

      // 2. Update user's isPremium field in users collection
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isPremium: true,
        subscriptionStatus: 'premium',
        updatedAt: Timestamp.now()
      });
      console.log('✅ User isPremium field updated');
      
      console.log('✅ Firebase subscription and user updated successfully');
    } catch (error) {
      console.error('❌ Failed to update subscription in Firebase:', error);
      throw error; // Re-throw so caller knows it failed
    }
  }

  /**
   * Sync subscription status with Firebase (for restore purchases)
   */
  private async syncSubscriptionWithFirebase(customerInfo: CustomerInfo): Promise<void> {
    try {
      const userId = customerInfo.originalAppUserId;
      
      console.log('🔄 Syncing subscription with Firebase for user:', userId);
      
      if (Object.keys(customerInfo.activeSubscriptions).length === 0) {
        const subscriptionRef = doc(db, 'subscriptions', userId);
        await updateDoc(subscriptionRef, {
          status: 'inactive',
          updatedAt: Timestamp.now()
        });
        console.log('✅ Marked subscription as inactive');
        return;
      }

      const hasYearly = Object.keys(customerInfo.activeSubscriptions).some(key => 
        key.includes('yearly') || key.includes('annual')
      );
      
      const plan = hasYearly ? 'yearly' : 'monthly';
      
      const subscriptionRef = doc(db, 'subscriptions', userId);
      await updateDoc(subscriptionRef, {
        plan: 'premium',
        status: 'active',
        subscriptionType: plan,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Subscription synced successfully');
    } catch (error) {
      console.error('❌ Failed to sync subscription with Firebase:', error);
    }
  }

  /**
   * Cancel subscription (sets to cancel at period end)
   */
  async cancelSubscription(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🚫 Cancelling subscription for user:', userId);
      
      const subscriptionRef = doc(db, 'subscriptions', userId);
      await updateDoc(subscriptionRef, {
        cancelAtPeriodEnd: true,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Subscription marked for cancellation');

      return {
        success: true,
        message: 'Subscription will be cancelled at the end of the current period. To cancel immediately, please go to your App Store/Play Store account settings.'
      };
    } catch (error) {
      console.error('❌ Failed to cancel subscription:', error);
      return {
        success: false,
        message: 'Failed to cancel subscription. Please try again.'
      };
    }
  }

  /**
   * Set user ID for RevenueCat
   */
  async setUserId(userId: string): Promise<void> {
    try {
      console.log('👤 Setting user ID for RevenueCat:', userId);
      await Purchases.logIn(userId);
      console.log('✅ User ID set successfully');
    } catch (error) {
      console.error('❌ Failed to set user ID:', error);
    }
  }

  /**
   * Log out user from RevenueCat
   */
  async logOut(): Promise<void> {
    try {
      console.log('👋 Logging out from RevenueCat');
      await Purchases.logOut();
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('❌ Failed to log out from RevenueCat:', error);
    }
  }
}

export default RealPaymentService;