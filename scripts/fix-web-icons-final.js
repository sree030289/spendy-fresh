#!/usr/bin/env node

/**
 * Final comprehensive web icon fix for React Native Expo apps
 * This completely overrides the bundled corrupted fonts with working CDN alternatives
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

function applyFinalIconFix() {
  console.log('🔧 Applying final comprehensive vector icon fix...');

  if (!fs.existsSync(indexHtmlPath)) {
    console.error('❌ index.html not found in dist directory');
    process.exit(1);
  }

  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Remove any existing font fixes
  html = html.replace(/<!-- Vector Icon Fonts[\s\S]*?<\/script>/g, '');
  html = html.replace(/<!-- Load Vector Icon Fonts[\s\S]*?<\/style>\s*-->/g, '');

  // Update page title
  html = html.replace(
    /<title>.*<\/title>/,
    '<title>Spendy - Split Expenses Effortlessly</title>'
  );

  // Create the ultimate font override solution
  const finalFontSolution = `
    <!-- FINAL VECTOR ICON FIX - Override React Native corrupted fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    
    <!-- Material Icons from Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Material+Icons&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Outlined&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Round&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Sharp&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Two+Tone&display=swap" rel="stylesheet">
    
    <!-- Ionicons Web Components -->
    <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
    <script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
    
    <style>
      /* AGGRESSIVE FONT OVERRIDE - Force working fonts everywhere */
      
      /* Override ALL @font-face declarations from React Native */
      @font-face {
        font-family: 'Ionicons';
        src: url('https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/fonts/ionicons.woff2') format('woff2'),
             url('https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/fonts/ionicons.woff') format('woff');
        font-display: swap;
        font-weight: normal;
        font-style: normal;
      }
      
      @font-face {
        font-family: 'MaterialIcons';
        src: url('https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2') format('woff2');
        font-display: swap;
        font-weight: normal;
        font-style: normal;
      }
      
      @font-face {
        font-family: 'Material Icons';
        src: url('https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2') format('woff2');
        font-display: swap;
        font-weight: normal;
        font-style: normal;
      }
      
      /* FORCE override React Native icon components */
      [data-testid*="icon"], 
      [class*="Icon"], 
      [class*="icon"], 
      .expo-vector-icon,
      div[style*="font-family"] {
        font-family: 'Material Icons', 'Ionicons', system-ui, -apple-system, sans-serif !important;
        font-weight: normal !important;
        font-style: normal !important;
        font-size: inherit !important;
        line-height: 1 !important;
        text-transform: none !important;
        letter-spacing: normal !important;
        word-wrap: normal !important;
        white-space: nowrap !important;
        direction: ltr !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        -webkit-font-feature-settings: 'liga' !important;
        font-feature-settings: 'liga' !important;
      }
      
      /* Target React Native Text components that render icons */
      div[style*="fontFamily"] {
        font-family: 'Material Icons', 'Ionicons', system-ui, sans-serif !important;
      }
      
      /* Specific overrides for common React Native icon patterns */
      span[style*="Ionicons"],
      div[style*="Ionicons"],
      text[style*="Ionicons"] {
        font-family: 'Ionicons', 'Material Icons', system-ui, sans-serif !important;
      }
      
      span[style*="MaterialIcons"],
      div[style*="MaterialIcons"],
      text[style*="MaterialIcons"] {
        font-family: 'Material Icons', system-ui, sans-serif !important;
      }
      
      /* Universal icon class overrides */
      .material-icons,
      .material-icons-outlined,
      .material-icons-round,
      .material-icons-sharp,
      .material-icons-two-tone {
        font-family: 'Material Icons' !important;
        font-weight: normal !important;
        font-style: normal !important;
        font-size: 24px;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        -webkit-font-feature-settings: 'liga';
        -webkit-font-smoothing: antialiased;
        font-feature-settings: 'liga';
      }
      
      /* React Native Web specific overrides */
      .__react-native-web-text {
        font-family: inherit !important;
      }
      
      /* Force override for any element with corrupted font families */
      *[style*="font-family"][style*="build/vendor"] {
        font-family: 'Material Icons', 'Ionicons', system-ui, sans-serif !important;
      }
      
      /* Fallback for unrecognized icons */
      .icon-fallback {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
      }
      
      /* Hide broken font warnings */
      @media (max-width: 0px) {
        [src*="node_modules/@expo/vector-icons"] {
          display: none !important;
        }
      }
    </style>
    
    <script>
      // Runtime font fix and detection
      (function() {
        console.log('🔧 Initializing comprehensive icon font fix...');
        
        // Function to fix any element with corrupted font
        function fixElementFont(element) {
          const style = window.getComputedStyle(element);
          const fontFamily = style.fontFamily;
          
          // Check if element uses corrupted fonts
          if (fontFamily && (fontFamily.includes('vendor') || fontFamily.includes('build'))) {
            element.style.fontFamily = 'Material Icons, Ionicons, system-ui, sans-serif';
            element.classList.add('font-fixed');
            console.log('🔧 Fixed font for element:', element);
          }
        }
        
        // Fix fonts on DOM changes
        function observeAndFix() {
          // Fix existing elements
          document.querySelectorAll('*').forEach(fixElementFont);
          
          // Observe for new elements
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                  fixElementFont(node);
                  node.querySelectorAll && node.querySelectorAll('*').forEach(fixElementFont);
                }
              });
            });
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
          });
        }
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', observeAndFix);
        } else {
          observeAndFix();
        }
        
        // Force fix after fonts load
        if (document.fonts) {
          document.fonts.ready.then(() => {
            console.log('✅ Fonts loaded, applying final fixes...');
            setTimeout(() => {
              document.querySelectorAll('*').forEach(fixElementFont);
            }, 500);
          });
        }
        
        console.log('✅ Icon font fix initialized successfully');
      })();
    </script>
    `;

  // Insert before closing head tag
  html = html.replace(
    /<\/head>/,
    finalFontSolution + '</head>'
  );

  // Write the updated HTML
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  console.log('✅ Final comprehensive vector icon fix applied!');
  console.log('🎯 Aggressive font overrides activated');
  console.log('🔄 Runtime font monitoring enabled');
  console.log('🌐 CDN fallbacks configured');
}

function main() {
  try {
    applyFinalIconFix();
  } catch (error) {
    console.error('❌ Error applying final icon fix:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { applyFinalIconFix };
