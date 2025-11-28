#!/bin/bash
# Automated Test Suite for EasyMO Admin Desktop
# Usage: ./run-desktop-tests.sh [platform]

set -e

PLATFORM="${1:-all}"
TEST_RESULTS_DIR="test-results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$TEST_RESULTS_DIR"

echo "🧪 EasyMO Admin Desktop Test Suite"
echo "Platform: $PLATFORM"
echo "Results: $TEST_RESULTS_DIR"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
SKIPPED=0

function test_case() {
    local name="$1"
    local command="$2"
    
    echo -n "Testing: $name... "
    
    if eval "$command" > "$TEST_RESULTS_DIR/${name// /_}.log" 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED++))
        return 1
    fi
}

function skip_test() {
    local name="$1"
    local reason="$2"
    echo -e "${YELLOW}⊘ SKIP${NC}: $name ($reason)"
    ((SKIPPED++))
}

# =======================
# PRE-FLIGHT CHECKS
# =======================

echo "📋 Pre-Flight Checks"
echo "===================="

test_case "Node.js installed" "command -v node"
test_case "pnpm installed" "command -v pnpm"
test_case "Rust installed" "command -v cargo"
test_case "Tauri CLI available" "command -v tauri || pnpm tauri --version"

echo ""

# =======================
# BUILD TESTS
# =======================

echo "🔨 Build Tests"
echo "=============="

test_case "TypeScript compilation" "cd admin-app && pnpm exec tsc --noEmit"
test_case "Linting passes" "cd admin-app && pnpm lint"
test_case "Unit tests pass" "cd admin-app && pnpm test"

# Only build if platform matches
if [[ "$PLATFORM" == "all" ]] || [[ "$PLATFORM" == "$(uname -s | tr '[:upper:]' '[:lower:]')" ]]; then
    test_case "Desktop build succeeds" "cd admin-app && pnpm tauri build --debug"
else
    skip_test "Desktop build" "Platform mismatch"
fi

echo ""

# =======================
# SECURITY TESTS
# =======================

echo "🔐 Security Tests"
echo "================="

test_case "No service role keys in client" "! grep -r 'SERVICE_ROLE' admin-app/lib admin-app/components"
test_case "No hardcoded secrets" "! grep -r 'sk-[a-zA-Z0-9]\\{40,\\}' admin-app/"
test_case "CSP configured" "grep -q 'csp' admin-app/src-tauri/tauri.conf.json"
test_case "HTTPS enforced" "grep -q 'https' admin-app/next.config.mjs"

echo ""

# =======================
# PLATFORM-SPECIFIC TESTS
# =======================

if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "🍎 macOS-Specific Tests"
    echo "======================="
    
    if [ -d "admin-app/src-tauri/target/debug/bundle/macos/EasyMO Admin.app" ]; then
        APP_PATH="admin-app/src-tauri/target/debug/bundle/macos/EasyMO Admin.app"
        
        test_case "Code signing present" "codesign -v '$APP_PATH'"
        test_case "Entitlements present" "codesign -d --entitlements - '$APP_PATH' | grep -q 'com.apple.security.app-sandbox'"
        test_case "App bundle valid" "test -f '$APP_PATH/Contents/MacOS/EasyMO Admin'"
    else
        skip_test "macOS bundle tests" "Build not found"
    fi
    
    echo ""
fi

if [[ "$(uname -s)" == "MINGW"* ]] || [[ "$(uname -s)" == "MSYS"* ]]; then
    echo "🪟 Windows-Specific Tests"
    echo "========================="
    
    if [ -f "admin-app/src-tauri/target/debug/easymo-admin.exe" ]; then
        EXE_PATH="admin-app/src-tauri/target/debug/easymo-admin.exe"
        
        test_case "Executable exists" "test -f '$EXE_PATH'"
        # Note: Signature checking requires signtool.exe
        skip_test "Code signature" "Requires signtool.exe"
    else
        skip_test "Windows binary tests" "Build not found"
    fi
    
    echo ""
fi

# =======================
# INTEGRATION TESTS
# =======================

echo "🔗 Integration Tests"
echo "===================="

# Check if app is running (placeholder - requires actual app)
skip_test "App launch test" "Requires manual testing"
skip_test "Update check test" "Requires update server"
skip_test "Tray icon test" "Requires manual testing"

echo ""

# =======================
# RESULTS SUMMARY
# =======================

echo "📊 Test Results Summary"
echo "======================="
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED${NC}"
echo "Total:   $((PASSED + FAILED + SKIPPED))"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ TESTS FAILED${NC}"
    echo "Check logs in: $TEST_RESULTS_DIR"
    exit 1
else
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo "Results saved in: $TEST_RESULTS_DIR"
    exit 0
fi
