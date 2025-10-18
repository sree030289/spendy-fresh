// App.tsx - Simplified without biometric
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { CrossPlatformAlert } from './src/utils/alertUtils';
import { hideDevIndicators } from './src/utils/devUtils';
import CircularLoader from './src/components/common/CircularLoader';

// Prevent the splash screen from auto-hiding before we control it
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors in case splash screen is already hidden
});

// Initialize development optimizations
hideDevIndicators();

// Import providers
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { ThemeProvider } from './src/hooks/useTheme';

// Import screens
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import MeetnSplitSplashScreen from './src/components/screens/MeetnSplitSplashScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';
import LandingPage from '@/components/web/LandingPage';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { RealNotificationService } from './src/services/notifications/RealNotificationService';
import { ApiService } from '@/services/api/ApiService';
import { notificationManager } from '@/services/NotificationManager';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SubscriptionService } from '@/services/SubscriptionService';
import SubscriptionModal from '@/components/modals/SubscriptionModal';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, isLoading, refreshUser } = useAuth();
  const [initializing, setInitializing] = useState(true);
  const [authFlowState, setAuthFlowState] = useState<'checking' | 'splash' | 'login' | 'authenticated'>('checking');
  const [showSplash, setShowSplash] = useState(true);

  // Hide Expo splash screen immediately when app loads
  useEffect(() => {
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
        console.log('✅ Expo splash screen hidden');
      } catch (error) {
        console.log('⚠️ Splash screen already hidden or error:', error);
      }
    };
    
    // Hide expo splash immediately
    hideSplash();
  }, []);

  // Reset auth flow state when user becomes null (after logout)
  useEffect(() => {
    if (!user && !isLoading && authFlowState === 'authenticated') {
      console.log('🔄 User logged out, resetting auth flow state');
      // Go directly to login instead of checking to avoid showing loading screen
      setAuthFlowState('login');
      setShowSplash(false);
    }
  }, [user, isLoading, authFlowState]);

  // Web-specific states
  const [showLandingPage, setShowLandingPage] = useState(Platform.OS === 'web' && !user);
  const [hasVisitedLanding, setHasVisitedLanding] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (user) {
        setShowLandingPage(false);
      } else if (!hasVisitedLanding) {
        setShowLandingPage(true);
      }
    }
  }, [user, hasVisitedLanding]);

  // Subscription states
  const [subscriptionModal, setSubscriptionModal] = useState<{
    visible: boolean;
    reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature';
    featureName: string;
    canClose: boolean;
    autoCloseAfter?: number;
  }>({
    visible: false,
    reason: 'firstTime',
    featureName: '',
    canClose: true,
    autoCloseAfter: undefined
  });

  const [appReady, setAppReady] = useState(false);
  const [subscriptionCheckComplete, setSubscriptionCheckComplete] = useState(false);
  const [pendingSubscriptionModal, setPendingSubscriptionModal] = useState<{
    reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature';
    feature?: string;
    canClose: boolean;
  } | null>(null);

  console.log('AppNavigator - User:', user ? 'Authenticated' : 'Not authenticated');
  console.log('AppNavigator - Loading:', isLoading);
  console.log('AppNavigator - Auth Flow State:', authFlowState);

  // Simple authentication flow - session based only
  useEffect(() => {
    const checkAuthenticationFlow = async () => {
      if (isLoading) return;

      try {
        console.log('🔍 Checking authentication flow...', {
          hasUser: !!user,
          authFlowState,
          isLoading,
          showSplash
        });

        // Show splash screen first
        if (showSplash && !user && authFlowState === 'checking') {
          console.log('🎬 Showing splash screen');
          setAuthFlowState('splash');
          return;
        }

        // If user is authenticated, show main app
        if (user) {
          console.log('✅ User authenticated via session');
          setAuthFlowState('authenticated');

          // Extend session in background
          const apiService = ApiService.getInstance();
          apiService.extendUserSession().catch(error => {
            console.error('⚠️ Failed to extend session:', error);
          });
          return;
        }

        // No user and splash shown - go to login
        if (!user && !isLoading && !showSplash) {
          console.log('🔍 No user session, showing login');
          setAuthFlowState('login');
        }

      } catch (error) {
        console.error('Error checking authentication flow:', error);
        if (!showSplash) {
          setAuthFlowState('login');
        }
      }
    };

    checkAuthenticationFlow();
  }, [user, isLoading, showSplash]);

  // Subscription check
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.id || !appReady) return;

      try {
        console.log('🔍 Checking subscription status for user:', user.id);
        const subscriptionService = SubscriptionService.getInstance();
        const isPremium = await subscriptionService.isPremiumUser(user.id);
        console.log('🔍 User premium status:', isPremium);
        setSubscriptionCheckComplete(true);
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setSubscriptionCheckComplete(true);
      }
    };

    checkSubscriptionStatus();
  }, [user?.id, appReady]);

  // Show pending subscription modal when ready
  useEffect(() => {
    if (pendingSubscriptionModal && appReady && subscriptionCheckComplete) {
      setTimeout(() => {
        setSubscriptionModal({
          visible: true,
          reason: pendingSubscriptionModal.reason,
          featureName: pendingSubscriptionModal.feature || '',
          canClose: pendingSubscriptionModal.canClose
        });
        setPendingSubscriptionModal(null);
      }, 1500);
    }
  }, [pendingSubscriptionModal, appReady, subscriptionCheckComplete]);

  const handleSubscriptionCountdownComplete = () => {
    setSubscriptionModal(prev => ({ ...prev, canClose: true }));
  };

  useEffect(() => {
    const initializeMainNotifications = async () => {
      try {
        console.log('🔔 Main notification service initialized');
      } catch (error) {
        console.error('❌ Failed to initialize main notification service:', error);
      }
    };

    initializeMainNotifications();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitializing(false);
      setTimeout(() => {
        setAppReady(true);
      }, 1000);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    RealNotificationService.initialize();
  }, []);

  useEffect(() => {
    if (user?.id) {
      notificationManager.initialize(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    const cleanup = QRCodeService.initializeDeepLinkListener();
    return cleanup;
  }, []);

  const navigationRef = React.useRef<any>(null);

  useEffect(() => {
    const handleNotificationResponse = async (response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data && user && navigationRef.current) {
        try {
          const { PushNotificationManager } = await import('./src/services/notifications/PushNotificationManager');
          await PushNotificationManager.handleNotificationTap(data, navigationRef.current);
        } catch (error) {
          console.error('❌ Error handling notification deep link:', error);
        }
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      subscription?.remove?.();
    };
  }, [user]);

  useEffect(() => {
    const checkPendingNavigation = async () => {
      if (user && navigationRef.current && authFlowState === 'authenticated') {
        try {
          const { RealNotificationService } = await import('./src/services/notifications/RealNotificationService');
          const pendingIntent = await RealNotificationService.getAndClearNavigationIntent();

          if (pendingIntent) {
            const { PushNotificationManager } = await import('./src/services/notifications/PushNotificationManager');
            await PushNotificationManager.handleNotificationTap(pendingIntent, navigationRef.current);
          }
        } catch (error) {
          console.error('❌ Error checking pending navigation:', error);
        }
      }
    };

    const timer = setTimeout(checkPendingNavigation, 1500);
    return () => clearTimeout(timer);
  }, [user, authFlowState]);

  useEffect(() => {
    const processRecurring = async () => {
      if (user?.id) {
        const apiService = ApiService.getInstance();
        await apiService.processRecurringExpenses();
      }
    };

    processRecurring();
    const interval = setInterval(processRecurring, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id]);

  const handleSubscriptionPurchase = async (plan: 'monthly' | 'yearly', promoCode?: string): Promise<{ success: boolean }> => {
    try {
      console.log('🛒 Starting subscription purchase:', { plan, promoCode });

      const RealPaymentService = (await import('@/services/RealPaymentService')).default;
      const paymentService = RealPaymentService.getInstance();
      await paymentService.initialize(user?.id);

      const result = await paymentService.purchaseSubscription(plan, promoCode);

      if (result.success) {
        console.log('🔄 Purchase successful! Refreshing user session...');
        
        // ✅ CRITICAL: Refresh user profile from API to propagate subscription status
        try {
          await refreshUser();
          console.log('✅ User session refreshed - subscription active globally');
        } catch (refreshError) {
          console.error('⚠️ Failed to refresh user session:', refreshError);
          // Don't fail the purchase if refresh fails
        }
        
        // Close the modal - success screen will be shown in subscription modal
        setSubscriptionModal(prev => ({ ...prev, visible: false, canClose: true }));
        return { success: true };
      } else if (!result.userCancelled) {
        CrossPlatformAlert.alert(
          'Purchase Failed',
          result.error || 'Unable to complete purchase. Please try again.'
        );
        return { success: false };
      }
      
      return { success: false };
    } catch (error) {
      console.error('Subscription purchase error:', error);
      CrossPlatformAlert.alert('Error', 'Failed to process subscription. Please try again.');
      return { success: false };
    }
  };

  const handleGetStarted = () => {
    setShowLandingPage(false);
    setHasVisitedLanding(true);
  };

  const showSubscriptionModalForReason = (
    reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature',
    feature?: string,
    canClose: boolean = true,
    autoCloseAfter?: number
  ) => {
    setSubscriptionModal({
      visible: true,
      reason,
      featureName: feature || '',
      canClose,
      autoCloseAfter
    });
  };

  const handleSubscriptionModalClose = () => {
    const wasTransactionLimit = subscriptionModal.reason === 'transactionLimit';
    const hadAutoClose = subscriptionModal.autoCloseAfter !== undefined && subscriptionModal.autoCloseAfter > 0;

    setSubscriptionModal(prev => ({ ...prev, visible: false, canClose: true }));

    if (wasTransactionLimit && hadAutoClose) {
      setTimeout(() => {
        (global as any).bypassTransactionLimitOnce = true;
        if ((global as any).openAddExpenseModal) {
          (global as any).openAddExpenseModal();
        }
      }, 600);
    }

    if ((window as any).pendingExpenseData && wasTransactionLimit) {
      const { expenseData, fromGroupDetails } = (window as any).pendingExpenseData;
      (window as any).pendingExpenseData = null;
      if ((window as any).processPendingExpense) {
        (window as any).processPendingExpense(expenseData, fromGroupDetails);
      }
    }
  };

  React.useEffect(() => {
    (global as any).showSubscriptionModal = showSubscriptionModalForReason;

    const { SubscriptionHelper } = require('./src/utils/SubscriptionHelper');
    SubscriptionHelper.getInstance().setShowSubscriptionModal(
      (reason: string, feature?: string, canClose?: boolean, autoCloseAfter?: number) => {
        showSubscriptionModalForReason(reason as any, feature, canClose ?? true, autoCloseAfter);
      }
    );

    return () => {
      (global as any).showSubscriptionModal = undefined;
    };
  }, []);

  if (isLoading || initializing || authFlowState === 'checking') {
    return (
      <View style={styles.loadingContainer}>
        <CircularLoader />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (showLandingPage && Platform.OS === 'web') {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {(user || authFlowState === 'authenticated') ? (
          <>
            <Stack.Screen name="Main" component={RealSplittingScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </>
        ) : authFlowState === 'splash' ? (
          <Stack.Screen
            name="Splash"
            children={() => (
              <MeetnSplitSplashScreen
                onAnimationComplete={() => {
                  console.log('🎬 Splash completed');
                  setShowSplash(false);
                }}
              />
            )}
          />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen 
              name="ChangePassword" 
              component={ChangePasswordScreen}
              options={{ presentation: 'card' }}
            />
          </>
        )}
      </Stack.Navigator>

      {user && subscriptionModal.visible && (
        <SubscriptionModal
          visible={subscriptionModal.visible}
          onClose={handleSubscriptionModalClose}
          onSubscribe={handleSubscriptionPurchase}
          reason={subscriptionModal.reason}
          featureName={subscriptionModal.featureName}
          canClose={subscriptionModal.canClose}
          autoCloseAfter={subscriptionModal.autoCloseAfter}
          onCountdownComplete={handleSubscriptionCountdownComplete}
          autoCloseOnComplete={subscriptionModal.reason === 'transactionLimit'}
        />
      )}
    </NavigationContainer>
  );
};

export default function App() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    console.log('🚀 App initializing...', {
      platform: Platform.OS,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });

    try {
      const { ENV } = require('./src/config/environment');
      console.log('✅ Environment loaded:', {
        environment: ENV.environment,
        firebase: ENV.firebase?.projectId,
        api: ENV.api?.baseURL
      });
    } catch (err) {
      console.error('❌ Failed to load environment:', err);
      setError(err as Error);
    }
  }, []);

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: 'red', padding: 20, textAlign: 'center' }}>
          Failed to initialize app:{'\n\n'}
          {error.message}
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
});
