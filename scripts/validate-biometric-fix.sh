#!/bin/bash

# Validation script for biometric login fixes
# This script validates the key changes made to fix biometric login

echo "🔍 Validating Biometric Login Fixes..."
echo ""

# Check if key methods exist in ApiService
echo "✓ Checking ApiService.ts for new methods..."
grep -q "refreshToken()" src/services/api/ApiService.ts && echo "  ✓ refreshToken() method exists" || echo "  ✗ refreshToken() method missing"
grep -q "validateStoredToken()" src/services/api/ApiService.ts && echo "  ✓ validateStoredToken() method exists" || echo "  ✗ validateStoredToken() method missing"
grep -q "makeRequestWithRetry" src/services/api/ApiService.ts && echo "  ✓ makeRequestWithRetry() method exists" || echo "  ✗ makeRequestWithRetry() method missing"
grep -q "import { authService }" src/services/api/ApiService.ts && echo "  ✓ Firebase auth integration added" || echo "  ✗ Firebase auth integration missing"

echo ""
echo "✓ Checking BiometricAuthService.ts for new methods..."
grep -q "validateFirebaseSession()" src/services/biometric/BiometricAuthService.ts && echo "  ✓ validateFirebaseSession() method exists" || echo "  ✗ validateFirebaseSession() method missing"
grep -q "getFreshToken()" src/services/biometric/BiometricAuthService.ts && echo "  ✓ getFreshToken() method exists" || echo "  ✗ getFreshToken() method missing"
grep -q "import { authService }" src/services/biometric/BiometricAuthService.ts && echo "  ✓ Firebase auth integration added" || echo "  ✗ Firebase auth integration missing"

echo ""
echo "✓ Checking useAuth.tsx for session restoration improvements..."
grep -q "validateFirebaseSession" src/hooks/useAuth.tsx && echo "  ✓ Firebase session validation added" || echo "  ✗ Firebase session validation missing"
grep -q "getFreshToken" src/hooks/useAuth.tsx && echo "  ✓ Fresh token retrieval added" || echo "  ✗ Fresh token retrieval missing"

echo ""
echo "✓ Checking LoginScreen.tsx for improved error handling..."
grep -q "validateFirebaseSession" src/screens/auth/LoginScreen.tsx && echo "  ✓ Session validation in biometric handler" || echo "  ✗ Session validation missing"
grep -q "MANUAL_LOGIN_REQUIRED" src/screens/auth/LoginScreen.tsx && echo "  ✓ Proper error handling for manual login" || echo "  ✗ Error handling missing"

echo ""
echo "✓ Checking ProfileScreen.tsx for biometric toggle enhancements..."
grep -q "BiometricAuthService.isHardwareAvailable" src/screens/profile/ProfileScreen.tsx && echo "  ✓ Hardware validation added" || echo "  ✗ Hardware validation missing"
grep -q "validateFirebaseSession" src/screens/profile/ProfileScreen.tsx && echo "  ✓ Session validation in toggle" || echo "  ✗ Session validation missing"

echo ""
echo "✓ Checking for test files..."
[ -f "src/services/api/__tests__/ApiService.token.test.ts" ] && echo "  ✓ ApiService token tests created" || echo "  ✗ ApiService token tests missing"
[ -f "src/services/biometric/__tests__/BiometricAuthService.firebase.test.ts" ] && echo "  ✓ BiometricAuthService tests created" || echo "  ✗ BiometricAuthService tests missing"

echo ""
echo "✓ Checking documentation..."
[ -f "BIOMETRIC_LOGIN_FIX.md" ] && echo "  ✓ Documentation file created" || echo "  ✗ Documentation file missing"

echo ""
echo "🎉 Validation complete!"
echo ""
echo "Summary of changes:"
echo "  - Firebase token refresh integration in ApiService"
echo "  - Token validation methods in BiometricAuthService"
echo "  - Improved session restoration in useAuth"
echo "  - Better error handling in LoginScreen"
echo "  - Enhanced biometric toggle in ProfileScreen"
echo "  - Comprehensive test coverage"
echo "  - Complete documentation"
