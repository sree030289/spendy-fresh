import { User } from '@/types';

// Only import Firebase when we actually need it (lazy loading)
let firebaseAuth: any = null;
let firebaseDb: any = null;
let firebaseStorage: any = null;

const initializeFirebase = async () => {
  try {
    console.log('🔥 Initializing Firebase with standard method...');
    
    // Dynamic imports to avoid loading Firebase at startup
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth, initializeAuth, getReactNativePersistence, onAuthStateChanged } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');
    const { getStorage } = await import('firebase/storage');
    const AsyncStorage = await import('@react-native-async-storage/async-storage');

    // UPDATE THIS WITH YOUR NEW FIREBASE CONFIG
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
  static async register(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    console.log('AuthService: Registration for', userData.email);
    
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
      await setDoc(doc(firebaseDb, 'users', userCredential.user.uid), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Firebase registration successful!');
      return {
        id: userCredential.user.uid,
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;
      
    } catch (error: any) {
      console.log('❌ Firebase registration failed, using mock:', error.message);
      
      // Fallback to mock
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        id: 'mock-' + Math.random().toString(36).substr(2, 9),
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;
    }
  }

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
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('✅ Firebase login successful with user data!');
        return {
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
        return {
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
      
    } catch (error: any) {
      console.log('❌ Firebase login failed, using mock:', error.message);
      
      // Fallback to mock (your app still works!)
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
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
    }
  }

  static async logout(): Promise<void> {
    console.log('AuthService: Logout');
    
    try {
      if (firebaseAuth) {
        const { signOut } = await import('firebase/auth');
        await signOut(firebaseAuth);
        console.log('✅ Firebase logout successful');
      }
    } catch (error) {
      console.log('❌ Firebase logout failed, continuing anyway');
    }
    
    return Promise.resolve();
  }

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
      } else {
        console.log('📝 Mock user update (no Firebase)');
      }
    } catch (error: any) {
      console.log('❌ Firebase user update failed:', error.message);
      throw error;
    }
  }

  static async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    console.log('AuthService: Update password');
    
    try {
      if (!firebaseAuth || !firebaseAuth.currentUser) {
        throw new Error('No authenticated user found');
      }

      const { updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      
      // Re-authenticate user before password change
      const user = firebaseAuth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

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