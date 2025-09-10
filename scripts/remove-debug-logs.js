#!/usr/bin/env node
// Script to remove console.log statements for production builds

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

console.log('🧹 Debug Log Removal Script');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION CLEANUP'}`);

// Patterns to match console statements
const consolePatterns = [
  /console\.log\([^)]*\);?\s*\n?/g,
  /console\.debug\([^)]*\);?\s*\n?/g,
  /console\.info\([^)]*\);?\s*\n?/g,
  // Keep console.warn and console.error for production debugging
];

// Files to process
const filePatterns = [
  'src/**/*.{ts,tsx,js,jsx}',
  'components/**/*.{ts,tsx,js,jsx}',
  // Don't process node_modules or build directories
  '!node_modules/**',
  '!dist/**',
  '!build/**',
];

// Files to exclude (keep debug logs for development tools)
const excludePatterns = [
  '**/config/environment.ts', // Keep env logging
  '**/scripts/**', // Keep script logging
  '**/*.test.{ts,tsx,js,jsx}', // Keep test logging
  '**/__tests__/**', // Keep test logging
];

let totalFilesProcessed = 0;
let totalLogsRemoved = 0;

function shouldProcessFile(filePath) {
  return !excludePatterns.some(pattern => {
    const matcher = path.posix.join(...filePath.split(path.sep));
    return matcher.includes(pattern.replace('**/', '').replace('*', ''));
  });
}

function removeDebugLogs(filePath) {
  if (!shouldProcessFile(filePath)) {
    if (VERBOSE) console.log(`⏭️  Skipping: ${filePath}`);
    return 0;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let modifiedContent = content;
  let logsRemovedInFile = 0;

  // Remove console statements
  consolePatterns.forEach(pattern => {
    const matches = modifiedContent.match(pattern);
    if (matches) {
      logsRemovedInFile += matches.length;
      modifiedContent = modifiedContent.replace(pattern, '');
    }
  });

  // Remove empty lines left behind
  modifiedContent = modifiedContent.replace(/^\s*\n/gm, '');
  
  // Remove multiple consecutive empty lines
  modifiedContent = modifiedContent.replace(/\n{3,}/g, '\n\n');

  if (logsRemovedInFile > 0) {
    if (VERBOSE || !DRY_RUN) {
      console.log(`🧹 ${filePath}: removed ${logsRemovedInFile} debug statements`);
    }
    
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
    }
    
    totalFilesProcessed++;
    totalLogsRemoved += logsRemovedInFile;
  }

  return logsRemovedInFile;
}

function main() {
  console.log('🔍 Scanning for TypeScript and JavaScript files...');
  
  const files = [];
  filePatterns.forEach(pattern => {
    const matchedFiles = glob.sync(pattern);
    files.push(...matchedFiles);
  });

  console.log(`📁 Found ${files.length} files to process`);
  
  files.forEach(filePath => {
    try {
      removeDebugLogs(filePath);
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  });

  console.log('\n📊 Summary:');
  console.log(`   Files processed: ${totalFilesProcessed}`);
  console.log(`   Debug statements removed: ${totalLogsRemoved}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a dry run. Use without --dry-run to actually remove logs.');
  } else {
    console.log('\n✅ Production debug cleanup completed!');
  }
}

// Run the script
main();