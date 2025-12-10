#!/bin/bash
# AI Integrations Test Script
# Quick validation that all components are working

set -e

echo "🧪 AI Integrations Test Suite"
echo "============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

# Test function
test_endpoint() {
  local name=$1
  local url=$2
  local expected=$3
  
  echo -n "Testing $name... "
  
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  
  if [ "$response" = "$expected" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} (HTTP $response, expected $expected)"
    ((FAILED++))
  fi
}

# Check environment
echo "📋 Checking environment..."
if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}❌ SUPABASE_URL not set${NC}"
  echo "Please export required environment variables"
  exit 1
fi
echo -e "${GREEN}✅ Environment OK${NC}"
echo ""

# Test Supabase Functions
echo "🔹 Testing Supabase Edge Functions"
test_endpoint "twilio-voice-webhook" "${SUPABASE_URL}/functions/v1/twilio-voice-webhook/health" "200"
test_endpoint "wa-agent-call-center" "${SUPABASE_URL}/functions/v1/wa-agent-call-center/health" "200"
echo ""

# Test Voice Gateway (if URL is set)
if [ -n "$VOICE_GATEWAY_URL" ]; then
  echo "🔹 Testing Voice Gateway"
  test_endpoint "voice-gateway health" "${VOICE_GATEWAY_URL}/health" "200"
  echo ""
fi

# Test Google AI (optional - requires API key)
if [ -n "$GOOGLE_CLOUD_API_KEY" ]; then
  echo "🔹 Testing Google Cloud AI APIs"
  
  # Test Speech-to-Text API
  echo -n "Testing Google STT API... "
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_CLOUD_API_KEY}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"config":{"encoding":"OGG_OPUS","languageCode":"en-US"},"audio":{"content":""}}' \
    2>/dev/null || echo "000")
  
  if [ "$response" = "400" ]; then
    # 400 is expected for empty audio - means API is accessible
    echo -e "${GREEN}✅ PASS${NC} (API accessible)"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠️  WARN${NC} (HTTP $response - check API key)"
  fi
  
  # Test Translate API
  echo -n "Testing Google Translate API... "
  response=$(curl -s \
    "https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_CLOUD_API_KEY}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"q":"Hello"}' 2>/dev/null)
  
  if echo "$response" | grep -q "detections"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}"
    ((FAILED++))
  fi
  
  echo ""
fi

# Test OpenAI (optional - requires API key)
if [ -n "$OPENAI_API_KEY" ]; then
  echo "🔹 Testing OpenAI APIs"
  
  echo -n "Testing OpenAI API access... "
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://api.openai.com/v1/models" \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    2>/dev/null || echo "000")
  
  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} (HTTP $response)"
    ((FAILED++))
  fi
  
  echo ""
fi

# Summary
echo "============================="
echo "Test Results:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "  ${RED}Failed: $FAILED${NC}"
else
  echo -e "  Failed: 0"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Send a WhatsApp voice message to test Google AI"
  echo "2. Make a test call to your Twilio number"
  echo "3. Monitor logs: supabase functions logs"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo ""
  echo "Check:"
  echo "1. All services are deployed"
  echo "2. Environment variables are set correctly"
  echo "3. API keys are valid"
  exit 1
fi
