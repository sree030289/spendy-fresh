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

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
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
      Alert.alert('Error', error.message);
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
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
              <Ionicons name="mail-outline" size={64} color={theme.colors.primary} />
            </View>
            
            <Text style={[styles.title, { color: theme.colors.text }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {sent 
                ? 'We\'ve sent password reset instructions to your email'
                : 'Enter your email address and we\'ll send you instructions to reset your password'
              }
            </Text>
          </View>

          {!sent ? (
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text 
                  }]}
                  placeholder="Enter your email address"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleResetPassword}
                />
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color={theme.colors.textSecondary} 
                  style={styles.inputIcon}
                />
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
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={80} color={theme.colors.success} />
              </View>
              
              <Text style={[styles.successTitle, { color: theme.colors.text }]}>
                Email Sent!
              </Text>
              
              <Text style={[styles.successText, { color: theme.colors.textSecondary }]}>
                We've sent password reset instructions to:
              </Text>
              
              <Text style={[styles.emailText, { color: theme.colors.primary }]}>
                {email}
              </Text>
              
              <Text style={[styles.instructionText, { color: theme.colors.textSecondary }]}>
                Check your inbox and follow the instructions to reset your password. 
                Don't forget to check your spam folder.
              </Text>

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
  resetButton: {
    marginTop: 8,
  },
  backToLoginButton: {
    marginTop: 8,
  },
  successContainer: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
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