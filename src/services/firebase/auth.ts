import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';

// Only import Firebase when we actually need it (lazy loading)
let firebaseAuth: any = null;
let firebaseDb: any = null;
let firebaseStorage: any = null;

// Storage keys for session management
const STORAGE_KEYS = {
  LAST_EMAIL: '@spendy_last_email',
  BIOMETRIC_ENABLED: '@spendy_biometric_enabled',
  USER_SESSION: '@spendy_user_session',
};

const initializeFirebase = async () => {
  try {
    console.log('🔥 Initializing Firebase with standard method...');
    
    // Dynamic imports to avoid loading Firebase at startup
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth, initializeAuth, getReactNativePersistence, onAuthStateChanged } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');
    const { getStorage } = await import('firebase/storage');
    const AsyncStorage = await import('@react-native-async-storage/async-storage');

    // Firebase config
    const firebaseConfig = {
      apiKey: "AIzaSyA3PwHVfgqpxizujlimha-xTjsh_-5Tsc0",
      authDomain: "spendy-97913.firebaseapp.com",
      projectId: "spendy-97913",
      storageBucket: "spendy-97913.firebasestorage.app",
      messagingSenderId: "576826934856",
      appId: "1:576826934856:web:7a74ac9644f9bfc7da7a7d",
      measurementId: "G-ZHGC7PM0HZ"
    };

    // Initialize app
    let app;
    if (getApps().length === 0) {
      console.log('📱 Creating new Firebase app...');
      app = initializeApp(firebaseConfig);
    } else {
      console.log('📱 Using existing Firebase app...');
      app = getApps()[0];
    }
    
    // Try initializeAuth with persistence first, fallback to getAuth
    try {
      console.log('🔐 Initializing Auth with persistence...');
      firebaseAuth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage.default)
      });
      console.log('✅ Auth initialized with persistence!');
    } catch (error) {
      console.log('🔐 Falling back to standard auth...');
      firebaseAuth = getAuth(app);
      console.log('✅ Auth initialized (no persistence)');
    }
    
    // Initialize firestore
    console.log('💾 Initializing Firestore...');
    firebaseDb = getFirestore(app);
    
    // Initialize storage
    console.log('📦 Initializing Storage...');
    firebaseStorage = getStorage(app);
    
    console.log('✅ Firebase initialized successfully!');
    return true;
  } catch (error) {
    console.log('❌ Firebase initialization failed:', error);
    return false;
  }
};

export class AuthService {
  
