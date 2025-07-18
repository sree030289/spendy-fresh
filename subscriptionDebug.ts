// Quick subscription status checker - Run in console for debugging
// Usage: checkUserSubscription('your-user-id')

import { SubscriptionService } from './src/services/SubscriptionService';

export const checkUserSubscription = async (userId: string) => {
  try {
    const subscriptionService = SubscriptionService.getInstance();
    
    console.log('🔍 === SUBSCRIPTION STATUS CHECK ===');
    console.log('User ID:', userId);
    
    // Check if premium
    const isPremium = await subscriptionService.isPremiumUser(userId);
    console.log('Is Premium:', isPremium);
    
    // Get subscription details
    const subscription = await subscriptionService.getUserSubscription(userId);
    console.log('Subscription Details:', {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEnd: subscription.trialEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
    });
    
    // Check feature access
    const groupCheck = await subscriptionService.canCreateGroup(userId);
    const transactionCheck = await subscriptionService.canCreateTransaction(userId);
    
    console.log('Feature Access:', {
      canCreateGroups: groupCheck.allowed,
      groupLimits: `${groupCheck.currentCount}/${groupCheck.limit}`,
      canCreateTransactions: transactionCheck.allowed,
      transactionLimits: `${transactionCheck.currentCount}/${transactionCheck.limit}`
    });
    
    console.log('=================================');
    
    return {
      isPremium,
      subscription,
      groupAccess: groupCheck,
      transactionAccess: transactionCheck
    };
  } catch (error) {
    console.error('Error checking subscription:', error);
    return null;
  }
};

// Quick test functions
export const testSubscriptionFunctions = {
  checkUser: checkUserSubscription,
  
  async makePremium(userId: string) {
    try {
      const { SubscriptionTestUtils } = await import('./src/utils/testing/SubscriptionTestUtils');
      await SubscriptionTestUtils.setupPremiumUser(userId);
      console.log('✅ User set to premium');
      return await checkUserSubscription(userId);
    } catch (error) {
      console.error('Error setting premium:', error);
    }
  },
  
  async makeFree(userId: string) {
    try {
      const { SubscriptionTestUtils } = await import('./src/utils/testing/SubscriptionTestUtils');
      await SubscriptionTestUtils.setupFreeUser(userId);
      console.log('✅ User set to free');
      return await checkUserSubscription(userId);
    } catch (error) {
      console.error('Error setting free:', error);
    }
  }
};

// Make available globally for easy console access
(global as any).checkUserSubscription = checkUserSubscription;
(global as any).testSubscription = testSubscriptionFunctions;
