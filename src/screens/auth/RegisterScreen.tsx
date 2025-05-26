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
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { BiometricService } from '@/services/biometric';
import { COUNTRIES } from '@/constants/countries';

export default function RegisterScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    country: 'AU',
  });

  const selectedCountry = COUNTRIES.find(c => c.code === formData.country) || COUNTRIES[0];

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return false;
    }

    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (!formData.mobile.trim()) {
      Alert.alert('Error', 'Please enter your mobile number');
      return false;
    }

    if (!formData.password) {
      Alert.alert('Error', 'Please enter a password');
      return false;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const biometricAvailable = await BiometricService.isAvailable();
      if (biometricAvailable) {
        setShowBiometricPrompt(true);
      } else {
        await completeRegistration(false);
      }
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async (biometricEnabled: boolean) => {
    try {
      const userData = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        mobile: formData.mobile.trim(),
        password: formData.password,
        country: formData.country,
        currency: selectedCountry.currency,
        biometricEnabled,
      };
      
      await register(userData);
      // Navigation will happen automatically due to auth state change
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
      setShowBiometricPrompt(false);
    }
  };

  const CountryPicker = () => (
    <View style={[styles.modal, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.countryPickerContent, { backgroundColor: theme.colors.background }]}>
        <View style={styles.countryPickerHeader}>
          <Text style={[styles.countryPickerTitle, { color: theme.colors.text }]}>
            Select Country
          </Text>
          <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.countryList}>
          {COUNTRIES.map((country) => (
            <TouchableOpacity
              key={country.code}
              style={[styles.countryItem, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                setFormData({ ...formData, country: country.code });
                setShowCountryPicker(false);
              }}
            >
              <Text style={styles.countryFlag}>{country.flag}</Text>
              <Text style={[styles.countryName, { color: theme.colors.text }]}>
                {country.name}
              </Text>
              <Text style={[styles.countryCurrency, { color: theme.colors.textSecondary }]}>
                {country.currency}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const BiometricPrompt = () => (
    <View style={[styles.modal, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.biometricContent, { backgroundColor: theme.colors.background }]}>
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
  );

  if (showBiometricPrompt) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <BiometricPrompt />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Join Spendy to track and split expenses
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
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
                returnKeyType="next"
              />
              <Ionicons 
                name="person-outline" 
                size={20} 
                color={theme.colors.textSecondary} 
                style={styles.inputIcon}
              />
            </View>

            <View style={styles.inputContainer}>
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
                autoCorrect={false}
                returnKeyType="next"
              />
              <Ionicons 
                name="mail-outline" 
                size={20} 
                color={theme.colors.textSecondary} 
                style={styles.inputIcon}
              />
            </View>

            <TouchableOpacity
              style={[styles.countrySelector, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border 
              }]}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
              <Text style={[styles.countryText, { color: theme.colors.text }]}>
                {selectedCountry.name} ({selectedCountry.currency})
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.phoneContainer}>
              <View style={[styles.countryCode, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border 
              }]}>
                <Text style={{ color: theme.colors.text }}>
                  {selectedCountry.phoneCode}
                </Text>
              </View>
              <View style={styles.phoneInputContainer}>
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
                  returnKeyType="next"
                />
                <Ionicons 
                  name="call-outline" 
                  size={20} 
                  color={theme.colors.textSecondary} 
                  style={styles.inputIcon}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, { 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text 
                }]}
                placeholder="Password (min. 6 characters)"
                placeholderTextColor={theme.colors.textSecondary}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <Ionicons 
                name="lock-closed-outline" 
                size={20} 
                color={theme.colors.textSecondary} 
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
            </View>

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.registerButton}
            />
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login' as never)}
            style={styles.loginLink}
          >
            <Text style={[styles.loginLinkText, { color: theme.colors.textSecondary }]}>
              Already have an account?{' '}
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {showCountryPicker && <CountryPicker />}
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
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
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
  form: {
    gap: 16,
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
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryText: {
    flex: 1,
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
    minWidth: 80,
  },
  phoneInputContainer: {
    flex: 1,
    position: 'relative',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  registerButton: {
    marginTop: 8,
  },
  loginLink: {
    alignItems: 'center',
    padding: 8,
  },
  loginLinkText: {
    fontSize: 16,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  countryPickerContent: {
    maxHeight: '80%',
    width: '90%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  countryPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  countryPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  countryList: {
    maxHeight: 400,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    gap: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
  },
  countryCurrency: {
    fontSize: 14,
  },
  biometricContent: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    maxWidth: 300,
    width: '90%',
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