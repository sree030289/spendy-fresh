import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyA3PwHVfgqpxizujlimha-xTjsh_-5Tsc0",
  authDomain: "spendy-97913.firebaseapp.com",
  projectId: "spendy-97913",
  storageBucket: "spendy-97913.firebasestorage.app",
  messagingSenderId: "576826934856",
  appId: "1:576826934856:web:7a74ac9644f9bfc7da7a7d",
  measurementId: "G-ZHGC7PM0HZ"
};

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