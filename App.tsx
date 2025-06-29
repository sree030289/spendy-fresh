import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
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

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const [initializing, setInitializing] = useState(true);
  const [hasShownTour, setHasShownTour] = useState(false);
  const [tourCheckCompleted, setTourCheckCompleted] = useState(false);
  const { startTour } = useTour();

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
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Show tour when user is authenticated and hasn't seen it yet
  useEffect(() => {
    console.log('🔍 Tour trigger check:', {
      user: !!user,
      isLoading,
      initializing,
      hasShownTour,
      tourCheckCompleted
    });
    
    if (user && !isLoading && !initializing && !hasShownTour && tourCheckCompleted) {
      // Delay tour slightly to ensure main app is fully loaded
      const timer = setTimeout(() => {
        console.log('🎯 Showing onboarding tour for new user');
        startTour();
        setHasShownTour(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, initializing, hasShownTour, tourCheckCompleted, startTour]);

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
             {/* Add ChangePassword screen here */}
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