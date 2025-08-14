#!/usr/bin/env node

/**
 * Comprehensive web icon fix for Firebase deployment
 * This script fixes vector icon font loading issues by:
 * 1. Using CDN-hosted fonts instead of bundled corrupted fonts
 * 2. Adding proper font preloading
 * 3. Creating fallback font declarations
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

// CDN-hosted font URLs (reliable alternative)
const cdnFonts = {
  'Ionicons': 'https://fonts.googleapis.com/css2?family=Material+Icons&display=swap',
  'MaterialIcons': 'https://fonts.googleapis.com/css2?family=Material+Icons&display=swap',
  'MaterialCommunityIcons': 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css'
};

// Local font fallbacks with WOFF2 format (better compression and support)
const localFontFallbacks = [
  {
    family: 'Ionicons',
    woff2: 'https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/fonts/ionicons.woff2',
    woff: 'https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/fonts/ionicons.woff',
    ttf: 'https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/fonts/ionicons.ttf'
  }
];

function fixIconFonts() {
  console.log('🔧 Applying comprehensive vector icon fix...');

  if (!fs.existsSync(indexHtmlPath)) {
    console.error('❌ index.html not found in dist directory');
    process.exit(1);
  }

  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Remove existing font declarations to start fresh
  html = html.replace(/<!-- Load Vector Icon Fonts for Web -->[\s\S]*?<\/style>\s*-->/g, '');
  html = html.replace(/<!-- Icon font fixes for Expo Vector Icons -->/g, '');

  // Update page title
  html = html.replace(
    /<title>.*<\/title>/,
    '<title>Spendy - Split Expenses Effortlessly</title>'
  );

  // Create comprehensive font loading solution
  const fontSolution = `
    <!-- Vector Icon Fonts - Comprehensive Fix -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    
    <!-- Google Fonts for Material Icons -->
    <link href="https://fonts.googleapis.com/css2?family=Material+Icons&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Outlined&display=swap" rel="stylesheet">
    
    <!-- Ionicons from CDN -->
    <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
    <script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
    
    <style>
      /* Vector Icon Font Fixes */
      @font-face {
        font-family: 'Ionicons';
        src: url('https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/fonts/ionicons.woff2') format('woff2'),
             url('https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/fonts/ionicons.woff') format('woff'),
             url('https://cdn.jsdelivr.net/npm/ionicons@7.1.0/dist/fonts/ionicons.ttf') format('truetype');
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
      
      /* Ensure proper icon rendering */
      .material-icons,
      [class*="ion-"],
      [data-icon],
      .expo-vector-icon {
        font-family: 'Material Icons', 'Ionicons', -apple-system, BlinkMacSystemFont, sans-serif !important;
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
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
        font-feature-settings: 'liga';
      }
      
      /* Specific Ionicons fix */
      [class^="ion-"], [class*=" ion-"] {
        font-family: 'Ionicons' !important;
        speak: none;
        font-style: normal;
        font-weight: normal;
        font-variant: normal;
        text-transform: none;
        line-height: 1;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      /* Fallback for unloaded fonts */
      .icon-fallback {
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      /* Preload critical fonts */
      @media (prefers-reduced-motion: no-preference) {
        .icon-loading {
          animation: iconPulse 1.5s ease-in-out infinite;
        }
      }
      
      @keyframes iconPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    </style>
    
    <script>
      // Font loading detection and fallback
      (function() {
        if (!document.fonts) return;
        
        const iconElements = [];
        
        function updateIcons() {
          iconElements.forEach(el => {
            el.style.fontFamily = 'Material Icons, Ionicons, system-ui, sans-serif';
            el.classList.remove('icon-loading');
          });
        }
        
        document.fonts.ready.then(() => {
          console.log('✅ Fonts loaded successfully');
          updateIcons();
        }).catch(() => {
          console.warn('⚠️ Font loading failed, using fallbacks');
          updateIcons();
        });
        
        // Collect icon elements when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            iconElements.push(...document.querySelectorAll('[data-icon], [class*="ion-"], .material-icons'));
          });
        }
      })();
    </script>
    `;

  // Insert the comprehensive solution before closing head tag
  html = html.replace(
    /<\/head>/,
    fontSolution + '</head>'
  );

  // Write the updated HTML
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  console.log('✅ Comprehensive vector icon fix applied!');
  console.log('🌐 Using CDN-hosted fonts for reliability');
  console.log('📱 Added fallback mechanisms');
  console.log('⚡ Optimized font loading with preconnect');
}

function main() {
  try {
    fixIconFonts();
  } catch (error) {
    console.error('❌ Error applying icon fix:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixIconFonts };
