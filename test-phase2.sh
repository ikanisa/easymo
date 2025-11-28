#!/bin/bash
# AI Architecture Phase 2 - Test Script

set -e

echo "🧪 Testing Phase 2: Google Integrations"
echo "========================================"
echo ""

BASE_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function test_endpoint() {
    local name=$1
    local url=$2
    local data=$3
    
    echo -e "${YELLOW}Testing: $name${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$url" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ Success${NC}"
        echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "$body" | jq -C '.' 2>/dev/null || echo "$body"
    fi
    
    echo ""
}

# Test 1: Google Maps - Search
test_endpoint \
    "Maps: Search places" \
    "/api/integrations/maps" \
    '{"action":"search","params":{"query":"restaurants in Kigali"}}'

# Test 2: Google Maps - Geocode
test_endpoint \
    "Maps: Geocode address" \
    "/api/integrations/maps" \
    '{"action":"geocode","params":{"address":"Kigali Convention Centre, Rwanda"}}'

# Test 3: Google Maps - Nearby
test_endpoint \
    "Maps: Find nearby places" \
    "/api/integrations/maps" \
    '{"action":"nearby","params":{"location":{"lat":-1.9536,"lng":30.0606},"radius":5000,"type":"restaurant"}}'

# Test 4: Grounding - Factual
test_endpoint \
    "Grounding: Factual response" \
    "/api/ai/grounding" \
    '{"query":"What is the capital of Rwanda?","action":"factual"}'

# Test 5: Grounding - Recent
test_endpoint \
    "Grounding: Recent information" \
    "/api/ai/grounding" \
    '{"query":"Rwanda technology sector","action":"recent"}'

# Test 6: Voice - Create session
test_endpoint \
    "Voice: Create session" \
    "/api/ai/voice" \
    '{"action":"create_session","voiceConfig":{"voiceName":"Kore"}}'

echo "======================================"
echo "✅ Phase 2 testing complete!"
echo ""
echo "Note: Some tests may fail if API keys are not configured."
echo "Add GOOGLE_MAPS_API_KEY to admin-app/.env.local"
