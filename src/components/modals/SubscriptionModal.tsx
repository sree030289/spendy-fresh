// src/components/modals/SubscriptionModal.tsx - Updated with Firebase-driven configuration
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import FullscreenModal from '@/components/common/FullscreenModal';
import SubscriptionConfigService, { SubscriptionConfig } from '@/services/firebase/SubscriptionConfigService';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/currency';

const { width, height } = Dimensions.get('window');

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: (plan: 'monthly' | 'yearly', promoCode?: string) => void;
  reason?: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature';
  featureName?: string;
  canClose?: boolean;
  autoCloseAfter?: number; // seconds
  onCountdownComplete?: () => void;
  autoCloseOnComplete?: boolean; // automatically close modal when countdown finishes
}

export default function SubscriptionModal({
  visible,
  onClose,
  onSubscribe,
  reason = 'firstTime',
  featureName,
  canClose = true,
  autoCloseAfter,
  onCountdownComplete,
  autoCloseOnComplete = false
}: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [promoCode, setPromoCode] = useState('');
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [canCloseModal, setCanCloseModal] = useState(canClose);
  const [countdown, setCountdown] = useState(autoCloseAfter || 0);
  const [loading, setLoading] = useState(false);
  
  // Real-time promo code validation
  const [promoValidation, setPromoValidation] = useState<{
    valid: boolean;
    error?: string;
    discountedPrice?: number;
    originalPrice?: number;
    discountAmount?: number;
    isValidating?: boolean;
  }>({ valid: false });
  
  // Real pricing from payment service
  const [realPricing, setRealPricing] = useState<{
    monthly: number;
    yearly: number;
    currency: string;
  } | null>(null);

  // Subscription configuration state
  const [subscriptionConfig, setSubscriptionConfig] = useState<SubscriptionConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Get user info for currency
  const { user } = useAuth();

  // Initialize subscription configuration and real pricing
  useEffect(() => {
    const configService = SubscriptionConfigService.getInstance();
    
    const initializeConfig = async () => {
      setConfigLoading(true);
      try {
        await configService.initialize();
        
        // Get config converted to user's currency
        const userCurrency = user?.currency || 'USD';
        console.log('💱 Using user currency:', userCurrency);
        
        const config = configService.getCurrentConfigForUser(userCurrency);
        setSubscriptionConfig(config);
        setSelectedPlan(config.displayConfig.defaultPlan);
        setShowPromoInput(config.displayConfig.promoCodeEnabled);
        
        // Load real pricing from payment service
        await loadRealPricing();
        
      } catch (error) {
        console.error('Failed to initialize subscription config:', error);
        // Use fallback config
        const fallbackConfig = configService.getCurrentConfig();
        setSubscriptionConfig(fallbackConfig);
      } finally {
        setConfigLoading(false);
      }
    };

    if (user) {
      initializeConfig();
    }

    // Listen for real-time config updates
    const unsubscribe = configService.onConfigUpdate((config) => {
      console.log('📊 Subscription config updated:', config);
      
      // Convert to user's currency before setting
      const userCurrency = user?.currency || 'USD';
      const convertedConfig = configService.getCurrentConfigForUser(userCurrency);
      
      setSubscriptionConfig(convertedConfig);
      // Update selected plan if default changed
      if (convertedConfig.displayConfig.defaultPlan !== selectedPlan) {
        setSelectedPlan(convertedConfig.displayConfig.defaultPlan);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Load real pricing from payment service
  const loadRealPricing = async () => {
    try {
      if (!user?.id) return;
      
      console.log('💰 Loading real pricing from payment service...');
      
      const { default: RealPaymentService } = await import('@/services/RealPaymentService');
      const paymentService = RealPaymentService.getInstance();
      
      await paymentService.initialize(user.id);
      const products = await paymentService.getAvailableProducts();
      
      if (products.length > 0) {
        const monthlyProduct = products.find(p => 
          p.identifier.includes('monthly') && !p.identifier.includes('yearly')
        );
        const yearlyProduct = products.find(p => 
          p.identifier.includes('yearly') || p.identifier.includes('annual')
        );
        
        if (monthlyProduct && yearlyProduct) {
          setRealPricing({
            monthly: parseFloat(monthlyProduct.price),
            yearly: parseFloat(yearlyProduct.price),
            currency: monthlyProduct.currencyCode
          });
          console.log('✅ Loaded real pricing:', {
            monthly: monthlyProduct.priceString,
            yearly: yearlyProduct.priceString,
            currency: monthlyProduct.currencyCode
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to load real pricing:', error);
      // Continue with Firebase config pricing as fallback
    }
  };

  // Real-time promo code validation
  useEffect(() => {
    const validatePromoCode = async () => {
      if (!promoCode.trim() || !user?.id) {
        setPromoValidation({ valid: false });
        return;
      }

      setPromoValidation({ valid: false, isValidating: true });

      try {
        const { default: PromoCodeService } = await import('@/services/PromoCodeService');
        const promoService = PromoCodeService.getInstance();
        
        // Get current pricing
        const pricing = getCurrentPricing();
        const currentPrice = selectedPlan === 'yearly' ? pricing.yearlyPrice : pricing.monthlyPrice;
        
        const validation = await promoService.validatePromoCode(
          promoCode,
          selectedPlan,
          currentPrice,
          user.id,
          pricing.currency
        );
        
        setPromoValidation({
          valid: validation.valid,
          error: validation.error,
          discountedPrice: validation.discountedPrice,
          originalPrice: validation.originalPrice,
          discountAmount: validation.discountAmount,
          isValidating: false
        });
        
        console.log('🏷️ Promo validation result:', validation);
      } catch (error) {
        console.error('❌ Promo validation error:', error);
        setPromoValidation({
          valid: false,
          error: 'Unable to validate promo code',
          isValidating: false
        });
      }
    };

    // Debounce validation
    const timeoutId = setTimeout(validatePromoCode, 500);
    return () => clearTimeout(timeoutId);
  }, [promoCode, selectedPlan, user?.id, subscriptionConfig]);

  // Get current pricing from config - prioritize real pricing from payment service
  const getCurrentPricing = () => {
    console.log('💰 getCurrentPricing called');
    
    // Use real pricing if available (from App Store/Play Store)
    if (realPricing) {
      console.log('🛍️ Using real App Store/Play Store pricing:', realPricing);
      const yearlyMonthlyPrice = realPricing.yearly / 12;
      const yearlyTotal = realPricing.monthly * 12;
      const savings = Math.round(((yearlyTotal - realPricing.yearly) / yearlyTotal) * 100);
      
      return {
        monthlyPrice: realPricing.monthly,
        yearlyPrice: realPricing.yearly,
        yearlyMonthlyPrice,
        savings,
        currency: realPricing.currency
      };
    }
    
    // Fallback to Firebase config pricing
    if (!subscriptionConfig) {
      console.log('⚠️ No subscription config, using fallback pricing');
      const userCurrency = user?.currency || 'USD';
      return { 
        monthlyPrice: 2.99, 
        yearlyPrice: 25.99, 
        yearlyMonthlyPrice: 2.17, 
        savings: 28, 
        currency: userCurrency 
      };
    }
    
    const { pricing } = subscriptionConfig;
    console.log('📈 Using Firebase pricing:', pricing);
    const result = {
      monthlyPrice: pricing.monthly.price,
      yearlyPrice: pricing.yearly.price,
      yearlyMonthlyPrice: pricing.yearly.monthlyEquivalent || pricing.yearly.price / 12,
      savings: pricing.savings?.percentage || 0,
      currency: pricing.monthly.currency || user?.currency || 'USD'
    };
    console.log('💸 Final pricing result:', result);
    return result;
  };

  // Get current features from config
  const getCurrentFeatures = () => {
    if (!subscriptionConfig) return [];
    return subscriptionConfig.features.keyFeatures;
  };

  // Reset states when props change
  useEffect(() => {
    console.log('🔄 SubscriptionModal props changed:', { canClose, autoCloseAfter, visible });
    // Only update canCloseModal if there's no countdown running
    if (!autoCloseAfter || autoCloseAfter <= 0 || canClose) {
      setCanCloseModal(canClose);
    }
    // Always reset countdown when props change
    if (visible) {
      setCountdown(autoCloseAfter || 0);
    }
  }, [canClose, autoCloseAfter, visible]);

  // Handle countdown timer
  useEffect(() => {
    console.log('⏱️ Countdown effect triggered:', { autoCloseAfter, canClose, visible, countdown });
    
    // Reset countdown state when props change
    if (visible && autoCloseAfter && autoCloseAfter > 0 && !canClose) {
      console.log('🚀 Starting countdown timer for', autoCloseAfter, 'seconds');
      setCountdown(autoCloseAfter);
      setCanCloseModal(false); // Ensure close button is hidden during countdown
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          console.log('⏲️ Countdown tick:', prev - 1);
          if (prev <= 1) {
            console.log('✅ Countdown finished, enabling close button');
            setCanCloseModal(true);
            clearInterval(timer);
            
            // Call completion callback and auto-close in next tick to avoid setState during render
            setTimeout(() => {
              onCountdownComplete?.();
              
              // Auto-close modal if requested
              if (autoCloseOnComplete) {
                console.log('🚪 Auto-closing modal after countdown');
                setTimeout(() => onClose(), 500); // Small delay for smooth UX
              }
            }, 0);
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        console.log('🧹 Cleaning up countdown timer');
        clearInterval(timer);
      };
    } else {
      console.log('❌ Not starting countdown:', { autoCloseAfter, canClose, visible });
      // If we're not showing a countdown, reset the countdown state
      if (visible && canClose) {
        setCountdown(0);
      }
    }
  }, [visible, autoCloseAfter, canClose]);

  const getModalTitle = () => {
    switch (reason) {
      case 'firstTime':
        return '🎉 Welcome to Premium!';
      case 'groupLimit':
        return '📊 Upgrade for More Groups';
      case 'memberLimit':
        return '👥 Upgrade for More Members';
      case 'transactionLimit':
        return '💳 Upgrade for Unlimited';
      case 'premium_feature':
        return `🚀 Unlock ${featureName}`;
      default:
        return '✨ Upgrade to Premium';
    }
  };

  const getModalSubtitle = () => {
    switch (reason) {
      case 'firstTime':
        return 'Unlock all features and take control of your expenses';
      case 'groupLimit':
        return 'Create unlimited groups and manage all your expenses';
      case 'memberLimit':
        return 'Add unlimited members to collaborate seamlessly';
      case 'transactionLimit':
        return 'Track unlimited transactions without restrictions';
      case 'premium_feature':
        return `Access ${featureName} and all premium features`;
      default:
        return 'Get the most out of Spendy with premium features';
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      onSubscribe(selectedPlan, promoCode || undefined);
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

  const { monthlyPrice, yearlyPrice, yearlyMonthlyPrice, savings, currency } = getCurrentPricing();
  const keyFeatures = getCurrentFeatures();

  if (!visible) {
    return null;
  }

  // Show loading state while config is being fetched
  if (configLoading) {
    return (
      <FullscreenModal visible={visible} onClose={onClose} title="Loading...">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.loadingText}>Loading subscription options...</Text>
          </View>
        </View>
      </FullscreenModal>
    );
  }

  // Debug countdown display
  console.log('🎨 Rendering SubscriptionModal with:', { 
    canCloseModal, 
    countdown, 
    shouldShowCountdown: !canCloseModal && countdown > 0,
    autoCloseAfter 
  });

  return (
    <FullscreenModal
      visible={visible}
      onClose={canCloseModal ? handleClose : () => {}}
      title={getModalTitle()}
      showBackButton={canCloseModal}
      rightActions={
        !canCloseModal && countdown > 0 ? (
          <>
            {console.log('🔴 RENDERING TIMER:', { canCloseModal, countdown, willShow: !canCloseModal && countdown > 0 })}
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
              <Text style={styles.countdownLabel}>SEC</Text>
            </View>
          </>
        ) : (
          <>
            {console.log('❌ NOT RENDERING TIMER:', { canCloseModal, countdown, willShow: !canCloseModal && countdown > 0 })}
            {null}
          </>
        )
      }
    >
      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>{getModalSubtitle()}</Text>
          
          {/* Key Features Grid */}
          <View style={styles.featuresGrid}>
            {keyFeatures.map((feature: string, index: number) => (
              <View key={index} style={styles.featureChip}>
                <Text style={styles.featureChipText}>✓ {feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Plan Selection */}
        <View style={styles.planSection}>
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
              <Text style={styles.planName}>Yearly</Text>
              
              {/* Show discounted price if promo code is valid */}
              {promoValidation.valid && selectedPlan === 'yearly' && promoValidation.discountedPrice ? (
                <View style={styles.priceContainer}>
                  <Text style={[styles.planPrice, styles.originalPrice]}>
                    {formatCurrency(yearlyPrice, currency)}
                  </Text>
                  <Text style={styles.planPrice}>
                    {formatCurrency(promoValidation.discountedPrice, currency)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.planPrice}>{formatCurrency(yearlyPrice, currency)}</Text>
              )}
              
              <Text style={styles.planPriceSubtext}>{formatCurrency(yearlyMonthlyPrice, currency)}/month</Text>
              <Text style={styles.planBenefit}>2 months FREE</Text>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              style={[
                styles.planOption,
                selectedPlan === 'monthly' && styles.selectedPlan
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <Text style={styles.planName}>Monthly</Text>
              
              {/* Show discounted price if promo code is valid */}
              {promoValidation.valid && selectedPlan === 'monthly' && promoValidation.discountedPrice ? (
                <View style={styles.priceContainer}>
                  <Text style={[styles.planPrice, styles.originalPrice]}>
                    {formatCurrency(monthlyPrice, currency)}
                  </Text>
                  <Text style={styles.planPrice}>
                    {formatCurrency(promoValidation.discountedPrice, currency)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.planPrice}>{formatCurrency(monthlyPrice, currency)}</Text>
              )}
              
              <Text style={styles.planPriceSubtext}>per month</Text>
              <Text style={styles.planBenefit}>Cancel anytime</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Promo Code */}
        {subscriptionConfig?.displayConfig.promoCodeEnabled && (
          showPromoInput ? (
            <View style={styles.promoSection}>
              <View style={[
                styles.promoInputContainer,
                promoValidation.isValidating && styles.promoInputValidating,
                promoValidation.valid && styles.promoInputValid,
                promoValidation.error && styles.promoInputError
              ]}>
                <TextInput
                  style={styles.promoInput}
                  placeholder="Enter promo code"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={promoCode}
                  onChangeText={setPromoCode}
                  autoCapitalize="characters"
                />
                {promoValidation.isValidating && (
                  <Text style={styles.promoStatus}>⏳</Text>
                )}
                {promoValidation.valid && (
                  <Text style={styles.promoStatus}>✅</Text>
                )}
                {promoValidation.error && !promoValidation.isValidating && (
                  <Text style={styles.promoStatus}>❌</Text>
                )}
                <TouchableOpacity
                  style={styles.promoCloseButton}
                  onPress={() => {
                    setShowPromoInput(false);
                    setPromoCode('');
                    setPromoValidation({ valid: false });
                  }}
                >
                  <Text style={styles.promoCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {/* Promo validation feedback */}
              {promoValidation.valid && promoValidation.discountAmount && (
                <View style={styles.promoSuccess}>
                  <Text style={styles.promoSuccessText}>
                    🎉 {formatCurrency(promoValidation.discountAmount, currency)} discount applied!
                  </Text>
                </View>
              )}
              
              {promoValidation.error && !promoValidation.isValidating && (
                <View style={styles.promoError}>
                  <Text style={styles.promoErrorText}>{promoValidation.error}</Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.promoToggle}
              onPress={() => setShowPromoInput(true)}
            >
              <Text style={styles.promoToggleText}>Have a promo code?</Text>
            </TouchableOpacity>
          )
        )}

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
                : (() => {
                    const currentPrice = selectedPlan === 'yearly' ? yearlyPrice : monthlyPrice;
                    const finalPrice = promoValidation.valid && promoValidation.discountedPrice 
                      ? promoValidation.discountedPrice 
                      : currentPrice;
                    return `Start Premium - ${formatCurrency(finalPrice, currency)}`;
                  })()
              }
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.termsText}>
            Cancel anytime • Secure payment • 30-day guarantee
          </Text>
        </View>
      </View>
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  featureChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  featureChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  countdownContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 10,
    position: 'absolute',
    top: -10,
    right: -10,
    zIndex: 1000,
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 22,
  },
  countdownLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
    marginTop: -2,
    includeFontPadding: false,
  },
  planSection: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 20,
  },
  planOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  planOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
    minHeight: 160,
    justifyContent: 'center',
  },
  selectedPlan: {
    borderColor: 'white',
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ scale: 1.02 }],
  },
  planBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  planBadgeText: {
    color: '#667eea',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  planPriceSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  planBenefit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  promoSection: {
    marginBottom: 16,
  },
  promoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingRight: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  promoInputValidating: {
    borderColor: 'rgba(255,255,255,0.5)',
  },
  promoInputValid: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76,175,80,0.15)',
  },
  promoInputError: {
    borderColor: '#F44336',
    backgroundColor: 'rgba(244,67,54,0.15)',
  },
  promoInput: {
    flex: 1,
    padding: 12,
    color: 'white',
    fontSize: 14,
  },
  promoStatus: {
    fontSize: 16,
    marginRight: 8,
  },
  promoCloseButton: {
    padding: 8,
    marginRight: 4,
  },
  promoCloseText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  promoToggle: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  promoToggleText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  subscribeButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  subscribeButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  subscribeButtonText: {
    color: '#667eea',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#667eea',
    textAlign: 'center',
    marginTop: 20,
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 16,
  },
  priceContainer: {
    alignItems: 'center',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    marginBottom: 2,
  },
  promoSuccess: {
    backgroundColor: 'rgba(76,175,80,0.2)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  promoSuccessText: {
    color: '#4CAF50',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  promoError: {
    backgroundColor: 'rgba(244,67,54,0.2)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  promoErrorText: {
    color: '#F44336',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});