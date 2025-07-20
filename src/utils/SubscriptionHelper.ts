// src/utils/SubscriptionHelper.ts
import { Alert } from 'react-native';
import { SubscriptionService } from '@/services/SubscriptionService';

export class SubscriptionHelper {
  private static instance: SubscriptionHelper;
  
  static getInstance(): SubscriptionHelper {
    if (!SubscriptionHelper.instance) {
      SubscriptionHelper.instance = new SubscriptionHelper();
    }
    return SubscriptionHelper.instance;
  }

  // Show subscription modal function (will be set by App.tsx)
  private showSubscriptionModal: ((
    reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature',
    feature?: string,
    canClose?: boolean
  ) => void) | null = null;

  setShowSubscriptionModal(
    fn: (
      reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature',
      feature?: string,
      canClose?: boolean
    ) => void
  ) {
    this.showSubscriptionModal = fn;
  }

  // Check if user can create a group
  async checkGroupCreationLimit(userId: string): Promise<boolean> {
    try {
      const subscriptionService = SubscriptionService.getInstance();
      const result = await subscriptionService.canCreateGroup(userId);
      
      if (!result.allowed) {
        console.log('🚫 Group creation limit reached:', result);
        
        this.showSubscriptionModal?.(
          'groupLimit',
          'Unlimited Groups',
          false
        );
        
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking group creation limit:', error);
      return false;
    }
  }

  // Check if user can add a member to group
  async checkGroupMemberLimit(userId: string, currentMemberCount: number): Promise<boolean> {
    try {
      const subscriptionService = SubscriptionService.getInstance();
      const result = await subscriptionService.canAddGroupMember(userId, currentMemberCount);
      
      if (!result.allowed) {
        console.log('🚫 Group member limit reached:', result);
        
        this.showSubscriptionModal?.(
          'memberLimit',
          'Unlimited Group Members',
          false
        );
        
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking group member limit:', error);
      return false;
    }
  }

  // Check if user can create a transaction
  async checkTransactionLimit(userId: string): Promise<boolean> {
    try {
      const subscriptionService = SubscriptionService.getInstance();
      const result = await subscriptionService.canCreateTransaction(userId);
      
      if (!result.allowed) {
        console.log('🚫 Daily transaction limit reached:', result);
        
        // For transactions, allow closing after 5 seconds
        this.showSubscriptionModal?.(
          'transactionLimit',
          'Unlimited Daily Transactions',
          false
        );
        
        return false;
      }
      
      // Increment transaction count if allowed
      await subscriptionService.incrementTransactionUsage(userId);
      return true;
    } catch (error) {
      console.error('Error checking transaction limit:', error);
      return false;
    }
  }

  // Check if user can use a premium feature
  async checkPremiumFeature(userId: string, featureId: string, featureName: string): Promise<boolean> {
    try {
      const subscriptionService = SubscriptionService.getInstance();
      const canUse = await subscriptionService.canUsePremiumFeature(userId, featureId);
      
      if (!canUse) {
        console.log('🚫 Premium feature access denied:', featureId);
        
        this.showSubscriptionModal?.(
          'premium_feature',
          featureName,
          true
        );
        
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking premium feature access:', error);
      return false;
    }
  }

  // Increment group creation count
  async incrementGroupCreation(userId: string): Promise<void> {
    try {
      const subscriptionService = SubscriptionService.getInstance();
      await subscriptionService.incrementGroupCreation(userId);
    } catch (error) {
      console.error('Error incrementing group creation:', error);
    }
  }

  // Show premium feature alert with upgrade option
  showPremiumFeatureAlert(featureName: string, description?: string) {
    Alert.alert(
      `${featureName} - Premium Feature`,
      description || `${featureName} is only available for Premium subscribers. Upgrade now to unlock this feature and many more!`,
      [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'Upgrade Now',
          style: 'default',
          onPress: () => {
            this.showSubscriptionModal?.(
              'premium_feature',
              featureName,
              true
            );
          }
        }
      ]
    );
  }

  // Check subscription status and return user plan
  async getUserSubscriptionStatus(userId: string): Promise<{
    isPremium: boolean;
    plan: 'free' | 'premium';
    status: string;
  }> {
    try {
      const subscriptionService = SubscriptionService.getInstance();
      const subscription = await subscriptionService.getUserSubscription(userId);
      const isPremium = await subscriptionService.isPremiumUser(userId);
      
      return {
        isPremium,
        plan: subscription.plan,
        status: subscription.status
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return {
        isPremium: false,
        plan: 'free',
        status: 'active'
      };
    }
  }

  // Get usage statistics for display
  async getUsageStatistics(userId: string): Promise<{
    groups: { current: number; limit: number; percentage: number };
    transactions: { current: number; limit: number; percentage: number };
  }> {
    try {
      const subscriptionService = SubscriptionService.getInstance();
      const summary = await subscriptionService.getSubscriptionSummary(userId);
      
      const groupPercentage = summary.usage.groups.limit === -1 
        ? 0 
        : (summary.usage.groups.current / summary.usage.groups.limit) * 100;
        
      const transactionPercentage = summary.usage.transactions.limit === -1 
        ? 0 
        : (summary.usage.transactions.current / summary.usage.transactions.limit) * 100;
      
      return {
        groups: {
          current: summary.usage.groups.current,
          limit: summary.usage.groups.limit,
          percentage: groupPercentage
        },
        transactions: {
          current: summary.usage.transactions.current,
          limit: summary.usage.transactions.limit,
          percentage: transactionPercentage
        }
      };
    } catch (error) {
      console.error('Error getting usage statistics:', error);
      return {
        groups: { current: 0, limit: 3, percentage: 0 },
        transactions: { current: 0, limit: 3, percentage: 0 }
      };
    }
  }

  // Premium features list for reference
  static readonly PREMIUM_FEATURES = {
    ANALYTICS: 'analytics',
    RECEIPT_SCANNING: 'receipt_scanning',
    GROUP_CHAT: 'group_chat',
    QR_CODES: 'qr_codes',
    GMAIL_INTEGRATION: 'gmail_integration',
    EXPORT_DATA: 'export_data'
  };

  // Feature names for display
  static readonly FEATURE_NAMES = {
    [SubscriptionHelper.PREMIUM_FEATURES.ANALYTICS]: 'Advanced Analytics',
    [SubscriptionHelper.PREMIUM_FEATURES.RECEIPT_SCANNING]: 'Receipt Scanning',
    [SubscriptionHelper.PREMIUM_FEATURES.GROUP_CHAT]: 'Group Chat',
    [SubscriptionHelper.PREMIUM_FEATURES.QR_CODES]: 'QR Code Features',
    [SubscriptionHelper.PREMIUM_FEATURES.GMAIL_INTEGRATION]: 'Gmail Integration',
    [SubscriptionHelper.PREMIUM_FEATURES.EXPORT_DATA]: 'Export Data'
  };

  // Helper method to check specific premium features
  async checkAnalyticsAccess(userId: string): Promise<boolean> {
    return this.checkPremiumFeature(
      userId, 
      SubscriptionHelper.PREMIUM_FEATURES.ANALYTICS, 
      SubscriptionHelper.FEATURE_NAMES[SubscriptionHelper.PREMIUM_FEATURES.ANALYTICS]
    );
  }

  async checkReceiptScanningAccess(userId: string): Promise<boolean> {
    return this.checkPremiumFeature(
      userId, 
      SubscriptionHelper.PREMIUM_FEATURES.RECEIPT_SCANNING, 
      SubscriptionHelper.FEATURE_NAMES[SubscriptionHelper.PREMIUM_FEATURES.RECEIPT_SCANNING]
    );
  }

  async checkGroupChatAccess(userId: string): Promise<boolean> {
    return this.checkPremiumFeature(
      userId, 
      SubscriptionHelper.PREMIUM_FEATURES.GROUP_CHAT, 
      SubscriptionHelper.FEATURE_NAMES[SubscriptionHelper.PREMIUM_FEATURES.GROUP_CHAT]
    );
  }

  async checkQRCodeAccess(userId: string): Promise<boolean> {
    return this.checkPremiumFeature(
      userId, 
      SubscriptionHelper.PREMIUM_FEATURES.QR_CODES, 
      SubscriptionHelper.FEATURE_NAMES[SubscriptionHelper.PREMIUM_FEATURES.QR_CODES]
    );
  }

  async checkGmailIntegrationAccess(userId: string): Promise<boolean> {
    return this.checkPremiumFeature(
      userId, 
      SubscriptionHelper.PREMIUM_FEATURES.GMAIL_INTEGRATION, 
      SubscriptionHelper.FEATURE_NAMES[SubscriptionHelper.PREMIUM_FEATURES.GMAIL_INTEGRATION]
    );
  }

  async checkExportAccess(userId: string): Promise<boolean> {
    return this.checkPremiumFeature(
      userId, 
      SubscriptionHelper.PREMIUM_FEATURES.EXPORT_DATA, 
      SubscriptionHelper.FEATURE_NAMES[SubscriptionHelper.PREMIUM_FEATURES.EXPORT_DATA]
    );
  }

  // Show different types of subscription prompts
  showLimitReachedPrompt(limitType: 'groups' | 'members' | 'transactions') {
    const messages = {
      groups: {
        title: 'Group Limit Reached',
        message: 'You\'ve reached the free plan limit of 3 groups. Upgrade to Premium for unlimited groups!'
      },
      members: {
        title: 'Member Limit Reached', 
        message: 'You\'ve reached the free plan limit of 10 members per group. Upgrade to Premium for unlimited members!'
      },
      transactions: {
        title: 'Daily Transaction Limit Reached',
        message: 'You\'ve reached today\'s limit of 3 transactions. Upgrade to Premium for unlimited daily transactions!'
      }
    };

    const { title, message } = messages[limitType];
    
    Alert.alert(
      title,
      message,
      [
        { 
          text: limitType === 'transactions' ? 'Continue Anyway' : 'Maybe Later', 
          style: 'cancel' 
        },
        {
          text: 'Upgrade Now',
          style: 'default',
          onPress: () => {
            const reasons = {
              groups: 'groupLimit' as const,
              members: 'memberLimit' as const,
              transactions: 'transactionLimit' as const
            };
            
            this.showSubscriptionModal?.(
              reasons[limitType],
              `Unlimited ${limitType.charAt(0).toUpperCase() + limitType.slice(1)}`,
              limitType === 'transactions'
            );
          }
        }
      ]
    );
  }
}