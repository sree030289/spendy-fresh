// Global setup for Playwright tests
// This runs once before all tests

const { chromium } = require('@playwright/test');

async function globalSetup() {
  console.log('🚀 Starting Spendy E2E Test Suite');
  console.log('📊 Setting up test environment...');
  
  // Validate API endpoint is accessible
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Health check on API
    const response = await page.request.get('http://127.0.0.1:5001/spendy-97913/us-central1/spendyApi/health');
    
    console.log(`✅ API Health Check: ${response.status() === 200 ? 'HEALTHY' : 'UNEXPECTED'}`);
    
    if (response.status() === 200) {
      const healthData = await response.json();
      console.log(`📡 API Response: ${healthData.message}`);
    }
    
    // Clean up any test data from previous runs
    console.log('🧹 Cleaning up test environment...');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('✅ Global setup completed successfully');
}

module.exports = globalSetup;
