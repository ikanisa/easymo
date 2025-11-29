#!/bin/bash
# EasyMO Admin Panel - Post-Deployment Smoke Test
# Run this after deploying to Netlify to verify deployment

set -e

echo "🔍 EasyMO Post-Deployment Smoke Test"
echo "====================================="
echo ""

# Configuration
SITE_URL="${1:-https://your-site.netlify.app}"
TIMEOUT=30

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track status
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    FAILED=$((FAILED + 1))
}

info() {
    echo "ℹ️  $1"
}

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    info "Testing: $name"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>&1)
    
    if [ "$response" = "$expected_status" ]; then
        pass "$name returned $response"
    else
        fail "$name returned $response (expected $expected_status)"
    fi
}

# Validate URL
if [[ ! $SITE_URL =~ ^https?:// ]]; then
    echo -e "${RED}❌ Invalid URL: $SITE_URL${NC}"
    echo "Usage: $0 https://your-site.netlify.app"
    exit 1
fi

echo "Testing deployment at: $SITE_URL"
echo ""

# 1. Homepage
echo "1️⃣  Testing homepage..."
test_endpoint "Homepage" "$SITE_URL"
echo ""

# 2. Health check
echo "2️⃣  Testing health endpoint..."
test_endpoint "Health check" "$SITE_URL/api/health"
echo ""

# 3. API endpoints
echo "3️⃣  Testing API endpoints..."
test_endpoint "AI Chat API" "$SITE_URL/api/ai/chat" "405"  # POST only, GET returns 405
test_endpoint "Agents API" "$SITE_URL/api/ai/agents" "401"  # Requires auth
echo ""

# 4. Static assets
echo "4️⃣  Testing static assets..."
test_endpoint "Favicon" "$SITE_URL/favicon.ico"
test_endpoint "Manifest" "$SITE_URL/manifest.webmanifest"
echo ""

# 5. Next.js specific
echo "5️⃣  Testing Next.js features..."
test_endpoint "Next.js API route" "$SITE_URL/api/hello" "404"  # May not exist
echo ""

# 6. Performance check
echo "6️⃣  Checking page load performance..."
info "Measuring homepage load time..."
start_time=$(date +%s%N)
curl -s -o /dev/null "$SITE_URL"
end_time=$(date +%s%N)
load_time=$(( (end_time - start_time) / 1000000 ))

if [ $load_time -lt 3000 ]; then
    pass "Homepage loaded in ${load_time}ms (< 3s)"
else
    fail "Homepage loaded in ${load_time}ms (> 3s)"
fi
echo ""

# 7. Security headers
echo "7️⃣  Checking security headers..."
headers=$(curl -s -I "$SITE_URL" | grep -i "x-frame-options\|x-content-type-options\|strict-transport-security")

if echo "$headers" | grep -qi "x-frame-options"; then
    pass "X-Frame-Options header present"
else
    fail "X-Frame-Options header missing"
fi

if echo "$headers" | grep -qi "x-content-type-options"; then
    pass "X-Content-Type-Options header present"
else
    fail "X-Content-Type-Options header missing"
fi

if echo "$headers" | grep -qi "strict-transport-security"; then
    pass "Strict-Transport-Security header present"
else
    fail "Strict-Transport-Security header missing"
fi
echo ""

# 8. SSL/TLS check
echo "8️⃣  Checking SSL/TLS..."
if [[ $SITE_URL == https://* ]]; then
    if curl -s --head "$SITE_URL" > /dev/null; then
        pass "HTTPS enabled and working"
    else
        fail "HTTPS connection failed"
    fi
else
    fail "Site not using HTTPS"
fi
echo ""

# Summary
echo ""
echo "====================================="
echo "📊 SMOKE TEST SUMMARY"
echo "====================================="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL SMOKE TESTS PASSED!${NC}"
    echo "Deployment is healthy and ready for production traffic."
    exit 0
else
    echo -e "${RED}❌ $FAILED TEST(S) FAILED!${NC}"
    echo "Please investigate and fix issues before routing traffic."
    exit 1
fi
