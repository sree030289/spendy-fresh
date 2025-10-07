import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { authService } from '@/services/auth';
import { ApiService } from '@/services/api/ApiService';

export interface BiometricResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

export class BiometricAuthService {
  private static readonly STORAGE_KEYS = {
    BIOMETRIC_ENABLED: '@spendy_biometric_enabled',
    LAST_BIOMETRIC_ATTEMPT: '@spendy_last_biometric_attempt',
    BIOMETRIC_FAIL_COUNT: '@spendy_biometric_fail_count',
    SESSION_TIMESTAMP: '@spendy_session_timestamp',
    SECURE_CREDENTIALS: '@spendy_secure_credentials'
  };

  private static readonly MAX_BIOMETRIC_ATTEMPTS = 3;
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static async isHardwareAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric hardware:', error);
      return false;
    }
  }

  static async getSupportedBiometricTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('Error getting supported biometric types:', error);
      return [];
    }
  }

  static async isBiometricEnabledForUser(userId: string): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(`${this.STORAGE_KEYS.BIOMETRIC_ENABLED}_${userId}`);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  static async setBiometricEnabledForUser(userId: string, enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(`${this.STORAGE_KEYS.BIOMETRIC_ENABLED}_${userId}`, enabled.toString());
    } catch (error) {
      console.error('Error setting biometric enabled status:', error);
    }
  }

  static async isSessionValid(): Promise<boolean> {
    try {
      const sessionTimestamp = await AsyncStorage.getItem(this.STORAGE_KEYS.SESSION_TIMESTAMP);
      console.log('🔍 BiometricAuthService.isSessionValid - sessionTimestamp:', sessionTimestamp);
      
      if (!sessionTimestamp) {
        console.log('🔍 BiometricAuthService.isSessionValid - No session timestamp found');
        return false;
      }

      const timestamp = parseInt(sessionTimestamp, 10);
      const now = Date.now();
      const sessionAge = now - timestamp;
      const isValid = sessionAge < this.SESSION_DURATION;

      console.log('🔍 BiometricAuthService.isSessionValid - Session details:', {
        timestamp,
        now,
        sessionAge,
        sessionDuration: this.SESSION_DURATION,
        isValid
      });

      return isValid;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  }

  static async extendSession(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.SESSION_TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.error('Error extending session:', error);
    }
  }

  static async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEYS.SESSION_TIMESTAMP);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  static async getFailCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem(this.STORAGE_KEYS.BIOMETRIC_FAIL_COUNT);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Error getting fail count:', error);
      return 0;
    }
  }

  static async incrementFailCount(): Promise<number> {
    try {
      const currentCount = await this.getFailCount();
      const newCount = currentCount + 1;
      await AsyncStorage.setItem(this.STORAGE_KEYS.BIOMETRIC_FAIL_COUNT, newCount.toString());
      return newCount;
    } catch (error) {
      console.error('Error incrementing fail count:', error);
      return 0;
    }
  }

  static async clearFailCount(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEYS.BIOMETRIC_FAIL_COUNT);
    } catch (error) {
      console.error('Error clearing fail count:', error);
    }
  }

  /**
   * Validate Firebase session before biometric login
   * This ensures we have a valid Firebase session and can get fresh tokens
   */
  static async validateFirebaseSession(): Promise<boolean> {
    try {
      console.log('🔍 Validating Firebase session for biometric login...');
      
      // Check if Firebase user exists
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        console.log('❌ No Firebase user found');
        return false;
      }
      
      console.log('✅ Firebase user exists:', currentUser.email);
      
      // Validate API service token
      const apiService = ApiService.getInstance();
      const isTokenValid = await apiService.validateStoredToken();
      
      if (!isTokenValid) {
        console.log('❌ Stored token is invalid');
        return false;
      }
      
      console.log('✅ Firebase session is valid');
      return true;
    } catch (error) {
      console.error('❌ Error validating Firebase session:', error);
      return false;
    }
  }

  /**
   * Get fresh Firebase token for biometric authentication
   * This ensures we use a current token instead of expired AsyncStorage token
   */
  static async getFreshToken(): Promise<string | null> {
    try {
      console.log('🔄 Getting fresh Firebase token...');
      
      // Get fresh token from Firebase (auto-refreshes if needed)
      const token = await authService.getIdToken(true);
      
      if (token) {
        console.log('✅ Fresh token obtained from Firebase');
        // Update ApiService with fresh token
        const apiService = ApiService.getInstance();
        await apiService.restoreAuthToken(token);
        return token;
      } else {
        console.log('❌ Could not get fresh token');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting fresh token:', error);
      return null;
    }
  }

  static async hasExceededMaxAttempts(): Promise<boolean> {
    const failCount = await this.getFailCount();
    return failCount >= this.MAX_BIOMETRIC_ATTEMPTS;
  }

  static async authenticateWithBiometric(promptMessage?: string): Promise<BiometricResult> {
    try {
      // Check if hardware is available
      const isAvailable = await this.isHardwareAvailable();
      console.log('🔍 Biometric hardware check:', isAvailable);
      if (!isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
          errorCode: 'HARDWARE_NOT_AVAILABLE'
        };
      }

      // Check if we've exceeded max attempts
      const exceededAttempts = await this.hasExceededMaxAttempts();
      if (exceededAttempts) {
        return {
          success: false,
          error: 'Too many failed attempts. Please use email and password.',
          errorCode: 'MAX_ATTEMPTS_EXCEEDED'
        };
      }

      // Get supported biometric types for better messaging
      const supportedTypes = await this.getSupportedBiometricTypes();
      console.log('🔍 Supported biometric types:', supportedTypes);
      const hasFaceID = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const hasTouchID = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      
      let defaultPrompt = 'Authenticate to access your account';
      if (hasFaceID) {
        defaultPrompt = 'Authenticate with Face ID';
      } else if (hasTouchID) {
        defaultPrompt = 'Authenticate with Touch ID';
      }

      // Check if we're running in Expo Go vs development build
      const isExpoGo = Constants.appOwnership === 'expo';
      console.log('🔍 Running in Expo Go:', isExpoGo);
      console.log('🔍 App ownership:', Constants.appOwnership);
      
      if (isExpoGo) {
        console.warn('⚠️ EXPO GO LIMITATION: Biometric authentication may not work properly in Expo Go. Consider using a development build for full biometric functionality.');
      }
      
      console.log('🔒 Calling LocalAuthentication.authenticateAsync with:', {
        promptMessage: promptMessage || defaultPrompt,
        hasFaceID,
        hasTouchID,
        isExpoGo
      });

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || defaultPrompt,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: true, // We handle fallback ourselves
      });

      console.log('🔒 Raw LocalAuthentication result:', result);
      console.log('🔒 Result details:', JSON.stringify(result, null, 2));

      if (result.success) {
        console.log('✅ LocalAuthentication succeeded');
        // Clear fail count on success
        await this.clearFailCount();
        // Extend session
        await this.extendSession();
        
        return {
          success: true
        };
      } else {
        console.log('❌ LocalAuthentication failed:', {
          success: result.success,
          error: (result as any).error,
          warning: (result as any).warning
        });
        
        // Increment fail count
        const failCount = await this.incrementFailCount();
        
        let errorMessage = 'Biometric authentication failed';
        let errorCode = 'AUTHENTICATION_FAILED';

        const errorType = (result as any).error;
        if (errorType === 'user_cancel') {
          errorMessage = 'Authentication was cancelled';
          errorCode = 'USER_CANCELLED';
        } else if (errorType === 'system_cancel') {
          errorMessage = 'Authentication was cancelled by the system';
          errorCode = 'SYSTEM_CANCELLED';
        } else if (errorType === 'not_enrolled') {
          errorMessage = 'No biometric authentication methods are enrolled';
          errorCode = 'NOT_ENROLLED';
        } else if (errorType === 'not_available') {
          errorMessage = 'Biometric authentication is not available';
          errorCode = 'NOT_AVAILABLE';
        }

        return {
          success: false,
          error: errorMessage,
          errorCode: errorCode
        };
      }
    } catch (error: any) {
      console.error('❌ Biometric authentication exception:', error);
      await this.incrementFailCount();
      
      return {
        success: false,
        error: 'An unexpected error occurred during biometric authentication',
        errorCode: 'UNEXPECTED_ERROR'
      };
    }
  }

  static async shouldShowBiometricOnLaunch(userId?: string): Promise<boolean> {
    try {
      console.log('🔍 BiometricAuthService.shouldShowBiometricOnLaunch - userId:', userId);
      
      // If no user ID, can't check biometric settings
      if (!userId) {
        console.log('🔍 BiometricAuthService.shouldShowBiometricOnLaunch - No userId provided');
        return false;
      }

      // Check if biometric is available
      const isAvailable = await this.isHardwareAvailable();
      console.log('🔍 BiometricAuthService.shouldShowBiometricOnLaunch - isAvailable:', isAvailable);
      if (!isAvailable) return false;

      // Check if user has biometric enabled
      const isBiometricEnabled = await this.isBiometricEnabledForUser(userId);
      console.log('🔍 BiometricAuthService.shouldShowBiometricOnLaunch - isBiometricEnabled:', isBiometricEnabled);
      if (!isBiometricEnabled) return false;

      // Check if session is still valid (within 24 hours)
      const isSessionValid = await this.isSessionValid();
      console.log('🔍 BiometricAuthService.shouldShowBiometricOnLaunch - isSessionValid:', isSessionValid);
      if (isSessionValid) {
        console.log('🔍 BiometricAuthService.shouldShowBiometricOnLaunch - Session is still valid, not showing biometric');
        return false; // Don't show biometric if session is still valid
      }

      // Check if we've exceeded max attempts
      const exceededAttempts = await this.hasExceededMaxAttempts();
      console.log('🔍 BiometricAuthService.shouldShowBiometricOnLaunch - exceededAttempts:', exceededAttempts);
      if (exceededAttempts) return false;

      console.log('🔍 BiometricAuthService.shouldShowBiometricOnLaunch - All conditions met, showing biometric');
      return true;
    } catch (error) {
      console.error('Error checking if should show biometric on launch:', error);
      return false;
    }
  }

  static async getAuthenticationPromptMessage(): Promise<string> {
    try {
      const supportedTypes = await this.getSupportedBiometricTypes();
      const hasFaceID = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const hasTouchID = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      
      if (hasFaceID) {
        return 'Look at your device to authenticate with Face ID';
      } else if (hasTouchID) {
        return 'Place your finger on the sensor to authenticate';
      } else {
        return 'Authenticate with biometrics';
      }
    } catch (error) {
      console.error('Error getting authentication prompt message:', error);
      return 'Authenticate with biometrics';
    }
  }
}