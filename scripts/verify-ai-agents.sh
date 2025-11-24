#!/bin/bash

# AI Agents Verification Script
# Tests all AI agent implementations

set -e

echo "🧪 EasyMO AI Agents - Verification Test Suite"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://lhbowpbcpwoiparwnwgt.supabase.co}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
TEST_USER="+237600000001"

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}✗ curl not found${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠ jq not found (optional for pretty output)${NC}"
    fi
    
    if [ -z "$SUPABASE_KEY" ]; then
        echo -e "${RED}✗ SUPABASE_SERVICE_ROLE_KEY not set${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites OK${NC}"
    echo ""
}

# Test function health
test_function_health() {
    local function_name=$1
    echo "Testing $function_name health..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${SUPABASE_URL}/functions/v1/${function_name}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}")
    
    if [ "$response" = "200" ] || [ "$response" = "400" ]; then
        echo -e "${GREEN}✓ $function_name is accessible${NC}"
        return 0
    else
        echo -e "${RED}✗ $function_name returned HTTP $response${NC}"
        return 1
    fi
}

# Test driver agent
test_driver_agent() {
    echo ""
    echo "🚗 Testing Nearby Drivers Agent..."
    
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/functions/v1/agent-negotiation" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "'${TEST_USER}'",
            "agentType": "driver",
            "flowType": "find_driver",
            "pickupLocation": {"latitude": 3.848, "longitude": 11.502, "text": "Douala Center"},
            "dropoffLocation": {"latitude": 3.866, "longitude": 11.516, "text": "Airport"},
            "vehicleType": "Moto"
        }')
    
    if echo "$response" | grep -q "sessionId"; then
        echo -e "${GREEN}✓ Driver agent working${NC}"
        echo "Response: $response" | head -c 200
        echo "..."
        return 0
    else
        echo -e "${RED}✗ Driver agent test failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Test pharmacy agent
test_pharmacy_agent() {
    echo ""
    echo "💊 Testing Pharmacy Agent..."
    
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/functions/v1/agent-negotiation" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "'${TEST_USER}'",
            "agentType": "pharmacy",
            "flowType": "find_medications",
            "location": {"latitude": 3.848, "longitude": 11.502},
            "medications": ["Paracetamol", "Amoxicillin"]
        }')
    
    if echo "$response" | grep -q "sessionId"; then
        echo -e "${GREEN}✓ Pharmacy agent working${NC}"
        return 0
    else
        echo -e "${RED}✗ Pharmacy agent test failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Test property agent
test_property_agent() {
    echo ""
    echo "🏠 Testing Property Rental Agent..."
    
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/functions/v1/agent-property-rental" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "'${TEST_USER}'",
            "action": "find",
            "rentalType": "long_term",
            "bedrooms": 2,
            "maxBudget": 150000,
            "location": {"latitude": 3.848, "longitude": 11.502}
        }')
    
    if echo "$response" | grep -q "sessionId"; then
        echo -e "${GREEN}✓ Property agent working${NC}"
        return 0
    else
        echo -e "${RED}✗ Property agent test failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Test schedule trip agent
test_schedule_agent() {
    echo ""
    echo "📅 Testing Schedule Trip Agent..."
    
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/functions/v1/agent-schedule-trip" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "'${TEST_USER}'",
            "action": "create",
            "pickupLocation": {"latitude": 3.848, "longitude": 11.502},
            "dropoffLocation": {"latitude": 3.866, "longitude": 11.516},
            "scheduledTime": "'$(date -u -v+1d +%Y-%m-%dT%H:%M:%SZ)'",
            "recurrence": "once",
            "vehiclePreference": "Moto"
        }')
    
    if echo "$response" | grep -q "success"; then
        echo -e "${GREEN}✓ Schedule trip agent working${NC}"
        return 0
    else
        echo -e "${RED}✗ Schedule trip agent test failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Test shops agent
test_shops_agent() {
    echo ""
    echo "🛍️ Testing Shops Agent..."
    
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/functions/v1/agent-shops" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "'${TEST_USER}'",
            "action": "find",
            "location": {"latitude": 3.848, "longitude": 11.502},
            "items": ["iPhone charger", "Phone case"]
        }')
    
    if echo "$response" | grep -q "sessionId"; then
        echo -e "${GREEN}✓ Shops agent working${NC}"
        return 0
    else
        echo -e "${RED}✗ Shops agent test failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Test quincaillerie agent
test_quincaillerie_agent() {
    echo ""
    echo "🔧 Testing Quincaillerie Agent..."
    
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/functions/v1/agent-quincaillerie" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "'${TEST_USER}'",
            "action": "find",
            "location": {"latitude": 3.848, "longitude": 11.502},
            "items": ["Hammer", "Nails", "Screwdriver"]
        }')
    
    if echo "$response" | grep -q "sessionId"; then
        echo -e "${GREEN}✓ Quincaillerie agent working${NC}"
        return 0
    else
        echo -e "${RED}✗ Quincaillerie agent test failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Test database tables
test_database_tables() {
    echo ""
    echo "💾 Testing Database Tables..."
    
    # Check if tables exist (would need psql access)
    echo -e "${YELLOW}⚠ Database table check requires direct DB access${NC}"
    echo "  Tables to verify:"
    echo "  - agent_sessions"
    echo "  - agent_quotes"
    echo "  - agent_negotiation_history"
    echo "  - scheduled_trips"
    echo "  - property_listings"
    echo "  - agent_interaction_logs"
}

# Test webhook integration
test_webhook() {
    echo ""
    echo "📱 Testing WhatsApp Webhook..."
    
    test_function_health "wa-webhook-core"
}

# Run all tests
run_all_tests() {
    local failed_tests=0
    
    check_prerequisites
    
    echo "🚀 Running AI Agent Tests..."
    echo "=============================="
    
    # Test each agent
    test_function_health "agent-negotiation" || ((failed_tests++))
    test_function_health "agent-property-rental" || ((failed_tests++))
    test_function_health "agent-schedule-trip" || ((failed_tests++))
    test_function_health "agent-shops" || ((failed_tests++))
    test_function_health "agent-quincaillerie" || ((failed_tests++))
    
    test_driver_agent || ((failed_tests++))
    test_pharmacy_agent || ((failed_tests++))
    test_property_agent || ((failed_tests++))
    test_schedule_agent || ((failed_tests++))
    test_shops_agent || ((failed_tests++))
    test_quincaillerie_agent || ((failed_tests++))
    
    test_webhook || ((failed_tests++))
    test_database_tables
    
    # Summary
    echo ""
    echo "=============================="
    echo "📊 Test Summary"
    echo "=============================="
    
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        echo "✅ AI Agents System is READY"
        return 0
    else
        echo -e "${RED}✗ $failed_tests test(s) failed${NC}"
        echo ""
        echo "❌ Please review errors above"
        return 1
    fi
}

# Main execution
main() {
    if [ "$1" = "driver" ]; then
        test_driver_agent
    elif [ "$1" = "pharmacy" ]; then
        test_pharmacy_agent
    elif [ "$1" = "property" ]; then
        test_property_agent
    elif [ "$1" = "schedule" ]; then
        test_schedule_agent
    elif [ "$1" = "shops" ]; then
        test_shops_agent
    elif [ "$1" = "quincaillerie" ]; then
        test_quincaillerie_agent
    elif [ "$1" = "webhook" ]; then
        test_webhook
    else
        run_all_tests
    fi
}

# Run
main "$@"
