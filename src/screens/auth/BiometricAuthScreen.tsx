import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/common/Icon';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { BiometricAuthService } from '@/services/biometric/BiometricAuthService';
import { ApiService } from '@/services/api/ApiService';

interface BiometricAuthScreenProps {
  onBiometricSuccess: () => void;
  onFallbackToLogin: () => void;
  userEmail: string;
}

export default function BiometricAuthScreen({ 
  onBiometricSuccess, 
  onFallbackToLogin, 
  userEmail 
}: BiometricAuthScreenProps) {
  const { theme } = useTheme();
  const { login } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [promptMessage, setPromptMessage] = useState('');
  const [pulseAnim] = useState(new Animated.Value(1));

  const apiService = ApiService.getInstance();

  useEffect(() => {
    initializeBiometric();
  }, []);

  // REMOVED: Auto-clearing fail count allows unlimited retries
  // Fail count should persist to prevent abuse

  useEffect(() => {
    // Pulse animation for biometric icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    
    if (!isAuthenticating) {
      pulse.start();
    } else {
      pulse.stop();
      pulseAnim.setValue(1);
    }

    return () => pulse.stop();
  }, [isAuthenticating, pulseAnim]);

  const initializeBiometric = async () => {
    try {
      const message = await BiometricAuthService.getAuthenticationPromptMessage();
      setPromptMessage(message);

      const currentFailCount = await BiometricAuthService.getFailCount();
      setFailCount(currentFailCount);

      // Auto-trigger biometric prompt on screen load
      setTimeout(() => {
        handleBiometricAuth();
      }, 500);
    } catch (error) {
      console.error('Error initializing biometric screen:', error);
      onFallbackToLogin();
    }
  };

  const handleBiometricAuth = async () => {
    if (isAuthenticating) return;
    
    try {
      setIsAuthenticating(true);
      console.log('🔒 Starting biometric authentication for user:', userEmail);
      
      // Check if we've exceeded max attempts
      const exceededAttempts = await BiometricAuthService.hasExceededMaxAttempts();
      console.log('🔍 Exceeded attempts check:', exceededAttempts);
      
      if (exceededAttempts) {
        Alert.alert(
          'Too Many Attempts',
          'You have exceeded the maximum number of biometric authentication attempts. Please use your email and password to login.',
          [
            {
              text: 'Use Email & Password',
              onPress: onFallbackToLogin
            }
          ]
        );
        return;
      }

      console.log('🔒 Calling BiometricAuthService.authenticateWithBiometric...');
      const result = await BiometricAuthService.authenticateWithBiometric(promptMessage);
      console.log('🔒 Biometric result:', { success: result.success, error: result.error, errorCode: result.errorCode });
      
      if (result.success) {
        // Biometric authentication successful
        console.log('✅ Biometric authentication successful');

        // Prevent multiple calls by immediately clearing the authenticating flag
        setIsAuthenticating(false);

        try {
          // Extend the session since biometric was successful
          await BiometricAuthService.extendSession();
          console.log('✅ Session extended after biometric success');

          // Clear fail count on successful authentication
          await BiometricAuthService.clearFailCount();

          // Call success callback - this will navigate to dashboard
          console.log('🔄 Calling onBiometricSuccess callback - navigating to dashboard');
          onBiometricSuccess();
          return; // Early return to prevent further execution

        } catch (loginError) {
          console.error('❌ Auto-login failed after biometric success:', loginError);
          onFallbackToLogin();
          return; // Early return
        }
      } else {
        // Biometric authentication failed
        console.log('❌ Biometric authentication failed:', result.error);
        const newFailCount = await BiometricAuthService.getFailCount();
        setFailCount(newFailCount);
        console.log('📊 Updated fail count:', newFailCount);
        
        if (result.errorCode === 'USER_CANCELLED') {
          console.log('🚫 User cancelled biometric authentication - waiting for retry');
          // User cancelled - just wait for them to press "Try Again" button
          // No alert needed, they can see the button
        } else if (result.errorCode === 'MAX_ATTEMPTS_EXCEEDED') {
          console.log('🚫 Max biometric attempts exceeded');
          Alert.alert(
            'Too Many Attempts',
            'You have exceeded the maximum number of biometric authentication attempts. Please use your email and password to login.',
            [
              {
                text: 'Use Email & Password',
                onPress: onFallbackToLogin
              }
            ]
          );
        } else {
          // Other failure, show retry or fallback
          const attemptsRemaining = 3 - newFailCount;
          console.log('⚠️ Biometric failed, attempts remaining:', attemptsRemaining);
          
          if (attemptsRemaining > 0) {
            Alert.alert(
              'Authentication Failed',
              `${result.error}\n\nAttempts remaining: ${attemptsRemaining}`,
              [
                {
                  text: 'Try Again',
                  onPress: () => {
                    console.log('🔄 User chose to retry biometric');
                    setTimeout(() => handleBiometricAuth(), 500);
                  }
                },
                {
                  text: 'Use Password',
                  onPress: () => {
                    console.log('🔑 User chose to use password');
                    onFallbackToLogin();
                  }
                }
              ]
            );
          } else {
            console.log('🚫 No more biometric attempts remaining');
            Alert.alert(
              'Too Many Failed Attempts',
              'Please use your email and password to login.',
              [
                {
                  text: 'Use Email & Password',
                  onPress: onFallbackToLogin
                }
              ]
            );
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Biometric authentication error:', error);
      Alert.alert(
        'Authentication Error',
        'An error occurred during biometric authentication. Please use your email and password.',
        [
          {
            text: 'Use Email & Password',
            onPress: onFallbackToLogin
          }
        ]
      );
    } finally {
      setIsAuthenticating(false);
      console.log('🔒 Biometric authentication process completed');
    }
  };

  const getBiometricIcon = (): any => {
    // You could check supported types here and return appropriate icon
    return 'person'; // Default to person icon, replace with face/fingerprint icon based on supported type
  };

  const { width, height } = Dimensions.get('window');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {userEmail}
          </Text>
        </View>

        {/* Biometric Icon */}
        <View style={styles.biometricContainer}>
          <Animated.View 
            style={[
              styles.biometricIconContainer,
              { 
                backgroundColor: theme.colors.primary + '20',
                transform: [{ scale: pulseAnim }]
              }
            ]}
          >
            <Icon 
              name={getBiometricIcon()} 
              size={64} 
              color={theme.colors.primary} 
            />
          </Animated.View>
          
          <Text style={[styles.instructionText, { color: theme.colors.text }]}>
            {promptMessage}
          </Text>
          
          {failCount > 0 && (
            <Text style={[styles.failCountText, { color: theme.colors.error }]}>
              Failed attempts: {failCount}/3
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.tryAgainButton,
              { 
                backgroundColor: theme.colors.primary,
                opacity: isAuthenticating ? 0.6 : 1
              }
            ]}
            onPress={handleBiometricAuth}
            disabled={isAuthenticating}
          >
            <Text style={[styles.tryAgainButtonText, { color: theme.colors.background }]}>
              {isAuthenticating ? 'Authenticating...' : 'Try Again'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.fallbackButton,
              { borderColor: theme.colors.border }
            ]}
            onPress={onFallbackToLogin}
          >
            <Text style={[styles.fallbackButtonText, { color: theme.colors.primary }]}>
              Use Email & Password
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  biometricContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  biometricIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  instructionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  failCountText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  tryAgainButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  tryAgainButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  fallbackButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});