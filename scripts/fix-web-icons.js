#!/usr/bin/env node

/**
 * Post-build script to fix vector icon font loading in web builds
 * This script automatically updates the generated HTML file to include
 * proper @font-face declarations for all vector icon families.
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');
const fontsDir = path.join(distDir, 'assets', 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');

// Function to dynamically find all available font files
function getAvailableFonts() {
  if (!fs.existsSync(fontsDir)) {
    console.warn('⚠️  Fonts directory not found, using predefined fonts list');
    return [
      { family: 'Ionicons', file: 'Ionicons.6148e7019854f3bde85b633cb88f3c25.ttf' },
      { family: 'MaterialIcons', file: 'MaterialIcons.4e85bc9ebe07e0340c9c4fc2f6c38908.ttf' },
      { family: 'MaterialCommunityIcons', file: 'MaterialCommunityIcons.b62641afc9ab487008e996a5c5865e56.ttf' }
    ];
  }

  const fontFiles = fs.readdirSync(fontsDir).filter(file => file.endsWith('.ttf'));
  return fontFiles.map(file => {
    const familyName = file.split('.')[0];
    return { family: familyName, file: file };
  });
}

function fixIconFonts() {
  console.log('🔧 Fixing vector icon fonts for web...');

  if (!fs.existsSync(indexHtmlPath)) {
    console.error('❌ index.html not found in dist directory');
    process.exit(1);
  }

  // Get available fonts dynamically
  const iconFonts = getAvailableFonts();
  console.log('📦 Found fonts:', iconFonts.map(f => f.family).join(', '));

  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Check if fonts are already fixed (to avoid duplicate additions)
  if (html.includes('Icon font fixes for Expo Vector Icons')) {
    console.log('✅ Icon fonts already fixed');
    return;
  }

  // Update page title
  html = html.replace(
    /<title>.*<\/title>/,
    '<title>Spendy - Split Expenses Effortlessly</title>'
  );

  // Generate @font-face CSS for all icon fonts with fallbacks
  const fontFaces = iconFonts.map(font => `
      @font-face {
        font-family: '${font.family}';
        src: url('./assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${font.file}') format('truetype'),
             url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${font.file}') format('truetype');
        font-display: swap;
        font-weight: normal;
        font-style: normal;
      }`).join('');

  const iconFontStyles = `
    <!-- Load Vector Icon Fonts for Web -->
    <style>
      /* Icon font fixes for Expo Vector Icons */
      ${fontFaces}
      
      /* Ensure icon fonts are applied correctly */
      [data-icon], [class*="icon"], .expo-vector-icon {
        font-family: inherit !important;
        font-style: normal !important;
        font-weight: normal !important;
        speak: none;
        display: inline-block;
        text-decoration: inherit;
        text-align: center;
        font-variant: normal;
        text-transform: none;
        line-height: 1;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    </style>
    `;

  // Insert the font styles before the existing reset styles
  html = html.replace(
    /<!-- The `react-native-web` recommended style reset/,
    iconFontStyles + '<!-- The `react-native-web` recommended style reset'
  );

  // Write the updated HTML
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  console.log('✅ Vector icon fonts fixed successfully!');
  console.log('📋 Fixed fonts:', iconFonts.map(f => f.family).join(', '));
}

function main() {
  try {
    fixIconFonts();
  } catch (error) {
    console.error('❌ Error fixing icon fonts:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixIconFonts };