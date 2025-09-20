// src/services/PromoCodeService.ts
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from './firebase/config';

export interface PromoCode {
  code: string;
  name?: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  currency?: string; // for fixed amount discounts
  validFrom: Date;
  validUntil: Date;
  usageLimit?: number; // null = unlimited
  usedCount: number;
  applicablePlans: string[]; // ['monthly', 'yearly', 'all']
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  // Metadata
  metadata?: {
    campaign?: string;
    source?: string;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    firstTimeOnly?: boolean;
    regions?: string[]; // country codes
  };
}

export interface PromoCodeValidation {
  valid: boolean;
  error?: string;
  discountedPrice?: number;
  originalPrice?: number;
  discountAmount?: number;
  promoCode?: PromoCode;
}

export interface PromoCodeUsage {
  userId: string;
  promoCode: string;
  usedAt: Date;
  originalPrice: number;
  discountedPrice: number;
  discountAmount: number;
  plan: string;
  subscriptionId?: string;
}

class PromoCodeService {
  private static instance: PromoCodeService;
  private cache: Map<string, PromoCode> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): PromoCodeService {
    if (!PromoCodeService.instance) {
      PromoCodeService.instance = new PromoCodeService();
    }
    return PromoCodeService.instance;
  }

  /**
   * Validate a promo code and calculate discount
   */
  async validatePromoCode(
    code: string, 
    plan: 'monthly' | 'yearly', 
    originalPrice: number,
    userId?: string,
    userCurrency: string = 'USD'
  ): Promise<PromoCodeValidation> {
    try {
      console.log('🏷️ Validating promo code:', { code, plan, originalPrice, userId });

      // Normalize code
      const normalizedCode = code.toUpperCase().trim();
      
      if (!normalizedCode) {
        return { valid: false, error: 'Please enter a promo code' };
      }

      // Check cache first
      const cacheKey = `promo_${normalizedCode}`;
      let promoCode = this.getFromCache(cacheKey);
      
      if (!promoCode) {
        // Get from Firebase
        const promoDoc = await getDoc(doc(db, 'promoCodes', normalizedCode));
        
        if (!promoDoc.exists()) {
          return { valid: false, error: 'Invalid promo code' };
        }

        const data = promoDoc.data();
        promoCode = {
          ...data,
          validFrom: data.validFrom.toDate(),
          validUntil: data.validUntil.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as PromoCode;

        // Cache the result
        this.setCache(cacheKey, promoCode);
      }

      // Validate promo code
      const validation = await this.validatePromoCodeRules(
        promoCode, 
        plan, 
        originalPrice, 
        userId, 
        userCurrency
      );

      if (!validation.valid) {
        return validation;
      }

      // Calculate discount
      const discountResult = this.calculateDiscount(promoCode, originalPrice, userCurrency);
      
      return {
        valid: true,
        originalPrice,
        discountedPrice: discountResult.discountedPrice,
        discountAmount: discountResult.discountAmount,
        promoCode
      };

    } catch (error) {
      console.error('❌ Failed to validate promo code:', error);
      return { valid: false, error: 'Unable to validate promo code. Please try again.' };
    }
  }

  /**
   * Validate promo code business rules
   */
  private async validatePromoCodeRules(
    promoCode: PromoCode, 
    plan: string, 
    originalPrice: number,
    userId?: string,
    userCurrency: string = 'USD'
  ): Promise<PromoCodeValidation> {
    
    // Check if promo code is active
    if (!promoCode.isActive) {
      return { valid: false, error: 'This promo code is no longer available' };
    }

    // Check date validity
    const now = new Date();
    if (now < promoCode.validFrom) {
      return { valid: false, error: 'This promo code is not yet valid' };
    }
    
    if (now > promoCode.validUntil) {
      return { valid: false, error: 'This promo code has expired' };
    }

    // Check usage limit
    if (promoCode.usageLimit && promoCode.usedCount >= promoCode.usageLimit) {
      return { valid: false, error: 'This promo code has reached its usage limit' };
    }

    // Check if applicable to this plan
    const isApplicable = promoCode.applicablePlans.includes(plan) || 
                        promoCode.applicablePlans.includes('all');
    
    if (!isApplicable) {
      return { 
        valid: false, 
        error: `This promo code is not valid for the ${plan} plan` 
      };
    }

    // Check minimum purchase amount (if specified)
    if (promoCode.metadata?.minPurchaseAmount && originalPrice < promoCode.metadata.minPurchaseAmount) {
      return { 
        valid: false, 
        error: `Minimum purchase amount of ${promoCode.currency || userCurrency} ${promoCode.metadata.minPurchaseAmount} required` 
      };
    }

    // Check if user has already used this promo code (for first-time only promos)
    if (promoCode.metadata?.firstTimeOnly && userId) {
      const hasUsedBefore = await this.hasUserUsedPromoCode(userId, promoCode.code);
      if (hasUsedBefore) {
        return { valid: false, error: 'This promo code can only be used once per account' };
      }
    }

    // Check currency compatibility for fixed discounts
    if (promoCode.discountType === 'fixed' && promoCode.currency && promoCode.currency !== userCurrency) {
      return { 
        valid: false, 
        error: `This promo code is only valid for ${promoCode.currency} payments` 
      };
    }

    return { valid: true };
  }

  /**
   * Calculate discount amount and final price
   */
  private calculateDiscount(
    promoCode: PromoCode, 
    originalPrice: number, 
    userCurrency: string
  ): { discountedPrice: number; discountAmount: number } {
    
    let discountAmount = 0;
    
    if (promoCode.discountType === 'percentage') {
      discountAmount = originalPrice * (promoCode.discountValue / 100);
      
      // Apply maximum discount limit if specified
      if (promoCode.metadata?.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, promoCode.metadata.maxDiscountAmount);
      }
    } else if (promoCode.discountType === 'fixed') {
      discountAmount = promoCode.discountValue;
    }

    // Ensure discount doesn't exceed original price
    discountAmount = Math.min(discountAmount, originalPrice);
    
    // Ensure discount is not negative
    discountAmount = Math.max(0, discountAmount);
    
    const discountedPrice = Math.max(0, originalPrice - discountAmount);

    return {
      discountedPrice: Math.round(discountedPrice * 100) / 100, // Round to 2 decimal places
      discountAmount: Math.round(discountAmount * 100) / 100
    };
  }

  /**
   * Record promo code usage
   */
  async recordPromoCodeUsage(
    userId: string,
    promoCode: string,
    plan: string,
    originalPrice: number,
    discountedPrice: number,
    subscriptionId?: string
  ): Promise<void> {
    try {
      const normalizedCode = promoCode.toUpperCase().trim();
      
      // Create usage record
      const usageData: PromoCodeUsage = {
        userId,
        promoCode: normalizedCode,
        usedAt: new Date(),
        originalPrice,
        discountedPrice,
        discountAmount: originalPrice - discountedPrice,
        plan,
        subscriptionId
      };

      // Save usage record
      const usageRef = doc(collection(db, 'promoCodeUsage'));
      await setDoc(usageRef, {
        ...usageData,
        usedAt: Timestamp.fromDate(usageData.usedAt)
      });

      // Increment usage count on promo code
      const promoRef = doc(db, 'promoCodes', normalizedCode);
      await updateDoc(promoRef, {
        usedCount: increment(1),
        lastUsed: Timestamp.now(),
        lastUsedBy: userId,
        updatedAt: Timestamp.now()
      });

      // Clear cache for this promo code
      this.clearCache(`promo_${normalizedCode}`);

      console.log('📝 Recorded promo code usage:', { userId, promoCode: normalizedCode, plan });
    } catch (error) {
      console.error('❌ Failed to record promo code usage:', error);
    }
  }

  /**
   * Check if user has used a specific promo code before
   */
  private async hasUserUsedPromoCode(userId: string, promoCode: string): Promise<boolean> {
    try {
      const usageQuery = query(
        collection(db, 'promoCodeUsage'),
        where('userId', '==', userId),
        where('promoCode', '==', promoCode.toUpperCase())
      );
      
      const usageSnapshot = await getDocs(usageQuery);
      return !usageSnapshot.empty;
    } catch (error) {
      console.error('❌ Failed to check promo code usage history:', error);
      return false; // Default to allowing usage if check fails
    }
  }

  /**
   * Get user's promo code usage history
   */
  async getUserPromoCodeHistory(userId: string): Promise<PromoCodeUsage[]> {
    try {
      const usageQuery = query(
        collection(db, 'promoCodeUsage'),
        where('userId', '==', userId)
      );
      
      const usageSnapshot = await getDocs(usageQuery);
      
      const history: PromoCodeUsage[] = [];
      usageSnapshot.forEach(doc => {
        const data = doc.data();
        history.push({
          ...data,
          usedAt: data.usedAt.toDate()
        } as PromoCodeUsage);
      });

      return history.sort((a, b) => b.usedAt.getTime() - a.usedAt.getTime());
    } catch (error) {
      console.error('❌ Failed to get promo code history:', error);
      return [];
    }
  }

  /**
   * Create a new promo code (admin function)
   */
  async createPromoCode(promoCodeData: Omit<PromoCode, 'usedCount' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const normalizedCode = promoCodeData.code.toUpperCase().trim();
      
      // Check if code already exists
      const existingDoc = await getDoc(doc(db, 'promoCodes', normalizedCode));
      if (existingDoc.exists()) {
        throw new Error('Promo code already exists');
      }

      const promoCode: PromoCode = {
        ...promoCodeData,
        code: normalizedCode,
        usedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'promoCodes', normalizedCode), {
        ...promoCode,
        validFrom: Timestamp.fromDate(promoCode.validFrom),
        validUntil: Timestamp.fromDate(promoCode.validUntil),
        createdAt: Timestamp.fromDate(promoCode.createdAt),
        updatedAt: Timestamp.fromDate(promoCode.updatedAt)
      });

      console.log('✅ Created promo code:', normalizedCode);
    } catch (error) {
      console.error('❌ Failed to create promo code:', error);
      throw error;
    }
  }

  /**
   * Update a promo code (admin function)
   */
  async updatePromoCode(code: string, updates: Partial<PromoCode>): Promise<void> {
    try {
      const normalizedCode = code.toUpperCase().trim();
      const promoRef = doc(db, 'promoCodes', normalizedCode);
      
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      // Convert dates to Timestamps
      if (updates.validFrom) {
        updateData.validFrom = Timestamp.fromDate(updates.validFrom);
      }
      if (updates.validUntil) {
        updateData.validUntil = Timestamp.fromDate(updates.validUntil);
      }

      await updateDoc(promoRef, updateData);
      
      // Clear cache
      this.clearCache(`promo_${normalizedCode}`);

      console.log('✅ Updated promo code:', normalizedCode);
    } catch (error) {
      console.error('❌ Failed to update promo code:', error);
      throw error;
    }
  }

  /**
   * Get all active promo codes (admin function)
   */
  async getActivePromoCodes(): Promise<PromoCode[]> {
    try {
      const activeQuery = query(
        collection(db, 'promoCodes'),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(activeQuery);
      
      const promoCodes: PromoCode[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        promoCodes.push({
          ...data,
          validFrom: data.validFrom.toDate(),
          validUntil: data.validUntil.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as PromoCode);
      });

      return promoCodes;
    } catch (error) {
      console.error('❌ Failed to get active promo codes:', error);
      return [];
    }
  }

  // Cache management methods
  private getFromCache(key: string): PromoCode | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  private setCache(key: string, value: PromoCode): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
  }

  private clearCache(key: string): void {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  /**
   * Clear all cached promo codes
   */
  clearAllCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

export default PromoCodeService;