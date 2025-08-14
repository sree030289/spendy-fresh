// Test script to verify Firestore indexes are working in dev environment
const admin = require('firebase-admin');

// Initialize Firebase Admin for dev project
const devConfig = {
  projectId: 'spendy-develop'
};

const app = admin.initializeApp(devConfig, 'dev-test');
const db = admin.firestore(app);

// Test queries that should use the deployed indexes
const testQueries = [
  {
    name: 'Expenses by groupId and createdAt',
    collection: 'expenses',
    query: (ref) => ref.where('groupId', '==', 'test-group').orderBy('createdAt', 'desc').limit(10)
  },
  {
    name: 'Friends by userId and lastActivity',
    collection: 'friends', 
    query: (ref) => ref.where('userId', '==', 'test-user').orderBy('lastActivity', 'desc').limit(10)
  },
  {
    name: 'Notifications by userId and createdAt',
    collection: 'notifications',
    query: (ref) => ref.where('userId', '==', 'test-user').orderBy('createdAt', 'desc').limit(10)
  },
  {
    name: 'Friend requests by status and toUserId', 
    collection: 'friendRequests',
    query: (ref) => ref.where('status', '==', 'pending').where('toUserId', '==', 'test-user').orderBy('createdAt', 'desc').limit(10)
  },
  {
    name: 'Groups by members array and isActive',
    collection: 'groups',
    query: (ref) => ref.where('members', 'array-contains', 'test-user').where('isActive', '==', true).orderBy('updatedAt', 'desc').limit(10)
  },
  {
    name: 'Smart transactions by userId and date',
    collection: 'smartTransactions',
    query: (ref) => ref.where('userId', '==', 'test-user').orderBy('date', 'desc').limit(10)
  },
  {
    name: 'Reminders by userId and dueDate',
    collection: 'reminders',
    query: (ref) => ref.where('userId', '==', 'test-user').orderBy('dueDate', 'asc').limit(10)
  }
];

async function testIndexes() {
  console.log('🔍 Testing Firestore indexes in development environment...\n');
  
  let passedTests = 0;
  let totalTests = testQueries.length;
  
  for (const test of testQueries) {
    try {
      console.log(`📊 Testing: ${test.name}`);
      
      const startTime = Date.now();
      const query = test.query(db.collection(test.collection));
      
      // Execute the query
      const snapshot = await query.get();
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${test.name}: SUCCESS (${duration}ms, ${snapshot.docs.length} docs)`);
      passedTests++;
      
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED`);
      console.log(`   Error: ${error.message}`);
      
      if (error.message.includes('index')) {
        console.log(`   🔧 This query requires an index that may still be building...`);
      }
    }
    console.log(''); // Empty line for readability
  }
  
  console.log('📈 Index Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All indexes are working correctly!');
    console.log('🚀 Your dev environment is ready for testing!');
  } else {
    console.log('⚠️  Some indexes may still be building. This is normal and can take a few minutes.');
    console.log('💡 Try running this test again in 2-3 minutes.');
  }
  
  console.log(`\n🔗 Monitor index build status:`);
  console.log(`https://console.firebase.google.com/project/spendy-develop/firestore/indexes`);
}

// Run the tests
testIndexes()
  .then(() => {
    console.log('\n✨ Index testing completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error running index tests:', error);
    process.exit(1);
  });