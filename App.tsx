// App.tsx - Test with simplified modal
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseNotificationService } from './src/services/smartMoney/firebaseNotificationService';

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
import MainTabNavigator from './src/navigation/MainTabNavigator';
import ChangePasswordScreen from '@/screens/auth/ChangePasswordScreen';
import RealSplittingScreen from '@/screens/main/RealSplittingScreen';
import { QRCodeService } from '@/services/qr/QRCodeService';
import { RealNotificationService } from './src/services/notifications/RealNotificationService';
import { SplittingService } from '@/services/firebase/splitting';
import { notificationManager } from '@/services/NotificationManager';
import SmartMoneyApp from '@/screens/main/SmartMoneyApp';

 import { SubscriptionService } from '@/services/SubscriptionService';
import SubscriptionModal from '@/components/modals/SubscriptionModal';



const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const [initializing, setInitializing] = useState(true);
  const [hasShownTour, setHasShownTour] = useState(false);
  const [tourCheckCompleted, setTourCheckCompleted] = useState(false);
  const { startTour } = useTour();

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
          console.log('❌ Failed to initialize Smart Money notifications');
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
        await SplittingService.processRecurringExpenses();
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
      
      Alert.alert('Success! 🎉', 'Mock subscription completed', [
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
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    }
  };

  // Global function to show subscription modal for various reasons
  const showSubscriptionModalForReason = (
    reason: 'firstTime' | 'dailyPrompt' | 'groupLimit' | 'memberLimit' | 'transactionLimit' | 'premium_feature',
    feature?: string,
    canClose: boolean = true
  ) => {
    console.log('🎯 Showing subscription modal for reason:', reason, 'feature:', feature, 'canClose:', canClose);
    
    setSubscriptionReason(reason);
    setFeatureName(feature || '');
    setSubscriptionCanClose(canClose);
    setSubscriptionCountdown(canClose ? 0 : 5);
    setShowSubscriptionModal(true);
  };

  // Handle modal close with tour trigger
  const handleSubscriptionModalClose = () => {
    console.log('🔄 DEBUG: Closing subscription modal');
    setShowSubscriptionModal(false);
    setSubscriptionCountdown(0);
    setSubscriptionCanClose(true);
    
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
      canClose: boolean = true
    ) => {
      console.log('🔔 Global showSubscriptionModal called:', { reason, feature, canClose });
      showSubscriptionModalForReason(reason, feature, canClose);
    };
    
    return () => {
      console.log('🧹 Cleaning up global subscription modal function');
      (global as any).showSubscriptionModal = undefined;
    };
  }, []);

  if (isLoading || initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is authenticated - show main app
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="RealSplittingScreen" component={RealSplittingScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </>
        ) : (
          // User is not authenticated - show auth screens
          <>
            <Stack.Screen 
              name="Splash" 
              component={SplashScreen}
            />
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