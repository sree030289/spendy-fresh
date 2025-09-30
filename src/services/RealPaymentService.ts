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
  currency?: string; // for fixed amount discounts
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
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'appl_YOUR_PUBLIC_IOS_KEY_HERE', // Use PUBLIC key (starts with appl_)
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || 'goog_YOUR_PUBLIC_ANDROID_KEY_HERE', // Use PUBLIC key (starts with goog_)
  }) || '';

  // Product identifiers for App Store and Play Store
  private readonly PRODUCT_IDS = {
    monthly: Platform.select({
      ios: 'com.svaag.meetnsplit.monthly',
      android: 'meetnsplit_monthly_subscription',
    }) || '',
    yearly: Platform.select({
      ios: 'com.svaag.meetnsplit.yearly',
      android: 'meetnsplit_yearly_subscription',
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
      console.log('🚀 Initializing RealPaymentService...');
      
      if (this.isInitialized) {
        console.log('✅ RealPaymentService already initialized');
        return;
      }

      // Configure RevenueCat
      await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      
      if (Platform.OS === 'ios') {
        await Purchases.configure({ apiKey: this.REVENUECAT_API_KEY, appUserID: userId });
      } else {
        await Purchases.configure({ apiKey: this.REVENUECAT_API_KEY, appUserID: userId });
      }

      // Set user attributes for analytics
      if (userId) {
        await Purchases.setAttributes({
          '$displayName': userId,
          'platform': Platform.OS,
        });
      }

      this.isInitialized = true;
      console.log('✅ RealPaymentService initialized successfully');
      
      // Load current offerings
      await this.loadOfferings();
    } catch (error) {
      console.error('❌ Failed to initialize RealPaymentService:', error);
      throw new Error('Payment service initialization failed');
    }
  }

  /**
   * Load available subscription offerings from stores
   */
  async loadOfferings(): Promise<PurchasesOffering | null> {
    try {
      console.log('📦 Loading subscription offerings...');
      
      const offerings = await Purchases.getOfferings();
      this.currentOfferings = offerings.current;
      
      if (this.currentOfferings) {
        console.log('✅ Loaded offerings:', {
          identifier: this.currentOfferings.identifier,
          packagesCount: this.currentOfferings.availablePackages.length,
          products: this.currentOfferings.availablePackages.map(pkg => ({
            identifier: pkg.product.identifier,
            price: pkg.product.priceString,
            period: pkg.packageType,
          }))
        });
      } else {
        console.warn('⚠️ No current offerings available');
      }

      return this.currentOfferings;
    } catch (error) {
      console.error('❌ Failed to load offerings:', error);
      return null;
    }
  }

  /**
   * Get available products with current pricing
   */
  async getAvailableProducts(): Promise<PaymentProduct[]> {
    try {
      if (!this.currentOfferings) {
        await this.loadOfferings();
      }

      if (!this.currentOfferings) {
        throw new Error('No offerings available');
      }

      const products: PaymentProduct[] = [];

      for (const pkg of this.currentOfferings.availablePackages) {
        const product = pkg.product;
        
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
          paymentProduct.introPrice = {
            price: product.introPrice.price.toString(),
            priceString: product.introPrice.priceString,
            period: product.introPrice.periodUnit,
            cycles: product.introPrice.periodNumberOfUnits,
          };
        }

        products.push(paymentProduct);
      }

      console.log('💰 Available products:', products);
      return products;
    } catch (error) {
      console.error('❌ Failed to get products:', error);
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
      console.log('💳 Initiating purchase:', { plan, promoCode });

      // Validate promo code if provided
      let discountedPrice: number | null = null;
      if (promoCode) {
        const promoValidation = await this.validatePromoCode(promoCode, plan);
        if (!promoValidation.valid) {
          return {
            success: false,
            error: promoValidation.error || 'Invalid promo code'
          };
        }
        discountedPrice = promoValidation.discountedPrice;
      }

      if (!this.currentOfferings) {
        await this.loadOfferings();
      }

      if (!this.currentOfferings) {
        return {
          success: false,
          error: 'No subscription plans available'
        };
      }

      // Find the appropriate package
      const targetProductId = this.PRODUCT_IDS[plan];
      const purchasePackage = this.currentOfferings.availablePackages.find(
        pkg => pkg.product.identifier === targetProductId
      );

      if (!purchasePackage) {
        return {
          success: false,
          error: `${plan} subscription not available`
        };
      }

      // Attempt purchase
      console.log('🛒 Purchasing package:', purchasePackage.product.identifier);
      
      const purchaseResult = await Purchases.purchasePackage(purchasePackage);
      
      console.log('✅ Purchase successful:', {
        customerInfo: purchaseResult.customerInfo.originalAppUserId,
        activeSubscriptions: Object.keys(purchaseResult.customerInfo.activeSubscriptions),
        entitlements: Object.keys(purchaseResult.customerInfo.entitlements.active)
      });

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
      console.error('❌ Purchase failed:', error);
      
      // Handle user cancellation
      if (error.userCancelled) {
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
      console.log('🔄 Restoring purchases...');
      
      const customerInfo = await Purchases.restorePurchases();
      
      console.log('✅ Restore successful:', {
        userId: customerInfo.originalAppUserId,
        activeSubscriptions: Object.keys(customerInfo.activeSubscriptions),
        entitlements: Object.keys(customerInfo.entitlements.active)
      });

      // Update subscription status in Firebase based on restored purchases
      if (Object.keys(customerInfo.activeSubscriptions).length > 0) {
        await this.syncSubscriptionWithFirebase(customerInfo);
      }

      return {
        success: true,
        customerInfo
      };

    } catch (error: any) {
      console.error('❌ Restore failed:', error);
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

      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      const hasActiveSubscription = Object.keys(customerInfo.activeSubscriptions).length > 0;
      
      return hasActiveEntitlement || hasActiveSubscription;
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

      // Get promo code from Firebase
      const promoDoc = await getDoc(doc(db, 'promoCodes', code.toUpperCase()));
      
      if (!promoDoc.exists()) {
        return { valid: false, error: 'Invalid promo code' };
      }

      const promoData = promoDoc.data() as PromoCode;
      
      // Check if promo code is active
      if (!promoData.isActive) {
        return { valid: false, error: 'Promo code is no longer active' };
      }

      // Check date validity
      const now = new Date();
      if (now < promoData.validFrom || now > promoData.validUntil) {
        return { valid: false, error: 'Promo code has expired' };
      }

      // Check usage limit
      if (promoData.usageLimit && promoData.usedCount >= promoData.usageLimit) {
        return { valid: false, error: 'Promo code usage limit reached' };
      }

      // Check if applicable to this plan
      if (!promoData.applicablePlans.includes(plan) && !promoData.applicablePlans.includes('all')) {
        return { valid: false, error: `Promo code not valid for ${plan} plan` };
      }

      // Get original price
      const products = await this.getAvailableProducts();
      const targetProductId = this.PRODUCT_IDS[plan];
      const product = products.find(p => p.identifier === targetProductId);
      
      if (!product) {
        return { valid: false, error: 'Product not found' };
      }

      const originalPrice = parseFloat(product.price);
      let discountedPrice = originalPrice;

      // Calculate discount
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
      
      // Increment usage count
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
      
      // Calculate subscription period
      const now = new Date();
      const periodEnd = new Date(now);
      
      if (plan === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Get subscription document reference
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
      
      console.log('💾 Updated subscription in Firebase:', subscriptionData);
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
      
      if (Object.keys(customerInfo.activeSubscriptions).length === 0) {
        // No active subscriptions
        const subscriptionRef = doc(db, 'subscriptions', userId);
        await updateDoc(subscriptionRef, {
          status: 'inactive',
          updatedAt: Timestamp.now()
        });
        return;
      }

      // Has active subscription - determine the plan type
      const hasYearly = Object.keys(customerInfo.activeSubscriptions).some(key => 
        key.includes('yearly') || key.includes('annual')
      );
      
      const plan = hasYearly ? 'yearly' : 'monthly';
      
      // Update subscription status
      const subscriptionRef = doc(db, 'subscriptions', userId);
      await updateDoc(subscriptionRef, {
        plan: 'premium',
        status: 'active',
        subscriptionType: plan,
        updatedAt: Timestamp.now()
      });

      console.log('🔄 Synced subscription with Firebase');
    } catch (error) {
      console.error('❌ Failed to sync subscription with Firebase:', error);
    }
  }

  /**
   * Cancel subscription (sets to cancel at period end)
   */
  async cancelSubscription(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Note: RevenueCat doesn't handle cancellation directly - users need to cancel through App Store/Play Store
      // We just update the local state
      const subscriptionRef = doc(db, 'subscriptions', userId);
      await updateDoc(subscriptionRef, {
        cancelAtPeriodEnd: true,
        updatedAt: Timestamp.now()
      });

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
      await Purchases.logIn(userId);
      console.log('👤 Set user ID for RevenueCat:', userId);
    } catch (error) {
      console.error('❌ Failed to set user ID:', error);
    }
  }

  /**
   * Log out user from RevenueCat
   */
  async logOut(): Promise<void> {
    try {
      await Purchases.logOut();
      console.log('👋 Logged out from RevenueCat');
    } catch (error) {
      console.error('❌ Failed to log out from RevenueCat:', error);
    }
  }
}

export default RealPaymentService;