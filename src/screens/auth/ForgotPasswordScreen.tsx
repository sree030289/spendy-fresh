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
import { Ionicons } from '@expo/vector-icons';
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
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={sent ? "checkmark-circle" : "mail-outline"} 
                  size={64} 
                  color={sent ? theme.colors.success : theme.colors.primary} 
                />
              </View>
              
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {sent ? 'Check Your Email' : 'Reset Password'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                {sent 
                  ? 'We\'ve sent password reset instructions to your email address'
                  : 'Enter your email address and we\'ll send you instructions to reset your password'
                }
              </Text>
            </View>

            {!sent ? (
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
                    placeholder="Enter your email address"
                    placeholderTextColor={theme.colors.textSecondary}
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

                <Button
                  title="Send Reset Instructions"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={styles.resetButton}
                />

                <Button
                  title="Back to Login"
                  onPress={() => navigation.goBack()}
                  variant="outline"
                  style={styles.backToLoginButton}
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
                
                <Text style={[styles.redirectText, { color: theme.colors.textSecondary }]}>
                  Automatically redirecting to login in 5 seconds...
                </Text>
              </View>
            )}
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
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    gap: 16,
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
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: 18,
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 16,
  },
  resetButton: {
    marginTop: 8,
  },
  backToLoginButton: {
    marginTop: 8,
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
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
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
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  },
});