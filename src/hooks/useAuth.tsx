import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { AuthService } from '@/services/firebase/auth';
import { User } from '@/types';

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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    // Listen to auth state changes
    const unsubscribe = AuthService.onAuthStateChanged((user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
      setUser(user);
      setIsLoading(false);
    });

    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('Attempting login...');
      const userData = await AuthService.login(email, password);
      setUser(userData);
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
    const { password, ...userDataWithoutPassword } = userData;
    const newUser = await AuthService.register(userDataWithoutPassword, password);
    setUser(newUser);
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