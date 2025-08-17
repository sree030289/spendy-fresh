#!/usr/bin/env node

/**
 * Debug script to help identify biometric authentication issues
 * Run this to simulate the debug process and check logs
 */

console.log('🔍 Biometric Authentication Debug Guide');
console.log('==========================================');
console.log('');

console.log('📱 **Development Build Testing Steps:**');
console.log('');
console.log('1. **Open your Android development build**');
console.log('2. **Open React Native debugger or use Metro logs**');
console.log('3. **Look for these specific log patterns:**');
console.log('');

console.log('✅ **Expected Success Flow:**');
console.log('   🔍 Checking authentication flow... { hasUser: false, authFlowState: "checking", isLoading: false }');
console.log('   🔍 No user authenticated, checking for biometric flow');
console.log('   🔍 Checking biometric for user: [email] biometric enabled: true');
console.log('   🔍 Biometric hardware available: true');
console.log('   🔍 User biometric enabled: true');
console.log('   🔍 Exceeded biometric attempts: false');
console.log('   ✅ All biometric conditions met, showing biometric screen');
console.log('   🔒 Starting biometric authentication for user: [email]');
console.log('   🔒 Calling BiometricAuthService.authenticateWithBiometric...');
console.log('   ✅ LocalAuthentication succeeded');
console.log('   ✅ Biometric authentication successful');
console.log('   🔄 Restoring session for user: [email]');
console.log('   ✅ Session extended after biometric success');
console.log('   🔄 Session restored after biometric success');
console.log('   🔍 Already in biometric/authenticated flow, skipping check');
console.log('');

console.log('❌ **Common Failure Patterns:**');
console.log('');
console.log('**Pattern 1: Immediate redirect back to biometric**');
console.log('   - Logs show: biometric success → session restore → back to biometric check');
console.log('   - Cause: Race condition in authentication flow');
console.log('   - Fix: Added authFlowState guard in the latest changes');
console.log('');

console.log('**Pattern 2: Session validation fails**');
console.log('   - Logs show: BiometricAuthService.isSessionValid - No session timestamp found');
console.log('   - Cause: Session not being properly stored/extended');
console.log('   - Fix: Ensure extendSession() is called');
console.log('');

console.log('**Pattern 3: User state not persisting**');
console.log('   - Logs show: Session restored but user state immediately lost');
console.log('   - Cause: API session validation failing');
console.log('   - Fix: Check API connection and token validity');
console.log('');

console.log('🔧 **Debug Commands to Run:**');
console.log('');
console.log('1. **Clear app data completely:**');
console.log('   - Uninstall and reinstall the development build');
console.log('   - OR use device settings to clear app data');
console.log('');

console.log('2. **Test login with new user:**');
console.log('   - Create a new account with biometric enabled');
console.log('   - Log out and test biometric flow');
console.log('');

console.log('3. **Check AsyncStorage data:**');
console.log('   - Add logging to see what data is stored');
console.log('   - Verify auth tokens and session data exist');
console.log('');

console.log('4. **Test with existing user:**');
console.log('   - Login normally first');
console.log('   - Enable biometric authentication');
console.log('   - Close app and reopen to test biometric');
console.log('');

console.log('🚀 **If issue persists after these fixes:**');
console.log('');
console.log('1. **Check Expo development build configuration**');
console.log('2. **Verify expo-local-authentication is properly linked**');
console.log('3. **Test on a physical device (not emulator)**');
console.log('4. **Check Android permissions for biometric access**');
console.log('');

console.log('📋 **Share these logs when reporting issues:**');
console.log('- Complete Metro/React Native logs from app launch');
console.log('- Device information (Android version, device model)');
console.log('- Steps to reproduce the issue');
console.log('- Whether this happens on first login or subsequent attempts');
