// Quick test - Run this to make your current user premium
import { SubscriptionTestUtils } from './src/utils/testing/SubscriptionTestUtils';

const testUserId = 'mock-123'; // This is the user ID from the logs

async function makePremium() {
  try {
    console.log('Setting user as premium...');
    await SubscriptionTestUtils.setupPremiumUser(testUserId);
    
    const access = await SubscriptionTestUtils.testFeatureAccess(testUserId);
    console.log('User is now:', access.isPremium ? 'PREMIUM' : 'FREE');
    console.log('Access details:', access);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function makeFree() {
  try {
    console.log('Setting user as free...');
    await SubscriptionTestUtils.setupFreeUser(testUserId);
    
    const access = await SubscriptionTestUtils.testFeatureAccess(testUserId);
    console.log('User is now:', access.isPremium ? 'PREMIUM' : 'FREE');
    console.log('Access details:', access);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export for console use
(global as any).makePremium = makePremium;
(global as any).makeFree = makeFree;

// Auto-run on import
makePremium();
