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
import { EmailService } from '@/services/EmailService';
import { AuthService } from '@/services/firebase/auth';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  
  // Get email from navigation params (if coming from Forgot Password screen)
  const route = navigation.getState?.()?.routes?.[navigation.getState?.()?.index ?? 0];
  const emailFromParams = (route as any)?.params?.email;
  
  const [formData, setFormData] = useState({
    email: emailFromParams || user?.email || '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email service instance
  const emailService = EmailService.getInstance();
  
  // Debug: Log when component mounts and params received
  React.useEffect(() => {
    console.log('🔑 ChangePasswordScreen mounted');
    console.log('📧 Email from params:', emailFromParams);
    console.log('👤 User email:', user?.email);
  }, []);
  
  // If email was passed and OTP already sent, skip to OTP step
  React.useEffect(() => {
    if (emailFromParams) {
      console.log('✅ Setting up for OTP entry with email:', emailFromParams);
      setOtpSent(true);
      setStep('otp');
    }
  }, [emailFromParams]);

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

  const validateOTP = (otp: string): boolean => {
    if (!otp.trim()) {
      setErrors(prev => ({ ...prev, otp: 'OTP is required' }));
      return false;
    }
    if (otp.length !== 6) {
      setErrors(prev => ({ ...prev, otp: 'OTP must be 6 digits' }));
      return false;
    }
    if (!/^\d+$/.test(otp)) {
      setErrors(prev => ({ ...prev, otp: 'OTP must contain only numbers' }));
      return false;
    }
    setErrors(prev => ({ ...prev, otp: '' }));
    return true;
  };

  const validatePassword = (password: string): boolean => {
    if (!password) {
      setErrors(prev => ({ ...prev, newPassword: 'Password is required' }));
      return false;
    }
    if (password.length < 6) {
      setErrors(prev => ({ ...prev, newPassword: 'Password must be at least 6 characters' }));
      return false;
    }
    setErrors(prev => ({ ...prev, newPassword: '' }));
    return true;
  };

  const validateConfirmPassword = (confirmPassword: string): boolean => {
    if (!confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Please confirm your password' }));
      return false;
    }
    if (confirmPassword !== formData.newPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      return false;
    }
    setErrors(prev => ({ ...prev, confirmPassword: '' }));
    return true;
  };

  const sendOTPEmail = async (email: string) => {
    console.log(`Sending OTP to ${email} via EmailService`);
    
    try {
      const result = await emailService.sendOTP(email);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      // For demo purposes, show the OTP in alert (remove in production)
      if (result.otp) {
        Alert.alert(
          'Demo Mode - OTP Sent!',
          `Your OTP is: ${result.otp}\n\nIn production, this would be sent to your email: ${email}`,
          [{ text: 'OK' }]
        );
      }

      return result.message;
    } catch (error: any) {
      console.error('Send OTP error:', error);
      throw new Error(`Failed to send OTP: ${error.message}`);
    }
  };

  const handleSendOTP = async () => {
    if (!validateEmail(formData.email)) return;

    setLoading(true);
    try {
      await sendOTPEmail(formData.email);
      
      setOtpSent(true);
      setStep('otp');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!validateOTP(formData.otp)) return;

    setLoading(true);
    try {
      const result = await emailService.verifyOTP(formData.email, formData.otp);
      
      if (!result.success) {
        setErrors(prev => ({ ...prev, otp: result.message }));
        setLoading(false);
        return;
      }

      setOtpVerified(true);
      setStep('password');
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      Alert.alert('Error', 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const isPasswordValid = validatePassword(formData.newPassword);
    const isConfirmValid = validateConfirmPassword(formData.confirmPassword);

    if (!isPasswordValid || !isConfirmValid) return;

    setLoading(true);
    try {
      // Verify that OTP is still valid
      if (!emailService.isOTPVerified(formData.email)) {
        Alert.alert('Error', 'OTP session has expired. Please verify your email again.');
        setStep('email');
        setLoading(false);
        return;
      }

      // Use the new updatePasswordWithOTP method
      await AuthService.updatePasswordWithOTP(formData.email, formData.newPassword);
      
      // Clear the OTP session
      emailService.clearOTP();

      Alert.alert(
        'Success!',
        'Your password has been changed successfully. You can now log in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              // If coming from forgot password flow, navigate to Login screen
              // Otherwise, go back (for logged-in users changing password)
              if (emailFromParams) {
                navigation.navigate('Login' as never);
              } else {
                navigation.goBack();
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Change password error:', error);
      Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setFormData(prev => ({ ...prev, otp: '' }));
    
    try {
      await sendOTPEmail(formData.email);
      Alert.alert('OTP Resent', `A new verification code has been sent to ${formData.email}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend OTP. Please try again.');
    }
  };

  const renderEmailStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Icon name="mail" size={48} color={theme.colors.primary}  />
        <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
          Verify Your Email
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
          We'll send an OTP to your email address for security
        </Text>
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
          placeholder="Email Address"
          placeholderTextColor={theme.colors.textSecondary}
          value={formData.email}
          onChangeText={(text) => {
            setFormData(prev => ({ ...prev, email: text }));
            if (errors.email) validateEmail(text);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={handleSendOTP}
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

      <Button
        title="Send OTP"
        onPress={handleSendOTP}
        loading={loading}
        style={styles.actionButton}
      />
    </View>
  );

  const renderOTPStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Icon name="checkmark" size={48} color={theme.colors.primary} />
        <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
          Enter OTP
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
          We've sent a 6-digit code to {formData.email}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            styles.otpInput,
            {
              backgroundColor: theme.colors.surface,
              borderColor: errors.otp ? theme.colors.error : theme.colors.border,
              color: theme.colors.text
            }
          ]}
          placeholder="Enter 6-digit OTP"
          placeholderTextColor={theme.colors.textSecondary}
          value={formData.otp}
          onChangeText={(text) => {
            // Only allow numbers and limit to 6 digits
            const numericText = text.replace(/[^0-9]/g, '').substring(0, 6);
            setFormData(prev => ({ ...prev, otp: numericText }));
            if (errors.otp) validateOTP(numericText);
          }}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={handleVerifyOTP}
          maxLength={6}
        />
        <Icon
          name="calculator"
          size={20}
          color={errors.otp ? theme.colors.error : theme.colors.textSecondary}
          style={styles.inputIcon}
        />
        {errors.otp ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errors.otp}
          </Text>
        ) : null}
      </View>

      <Button
        title="Verify OTP"
        onPress={handleVerifyOTP}
        loading={loading}
        style={styles.actionButton}
      />

      <TouchableOpacity onPress={handleResendOTP} style={styles.resendContainer}>
        <Text style={[styles.resendText, { color: theme.colors.primary }]}>
          Didn't receive the code? Resend OTP
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPasswordStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Icon name="lock" size={48} color={theme.colors.primary}  />
        <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
          Set New Password
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
          Create a password with at least 6 characters
        </Text>
      </View>

      <View style={styles.passwordContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              styles.passwordInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: errors.newPassword ? theme.colors.error : theme.colors.border,
                color: theme.colors.text
              }
            ]}
            placeholder="New Password (min. 6 characters)"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.newPassword}
            onChangeText={(text) => {
              setFormData(prev => ({ ...prev, newPassword: text }));
              if (errors.newPassword) validatePassword(text);
            }}
            secureTextEntry={!showNewPassword}
            returnKeyType="next"
          />
          <Icon name="lock"
            size={20}
            color={errors.newPassword ? theme.colors.error : theme.colors.textSecondary}
            style={styles.inputIcon}
           />
          <TouchableOpacity
            onPress={() => setShowNewPassword(!showNewPassword)}
            style={styles.passwordToggle}
          >
            <Icon
              name={showNewPassword ? "eyeOff" : "eye"}
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
          {errors.newPassword ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {errors.newPassword}
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
                borderColor: errors.confirmPassword ? theme.colors.error : theme.colors.border,
                color: theme.colors.text
              }
            ]}
            placeholder="Confirm New Password"
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.confirmPassword}
            onChangeText={(text) => {
              setFormData(prev => ({ ...prev, confirmPassword: text }));
              if (errors.confirmPassword) validateConfirmPassword(text);
            }}
            secureTextEntry={!showConfirmPassword}
            returnKeyType="done"
            onSubmitEditing={handleChangePassword}
          />
          <Icon name="lock"
            size={20}
            color={errors.confirmPassword ? theme.colors.error : theme.colors.textSecondary}
            style={styles.inputIcon}
           />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={styles.passwordToggle}
          >
            <Icon
              name={showConfirmPassword ? "eyeOff" : "eye"}
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
          {errors.confirmPassword ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {errors.confirmPassword}
            </Text>
          ) : null}
        </View>
      </View>

      <Button
        title="Change Password"
        onPress={handleChangePassword}
        loading={loading}
        style={styles.actionButton}
      />
    </View>
  );

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
                <Icon name="back" size={24} color={theme.colors.text}  />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                Change Password
              </Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      backgroundColor: theme.colors.primary,
                      width: step === 'email' ? '33%' : step === 'otp' ? '66%' : '100%'
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
                Step {step === 'email' ? '1' : step === 'otp' ? '2' : '3'} of 3
              </Text>
            </View>

            {step === 'email' && renderEmailStep()}
            {step === 'otp' && renderOTPStep()}
            {step === 'password' && renderPasswordStep()}
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 4,
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
  passwordContainer: {
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    marginTop: 16,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 16,
    padding: 8,
  },
  resendText: {
    fontSize: 16,
    fontWeight: '500',
  },
});