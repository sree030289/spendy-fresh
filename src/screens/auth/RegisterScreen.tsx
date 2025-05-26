import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { BiometricService } from '@/services/biometric';
import { COUNTRIES } from '@/constants/countries';

export default function RegisterScreen() {
  const { theme } = useTheme();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    country: 'AU',
  });

  const selectedCountry = COUNTRIES.find(c => c.code === formData.country) || COUNTRIES[0];

  const handleRegister = async () => {
    if (!formData.fullName || !formData.email || !formData.mobile || !formData.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const biometricAvailable = await BiometricService.isAvailable();
      if (biometricAvailable) {
        setShowBiometricPrompt(true);
      } else {
        await completeRegistration(false);
      }
    } catch (error) {
      Alert.alert('Registration Failed', 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async (biometricEnabled: boolean) => {
  try {
    const userData = {
      ...formData,
      password: formData.password, // Make sure password is included
      currency: selectedCountry.currency,
      biometricEnabled,
    };
    
    await register(userData);
    // Navigation will happen automatically
  } catch (error: any) {
    Alert.alert('Registration Failed', error.message);
  }
};

  const BiometricPrompt = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.modal, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.biometricContent, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="finger-print" size={64} color={theme.colors.primary} />
          <Text style={[styles.biometricTitle, { color: theme.colors.text }]}>
            Enable Biometric Login?
          </Text>
          <Text style={[styles.biometricSubtitle, { color: theme.colors.textSecondary }]}>
            Use Face ID or Fingerprint for quick and secure access
          </Text>
          <View style={styles.biometricButtons}>
            <Button
              title="Enable"
              onPress={() => {
                setShowBiometricPrompt(false);
                completeRegistration(true);
              }}
              style={styles.biometricButton}
            />
            <Button
              title="Not Now"
              onPress={() => {
                setShowBiometricPrompt(false);
                completeRegistration(false);
              }}
              variant="outline"
              style={styles.biometricButton}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );

  if (showBiometricPrompt) {
    return <BiometricPrompt />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Join Spendy to track and split expenses
          </Text>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text 
              }]}
              placeholder="Full Name"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
            />

            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text 
              }]}
              placeholder="Email"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.phoneContainer}>
              <View style={[styles.countryCode, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border 
              }]}>
                <Text style={{ color: theme.colors.text }}>
                  {selectedCountry.flag} {selectedCountry.phoneCode}
                </Text>
              </View>
              <TextInput
                style={[styles.phoneInput, { 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text 
                }]}
                placeholder="Mobile Number"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.mobile}
                onChangeText={(text) => setFormData({ ...formData, mobile: text })}
                keyboardType="phone-pad"
              />
            </View>

            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text 
              }]}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
            />

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.registerButton}
            />
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
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
  phoneContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 100,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  registerButton: {
    marginTop: 8,
  },
  modal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  biometricContent: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    maxWidth: 300,
    width: '100%',
  },
  biometricTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  biometricSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  biometricButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  biometricButton: {
    flex: 1,
  },
});