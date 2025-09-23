[
  ]import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { ApiService } from '@/services/api/ApiService';
import { User } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    fullName: string;
    email: string;
    mobile: string;
    password: string;
    country: string;
    currency: string;
    biometricEnabled: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  uploadProfilePicture: (imageUri: string) => Promise<string>;
  deleteProfilePicture: () => Promise<void>;
  restoreSessionFromBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  AUTH_TOKEN: '@spendy_auth_token',
  USER_DATA: '@spendy_user_data',
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const apiService = ApiService.getInstance();

  useEffect(() => {
    console.log('Setting up auth state...');
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check if we have a stored token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      if (token && userData) {
        console.log('Found stored auth data, verifying...');
        try {
          // Check if session is still valid first
          const isValidSession = await apiService.isSessionValid();
          if (!isValidSession) {
            console.log('Session expired, clearing auth data');
            await clearAuthData();
            setIsLoading(false);
            return;
          }

          // Verify token is still valid by getting profile
          const profileData = await apiService.getProfile();
          const parsedUser = JSON.parse(userData);
          
          // Check for stored biometric preference
          const storedBiometric = await AsyncStorage.getItem('@spendy_biometric_enabled');
          const biometricFromStorage = storedBiometric ? JSON.parse(storedBiometric) : false;
          const biometricFromUser = parsedUser.biometricEnabled || false;
          const finalBiometricSetting = biometricFromStorage || biometricFromUser;
          
          console.log('🔍 Biometric preference check:', {
            fromStorage: biometricFromStorage,
            fromUser: biometricFromUser,
            final: finalBiometricSetting
          });

          // Convert API response to User type
          const user: User = {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.fullName,
            currency: profileData.currency,
            profilePicture: profileData.profileImage || (profileData as any).profilePicture,
            profileImage: profileData.profileImage || (profileData as any).profilePicture,
            isPremium: profileData.isPremium,
            biometricEnabled: finalBiometricSetting,
            country: parsedUser.country || 'US',
            mobile: (profileData as any).mobile || (profileData as any).phoneNumber || '',
            phoneNumber: (profileData as any).mobile || (profileData as any).phoneNumber || '',
            subscriptionStatus: profileData.isPremium ? 'premium' : 'expired',
            createdAt: parsedUser.createdAt ? new Date(parsedUser.createdAt) : new Date(),
            updatedAt: new Date(),
          };
          
          setUser(user);
          console.log('Auth state restored for user:', user.email);
          
          // Extend session since we're actively using it
          await apiService.extendUserSession();
        } catch (error) {
          console.log('Stored token invalid, clearing auth data');
          await clearAuthData();
        }
      } else {
        console.log('No stored auth data found');
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthData = async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER_DATA]);
    setUser(null);
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('Attempting login...');
      const response = await apiService.login(email, password);
      
      // Convert API response to User type
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        fullName: response.user.fullName,
        currency: response.user.currency,
        profilePicture: response.user.profileImage || (response.user as any).profilePicture,
        profileImage: response.user.profileImage || (response.user as any).profilePicture,
        isPremium: response.user.isPremium,
        biometricEnabled: false, // Will be updated from stored preferences
        country: (response.user as any).country || 'US',
        mobile: (response.user as any).mobile || (response.user as any).phoneNumber || '',
        phoneNumber: (response.user as any).mobile || (response.user as any).phoneNumber || '',
        subscriptionStatus: response.user.isPremium ? 'premium' : 'expired',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Check for stored biometric preference to restore after manual login
      const storedBiometric = await AsyncStorage.getItem('@spendy_biometric_enabled');
      if (storedBiometric) {
        const biometricEnabled = JSON.parse(storedBiometric);
        user.biometricEnabled = biometricEnabled;
        console.log('🔒 Restored biometric preference after manual login:', biometricEnabled);
        // Re-enable biometric for future logins
        await AsyncStorage.setItem('@spendy_biometric_enabled', JSON.stringify(biometricEnabled));
      }

      // Store user data
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      
      // Store user session info
      await apiService.storeUserSession(user);
      
      // Register push token with backend for notifications
      try {
        const { RealNotificationService } = await import('@/services/notifications/RealNotificationService');
        await RealNotificationService.registerTokenWithBackend(user.id);
        console.log('✅ Push token registered with backend');
      } catch (error) {
        console.error('⚠️ Failed to register push token:', error);
        // Don't fail login if push token registration fails
      }
      
      setUser(user);
      setIsLoading(false);
      console.log('Login successful');
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const register = async (userData: {
    fullName: string;
    email: string;
    mobile: string;
    password: string;
    country: string;
    currency: string;
    biometricEnabled: boolean;
  }) => {
    try {
      setIsLoading(true);
      console.log('Attempting registration...');
      const { biometricEnabled, ...apiUserData } = userData;
      const response = await apiService.register(apiUserData);
      
      // Convert API response to User type
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        fullName: response.user.fullName,
        currency: response.user.currency,
        profilePicture: undefined, // Response doesn't include profileImage for register
        profileImage: undefined,
        isPremium: response.user.isPremium,
        biometricEnabled: biometricEnabled,
        country: userData.country,
        mobile: userData.mobile,
        phoneNumber: userData.mobile,
        subscriptionStatus: response.user.isPremium ? 'premium' : 'expired',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store user data
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      
      // Store user session info
      await apiService.storeUserSession(user);
      
      // Register push token with backend for notifications
      try {
        const { RealNotificationService } = await import('@/services/notifications/RealNotificationService');
        await RealNotificationService.registerTokenWithBackend(user.id);
        console.log('✅ Push token registered with backend after registration');
      } catch (error) {
        console.error('⚠️ Failed to register push token:', error);
        // Don't fail registration if push token registration fails
      }
      
      setUser(user);
      setIsLoading(false); 
      console.log('Registration successful');
    } catch (error) {
      console.error('Registration error:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      console.log('Attempting logout...');
      
      // Save user info and biometric preference before clearing everything
      const currentUser = user;
      const userEmail = currentUser?.email;
      const userBiometricEnabled = currentUser?.biometricEnabled;
      
      await apiService.logout();
      await clearAuthData();
      
      // Clear session timestamp but preserve user email and biometric preference for next login
      if (userEmail) {
        console.log('💾 Preserving user preferences for next login:', userEmail);
        await AsyncStorage.setItem('@spendy_last_email', userEmail);
        await AsyncStorage.setItem('@spendy_biometric_enabled', JSON.stringify(userBiometricEnabled || false));
        
        // Also preserve in the new BiometricAuthService format if user ID is available
        if (currentUser?.id && userBiometricEnabled) {
          await AsyncStorage.setItem(`@spendy_biometric_enabled_${currentUser.id}`, 'true');
          console.log('✅ Biometric preference preserved for user:', currentUser.id);
        }
      }
      
      // Clear session timestamp to invalidate session but keep user preferences
      await AsyncStorage.removeItem('@spendy_session_timestamp');
      
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      setIsLoading(true);
      console.log('📤 Updating user profile:', updates);
      
      // Try to update via API first, but fallback to local storage on error
      try {
        const updatedUserData = await apiService.updateUserProfile({
          fullName: updates.fullName,
          mobile: updates.mobile,
          country: updates.country,
          currency: updates.currency,
          biometricEnabled: updates.biometricEnabled,
          profilePicture: updates.profilePicture
        });
        
        console.log('📥 API updated user profile successfully');
        
        // Update local user state with API response
        const updatedUser = { 
          ...user, 
          ...updatedUserData,
          profilePicture: updatedUserData.profilePicture || updatedUserData.profileImage,
          profileImage: updatedUserData.profilePicture || updatedUserData.profileImage,
          updatedAt: new Date() 
        };
        
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
        setUser(updatedUser);
        
      } catch (apiError) {
        console.log('⚠️ API update failed, updating locally:', apiError);
        
        // Fallback to local update
        const updatedUser = { ...user, ...updates, updatedAt: new Date() };
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
      
      // Handle biometric setting updates
      if ('biometricEnabled' in updates && user.id) {
        console.log('💾 Updating biometric preference for user:', user.id, 'enabled:', updates.biometricEnabled);
        
        // Save in old ApiService format
        await AsyncStorage.setItem('@spendy_biometric_enabled', JSON.stringify(updates.biometricEnabled));
        
        // Save in new BiometricAuthService format
        if (updates.biometricEnabled) {
          await AsyncStorage.setItem(`@spendy_biometric_enabled_${user.id}`, 'true');
        } else {
          await AsyncStorage.removeItem(`@spendy_biometric_enabled_${user.id}`);
        }
        
        // Update the session data with new biometric preference
        await apiService.storeUserSession(user);
        
        console.log('✅ Biometric preference updated successfully');
      }
      
      console.log('✅ User updated successfully');
    } catch (error) {
      console.error('❌ Update user error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setIsLoading(true);
      // TODO: Implement change password API endpoint
      console.log('Password update - endpoint not implemented yet');
      throw new Error('Password update feature coming soon');
    } catch (error) {
      console.error('Update password error:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setIsLoading(true);
      // TODO: Implement reset password API endpoint
      console.log('Password reset - endpoint not implemented yet');
      throw new Error('Password reset feature coming soon');
    } catch (error) {
      console.error('Reset password error:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const uploadProfilePicture = async (imageUri: string): Promise<string> => {
    if (!user) throw new Error('No user logged in');
    
    try {
      setIsLoading(true);
      // TODO: Implement profile picture upload API endpoint
      console.log('Profile picture upload - endpoint not implemented yet');
      
      // For now, just store locally
      const updatedUser = { ...user, profilePicture: imageUri, profileImage: imageUri };
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      return imageUri;
    } catch (error) {
      console.error('Upload profile picture error:', error);
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProfilePicture = async () => {
    if (!user) throw new Error('No user logged in');
    
    try {
      setIsLoading(true);
      // TODO: Implement delete profile picture API endpoint
      const updatedUser = { ...user, profilePicture: undefined, profileImage: undefined };
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
      setUser(updatedUser);
      console.log('Profile picture deleted successfully');
    } catch (error) {
      console.error('Delete profile picture error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const restoreSessionFromBiometric = async () => {
    try {
      console.log('🔄 Restoring session after biometric authentication');
      setIsLoading(true);
      
      // Get stored auth data - BOTH are required for proper restoration
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      console.log('🔍 Session restore - checking stored data:', {
        hasToken: !!token,
        hasUserData: !!userData,
        tokenLength: token ? token.length : 0
      });
      
      // If no token or userData, fallback to manual login
      if (!token || !userData) {
        console.log('⚠️ Session restore - missing auth data, falling back to manual login');
        console.log('🔍 Session restore - checking for stored user session...');
        
        // Try to get last user session for email pre-fill
        const sessionData = await apiService.getLastUserSession();
        if (sessionData && sessionData.email) {
          console.log('🔍 Found last user session, requiring manual login for:', sessionData.email);
          // Clear the biometric preference temporarily to prevent infinite loop
          await AsyncStorage.removeItem('@spendy_biometric_enabled');
          throw new Error('MANUAL_LOGIN_REQUIRED');
        } else {
          console.error('❌ No session data found');
          throw new Error('Authentication data not found. Please login again.');
        }
      }
      
      const parsedUser = JSON.parse(userData);
      console.log('🔍 Session restore - parsed user from stored data:', {
        id: parsedUser.id,
        email: parsedUser.email,
        fullName: parsedUser.fullName
      });
      
      // CRITICAL: Set the auth token in ApiService instance
      console.log('🔑 Setting auth token in ApiService instance...');
      await apiService.restoreAuthToken(token);
      console.log('✅ Auth token set in ApiService');
      
      // Verify the token works by getting fresh profile data
      console.log('🔍 Session restore - calling API getProfile to verify token...');
      const profileData = await apiService.getProfile();
      console.log('🔍 Session restore - API profile data received:', {
        id: profileData.id,
        email: profileData.email,
        isPremium: profileData.isPremium
      });
      
      // Check for stored biometric preference
      const storedBiometric = await AsyncStorage.getItem('@spendy_biometric_enabled');
      const biometricFromStorage = storedBiometric ? JSON.parse(storedBiometric) : false;
      const biometricFromUser = parsedUser.biometricEnabled || false;
      const finalBiometricSetting = biometricFromStorage || biometricFromUser;
      
      const user: User = {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.fullName,
        currency: profileData.currency,
        profilePicture: profileData.profileImage || (profileData as any).profilePicture,
        profileImage: profileData.profileImage || (profileData as any).profilePicture,
        isPremium: profileData.isPremium,
        biometricEnabled: finalBiometricSetting,
        country: parsedUser.country || 'US',
        mobile: (profileData as any).mobile || (profileData as any).phoneNumber || '',
        phoneNumber: (profileData as any).mobile || (profileData as any).phoneNumber || '',
        subscriptionStatus: profileData.isPremium ? 'premium' : 'expired',
        createdAt: parsedUser.createdAt ? new Date(parsedUser.createdAt) : new Date(),
        updatedAt: new Date(),
      };
      
      console.log('🔍 Session restore - setting user state:', {
        id: user.id,
        email: user.email,
        fullName: user.fullName
      });
      
      // Register push token with backend for notifications
      try {
        const { RealNotificationService } = await import('@/services/notifications/RealNotificationService');
        await RealNotificationService.registerTokenWithBackend(user.id);
        console.log('✅ Push token registered with backend after biometric restore');
      } catch (error) {
        console.error('⚠️ Failed to register push token after biometric restore:', error);
        // Don't fail restore if push token registration fails
      }
      
      setUser(user);
      console.log('✅ Session restored successfully after biometric auth with verified token');
    } catch (error) {
      console.error('❌ Failed to restore session after biometric auth:', error);
      // Clear any potentially corrupt auth data
      await clearAuthData();
      throw new Error('Authentication failed. Please login again.');
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
    updatePassword,
    resetPassword,
    uploadProfilePicture,
    deleteProfilePicture,
    restoreSessionFromBiometric,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
