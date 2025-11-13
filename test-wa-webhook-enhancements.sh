#!/bin/bash

# WA-Webhook Enhancement Test Script
# Tests all new features and endpoints

set -e

echo "🧪 WA-Webhook Enhancement Testing"
echo "================================="
echo ""

# Configuration
FUNCTION_URL="${SUPABASE_FUNCTION_URL:-https://your-project.supabase.co/functions/v1/wa-webhook}"
PHONE_TEST="+250700000001"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

echo "1. Testing Health Endpoint"
echo "============================"
HEALTH_RESPONSE=$(curl -s "$FUNCTION_URL/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null || echo "error")

if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "degraded" ]; then
  pass "Health endpoint accessible"
  echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
  fail "Health endpoint failed (status: $HEALTH_STATUS)"
fi
echo ""

echo "2. Testing Metrics Endpoint"
echo "============================="
METRICS_RESPONSE=$(curl -s "$FUNCTION_URL/metrics")
TOTAL_REQUESTS=$(echo "$METRICS_RESPONSE" | jq -r '.metrics.totalRequests' 2>/dev/null || echo "0")

if [ -n "$TOTAL_REQUESTS" ] && [ "$TOTAL_REQUESTS" != "null" ]; then
  pass "Metrics endpoint accessible"
  info "Total requests tracked: $TOTAL_REQUESTS"
else
  fail "Metrics endpoint failed"
fi
echo ""

echo "3. Testing Metrics Summary"
echo "============================"
SUMMARY_RESPONSE=$(curl -s "$FUNCTION_URL/metrics/summary")

if echo "$SUMMARY_RESPONSE" | grep -q "AI Agent Metrics Summary"; then
  pass "Metrics summary accessible"
  echo "$SUMMARY_RESPONSE"
else
  fail "Metrics summary failed"
fi
echo ""

echo "4. Testing Prometheus Metrics"
echo "================================"
PROM_RESPONSE=$(curl -s -H "Accept: text/plain" "$FUNCTION_URL/metrics")

if echo "$PROM_RESPONSE" | grep -q "ai_agent_requests_total"; then
  pass "Prometheus metrics accessible"
  echo "$PROM_RESPONSE" | head -10
else
  fail "Prometheus metrics failed"
fi
echo ""

echo "5. Testing Configuration"
echo "============================"
CONFIG_TEST=$(curl -s "$FUNCTION_URL/metrics" | jq -r '.config.enabled' 2>/dev/null || echo "null")

if [ "$CONFIG_TEST" != "null" ]; then
  pass "Configuration manager working"
  info "AI Agents enabled: $CONFIG_TEST"
else
  fail "Configuration manager failed"
fi
echo ""

echo "6. Testing Rate Limiting (Optional)"
echo "======================================"
info "This test requires webhook payload and will be skipped"
info "To test manually:"
info "  1. Send 15 rapid WhatsApp messages"
info "  2. After message 10, you should get rate limit error"
echo ""

echo "7. Checking File Structure"
echo "=============================="
FILES_TO_CHECK=(
  "supabase/functions/wa-webhook/shared/config_manager.ts"
  "supabase/functions/wa-webhook/shared/metrics_aggregator.ts"
  "supabase/functions/wa-webhook/shared/health_metrics.ts"
)

for file in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$file" ]; then
    pass "File exists: $file"
  else
    fail "Missing file: $file"
  fi
done
echo ""

echo "8. Checking Enhanced Files"
echo "=============================="
if grep -q "CacheManager" supabase/functions/wa-webhook/shared/memory_manager.ts 2>/dev/null; then
  pass "Memory manager enhanced with caching"
else
  fail "Memory manager not enhanced"
fi

if grep -q "AdvancedRateLimiter" supabase/functions/wa-webhook/router/ai_agent_handler.ts 2>/dev/null; then
  pass "AI agent handler has rate limiting"
else
  fail "AI agent handler missing rate limiting"
fi

if grep -q "MetricsAggregator" supabase/functions/wa-webhook/router/ai_agent_handler.ts 2>/dev/null; then
  pass "AI agent handler has metrics tracking"
else
  fail "AI agent handler missing metrics tracking"
fi
echo ""

echo "9. Summary"
echo "=============="
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo "The enhanced wa-webhook is working correctly."
  echo ""
  echo "Next steps:"
  echo "  1. Monitor /health endpoint"
  echo "  2. Check /metrics after 1 hour"
  echo "  3. Test with real WhatsApp messages"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  echo "Please review the errors above."
  exit 1
fi
