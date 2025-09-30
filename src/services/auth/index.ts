// src/services/auth/index.ts - Environment-aware authentication service
import { 
  Auth, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  UserCredential
} from 'firebase/auth';
import { getFirebaseAuth } from '../firebase/config';
import { ENV } from '../../config/environment';

class AuthService {
  private static instance: AuthService;
  private auth: Auth | null = null;
  private currentUser: User | null = null;
  private authStateListeners: Array<(user: User | null) => void> = [];

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize the authentication service
   */
  async initialize(): Promise<void> {
    if (!this.auth) {
      this.auth = await getFirebaseAuth();
      
      // Set up auth state listener
      onAuthStateChanged(this.auth, (user) => {
        this.currentUser = user;
        this.notifyAuthStateListeners(user);
      });
      
      console.log(`🔐 Auth service initialized for: ${ENV.environment}`);
      
      if (ENV.firebase.useEmulator) {
        console.log('🔐 Using Firebase Auth Emulator');
      }
    }
  }

  /**
   * Get Auth instance
   */
  private async getAuth(): Promise<Auth> {
    if (!this.auth) {
      await this.initialize();
    }
    return this.auth!;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<UserCredential> {
    const auth = await this.getAuth();
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    console.log(`✅ User signed in: ${result.user.email} (${ENV.environment})`);
    return result;
  }

  /**
   * Create account with email and password
   */
  async signUp(email: string, password: string, displayName?: string): Promise<UserCredential> {
    const auth = await this.getAuth();
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile if display name provided
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }
    
    console.log(`✅ User created: ${result.user.email} (${ENV.environment})`);
    return result;
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    const auth = await this.getAuth();
    await firebaseSignOut(auth);
    console.log(`👋 User signed out (${ENV.environment})`);
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    const auth = await this.getAuth();
    await sendPasswordResetEmail(auth, email);
    console.log(`📧 Password reset sent to: ${email} (${ENV.environment})`);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    const auth = await this.getAuth();
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, updates);
      console.log(`👤 Profile updated (${ENV.environment})`);
    } else {
      throw new Error('No user is currently signed in');
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if user is signed in
   */
  isSignedIn(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Add auth state change listener
   */
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.authStateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all auth state listeners
   */
  private notifyAuthStateListeners(user: User | null): void {
    this.authStateListeners.forEach(callback => callback(user));
  }

  /**
   * Get current user ID token
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (this.currentUser) {
      return await this.currentUser.getIdToken(forceRefresh);
    }
    return null;
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo() {
    return {
      environment: ENV.environment,
      projectId: ENV.firebase.projectId,
      useEmulator: ENV.firebase.useEmulator,
      authDomain: ENV.firebase.authDomain,
    };
  }

  /**
   * Force refresh current user token
   */
  async refreshToken(): Promise<string | null> {
    return this.getIdToken(true);
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();

// Export convenience methods
export const initializeAuth = () => authService.initialize();
export const signIn = (email: string, password: string) => authService.signIn(email, password);
export const signUp = (email: string, password: string, displayName?: string) => 
  authService.signUp(email, password, displayName);
export const signOut = () => authService.signOut();
export const resetPassword = (email: string) => authService.resetPassword(email);
export const getCurrentUser = () => authService.getCurrentUser();
export const isSignedIn = () => authService.isSignedIn();
export const onAuthStateChange = (callback: (user: User | null) => void) => 
  authService.onAuthStateChange(callback);

// Export the class for advanced usage
export { AuthService };
export type { User, UserCredential };
