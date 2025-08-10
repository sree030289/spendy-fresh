// Global teardown for Playwright tests
// This runs once after all tests

async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  console.log('📊 Test suite completed');
}

module.exports = globalTeardown;
