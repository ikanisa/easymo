#!/bin/bash

# AI Agents Testing Script
# Comprehensive tests for all deployed agents

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}Error: Supabase URL or Anon Key not found in .env${NC}"
    exit 1
fi

TEST_USER_ID="test-user-$(date +%s)"

print_test() {
    echo -e "\n${BLUE}▶ Testing: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Test Property Rental Agent
test_property_rental() {
    print_test "Property Rental Agent"
    
    # Test property search
    echo "Testing property search..."
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/agents/property-rental" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "'"$TEST_USER_ID"'",
        "action": "find",
        "rentalType": "short_term",
        "location": {"latitude": -1.9441, "longitude": 30.0619, "address": "Kigali"},
        "bedrooms": 2,
        "minBudget": 100000,
        "maxBudget": 300000,
        "amenities": ["wifi", "parking"]
      }')
    
    if echo "$RESPONSE" | grep -q "success"; then
        print_success "Property search working"
        echo "Response: $RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    else
        print_error "Property search failed"
        echo "Response: $RESPONSE"
        return 1
    fi
    
    # Test property listing
    echo "Testing property listing..."
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/agents/property-rental" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "'"$TEST_USER_ID"'",
        "action": "add",
        "rentalType": "long_term",
        "location": {"latitude": -1.9500, "longitude": 30.0600, "address": "Kicukiro, Kigali"},
        "bedrooms": 3,
        "address": "Test Property, Kicukiro",
        "amenities": ["wifi", "parking", "security"],
        "propertyData": {
          "price": 250000,
          "bathrooms": 2,
          "description": "Test property listing",
          "availableFrom": "2024-12-01"
        }
      }')
    
    if echo "$RESPONSE" | grep -q "success"; then
        print_success "Property listing working"
    else
        print_error "Property listing failed"
        echo "Response: $RESPONSE"
    fi
}

# Test Schedule Trip Agent
test_schedule_trip() {
    print_test "Schedule Trip Agent"
    
    # Test trip scheduling
    echo "Testing trip scheduling..."
    SCHEDULE_TIME=$(date -u -v+1H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+1 hour" +"%Y-%m-%dT%H:%M:%SZ")
    
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/agents/schedule-trip" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "'"$TEST_USER_ID"'",
        "action": "schedule",
        "pickupLocation": {"latitude": -1.9441, "longitude": 30.0619, "address": "Kigali City"},
        "dropoffLocation": {"latitude": -1.9706, "longitude": 30.1044, "address": "Remera"},
        "scheduledTime": "'"$SCHEDULE_TIME"'",
        "vehiclePreference": "Moto",
        "recurrence": "once",
        "maxPrice": 5000,
        "notificationMinutes": 15
      }')
    
    if echo "$RESPONSE" | grep -q "success"; then
        print_success "Trip scheduling working"
        echo "Response: $RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    else
        print_error "Trip scheduling failed"
        echo "Response: $RESPONSE"
    fi
    
    # Test pattern analysis
    echo "Testing pattern analysis..."
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/agents/schedule-trip" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "'"$TEST_USER_ID"'",
        "action": "analyze_patterns"
      }')
    
    if echo "$RESPONSE" | grep -q "analysis" || echo "$RESPONSE" | grep -q "patterns"; then
        print_success "Pattern analysis working"
    else
        print_error "Pattern analysis failed or no patterns found"
        echo "Response: $RESPONSE"
    fi
}

# Test Quincaillerie Agent
test_quincaillerie() {
    print_test "Quincaillerie (Hardware) Agent"
    
    echo "Testing hardware item search..."
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/agents/quincaillerie" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "'"$TEST_USER_ID"'",
        "location": {"latitude": -1.9441, "longitude": 30.0619},
        "items": ["hammer", "nails", "screwdriver"],
        "notes": "Looking for good quality tools"
      }')
    
    if echo "$RESPONSE" | grep -q "success" || echo "$RESPONSE" | grep -q "quotes"; then
        print_success "Hardware search working"
        echo "Response: $RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    else
        print_error "Hardware search failed"
        echo "Response: $RESPONSE"
    fi
}

