// src/components/modals/SubscriptionModal.tsx - Fixed version
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: (plan: 'monthly' | 'yearly', promoCode?: string) => void;
  reason?: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature';
  featureName?: string;
  canClose?: boolean;
  autoCloseAfter?: number; // seconds
}

interface PlanFeature {
  text: string;
  icon: string;
  premium?: boolean;
}

const PLAN_FEATURES: PlanFeature[] = [
  { text: 'Unlimited Groups', icon: '👥', premium: true },
  { text: 'Unlimited Group Members', icon: '👤', premium: true },
  { text: 'Unlimited Daily Transactions', icon: '💳', premium: true },
  { text: 'Advanced Analytics & Insights', icon: '📊', premium: true },
  { text: 'Receipt Scanning (AI Powered)', icon: '📷', premium: true },
  { text: 'Group Chat & Messaging', icon: '💬', premium: true },
  { text: 'QR Code Sharing', icon: '📱', premium: true },
  { text: 'Gmail Integration', icon: '📧', premium: true },
  { text: 'Priority Customer Support', icon: '🎧', premium: true },
  { text: 'Export Data (PDF, Excel)', icon: '📥', premium: true },
  { text: 'Advanced Splitting Options', icon: '🧮', premium: true },
  { text: 'Recurring Expenses', icon: '🔄', premium: true },
];

const FREE_FEATURES: PlanFeature[] = [
  { text: 'Up to 3 Groups', icon: '👥' },
  { text: 'Up to 10 Members per Group', icon: '👤' },
  { text: '3 Transactions per Day', icon: '💳' },
  { text: 'Basic Expense Tracking', icon: '📝' },
  { text: 'Simple Split Calculations', icon: '🧮' },
  { text: 'Basic Notifications', icon: '🔔' },
];

