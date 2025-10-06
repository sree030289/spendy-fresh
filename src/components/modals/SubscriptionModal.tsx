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
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import FullscreenModal from '@/components/common/FullscreenModal';
import SubscriptionConfigService, { SubscriptionConfig } from '@/services/firebase/SubscriptionConfigService';
import CouponService, { CouponValidationResult } from '@/services/firebase/CouponService';
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
  
  // Real-time coupon code validation
  const [promoValidation, setPromoValidation] = useState<CouponValidationResult & {
    originalPrice?: number;
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
        
        // Force clear currency cache to get latest rates (especially for INR)
        console.log('🧹 Force clearing all currency caches for fresh rates');
        const currencyService = (await import('@/services/firebase/CurrencyConversionService')).default.getInstance();
        await currencyService.forceClearAllCaches();
        
        const config = configService.getCurrentConfigForUser(userCurrency);
        setSubscriptionConfig(config);
        setSelectedPlan(config.displayConfig.defaultPlan);
        // Keep promo input closed by default, let user click to open it
        setShowPromoInput(false);
        
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
        // Use new CouponService for validation
        const couponService = CouponService.getInstance();
        await couponService.initialize();
        
        // Get current pricing
        const pricing = getCurrentPricing();
        const currentPrice = selectedPlan === 'yearly' ? pricing.yearlyPrice : pricing.monthlyPrice;
        
        const validation = await couponService.validateCoupon(
          promoCode.trim(),
          selectedPlan,
          currentPrice,
          pricing.currency
        );
        
        setPromoValidation({
          valid: validation.valid,
          error: validation.error,
          discountedPrice: validation.discountedPrice,
          originalPrice: currentPrice,
          discountAmount: validation.discountAmount,
          coupon: validation.coupon,
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

    // Debounce validation - increased to reduce flickering
    const timeoutId = setTimeout(validatePromoCode, 1000);
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
      
      console.log('💰 Pricing calculation:', {
        monthly: realPricing.monthly,
        yearly: realPricing.yearly,
        yearlyMonthlyPrice,
        yearlyTotal,
        savings,
        currency: realPricing.currency
      });
      
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
    
    const monthlyPrice = pricing.monthly.price;
    const yearlyPrice = pricing.yearly.price;
    const yearlyMonthlyPrice = pricing.yearly.monthlyEquivalent || yearlyPrice / 12;
    
    // Calculate correct savings: How much you save per year compared to monthly plan
    const yearlyTotal = monthlyPrice * 12; // What you'd pay for 12 months at monthly rate
    const actualSavings = Math.round(((yearlyTotal - yearlyPrice) / yearlyTotal) * 100);
    
    // If savings is negative, the yearly plan is more expensive - this is a config error
    if (actualSavings < 0) {
      console.warn('⚠️ PRICING ERROR: Yearly plan is more expensive than monthly!', {
        monthlyPrice,
        yearlyPrice,
        yearlyTotal,
        deficit: yearlyPrice - yearlyTotal
      });
    }
    
    const result = {
      monthlyPrice,
      yearlyPrice,
      yearlyMonthlyPrice,
      savings: Math.max(0, actualSavings), // Ensure savings is never negative in display
      currency: pricing.monthly.currency || user?.currency || 'USD'
    };
    console.log('💸 Final pricing result:', result);
    console.log('📊 Savings calculation:', {
      monthlyPrice,
      yearlyPrice,
      yearlyTotal,
      actualSavings,
      configSavings: pricing.savings?.percentage
    });
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

            // FIXED: Set bypass flag for transaction limits to prevent loop
            // This allows user to submit expense after seeing subscription modal
            if (reason === 'transactionLimit') {
              console.log('🎯 Setting bypass flag for transaction limit');
              (global as any).bypassTransactionLimitOnce = true;
            }

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
        return '🎉  Upgrade for More Groups';
      case 'memberLimit':
        return '🎉  Upgrade for More Members';
      case 'transactionLimit':
        return '🎉 Upgrade for Unlimited';
      case 'premium_feature':
        return `🎉  Unlock ${featureName}`;
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
        return 'Get the most out of Meet-n-Split with premium features';
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
      title=""
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
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Enhanced Header Banner */}
        <View style={styles.enhancedHeaderBanner}>
          <View style={styles.enhancedBannerContent}>
            <Text style={styles.enhancedBannerTitle}>{getModalTitle()}</Text>
            <Text style={styles.enhancedBannerSubtitle}>{getModalSubtitle()}</Text>
          </View>
          
          {/* Premium Features List */}
          <View style={styles.premiumFeaturesContainer}>
            <View style={styles.featuresColumn}>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>∞</Text>
                <Text style={styles.featureText}>Unlimited Groups</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>$</Text>
                <Text style={styles.featureText}>Unlimited Expenses</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>→</Text>
                <Text style={styles.featureText}>QR Code Invites</Text>
              </View>
            </View>
            
            <View style={styles.featuresColumn}>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>↗</Text>
                <Text style={styles.featureText}>Smart Analytics</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>@</Text>
                <Text style={styles.featureText}>Group Chat</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>$</Text>
                <Text style={styles.featureText}>Advanced Reports</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Compact Plan Selection */}
        <View style={styles.compactPlanSection}>
          <View style={styles.compactPlanOptions}>
            {/* Yearly Plan */}
            <TouchableOpacity
              style={[
                styles.compactPlanOption,
                selectedPlan === 'yearly' && styles.selectedCompactPlan
              ]}
              onPress={() => setSelectedPlan('yearly')}
            >
              <View style={styles.compactPlanBadge}>
                <Text style={styles.compactPlanBadgeText}>SAVE {savings}%</Text>
              </View>
              
              <View style={styles.compactPlanHeader}>
                <Text style={styles.compactPlanName}>Annual</Text>
                <Text style={styles.compactPlanSubtitle}>Most Popular</Text>
              </View>
              
              <View style={styles.compactPlanPriceRow}>
                {promoValidation.valid && selectedPlan === 'yearly' && promoValidation.discountedPrice !== undefined ? (
                  <View style={styles.priceContainer}>
                    <Text style={[styles.compactPlanPrice, styles.originalPrice]}>
                      {formatCurrency(yearlyPrice, currency)}
                    </Text>
                    <Text style={styles.compactPlanPrice}>
                      {promoValidation.discountedPrice === 0 ? 'FREE' : formatCurrency(promoValidation.discountedPrice, currency)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.compactPlanPrice}>{formatCurrency(yearlyPrice, currency)}</Text>
                )}
                
                <Text style={styles.compactPlanPriceSubtext}>{formatCurrency(yearlyMonthlyPrice, currency)}/mo</Text>
              </View>
              
              <Text style={styles.compactPlanBenefit}>
                {monthlyPrice * 12 > yearlyPrice 
                  ? `✓ Save ${formatCurrency(monthlyPrice * 12 - yearlyPrice, currency)} per year`
                  : `✓ Best Value Plan`
                }
              </Text>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              style={[
                styles.compactPlanOption,
                selectedPlan === 'monthly' && styles.selectedCompactPlan
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <View style={styles.compactPlanHeader}>
                <Text style={styles.compactPlanName}>Monthly</Text>
                <Text style={styles.compactPlanSubtitle}>Flexible</Text>
              </View>
              
              <View style={styles.compactPlanPriceRow}>
                {promoValidation.valid && selectedPlan === 'monthly' && promoValidation.discountedPrice !== undefined ? (
                  <View style={styles.priceContainer}>
                    <Text style={[styles.compactPlanPrice, styles.originalPrice]}>
                      {formatCurrency(monthlyPrice, currency)}
                    </Text>
                    <Text style={styles.compactPlanPrice}>
                      {promoValidation.discountedPrice === 0 ? 'FREE' : formatCurrency(promoValidation.discountedPrice, currency)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.compactPlanPrice}>{formatCurrency(monthlyPrice, currency)}</Text>
                )}
                
                <Text style={styles.compactPlanPriceSubtext}>per month</Text>
              </View>
              
              <Text style={styles.compactPlanBenefit}>✓ Cancel anytime</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Compact Promo Code - Fixed positioning */}
        {subscriptionConfig?.displayConfig.promoCodeEnabled && (
          <View style={styles.compactPromoSection}>
            {showPromoInput ? (
              <View style={styles.compactPromoContainer}>
                {/* Input Container */}
                <View style={[
                  styles.compactPromoInputContainer,
                  promoValidation.isValidating && styles.promoInputValidating,
                  promoValidation.valid && styles.promoInputValid,
                  promoValidation.error && styles.promoInputError
                ]}>
                  <TextInput
                    style={styles.compactPromoInput}
                    placeholder="Enter promo code"
                    placeholderTextColor="#999"
                    value={promoCode}
                    onChangeText={setPromoCode}
                    autoCapitalize="none"
                    autoCorrect={false}
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
                    style={styles.compactPromoCloseButton}
                    onPress={() => {
                      setShowPromoInput(false);
                      setPromoCode('');
                      setPromoValidation({ valid: false });
                    }}
                  >
                    <Text style={styles.promoCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Apply Button - Outside the input container */}
                <TouchableOpacity
                  style={styles.applyPromoButton}
                  onPress={async () => {
                    if (promoCode.trim() && promoValidation.valid) {
                      try {
                        const couponService = CouponService.getInstance();
                        const applied = await couponService.applyCoupon(promoCode.trim());
                        
                        if (applied) {
                          console.log(`✅ Coupon ${promoCode.trim()} applied successfully`);
                          // You might want to show a success message here
                        }
                      } catch (error) {
                        console.error('❌ Error applying coupon:', error);
                      }
                    } else if (promoCode.trim()) {
                      // Trigger validation manually if not validated yet
                      setPromoValidation({ valid: false, isValidating: true });
                    }
                  }}
                  disabled={!promoCode.trim() || promoValidation.isValidating}
                >
                  <Text style={styles.applyPromoText}>
                    {promoValidation.valid ? 'Apply' : 'Validate'}
                  </Text>
                </TouchableOpacity>
                
                {/* Compact Promo validation feedback */}
                {promoValidation.valid && promoValidation.coupon && (
                  <Text style={styles.compactPromoSuccessText}>
                    🎉 {promoValidation.coupon.discountPercent}% OFF - Save {formatCurrency(promoValidation.discountAmount || 0, currency)}!
                  </Text>
                )}
                
                {promoValidation.error && !promoValidation.isValidating && (
                  <Text style={styles.compactPromoErrorText}>{promoValidation.error}</Text>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.compactPromoToggle}
                onPress={() => setShowPromoInput(true)}
              >
                <Text style={styles.compactPromoToggleText}>🏷️ Have a promo code?</Text>
              </TouchableOpacity>
            )}
          </View>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40, // Extra padding for keyboard
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  featureChip: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  featureChipText: {
    color: '#B0004F',
    fontSize: 13,
    fontWeight: '600',
  },
  countdownContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#B0004F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#B0004F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 22,
  },
  countdownLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
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
    gap: 16,
  },
  planOption: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#e9ecef',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedPlan: {
    borderColor: '#B0004F',
    backgroundColor: '#fff5f5',
    shadowColor: '#B0004F',
    shadowOpacity: 0.2,
  },
  planBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#B0004F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#B0004F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  planBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#B0004F',
    flex: 1,
  },
  planPriceSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  planBenefit: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#f8fff8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  promoSection: {
    marginBottom: 20,
  },
  promoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  promoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingRight: 4,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  promoInputValidating: {
    borderColor: '#6c757d',
  },
  promoInputValid: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },
  promoInputError: {
    borderColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },
  promoInput: {
    flex: 1,
    padding: 16,
    color: '#333',
    fontSize: 16,
  },
  promoStatus: {
    fontSize: 18,
    marginRight: 12,
  },
  promoCloseButton: {
    padding: 12,
    marginRight: 4,
  },
  promoCloseText: {
    color: '#6c757d',
    fontSize: 18,
    fontWeight: 'bold',
  },
  promoToggle: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  promoToggleText: {
    color: '#B0004F',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  subscribeButton: {
    backgroundColor: '#B0004F',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#B0004F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  subscribeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  subscribeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  loadingText: {
    fontSize: 16,
    color: '#B0004F',
    textAlign: 'center',
    marginTop: 20,
  },
  termsText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  priceContainer: {
    alignItems: 'center',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: '#999',
    fontSize: 20,
    marginBottom: 4,
  },
  promoSuccess: {
    backgroundColor: '#f8fff8',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  promoSuccessText: {
    color: '#28a745',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  promoError: {
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  promoErrorText: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Header Banner Styles
  headerBanner: {
    backgroundColor: '#f8f9ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e3e6ff',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B0004F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerEmoji: {
    fontSize: 20,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  compactFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactFeatureChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3e6ff',
  },
  compactFeatureText: {
    color: '#B0004F',
    fontSize: 11,
    fontWeight: '600',
  },
  // Compact Plan Styles
  compactPlanSection: {
    marginVertical: 16,
  },
  compactPlanOptions: {
    flexDirection: 'row',
    gap: 14,
  },
  compactPlanOption: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
    position: 'relative',
    minHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCompactPlan: {
    borderColor: '#B0004F',
    backgroundColor: '#fff5f5',
  },
  compactPlanBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#B0004F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  compactPlanBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  compactPlanHeader: {
    marginBottom: 8,
  },
  compactPlanName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  compactPlanSubtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  compactPlanPriceRow: {
    marginBottom: 12,
  },
  compactPlanPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#B0004F',
  },
  compactPlanPriceSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  compactPlanBenefit: {
    fontSize: 10,
    color: '#28a745',
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#f8fff8',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  // Compact Promo Styles
  compactPromoSection: {
    marginBottom: 12,
  },
  compactPromoContainer: {
    alignItems: 'center',
  },
  compactPromoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
    width: '100%',
    maxWidth: 280,
    marginBottom: 12,
  },
  compactPromoInput: {
    flex: 1,
    padding: 10,
    color: '#333',
    fontSize: 14,
  },
  compactPromoCloseButton: {
    padding: 8,
  },
  compactPromoToggle: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  compactPromoToggleText: {
    color: '#B0004F',
    fontSize: 12,
    fontWeight: '600',
  },
  compactPromoSuccessText: {
    color: '#28a745',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },
  compactPromoErrorText: {
    color: '#dc3545',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 4,
  },
  applyPromoButton: {
    backgroundColor: '#B0004F',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
    maxWidth: 280,
  },
  applyPromoText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Enhanced Header Banner Styles
  enhancedHeaderBanner: {
    backgroundColor: '#f8f9ff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e3e6ff',
  },
  enhancedBannerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  enhancedBannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  enhancedBannerSubtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Premium Features Container
  premiumFeaturesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  featuresColumn: {
    flex: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 18,
    marginRight: 10,
    width: 24,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
});