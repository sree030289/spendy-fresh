#!/usr/bin/env node

/**
 * Debug script to check vector icon font issues in web deployment
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const distDir = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

function checkLocalFonts() {
  console.log('🔍 Checking local font files...');
  
  const fontsDir = path.join(distDir, 'assets', 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');
  
  if (!fs.existsSync(fontsDir)) {
    console.error('❌ Fonts directory not found:', fontsDir);
    return;
  }
  
  const fontFiles = fs.readdirSync(fontsDir).filter(file => file.endsWith('.ttf'));
  console.log(`✅ Found ${fontFiles.length} font files:`);
  
  fontFiles.forEach(file => {
    const filePath = path.join(fontsDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
  });
}

function checkHtmlFontDeclarations() {
  console.log('\n🔍 Checking HTML font declarations...');
  
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('❌ index.html not found');
    return;
  }
  
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Check for font-face declarations
  const fontFaceMatches = html.match(/@font-face\s*{[^}]+}/g);
  
  if (fontFaceMatches) {
    console.log(`✅ Found ${fontFaceMatches.length} @font-face declarations`);
    
    // Check specifically for Ionicons (most commonly used)
    if (html.includes("font-family: 'Ionicons'")) {
      console.log('✅ Ionicons font declaration found');
    } else {
      console.log('❌ Ionicons font declaration missing');
    }
  } else {
    console.log('❌ No @font-face declarations found');
  }
  
  // Check for additional icon styles
  if (html.includes('expo-vector-icon')) {
    console.log('✅ Additional icon CSS found');
  } else {
    console.log('⚠️  Additional icon CSS not found (this is optional)');
  }
}

function suggestFixes() {
  console.log('\n💡 Troubleshooting suggestions:');
  console.log('1. Clear browser cache and hard refresh (Cmd+Shift+R)');
  console.log('2. Check browser developer tools for font loading errors');
  console.log('3. Verify Firebase hosting headers allow font files');
  console.log('4. Test on different browsers (Chrome, Safari, Firefox)');
  console.log('5. Check if fonts load from direct URL in browser');
  console.log('\n🌐 Test your deployment at: https://spendy-develop.web.app');
  console.log('\n📋 To check font loading in browser dev tools:');
  console.log('   - Open Network tab');
  console.log('   - Filter by "Font" or search for ".ttf"');
  console.log('   - Look for 404 errors or CORS issues');
}

function main() {
  console.log('🚀 Vector Icon Font Debugging Tool\n');
  
  checkLocalFonts();
  checkHtmlFontDeclarations();
  suggestFixes();
}

if (require.main === module) {
  main();
}

module.exports = { checkLocalFonts, checkHtmlFontDeclarations };
