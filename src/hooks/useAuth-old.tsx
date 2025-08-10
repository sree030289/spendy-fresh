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
          // Verify token is still valid by getting profile
          const profileData = await apiService.getProfile();
          const parsedUser = JSON.parse(userData);
          
          // Convert API response to User type
          const user: User = {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.fullName,
            currency: profileData.currency,
            profilePicture: profileData.profileImage,
            profileImage: profileData.profileImage,
            isPremium: profileData.isPremium,
            biometricEnabled: parsedUser.biometricEnabled || false,
            country: parsedUser.country || 'US',
            mobile: parsedUser.mobile || '',
            phoneNumber: parsedUser.mobile || '',
            subscriptionStatus: profileData.isPremium ? 'premium' : 'expired',
            createdAt: parsedUser.createdAt ? new Date(parsedUser.createdAt) : new Date(),
            updatedAt: new Date(),
          };
          
          setUser(user);
          console.log('Auth state restored for user:', user.email);
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
        profilePicture: response.user.profileImage,
        profileImage: response.user.profileImage,
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
      await apiService.logout();
      await clearAuthData();
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

  const logout = async () => {
    try {
      setIsLoading(true);
      console.log('Attempting logout...');
      await AuthService.logout();
      setUser(null);
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
      console.log('Updating user profile...');
      await AuthService.updateUser(user.id, updates);
      // Update local user state
      setUser(prev => prev ? { ...prev, ...updates, updatedAt: new Date() } : null);
      console.log('User profile updated');
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    try {
      console.log('Updating password...');
      await AuthService.updatePassword(currentPassword, newPassword);
      console.log('Password updated');
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('Sending password reset email...');
      await AuthService.resetPassword(email);
      console.log('Password reset email sent');
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const uploadProfilePicture = async (imageUri: string) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      console.log('Uploading profile picture...');
      const downloadURL = await AuthService.uploadProfilePicture(user.id, imageUri);
      setUser(prev => prev ? { ...prev, profilePicture: downloadURL, updatedAt: new Date() } : null);
      console.log('Profile picture uploaded');
      return downloadURL;
    } catch (error) {
      console.error('Upload profile picture error:', error);
      throw error;
    }
  };

  const deleteProfilePicture = async () => {
    if (!user) throw new Error('No user logged in');
    
    try {
      console.log('Deleting profile picture...');
      await AuthService.deleteProfilePicture(user.id);
      setUser(prev => prev ? { ...prev, profilePicture: undefined, updatedAt: new Date() } : null);
      console.log('Profile picture deleted');
    } catch (error) {
      console.error('Delete profile picture error:', error);
      throw error;
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};