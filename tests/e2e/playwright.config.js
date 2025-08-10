const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Test directory
  testDir: './specs',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://127.0.0.1:5001/spendy-97913/us-central1/spendyApi',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // API request timeout
    actionTimeout: 30000,
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Extra HTTP headers to be sent with every request
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      'User-Agent': 'Spendy-E2E-Tests/1.0'
    }
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'API Tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/*.api.spec.js'
    }
  ],

  // Global setup and teardown
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',

  // Output directory for test artifacts
  outputDir: 'test-results/'
});
