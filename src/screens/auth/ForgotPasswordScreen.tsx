import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common/Button';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      // Simulate sending reset email
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSent(true);
      Alert.alert('Success', 'Password reset link sent to your email!');
      setTimeout(() => navigation.goBack(), 3000);
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {sent 
            ? 'Check your email for reset instructions'
            : 'Enter your email to reset password'
          }
        </Text>

        {!sent ? (
          <View style={styles.form}>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text 
              }]}
              placeholder="Email"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Button
              title="Send Reset Link"
              onPress={handleResetPassword}
              loading={loading}
              style={styles.resetButton}
            />

            <Button
              title="Back to Login"
              onPress={() => navigation.goBack()}
              variant="outline"
              style={styles.backButton}
            />
          </View>
        ) : (
          <View style={styles.successContainer}>
            <Text style={[styles.successText, { color: theme.colors.success }]}>
              ✓ Reset email sent successfully
            </Text>
            <Text style={[styles.redirectText, { color: theme.colors.textSecondary }]}>
              Redirecting to login...
            </Text>
          </View>
        )}
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
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  resetButton: {
    marginTop: 8,
  },
  backButton: {
    marginTop: 8,
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  redirectText: {
    fontSize: 16,
  },
});