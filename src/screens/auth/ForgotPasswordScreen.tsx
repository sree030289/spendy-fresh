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
import { MeetNSplitLogo } from '@/components/common/MeetNSplitLogo';
import { BrandHeader } from '@/components/common/BrandHeader';

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
      const normalizedEmail = email.trim().toLowerCase();
      const result = await resetPassword(normalizedEmail);
      
      console.log('🔄 Navigating to ChangePassword with email:', normalizedEmail);
      
      // OTP has been sent via admin@meetnsplit.com
      // Use setLoading(false) before navigation to prevent any state issues
      setLoading(false);
      
      // Use setTimeout to ensure state is updated before navigation
      setTimeout(() => {
        // Try using push instead of navigate to force navigation
        if ((navigation as any).push) {
          console.log('🚀 Using navigation.push()');
          (navigation as any).push('ChangePassword', { 
            email: normalizedEmail,
            sessionId: result?.sessionId 
          });
        } else {
          console.log('🚀 Using navigation.navigate()');
          (navigation as any).navigate('ChangePassword', { 
            email: normalizedEmail,
            sessionId: result?.sessionId 
          });
        }
        
        console.log('✅ Navigation command executed');
        
        // Show success message after navigation
        setTimeout(() => {
          Alert.alert(
            'OTP Sent!', 
            'A 6-digit verification code has been sent to your email. Please check your inbox (and spam folder).'
          );
        }, 300);
      }, 100);
    } catch (error: any) {
      console.log('Password reset error:', error);
      setLoading(false);
      
      let errorMessage = error.message || 'Failed to send verification code. Please try again.';
      
      Alert.alert('Error', errorMessage);
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

  // Create dynamic styles based on theme
  const getStyles = (colors: any) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.brand,
    },
    redHeader: {
      backgroundColor: colors.brand,
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomLeftRadius: 25,
      borderBottomRightRadius: 25,
      width: '100%',
      ...(Platform.OS === 'web' && {
        background: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.brandDark} 100%)`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      }),
    },
    brandText: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: '700',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: {width: 1, height: 1},
      textShadowRadius: 2,
    },
    backButton: {
      position: 'absolute',
      top: 10,
      left: 24,
      padding: 8,
      zIndex: 10,
    },
    whiteContent: {
      flex: 1,
      backgroundColor: '#ffffff',
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      paddingTop: 30,
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
      marginBottom: 60,
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
    subtitle: {
      fontSize: 16,
      color: '#6B7280',
      textAlign: 'center',
      lineHeight: 24,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    form: {
      gap: 24,
      marginBottom: 40,
    },
    inputContainer: {
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
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    errorText: {
      fontSize: 14,
      marginTop: 8,
      marginLeft: 20,
      color: colors.error,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    sendButton: {
      backgroundColor: colors.brand,
      borderRadius: 25,
      paddingVertical: 18,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
      ...(Platform.OS === 'web' && {
        background: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.brandDark} 100%)`,
        boxShadow: `0 8px 24px rgba(220, 20, 60, 0.3)`,
      }),
    },
    backToLogin: {
      alignItems: 'center',
      marginTop: 32,
      padding: 8,
    },
    backToLoginText: {
      fontSize: 15,
      color: colors.brand,
      fontWeight: '500',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    successContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    successIcon: {
      width: 80,
      height: 80,
      backgroundColor: colors.success,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: '#1F2937',
      marginBottom: 12,
      textAlign: 'center',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    successText: {
      fontSize: 16,
      color: '#6B7280',
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    redirectText: {
      fontSize: 14,
      color: '#9CA3AF',
      textAlign: 'center',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    resetButton: {
      backgroundColor: colors.brand,
    },
    successInfo: {
      alignItems: 'center',
      marginBottom: 24,
    },
    emailContainer: {
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 8,
      marginVertical: 16,
    },
    emailText: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    instructionText: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    actionButtons: {
      gap: 12,
      width: '100%',
    },
    resendButton: {
      borderColor: colors.brand,
    },
    backToLoginButton: {
      backgroundColor: colors.brand,
    },
  });

  const styles = getStyles(theme.colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Brand Header */}
      <BrandHeader 
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        height={100}
      />

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
    </SafeAreaView>
  );
}

