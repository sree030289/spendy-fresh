// src/services/SubscriptionService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase/config';

export interface SubscriptionPlan {
  id: 'free' | 'premium';
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    groups: number;
    groupMembers: number;
    dailyTransactions: number;
  };
}

export interface UserSubscription {
  userId: string;
  plan: 'free' | 'premium';
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
  paymentMethod?: any;
  subscriptionId?: string; // External payment provider ID
}

export interface UsageLimits {
  userId: string;
  date: string; // YYYY-MM-DD format
  transactionsUsed: number;
  groupsCreated: number;
  lastChecked: Date;
}

export interface PremiumFeature {
  id: string;
  name: string;
  description: string;
  premiumOnly: boolean;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      'Up to 3 Groups',
      'Up to 10 Members per Group',
      '3 Transactions per Day',
      'Basic Expense Tracking',
      'Simple Split Calculations'
    ],
    limits: {
      groups: 3,
      groupMembers: 10,
      dailyTransactions: 3
    }
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 9.99,
    interval: 'month',
    features: [
      'Unlimited Groups',
      'Unlimited Group Members',
      'Unlimited Transactions',
      'Advanced Analytics',
      'Receipt Scanning',
      'Group Chat',
      'QR Code Features',
      'Gmail Integration',
      'Priority Support'
    ],
    limits: {
      groups: -1, // -1 means unlimited
      groupMembers: -1,
      dailyTransactions: -1
    }
  }
};

export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    id: 'analytics',
    name: 'Advanced Analytics',
    description: 'Detailed spending insights and reports',
    premiumOnly: true
  },
  {
    id: 'receipt_scanning',
    name: 'Receipt Scanning',
    description: 'AI-powered receipt scanning and data extraction',
    premiumOnly: true
  },
  {
    id: 'group_chat',
    name: 'Group Chat',
    description: 'Chat with group members about expenses',
    premiumOnly: true
  },
  {
    id: 'qr_codes',
    name: 'QR Code Features',
    description: 'Generate and scan QR codes for quick connections',
    premiumOnly: true
  },
  {
    id: 'gmail_integration',
    name: 'Gmail Integration',
    description: 'Connect with Gmail for expense reminders',
    premiumOnly: true
  },
  {
    id: 'export_data',
    name: 'Export Data',
    description: 'Export group data to CSV or PDF files',
    premiumOnly: true
  }
];

