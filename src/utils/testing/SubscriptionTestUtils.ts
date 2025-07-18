// src/utils/testing/SubscriptionTestUtils.ts
import { SubscriptionService, UserSubscription, SUBSCRIPTION_PLANS } from '@/services/SubscriptionService';

export class SubscriptionTestUtils {
  private static subscriptionService = SubscriptionService.getInstance();

  /**
   * Set up a user with a premium subscription for testing
   */
  static async setupPremiumUser(userId: string, options?: {
    daysUntilExpiry?: number;
    cancelAtPeriodEnd?: boolean;
    trialUser?: boolean;
  }): Promise<void> {
    const now = new Date();
    const daysUntilExpiry = options?.daysUntilExpiry || 30;
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + daysUntilExpiry);

    const subscription: UserSubscription = {
      userId,
      plan: 'premium',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: options?.cancelAtPeriodEnd || false,
      trialEnd: options?.trialUser ? periodEnd : undefined,
      createdAt: now,
      updatedAt: now,
      subscriptionId: `test_subscription_${userId}`
    };

    await this.subscriptionService.createUserSubscription(subscription);
    console.log(`✅ Set up premium subscription for user ${userId}`);
  }

  /**
   * Set up a user with a free subscription for testing
   */
  static async setupFreeUser(userId: string): Promise<void> {
    const now = new Date();
    
    const subscription: UserSubscription = {
      userId,
      plan: 'free',
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    await this.subscriptionService.createUserSubscription(subscription);
    console.log(`✅ Set up free subscription for user ${userId}`);
  }

  /**
   * Set up a user with an expired premium subscription
   */
  static async setupExpiredPremiumUser(userId: string, daysExpired: number = 5): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - (30 + daysExpired));
    
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() - daysExpired);

    const subscription: UserSubscription = {
      userId,
      plan: 'premium',
      status: 'expired',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      createdAt: periodStart,
      updatedAt: now,
      subscriptionId: `test_subscription_expired_${userId}`
    };

    await this.subscriptionService.createUserSubscription(subscription);
    console.log(`✅ Set up expired premium subscription for user ${userId} (expired ${daysExpired} days ago)`);
  }

  /**
   * Set up a user with a cancelled premium subscription (still active until period end)
   */
  static async setupCancelledPremiumUser(userId: string, daysUntilExpiry: number = 15): Promise<void> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + daysUntilExpiry);

    const subscription: UserSubscription = {
      userId,
      plan: 'premium',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
      createdAt: now,
      updatedAt: now,
      subscriptionId: `test_subscription_cancelled_${userId}`
    };

    await this.subscriptionService.createUserSubscription(subscription);
    console.log(`✅ Set up cancelled premium subscription for user ${userId} (expires in ${daysUntilExpiry} days)`);
  }

  /**
   * Set up a trial user
   */
  static async setupTrialUser(userId: string, daysLeftInTrial: number = 7): Promise<void> {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + daysLeftInTrial);

    const subscription: UserSubscription = {
      userId,
      plan: 'premium',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialEnd: trialEnd,
      createdAt: now,
      updatedAt: now,
      subscriptionId: `test_trial_${userId}`
    };

    await this.subscriptionService.createUserSubscription(subscription);
    console.log(`✅ Set up trial subscription for user ${userId} (${daysLeftInTrial} days left)`);
  }

  /**
   * Set up usage limits for testing - simulate a user who has used some of their limits
   */
  static async setupUserUsage(userId: string, options?: {
    transactionsUsed?: number;
    groupsCreated?: number;
    date?: Date;
  }): Promise<void> {
    const targetDate = options?.date || new Date();
    const dateStr = this.formatDate(targetDate);
    
    const usage = {
      userId,
      date: dateStr,
      transactionsUsed: options?.transactionsUsed || 0,
      groupsCreated: options?.groupsCreated || 0,
      lastChecked: new Date()
    };

    await this.subscriptionService.createDailyUsage(usage);
    console.log(`✅ Set up usage for user ${userId}: ${usage.transactionsUsed} transactions, ${usage.groupsCreated} groups`);
  }

  /**
   * Test subscription features access
   */
  static async testFeatureAccess(userId: string): Promise<{
    isPremium: boolean;
    canCreateGroups: boolean;
    canAddTransactions: boolean;
    groupLimits: { currentCount: number; limit: number };
    transactionLimits: { currentCount: number; limit: number };
    features: {
      analytics: boolean;
      receiptScanning: boolean;
      groupChat: boolean;
      qrCodes: boolean;
      gmailIntegration: boolean;
    };
  }> {
    const isPremium = await this.subscriptionService.isPremiumUser(userId);
    
    // Check group creation limits
    const groupCheck = await this.subscriptionService.canCreateGroup(userId);
    
    // Check transaction limits
    const transactionCheck = await this.subscriptionService.canCreateTransaction(userId);

    return {
      isPremium,
      canCreateGroups: groupCheck.allowed,
      canAddTransactions: transactionCheck.allowed,
      groupLimits: {
        currentCount: groupCheck.currentCount,
        limit: groupCheck.limit
      },
      transactionLimits: {
        currentCount: transactionCheck.currentCount,
        limit: transactionCheck.limit
      },
      features: {
        analytics: isPremium,
        receiptScanning: isPremium,
        groupChat: isPremium,
        qrCodes: isPremium,
        gmailIntegration: isPremium
      }
    };
  }

  /**
   * Get subscription summary for testing
   */
  static async getTestingSummary(userId: string): Promise<any> {
    try {
      return await this.subscriptionService.getSubscriptionSummary(userId);
    } catch (error) {
      console.error('Error getting subscription summary:', error);
      return null;
    }
  }

  /**
   * Simulate subscription upgrade
   */
  static async simulateUpgrade(userId: string, plan: 'monthly' | 'yearly' = 'monthly'): Promise<boolean> {
    try {
      const result = await this.subscriptionService.processSubscription(userId, plan);
      return result.success;
    } catch (error) {
      console.error('Error simulating upgrade:', error);
      return false;
    }
  }

  /**
   * Clean up test data for a user
   */
  static async cleanupTestUser(userId: string): Promise<void> {
    try {
      // Note: In a real implementation, you'd want to delete the documents
      // For now, we'll just set them back to free
      await this.setupFreeUser(userId);
      console.log(`✅ Cleaned up test data for user ${userId}`);
    } catch (error) {
      console.error('Error cleaning up test user:', error);
    }
  }

  /**
   * Format date to YYYY-MM-DD
   */
  private static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Display test menu for manual testing
   */
  static getTestingMenu(): Array<{
    id: string;
    name: string;
    description: string;
    action: (userId: string) => Promise<void>;
  }> {
    return [
      {
        id: 'setup_premium',
        name: 'Setup Premium User',
        description: 'Set up user with active premium subscription',
        action: (userId) => this.setupPremiumUser(userId)
      },
      {
        id: 'setup_trial',
        name: 'Setup Trial User',
        description: 'Set up user with 7-day trial',
        action: (userId) => this.setupTrialUser(userId, 7)
      },
      {
        id: 'setup_expired',
        name: 'Setup Expired User',
        description: 'Set up user with expired premium subscription',
        action: (userId) => this.setupExpiredPremiumUser(userId)
      },
      {
        id: 'setup_cancelled',
        name: 'Setup Cancelled User',
        description: 'Set up user with cancelled premium (active until period end)',
        action: (userId) => this.setupCancelledPremiumUser(userId)
      },
      {
        id: 'setup_free',
        name: 'Setup Free User',
        description: 'Set up user with free subscription',
        action: (userId) => this.setupFreeUser(userId)
      },
      {
        id: 'setup_usage_high',
        name: 'Setup High Usage',
        description: 'Set up user with high daily usage (close to limits)',
        action: (userId) => this.setupUserUsage(userId, { transactionsUsed: 2, groupsCreated: 2 })
      },
      {
        id: 'test_features',
        name: 'Test Feature Access',
        description: 'Test which features the user can access',
        action: async (userId) => {
          const access = await this.testFeatureAccess(userId);
          console.log('Feature access for user:', access);
        }
      }
    ];
  }
}
