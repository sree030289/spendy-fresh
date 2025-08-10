#!/usr/bin/env node

/**
 * Spendy API Test Runner
 * Cross-platform script to run all API tests with fresh data
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

class TestRunner {
  constructor() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logStatus(message) {
    this.log(`[INFO] ${message}`, 'blue');
  }

  logSuccess(message) {
    this.log(`[SUCCESS] ${message}`, 'green');
  }

  logWarning(message) {
    this.log(`[WARNING] ${message}`, 'yellow');
  }

  logError(message) {
    this.log(`[ERROR] ${message}`, 'red');
  }

  async checkFirebaseEmulator() {
    this.logStatus('Checking if Firebase emulator is running...');
    
    try {
      const response = await fetch('http://127.0.0.1:5001/spendy-97913/us-central1/spendyApi/health');
      if (response.ok) {
        this.logSuccess('Firebase emulator is running ✅');
        return true;
      }
    } catch (error) {
      // Emulator not running
    }
    
    this.logError('Firebase emulator is not running ❌');
    this.logWarning('Please start the Firebase emulator first:');
    console.log('  cd functions && npm run serve');
    return false;
  }

  async runTestSuite(testName, testFile) {
    this.logStatus(`Running ${testName} tests...`);
    
    try {
      execSync(`npx playwright test "${testFile}" --reporter=list --workers=1`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      this.logSuccess(`${testName} tests passed ✅`);
      return true;
    } catch (error) {
      this.logError(`${testName} tests failed ❌`);
      return false;
    }
  }

  async run() {
    // Print header
    this.log('\n🚀 Starting Spendy API Test Suite...', 'bold');
    this.log('📊 This will run all API tests with fresh data\n');

    // Pre-flight checks
    this.log('🔍 Pre-flight checks...', 'cyan');
    
    // Check if we're in the right directory
    if (!fs.existsSync('package.json')) {
      this.logError('Not in project root directory. Please run from the spendy-fresh directory.');
      process.exit(1);
    }

    // Check Firebase emulator
    const emulatorRunning = await this.checkFirebaseEmulator();
    if (!emulatorRunning) {
      process.exit(1);
    }

    // Test suite configuration
    const testSuites = [
      { name: 'Connection', file: 'tests/e2e/specs/00-connection-test.api.spec.js' },
      { name: 'Authentication', file: 'tests/e2e/specs/01-authentication.api.spec.js' },
      { name: 'Friend Management', file: 'tests/e2e/specs/02-friend-management.api.spec.js' },
      { name: 'Group Management', file: 'tests/e2e/specs/03-group-management.api.spec.js' },
      { name: 'Expense Management', file: 'tests/e2e/specs/04-expense-management.api.spec.js' },
      { name: 'Settlement Flow', file: 'tests/e2e/specs/05-settlement-flow.api.spec.js' },
      { name: 'Notification System', file: 'tests/e2e/specs/06-notification-system.api.spec.js' },
      { name: 'Complete Integration', file: 'tests/e2e/specs/07-complete-integration.api.spec.js' }
    ];

    this.log('\n📋 Starting API test execution...', 'cyan');
    this.log('⚡ Using single worker to ensure data consistency');
    this.log('🔄 Each test suite will use fresh data\n');

    // Run each test suite
    for (let i = 0; i < testSuites.length; i++) {
      const suite = testSuites[i];
      this.totalTests++;
      
      this.log(`📋 Test Suite ${i + 1}/${testSuites.length}: ${suite.name}`, 'bold');
      this.log('━'.repeat(50));
      
      const passed = await this.runTestSuite(suite.name, suite.file);
      if (passed) {
        this.passedTests++;
      }
      
      console.log(); // Empty line between suites
      
      // Brief pause between test suites
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final results
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    
    this.log('🏁 Test Execution Complete!', 'bold');
    this.log('━'.repeat(50));
    this.log('📊 Results Summary:');
    console.log(`   Total Test Suites: ${this.totalTests}`);
    console.log(`   Passed: ${this.passedTests}`);
    console.log(`   Failed: ${this.totalTests - this.passedTests}`);
    console.log(`   Duration: ${duration}s`);

    if (this.passedTests === this.totalTests) {
      this.logSuccess('All API tests passed! 🎉');
      this.log('🚀 Your Spendy API is working perfectly!', 'green');
      process.exit(0);
    } else {
      this.logWarning('Some tests failed. Check the output above for details.');
      this.log('🔧 Consider running individual test suites to debug issues:');
      console.log('   npm run test:api:auth');
      console.log('   npm run test:api:friends');
      console.log('   npm run test:api:groups');
      process.exit(1);
    }
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n🛑 Test execution interrupted by user');
  process.exit(1);
});

// Run the test suite
const runner = new TestRunner();
runner.run().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