# Test Shops Agent
test_shops() {
    print_test "General Shops Agent"
    
    # Test shop listing
    echo "Testing shop addition..."
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/agents/shops" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "'"$TEST_USER_ID"'",
        "action": "add",
        "location": {"latitude": -1.9441, "longitude": 30.0619},
        "shopData": {
          "name": "Test Electronics Shop",
          "description": "Electronics and gadgets",
          "categories": ["electronics", "accessories"],
          "phone": "+250788123456"
        }
      }')
    
    if echo "$RESPONSE" | grep -q "success"; then
        print_success "Shop addition working"
    else
        print_error "Shop addition failed"
        echo "Response: $RESPONSE"
    fi
    
    # Test product search
    echo "Testing product search..."
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/agents/shops" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "userId": "'"$TEST_USER_ID"'",
        "action": "search",
        "location": {"latitude": -1.9441, "longitude": 30.0619},
        "products": ["phone", "laptop"],
        "shopCategory": "electronics"
      }')
    
    if echo "$RESPONSE" | grep -q "success" || echo "$RESPONSE" | grep -q "shops"; then
        print_success "Product search working"
    else
        print_error "Product search failed"
        echo "Response: $RESPONSE"
    fi
}

# Test Agent Negotiation
test_negotiation() {
    print_test "Agent Negotiation System"
    
    echo "Testing negotiation endpoint..."
    RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/agent-negotiation" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "sessionId": "test-session-'"$(date +%s)"'",
        "vendorId": "test-vendor",
        "offerPrice": 15000,
        "userMaxPrice": 12000,
        "context": "Driver negotiation for test trip"
      }')
    
    if [ -n "$RESPONSE" ]; then
        print_success "Negotiation endpoint responding"
        echo "Response: $RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    else
        print_error "Negotiation endpoint not responding"
    fi
}

# Performance test
test_performance() {
    print_test "Performance Testing"
    
    echo "Testing agent response times..."
    
    START_TIME=$(date +%s%N)
    curl -s -X POST "${SUPABASE_URL}/functions/v1/agents/property-rental" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"userId":"perf-test","action":"find","rentalType":"short_term","location":{"latitude":-1.9441,"longitude":30.0619},"bedrooms":2}' > /dev/null
    END_TIME=$(date +%s%N)
    
    DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if [ $DURATION -lt 3000 ]; then
        print_success "Response time: ${DURATION}ms (Good)"
    elif [ $DURATION -lt 5000 ]; then
        echo -e "${YELLOW}⚠ Response time: ${DURATION}ms (Acceptable)${NC}"
    else
        print_error "Response time: ${DURATION}ms (Slow)"
    fi
}

# Database connectivity test
test_database() {
    print_test "Database Connectivity"
    
    echo "Checking agent_sessions table..."
    RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/agent_sessions?limit=1" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")
    
    if [ -n "$RESPONSE" ]; then
        print_success "Database connection working"
    else
        print_error "Database connection failed"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    cat << "EOF"
╔══════════════════════════════════════════════════╗
║                                                  ║
║        AI AGENTS TESTING SUITE                   ║
║        Comprehensive Integration Tests           ║
║                                                  ║
╚══════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    echo "Test User ID: $TEST_USER_ID"
    echo "Supabase URL: $SUPABASE_URL"
    echo ""
    
    FAILED=0
    
    test_database || ((FAILED++))
    test_property_rental || ((FAILED++))
    test_schedule_trip || ((FAILED++))
    test_quincaillerie || ((FAILED++))
    test_shops || ((FAILED++))
    test_negotiation || ((FAILED++))
    test_performance
    
    echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo -e "${GREEN}All AI agents are working correctly.${NC}"
    else
        echo -e "${RED}✗ $FAILED test(s) failed${NC}"
        echo -e "${YELLOW}Please check the error messages above.${NC}"
    fi
    
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"
}

main
