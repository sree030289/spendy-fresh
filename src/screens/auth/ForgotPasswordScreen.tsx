import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/common/Icon';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState('');

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

  const getFirebaseErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address. Please check your email or create a new account.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many password reset attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      default:
        return 'Failed to send reset email. Please try again.';
    }
  };

  const handleResetPassword = async () => {
    setEmailError('');
    
    if (!validateEmail(email)) {
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
      Alert.alert(
        'Reset Email Sent', 
        'Check your email for password reset instructions. The email may take a few minutes to arrive.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Auto-redirect after 5 seconds
              setTimeout(() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Login' as never);
                }
              }, 5000);
            }
          }
        ]
      );
    } catch (error: any) {
      console.log('Password reset error:', error);
      
      let errorMessage = 'Failed to send reset email. Please try again.';
      if (error.message && error.message.includes('Firebase:')) {
        const firebaseErrorMatch = error.message.match(/\(([^)]+)\)/);
        if (firebaseErrorMatch) {
          const errorCode = firebaseErrorMatch[1];
          errorMessage = getFirebaseErrorMessage(errorCode);
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim() || !validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      Alert.alert('Email Resent', 'Another reset email has been sent to your inbox.');
    } catch (error: any) {
      console.log('Resend error:', error);
      
      let errorMessage = 'Failed to resend email. Please try again.';
      if (error.message && error.message.includes('Firebase:')) {
        const firebaseErrorMatch = error.message.match(/\(([^)]+)\)/);
        if (firebaseErrorMatch) {
          const errorCode = firebaseErrorMatch[1];
          errorMessage = getFirebaseErrorMessage(errorCode);
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      {/* Red Header */}
      <View style={styles.redHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.brandLetter}>S</Text>
      </View>

      {/* White Content Area */}
      <View style={styles.whiteContent}>
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>
                  {sent ? 'Check Your Email' : 'Reset your password'}
                </Text>
                <Text style={styles.subtitle}>
                  {sent 
                    ? 'We need to confirm your details to reset your password.'
                    : 'We need to confirm your details to reset your password.'
                  }
                </Text>
              </View>

            {!sent ? (
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
                    returnKeyType="send"
                    onSubmitEditing={handleResetPassword}
                  />
                  {emailError ? (
                    <Text style={[styles.errorText, { color: '#EF4444' }]}>
                      {emailError}
                    </Text>
                  ) : null}
                </View>

                <Button
                  title="Next"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={styles.resetButton}
                />
              </View>
            ) : (
              <View style={styles.successContainer}>
                <View style={styles.successInfo}>
                  <Text style={[styles.successTitle, { color: theme.colors.text }]}>
                    Email Sent Successfully!
                  </Text>
                  
                  <Text style={[styles.successText, { color: theme.colors.textSecondary }]}>
                    We've sent password reset instructions to:
                  </Text>
                  
                  <View style={styles.emailContainer}>
                    <Text style={[styles.emailText, { color: theme.colors.primary }]}>
                      {email}
                    </Text>
                  </View>
                  
                  <Text style={[styles.instructionText, { color: theme.colors.textSecondary }]}>
                    Check your inbox and follow the instructions to reset your password. 
                    Don't forget to check your spam or junk folder.
                  </Text>
                </View>

                <View style={styles.actionButtons}>
                  <Button
                    title="Resend Email"
                    onPress={handleResendEmail}
                    loading={loading}
                    variant="outline"
                    style={styles.resendButton}
                  />
                  
                  <Button
                    title="Back to Login"
                    onPress={() => navigation.navigate('Login' as never)}
                    style={styles.backToLoginButton}
                  />
                </View>
                
                <Text style={styles.redirectText}>
                  Automatically redirecting to login in 5 seconds...
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DC143C',
  },
  redHeader: {
    backgroundColor: '#DC143C',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  brandLetter: {
    color: '#ffffff',
    fontSize: 52,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Arial Black' : 'sans-serif-black',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 24,
    padding: 8,
    zIndex: 10,
  },
  whiteContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: 100,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 50,
    paddingHorizontal: 32,
    width: '100%',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1F2937',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    color: '#6B7280',
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
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '400',
    minHeight: 56,
  },
  errorText: {
    fontSize: 13,
    marginTop: 6,
    marginLeft: 20,
    color: '#EF4444',
  },
  resetButton: {
    backgroundColor: '#DC143C',
    borderRadius: 25,
    paddingVertical: 18,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backToLoginButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 25,
    paddingVertical: 18,
    marginTop: 12,
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
  successContainer: {
    alignItems: 'center',
  },
  successInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333333',
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    color: '#6B7280',
  },
  emailContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC143C',
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    color: '#6B7280',
  },
  actionButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  resendButton: {
    marginBottom: 8,
  },
  redirectText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#6B7280',
  },
});