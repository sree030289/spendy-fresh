#!/usr/bin/env node

/**
 * Environment Verification Script
 * Verifies that the centralized environment system is working correctly
 */

// Re-read the .env file to get latest changes
require('dotenv').config({ override: true });
const path = require('path');

console.log('🔍 Environment Verification Report\n');

// Clear require cache for environment config to force refresh
const configPath = path.join(__dirname, '../config/environments.js');
delete require.cache[require.resolve(configPath)];

// Import environment config (fresh)
let config;
try {
  config = require(configPath);
  console.log('✅ Environment config loaded successfully');
} catch (error) {
  console.log('❌ Failed to load environment config:', error.message);
  process.exit(1);
}

// Check .env file
const envValue = process.env.SPENDY_ENV;
console.log(`📋 Current SPENDY_ENV: ${envValue || 'NOT SET'}`);

if (!envValue) {
  console.log('❌ SPENDY_ENV not set in .env file');
  process.exit(1);
}

// Get current environment and config
const currentEnv = config.getCurrentEnvironment();
const currentConfig = config.getConfig();

console.log('\n🎯 Environment Configuration:');
console.log(`  Name: ${currentEnv.name}`);
console.log(`  Environment: ${envValue}`);
console.log(`  Project ID: ${currentEnv.firebase.projectId}`);
console.log(`  Auth Domain: ${currentEnv.firebase.authDomain}`);
console.log(`  API URL: ${currentEnv.api.baseURL}`);
console.log(`  Emulator Mode: ${currentEnv.firebase.useEmulator ? 'YES' : 'NO'}`);

// Check all environments are available
console.log('\n🌍 Available Environments:');
const allEnvironments = config.ENVIRONMENTS;
Object.entries(allEnvironments).forEach(([envKey, envConfig]) => {
  console.log(`  ✅ ${envKey}: ${envConfig.name} (${envConfig.firebase.projectId})`);
});

// Verify Firebase services availability
console.log('\n🔥 Firebase Services Configuration:');
console.log(`  Auth URL: ${currentEnv.firebase.authDomain}`);
console.log(`  Firestore: ${currentEnv.firebase.databaseURL || 'Default'}`);
console.log(`  Storage: ${currentEnv.firebase.storageBucket}`);

// Configuration methods available
console.log('\n⚙️ Helper Methods Available:');
console.log(`  Local Environment: ${currentConfig.isLocal() ? 'YES' : 'NO'}`);
console.log(`  Development Environment: ${currentConfig.isDevelopment() ? 'YES' : 'NO'}`);
console.log(`  Production Environment: ${currentConfig.isProduction() ? 'YES' : 'NO'}`);

if (currentEnv.firebase.useEmulator && currentEnv.emulators) {
  console.log('\n🏠 Emulator Ports:');
  Object.entries(currentEnv.emulators).forEach(([service, serviceConfig]) => {
    console.log(`  ${service}: ${serviceConfig.host}:${serviceConfig.port}`);
  });
}

console.log('\n✅ Environment verification complete!');
