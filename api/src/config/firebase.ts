// src/config/firebase.ts
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'spendy-97913',
    databaseURL: 'https://spendy-97913-default-rtdb.firebaseio.com',
    storageBucket: 'spendy-97913.firebasestorage.app'
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
export const messaging = admin.messaging();

// Firestore settings for better performance
db.settings({
  ignoreUndefinedProperties: true
});

export default admin;
