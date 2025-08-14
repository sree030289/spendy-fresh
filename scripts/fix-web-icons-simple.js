#!/usr/bin/env node

/**
 * Simplified web icon fix that uses proven CDN approach
 * This focuses on the solution that actually works
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

function applySimpleIconFix() {
  console.log('🔧 Applying simple and reliable icon fix...');

  if (!fs.existsSync(indexHtmlPath)) {
    console.error('❌ index.html not found in dist directory');
    process.exit(1);
  }

  let html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Update page title
  html = html.replace(
    /<title>.*<\/title>/,
    '<title>Spendy - Split Expenses Effortlessly</title>'
  );

  // Add our simple, working icon solution
  const iconSolution = `
    <!-- Simple Icon Fix - Working Solution -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    
    <!-- Material Icons from Google Fonts (most reliable) -->
    <link href="https://fonts.googleapis.com/css2?family=Material+Icons&display=swap" rel="stylesheet" />
    
    <!-- Ionicons Web Components (fallback) -->
    <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
    <script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
    
    <style>
      /* Simple and effective icon overrides */
      .material-icons {
        font-family: 'Material Icons' !important;
        font-weight: normal;
        font-style: normal;
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
      
      /* Override any corrupted font usage */
      [style*="font-family"][style*="Ionicons"] {
        font-family: 'Material Icons', system-ui, sans-serif !important;
      }
      
      /* Ensure react-icons work properly */
      svg {
        display: inline-block !important;
        vertical-align: middle !important;
      }
    </style>
    `;

  // Insert before closing head tag
  html = html.replace(
    /<\/head>/,
    iconSolution + '</head>'
  );

  // Write the updated HTML
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  console.log('✅ Simple icon fix applied successfully!');
  console.log('🎯 Using reliable CDN fonts');
  console.log('📱 react-icons will handle web icons automatically');
}

function main() {
  try {
    applySimpleIconFix();
  } catch (error) {
    console.error('❌ Error applying icon fix:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { applySimpleIconFix };
