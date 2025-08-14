import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { firebaseDevConfig } from '../../config/firebase.dev';
import { firebaseProdConfig } from '../../config/firebase.prod';

// OPTIMIZATION: Environment-based configuration for cost management
const getFirebaseConfig = () => {
  const environment = process.env.NODE_ENV || 'development';
  const buildType = process.env.EXPO_PUBLIC_BUILD_TYPE || 'dev';
  
  console.log('🔧 Firebase Environment:', environment, 'Build:', buildType);
  
  // Use dev config for development builds (but respect prod override)
  if (buildType === 'dev' || (environment === 'development' && buildType !== 'prod')) {
    console.log('🔧 Using DEVELOPMENT Firebase project');
    return firebaseDevConfig;
  }
  
  // Use production config for production builds
  console.log('🔧 Using PRODUCTION Firebase project');
  return firebaseProdConfig;
};

// Get environment-specific config
const firebaseConfig = getFirebaseConfig();

export const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with proper React Native persistence
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    // If already initialized, use getAuth
    auth = getAuth(app);
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize messaging for web only
export const messaging = Platform.OS === 'web' ? getMessaging(app) : null;

// Optional: Reduce Firestore connection warnings in development
if (__DEV__) {
  console.log('🔧 Firebase initialized in development mode');
}