// App.tsx - Test with simplified modal
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CrossPlatformAlert } from './src/utils/alertUtils';
import { hideDevIndicators } from './src/utils/devUtils';

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
import BiometricAuthScreen from './src/screens/auth/BiometricAuthScreen';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';
import LandingPage from '@/components/web/LandingPage';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { RealNotificationService } from './src/services/notifications/RealNotificationService';
// import { NotificationService } from './src/services/notifications/NotificationService';
import { ApiService } from '@/services/api/ApiService';
import { notificationManager } from '@/services/NotificationManager';
import { BiometricAuthService } from '@/services/biometric/BiometricAuthService';
import ErrorBoundary from '@/components/ErrorBoundary';

 import { SubscriptionService } from '@/services/SubscriptionService';
import SubscriptionModal from '@/components/modals/SubscriptionModal';



const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, isLoading, restoreSessionFromBiometric } = useAuth();
  const [initializing, setInitializing] = useState(true);
  const [authFlowState, setAuthFlowState] = useState<'checking' | 'splash' | 'biometric' | 'login' | 'authenticated'>('checking');
  const [lastUserSession, setLastUserSession] = useState<any>(null);
  const [biometricFailed, setBiometricFailed] = useState(false); // Track biometric failures
  const [showSplash, setShowSplash] = useState(true); // Track splash screen visibility

  // Reset auth flow state when user becomes null (after logout)
  useEffect(() => {
    if (!user && !isLoading && authFlowState === 'authenticated') {
      console.log('🔄 User logged out, resetting auth flow state to checking');
      setAuthFlowState('checking');
      setShowSplash(true); // Show splash screen again after logout
    }
  }, [user, isLoading, authFlowState]);
  // Web-specific states
  const [showLandingPage, setShowLandingPage] = useState(Platform.OS === 'web' && !user);
  const [hasVisitedLanding, setHasVisitedLanding] = useState(false);

  // Update landing page visibility based on user state
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (user) {
        setShowLandingPage(false);
      } else if (!hasVisitedLanding) {
        setShowLandingPage(true);
      }
    }
  }, [user, hasVisitedLanding]);

  // Subscription states - using single state to prevent race conditions
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

  // Add app ready state and modal sequencing
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



  // Authentication flow logic - determines what screen to show
  useEffect(() => {
    const checkAuthenticationFlow = async () => {
      if (isLoading) return; // Wait for auth to complete
      
      try {
        console.log('🔍 Checking authentication flow...', { 
          hasUser: !!user, 
          authFlowState, 
          isLoading,
          showSplash 
        });

        // If we haven't shown the splash screen yet and user is not authenticated, show splash first
        if (showSplash && !user && authFlowState === 'checking') {
          console.log('🎬 Showing splash screen first');
          setAuthFlowState('splash');
          return;
        }

        const apiService = ApiService.getInstance();
        
        // If user is already authenticated, go to main app
        if (user) {
          console.log('✅ User already authenticated, extending session in background');
          setBiometricFailed(false); // Reset biometric failed flag on successful auth
          setAuthFlowState('authenticated');

          // Extend session in background (non-blocking)
          Promise.all([
            apiService.extendUserSession(),
            BiometricAuthService.extendSession()
          ]).catch(error => {
            console.error('⚠️ Failed to extend session:', error);
          });
          return;
        }

        // Don't run biometric checks if we're already in biometric state and have a user
        // But DO run checks if user is null (after logout) even if authFlowState is authenticated
        if (authFlowState === 'biometric' || (authFlowState === 'authenticated' && user)) {
          console.log('🔍 Already in biometric/authenticated flow with user, skipping check');
          return;
        }

        // Only check for biometric/login flow if no user and not loading and splash has been shown
        if (!user && !isLoading && !showSplash) {
          console.log('🔍 No user authenticated, checking for biometric flow');
          
          // Check for biometric using the same storage keys as LoginScreen
          const lastEmail = await apiService.getLastEmail();
          const lastBiometric = await apiService.getLastBiometricSetting();
          
          console.log('🔍 Stored user preferences:', { lastEmail, lastBiometric });
          
          // If we have email and biometric preference, check for biometric auth
          if (lastEmail && lastBiometric && !biometricFailed) { // Don't show biometric if it failed before
            console.log('🔍 Checking biometric for user email:', lastEmail, 'biometric enabled:', lastBiometric);
            
            // Check if biometric is available on device
            const isHardwareAvailable = await BiometricAuthService.isHardwareAvailable();
            console.log('🔍 Biometric hardware available:', isHardwareAvailable);
            
            // Check if we haven't exceeded attempts
            const hasExceededAttempts = await BiometricAuthService.hasExceededMaxAttempts();
            console.log('🔍 Exceeded biometric attempts:', hasExceededAttempts);
            
            if (isHardwareAvailable && lastBiometric && !hasExceededAttempts) {
              console.log('✅ All biometric conditions met, showing biometric screen');
              // Try to get the user ID from stored biometric preferences
              let userId = null;
              try {
                // Get all AsyncStorage keys
                const allKeys = await AsyncStorage.getAllKeys();
                const biometricKey = allKeys.find(key => key.startsWith('@spendy_biometric_enabled_') && key !== '@spendy_biometric_enabled');
                if (biometricKey) {
                  userId = biometricKey.replace('@spendy_biometric_enabled_', '');
                  console.log('🔍 Found user ID from biometric preference:', userId);
                }
              } catch (error) {
                console.error('Error getting user ID from stored preferences:', error);
              }
              
              // Create a basic session object for the biometric screen
              const sessionData = { 
                id: userId,
                email: lastEmail, 
                biometricEnabled: lastBiometric,
                sessionTimestamp: Date.now() // Use current timestamp
              };
              setLastUserSession(sessionData);
              setAuthFlowState('biometric');
              return;
            } else {
              console.log('❌ Biometric conditions not met:', {
                hardware: isHardwareAvailable,
                enabled: lastBiometric, 
                notExceeded: !hasExceededAttempts
              });
            }
          } else if (biometricFailed) {
            console.log('❌ Biometric authentication failed previously, going to login');
          }

          // Default to login screen
          console.log('🔍 No valid session or biometric, showing login');
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
  }, [user, isLoading, biometricFailed, showSplash]);

  // Subscription check with proper premium user verification
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.id || !appReady) return;

      try {
        console.log('🔍 Checking subscription status for user:', user.id);
        
        // Check if user is already premium
        const subscriptionService = SubscriptionService.getInstance();
        const isPremium = await subscriptionService.isPremiumUser(user.id);
        console.log('🔍 User premium status:', isPremium);
        
        // DISABLED: Subscription modal on app launch
        console.log('🔍 Skipping subscription modal on app launch (disabled)');
        
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
        console.log('🎯 DEBUG: Showing pending subscription modal:', pendingSubscriptionModal.reason);
        console.log('🔧 DEBUG: Setting subscription modal state:', {
          reason: pendingSubscriptionModal.reason,
          canClose: pendingSubscriptionModal.canClose,
          willShowTimer: !pendingSubscriptionModal.canClose
        });
        
        // Set all subscription modal state at once to prevent race conditions
        const modalConfig = {
          visible: true,
          reason: pendingSubscriptionModal.reason,
          featureName: pendingSubscriptionModal.feature || '',
          canClose: pendingSubscriptionModal.canClose
        };
        
        console.log('🎨 DEBUG: Setting SubscriptionModal state:', {
          ...modalConfig,
          autoCloseAfter: modalConfig.canClose ? undefined : 5,
        });
        
        setSubscriptionModal(modalConfig);
        setPendingSubscriptionModal(null);
      }, 1500);
    }
  }, [pendingSubscriptionModal, appReady, subscriptionCheckComplete]);

  // Handle subscription countdown completion (called by SubscriptionModal)
  const handleSubscriptionCountdownComplete = () => {
    console.log('✅ Subscription countdown completed, enabling close button');
    setSubscriptionModal(prev => ({ ...prev, canClose: true }));
  };

  useEffect(() => {
    // Initialize main notification service for friend requests and other app notifications
    const initializeMainNotifications = async () => {
      try {
        console.log('🔔 Initializing main notification service...');
        // const { NotificationService } = await import('./src/services/notifications/NotificationService');
        // const initialized = await NotificationService.initialize();
        const initialized = true; // Temporarily disabled
        
        if (initialized) {
          console.log('✅ Main notification service initialized (temporarily disabled)');
        } else {
          console.log('⚠️ Main notification service not initialized (may be on web platform or permissions denied)');
        }
      } catch (error) {
        console.error('❌ Failed to initialize main notification service:', error);
        // Don't block app initialization if notifications fail
      }
    };

    initializeMainNotifications();
  }, []);

  useEffect(() => {
    // Add a small delay to ensure auth state is properly checked
    const timer = setTimeout(() => {
      setInitializing(false);
      // Mark app as ready after initialization
      setTimeout(() => {
        setAppReady(true);
      }, 1000);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);



  useEffect(() => {
    // Initialize notifications
    RealNotificationService.initialize();
  }, []);

  // Initialize NotificationManager when user is authenticated
  useEffect(() => {
    if (user?.id) {
      notificationManager.initialize(user.id);
    }
  }, [user?.id]);

  // Initialize QR deep links
  useEffect(() => {
    const cleanup = QRCodeService.initializeDeepLinkListener();
    return cleanup;
  }, []);

  // Initialize notification deep link handler with navigation ref
  const navigationRef = React.useRef<any>(null);
  
  useEffect(() => {
    const handleNotificationResponse = async (response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data && user && navigationRef.current) {
        console.log('🔗 Handling notification deep link:', data);
        
        try {
          // Import PushNotificationManager and handle the navigation
          const { PushNotificationManager } = await import('./src/services/notifications/PushNotificationManager');
          await PushNotificationManager.handleNotificationTap(data, navigationRef.current);
        } catch (error) {
          console.error('❌ Error handling notification deep link:', error);
        }
      }
    };

    // Set up notification response listener
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    
    return () => {
      subscription?.remove?.();
    };
  }, [user]);

  // Check for pending navigation intents when user becomes authenticated
  useEffect(() => {
    const checkPendingNavigation = async () => {
      if (user && navigationRef.current && authFlowState === 'authenticated') {
        try {
          // Check if RealNotificationService has any stored navigation intents
          const { RealNotificationService } = await import('./src/services/notifications/RealNotificationService');
          const pendingIntent = await RealNotificationService.getAndClearNavigationIntent();
          
          if (pendingIntent) {
            console.log('🔗 Handling pending navigation intent:', pendingIntent);
            const { PushNotificationManager } = await import('./src/services/notifications/PushNotificationManager');
            await PushNotificationManager.handleNotificationTap(pendingIntent, navigationRef.current);
          }
        } catch (error) {
          console.error('❌ Error checking pending navigation:', error);
        }
      }
    };

    // Small delay to ensure navigation is fully ready
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

    // Process on app startup
    processRecurring();

    // Set up daily processing
    const interval = setInterval(processRecurring, 24 * 60 * 60 * 1000); // 24 hours
    
    return () => clearInterval(interval);
  }, [user?.id]);

  // Handle subscription purchase
  const handleSubscriptionPurchase = async (plan: 'monthly' | 'yearly', promoCode?: string) => {
    try {
      console.log('🛒 Starting subscription purchase:', { plan, promoCode });

      // Initialize RealPaymentService
      const RealPaymentService = (await import('@/services/RealPaymentService')).default;
      const paymentService = RealPaymentService.getInstance();
      await paymentService.initialize(user?.id);

      // Attempt purchase through RevenueCat
      const result = await paymentService.purchaseSubscription(plan, promoCode);

      if (result.success) {
        // Update user state to reflect premium status
        if (user && updateUser) {
          await updateUser({
            isPremium: true,
            subscriptionStatus: 'premium'
          });
        }

        setSubscriptionModal(prev => ({ ...prev, visible: false, canClose: true }));

        CrossPlatformAlert.alert(
          'Success! 🎉',
          'Welcome to Premium! You now have unlimited access to all features.',
          [
            {
              text: 'Awesome!',
              onPress: () => {
                // Refresh app state to reflect new subscription
                console.log('✅ Subscription purchase completed successfully');
              }
            }
          ]
        );
      } else if (result.userCancelled) {
        // User cancelled - do nothing, keep modal open
        console.log('User cancelled subscription purchase');
      } else {
        // Purchase failed
        CrossPlatformAlert.alert(
          'Purchase Failed',
          result.error || 'Unable to complete purchase. Please try again.'
        );
      }
    } catch (error) {
      console.error('Subscription purchase error:', error);
      CrossPlatformAlert.alert('Error', 'Failed to process subscription. Please try again.');
    }
  };

  // Handle web landing page "Get Started" button
  const handleGetStarted = () => {
    setShowLandingPage(false);
    setHasVisitedLanding(true);
  };

  // Handle biometric authentication success
  const handleBiometricSuccess = async () => {
    console.log('✅ Biometric authentication successful');
    try {
      if (lastUserSession) {
        console.log('🔄 Restoring session for user:', lastUserSession.email);
        console.log('🔍 Last user session data:', {
          id: lastUserSession.id,
          email: lastUserSession.email,
          biometricEnabled: lastUserSession.biometricEnabled,
          sessionTimestamp: lastUserSession.sessionTimestamp
        });
        
        const apiService = ApiService.getInstance();

        // Create a new session timestamp since logout cleared it
        const sessionTimestamp = Date.now();
        await AsyncStorage.setItem('@spendy_session_timestamp', sessionTimestamp.toString());
        console.log('✅ Created new session timestamp for biometric restore');

        // Extend session and mark as authenticated
        await apiService.extendUserSession();
        await BiometricAuthService.extendSession();

        console.log('🔍 Sessions extended, now calling restoreSessionFromBiometric...');

        // Restore the user session from stored data FIRST
        await restoreSessionFromBiometric();
        
        // Only set to authenticated state AFTER successful restoration
        setAuthFlowState('authenticated');
        
        console.log('🔄 Session restored after biometric success');
      } else {
        console.error('❌ No lastUserSession found, falling back to login');
        console.log('🔍 Available data for debugging:', {
          lastUserSession: lastUserSession,
          user: user,
          authFlowState: authFlowState
        });
        setAuthFlowState('login');
      }
    } catch (error) {
      console.error('❌ Error handling biometric success:', error);
      
      // Check if this is a manual login required error
      if (error instanceof Error && error.message === 'MANUAL_LOGIN_REQUIRED') {
        console.log('🔄 Biometric succeeded but manual login required - redirecting to login');
        setBiometricFailed(true);
        setAuthFlowState('login');
        return;
      }
      
      // Set biometric failed flag to prevent endless loop
      setBiometricFailed(true);
      // Clear any potentially corrupt session data
      try {
        await AsyncStorage.multiRemove(['@spendy_auth_token', '@spendy_user_data']);
      } catch (clearError) {
        console.error('❌ Error clearing auth data:', clearError);
      }
      setAuthFlowState('login');
    }
  };

  // Handle biometric authentication fallback to login
  const handleBiometricFallback = async () => {
    console.log('⬇️ Falling back to login screen from biometric');
    setBiometricFailed(true); // Mark biometric as failed
    
    // Set a flag so LoginScreen knows not to show biometric prompt again
    try {
      await AsyncStorage.setItem('@spendy_biometric_failed', 'true');
    } catch (error) {
      console.error('Error setting biometric failed flag:', error);
    }
    
    setAuthFlowState('login');
  };

  // Global function to show subscription modal for various reasons
  const showSubscriptionModalForReason = (
    reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature',
    feature?: string,
    canClose: boolean = true,
    autoCloseAfter?: number
  ) => {
    console.log('🎯 Showing subscription modal for reason:', reason, 'feature:', feature, 'canClose:', canClose, 'autoCloseAfter:', autoCloseAfter);

    setSubscriptionModal({
      visible: true,
      reason,
      featureName: feature || '',
      canClose,
      autoCloseAfter
    });
  };

  // Handle modal close with tour trigger
  const handleSubscriptionModalClose = () => {
    console.log('🔄 DEBUG: Closing subscription modal, reason:', subscriptionModal.reason);

    const wasTransactionLimit = subscriptionModal.reason === 'transactionLimit';
    const hadAutoClose = subscriptionModal.autoCloseAfter !== undefined && subscriptionModal.autoCloseAfter > 0;

    setSubscriptionModal(prev => ({ ...prev, visible: false, canClose: true }));

    // SOFT PAYWALL: After countdown, allow user to proceed with expense creation
    // Free users can add expenses after 3/day, but must wait 10 seconds each time
    if (wasTransactionLimit && hadAutoClose) {
      console.log('✅ Transaction limit countdown completed - allowing expense creation with bypass');

      // Small delay to let modal close animation finish
      setTimeout(() => {
        console.log('💰 Opening Add Expense modal after transaction limit countdown');

        // Set a flag to bypass the transaction limit check ONCE for the next expense
        (global as any).bypassTransactionLimitOnce = true;

        if ((global as any).openAddExpenseModal) {
          console.log('🎯 Calling global openAddExpenseModal function (with bypass flag set)');
          (global as any).openAddExpenseModal();
        } else {
          console.log('❌ Global openAddExpenseModal function not available');
        }
      }, 600); // Small delay after modal close animation
    }

    // Check if there's pending expense data to process after the countdown
    if ((window as any).pendingExpenseData && wasTransactionLimit) {
      const { expenseData, fromGroupDetails } = (window as any).pendingExpenseData;
      console.log('📋 Processing pending expense after countdown:', expenseData);

      // Clear the pending data
      (window as any).pendingExpenseData = null;

      // Process the expense - we need to call the proceedWithExpenseCreation function
      // This should be handled by the RealSplittingScreen component
      if ((window as any).processPendingExpense) {
        (window as any).processPendingExpense(expenseData, fromGroupDetails);
      }
    }


  };

  // Expose global subscription modal function
  React.useEffect(() => {
    // Make this function available globally with debugging
    console.log('🔧 Setting up global subscription modal function');
    (global as any).showSubscriptionModal = (
      reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature',
      feature?: string,
      canClose: boolean = true,
      autoCloseAfter?: number
    ) => {
      console.log('🔔 Global showSubscriptionModal called:', { reason, feature, canClose, autoCloseAfter });
      showSubscriptionModalForReason(reason, feature, canClose, autoCloseAfter);
    };



    // Set up SubscriptionHelper to use our global handler
    const { SubscriptionHelper } = require('./src/utils/SubscriptionHelper');
    SubscriptionHelper.getInstance().setShowSubscriptionModal(
      (reason: string, feature?: string, canClose?: boolean, autoCloseAfter?: number) => {
        console.log('🔔 SubscriptionHelper -> App.tsx showSubscriptionModal:', { reason, feature, canClose, autoCloseAfter });
        showSubscriptionModalForReason(reason as any, feature, canClose ?? true, autoCloseAfter);
      }
    );
    
    return () => {
      console.log('🧹 Cleaning up global subscription modal function');
      (global as any).showSubscriptionModal = undefined;
      (global as any).testTimer = undefined;
      (global as any).testFirstTime = undefined;
    };
  }, []);

  if (isLoading || initializing || authFlowState === 'checking') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show web landing page if needed
  if (showLandingPage && Platform.OS === 'web') {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {(user || authFlowState === 'authenticated') ? (
          // User is authenticated - show main app
          <>
            <Stack.Screen name="Main" component={RealSplittingScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </>
        ) : authFlowState === 'biometric' && lastUserSession ? (
          // Show biometric authentication screen
          <Stack.Screen 
            name="BiometricAuth"
            children={() => (
              <BiometricAuthScreen
                onBiometricSuccess={handleBiometricSuccess}
                onFallbackToLogin={handleBiometricFallback}
                userEmail={lastUserSession.email}
              />
            )}
          />
        ) : authFlowState === 'splash' ? (
          // Show splash screen first
          <Stack.Screen 
            name="Splash" 
            children={() => (
              <MeetnSplitSplashScreen 
                onAnimationComplete={() => {
                  console.log('🎬 Splash completed, hiding splash screen');
                  setShowSplash(false);
                }}
              />
            )}
          />
        ) : (
          // User is not authenticated - show auth screens
          <>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
            />
            <Stack.Screen 
              name="Register" 
              component={RegisterScreen}
            />
            <Stack.Screen 
              name="ForgotPassword" 
              component={ForgotPasswordScreen}
            />
          </>
        )}
      </Stack.Navigator>

      {/* Simple subscription modal for testing */}
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
    // Log app initialization
    console.log('🚀 App initializing...', {
      platform: Platform.OS,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });

    // Check environment config
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