import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
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

export const app = initializeApp(firebaseConfig);

// Fix for React Native
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);