// App.tsx - Fixed version to resolve modal conflicts
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Alert } from 'react-native';
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

// Import subscription components
import SubscriptionModal from '@/components/modals/SubscriptionModal';
import { SubscriptionService } from '@/services/SubscriptionService';

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

  // Add app ready state to prevent conflicts
  const [appReady, setAppReady] = useState(false);
  const [subscriptionCheckComplete, setSubscriptionCheckComplete] = useState(false);

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

  // FIXED: Better sequencing of tour and subscription modals
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.id || !appReady) return;

      try {
        console.log('🔍 Checking subscription status for user:', user.id);
        const subscriptionService = SubscriptionService.getInstance();
        
        // Check if user should see first-time subscription modal
        const shouldShowFirstTime = await subscriptionService.shouldShowFirstTimePrompt(user.id);
        if (shouldShowFirstTime) {
          console.log('🎯 User should see first-time subscription modal');
          
          // Mark as shown immediately to prevent repeated triggers
          await subscriptionService.markFirstTimePromptShown(user.id);
          
          // Wait a bit longer to ensure app is fully loaded
          setTimeout(() => {
            console.log('🎯 Showing first-time subscription modal');
            setSubscriptionReason('firstTime');
            setSubscriptionCanClose(false);
            setSubscriptionCountdown(5);
            setShowSubscriptionModal(true);
          }, 3000); // Increased delay
          
          setSubscriptionCheckComplete(true);
          return;
        }

        // Check if user should see daily prompt
        const shouldShowDaily = await subscriptionService.shouldShowDailyPrompt(user.id);
        if (shouldShowDaily) {
          console.log('🌅 User should see daily subscription prompt');
          
          // Wait for app to be fully ready
          setTimeout(() => {
            console.log('🌅 Showing daily subscription prompt');
            setSubscriptionReason('dailyPrompt');
            setSubscriptionCanClose(false);
            setSubscriptionCountdown(5);
            setShowSubscriptionModal(true);
          }, 2000);
          
          // Mark daily prompt as shown
          await subscriptionService.markDailyPromptShown(user.id);
        }
        
        setSubscriptionCheckComplete(true);
      } catch (error) {
        console.error('Error checking subscription status:', error);
        setSubscriptionCheckComplete(true);
      }
    };

    checkSubscriptionStatus();
  }, [user?.id, appReady]);

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

  // FIXED: Better tour trigger logic to avoid conflicts
  useEffect(() => {
    console.log('🔍 Tour trigger check:', {
      user: !!user,
      isLoading,
      initializing,
      hasShownTour,
      tourCheckCompleted,
      appReady,
      subscriptionCheckComplete,
      showSubscriptionModal
    });
    
    // Only show tour if:
    // 1. User is authenticated
    // 2. App is not loading or initializing
    // 3. User hasn't seen tour yet
    // 4. Tour check is completed
    // 5. App is ready
    // 6. Subscription check is complete
    // 7. Subscription modal is not currently showing
    if (user && !isLoading && !initializing && !hasShownTour && tourCheckCompleted && appReady && subscriptionCheckComplete && !showSubscriptionModal) {
      // Delay tour to ensure everything is ready
      const timer = setTimeout(() => {
        console.log('🎯 Showing onboarding tour for new user');
        startTour();
        setHasShownTour(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, initializing, hasShownTour, tourCheckCompleted, startTour, appReady, subscriptionCheckComplete, showSubscriptionModal]);

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
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      console.log('🔄 Processing subscription purchase:', { plan, promoCode });

      const subscriptionService = SubscriptionService.getInstance();
      const result = await subscriptionService.processSubscription(user.id, plan, promoCode);

      if (result.success) {
        setShowSubscriptionModal(false);
        
        // Reset subscription state
        setSubscriptionCountdown(0);
        setSubscriptionCanClose(true);
        
        Alert.alert('Success! 🎉', result.message, [
          {
            text: 'Awesome!',
            onPress: () => {
              console.log('✅ Subscription purchase completed successfully');
            }
          }
        ]);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Subscription purchase error:', error);
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    }
  };

  // FIXED: Global function to show subscription modal for various reasons
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

  // Handle modal close
  const handleSubscriptionModalClose = () => {
    console.log('🔄 Closing subscription modal');
    setShowSubscriptionModal(false);
    setSubscriptionCountdown(0);
    setSubscriptionCanClose(true);
  };

  // Expose global subscription modal function
  React.useEffect(() => {
    // Make this function available globally
    (global as any).showSubscriptionModal = showSubscriptionModalForReason;
    
    return () => {
      // Cleanup
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

      {/* FIXED: Global Subscription Modal with better error handling */}
      {user && ( // Only render when user exists
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