export class SubscriptionService {
  private static instance: SubscriptionService;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  // SUBSCRIPTION MANAGEMENT
  async getUserSubscription(userId: string): Promise<UserSubscription> {
    try {
      const cacheKey = `subscription_${userId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const docRef = doc(db, 'subscriptions', userId);
      const docSnap = await getDoc(docRef);

      let subscription: UserSubscription;
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        subscription = {
          ...data,
          currentPeriodStart: data.currentPeriodStart?.toDate(),
          currentPeriodEnd: data.currentPeriodEnd?.toDate(),
          trialEnd: data.trialEnd?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as UserSubscription;
      } else {
        // Create default free subscription
        subscription = {
          userId,
          plan: 'free',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await this.createUserSubscription(subscription);
      }

      this.setCache(cacheKey, subscription);
      return subscription;
    } catch (error) {
      console.error('Get user subscription error:', error);
      // Return default free subscription on error
      return {
        userId,
        plan: 'free',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  async createUserSubscription(subscription: UserSubscription): Promise<void> {
    try {
      const docRef = doc(db, 'subscriptions', subscription.userId);
      await setDoc(docRef, {
        ...subscription,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Clear cache
      this.clearCache(`subscription_${subscription.userId}`);
    } catch (error) {
      console.error('Create user subscription error:', error);
      throw error;
    }
  }

  async updateUserSubscription(userId: string, updates: Partial<UserSubscription>): Promise<void> {
    try {
      const docRef = doc(db, 'subscriptions', userId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date()
      });
      
      // Clear cache
      this.clearCache(`subscription_${userId}`);
    } catch (error) {
      console.error('Update user subscription error:', error);
      throw error;
    }
  }

  async isPremiumUser(userId: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      return subscription.plan === 'premium' && subscription.status === 'active';
    } catch (error) {
      console.error('Check premium status error:', error);
      return false;
    }
  }

  // USAGE TRACKING
  async getDailyUsage(userId: string, date?: Date): Promise<UsageLimits> {
    try {
      const today = date ? this.formatDate(date) : this.formatDate(new Date());
      const cacheKey = `usage_${userId}_${today}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const docRef = doc(db, 'usageLimits', `${userId}_${today}`);
      const docSnap = await getDoc(docRef);

      let usage: UsageLimits;
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        usage = {
          ...data,
          lastChecked: data.lastChecked?.toDate() || new Date()
        } as UsageLimits;
      } else {
        // Create default usage record
        usage = {
          userId,
          date: today,
          transactionsUsed: 0,
          groupsCreated: 0,
          lastChecked: new Date()
        };
        
        await this.createDailyUsage(usage);
      }

      this.setCache(cacheKey, usage);
      return usage;
    } catch (error) {
      console.error('Get daily usage error:', error);
      const today = date ? this.formatDate(date) : this.formatDate(new Date());
      return {
        userId,
        date: today,
        transactionsUsed: 0,
        groupsCreated: 0,
        lastChecked: new Date()
      };
    }
  }

  async createDailyUsage(usage: UsageLimits): Promise<void> {
    try {
      const docRef = doc(db, 'usageLimits', `${usage.userId}_${usage.date}`);
      await setDoc(docRef, {
        ...usage,
        lastChecked: new Date()
      });
    } catch (error) {
      console.error('Create daily usage error:', error);
    }
  }

  async incrementTransactionUsage(userId: string): Promise<void> {
    try {
      const today = this.formatDate(new Date());
      const docRef = doc(db, 'usageLimits', `${userId}_${today}`);
      
      // Ensure document exists
      await this.getDailyUsage(userId);
      
      await updateDoc(docRef, {
        transactionsUsed: increment(1),
        lastChecked: new Date()
      });
      
      // Clear cache
      this.clearCache(`usage_${userId}_${today}`);
    } catch (error) {
      console.error('Increment transaction usage error:', error);
    }
  }

  async incrementGroupCreation(userId: string): Promise<void> {
    try {
      const today = this.formatDate(new Date());
      const docRef = doc(db, 'usageLimits', `${userId}_${today}`);
      
      // Ensure document exists
      await this.getDailyUsage(userId);
      
      await updateDoc(docRef, {
        groupsCreated: increment(1),
        lastChecked: new Date()
      });
      
      // Clear cache
      this.clearCache(`usage_${userId}_${today}`);
    } catch (error) {
      console.error('Increment group creation error:', error);
    }
  }

  // LIMIT CHECKING
  async canCreateGroup(userId: string): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const plan = SUBSCRIPTION_PLANS[subscription.plan];
      
      if (plan.limits.groups === -1) {
        return { allowed: true, currentCount: 0, limit: -1 };
      }
      
      // Get user's current group count from groups collection
      const currentCount = await this.getUserGroupCount(userId);
      
      return {
        allowed: currentCount < plan.limits.groups,
        currentCount,
        limit: plan.limits.groups
      };
    } catch (error) {
      console.error('Check group creation limit error:', error);
      return { allowed: false, currentCount: 0, limit: 0 };
    }
  }

  async canAddGroupMember(userId: string, currentMemberCount: number): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const plan = SUBSCRIPTION_PLANS[subscription.plan];
      
      if (plan.limits.groupMembers === -1) {
        return { allowed: true, currentCount: currentMemberCount, limit: -1 };
      }
      
      return {
        allowed: currentMemberCount < plan.limits.groupMembers,
        currentCount: currentMemberCount,
        limit: plan.limits.groupMembers
      };
    } catch (error) {
      console.error('Check group member limit error:', error);
      return { allowed: false, currentCount: currentMemberCount, limit: 0 };
    }
  }

  async canCreateTransaction(userId: string): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const plan = SUBSCRIPTION_PLANS[subscription.plan];
      
      if (plan.limits.dailyTransactions === -1) {
        return { allowed: true, currentCount: 0, limit: -1 };
      }
      
      const usage = await this.getDailyUsage(userId);
      
      return {
        allowed: usage.transactionsUsed < plan.limits.dailyTransactions,
        currentCount: usage.transactionsUsed,
        limit: plan.limits.dailyTransactions
      };
    } catch (error) {
      console.error('Check transaction limit error:', error);
      return { allowed: false, currentCount: 0, limit: 0 };
    }
  }

  async canUsePremiumFeature(userId: string, featureId: string): Promise<boolean> {
    try {
      const feature = PREMIUM_FEATURES.find(f => f.id === featureId);
      if (!feature || !feature.premiumOnly) {
        return true; // Feature is not premium-only
      }
      
      return await this.isPremiumUser(userId);
    } catch (error) {
      console.error('Check premium feature access error:', error);
      return false;
    }
  }

  // DAILY PROMPT TRACKING
  async shouldShowDailyPrompt(userId: string): Promise<boolean> {
    try {
      // Don't show to premium users
      const isPremium = await this.isPremiumUser(userId);
      if (isPremium) return false;
      
      const lastShown = await AsyncStorage.getItem(`daily_prompt_${userId}`);
      const today = this.formatDate(new Date());
      
      return lastShown !== today;
    } catch (error) {
      console.error('Check daily prompt error:', error);
      return false;
    }
  }

  async markDailyPromptShown(userId: string): Promise<void> {
    try {
      const today = this.formatDate(new Date());
      await AsyncStorage.setItem(`daily_prompt_${userId}`, today);
    } catch (error) {
      console.error('Mark daily prompt shown error:', error);
    }
  }

  async shouldShowFirstTimePrompt(userId: string): Promise<boolean> {
    try {
      const hasShown = await AsyncStorage.getItem(`first_time_prompt_${userId}`);
      return hasShown !== 'true';
    } catch (error) {
      console.error('Check first time prompt error:', error);
      return true;
    }
  }

  async markFirstTimePromptShown(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`first_time_prompt_${userId}`, 'true');
    } catch (error) {
      console.error('Mark first time prompt shown error:', error);
    }
  }

  // HELPER METHODS
  private async getUserGroupCount(userId: string): Promise<number> {
    try {
      // This would typically query the groups collection
      // For now, return 0 - you'll need to implement this based on your data structure
      const { SplittingService } = await import('./firebase/splitting');
      const groups = await SplittingService.getUserGroups(userId);
      return groups.length;
    } catch (error) {
      console.error('Get user group count error:', error);
      return 0;
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getFromCache(key: string): any {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  private setCache(key: string, value: any): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
  }

  private clearCache(key: string): void {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  // SUBSCRIPTION PURCHASE
  async processSubscription(
    userId: string, 
    plan: 'monthly' | 'yearly', 
    promoCode?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Here you would integrate with your payment provider (Stripe, Apple Pay, Google Pay, etc.)
      console.log('Processing subscription:', { userId, plan, promoCode });
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Calculate period based on plan
      const now = new Date();
      const periodEnd = new Date(now);
      
      if (plan === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      
      // Update subscription
      await this.updateUserSubscription(userId, {
        plan: 'premium',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        updatedAt: new Date()
      });
      
      return {
        success: true,
        message: 'Subscription activated successfully!'
      };
    } catch (error) {
      console.error('Process subscription error:', error);
      return {
        success: false,
        message: 'Failed to process subscription. Please try again.'
      };
    }
  }

  async cancelSubscription(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.updateUserSubscription(userId, {
        cancelAtPeriodEnd: true,
        updatedAt: new Date()
      });
      
      return {
        success: true,
        message: 'Subscription will be cancelled at the end of the current period.'
      };
    } catch (error) {
      console.error('Cancel subscription error:', error);
      return {
        success: false,
        message: 'Failed to cancel subscription. Please try again.'
      };
    }
  }

  async reactivateSubscription(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.updateUserSubscription(userId, {
        cancelAtPeriodEnd: false,
        updatedAt: new Date()
      });
      
      return {
        success: true,
        message: 'Subscription reactivated successfully!'
      };
    } catch (error) {
      console.error('Reactivate subscription error:', error);
      return {
        success: false,
        message: 'Failed to reactivate subscription. Please try again.'
      };
    }
  }

  // GET SUBSCRIPTION SUMMARY
  async getSubscriptionSummary(userId: string): Promise<{
    subscription: UserSubscription;
    plan: SubscriptionPlan;
    usage: {
      groups: { current: number; limit: number };
      transactions: { current: number; limit: number };
    };
    daysUntilRenewal?: number;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const plan = SUBSCRIPTION_PLANS[subscription.plan];
      
      const groupCount = await this.getUserGroupCount(userId);
      const dailyUsage = await this.getDailyUsage(userId);
      
      let daysUntilRenewal: number | undefined;
      if (subscription.currentPeriodEnd) {
        const now = new Date();
        const timeDiff = subscription.currentPeriodEnd.getTime() - now.getTime();
        daysUntilRenewal = Math.ceil(timeDiff / (1000 * 3600 * 24));
      }
      
      return {
        subscription,
        plan,
        usage: {
          groups: {
            current: groupCount,
            limit: plan.limits.groups
          },
          transactions: {
            current: dailyUsage.transactionsUsed,
            limit: plan.limits.dailyTransactions
          }
        },
        daysUntilRenewal
      };
    } catch (error) {
      console.error('Get subscription summary error:', error);
      throw error;
    }
  }
}