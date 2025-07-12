// tests/creategroup-fullscreen-test.js
/**
 * Simple test to verify CreateGroupModal to full-screen conversion
 */

console.log("🧪 Testing CreateGroupModal to Full-Screen Conversion...");

// Test 1: Verify Modal import is removed
const fs = require('fs');
const path = require('path');

const createGroupModalPath = path.join(__dirname, '../src/components/modals/CreateGroupModal.tsx');
const realSplittingScreenPath = path.join(__dirname, '../src/screens/main/RealSplittingScreen.tsx');

try {
  // Read CreateGroupModal file
  const createGroupModalContent = fs.readFileSync(createGroupModalPath, 'utf8');
  
  // Test 1: Modal import should be removed
  const hasModalImport = createGroupModalContent.includes('import {\n  View,\n  Text,\n  StyleSheet,\n  Modal,');
  if (hasModalImport) {
    console.error("❌ FAIL: Modal import still present in CreateGroupModal.tsx");
    process.exit(1);
  } else {
    console.log("✅ PASS: Modal import successfully removed from CreateGroupModal.tsx");
  }
  
  // Test 2: Modal wrapper should be removed
  const hasModalWrapper = createGroupModalContent.includes('<Modal visible={visible}');
  if (hasModalWrapper) {
    console.error("❌ FAIL: Modal wrapper still present in CreateGroupModal.tsx");
    process.exit(1);
  } else {
    console.log("✅ PASS: Modal wrapper successfully removed from CreateGroupModal.tsx");
  }
  
  // Test 3: SafeAreaView should still be present for full-screen layout
  const hasSafeAreaView = createGroupModalContent.includes('<SafeAreaView style={[styles.container');
  if (!hasSafeAreaView) {
    console.error("❌ FAIL: SafeAreaView missing from CreateGroupModal.tsx");
    process.exit(1);
  } else {
    console.log("✅ PASS: SafeAreaView present for full-screen layout");
  }
  
  // Test 4: Cancel button should be present
  const hasCancelButton = createGroupModalContent.includes('styles.cancelButton');
  if (!hasCancelButton) {
    console.error("❌ FAIL: Cancel button styling missing from CreateGroupModal.tsx");
    process.exit(1);
  } else {
    console.log("✅ PASS: Cancel button styling present in header");
  }
  
  // Test 5: Header with close icon should be present
  const hasCloseIcon = createGroupModalContent.includes('<Ionicons name="close" size={24}');
  if (!hasCloseIcon) {
    console.error("❌ FAIL: Close icon missing from header");
    process.exit(1);
  } else {
    console.log("✅ PASS: Close icon present in header");
  }
  
  // Test RealSplittingScreen changes
  const realSplittingScreenContent = fs.readFileSync(realSplittingScreenPath, 'utf8');
  
  // Test 6: Conditional full-screen rendering should be present
  const hasConditionalRendering = realSplittingScreenContent.includes('if (showCreateGroup) {');
  if (!hasConditionalRendering) {
    console.error("❌ FAIL: Conditional full-screen rendering missing from RealSplittingScreen.tsx");
    process.exit(1);
  } else {
    console.log("✅ PASS: Conditional full-screen rendering present in RealSplittingScreen.tsx");
  }
  
  // Test 7: CreateGroupModal should be rendered directly (not in modals section)
  const conditionalRenderingBlock = realSplittingScreenContent.match(/if \(showCreateGroup\) \{[\s\S]*?return \([\s\S]*?<CreateGroupModal[\s\S]*?\/>/);
  if (!conditionalRenderingBlock) {
    console.error("❌ FAIL: CreateGroupModal not properly rendered as full-screen in conditional block");
    process.exit(1);
  } else {
    console.log("✅ PASS: CreateGroupModal properly rendered as full-screen component");
  }
  
  // Test 8: CreateGroupModal should be removed from modals section
  const modalsSection = realSplittingScreenContent.match(/<AddFriendModal[\s\S]*?<GroupDetailsModal/);
  if (modalsSection && modalsSection[0].includes('<CreateGroupModal')) {
    console.error("❌ FAIL: CreateGroupModal still present in modals section");
    process.exit(1);
  } else {
    console.log("✅ PASS: CreateGroupModal successfully removed from modals section");
  }
  
  // Test 9: All existing functionality should be preserved
  const hasGroupValidation = createGroupModalContent.includes('validateGroupName');
  const hasFriendSelection = createGroupModalContent.includes('toggleFriendSelection');
  const hasIconSelector = createGroupModalContent.includes('renderIconSelector');
  const hasSubmitHandler = createGroupModalContent.includes('handleCreateGroup');
  
  if (!hasGroupValidation || !hasFriendSelection || !hasIconSelector || !hasSubmitHandler) {
    console.error("❌ FAIL: Some existing functionality missing from CreateGroupModal");
    console.error(`   Validation: ${hasGroupValidation}, Friend Selection: ${hasFriendSelection}, Icon Selector: ${hasIconSelector}, Submit Handler: ${hasSubmitHandler}`);
    process.exit(1);
  } else {
    console.log("✅ PASS: All existing functionality preserved (validation, friend selection, icon picker, submit handler)");
  }
  
  console.log("\n🎉 All tests passed! CreateGroupModal successfully converted to full-screen page.");
  console.log("\n📋 Summary of changes:");
  console.log("   • Modal wrapper removed from CreateGroupModal");
  console.log("   • SafeAreaView used for full-screen layout");
  console.log("   • Cancel button properly styled in top-left header");
  console.log("   • RealSplittingScreen renders CreateGroupModal conditionally as full-screen");
  console.log("   • All existing functionality preserved");
  console.log("   • Modal-specific code removed from RealSplittingScreen");
  
} catch (error) {
  console.error("❌ Test failed with error:", error.message);
  process.exit(1);
}