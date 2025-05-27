import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

// Import providers
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { ThemeProvider } from './src/hooks/useTheme';

// Import screens
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import SplashScreen from './src/screens/auth/SplashScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const [initializing, setInitializing] = useState(true);

  console.log('AppNavigator - User:', user ? 'Authenticated' : 'Not authenticated');
  console.log('AppNavigator - Loading:', isLoading);

  useEffect(() => {
    // Add a small delay to ensure auth state is properly checked
    const timer = setTimeout(() => {
      setInitializing(false);
    }, 1000);

    return () => clearTimeout(timer);
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
        <AppNavigator />
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