export default function SubscriptionModal({
  visible,
  onClose,
  onSubscribe,
  reason = 'firstTime',
  featureName,
  canClose = true,
  autoCloseAfter
}: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [promoCode, setPromoCode] = useState('');
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [canCloseModal, setCanCloseModal] = useState(canClose);
  const [countdown, setCountdown] = useState(autoCloseAfter || 0);
  const [loading, setLoading] = useState(false);

  console.log('🔍 Fixed SubscriptionModal render:', { visible, reason, canClose, autoCloseAfter });
  
  // Additional debugging to ensure modal is actually shown
  useEffect(() => {
    if (visible) {
      console.log('📱 SubscriptionModal becoming visible with reason:', reason);
    }
  }, [visible, reason]);

  useEffect(() => {
    if (autoCloseAfter && !canClose && visible) {
      setCountdown(autoCloseAfter);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanCloseModal(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [visible, autoCloseAfter, canClose]);

  const getModalTitle = () => {
    switch (reason) {
      case 'firstTime':
        return '🎉 Welcome to Spendy Premium!';
      case 'dailyPrompt':
        return '✨ Upgrade to Premium Today!';
      case 'groupLimit':
        return '📊 You\'ve reached your group limit';
      case 'memberLimit':
        return '👥 Group member limit reached';
      case 'transactionLimit':
        return '💳 Daily transaction limit reached';
      case 'premium_feature':
        return `🚀 ${featureName} is a Premium Feature`;
      default:
        return '✨ Upgrade to Premium';
    }
  };

  const getModalSubtitle = () => {
    switch (reason) {
      case 'firstTime':
        return 'Unlock all features and take your expense tracking to the next level!';
      case 'dailyPrompt':
        return 'Start your day with unlimited access to all premium features!';
      case 'groupLimit':
        return 'Create unlimited groups with Premium access';
      case 'memberLimit':
        return 'Add unlimited members to your groups with Premium';
      case 'transactionLimit':
        return 'Track unlimited transactions daily with Premium access';
      case 'premium_feature':
        return `Upgrade to Premium to access ${featureName} and many more features!`;
      default:
        return 'Get the most out of Spendy with Premium features!';
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await onSubscribe(selectedPlan, promoCode || undefined);
    } catch (error) {
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (canCloseModal) {
      onClose();
    }
  };

  const monthlyPrice = 2.99;
  const yearlyPrice = 25.99;
  const yearlyMonthlyPrice = yearlyPrice / 12;
  const savings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            {canCloseModal && (
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>←</Text>
              </TouchableOpacity>
            )}
            <View style={styles.headerContent}>
              <Text style={styles.title}>{getModalTitle()}</Text>
              <Text style={styles.subtitle}>{getModalSubtitle()}</Text>
            </View>
            {!canCloseModal && countdown > 0 && (
              <View style={styles.countdownContainer}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Plan Selection */}
            <View style={styles.planContainer}>
              <Text style={styles.sectionTitle}>Choose Your Plan</Text>
              
              <View style={styles.planOptions}>
                {/* Yearly Plan */}
                <TouchableOpacity
                  style={[
                    styles.planOption,
                    selectedPlan === 'yearly' && styles.selectedPlan
                  ]}
                  onPress={() => setSelectedPlan('yearly')}
                >
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>SAVE {savings}%</Text>
                  </View>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>Yearly</Text>
                    <Text style={styles.planPrice}>${yearlyPrice.toFixed(2)}</Text>
                    <Text style={styles.planPriceSubtext}>
                      ${yearlyMonthlyPrice.toFixed(2)}/month
                    </Text>
                  </View>
                  <View style={styles.planFeatures}>
                    <Text style={styles.planFeatureText}>✓ 2 months FREE</Text>
                    <Text style={styles.planFeatureText}>✓ Best value</Text>
                  </View>
                  {selectedPlan === 'yearly' && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedIndicatorText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Monthly Plan */}
                <TouchableOpacity
                  style={[
                    styles.planOption,
                    selectedPlan === 'monthly' && styles.selectedPlan
                  ]}
                  onPress={() => setSelectedPlan('monthly')}
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>Monthly</Text>
                    <Text style={styles.planPrice}>${monthlyPrice.toFixed(2)}</Text>
                    <Text style={styles.planPriceSubtext}>per month</Text>
                  </View>
                  <View style={styles.planFeatures}>
                    <Text style={styles.planFeatureText}>✓ Cancel anytime</Text>
                    <Text style={styles.planFeatureText}>✓ Flexible billing</Text>
                  </View>
                  {selectedPlan === 'monthly' && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedIndicatorText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Premium Features */}
            <View style={styles.featuresContainer}>
              <Text style={styles.sectionTitle}>Premium Features</Text>
              <View style={styles.featureGrid}>
                {PLAN_FEATURES.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Text style={styles.featureIcon}>{feature.icon}</Text>
                    <Text style={styles.featureText}>{feature.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Free vs Premium Comparison */}
            <View style={styles.comparisonContainer}>
              <Text style={styles.sectionTitle}>Free vs Premium</Text>
              
              <View style={styles.comparisonGrid}>
                <View style={styles.comparisonColumn}>
                  <Text style={styles.comparisonHeader}>Free</Text>
                  {FREE_FEATURES.map((feature, index) => (
                    <View key={index} style={styles.comparisonItem}>
                      <Text style={styles.comparisonIcon}>{feature.icon}</Text>
                      <Text style={styles.comparisonText}>{feature.text}</Text>
                    </View>
                  ))}
                </View>
                
                <View style={styles.comparisonColumn}>
                  <Text style={styles.comparisonHeader}>Premium</Text>
                  {PLAN_FEATURES.slice(0, 6).map((feature, index) => (
                    <View key={index} style={styles.comparisonItem}>
                      <Text style={styles.comparisonIcon}>{feature.icon}</Text>
                      <Text style={styles.comparisonText}>{feature.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Promo Code */}
            <View style={styles.promoContainer}>
              <TouchableOpacity
                style={styles.promoToggle}
                onPress={() => setShowPromoInput(!showPromoInput)}
              >
                <Text style={styles.promoToggleText}>
                  Have a promo code? {showPromoInput ? 'Hide' : 'Click here'}
                </Text>
                <Text style={styles.chevron}>{showPromoInput ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              
              {showPromoInput && (
                <View style={styles.promoInputContainer}>
                  <TextInput
                    style={styles.promoInput}
                    placeholder="Enter promo code"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={promoCode}
                    onChangeText={setPromoCode}
                    autoCapitalize="characters"
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.subscribeButton, loading && styles.subscribeButtonDisabled]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              <Text style={styles.subscribeButtonText}>
                {loading 
                  ? 'Processing...' 
                  : `Start Premium - $${selectedPlan === 'yearly' ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}`
                }
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.termsText}>
              By subscribing, you agree to our Terms of Service and Privacy Policy.
              Cancel anytime in your account settings.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 10,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    textAlign: 'center',
  },
  closeButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 16,
    top: Platform.OS === 'ios' ? 50 : 20,
    zIndex: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  countdownContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  planContainer: {
    marginBottom: 30,
  },
  planOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  planOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedPlan: {
    borderColor: 'white',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  planBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planBadgeText: {
    color: '#667eea',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  planPriceSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  planFeatures: {
    alignItems: 'center',
  },
  planFeatureText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  selectedIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIndicatorText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: 'bold',
  },
  featuresContainer: {
    marginBottom: 30,
  },
  featureGrid: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 12,
  },
  featureIcon: {
    marginRight: 12,
    fontSize: 20,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  comparisonContainer: {
    marginBottom: 30,
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  comparisonColumn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  comparisonHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  comparisonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  comparisonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  comparisonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
  promoContainer: {
    marginBottom: 20,
  },
  promoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 12,
  },
  promoToggleText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginRight: 8,
  },
  chevron: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  promoInputContainer: {
    marginTop: 12,
  },
  promoInput: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  footer: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  subscribeButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  subscribeButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  subscribeButtonText: {
    color: '#667eea',
    fontWeight: 'bold',
    fontSize: 16,
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 16,
  },
});