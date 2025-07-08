// src/components/modals/SubscriptionModal.tsx
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';

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
  { text: 'Unlimited Groups', icon: 'people', premium: true },
  { text: 'Unlimited Group Members', icon: 'person-add', premium: true },
  { text: 'Unlimited Daily Transactions', icon: 'card', premium: true },
  { text: 'Advanced Analytics & Insights', icon: 'analytics', premium: true },
  { text: 'Receipt Scanning (AI Powered)', icon: 'camera', premium: true },
  { text: 'Group Chat & Messaging', icon: 'chatbubbles', premium: true },
  { text: 'QR Code Sharing', icon: 'qr-code', premium: true },
  { text: 'Gmail Integration', icon: 'mail', premium: true },
  { text: 'Priority Customer Support', icon: 'headset', premium: true },
  { text: 'Export Data (PDF, Excel)', icon: 'download', premium: true },
  { text: 'Advanced Splitting Options', icon: 'calculator', premium: true },
  { text: 'Recurring Expenses', icon: 'repeat', premium: true },
];

const FREE_FEATURES: PlanFeature[] = [
  { text: 'Up to 3 Groups', icon: 'people' },
  { text: 'Up to 10 Members per Group', icon: 'person-add' },
  { text: '3 Transactions per Day', icon: 'card' },
  { text: 'Basic Expense Tracking', icon: 'list' },
  { text: 'Simple Split Calculations', icon: 'calculator-outline' },
  { text: 'Basic Notifications', icon: 'notifications-outline' },
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
  const { theme } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [promoCode, setPromoCode] = useState('');
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [canCloseModal, setCanCloseModal] = useState(canClose);
  const [countdown, setCountdown] = useState(autoCloseAfter || 0);
  const [loading, setLoading] = useState(false);

  const scaleAnim = new Animated.Value(0);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

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

  const monthlyPrice = 9.99;
  const yearlyPrice = 99.99;
  const yearlyMonthlyPrice = yearlyPrice / 12;
  const savings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <SafeAreaView style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerContent}>
                  <Text style={styles.title}>{getModalTitle()}</Text>
                  <Text style={styles.subtitle}>{getModalSubtitle()}</Text>
                </View>
                {canCloseModal && (
                  <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>
                )}
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
                          <Ionicons name="checkmark-circle" size={24} color="#667eea" />
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
                          <Ionicons name="checkmark-circle" size={24} color="#667eea" />
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
                        <View style={styles.featureIcon}>
                          <Ionicons name={feature.icon as any} size={20} color="#FFD700" />
                        </View>
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
                          <Ionicons name={feature.icon as any} size={16} color="rgba(255,255,255,0.7)" />
                          <Text style={styles.comparisonText}>{feature.text}</Text>
                        </View>
                      ))}
                    </View>
                    
                    <View style={styles.comparisonColumn}>
                      <Text style={styles.comparisonHeader}>Premium</Text>
                      {PLAN_FEATURES.slice(0, 6).map((feature, index) => (
                        <View key={index} style={styles.comparisonItem}>
                          <Ionicons name={feature.icon as any} size={16} color="#FFD700" />
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
                    <Ionicons 
                      name={showPromoInput ? 'chevron-up' : 'chevron-down'} 
                      size={16} 
                      color="rgba(255,255,255,0.8)" 
                    />
                  </TouchableOpacity>
                  
                  {showPromoInput && (
                    <View style={styles.promoInputContainer}>
                      <TextInput
                        style={styles.promoInput}
                        placeholder="Enter promo code"
                        placeholderTextColor="rgba(255,255,255,0.5)"
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
                <Button
                  title={`Start Premium - $${selectedPlan === 'yearly' ? yearlyPrice.toFixed(2) : monthlyPrice.toFixed(2)}`}
                  onPress={handleSubscribe}
                  loading={loading}
                  style={styles.subscribeButton}
                  textStyle={styles.subscribeButtonText}
                />
                
                <Text style={styles.termsText}>
                  By subscribing, you agree to our Terms of Service and Privacy Policy.
                  Cancel anytime in your account settings.
                </Text>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.95,
    maxHeight: height * 0.9,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 10,
  },
  headerContent: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
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
  comparisonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 8,
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
  },
  subscribeButton: {
    backgroundColor: 'white',
    marginBottom: 12,
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