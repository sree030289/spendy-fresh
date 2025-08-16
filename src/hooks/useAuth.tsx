import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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
            profilePicture: profileData.profileImage,
            profileImage: profileData.profileImage,
            isPremium: profileData.isPremium,
            biometricEnabled: finalBiometricSetting,
            country: parsedUser.country || 'US',
            mobile: parsedUser.mobile || '',
            phoneNumber: parsedUser.mobile || '',
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
        profilePicture: response.user.profileImage,
        profileImage: response.user.profileImage,
        isPremium: response.user.isPremium,
        biometricEnabled: false, // Will be updated from stored preferences
        country: 'US', // Default, will be updated from profile
        mobile: '', // Will be updated from profile
        phoneNumber: '', // Will be updated from profile
        subscriptionStatus: response.user.isPremium ? 'premium' : 'expired',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store user data
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      
      // Store user session info
      await apiService.storeUserSession(user);
      
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
      // For now, just update locally since we don't have update endpoint yet
      // TODO: Implement update user API endpoint
      const updatedUser = { ...user, ...updates, updatedAt: new Date() };
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
      
      // If biometric setting is being updated, save it in both formats
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
        await apiService.storeUserSession(updatedUser);
        
        console.log('✅ Biometric preference updated successfully');
      }
      
      setUser(updatedUser);
      console.log('User updated successfully');
    } catch (error) {
      console.error('Update user error:', error);
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
      
      // Get stored user data and token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        
        // Try to get fresh profile data
        try {
          const profileData = await apiService.getProfile();
          
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
            profilePicture: profileData.profileImage,
            profileImage: profileData.profileImage,
            isPremium: profileData.isPremium,
            biometricEnabled: finalBiometricSetting,
            country: parsedUser.country || 'US',
            mobile: parsedUser.mobile || '',
            phoneNumber: parsedUser.mobile || '',
            subscriptionStatus: profileData.isPremium ? 'premium' : 'expired',
            createdAt: parsedUser.createdAt ? new Date(parsedUser.createdAt) : new Date(),
            updatedAt: new Date(),
          };
          
          setUser(user);
          console.log('✅ Session restored successfully after biometric auth');
        } catch (error) {
          // If API call fails, use stored data
          console.log('⚠️ Using stored user data after biometric auth');
          setUser(parsedUser);
        }
      }
    } catch (error) {
      console.error('❌ Failed to restore session after biometric auth:', error);
      throw error;
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
