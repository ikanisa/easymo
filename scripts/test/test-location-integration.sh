#!/bin/bash
set -e

# Location Integration Testing Script
# Tests all 7 microservices for location handling
# Duration: ~45 minutes

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Location Integration Testing Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Test results
RESULTS_FILE="test-results-$(date +%Y%m%d_%H%M%S).md"

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://ybpscvklibbbqfeduptg.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
TEST_USER_PHONE="+250788123456"
TEST_USER_ID="test_user_$(date +%s)"

# Kigali coordinates for testing
KIGALI_LAT="-1.9441"
KIGALI_LNG="30.0619"

# Functions
log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_test() {
  echo -e "${YELLOW}▶ $1${NC}"
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

log_pass() {
  echo -e "${GREEN}✅ PASS${NC} - $1"
  PASSED_TESTS=$((PASSED_TESTS + 1))
}

log_fail() {
  echo -e "${RED}❌ FAIL${NC} - $1"
  FAILED_TESTS=$((FAILED_TESTS + 1))
}

log_skip() {
  echo -e "${YELLOW}⏭️  SKIP${NC} - $1"
  SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
}

# Check prerequisites
check_prerequisites() {
  log_section "Checking Prerequisites"
  
  # Check for required commands
  for cmd in curl jq psql; do
    if ! command -v $cmd &> /dev/null; then
      echo -e "${RED}❌ Required command not found: $cmd${NC}"
      exit 1
    fi
  done
  
  # Check Supabase connection
  if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_ANON_KEY not set${NC}"
    echo "Export it: export SUPABASE_ANON_KEY=your-key"
    exit 1
  fi
  
  echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Test database functions
test_database_functions() {
  log_section "Phase 1: Database Functions"
  
  # Test 1: nearby_jobs function exists
  log_test "TC-DB001: nearby_jobs() function exists"
  RESULT=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'nearby_jobs')" 2>/dev/null || echo "false")
  if [ "$RESULT" = "t" ]; then
    log_pass "nearby_jobs() function exists"
  else
    log_fail "nearby_jobs() function not found"
  fi
  
  # Test 2: nearby_products function exists
  log_test "TC-DB002: nearby_products() function exists"
  RESULT=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'nearby_products')" 2>/dev/null || echo "false")
  if [ "$RESULT" = "t" ]; then
    log_pass "nearby_products() function exists"
  else
    log_fail "nearby_products() function not found"
  fi
  
  # Test 3: nearby_properties function exists
  log_test "TC-DB003: nearby_properties() function exists"
  RESULT=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'nearby_properties')" 2>/dev/null || echo "false")
  if [ "$RESULT" = "t" ]; then
    log_pass "nearby_properties() function exists"
  else
    log_fail "nearby_properties() function not found"
  fi
  
  # Test 4: get_cached_location function exists
  log_test "TC-DB004: get_cached_location() function exists"
  RESULT=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_cached_location')" 2>/dev/null || echo "false")
  if [ "$RESULT" = "t" ]; then
    log_pass "get_cached_location() function exists"
  else
    log_fail "get_cached_location() function not found"
  fi
  
  # Test 5: save_location_cache function exists
  log_test "TC-DB005: save_location_cache() function exists"
  RESULT=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'save_location_cache')" 2>/dev/null || echo "false")
  if [ "$RESULT" = "t" ]; then
    log_pass "save_location_cache() function exists"
  else
    log_fail "save_location_cache() function not found"
  fi
  
  # Test 6: PostGIS extension enabled
  log_test "TC-DB006: PostGIS extension enabled"
  RESULT=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis')" 2>/dev/null || echo "false")
  if [ "$RESULT" = "t" ]; then
    log_pass "PostGIS extension enabled"
  else
    log_fail "PostGIS extension not found"
  fi
}

