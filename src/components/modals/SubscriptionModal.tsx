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
  Keyboard,
  Linking,
} from 'react-native';
import FullscreenModal from '@/components/common/FullscreenModal';
import SubscriptionConfigService, { SubscriptionConfig } from '@/services/firebase/SubscriptionConfigService';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/currency';
import Purchases from 'react-native-purchases';

const { width, height } = Dimensions.get('window');

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: (plan: 'monthly' | 'yearly', promoCode?: string) => Promise<{success: boolean}>;
  reason?: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature';
  featureName?: string;
  canClose?: boolean;
  autoCloseAfter?: number;
  onCountdownComplete?: () => void;
  autoCloseOnComplete?: boolean;
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [realPricing, setRealPricing] = useState<{ monthly: number; yearly: number; currency: string } | null>(null);
  const [subscriptionConfig, setSubscriptionConfig] = useState<SubscriptionConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const { user } = useAuth();
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    const configService = SubscriptionConfigService.getInstance();

    const initializeConfig = async () => {
      setConfigLoading(true);
      try {
        await configService.initialize();
        const userCurrency = user?.currency || 'USD';
        const currencyService = (await import('@/services/firebase/CurrencyConversionService')).default.getInstance();
        await currencyService.forceClearAllCaches();
        const config = configService.getCurrentConfigForUser(userCurrency);
        setSubscriptionConfig(config);
        setSelectedPlan(config.displayConfig.defaultPlan);
        await loadRealPricing();
      } catch (error) {
        const fallbackConfig = configService.getCurrentConfig();
        setSubscriptionConfig(fallbackConfig);
      } finally {
        setConfigLoading(false);
      }
    };

    if (user) initializeConfig();
    const unsubscribe = configService.onConfigUpdate((config) => {
      const userCurrency = user?.currency || 'USD';
      const convertedConfig = configService.getCurrentConfigForUser(userCurrency);
      setSubscriptionConfig(convertedConfig);
      if (convertedConfig.displayConfig.defaultPlan !== selectedPlan) {
        setSelectedPlan(convertedConfig.displayConfig.defaultPlan);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const loadRealPricing = async () => {
    try {
      if (!user?.id) return;
      const { default: RealPaymentService } = await import('@/services/RealPaymentService');
      const paymentService = RealPaymentService.getInstance();
      await paymentService.initialize(user.id);
      const products = await paymentService.getAvailableProducts();
      if (products.length > 0) {
        const monthlyProduct = products.find(p => p.identifier.includes('monthly') && !p.identifier.includes('yearly'));
        const yearlyProduct = products.find(p => p.identifier.includes('yearly') || p.identifier.includes('annual'));
        if (monthlyProduct && yearlyProduct) {
          setRealPricing({
            monthly: parseFloat(monthlyProduct.price),
            yearly: parseFloat(yearlyProduct.price),
            currency: monthlyProduct.currencyCode,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load real pricing:', error);
    }
  };

  // --- 🎟️ Handle App Store Promo Code Redemption ---
  const handlePromoRedemption = async () => {
    try {
      if (Platform.OS !== 'ios') {
        Alert.alert('Promo codes', 'Promo code redemption is only available on iOS builds.');
        return;
      }
      if (!promoCode.trim()) {
        Alert.alert('Enter Code', 'Please enter a promo code first.');
        return;
      }
      Alert.alert('Redeem Code', 'Opening App Store redemption sheet...');
      await Purchases.presentCodeRedemptionSheet(); // ✅ opens native sheet
    } catch (error: any) {
      console.error('Error presenting redemption sheet:', error);
      Alert.alert('Error', 'Unable to present code redemption sheet.');
    }
  };

  const getCurrentPricing = () => {
    if (realPricing) {
      const yearlyMonthlyPrice = realPricing.yearly / 12;
      const yearlyTotal = realPricing.monthly * 12;
      const savings = Math.round(((yearlyTotal - realPricing.yearly) / yearlyTotal) * 100);
      return {
        monthlyPrice: realPricing.monthly,
        yearlyPrice: realPricing.yearly,
        yearlyMonthlyPrice,
        savings,
        currency: realPricing.currency,
      };
    }
    const fallback = subscriptionConfig?.pricing || {
      monthly: { price: 2.99, currency: 'USD' },
      yearly: { price: 25.99, currency: 'USD' },
    };
    return {
      monthlyPrice: fallback.monthly.price,
      yearlyPrice: fallback.yearly.price,
      yearlyMonthlyPrice: fallback.yearly.price / 12,
      savings: 20,
      currency: fallback.monthly.currency,
    };
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // 🧩 Allow redeeming promo first
      if (Platform.OS === 'ios' && promoCode.trim()) {
        await Purchases.presentCodeRedemptionSheet();
      }
      const result = await onSubscribe(selectedPlan, promoCode || undefined);
      if (result.success) setShowSuccess(true);
    } catch (error) {
      console.error('Subscription failed:', error);
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { monthlyPrice, yearlyPrice, yearlyMonthlyPrice, savings, currency } = getCurrentPricing();

  if (!visible) return null;
  if (configLoading)
    return (
      <FullscreenModal visible={visible} onClose={onClose} title="Loading...">
        <View style={styles.container}>
          <Text style={styles.loadingText}>Loading subscription options...</Text>
        </View>
      </FullscreenModal>
    );

  // ✅ Success screen
  if (showSuccess)
    return (
      <FullscreenModal visible={visible} onClose={() => {}} title="" showBackButton={false}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Welcome to Premium!</Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => {
              setShowSuccess(false);
              onClose();
            }}
          >
            <Text style={styles.successButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </FullscreenModal>
    );

  return (
    <FullscreenModal visible={visible} onClose={onClose} title="">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.headerText}>Choose your plan</Text>

          {/* Plan Buttons */}
          <View style={styles.planButtons}>
            <TouchableOpacity
              style={[styles.planOption, selectedPlan === 'yearly' && styles.planSelected]}
              onPress={() => setSelectedPlan('yearly')}
            >
              <Text style={styles.planTitle}>Yearly</Text>
              <Text style={styles.planPrice}>{formatCurrency(yearlyPrice, currency)}</Text>
              <Text style={styles.planSubtitle}>Save {savings}%</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planOption, selectedPlan === 'monthly' && styles.planSelected]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <Text style={styles.planTitle}>Monthly</Text>
              <Text style={styles.planPrice}>{formatCurrency(monthlyPrice, currency)}</Text>
              <Text style={styles.planSubtitle}>Cancel anytime</Text>
            </TouchableOpacity>
          </View>

          {/* Promo Input */}
          <View style={styles.promoSection}>
            {showPromoInput ? (
              <View style={styles.promoInputContainer}>
                <TextInput
                  style={styles.promoInput}
                  placeholder="Enter promo code"
                  placeholderTextColor="#999"
                  value={promoCode}
                  onChangeText={setPromoCode}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.promoButton} onPress={handlePromoRedemption}>
                  <Text style={styles.promoButtonText}>Redeem</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.promoToggle} onPress={() => setShowPromoInput(true)}>
                <Text style={styles.promoToggleText}>🏷️ Have a promo code?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Subscribe button */}
          <TouchableOpacity
            style={[styles.subscribeButton, loading && styles.subscribeDisabled]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            <Text style={styles.subscribeButtonText}>
              {loading ? 'Processing...' : `Start Premium – ${formatCurrency(selectedPlan === 'yearly' ? yearlyPrice : monthlyPrice, currency)}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </FullscreenModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  scrollContent: { padding: 16 },
  headerText: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  planButtons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  planOption: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 16, width: '45%', alignItems: 'center' },
  planSelected: { borderColor: '#B0004F', backgroundColor: '#fff5f5' },
  planTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  planPrice: { fontSize: 20, fontWeight: '800', color: '#B0004F' },
  planSubtitle: { fontSize: 12, color: '#555' },
  promoSection: { marginVertical: 16, alignItems: 'center' },
  promoToggle: { padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8 },
  promoToggleText: { color: '#B0004F', fontWeight: '600' },
  promoInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, overflow: 'hidden' },
  promoInput: { flex: 1, padding: 12, fontSize: 14 },
  promoButton: { backgroundColor: '#B0004F', paddingHorizontal: 16, paddingVertical: 12 },
  promoButtonText: { color: 'white', fontWeight: '600' },
  subscribeButton: { backgroundColor: '#B0004F', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  subscribeDisabled: { backgroundColor: '#ccc' },
  subscribeButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  loadingText: { textAlign: 'center', color: '#B0004F', marginTop: 20 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: 'white' },
  successEmoji: { fontSize: 80, marginBottom: 24 },
  successTitle: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 20 },
  successButton: { backgroundColor: '#6366f1', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 12 },
  successButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
});