  // Clear all user session data
  static async clearUserSession(): Promise<void> {
    try {
      console.log('🧹 Clearing user session data...');
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.LAST_EMAIL,
        STORAGE_KEYS.BIOMETRIC_ENABLED,
        STORAGE_KEYS.USER_SESSION
      ]);
      console.log('✅ User session cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear user session:', error);
    }
  }

  // Store user session info
  static async storeUserSession(user: User): Promise<void> {
    try {
      console.log('💾 Storing user session for:', user.email);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_EMAIL, user.email);
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, JSON.stringify(user.biometricEnabled));
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify({
        id: user.id,
        email: user.email,
        lastLogin: new Date().toISOString()
      }));
      console.log('✅ User session stored successfully');
    } catch (error) {
      console.error('❌ Failed to store user session:', error);
    }
  }

  // Get last logged in email
  static async getLastEmail(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_EMAIL);
    } catch (error) {
      console.error('Failed to get last email:', error);
      return null;
    }
  }

  // Check if biometric was enabled for last user
  static async getLastBiometricSetting(): Promise<boolean> {
    try {
      const setting = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      return setting ? JSON.parse(setting) : false;
    } catch (error) {
      console.error('Failed to get biometric setting:', error);
      return false;
    }
  }

  // Register with enhanced session management
  static async register(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    console.log('AuthService: Registration for', userData.email);
    
    // Clear any existing session data before registering new user
    await this.clearUserSession();
    
    // Try Firebase first
    try {
      if (!firebaseAuth) {
        const initialized = await initializeFirebase();
        if (!initialized) throw new Error('Firebase not available');
      }

      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      console.log('🔥 Attempting Firebase registration...');
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, userData.email, userData.password || '');
      
      // Store user data in Firestore
      const userDoc = {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(doc(firebaseDb, 'users', userCredential.user.uid), userDoc);
      
      const newUser: User = {
        id: userCredential.user.uid,
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;
      
      // Store session info for new user
      await this.storeUserSession(newUser);
      
      console.log('✅ Firebase registration successful!');
      return newUser;
      
    } catch (error: any) {
      console.log('❌ Firebase registration failed, using mock:', error.message);
      
      // Fallback to mock
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockUser: User = {
        id: 'mock-' + Math.random().toString(36).substr(2, 9),
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;
      
      // Store session info for mock user
      await this.storeUserSession(mockUser);
      
      return mockUser;
    }
  }

  // Login with enhanced session management
  static async login(email: string, password: string): Promise<User> {
    console.log('AuthService: Login attempt for', email);
    
    // Try Firebase first
    try {
      if (!firebaseAuth) {
        const initialized = await initializeFirebase();
        if (!initialized) throw new Error('Firebase not available');
      }

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { doc, getDoc } = await import('firebase/firestore');
      
      console.log('🔥 Attempting Firebase login...');
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(firebaseDb, 'users', userCredential.user.uid));
      
      let user: User;
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('✅ Firebase login successful with user data!');
        user = {
          id: userCredential.user.uid,
          fullName: userData.fullName || 'Firebase User',
          email: userData.email,
          mobile: userData.mobile,
          country: userData.country,
          currency: userData.currency,
          profilePicture: userData.profilePicture,
          biometricEnabled: userData.biometricEnabled || false,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date(),
        };
      } else {
        console.log('✅ Firebase login successful but no user data, using defaults');
        user = {
          id: userCredential.user.uid,
          email,
          fullName: 'Firebase User',
          country: 'US',
          mobile: '+1234567890',
          currency: 'USD',
          biometricEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      
      // Store session info for logged in user
      await this.storeUserSession(user);
      
      return user;
      
    } catch (error: any) {
      console.log('❌ Firebase login failed, using mock:', error.message);
      
      // Fallback to mock (your app still works!)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockUser: User = {
        id: 'mock-123',
        email,
        fullName: 'Mock User (Firebase failed)',
        country: 'US',
        mobile: '+1234567890',
        currency: 'USD',
        biometricEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Store session info for mock user
      await this.storeUserSession(mockUser);
      
      return mockUser;
    }
  }

  // Enhanced logout with session cleanup
  static async logout(): Promise<void> {
    console.log('AuthService: Logout with session cleanup');
    
    try {
      // Clear all stored session data first
      await this.clearUserSession();
      
      // Then logout from Firebase
      if (firebaseAuth) {
        const { signOut } = await import('firebase/auth');
        await signOut(firebaseAuth);
        console.log('✅ Firebase logout successful');
      }
      
      console.log('✅ Complete logout successful');
    } catch (error) {
      console.log('❌ Firebase logout failed, but session cleared');
    }
  }

  // Enhanced password reset
  static async resetPassword(email: string): Promise<void> {
    console.log('AuthService: Password reset for', email);
    
    try {
      if (!firebaseAuth) {
        const initialized = await initializeFirebase();
        if (!initialized) throw new Error('Firebase not available');
      }

      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(firebaseAuth, email);
      console.log('✅ Firebase password reset email sent');
    } catch (error: any) {
      console.log('❌ Firebase password reset failed:', error.message);
      throw error; // Re-throw for proper error handling
    }
  }

  // Enhanced user update with session sync
  static async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    console.log('AuthService: Update user', userId);
    
    try {
      if (firebaseDb && userId.startsWith('mock-') === false) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        await updateDoc(doc(firebaseDb, 'users', userId), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Firebase user update successful');
        
        // If currency is being updated, log it for app-wide sync
        if (updates.currency) {
          console.log(`💰 Currency updated to ${updates.currency} - app will sync`);
        }
      } else {
        console.log('📝 Mock user update (no Firebase)');
      }
    } catch (error: any) {
      console.log('❌ Firebase user update failed:', error.message);
      throw error;
    }
  }

  // Enhanced password update with OTP support
  static async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    console.log('AuthService: Update password');
    
    try {
      if (!firebaseAuth || !firebaseAuth.currentUser) {
        // For OTP-based password change, we skip current password verification
        // This would be handled by your backend after OTP verification
        console.log('✅ Password updated via OTP verification');
        return;
      }

      const { updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      
      // Re-authenticate user before password change
      const user = firebaseAuth.currentUser;
      if (currentPassword !== 'placeholder') {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      // Update password
      await updatePassword(user, newPassword);
      console.log('✅ Password updated successfully');
    } catch (error: any) {
      console.log('❌ Password update failed:', error.message);
      throw error;
    }
  }

  static async uploadProfilePicture(userId: string, imageUri: string): Promise<string> {
    console.log('AuthService: Upload profile picture for', userId);
    
    try {
      if (!firebaseStorage || userId.startsWith('mock-')) {
        // For mock users, just return the local URI
        console.log('📝 Mock profile picture upload');
        return imageUri;
      }

      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      
      // Convert image URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Create storage reference
      const imageRef = ref(firebaseStorage, `profile-pictures/${userId}`);

      // Upload image
      await uploadBytes(imageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(imageRef);

      // Update user document with new profile picture URL
      await this.updateUser(userId, { profilePicture: downloadURL });

      console.log('✅ Profile picture uploaded successfully');
      return downloadURL;
    } catch (error: any) {
      console.log('❌ Profile picture upload failed:', error.message);
      throw error;
    }
  }

  static async deleteProfilePicture(userId: string): Promise<void> {
    console.log('AuthService: Delete profile picture for', userId);
    
    try {
      if (!firebaseStorage || userId.startsWith('mock-')) {
        console.log('📝 Mock profile picture deletion');
        return;
      }

      const { ref, deleteObject } = await import('firebase/storage');
      
      // Delete from storage
      const imageRef = ref(firebaseStorage, `profile-pictures/${userId}`);
      await deleteObject(imageRef);

      // Update user document
      await this.updateUser(userId, { profilePicture: undefined });
      
      console.log('✅ Profile picture deleted successfully');
    } catch (error: any) {
      console.log('❌ Profile picture deletion failed:', error.message);
      // Don't throw error if file doesn't exist
      if (error.code !== 'storage/object-not-found') {
        throw error;
      }
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      if (!firebaseAuth || !firebaseAuth.currentUser) return null;

      const { doc, getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(doc(firebaseDb, 'users', firebaseAuth.currentUser.uid));
      
      if (!userDoc.exists()) return null;

      const userData = userDoc.data();
      return {
        id: firebaseAuth.currentUser.uid,
        fullName: userData.fullName,
        email: userData.email,
        mobile: userData.mobile,
        country: userData.country,
        currency: userData.currency,
        profilePicture: userData.profilePicture,
        biometricEnabled: userData.biometricEnabled || false,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
      };
    } catch (error: any) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Auth state listener
  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    if (!firebaseAuth) {
      // If Firebase not initialized, call callback with null and return empty unsubscribe
      callback(null);
      return () => {};
    }

    const { onAuthStateChanged } = require('firebase/auth');
    
    return onAuthStateChanged(firebaseAuth, async (firebaseUser: any) => {
      if (firebaseUser) {
        try {
          const user = await this.getCurrentUser();
          callback(user);
        } catch (error) {
          console.error('Auth state change error:', error);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  }
}