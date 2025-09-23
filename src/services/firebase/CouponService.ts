// src/services/firebase/CouponService.ts
import { getFirestore, doc, getDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';

export interface CouponCode {
  code: string;
  discountPercent: number;
  discountType: 'percentage' | 'fixed';
  isActive: boolean;
  description: string;
  validUntil: string;
  usageLimit: number | null;
  usageCount: number;
  applicableToPlans: ('monthly' | 'yearly')[];
  createdAt: string;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: CouponCode;
  error?: string;
  discountedPrice?: number;
  discountAmount?: number;
}

class CouponService {
  private static instance: CouponService;
  private db: any;

  static getInstance(): CouponService {
    if (!CouponService.instance) {
      CouponService.instance = new CouponService();
    }
    return CouponService.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.db = getFirestore();
    } catch (error) {
      console.error('Failed to initialize CouponService:', error);
    }
  }

  /**
   * Validate a coupon code
   */
  async validateCoupon(
    couponCode: string, 
    planType: 'monthly' | 'yearly',
    originalPrice: number,
    currency: string = 'USD'
  ): Promise<CouponValidationResult> {
    try {
      if (!this.db) {
        await this.initialize();
      }

      console.log(`🏷️ Validating coupon: ${couponCode} for ${planType} plan (${currency} ${originalPrice})`);

      // Get coupon from Firebase
      const couponDoc = doc(this.db, 'appConfig', 'couponCodes');
      const docSnapshot = await getDoc(couponDoc);

      if (!docSnapshot.exists()) {
        console.log('❌ Coupon collection not found');
        return { valid: false, error: 'Coupon system not available' };
      }

      const couponsData = docSnapshot.data();
      const coupon = couponsData[couponCode];

      if (!coupon) {
        console.log('❌ Coupon code not found:', couponCode);
        return { valid: false, error: 'Invalid coupon code' };
      }

      // Validate coupon
      const validation = this.validateCouponRules(coupon, planType, originalPrice);
      
      if (!validation.valid) {
        return validation;
      }

      console.log(`✅ Coupon validated: ${coupon.discountPercent}% off`);
      return validation;

    } catch (error) {
      console.error('❌ Coupon validation error:', error);
      return { valid: false, error: 'Unable to validate coupon' };
    }
  }

  /**
   * Apply coupon and increment usage count
   */
  async applyCoupon(couponCode: string): Promise<boolean> {
    try {
      if (!this.db) {
        await this.initialize();
      }

      const couponDoc = doc(this.db, 'appConfig', 'couponCodes');
      
      // Increment usage count
      const updatePath = `${couponCode}.usageCount`;
      await updateDoc(couponDoc, {
        [updatePath]: increment(1)
      });

      console.log(`🎯 Coupon ${couponCode} applied, usage count incremented`);
      return true;

    } catch (error) {
      console.error('❌ Error applying coupon:', error);
      return false;
    }
  }

  /**
   * Validate coupon rules (private method)
   */
  private validateCouponRules(
    coupon: CouponCode, 
    planType: 'monthly' | 'yearly', 
    originalPrice: number
  ): CouponValidationResult {
    
    // Check if coupon is active
    if (!coupon.isActive) {
      return { valid: false, error: 'Invalid coupon code' };
    }

    // Check expiry date
    const now = new Date();
    const validUntil = new Date(coupon.validUntil);
    if (now > validUntil) {
      return { valid: false, error: 'Coupon has expired' };
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, error: 'Coupon usage limit reached' };
    }

    // Check if applicable to plan
    if (!coupon.applicableToPlans.includes(planType)) {
      return { valid: false, error: `Coupon not applicable to ${planType} plan` };
    }

    // Calculate discount
    const { discountedPrice, discountAmount } = this.calculateDiscount(coupon, originalPrice);

    return {
      valid: true,
      coupon,
      discountedPrice,
      discountAmount
    };
  }

  /**
   * Calculate discount amount and final price
   */
  private calculateDiscount(coupon: CouponCode, originalPrice: number): { discountedPrice: number; discountAmount: number } {
    let discountAmount = 0;
    
    if (coupon.discountType === 'percentage') {
      discountAmount = (originalPrice * coupon.discountPercent) / 100;
    } else {
      // Fixed amount discount
      discountAmount = coupon.discountPercent; // Using discountPercent field for fixed amount
    }

    const discountedPrice = Math.max(0, originalPrice - discountAmount);
    
    return { discountedPrice, discountAmount };
  }

  /**
   * Get all active coupons (for admin purposes)
   */
  async getActiveCoupons(): Promise<CouponCode[]> {
    try {
      if (!this.db) {
        await this.initialize();
      }

      const couponDoc = doc(this.db, 'appConfig', 'couponCodes');
      const docSnapshot = await getDoc(couponDoc);

      if (!docSnapshot.exists()) {
        return [];
      }

      const couponsData = docSnapshot.data();
      const activeCoupons = Object.values(couponsData)
        .filter((coupon: any) => coupon.isActive && new Date(coupon.validUntil) > new Date())
        .map((coupon: any) => coupon as CouponCode);

      return activeCoupons;

    } catch (error) {
      console.error('Error fetching active coupons:', error);
      return [];
    }
  }
}

export default CouponService;
