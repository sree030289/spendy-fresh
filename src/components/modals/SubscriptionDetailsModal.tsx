// src/components/modals/SubscriptionDetailsModal.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import FullscreenModal from '../common/FullscreenModal';

interface SubscriptionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  subscription: {
    plan: string;
    nextBillingDate?: Date;
    price?: string;
    status?: string;
    expirationDate?: Date;
  } | null;
}

export const SubscriptionDetailsModal: React.FC<SubscriptionDetailsModalProps> = ({
  visible,
  onClose,
  subscription,
}) => {
  if (!subscription) return null;

  const getPlanName = () => {
    if (subscription.plan.includes('monthly')) return 'Monthly Premium';
    if (subscription.plan.includes('annual') || subscription.plan.includes('yearly')) return 'Annual Premium';
    return 'Premium Plan';
  };

  const getPlanPrice = () => {
    if (subscription.price) return subscription.price;
    if (subscription.plan.includes('monthly')) return '$1.99/month';
    if (subscription.plan.includes('annual') || subscription.plan.includes('yearly')) return '$10.99/year';
    return 'Premium';
  };

  const handleManageInAppStore = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const isCancelled = subscription.status === 'cancelled';
  const relevantDate = isCancelled 
    ? (subscription.expirationDate || subscription.nextBillingDate)
    : subscription.nextBillingDate;

  return (
    <FullscreenModal visible={visible} onClose={onClose} title="Subscription Details">
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>✨ PREMIUM</Text>
          </View>
          <Text style={styles.planName}>{getPlanName()}</Text>
          <Text style={styles.planPrice}>{getPlanPrice()}</Text>
        </View>

        {/* Status Card */}
        <View style={[styles.statusCard, isCancelled && styles.cancelledCard]}>
          <Text style={styles.statusTitle}>
            {isCancelled ? '⚠️ Subscription Cancelled' : '✓ Active Subscription'}
          </Text>
          {relevantDate && (
            <Text style={styles.statusDate}>
              {isCancelled 
                ? `Access until ${relevantDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                : `Next billing: ${relevantDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              }
            </Text>
          )}
        </View>

        {/* Premium Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Features</Text>
          <View style={styles.featuresList}>
            <FeatureItem text="Unlimited groups and expenses" />
            <FeatureItem text="Unlimited members per group" />
            <FeatureItem text="Unlimited transactions" />
            <FeatureItem text="Advanced analytics & insights" />
            <FeatureItem text="Priority customer support" />
            <FeatureItem text="Export data to CSV" />
            <FeatureItem text="Custom expense categories" />
            <FeatureItem text="Recurring expense tracking" />
          </View>
        </View>

        {/* Manage Button */}
        <TouchableOpacity
          style={styles.manageButton}
          onPress={handleManageInAppStore}
          activeOpacity={0.7}
        >
          <Text style={styles.manageButtonText}>Manage in App Store</Text>
          <Text style={styles.manageButtonSubtext}>
            Cancel, change plan, or update payment method
          </Text>
        </TouchableOpacity>

        {/* Info Text */}
        <Text style={styles.infoText}>
          Subscriptions are managed through your Apple ID. 
          You can cancel or change your subscription at any time in the App Store.
        </Text>
      </ScrollView>
    </FullscreenModal>
  );
};

const FeatureItem: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureCheckmark}>✓</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#f8f9ff',
    borderRadius: 16,
    marginBottom: 24,
  },
  planBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  planBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  planName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cancelledCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statusDate: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureCheckmark: {
    fontSize: 18,
    color: '#10b981',
    marginRight: 12,
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  manageButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  manageButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  manageButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
});
