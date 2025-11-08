#!/bin/bash

# AI Agents Testing Script
# Tests all agents with sample requests

set -e

echo "🧪 AI Agents Testing Script"
echo "==========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment
source .env 2>/dev/null || true

# Get Supabase credentials
if command -v supabase &> /dev/null && supabase status &> /dev/null; then
    SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $NF}')
    SUPABASE_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')
else
    # Fall back to env vars
    SUPABASE_URL=${SUPABASE_URL:-"http://localhost:54321"}
    SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Could not determine Supabase credentials${NC}"
    echo "Make sure Supabase is running or set SUPABASE_URL and SUPABASE_ANON_KEY"
    exit 1
fi

echo -e "${BLUE}📡 Using Supabase URL: $SUPABASE_URL${NC}"
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local TEST_NAME=$1
    local ENDPOINT=$2
    local DATA=$3
    local EXPECTED=$4
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -e "${BLUE}Test $TESTS_RUN: $TEST_NAME${NC}"
    
    RESPONSE=$(curl -s -X POST \
      "$SUPABASE_URL/functions/v1/$ENDPOINT" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "$DATA" 2>&1)
    
    if echo "$RESPONSE" | grep -q "$EXPECTED"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "Expected: $EXPECTED"
        echo "Got: $RESPONSE"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test 1: Property Rental - Find Properties
run_test \
  "Property Rental: Find long-term rental" \
  "agents/property-rental" \
  '{
    "userId": "test-user-001",
    "action": "find",
    "rentalType": "long_term",
    "bedrooms": 3,
    "minBudget": 200000,
    "maxBudget": 500000,
    "location": {
      "latitude": -1.9536,
      "longitude": 30.0606,
      "address": "Kigali City"
    },
    "amenities": ["WiFi", "Parking", "Security"]
  }' \
  "searchId\|success"

# Test 2: Property Rental - Add Property
run_test \
  "Property Rental: Add new property listing" \
  "agents/property-rental" \
  '{
    "userId": "test-owner-001",
    "action": "add",
    "rentalType": "long_term",
    "bedrooms": 3,
    "maxBudget": 450000,
    "location": {
      "latitude": -1.9536,
      "longitude": 30.0606,
      "address": "Kimironko, Kigali"
    },
    "amenities": ["WiFi", "Parking", "24/7 Security", "Water Tank"],
    "propertyData": {
      "price": 450000,
      "bathrooms": 2,
      "description": "Modern 3-bedroom apartment in Kimironko",
      "images": ["https://example.com/image1.jpg"],
      "availableFrom": "2025-02-01"
    }
  }' \
  "propertyId\|success"

# Test 3: Schedule Trip - Create Schedule
run_test \
  "Schedule Trip: Create weekday commute" \
  "agents/schedule-trip" \
  '{
    "userId": "test-user-001",
    "action": "schedule",
    "pickupLocation": {
      "latitude": -1.9536,
      "longitude": 30.0606,
      "address": "Kigali City Tower"
    },
    "dropoffLocation": {
      "latitude": -1.9440,
      "longitude": 30.0619,
      "address": "Kigali Convention Centre"
    },
    "scheduledTime": "2025-01-10T08:00:00Z",
    "vehiclePreference": "Moto",
    "recurrence": "weekdays",
    "notificationMinutes": 30,
    "maxPrice": 5000,
    "notes": "Morning commute to work"
  }' \
  "tripId\|success"

# Test 4: Schedule Trip - Analyze Patterns
run_test \
  "Schedule Trip: Analyze travel patterns" \
  "agents/schedule-trip" \
  '{
    "userId": "test-user-001",
    "action": "analyze_patterns"
  }' \
  "hasPatterns\|message"

# Test 5: Schedule Trip - Get Predictions
run_test \
  "Schedule Trip: Get trip predictions" \
  "agents/schedule-trip" \
  '{
    "userId": "test-user-001",
    "action": "get_predictions"
  }' \
  "predictions"

# Test 6: Quincaillerie - Search Hardware Items
run_test \
  "Quincaillerie: Search for hardware items" \
  "agents/quincaillerie" \
  '{
    "userId": "test-user-001",
    "action": "find",
    "items": ["cement", "nails", "paint"],
    "location": {
      "latitude": -1.9536,
      "longitude": 30.0606,
      "address": "Kigali"
    },
    "maxBudget": 100000
  }' \
  "searchId\|success\|quotes"

# Test 7: Shops - Add New Shop
run_test \
  "Shops: Add new shop listing" \
  "agents/shops" \
  '{
    "userId": "test-vendor-001",
    "action": "add",
    "shopData": {
      "name": "SuperMart Kimironko",
      "category": "supermarket",
      "description": "Fresh groceries and household items",
      "location": {
        "latitude": -1.9536,
        "longitude": 30.0606,
        "address": "Kimironko, Kigali"
      },
      "phone": "+250788123456",
      "catalogUrl": "https://wa.me/c/250788123456"
    }
  }' \
  "shopId\|success"

# Test 8: Shops - Find Products
run_test \
  "Shops: Search for products" \
  "agents/shops" \
  '{
    "userId": "test-user-001",
    "action": "find",
    "products": ["milk", "bread", "eggs"],
    "location": {
      "latitude": -1.9536,
      "longitude": 30.0606
    },
    "shopCategory": "supermarket"
  }' \
  "searchId\|success"

# Test 9: Property Rental - Short-term Rental
run_test \
  "Property Rental: Find short-term rental" \
  "agents/property-rental" \
  '{
    "userId": "test-user-002",
    "action": "find",
    "rentalType": "short_term",
    "bedrooms": 2,
    "maxBudget": 200000,
    "location": {
      "latitude": -1.9440,
      "longitude": 30.0619,
      "address": "Nyarugenge"
    }
  }' \
  "searchId\|success"

# Test 10: Schedule Trip - Daily Recurring Trip
run_test \
  "Schedule Trip: Daily recurring trip" \
  "agents/schedule-trip" \
  '{
    "userId": "test-user-002",
    "action": "schedule",
    "pickupLocation": {
      "latitude": -1.9700,
      "longitude": 30.1040,
      "address": "Remera"
    },
    "dropoffLocation": {
      "latitude": -1.9536,
      "longitude": 30.0606,
      "address": "City Centre"
    },
    "scheduledTime": "2025-01-10T07:30:00Z",
    "vehiclePreference": "Cab",
    "recurrence": "daily",
    "notificationMinutes": 45
  }' \
  "tripId\|success"

# Summary
echo "================================"
echo "📊 Test Results Summary"
echo "================================"
echo -e "Tests run:    ${BLUE}$TESTS_RUN${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
    exit 1
fi
