#!/usr/bin/env node

/**
 * Migration script to replace Ionicons with platform-aware Icon component
 * This will help update your existing code to use the new Icon system
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

// Common Ionicons to Icon name mappings
const iconMappings = {
  'home': 'home',
  'home-outline': 'home',
  'person': 'person',
  'person-outline': 'person',
  'settings': 'settings',
  'settings-outline': 'settings',
  'search': 'search',
  'search-outline': 'search',
  'heart': 'heart',
  'heart-outline': 'heart',
  'notifications': 'notifications',
  'notifications-outline': 'notifications',
  'wallet': 'wallet',
  'wallet-outline': 'wallet',
  'people': 'people',
  'people-outline': 'people',
  'add': 'add',
  'add-outline': 'add',
  'close': 'close',
  'close-outline': 'close',
  'checkmark': 'checkmark',
  'checkmark-outline': 'checkmark',
  'chevron-back': 'back',
  'chevron-forward': 'forward',
  'arrow-back': 'back',
  'arrow-forward': 'forward',
  'menu': 'menu',
  'menu-outline': 'menu',
  'refresh': 'refresh',
  'refresh-outline': 'refresh',
  'download': 'download',
  'download-outline': 'download',
  'share': 'share',
  'share-outline': 'share',
  'camera': 'camera',
  'camera-outline': 'camera',
  'image': 'image',
  'image-outline': 'image',
  'document': 'document',
  'document-outline': 'document',
  'copy': 'copy',
  'copy-outline': 'copy',
  'trash': 'trash',
  'trash-outline': 'trash',
  'create': 'edit',
  'create-outline': 'edit',
  'warning': 'warning',
  'warning-outline': 'warning',
  'information-circle': 'information',
  'information-circle-outline': 'information',
  'checkmark-circle': 'success',
  'checkmark-circle-outline': 'success',
  'close-circle': 'error',
  'close-circle-outline': 'error',
  'alert-circle': 'alert',
  'alert-circle-outline': 'alert',
  'help-circle': 'help',
  'help-circle-outline': 'help',
  'calendar': 'calendar',
  'calendar-outline': 'calendar',
  'time': 'time',
  'time-outline': 'time',
  'location': 'location',
  'location-outline': 'location',
  'qr-code': 'qrCode',
  'qr-code-outline': 'qrCode',
  'filter': 'filter',
  'filter-outline': 'filter',
  'sync': 'sync',
  'sync-outline': 'sync',
  'lock-closed': 'lock',
  'lock-closed-outline': 'lock',
  'eye': 'eye',
  'eye-outline': 'eye',
  'eye-off': 'eyeOff',
  'eye-off-outline': 'eyeOff',
  'finger-print': 'fingerprint',
  'finger-print-outline': 'fingerprint',
  'shield': 'shield',
  'shield-outline': 'shield',
  'arrow-up': 'arrowUp',
  'arrow-up-outline': 'arrowUp',
  'arrow-down': 'arrowDown',
  'arrow-down-outline': 'arrowDown',
  'play': 'play',
  'play-outline': 'play',
  'pause': 'pause',
  'pause-outline': 'pause',
  'stop': 'stop',
  'stop-outline': 'stop',
  'star': 'star',
  'star-outline': 'starOutline',
  'bookmark': 'bookmark',
  'bookmark-outline': 'bookmark',
  'gift': 'gift',
  'gift-outline': 'gift',
  'log-out': 'logout',
  'log-out-outline': 'logout',
  'mail': 'mail',
  'mail-outline': 'mail',
  'call': 'call',
  'call-outline': 'call',
  'send': 'send',
  'send-outline': 'send',
  'card': 'card',
  'card-outline': 'card',
  'cash': 'cash',
  'cash-outline': 'cash',
  'receipt': 'receipt',
  'receipt-outline': 'receipt',
  'analytics': 'analytics',
  'analytics-outline': 'analytics',
  'trending-up': 'trending',
  'trending-up-outline': 'trending',
  'stats-chart': 'stats',
  'stats-chart-outline': 'stats',
  'calculator': 'calculator',
  'calculator-outline': 'calculator'
};

function findTsxFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      // Skip node_modules and other non-source directories
      if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
        results = results.concat(findTsxFiles(filePath));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  
  return results;
}

function updateFileContent(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file uses Ionicons
  if (content.includes('from \'@expo/vector-icons\'') || content.includes('import { Ionicons }')) {
    console.log(`📝 Processing: ${filePath.replace(__dirname + '/../', '')}`);
    
    // Replace import statements
    if (content.includes('import { Ionicons } from \'@expo/vector-icons\';')) {
      content = content.replace(
        'import { Ionicons } from \'@expo/vector-icons\';',
        'import { Icon } from \'../components/common/Icon\';'
      );
      modified = true;
    }
    
    if (content.includes('from \'@expo/vector-icons\'')) {
      // Replace other @expo/vector-icons imports
      content = content.replace(
        /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@expo\/vector-icons['"];?/g,
        'import { Icon } from \'../components/common/Icon\';'
      );
      modified = true;
    }
    
    // Replace Ionicons component usage
    const ioniconsRegex = /<Ionicons\s+name=['"]([^'"]+)['"]([^>]*?)\/?>|<Ionicons\s+([^>]*?)name=['"]([^'"]+)['"]([^>]*?)\/?>|<Ionicons\s+([^>]*?)>/g;
    
    content = content.replace(ioniconsRegex, (match, name1, props1, props2, name2, props3, props4) => {
      const iconName = name1 || name2;
      const allProps = (props1 || '') + (props2 || '') + (props3 || '') + (props4 || '');
      
      if (iconName && iconMappings[iconName]) {
        const mappedName = iconMappings[iconName];
        const newComponent = `<Icon name="${mappedName}"${allProps} />`;
        console.log(`  ✅ ${iconName} → ${mappedName}`);
        modified = true;
        return newComponent;
      }
      
      return match; // Keep original if no mapping found
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  💾 Updated: ${filePath.replace(__dirname + '/../', '')}`);
    }
  }
  
  return modified;
}

function main() {
  console.log('🚀 Starting Ionicons to Icon migration...\n');
  
  if (!fs.existsSync(srcDir)) {
    console.error(`❌ Source directory not found: ${srcDir}`);
    process.exit(1);
  }
  
  const tsxFiles = findTsxFiles(srcDir);
  console.log(`📁 Found ${tsxFiles.length} TypeScript/TSX files\n`);
  
  let totalModified = 0;
  
  tsxFiles.forEach((file) => {
    if (updateFileContent(file)) {
      totalModified++;
    }
  });
  
  console.log(`\n✅ Migration complete!`);
  console.log(`📊 Files processed: ${tsxFiles.length}`);
  console.log(`📝 Files modified: ${totalModified}`);
  
  if (totalModified > 0) {
    console.log(`\n📋 Next steps:`);
    console.log(`1. Review the changes in your files`);
    console.log(`2. Update any unmapped icon names manually`);
    console.log(`3. Test your app on both mobile and web`);
    console.log(`4. Run: npm run build:web:dev to test web deployment`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateFileContent, iconMappings };
