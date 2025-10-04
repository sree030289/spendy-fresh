import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/common/Icon';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { BiometricService } from '@/services/biometric';
import { BiometricAuthService } from '@/services/biometric/BiometricAuthService';
import { ApiService } from '@/services/api/ApiService';
import { MeetNSplitLogo } from '@/components/common/MeetNSplitLogo';
import { BrandHeader } from '@/components/common/BrandHeader';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [lastUserEmail, setLastUserEmail] = useState<string | null>(null);
  const [lastUserBiometric, setLastUserBiometric] = useState(false);
  const apiService = ApiService.getInstance();

  useEffect(() => {
    initializeScreen();
  }, []);

  // Log when user changes to help debug
  useEffect(() => {
    console.log('LoginScreen - User changed:', user ? 'Logged in' : 'Not logged in');
  }, [user]);

  const initializeScreen = async () => {
    try {
      // Check biometric availability
      const available = await BiometricService.isAvailable();
      setBiometricAvailable(available);

      // Get last user's email and biometric setting
      const lastEmail = await apiService.getLastEmail();
      const lastBiometric = await apiService.getLastBiometricSetting();
      
      console.log('🔍 Last user session:', { lastEmail, lastBiometric });
      
      setLastUserEmail(lastEmail);
      setLastUserBiometric(lastBiometric);
      
      // Pre-fill email if we have it
      if (lastEmail) {
        setEmail(lastEmail);
      }

      // Auto-prompt biometric if available and was enabled for last user
      if (available && lastBiometric && lastEmail) {
        setTimeout(() => {
          Alert.alert(
            'Quick Login',
            `Continue as ${lastEmail}?\n\nUse biometric authentication for faster login?`,
            [
              { 
                text: 'Use Password', 
                style: 'cancel',
                onPress: () => setEmail(lastEmail) 
              },
              { 
                text: 'Use Biometric', 
                onPress: handleBiometricLogin 
              },
              {
                text: 'Different User',
                onPress: handleClearSession
              }
            ]
          );
        }, 500);
      } else if (lastEmail) {
        // Show option for different user if there's a stored email
        setTimeout(() => {
          Alert.alert(
            'Welcome Back',
            `Continue as ${lastEmail}?`,
            [
              { 
                text: 'Yes', 
                onPress: () => setEmail(lastEmail)
              },
              {
                text: 'Different User',
                onPress: handleClearSession
              }
            ]
          );
        }, 500);
      }
    } catch (error) {
      console.log('Screen initialization failed:', error);
    }
  };

  const handleClearSession = async () => {
    try {
      console.log('🧹 Clearing previous user session...');
      await apiService.clearUserSession();
      setEmail('');
      setLastUserEmail(null);
      setLastUserBiometric(false);
      Alert.alert('Session Cleared', 'You can now login with a different account.');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (password: string): boolean => {
    if (!password) {
      setPasswordError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const getApiErrorMessage = (error: any): string => {
    // Handle API error responses
    if (error.message) {
      if (error.message.includes('Invalid email or password')) {
        return 'Invalid email or password. Please check your credentials.';
      }
      if (error.message.includes('User not found')) {
        return 'No account found with this email. Please register first.';
      }
      if (error.message.includes('Network')) {
        return 'Network error. Please check your connection.';
      }
      if (error.message.includes('HTTP 429')) {
        return 'Too many failed attempts. Please try again later.';
      }
      return error.message;
    }
    return 'Login failed. Please check your email and password.';
  };

  const handleLogin = async () => {
    // Clear previous errors
    setEmailError('');
    setPasswordError('');

    // Validate inputs
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setLoading(true);
    try {
      console.log('LoginScreen: Attempting login...');
      await login(email.trim().toLowerCase(), password);
      console.log('LoginScreen: Login successful, user should be set');
      
      // Clear any previous biometric fail counts on successful login
      await BiometricAuthService.clearFailCount();
      
      // Check if user doesn't have biometric enabled and device supports it
      const hasHardware = await BiometricAuthService.isHardwareAvailable();
      const userHasBiometric = await apiService.getLastBiometricSetting();
      
      console.log('🔍 Checking biometric setup:', { hasHardware, userHasBiometric, userId: user?.id });
      
      if (hasHardware && !userHasBiometric && user?.id) {
        console.log('🔍 Offering biometric setup for user');
        setTimeout(() => {
          Alert.alert(
            'Enable Biometric Authentication?',
            'Would you like to enable Face ID/Touch ID for faster login next time?',
            [
              { text: 'Not Now', style: 'cancel' },
              { 
                text: 'Enable', 
                onPress: async () => {
                  try {
                    // Save biometric preference for this user
                    await BiometricAuthService.setBiometricEnabledForUser(user.id, true);
                    
                    // Update the stored session with biometric enabled
                    if (user) {
                      const updatedUser = { ...user, biometricEnabled: true };
                      await apiService.storeUserSession(updatedUser);
                    }
                    
                    console.log('✅ Biometric authentication enabled for user');
                    Alert.alert('Success', 'Biometric authentication has been enabled for your account.');
                  } catch (error) {
                    console.error('Error enabling biometric:', error);
                    Alert.alert('Error', 'Failed to enable biometric authentication.');
                  }
                }
              }
            ]
          );
        }, 1000);
      }
      
      // Navigation will happen automatically in App.tsx when user state changes
    } catch (error: any) {
      console.log('LoginScreen: Login error:', error);
      
      // Use API error handling
      const errorMessage = getApiErrorMessage(error);
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const result = await BiometricService.authenticate();
      if (result.success) {
        if (lastUserEmail) {
          // In production, you'd have stored encrypted credentials
          // For demo, we'll show success and let user enter password
          Alert.alert(
            'Biometric Authentication Successful',
            'Biometric verification completed successfully!\n\nIn production, this would automatically log you in with stored secure credentials.',
            [
              {
                text: 'Continue with Password',
                onPress: () => {
                  setEmail(lastUserEmail);
                  // Focus on password field
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'Biometric Success', 
            'Biometric authentication successful! Please enter your credentials to continue.',
          );
        }
      } else {
        Alert.alert('Authentication Failed', result.error || 'Biometric authentication failed');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Biometric authentication error');
    } finally {
      setBiometricLoading(false);
    }
  };

  const dismissKeyboard = () => {
    if (Platform.OS === 'web') {
      // On web, blur the active element to dismiss virtual keyboard
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
    } else {
      Keyboard.dismiss();
    }
  };

  // Create dynamic styles based on theme
  const getStyles = (colors: any) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.brand,
    },
    redHeader: {
      backgroundColor: colors.brand,
      height: 100,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomLeftRadius: 25,
      borderBottomRightRadius: 25,
      width: '100%',
      paddingTop: 10,
      // Enhanced gradient effect for modern look
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
      // Add subtle inner shadow
      ...(Platform.OS === 'web' && {
        background: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.brandDark} 100%)`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }),
    },
    brandText: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: '700',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
      textAlign: 'center',
      // Enhanced shadow for depth
      textShadowColor: 'rgba(0, 0, 0, 0.4)',
      textShadowOffset: { width: 2, height: 3 },
      textShadowRadius: 8,
      ...(Platform.OS === 'web' && {
        filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
        textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4)',
      }),
    },
    whiteContent: {
      flex: 1,
      backgroundColor: '#ffffff',
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      paddingTop: 30,
      paddingHorizontal: 32,
      width: '100%',
      // Enhanced shadow for better depth perception
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
      paddingTop: 20,
      paddingBottom: 30,
      minHeight: 600, // Ensure minimum height for content
    },
    mainContent: {
      flex: 1,
    },
    header: {
      marginBottom: 50,
      marginTop: 30,
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '600',
      marginBottom: 12,
      textAlign: 'center',
      color: '#1F2937',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    form: {
      gap: 24,
      marginBottom: 40,
    },
    inputContainer: {
      position: 'relative',
      marginBottom: 4,
    },
    input: {
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      fontSize: 16,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
      backgroundColor: '#ffffff',
      color: '#1F2937',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      ...(Platform.OS === 'web' && {
        outline: 'none',
      } as any),
    },
    passwordInput: {
      paddingRight: 60,
    },
    passwordToggle: {
      position: 'absolute',
      right: 20,
      top: 18,
      bottom: 18,
      justifyContent: 'center',
      alignItems: 'center',
      width: 24,
      height: 24,
    },
    errorText: {
      fontSize: 14,
      marginTop: 8,
      marginLeft: 20,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    loginButton: {
      backgroundColor: colors.brand,
      borderRadius: 25,
      paddingVertical: 18,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: colors.brand,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
      // Enhanced styling for modern look
      ...(Platform.OS === 'web' && {
        background: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.brandDark} 100%)`,
        boxShadow: `0 8px 24px rgba(220, 20, 60, 0.3), 0 4px 8px rgba(0, 0, 0, 0.1)`,
        transition: 'all 0.2s ease-in-out',
      }),
    },
    biometricButton: {
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
      minHeight: 44,
    },
    forgotPassword: {
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 24,
      padding: 8,
    },
    forgotPasswordText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.brand,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    registerButton: {
      backgroundColor: '#F9FAFB',
      borderRadius: 25,
      paddingVertical: 18,
      alignItems: 'center',
      marginTop: 8,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    registerButtonText: {
      fontSize: 15,
      color: '#6B7280',
      fontWeight: '500',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  });

  const styles = getStyles(theme.colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Brand Header */}
      <BrandHeader height={100} />

      {/* White Content Area */}
      <View style={styles.whiteContent}>
        <TouchableWithoutFeedback onPress={Platform.OS !== 'web' ? dismissKeyboard : undefined}>
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: 'padding', android: 'padding', web: 'height' })}
            style={[styles.keyboardView, Platform.OS === 'web' && { flex: 1 }]}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 20 })}
            enabled={true}
          >
            <ScrollView 
              contentContainerStyle={[
                styles.content,
                Platform.OS === 'web' && { minHeight: '100%', justifyContent: 'space-between' }
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={Platform.OS !== 'web'}
              {...(Platform.OS === 'web' && {
                scrollEnabled: true,
                contentContainerStyle: { flexGrow: 1, justifyContent: 'space-between', paddingTop: 20, paddingBottom: 30 }
              })}
            >
              <View style={styles.mainContent}>
                <View style={styles.header}>
                  <Text style={styles.title}>Log in</Text>
                </View>

                <View style={styles.form}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    emailError && { borderColor: '#EF4444' }
                  ]}
                  placeholder="Username"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) validateEmail(text);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  {...(Platform.OS === 'web' && {
                    autoComplete: 'email',
                    inputMode: 'email' as any,
                  })}
                />
                {emailError ? (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {emailError}
                  </Text>
                ) : null}
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    styles.passwordInput,
                    passwordError && { borderColor: '#EF4444' }
                  ]}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) validatePassword(text);
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  blurOnSubmit={true}
                  {...(Platform.OS === 'web' && {
                    autoComplete: 'current-password',
                    inputMode: 'text' as any,
                  })}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <Icon 
                    name={showPassword ? "eyeOff" : "eye"} 
                    size={20} 
                    color="#9CA3AF" 
                  />
                </TouchableOpacity>
                {passwordError ? (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {passwordError}
                  </Text>
                ) : null}
              </View>

              <Button
                title="Log in"
                onPress={handleLogin}
                loading={loading}
                style={styles.loginButton}
              />

              {biometricAvailable && lastUserBiometric && lastUserEmail && (
                <Button
                  title="Login with Biometric"
                  onPress={handleBiometricLogin}
                  loading={biometricLoading}
                  variant="outline"
                  style={styles.biometricButton}
                />
              )}

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword' as never)}
                style={styles.forgotPassword}
              >
                <Text style={styles.forgotPasswordText}>
                  Forgot password
                </Text>
              </TouchableOpacity>
            </View>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Register' as never)}
              style={styles.registerButton}
            >
              <Text style={styles.registerButtonText}>
                Not yet joined MeetnSplit ?
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </View>
    </SafeAreaView>
  );
}