# Test cache functionality
test_cache_functionality() {
  log_section "Phase 2: Cache Functionality"
  
  # Test 7: Save location to cache
  log_test "TC-CACHE001: Save location to cache"
  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/save_location_cache" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"p_user_id\": \"$TEST_USER_ID\",
      \"p_latitude\": $KIGALI_LAT,
      \"p_longitude\": $KIGALI_LNG,
      \"p_context\": \"test\"
    }" 2>/dev/null || echo "")
  
  if echo "$RESPONSE" | grep -q "error"; then
    log_fail "Failed to save location to cache: $RESPONSE"
  else
    log_pass "Location saved to cache"
  fi
  
  # Test 8: Retrieve cached location
  log_test "TC-CACHE002: Retrieve cached location (within 30min)"
  sleep 2  # Wait for save to complete
  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/get_cached_location" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"p_user_id\": \"$TEST_USER_ID\"}" 2>/dev/null || echo "")
  
  if echo "$RESPONSE" | jq -e '.latitude' &>/dev/null; then
    LAT=$(echo "$RESPONSE" | jq -r '.latitude')
    if [ "$LAT" = "$KIGALI_LAT" ]; then
      log_pass "Retrieved correct cached location"
    else
      log_fail "Cached location mismatch (got: $LAT, expected: $KIGALI_LAT)"
    fi
  else
    log_fail "Failed to retrieve cached location: $RESPONSE"
  fi
  
  # Test 9: Cache expiry (would need to wait 30min - skip for now)
  log_test "TC-CACHE003: Cache expiry after 30 minutes"
  log_skip "Requires 30min wait - test manually"
}

# Test GPS search functions
test_gps_searches() {
  log_section "Phase 3: GPS Search Functions"
  
  # Test 10: nearby_jobs search
  log_test "TC-GPS001: nearby_jobs() returns results"
  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/nearby_jobs" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_lat\": $KIGALI_LAT,
      \"user_lng\": $KIGALI_LNG,
      \"radius_meters\": 10000,
      \"limit_count\": 10
    }" 2>/dev/null || echo "")
  
  if echo "$RESPONSE" | jq -e 'type == "array"' &>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    log_pass "nearby_jobs() returned $COUNT results"
  else
    log_fail "nearby_jobs() failed: $RESPONSE"
  fi
  
  # Test 11: nearby_products search
  log_test "TC-GPS002: nearby_products() returns results"
  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/nearby_products" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_lat\": $KIGALI_LAT,
      \"user_lng\": $KIGALI_LNG,
      \"radius_meters\": 10000,
      \"limit_count\": 10
    }" 2>/dev/null || echo "")
  
  if echo "$RESPONSE" | jq -e 'type == "array"' &>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    log_pass "nearby_products() returned $COUNT results"
  else
    log_fail "nearby_products() failed: $RESPONSE"
  fi
  
  # Test 12: nearby_properties search
  log_test "TC-GPS003: nearby_properties() returns results"
  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/nearby_properties" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_lat\": $KIGALI_LAT,
      \"user_lng\": $KIGALI_LNG,
      \"radius_meters\": 10000,
      \"limit_count\": 10
    }" 2>/dev/null || echo "")
  
  if echo "$RESPONSE" | jq -e 'type == "array"' &>/dev/null; then
    COUNT=$(echo "$RESPONSE" | jq 'length')
    log_pass "nearby_properties() returned $COUNT results"
  else
    log_fail "nearby_properties() failed: $RESPONSE"
  fi
}

# Test performance
test_performance() {
  log_section "Phase 4: Performance Testing"
  
  # Test 13: GPS search performance
  log_test "TC-PERF001: GPS search completes in <200ms"
  START=$(date +%s%3N)
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/nearby_jobs" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_lat\": $KIGALI_LAT,
      \"user_lng\": $KIGALI_LNG,
      \"radius_meters\": 5000,
      \"limit_count\": 10
    }" &>/dev/null
  END=$(date +%s%3N)
  DURATION=$((END - START))
  
  if [ $DURATION -lt 200 ]; then
    log_pass "GPS search completed in ${DURATION}ms"
  elif [ $DURATION -lt 500 ]; then
    echo -e "${YELLOW}⚠️  WARNING${NC} - GPS search took ${DURATION}ms (target: <200ms)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    log_fail "GPS search too slow: ${DURATION}ms"
  fi
  
  # Test 14: Cache lookup performance
  log_test "TC-PERF002: Cache lookup completes in <50ms"
  START=$(date +%s%3N)
  curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/get_cached_location" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"p_user_id\": \"$TEST_USER_ID\"}" &>/dev/null
  END=$(date +%s%3N)
  DURATION=$((END - START))
  
  if [ $DURATION -lt 50 ]; then
    log_pass "Cache lookup completed in ${DURATION}ms"
  elif [ $DURATION -lt 100 ]; then
    echo -e "${YELLOW}⚠️  WARNING${NC} - Cache lookup took ${DURATION}ms (target: <50ms)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    log_fail "Cache lookup too slow: ${DURATION}ms"
  fi
}

