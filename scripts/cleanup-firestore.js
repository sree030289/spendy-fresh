#!/usr/bin/env node
/**
 * Firebase Firestore Cleanup Script
 * Clears test data while preserving configuration
 * 
 * Usage: node scripts/cleanup-firestore.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin
const serviceAccount = require('../functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://spendy-97913-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

// Collections to KEEP (configuration data)
const KEEP_COLLECTIONS = [
  'appConfig',
  'systemConfig',
  'subscriptionPlans',
  'couponCodes',
  'merchantCategories',
  'currencies',
  'paymentMethods',
  'settings'
];

// Collections to DELETE (user/test data)
const DELETE_COLLECTIONS = [
  'users',
  'expenses',
  'groups',
  'groupMembers',
  'groupMessages',
  'notifications',
  'appNotifications',
  'qrCodes',
  'sessions',
  'invitations',
  'settlements',
  'receipts',
  'transactions',
  'balances',
  'reminders',
  'bankAccounts',
  'bankTransactions',
  'payments',
  'subscriptions',
  'profiles',
  'friends',
  'activities',
  'analytics'
];

// Helper function to delete collection in batches
async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid exploding the stack
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

// Confirm with user before deleting
function confirmDeletion() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🔥 FIREBASE FIRESTORE CLEANUP');
    console.log('==============================\n');
    console.log('✅ Will KEEP these collections:');
    KEEP_COLLECTIONS.forEach(col => console.log(`   - ${col}`));
    console.log('\n❌ Will DELETE all data from:');
    DELETE_COLLECTIONS.forEach(col => console.log(`   - ${col}`));
    console.log('\n⚠️  WARNING: This action cannot be undone!\n');

    rl.question('Are you sure you want to proceed? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

// Main cleanup function
async function cleanup() {
  const confirmed = await confirmDeletion();

  if (!confirmed) {
    console.log('\n❌ Cleanup cancelled.');
    process.exit(0);
  }

  console.log('\n🧹 Starting cleanup...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const collection of DELETE_COLLECTIONS) {
    try {
      console.log(`🗑️  Deleting collection: ${collection}...`);
      await deleteCollection(collection);
      console.log(`✅ Deleted: ${collection}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error deleting ${collection}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n==============================');
  console.log('🎉 Cleanup Complete!');
  console.log(`✅ Successfully deleted: ${successCount} collections`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} collections`);
  }
  console.log('==============================\n');

  process.exit(0);
}

// Run cleanup
cleanup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
