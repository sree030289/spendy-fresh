import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// Initialize Firebase Auth
export const auth = getAuth(app);

export const db = getFirestore(app);
export const storage = getStorage(app);