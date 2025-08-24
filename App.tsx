// App.tsx - Test with simplified modal
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseNotificationService } from './src/services/smartMoney/firebaseNotificationService';
import { CrossPlatformAlert } from './src/utils/alertUtils';
import { hideDevIndicators } from './src/utils/devUtils';

// Initialize development optimizations
hideDevIndicators();

// Import providers
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { ThemeProvider } from './src/hooks/useTheme';
import { TourProvider } from './src/components/tour/TourProvider';

// Import tour components
import { useTour } from './src/components/tour/TourProvider';

// Import screens
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import SplashScreen from './src/screens/auth/SplashScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import BiometricAuthScreen from './src/screens/auth/BiometricAuthScreen';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';
import LandingPage from '@/components/web/LandingPage';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { RealNotificationService } from './src/services/notifications/RealNotificationService';
import { ApiService } from '@/services/api/ApiService';
import { notificationManager } from '@/services/NotificationManager';
import SmartMoneyApp from '@/screens/main/SmartMoneyApp';
import { BiometricAuthService } from '@/services/biometric/BiometricAuthService';

 import { SubscriptionService } from '@/services/SubscriptionService';
import SubscriptionModal from '@/components/modals/SubscriptionModal';



const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, isLoading, restoreSessionFromBiometric } = useAuth();
  const [initializing, setInitializing] = useState(true);
  const [hasShownTour, setHasShownTour] = useState(false);
  const [tourCheckCompleted, setTourCheckCompleted] = useState(false);
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
  const { startTour } = useTour();

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

  // Subscription states
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionReason, setSubscriptionReason] = useState<'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature'>('firstTime');
  const [featureName, setFeatureName] = useState<string>('');
  const [subscriptionCanClose, setSubscriptionCanClose] = useState(true);
  const [subscriptionCountdown, setSubscriptionCountdown] = useState(0);

  // Add app ready state and modal sequencing
  const [appReady, setAppReady] = useState(false);
  const [subscriptionCheckComplete, setSubscriptionCheckComplete] = useState(false);
  const [pendingSubscriptionModal, setPendingSubscriptionModal] = useState<{
    reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature';
    feature?: string;
    canClose: boolean;
  } | null>(null);
  const [shouldShowTourAfterSubscription, setShouldShowTourAfterSubscription] = useState(false);

  console.log('AppNavigator - User:', user ? 'Authenticated' : 'Not authenticated');
  console.log('AppNavigator - Loading:', isLoading);
  console.log('AppNavigator - Auth Flow State:', authFlowState);

  useEffect(() => {
    // Check if tour has been completed before
    const checkTourStatus = async () => {
      try {
        const tourCompleted = await AsyncStorage.getItem('app_tour_completed');
        console.log('🔍 Tour Status Check - Tour completed value:', tourCompleted);
        setHasShownTour(tourCompleted === 'true');
        setTourCheckCompleted(true);
      } catch (error) {
        console.log('Error checking tour status:', error);
        setTourCheckCompleted(true);
      }
    };

    checkTourStatus();
  }, []);

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
          console.log('✅ User already authenticated, extending session');
          await apiService.extendUserSession();
          await BiometricAuthService.extendSession();
          setBiometricFailed(false); // Reset biometric failed flag on successful auth
          setAuthFlowState('authenticated');
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
          const lastSession = await apiService.getLastUserSession();
          console.log('🔍 No user authenticated, checking for biometric flow');
          
          // If session expired or no session, check for biometric
          if (lastSession && !biometricFailed) { // Don't show biometric if it failed before
            console.log('🔍 Checking biometric for user:', lastSession.id, 'biometric enabled:', lastSession.biometricEnabled);
            
            // Check if biometric is available on device
            const isHardwareAvailable = await BiometricAuthService.isHardwareAvailable();
            console.log('🔍 Biometric hardware available:', isHardwareAvailable);
            
            // Check if user has biometric enabled (from session or stored preference)
            const userBiometricEnabled = lastSession.biometricEnabled || await BiometricAuthService.isBiometricEnabledForUser(lastSession.id);
            console.log('🔍 User biometric enabled:', userBiometricEnabled);
            
            // Check if we haven't exceeded attempts
            const hasExceededAttempts = await BiometricAuthService.hasExceededMaxAttempts();
            console.log('🔍 Exceeded biometric attempts:', hasExceededAttempts);
            
            if (isHardwareAvailable && userBiometricEnabled && !hasExceededAttempts) {
              console.log('✅ All biometric conditions met, showing biometric screen');
              setLastUserSession(lastSession);
              setAuthFlowState('biometric');
              return;
            } else {
              console.log('❌ Biometric conditions not met:', {
                hardware: isHardwareAvailable,
                enabled: userBiometricEnabled, 
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
  }, [user, isLoading, authFlowState, biometricFailed, showSplash]);

  // Subscription check with proper premium user verification
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.id || !appReady || !tourCheckCompleted) return;

      try {
        console.log('🔍 Checking subscription status for user:', user.id);
        
        // Check if user is already premium
        const subscriptionService = SubscriptionService.getInstance();
        const isPremium = await subscriptionService.isPremiumUser(user.id);
        console.log('🔍 User premium status:', isPremium);
        
        // Only show subscription modal for FREE users who haven't seen the tour
        if (!isPremium && !hasShownTour) {
          console.log('🎯 Free user detected, will show subscription modal first');
          
          setPendingSubscriptionModal({
            reason: 'firstTime',
            canClose: false
          });
          setShouldShowTourAfterSubscription(true);
        } else {
          console.log('🔍 Premium user or tour already shown - skipping subscription modal');
        }
        
        setSubscriptionCheckComplete(true);
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setSubscriptionCheckComplete(true);
      }
    };

    checkSubscriptionStatus();
  }, [user?.id, appReady, tourCheckCompleted, hasShownTour]);

  // Show pending subscription modal when ready
  useEffect(() => {
    if (pendingSubscriptionModal && appReady && subscriptionCheckComplete) {
      setTimeout(() => {
        console.log('🎯 DEBUG: Showing pending subscription modal:', pendingSubscriptionModal.reason);
        setSubscriptionReason(pendingSubscriptionModal.reason);
        setFeatureName(pendingSubscriptionModal.feature || '');
        setSubscriptionCanClose(pendingSubscriptionModal.canClose);
        setSubscriptionCountdown(pendingSubscriptionModal.canClose ? 0 : 5);
        setShowSubscriptionModal(true);
        setPendingSubscriptionModal(null);
      }, 1500);
    }
  }, [pendingSubscriptionModal, appReady, subscriptionCheckComplete]);

  // Handle subscription countdown
  useEffect(() => {
    if (subscriptionCountdown > 0) {
      const timer = setInterval(() => {
        setSubscriptionCountdown((prev) => {
          if (prev <= 1) {
            setSubscriptionCanClose(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [subscriptionCountdown]);

  useEffect(() => {
    // Initialize Smart Money notifications
    const initializeSmartMoney = async () => {
      if (user?.id) {
        try {
          console.log('🚀 Initializing Smart Money notifications for user:', user.id);
          const notificationService = FirebaseNotificationService.getInstance();
          const initialized = await notificationService.initialize();
          
          if (initialized) {
            console.log('✅ Smart Money notifications initialized');
            
            // Schedule all Smart Money notifications
            await notificationService.scheduleDailyExpenseReminder();
            await notificationService.scheduleWeeklyAnalytics();
            
            // Save token for user
            await notificationService.saveTokenToServer(user.id);
          } else {
            console.log('⚠️ Smart Money notifications not initialized (may be on web platform or permissions denied)');
          }
        } catch (error) {
          console.error('❌ Failed to initialize notifications:', error);
          // Don't block app initialization if notifications fail
        }
      }
    };

    initializeSmartMoney();
  }, [user?.id]);

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

  // Tour trigger logic
  useEffect(() => {
    console.log('🔍 Tour trigger check:', {
      user: !!user,
      isLoading,
      initializing,
      hasShownTour,
      tourCheckCompleted,
      appReady,
      subscriptionCheckComplete,
      showSubscriptionModal,
      pendingSubscriptionModal: !!pendingSubscriptionModal,
      shouldShowTourAfterSubscription
    });
    
    if (user && 
        !isLoading && 
        !initializing && 
        !hasShownTour && 
        tourCheckCompleted && 
        appReady && 
        subscriptionCheckComplete && 
        !showSubscriptionModal && 
        !pendingSubscriptionModal &&
        !shouldShowTourAfterSubscription) {
      
      const timer = setTimeout(() => {
        console.log('🎯 Showing onboarding tour for user (no subscription conflicts)');
        startTour();
        setHasShownTour(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, initializing, hasShownTour, tourCheckCompleted, startTour, appReady, subscriptionCheckComplete, showSubscriptionModal, pendingSubscriptionModal, shouldShowTourAfterSubscription]);

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
      console.log('🔄 DEBUG: Mock subscription purchase:', { plan, promoCode });
      
      setShowSubscriptionModal(false);
      
      // Reset subscription state
      setSubscriptionCountdown(0);
      setSubscriptionCanClose(true);
      
      CrossPlatformAlert.alert('Success! 🎉', 'Mock subscription completed', [
        {
          text: 'Awesome!',
          onPress: () => {
            console.log('✅ Mock subscription purchase completed');
            
            // If we should show tour after subscription, do it now
            if (shouldShowTourAfterSubscription && !hasShownTour) {
              setShouldShowTourAfterSubscription(false);
              setTimeout(() => {
                console.log('🎯 Showing onboarding tour after subscription completion');
                startTour();
                setHasShownTour(true);
              }, 1000);
            }
          }
        }
      ]);
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
  const handleBiometricFallback = () => {
    console.log('⬇️ Falling back to login screen');
    setBiometricFailed(true); // Mark biometric as failed
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
    
    setSubscriptionReason(reason);
    setFeatureName(feature || '');
    setSubscriptionCanClose(canClose);
    setSubscriptionCountdown(canClose ? 0 : (autoCloseAfter || 5));
    setShowSubscriptionModal(true);
  };

  // Handle modal close with tour trigger
  const handleSubscriptionModalClose = () => {
    console.log('🔄 DEBUG: Closing subscription modal');
    setShowSubscriptionModal(false);
    setSubscriptionCountdown(0);
    setSubscriptionCanClose(true);
    
    // Check if there's pending expense data to process after the countdown
    if ((window as any).pendingExpenseData && subscriptionReason === 'transactionLimit') {
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
    
    // If we should show tour after subscription and user hasn't seen it yet
    if (shouldShowTourAfterSubscription && !hasShownTour) {
      setShouldShowTourAfterSubscription(false);
      setTimeout(() => {
        console.log('🎯 Showing onboarding tour after subscription modal close');
        startTour();
        setHasShownTour(true);
      }, 500);
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
    
    return () => {
      console.log('🧹 Cleaning up global subscription modal function');
      (global as any).showSubscriptionModal = undefined;
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
    <NavigationContainer>
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
              <SplashScreen 
                onSplashComplete={() => {
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
      {user && (
        <SubscriptionModal
          visible={showSubscriptionModal}
          onClose={handleSubscriptionModalClose}
          onSubscribe={handleSubscriptionPurchase}
          reason={subscriptionReason}
          featureName={featureName}
          canClose={subscriptionCanClose}
          autoCloseAfter={subscriptionCountdown > 0 ? subscriptionCountdown : undefined}
        />
      )}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TourProvider>
          <AppNavigator />
        </TourProvider>
      </AuthProvider>
    </ThemeProvider>
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