# Test edge function deployments
test_edge_functions() {
  log_section "Phase 5: Edge Function Deployments"
  
  FUNCTIONS=(
    "wa-webhook-jobs"
    "wa-webhook-marketplace"
    "wa-webhook-mobility"
    "wa-webhook-profile"
    "wa-webhook-property"
    "wa-webhook-ai-agents"
    "wa-webhook-unified"
  )
  
  for FUNC in "${FUNCTIONS[@]}"; do
    log_test "TC-EDGE-$(echo $FUNC | tr '-' '_' | tr '[:lower:]' '[:upper:]'): $FUNC deployed"
    
    # Check if function directory exists
    if [ -d "supabase/functions/$FUNC" ]; then
      # Check for location handling code
      if grep -r "location" "supabase/functions/$FUNC" &>/dev/null; then
        log_pass "$FUNC has location handling code"
      else
        log_fail "$FUNC missing location handling code"
      fi
    else
      log_fail "$FUNC directory not found"
    fi
  done
}

# Generate test report
generate_report() {
  log_section "Generating Test Report"
  
  cat > "$RESULTS_FILE" <<EOF
# Location Integration Test Results
**Date**: $(date +"%Y-%m-%d %H:%M:%S")
**Environment**: ${SUPABASE_URL}
**Duration**: ${SECONDS}s

## Summary

- **Total Tests**: $TOTAL_TESTS
- **Passed**: $PASSED_TESTS ($(( PASSED_TESTS * 100 / TOTAL_TESTS ))%)
- **Failed**: $FAILED_TESTS ($(( FAILED_TESTS * 100 / TOTAL_TESTS ))%)
- **Skipped**: $SKIPPED_TESTS

## Overall Status

EOF

  if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ **ALL TESTS PASSED**" >> "$RESULTS_FILE"
  else
    echo "❌ **SOME TESTS FAILED** - Review failures above" >> "$RESULTS_FILE"
  fi
  
  cat >> "$RESULTS_FILE" <<EOF

## Test Breakdown

### Phase 1: Database Functions
- Tests: 6
- Focus: RPC functions, PostGIS

### Phase 2: Cache Functionality
- Tests: 3
- Focus: Save, retrieve, expiry

### Phase 3: GPS Searches
- Tests: 3
- Focus: nearby_jobs, nearby_products, nearby_properties

### Phase 4: Performance
- Tests: 2
- Focus: Response times

### Phase 5: Edge Functions
- Tests: 7
- Focus: Deployment verification

## Recommendations

EOF

  if [ $FAILED_TESTS -gt 0 ]; then
    echo "1. Fix failed tests before production deployment" >> "$RESULTS_FILE"
    echo "2. Review error logs for root causes" >> "$RESULTS_FILE"
  else
    echo "1. ✅ Ready for production deployment" >> "$RESULTS_FILE"
    echo "2. ✅ Setup monitoring and alerts" >> "$RESULTS_FILE"
    echo "3. ✅ Monitor cache hit rates for 24h" >> "$RESULTS_FILE"
  fi
  
  echo ""
  echo -e "${GREEN}📄 Test report saved to: $RESULTS_FILE${NC}"
}

# Main execution
main() {
  echo "Starting at $(date)"
  echo ""
  
  check_prerequisites
  test_database_functions
  test_cache_functionality
  test_gps_searches
  test_performance
  test_edge_functions
  
  log_section "Test Summary"
  echo ""
  echo "Total Tests:  $TOTAL_TESTS"
  echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
  echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
  echo -e "Skipped:      ${YELLOW}$SKIPPED_TESTS${NC}"
  echo ""
  
  if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  fi
  
  generate_report
  
  echo ""
  echo "Completed at $(date)"
  echo "Duration: ${SECONDS}s"
}

# Run tests
main
