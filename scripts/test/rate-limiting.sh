#!/bin/bash
set -euo pipefail

# Test rate limiting on all public endpoints
# Part of Production Readiness Phase 1

echo "🔍 Testing Rate Limiting on Edge Functions..."
echo ""

# Check for required environment variables
if [ -z "${SUPABASE_URL:-}" ]; then
  echo "❌ SUPABASE_URL not set"
  exit 1
fi

if [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "❌ SUPABASE_ANON_KEY not set"
  exit 1
fi

# Edge function endpoints to test
ENDPOINTS=(
  "wa-webhook-core"
  "momo-webhook"
  "business-lookup"
)

TOTAL_PASSED=0
TOTAL_FAILED=0

for endpoint in "${ENDPOINTS[@]}"; do
  echo "Testing rate limiting for $endpoint..."
  
  RATE_LIMITED=false
  
  # Send 150 requests rapidly
  for i in {1..150}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
      "$SUPABASE_URL/functions/v1/$endpoint" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d '{"test": true}' 2>/dev/null || echo "000")
    
    if [ "$response" == "429" ]; then
      echo "✅ Rate limit triggered at request $i for $endpoint"
      RATE_LIMITED=true
      ((TOTAL_PASSED++))
      break
    fi
    
    # Add small delay to avoid overwhelming the server
    sleep 0.01
  done
  
  if [ "$RATE_LIMITED" = false ]; then
    echo "⚠️  No rate limit triggered after 150 requests for $endpoint"
    ((TOTAL_FAILED++))
  fi
  
  echo ""
  
  # Cool down period before next endpoint
  sleep 2
done

echo "========================================="
echo "Rate Limiting Test Results:"
echo "  Passed: $TOTAL_PASSED"
echo "  Failed: $TOTAL_FAILED"
echo "========================================="

if [ $TOTAL_FAILED -gt 0 ]; then
  exit 1
fi

echo "✅ All rate limiting tests passed!"
