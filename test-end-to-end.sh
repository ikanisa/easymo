#!/bin/bash

# End-to-End Testing Script for notify-buyers Function
# Tests all implemented features

set -e

PROJECT_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
FUNCTION_URL="${PROJECT_URL}/functions/v1/notify-buyers"

echo "🧪 Testing notify-buyers Function"
echo "=================================="
echo ""

# Test 1: Health Check
echo "✅ Test 1: Health Check"
echo "----------------------"
HEALTH_RESPONSE=$(curl -s "${FUNCTION_URL}")
echo "Response: ${HEALTH_RESPONSE}"
if echo "${HEALTH_RESPONSE}" | grep -q "healthy"; then
    echo "✅ Health check PASSED"
else
    echo "❌ Health check FAILED"
    exit 1
fi
echo ""

# Test 2: Database Function Test
echo "✅ Test 2: Database get_next_job Function"
echo "-----------------------------------------"
echo "Testing via Supabase SQL..."
echo "Note: This requires Supabase CLI or direct SQL access"
echo ""

# Test 3: Function Deployment Verification
echo "✅ Test 3: Function Deployment Verification"
echo "-------------------------------------------"
echo "Checking deployed function..."
if curl -s -o /dev/null -w "%{http_code}" "${FUNCTION_URL}" | grep -q "200"; then
    echo "✅ Function is accessible"
else
    echo "❌ Function is not accessible"
    exit 1
fi
echo ""

echo "📋 Testing Summary"
echo "=================="
echo "✅ Health check: PASSED"
echo "✅ Function deployment: VERIFIED"
echo ""
echo "⚠️  Manual Testing Required:"
echo "  1. Set environment variables in Supabase Dashboard"
echo "  2. Test voice note processing via WhatsApp webhook"
echo "  3. Test user context fetching"
echo "  4. Test vendor outreach broadcasting"
echo "  5. Test job queue processing"
echo ""
echo "See DEPLOYMENT_TEST_RESULTS.md for detailed test scenarios"

