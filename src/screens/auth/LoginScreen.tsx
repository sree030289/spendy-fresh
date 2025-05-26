import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { BiometricService } from '@/services/biometric';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    const available = await BiometricService.isAvailable();
    setBiometricAvailable(available);
  };

const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert('Error', 'Please enter email and password');
    return;
  }

  setLoading(true);
  try {
    await login(email, password);
    // Navigation will happen automatically due to auth state change
  } catch (error: any) {
    Alert.alert('Login Failed', error.message);
  } finally {
    setLoading(false);
  }
};

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const result = await BiometricService.authenticate();
      if (result.success) {
        // In a real app, you'd retrieve stored credentials here
        Alert.alert('Success', 'Biometric authentication successful');
      } else {
        Alert.alert('Authentication Failed', 'Please try again');
      }
    } catch (error) {
      Alert.alert('Error', 'Biometric authentication failed');
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Sign in to your account
        </Text>

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

          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="Password"
            placeholderTextColor={theme.colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          {biometricAvailable && (
            <Button
              title="Use Biometric Login"
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

          <TouchableOpacity
            onPress={() => navigation.navigate('Register' as never)}
            style={styles.registerLink}
          >
            <Text style={[styles.registerLinkText, { color: theme.colors.textSecondary }]}>
              Don't have an account?{' '}
              <Text style={{ color: theme.colors.primary }}>Sign Up</Text>
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
  loginButton: {
    marginTop: 8,
  },
  biometricButton: {
    marginTop: 8,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 16,
    fontWeight: '500',
  },
  registerLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  registerLinkText: {
    fontSize: 16,
  },
});