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
        console.log('✅ RealPaymentService already initialized, skipping...');
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

      // Validate promo code if provided
      let discountedPrice: number | null = null;
      if (promoCode) {
        console.log('🏷️ Validating promo code...');
        const promoValidation = await this.validatePromoCode(promoCode, plan);
        if (!promoValidation.valid) {
          console.error('❌ Promo code invalid:', promoValidation.error);
          return {
            success: false,
            error: promoValidation.error || 'Invalid promo code'
          };
        }
        discountedPrice = promoValidation.discountedPrice;
        console.log('✅ Promo code valid, discounted price:', discountedPrice);
      }

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
      console.log('────────────────────────────────────────────────────────');

      // Attempt purchase
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

      // Record promo code usage if used
      if (promoCode && purchaseResult.customerInfo.activeSubscriptions[targetProductId]) {
        await this.recordPromoCodeUsage(promoCode, purchaseResult.customerInfo.originalAppUserId);
      }

      // Update user subscription in Firebase
      await this.updateUserSubscriptionFromPurchase(
        purchaseResult.customerInfo,
        plan,
        promoCode,
        discountedPrice
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
      if (error.code === Purchases.PURCHASES_ERROR_CODE.PAYMENT_PENDING) {
        errorMessage = 'Payment is pending approval';
      } else if (error.code === Purchases.PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR) {
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
  async validatePromoCode(code: string, plan: 'monthly' | 'yearly'): Promise<{
    valid: boolean;
    error?: string;
    discountedPrice?: number;
    originalPrice?: number;
  }> {
    try {
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
   * Record promo code usage
   */
  private async recordPromoCodeUsage(code: string, userId: string): Promise<void> {
    try {
      const promoDocRef = doc(db, 'promoCodes', code.toUpperCase());
      
      await updateDoc(promoDocRef, {
        usedCount: (await getDoc(promoDocRef)).data()?.usedCount + 1 || 1,
        lastUsed: Timestamp.now(),
        lastUsedBy: userId
      });

      console.log('📝 Recorded promo code usage:', code);
    } catch (error) {
      console.error('❌ Failed to record promo code usage:', error);
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
      
      console.log('✅ Firebase subscription updated successfully');
    } catch (error) {
      console.error('❌ Failed to update subscription in Firebase:', error);
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