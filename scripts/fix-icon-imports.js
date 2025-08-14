const fs = require('fs');
const path = require('path');

// Function to calculate correct relative path
function getCorrectPath(filePath) {
  const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..', 'src', 'components', 'common', 'Icon'));
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

// Function to fix imports in a file
function fixImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has the incorrect import
    if (content.includes("from '../components/common/Icon'") || 
        content.includes('from "../components/common/Icon"')) {
      
      const correctPath = getCorrectPath(filePath);
      
      // Replace the import
      content = content.replace(
        /from ['"]\.\.\/components\/common\/Icon['"]/g,
        `from '${correctPath}'`
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed import in: ${filePath}`);
      console.log(`   New path: ${correctPath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Function to recursively find TypeScript files
function findTSFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...findTSFiles(fullPath));
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const srcDir = path.join(__dirname, '..', 'src');
const files = findTSFiles(srcDir);

console.log(`🔍 Found ${files.length} TypeScript files`);

let fixedCount = 0;

for (const file of files) {
  if (fixImports(file)) {
    fixedCount++;
  }
}

console.log(`\n✨ Import fixing complete!`);
console.log(`📁 Files processed: ${files.length}`);
console.log(`🔧 Files fixed: ${fixedCount}`);
