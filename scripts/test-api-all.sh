#!/bin/bash

# Spendy API Test Runner
# This script runs all API tests with fresh data every time

echo "🚀 Starting Spendy API Test Suite..."
echo "📊 This will run all API tests with fresh data"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Firebase emulator is running
check_firebase_emulator() {
    print_status "Checking if Firebase emulator is running..."
    if curl -s http://127.0.0.1:5001/spendy-97913/us-central1/spendyApi/health > /dev/null 2>&1; then
        print_success "Firebase emulator is running ✅"
        return 0
    else
        print_error "Firebase emulator is not running ❌"
        print_warning "Please start the Firebase emulator first:"
        echo "  cd functions && npm run serve"
        return 1
    fi
}

# Run individual test suites
run_test_suite() {
    local test_name=$1
    local test_file=$2
    
    print_status "Running $test_name tests..."
    if npx playwright test "$test_file" --reporter=list --workers=1; then
        print_success "$test_name tests passed ✅"
        return 0
    else
        print_error "$test_name tests failed ❌"
        return 1
    fi
}

# Main test execution
main() {
    echo "🔍 Pre-flight checks..."
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        print_error "Not in project root directory. Please run from the spendy-fresh directory."
        exit 1
    fi
    
    # Check if Playwright is installed
    if ! command -v npx &> /dev/null; then
        print_error "npx not found. Please ensure Node.js is installed."
        exit 1
    fi
    
    # Check Firebase emulator
    if ! check_firebase_emulator; then
        exit 1
    fi
    
    echo ""
    print_status "Starting API test execution..."
    echo "⚡ Using single worker to ensure data consistency"
    echo "🔄 Each test suite will use fresh data"
    echo ""
    
    # Track test results
    total_tests=0
    passed_tests=0
    
    # Test suites in order
    declare -a test_suites=(
        "Connection:tests/e2e/specs/00-connection-test.api.spec.js"
        "Authentication:tests/e2e/specs/01-authentication.api.spec.js"
        "Friend Management:tests/e2e/specs/02-friend-management.api.spec.js"
        "Group Management:tests/e2e/specs/03-group-management.api.spec.js"
        "Expense Management:tests/e2e/specs/04-expense-management.api.spec.js"
        "Settlement Flow:tests/e2e/specs/05-settlement-flow.api.spec.js"
        "Notification System:tests/e2e/specs/06-notification-system.api.spec.js"
        "Complete Integration:tests/e2e/specs/07-complete-integration.api.spec.js"
    )
    
    # Run each test suite
    for suite in "${test_suites[@]}"; do
        IFS=':' read -r name file <<< "$suite"
        total_tests=$((total_tests + 1))
        
        echo "📋 Test Suite $total_tests/8: $name"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        if run_test_suite "$name" "$file"; then
            passed_tests=$((passed_tests + 1))
        fi
        
        echo ""
        sleep 1  # Brief pause between test suites
    done
    
    # Final results
    echo "🏁 Test Execution Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Results Summary:"
    echo "   Total Test Suites: $total_tests"
    echo "   Passed: $passed_tests"
    echo "   Failed: $((total_tests - passed_tests))"
    
    if [[ $passed_tests -eq $total_tests ]]; then
        print_success "All API tests passed! 🎉"
        echo "🚀 Your Spendy API is working perfectly!"
        exit 0
    else
        print_warning "Some tests failed. Check the output above for details."
        echo "🔧 Consider running individual test suites to debug issues:"
        echo "   npm run test:api:auth"
        echo "   npm run test:api:friends"
        echo "   npm run test:api:groups"
        exit 1
    fi
}

# Handle script interruption
trap 'print_warning "Test execution interrupted by user"; exit 1' INT

# Run main function
main "$@"
