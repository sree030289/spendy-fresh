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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { BiometricService } from '@/services/biometric';
import { AuthService } from '@/services/firebase/auth';

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
      const lastEmail = await AuthService.getLastEmail();
      const lastBiometric = await AuthService.getLastBiometricSetting();
      
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
      await AuthService.clearUserSession();
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

  const getFirebaseErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email. Please register first.';
      case 'auth/wrong-password':
      case 'auth/invalid-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact support.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials.';
      default:
        return 'Login failed. Please check your email and password.';
    }
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
      // Navigation will happen automatically in App.tsx when user state changes
    } catch (error: any) {
      console.log('LoginScreen: Login error:', error);
      
      // Extract Firebase error code
      let errorMessage = 'Login failed. Please try again.';
      if (error.message && error.message.includes('Firebase:')) {
        const firebaseErrorMatch = error.message.match(/\(([^)]+)\)/);
        if (firebaseErrorMatch) {
          const errorCode = firebaseErrorMatch[1];
          errorMessage = getFirebaseErrorMessage(errorCode);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

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
    Keyboard.dismiss();
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Welcome Back</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                Sign in to your account
              </Text>
              
              {/* Show session info if available */}
              {lastUserEmail && (
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionText, { color: theme.colors.textSecondary }]}>
                    Last logged in as: {lastUserEmail}
                  </Text>
                  <TouchableOpacity onPress={handleClearSession}>
                    <Text style={[styles.clearSessionText, { color: theme.colors.primary }]}>
                      Switch Account
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: emailError ? theme.colors.error : theme.colors.border,
                      color: theme.colors.text 
                    }
                  ]}
                  placeholder="Email"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) validateEmail(text);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color={emailError ? theme.colors.error : theme.colors.textSecondary} 
                  style={styles.inputIcon}
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
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: passwordError ? theme.colors.error : theme.colors.border,
                      color: theme.colors.text 
                    }
                  ]}
                  placeholder="Password"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) validatePassword(text);
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={passwordError ? theme.colors.error : theme.colors.textSecondary} 
                  style={styles.inputIcon}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                  />
                </TouchableOpacity>
                {passwordError ? (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {passwordError}
                  </Text>
                ) : null}
              </View>

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                style={styles.loginButton}
              />

              {biometricAvailable && lastUserBiometric && lastUserEmail && (
                <Button
                  title={`Login with Biometric (${lastUserEmail})`}
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
                <Text style={[styles.forgotPasswordText, { color: theme.colors.primary }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Register' as never)}
              style={styles.registerLink}
            >
              <Text style={[styles.registerLinkText, { color: theme.colors.textSecondary }]}>
                Don't have an account?{' '}
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
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
    marginBottom: 16,
  },
  sessionInfo: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    marginTop: 8,
  },
  sessionText: {
    fontSize: 14,
    marginBottom: 4,
  },
  clearSessionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    gap: 20,
    marginBottom: 32,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  passwordInput: {
    paddingRight: 80,
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: 18,
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 18,
    padding: 4,
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 16,
  },
  loginButton: {
    marginTop: 8,
  },
  biometricButton: {
    marginTop: 8,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
    padding: 8,
  },
  forgotPasswordText: {
    fontSize: 16,
    fontWeight: '500',
  },
  registerLink: {
    alignItems: 'center',
    padding: 8,
  },
  registerLinkText: {
    fontSize: 16,
  },
});