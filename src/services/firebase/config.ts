// src/services/firebase/config.ts - Environment-aware Firebase initialization
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore, initializeFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { getDatabase, connectDatabaseEmulator, Database } from 'firebase/database';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ENV } from '../../config/environment';

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  database: Database;
  functions: Functions;
  storage: FirebaseStorage;
  messaging?: any;
}

class FirebaseConfig {
  private static instance: FirebaseConfig;
  private services: FirebaseServices | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): FirebaseConfig {
    if (!FirebaseConfig.instance) {
      FirebaseConfig.instance = new FirebaseConfig();
    }
    return FirebaseConfig.instance;
  }

  /**
   * Initialize Firebase with environment-specific configuration
   */
  async initialize(): Promise<FirebaseServices> {
    if (this.initialized && this.services) {
      return this.services;
    }

    console.log(`🔥 Initializing Firebase for: ${ENV.environment}`);

    // Get Firebase config from environment
    const firebaseConfig = ENV.firebase;
    
    // Initialize Firebase app
    let app: FirebaseApp;
    const existingApps = getApps();
    
    if (existingApps.length > 0) {
      app = existingApps[0];
      console.log('📱 Using existing Firebase app');
    } else {
      app = initializeApp(firebaseConfig);
      console.log('📱 Created new Firebase app');
    }

    // Initialize Firebase Auth
    let auth: Auth;
    try {
      auth = getAuth(app);
    } catch (error) {
      // If there's an issue, try initializing fresh
      auth = getAuth(app);
    }

    // Initialize Firestore with emulator awareness
    let firestore: Firestore;
    try {
      if (ENV.isLocal() && ENV.firebase.useEmulator) {
        // For emulator, initialize Firestore differently
        firestore = initializeFirestore(app, {
          host: `${ENV.getEmulatorHost('firestore')}:${ENV.getEmulatorPort('firestore')}`,
          ssl: false,
        });
      } else {
        firestore = getFirestore(app);
      }
    } catch (error) {
      // Fallback to regular initialization
      firestore = getFirestore(app);
    }

    // Initialize other services
    const database = getDatabase(app);
    const functions = getFunctions(app);
    const storage = getStorage(app);
    const messaging = Platform.OS === 'web' ? getMessaging(app) : null;

    // Connect to emulators if in local environment
    if (ENV.isLocal() && ENV.firebase.useEmulator) {
      await this.connectEmulators(auth, firestore, database, functions, storage);
    }

    this.services = {
      app,
      auth,
      firestore,
      database,
      functions,
      storage,
      messaging,
    };

    this.initialized = true;
    
    console.log(`✅ Firebase initialized successfully:`, {
      environment: ENV.environment,
      projectId: firebaseConfig.projectId,
      useEmulator: ENV.firebase.useEmulator,
    });

    return this.services;
  }

  /**
   * Connect services to Firebase emulators
   */
  private async connectEmulators(
    auth: Auth,
    firestore: Firestore,
    database: Database,
    functions: Functions,
    storage: FirebaseStorage
  ): Promise<void> {
    const emulators = ENV.getEmulatorConfig();

    if (!emulators) {
      console.warn('⚠️ No emulator configuration found');
      return;
    }

    try {
      // Connect Auth Emulator
      const authUrl = `http://${emulators.auth.host}:${emulators.auth.port}`;
      connectAuthEmulator(auth, authUrl, { disableWarnings: true });
      console.log(`🔐 Connected to Auth emulator: ${authUrl}`);

      // Note: Firestore emulator connection is handled during initialization

      // Connect Storage Emulator
      if (emulators.storage) {
        connectStorageEmulator(storage, emulators.storage.host, emulators.storage.port);
        console.log(`🗄️ Connected to Storage emulator: ${emulators.storage.host}:${emulators.storage.port}`);
      }

      // Connect Database Emulator
      if (emulators.database) {
        connectDatabaseEmulator(database, emulators.database.host, emulators.database.port);
        console.log(`💾 Connected to Database emulator: ${emulators.database.host}:${emulators.database.port}`);
      }

      // Connect Functions Emulator
      connectFunctionsEmulator(functions, emulators.functions.host, emulators.functions.port);
      console.log(`⚡ Connected to Functions emulator: ${emulators.functions.host}:${emulators.functions.port}`);

    } catch (error) {
      console.warn('⚠️ Some emulators could not be connected:', error);
      // Continue anyway - some emulators might already be connected
    }
  }

  /**
   * Get initialized Firebase services
   */
  getServices(): FirebaseServices {
    if (!this.services) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }
    return this.services;
  }

  /**
   * Reinitialize Firebase (useful for environment switching)
   */
  async reinitialize(): Promise<FirebaseServices> {
    console.log('🔄 Reinitializing Firebase...');
    this.initialized = false;
    this.services = null;
    return this.initialize();
  }
}

// Export singleton instance
export const firebaseConfig = FirebaseConfig.getInstance();

// Initialize and export services
let globalServices: FirebaseServices | null = null;

const initializeGlobalServices = async () => {
  if (!globalServices) {
    globalServices = await firebaseConfig.initialize();
  }
  return globalServices;
};

// Modern async exports
export const getFirebaseApp = async () => (await initializeGlobalServices()).app;
export const getFirebaseAuth = async () => (await initializeGlobalServices()).auth;
export const getFirebaseFirestore = async () => (await initializeGlobalServices()).firestore;
export const getFirebaseDatabase = async () => (await initializeGlobalServices()).database;
export const getFirebaseFunctions = async () => (await initializeGlobalServices()).functions;
export const getFirebaseStorage = async () => (await initializeGlobalServices()).storage;

// Legacy synchronous exports (for backward compatibility)
let legacyInitialized = false;
export let app: FirebaseApp;
export let auth: Auth;
export let db: Firestore;
export let database: Database;
export let functions: Functions;
export let storage: FirebaseStorage;
export let messaging: any;

// Auto-initialize legacy exports
const initializeLegacyExports = async () => {
  if (!legacyInitialized) {
    try {
      const services = await initializeGlobalServices();
      app = services.app;
      auth = services.auth;
      db = services.firestore;
      database = services.database;
      functions = services.functions;
      storage = services.storage;
      messaging = services.messaging;
      legacyInitialized = true;
      
      if (__DEV__) {
        console.log(`🔧 Firebase initialized in ${ENV.environment} mode`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
      throw error;
    }
  }
};

// Initialize on module load for backward compatibility
initializeLegacyExports().catch(console.error);

// Export types
export type { FirebaseServices };