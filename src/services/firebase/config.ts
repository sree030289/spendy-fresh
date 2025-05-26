import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAtKKNld9WzD5YsIPUQGlqVbLObaRzwvyE",
  authDomain: "finmate-729ca.firebaseapp.com",
  projectId: "finmate-729ca",
  storageBucket: "finmate-729ca.appspot.com",
  messagingSenderId: "394481474931",
  appId: "1:394481474931:web:8a7481df9a39e2723cf906"
};

// Initialize Firebase only once
let firebaseApp;
let firebaseAuth;
let firebaseDb;
let firebaseStorage;

export const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (getApps().length === 0) {
      console.log('Initializing Firebase...');
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      console.log('Firebase already initialized');
      firebaseApp = getApp();
    }

    // Initialize Auth with React Native persistence
    try {
      firebaseAuth = getAuth(firebaseApp);
    } catch (error) {
      console.log('Reinitializing Auth with React Native persistence...');
      firebaseAuth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    }

    // Initialize Firestore
    firebaseDb = getFirestore(firebaseApp);

    // Initialize Storage
    firebaseStorage = getStorage(firebaseApp);

    console.log('Firebase initialized successfully');
    
    return { 
      app: firebaseApp, 
      auth: firebaseAuth, 
      db: firebaseDb, 
      storage: firebaseStorage 
    };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

// Initialize immediately and export
const firebaseServices = initializeFirebase();

export const app = firebaseServices.app;
export const auth = firebaseServices.auth;
export const db = firebaseServices.db;
export const storage = firebaseServices.storage;