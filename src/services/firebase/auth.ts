import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  User as FirebaseUser,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './config';
import { User } from '@/types';

export class AuthService {
  // Register new user
  static async register(userData: {
    fullName: string;
    email: string;
    mobile: string;
    password: string;
    country: string;
    currency: string;
    biometricEnabled: boolean;
  }): Promise<User> {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        userData.email, 
        userData.password
      );
      
      const firebaseUser = userCredential.user;
      
      // Update Firebase Auth profile
      await updateProfile(firebaseUser, {
        displayName: userData.fullName
      });

      // Create user document in Firestore
      const userDoc: Omit<User, 'id'> = {
        fullName: userData.fullName,
        email: userData.email,
        mobile: userData.mobile,
        country: userData.country,
        currency: userData.currency,
        biometricEnabled: userData.biometricEnabled,
        profilePicture: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        ...userDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        id: firebaseUser.uid,
        ...userDoc,
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Login user
  static async login(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists()) {
        throw new Error('User data not found');
      }

      const userData = userDoc.data();
      return {
        id: firebaseUser.uid,
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
      console.error('Login error:', error);
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Logout user
  static async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout');
    }
  }

  // Send password reset email
  static async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Update user profile
  static async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      
      // Prepare updates object
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      // Remove id and timestamps from updates
      delete updateData.id;
      delete updateData.createdAt;

      await updateDoc(userRef, updateData);

      // Update Firebase Auth profile if fullName is being updated
      if (updates.fullName && auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: updates.fullName
        });
      }
    } catch (error: any) {
      console.error('Update user error:', error);
      throw new Error('Failed to update profile');
    }
  }

  // Update password
  static async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
    } catch (error: any) {
      console.error('Password update error:', error);
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Upload profile picture
  static async uploadProfilePicture(userId: string, imageUri: string): Promise<string> {
    try {
      // Convert image URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Create storage reference
      const imageRef = ref(storage, `profile-pictures/${userId}`);

      // Upload image
      await uploadBytes(imageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(imageRef);

      // Update user document with new profile picture URL
      await this.updateUser(userId, { profilePicture: downloadURL });

      return downloadURL;
    } catch (error: any) {
      console.error('Profile picture upload error:', error);
      throw new Error('Failed to upload profile picture');
    }
  }

  // Delete profile picture
  static async deleteProfilePicture(userId: string): Promise<void> {
    try {
      // Delete from storage
      const imageRef = ref(storage, `profile-pictures/${userId}`);
      await deleteObject(imageRef);

      // Update user document
      await this.updateUser(userId, { profilePicture: undefined });
    } catch (error: any) {
      console.error('Profile picture deletion error:', error);
      // Don't throw error if file doesn't exist
      if (error.code !== 'storage/object-not-found') {
        throw new Error('Failed to delete profile picture');
      }
    }
  }

  // Get current user from Firestore
  static async getCurrentUser(): Promise<User | null> {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return null;

      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) return null;

      const userData = userDoc.data();
      return {
        id: firebaseUser.uid,
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

  // Listen to auth state changes
  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, async (firebaseUser) => {
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

  // Helper method to convert Firebase error codes to user-friendly messages
  private static getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters';
      case 'auth/invalid-email':
        return 'Please enter a valid email address';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection';
      case 'auth/requires-recent-login':
        return 'Please log in again to complete this action';
      default:
        return 'An error occurred. Please try again';
    }
  }
}