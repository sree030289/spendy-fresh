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
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/common/Icon';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { BiometricService } from '@/services/biometric';
import { BiometricAuthService } from '@/services/biometric/BiometricAuthService';
import { COUNTRIES } from '@/constants/countries';

export default function RegisterScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { register, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    country: 'AU',
    currency: 'AUD',
  });
  const [errors, setErrors] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
  });

  const selectedCountry = COUNTRIES.find(c => c.code === formData.country) || COUNTRIES[0];
  const currencies = [...new Set(COUNTRIES.map(c => c.currency))].sort();

  // Navigate to main app when user is authenticated
  React.useEffect(() => {
    if (user) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' as never }],
      });
    }
  }, [user, navigation]);

  const validateFullName = (name: string): boolean => {
    if (!name.trim()) {
      setErrors(prev => ({ ...prev, fullName: 'Full name is required' }));
      return false;
    }
    if (name.trim().length < 2) {
      setErrors(prev => ({ ...prev, fullName: 'Name must be at least 2 characters' }));
      return false;
    }
    setErrors(prev => ({ ...prev, fullName: '' }));
    return true;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setErrors(prev => ({ ...prev, email: 'Email is required' }));
      return false;
    }
    if (!emailRegex.test(email.trim())) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return false;
    }
    setErrors(prev => ({ ...prev, email: '' }));
    return true;
  };

  const validateMobile = (mobile: string): boolean => {
    // Remove all non-numeric characters
    const numericMobile = mobile.replace(/\D/g, '');
    
    if (!mobile.trim()) {
      setErrors(prev => ({ ...prev, mobile: 'Mobile number is required' }));
      return false;
    }
    if (!/^\d+$/.test(mobile)) {
      setErrors(prev => ({ ...prev, mobile: 'Mobile number must contain only numbers' }));
      return false;
    }
    if (numericMobile.length !== 10) {
      setErrors(prev => ({ ...prev, mobile: 'Mobile number must be exactly 10 digits' }));
      return false;
    }
    setErrors(prev => ({ ...prev, mobile: '' }));
    return true;
  };

  const validatePassword = (password: string): boolean => {
    if (!password) {
      setErrors(prev => ({ ...prev, password: 'Password is required' }));
      return false;
    }
    if (password.length < 6) {
      setErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
      return false;
    }
    setErrors(prev => ({ ...prev, password: '' }));
    return true;
  };

  const validateForm = (): boolean => {
    const isNameValid = validateFullName(formData.fullName);
    const isEmailValid = validateEmail(formData.email);
    const isMobileValid = validateMobile(formData.mobile);
    const isPasswordValid = validatePassword(formData.password);

    return isNameValid && isEmailValid && isMobileValid && isPasswordValid;
  };

  const getApiErrorMessage = (error: any): string => {
    // Handle API error responses
    if (error.message) {
      if (error.message.includes('User with this email already exists')) {
        return 'An account with this email already exists. Please use a different email or try logging in.';
      }
      if (error.message.includes('Password must be at least')) {
        return 'Password is too weak. Please choose a stronger password.';
      }
      if (error.message.includes('required')) {
        return error.message;
      }
      if (error.message.includes('Network')) {
        return 'Network error. Please check your connection and try again.';
      }
      return error.message;
    }
    return 'Registration failed. Please try again.';
  };

  const checkDuplicateUser = async (email: string, mobile: string) => {
    // In production, you'd check your database for existing email/mobile
    // For now, we'll let Firebase handle email duplication
    // You can add mobile number uniqueness check in Firestore
    return null;
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Check for duplicates (you can enhance this)
      await checkDuplicateUser(formData.email, formData.mobile);

      const biometricAvailable = await BiometricService.isAvailable();
      if (biometricAvailable) {
        setShowBiometricPrompt(true);
      } else {
        await completeRegistration(false);
      }
    } catch (error: any) {
      console.log('Registration error:', error);
      
      const errorMessage = getApiErrorMessage(error);
      
      // Handle specific duplicate email case
      if (error.message && error.message.includes('User with this email already exists')) {
        Alert.alert(
          'Account Exists',
          'An account with this email already exists. Would you like to login instead?',
          [
            { text: 'Try Different Email', style: 'cancel' },
            { 
              text: 'Go to Login', 
              onPress: () => navigation.navigate('Login' as never)
            }
          ]
        );
        setLoading(false);
        return;
      }
      
      Alert.alert('Registration Failed', errorMessage);
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
        currency: formData.currency,
        biometricEnabled,
      };
      
      await register(userData);
      
      // If registration successful and user has biometric enabled, save the preference
      if (biometricEnabled && user?.id) {
        await BiometricAuthService.setBiometricEnabledForUser(user.id, true);
        console.log('✅ Biometric preference saved for new user');
      }
      
      // Navigation happens in useEffect when user state changes
    } catch (error: any) {
      console.log('Complete registration error:', error);
      const errorMessage = getApiErrorMessage(error);
      Alert.alert('Registration Failed', errorMessage);
      setShowBiometricPrompt(false);
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

  const CountryPicker = () => (
    <Modal
      visible={showCountryPicker}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
            <Icon name="close" size={24} color={theme.colors.text}  />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Select Country
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.optionsList}>
          {COUNTRIES.map((country) => (
            <TouchableOpacity
              key={country.code}
              style={[styles.optionItem, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                setFormData({ 
                  ...formData, 
                  country: country.code,
                  currency: country.currency // Auto-set currency based on country
                });
                setShowCountryPicker(false);
              }}
            >
              <Text style={styles.optionFlag}>{country.flag}</Text>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionName, { color: theme.colors.text }]}>
                  {country.name}
                </Text>
                <Text style={[styles.optionSubtext, { color: theme.colors.textSecondary }]}>
                  {country.phoneCode} • {country.currency}
                </Text>
              </View>
              {formData.country === country.code && (
                <Icon name="checkmark" size={24} color={theme.colors.primary}  />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const CurrencyPicker = () => (
    <Modal
      visible={showCurrencyPicker}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCurrencyPicker(false)}>
            <Icon name="close" size={24} color={theme.colors.text}  />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Select Currency
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.optionsList}>
          {currencies.map((currency) => {
            const country = COUNTRIES.find(c => c.currency === currency);
            return (
              <TouchableOpacity
                key={currency}
                style={[styles.optionItem, { backgroundColor: theme.colors.surface }]}
                onPress={() => {
                  setFormData({ ...formData, currency });
                  setShowCurrencyPicker(false);
                }}
              >
                <Text style={styles.optionFlag}>{country?.flag || '💰'}</Text>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionName, { color: theme.colors.text }]}>
                    {currency}
                  </Text>
                  <Text style={[styles.optionSubtext, { color: theme.colors.textSecondary }]}>
                    {country?.name || 'Multiple countries'}
                  </Text>
                </View>
                {formData.currency === currency && (
                  <Icon name="checkmark" size={24} color={theme.colors.primary}  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const BiometricPrompt = () => (
    <Modal
      visible={showBiometricPrompt}
      animationType="fade"
      transparent={true}
    >
      <View style={styles.biometricModalOverlay}>
        <View style={[styles.biometricContent, { backgroundColor: theme.colors.background }]}>
          <View style={styles.biometricIcon}>
            <Icon name="fingerprint" size={64} color={theme.colors.primary}  />
          </View>
          <Text style={[styles.biometricTitle, { color: theme.colors.text }]}>
            Enable Biometric Login?
          </Text>
          <Text style={[styles.biometricSubtitle, { color: theme.colors.textSecondary }]}>
            Use Face ID or Fingerprint for quick and secure access to your account
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
              title="Skip"
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
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableWithoutFeedback onPress={Platform.OS !== 'web' ? dismissKeyboard : undefined}>
        <KeyboardAvoidingView 
          behavior={Platform.select({ ios: 'padding', android: 'height', web: 'height' })}
          style={[styles.keyboardView, Platform.OS === 'web' && { flex: 1 }]}
          enabled={true} // Enable on all platforms
        >
          <ScrollView 
            contentContainerStyle={[
              styles.scrollContent,
              Platform.OS === 'web' && { minHeight: '100%' }
            ]} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={Platform.OS !== 'web'}
            {...(Platform.OS === 'web' && {
              // Web-specific ScrollView props
              scrollEnabled: true,
              nestedScrollEnabled: true,
            })}
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Icon name="back" size={24} color={theme.colors.text}  />
              </TouchableOpacity>
              <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                Join Spendy to track and split expenses
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: errors.fullName ? theme.colors.error : theme.colors.border,
                      color: theme.colors.text 
                    }
                  ]}
                  placeholder="Full Name"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.fullName}
                  onChangeText={(text) => {
                    setFormData({ ...formData, fullName: text });
                    if (errors.fullName) validateFullName(text);
                  }}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  {...(Platform.OS === 'web' && {
                    // Web-specific props
                    autoComplete: 'name',
                    inputMode: 'text' as any,
                  })}
                />
                <Icon name="person" 
                  size={20} 
                  color={errors.fullName ? theme.colors.error : theme.colors.textSecondary} 
                  style={styles.inputIcon}
                 />
                {errors.fullName ? (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {errors.fullName}
                  </Text>
                ) : null}
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: errors.email ? theme.colors.error : theme.colors.border,
                      color: theme.colors.text 
                    }
                  ]}
                  placeholder="Email"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.email}
                  onChangeText={(text) => {
                    setFormData({ ...formData, email: text });
                    if (errors.email) validateEmail(text);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  {...(Platform.OS === 'web' && {
                    // Web-specific props
                    autoComplete: 'email',
                    inputMode: 'email' as any,
                  })}
                />
                <Icon name="mail" 
                  size={20} 
                  color={errors.email ? theme.colors.error : theme.colors.textSecondary} 
                  style={styles.inputIcon}
                 />
                {errors.email ? (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {errors.email}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.selector, { 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border 
                }]}
                onPress={() => setShowCountryPicker(true)}
              >
                <Icon name="flag-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <Text style={styles.selectorFlag}>{selectedCountry.flag}</Text>
                <Text style={[styles.selectorText, { color: theme.colors.text }]}>
                  {selectedCountry.name}
                </Text>
                <Icon name="chevron-down" size={20} color={theme.colors.textSecondary} />
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
                    style={[
                      styles.phoneInput, 
                      { 
                        backgroundColor: theme.colors.surface,
                        borderColor: errors.mobile ? theme.colors.error : theme.colors.border,
                        color: theme.colors.text 
                      }
                    ]}
                    placeholder="Mobile Number (10 digits)"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={formData.mobile}
                    onChangeText={(text) => {
                      // Only allow numbers
                      const numericText = text.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, mobile: numericText });
                      if (errors.mobile) validateMobile(numericText);
                    }}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                    maxLength={10}
                    blurOnSubmit={false}
                    {...(Platform.OS === 'web' && {
                      // Web-specific props
                      autoComplete: 'tel',
                      inputMode: 'numeric' as any,
                    })}
                  />
                  <Icon name="call" 
                    size={20} 
                    color={errors.mobile ? theme.colors.error : theme.colors.textSecondary} 
                    style={styles.inputIcon}
                   />
                </View>
              </View>
              {errors.mobile ? (
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {errors.mobile}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.selector, { 
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border 
                }]}
                onPress={() => setShowCurrencyPicker(true)}
              >
                <Icon name="card" size={20} color={theme.colors.textSecondary} style={styles.inputIcon}  />
                <Text style={styles.selectorFlag}>💰</Text>
                <Text style={[styles.selectorText, { color: theme.colors.text }]}>
                  {formData.currency}
                </Text>
                <Icon name="chevron-down" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    styles.passwordInput, 
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: errors.password ? theme.colors.error : theme.colors.border,
                      color: theme.colors.text 
                    }
                  ]}
                  placeholder="Password (min. 6 characters)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={formData.password}
                  onChangeText={(text) => {
                    setFormData({ ...formData, password: text });
                    if (errors.password) validatePassword(text);
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  blurOnSubmit={true}
                  {...(Platform.OS === 'web' && {
                    // Web-specific props
                    autoComplete: 'new-password',
                    inputMode: 'text' as any,
                  })}
                />
                <Icon name="lock" 
                  size={20} 
                  color={errors.password ? theme.colors.error : theme.colors.textSecondary} 
                  style={styles.inputIcon}
                 />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <Icon 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                  />
                </TouchableOpacity>
                {errors.password ? (
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {errors.password}
                  </Text>
                ) : null}
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
      </TouchableWithoutFeedback>

      <CountryPicker />
      <CurrencyPicker />
      <BiometricPrompt />
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
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  selectorFlag: {
    fontSize: 20,
  },
  selectorText: {
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
  errorText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 16,
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionsList: {
    flex: 1,
    padding: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  optionFlag: {
    fontSize: 24,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  biometricModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 24,
  },
  biometricContent: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    maxWidth: 320,
    width: '100%',
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)',
    elevation: 10,
  },
  biometricIcon: {
    marginBottom: 20,
  },
  biometricTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  biometricSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
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