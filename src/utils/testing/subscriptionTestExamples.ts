// src/utils/testing/subscriptionTestExamples.ts
/**
 * Examples of how to use SubscriptionTestUtils in your app for testing subscription features
 * 
 * You can use these methods in:
 * 1. Development mode for manual testing
 * 2. Jest unit tests
 * 3. Integration tests
 * 4. Demo/showcase purposes
 */

import { SubscriptionTestUtils } from './SubscriptionTestUtils';

/**
 * Example: Test premium features in development
 */
export async function testPremiumFeaturesInDev(userId: string) {
  console.log('🧪 Testing Premium Features for user:', userId);
  
  // Set up user as premium
  await SubscriptionTestUtils.setupPremiumUser(userId);
  
  // Test what they can access
  const access = await SubscriptionTestUtils.testFeatureAccess(userId);
  console.log('Premium user access:', access);
  
  // Should see:
  // - isPremium: true
  // - canAddGroups: true  
  // - canAddTransactions: true
  // - all features enabled
}

/**
 * Example: Test free user limitations
 */
export async function testFreeLimitations(userId: string) {
  console.log('🧪 Testing Free User Limitations for user:', userId);
  
  // Set up user as free with high usage
  await SubscriptionTestUtils.setupFreeUser(userId);
  await SubscriptionTestUtils.setupUserUsage(userId, { 
    transactionsUsed: 8, // Close to limit of 10
    groupsCreated: 2     // Close to limit of 3
  });
  
  // Test what they can access
  const access = await SubscriptionTestUtils.testFeatureAccess(userId);
  console.log('Free user near limits:', access);
  
  // Should see:
  // - isPremium: false
  // - limited groups and transactions
  // - most premium features disabled
}

/**
 * Example: Test trial experience
 */
export async function testTrialExperience(userId: string) {
  console.log('🧪 Testing Trial Experience for user:', userId);
  
  // Set up 7-day trial
  await SubscriptionTestUtils.setupTrialUser(userId, 7);
  
  const access = await SubscriptionTestUtils.testFeatureAccess(userId);
  console.log('Trial user access:', access);
  
  // Should see premium features enabled during trial
}

/**
 * Example: Test subscription upgrade flow
 */
export async function testUpgradeFlow(userId: string) {
  console.log('🧪 Testing Upgrade Flow for user:', userId);
  
  // Start as free user
  await SubscriptionTestUtils.setupFreeUser(userId);
  console.log('1. User set up as free');
  
  // Simulate upgrade
  const upgradeSuccess = await SubscriptionTestUtils.simulateUpgrade(userId, 'monthly');
  console.log('2. Upgrade result:', upgradeSuccess);
  
  // Check new access
  const access = await SubscriptionTestUtils.testFeatureAccess(userId);
  console.log('3. Post-upgrade access:', access);
}

/**
 * Example: Test expired subscription handling
 */
export async function testExpiredSubscription(userId: string) {
  console.log('🧪 Testing Expired Subscription for user:', userId);
  
  // Set up expired premium user
  await SubscriptionTestUtils.setupExpiredPremiumUser(userId);
  
  const access = await SubscriptionTestUtils.testFeatureAccess(userId);
  console.log('Expired subscription access:', access);
  
  // Should see:
  // - isPremium: false (expired)
  // - reverted to free limitations
}

/**
 * Example: Quick development setup
 * Call this when you want to quickly test premium features
 */
export async function quickPremiumSetup(userId?: string) {
  const testUserId = userId || 'dev-test-user-123';
  
  console.log('⚡ Quick Premium Setup for development testing');
  await SubscriptionTestUtils.setupPremiumUser(testUserId);
  
  console.log(`✅ User ${testUserId} is now premium!`);
  console.log('You can now test all premium features in the app.');
  
  return testUserId;
}

/**
 * Example: Reset user for clean testing
 */
export async function resetUserForTesting(userId: string) {
  console.log('🧹 Resetting user for clean testing');
  await SubscriptionTestUtils.cleanupTestUser(userId);
  console.log('✅ User reset to free tier');
}

/**
 * Example: Display all testing options
 */
export function showTestingMenu() {
  const menu = SubscriptionTestUtils.getTestingMenu();
  
  console.log('📋 Available Subscription Testing Options:');
  menu.forEach((option, index) => {
    console.log(`${index + 1}. ${option.name}`);
    console.log(`   ${option.description}`);
  });
  
  console.log('\n💡 Usage example:');
  console.log('const menu = SubscriptionTestUtils.getTestingMenu();');
  console.log('await menu[0].action("your-user-id"); // Run first option');
}

/**
 * Example: Batch test multiple scenarios
 */
export async function runBatchTests(userId: string) {
  console.log('🔄 Running batch subscription tests...');
  
  const scenarios = [
    { name: 'Free User', setup: () => SubscriptionTestUtils.setupFreeUser(userId) },
    { name: 'Trial User', setup: () => SubscriptionTestUtils.setupTrialUser(userId, 7) },
    { name: 'Premium User', setup: () => SubscriptionTestUtils.setupPremiumUser(userId) },
    { name: 'Expired Premium', setup: () => SubscriptionTestUtils.setupExpiredPremiumUser(userId) },
  ];
  
  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`\n--- Testing ${scenario.name} ---`);
    await scenario.setup();
    const access = await SubscriptionTestUtils.testFeatureAccess(userId);
    results.push({ scenario: scenario.name, access });
    console.log(`${scenario.name} results:`, access);
  }
  
  // Clean up
  await SubscriptionTestUtils.cleanupTestUser(userId);
  
  return results;
}

/**
 * Call this in your app for easy testing during development
 */
export const DevTestingHelpers = {
  makeMePremium: (userId: string) => SubscriptionTestUtils.setupPremiumUser(userId),
  makeMeFree: (userId: string) => SubscriptionTestUtils.setupFreeUser(userId),
  startTrial: (userId: string) => SubscriptionTestUtils.setupTrialUser(userId, 7),
  checkMyAccess: (userId: string) => SubscriptionTestUtils.testFeatureAccess(userId),
  simulateUpgrade: (userId: string) => SubscriptionTestUtils.simulateUpgrade(userId),
  cleanupMyData: (userId: string) => SubscriptionTestUtils.cleanupTestUser(userId),
  showMenu: () => showTestingMenu(),
};
