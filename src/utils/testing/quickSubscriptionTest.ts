// src/utils/testing/quickSubscriptionTest.ts
/**
 * Quick subscription testing utilities for development
 * Import this in any screen/component where you want to quickly test subscription features
 */

import { Alert } from 'react-native';
import { SubscriptionTestUtils } from './SubscriptionTestUtils';

/**
 * Add this to any screen during development for quick subscription testing
 */
export class QuickSubscriptionTest {
  /**
   * Show a simple alert with subscription testing options
   */
  static showTestingAlert(userId: string) {
    Alert.alert(
      'Subscription Testing',
      'Choose a subscription state to test:',
      [
        {
          text: 'Make Premium',
          onPress: () => this.makePremium(userId)
        },
        {
          text: 'Start Trial',
          onPress: () => this.startTrial(userId)
        },
        {
          text: 'Make Free',
          onPress: () => this.makeFree(userId)
        },
        {
          text: 'Check Status',
          onPress: () => this.checkStatus(userId)
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  }

  /**
   * Make user premium and show confirmation
   */
  static async makePremium(userId: string) {
    try {
      await SubscriptionTestUtils.setupPremiumUser(userId);
      Alert.alert('Success', 'User is now PREMIUM! All features unlocked.');
    } catch (error) {
      Alert.alert('Error', `Failed to set premium: ${error}`);
    }
  }

  /**
   * Start trial and show confirmation
   */
  static async startTrial(userId: string) {
    try {
      await SubscriptionTestUtils.setupTrialUser(userId, 7);
      Alert.alert('Success', 'User now has 7-day TRIAL! Premium features enabled.');
    } catch (error) {
      Alert.alert('Error', `Failed to start trial: ${error}`);
    }
  }

  /**
   * Make user free and show confirmation
   */
  static async makeFree(userId: string) {
    try {
      await SubscriptionTestUtils.setupFreeUser(userId);
      Alert.alert('Success', 'User is now FREE. Limited features only.');
    } catch (error) {
      Alert.alert('Error', `Failed to set free: ${error}`);
    }
  }

  /**
   * Check current subscription status
   */
  static async checkStatus(userId: string) {
    try {
      const access = await SubscriptionTestUtils.testFeatureAccess(userId);
      const status = access.isPremium ? 'PREMIUM' : 'FREE';
      const groups = `${access.groupLimits.currentCount}/${access.groupLimits.limit === -1 ? '∞' : access.groupLimits.limit}`;
      const transactions = `${access.transactionLimits.currentCount}/${access.transactionLimits.limit === -1 ? '∞' : access.transactionLimits.limit}`;
      
      Alert.alert(
        `Status: ${status}`,
        `Groups: ${groups}\nTransactions Today: ${transactions}\n\nCan Create Groups: ${access.canCreateGroups ? 'Yes' : 'No'}\nCan Add Transactions: ${access.canAddTransactions ? 'Yes' : 'No'}`
      );
    } catch (error) {
      Alert.alert('Error', `Failed to check status: ${error}`);
    }
  }

  /**
   * Quick setup for common testing scenarios
   */
  static async quickSetup(scenario: 'premium' | 'trial' | 'free' | 'nearLimits', userId: string) {
    try {
      switch (scenario) {
        case 'premium':
          await SubscriptionTestUtils.setupPremiumUser(userId);
          break;
        case 'trial':
          await SubscriptionTestUtils.setupTrialUser(userId, 7);
          break;
        case 'free':
          await SubscriptionTestUtils.setupFreeUser(userId);
          break;
        case 'nearLimits':
          await SubscriptionTestUtils.setupFreeUser(userId);
          await SubscriptionTestUtils.setupUserUsage(userId, { 
            transactionsUsed: 8, // Close to limit of 10
            groupsCreated: 2     // Close to limit of 3
          });
          break;
      }
      return true;
    } catch (error) {
      console.error('Quick setup failed:', error);
      return false;
    }
  }
}

// Export for easy import
export const quickTest = QuickSubscriptionTest;
