const { DatabaseService, COLLECTIONS } = require('./dist/config/database');

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test creating a simple document
    const testData = {
      name: 'test',
      description: 'test description',
      currency: 'USD'
    };
    
    const docId = await DatabaseService.createDocument(COLLECTIONS.GROUPS, testData);
    console.log('✅ Successfully created test document with ID:', docId);
    
    // Test reading the document back
    const doc = await DatabaseService.getDocument(COLLECTIONS.GROUPS, docId);
    console.log('✅ Successfully read document:', doc);
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

testDatabase();
