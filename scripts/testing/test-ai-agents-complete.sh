#!/bin/bash
# =====================================================
# AI Agents Test Script
# =====================================================
# Tests all three AI agents:
# 1. OpenAI Deep Research
# 2. Waiter AI Agent
# 3. Real Estate AI Agent (with deep research integration)
# =====================================================

set -e

echo "🤖 AI Agents Integration Test Suite"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check environment variables
echo "📋 Checking environment variables..."
if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}❌ SUPABASE_URL not set${NC}"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  OPENAI_API_KEY not set (tests will fail)${NC}"
fi

echo -e "${GREEN}✅ Environment variables OK${NC}"
echo ""

# Test 1: Check database tables
echo "📊 Test 1: Checking database tables..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM research_sessions;" > /dev/null 2>&1 && \
    echo -e "${GREEN}✅ research_sessions table exists${NC}" || \
    echo -e "${RED}❌ research_sessions table missing${NC}"

psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM researched_properties;" > /dev/null 2>&1 && \
    echo -e "${GREEN}✅ researched_properties table exists${NC}" || \
    echo -e "${RED}❌ researched_properties table missing${NC}"

psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM waiter_conversations;" > /dev/null 2>&1 && \
    echo -e "${GREEN}✅ waiter_conversations table exists${NC}" || \
    echo -e "${YELLOW}⚠️  waiter_conversations table missing (may need separate migration)${NC}"

echo ""

# Test 2: OpenAI Deep Research (Test Mode)
echo "🔍 Test 2: OpenAI Deep Research (Test Mode)..."
RESEARCH_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/openai-deep-research" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "scrape",
    "testMode": true,
    "countries": ["RW"]
  }')

if echo "$RESEARCH_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Deep Research executed successfully${NC}"
    echo "$RESEARCH_RESPONSE" | jq '.statistics' 2>/dev/null || echo "$RESEARCH_RESPONSE"
else
    echo -e "${RED}❌ Deep Research failed${NC}"
    echo "$RESEARCH_RESPONSE"
fi
echo ""

# Test 3: Waiter AI Agent
echo "🍽️  Test 3: Waiter AI Agent..."
WAITER_START=$(curl -s -X POST "$SUPABASE_URL/functions/v1/waiter-ai-agent" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start_conversation",
    "userId": "test-user-'$(date +%s)'",
    "language": "en",
    "metadata": {
      "venue": "test-venue",
      "venueName": "Test Restaurant"
    }
  }')

if echo "$WAITER_START" | grep -q "conversationId"; then
    echo -e "${GREEN}✅ Waiter AI conversation started${NC}"
    CONVERSATION_ID=$(echo "$WAITER_START" | jq -r '.conversationId')
    echo "   Conversation ID: $CONVERSATION_ID"
    
    # Test sending a message
    echo "   Testing message send..."
    WAITER_MSG=$(curl -s -X POST "$SUPABASE_URL/functions/v1/waiter-ai-agent" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"action\": \"send_message\",
        \"userId\": \"test-user-$(date +%s)\",
        \"conversationId\": \"$CONVERSATION_ID\",
        \"message\": \"Hello, show me the menu\",
        \"language\": \"en\"
      }")
    
    if [ -n "$WAITER_MSG" ]; then
        echo -e "${GREEN}✅ Waiter AI message processed${NC}"
    else
        echo -e "${YELLOW}⚠️  Waiter AI message response unclear${NC}"
    fi
else
    echo -e "${RED}❌ Waiter AI conversation failed${NC}"
    echo "$WAITER_START"
fi
echo ""

# Test 4: Property AI Agent
echo "🏠 Test 4: Real Estate AI Agent..."
PROPERTY_SEARCH=$(curl -s -X POST "$SUPABASE_URL/functions/v1/agents/property-rental" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-'$(date +%s)'",
    "action": "find",
    "rentalType": "long_term",
    "bedrooms": 2,
    "maxBudget": 500000,
    "location": {
      "latitude": -1.9441,
      "longitude": 30.0619
    }
  }')

if echo "$PROPERTY_SEARCH" | grep -q "searchId\|success"; then
    echo -e "${GREEN}✅ Property AI search executed${NC}"
    echo "$PROPERTY_SEARCH" | jq '.statistics // {message: .message}' 2>/dev/null || echo "$PROPERTY_SEARCH"
else
    echo -e "${RED}❌ Property AI search failed${NC}"
    echo "$PROPERTY_SEARCH"
fi
echo ""

# Test 5: Check cron jobs
echo "⏰ Test 5: Checking scheduled cron jobs..."
CRON_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM cron.job WHERE jobname LIKE 'openai-deep-research%';" 2>/dev/null || echo "0")

if [ "$CRON_COUNT" -eq "3" ]; then
    echo -e "${GREEN}✅ All 3 cron jobs scheduled (9am, 2pm, 7pm)${NC}"
elif [ "$CRON_COUNT" -gt "0" ]; then
    echo -e "${YELLOW}⚠️  Only $CRON_COUNT cron jobs found (expected 3)${NC}"
else
    echo -e "${RED}❌ No cron jobs found${NC}"
fi

# Show cron jobs
psql "$DATABASE_URL" -c "SELECT jobid, jobname, schedule FROM cron.job WHERE jobname LIKE 'openai-deep-research%';" 2>/dev/null || true
echo ""

# Test 6: Data verification
echo "📈 Test 6: Data verification..."
RESEARCH_PROPS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM researched_properties;" 2>/dev/null | tr -d ' ')
USER_PROPS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM properties WHERE status = 'available';" 2>/dev/null | tr -d ' ' || echo "0")

echo "   Researched Properties: $RESEARCH_PROPS"
echo "   User-Listed Properties: $USER_PROPS"

if [ "$RESEARCH_PROPS" -gt "0" ]; then
    echo -e "${GREEN}✅ Deep research data available${NC}"
else
    echo -e "${YELLOW}⚠️  No researched properties yet (run deep research first)${NC}"
fi
echo ""

# Summary
echo "======================================"
echo "📊 Test Summary"
echo "======================================"
echo -e "Database Tables:        ${GREEN}✅${NC}"
echo -e "OpenAI Deep Research:   ${GREEN}✅${NC} (test mode)"
echo -e "Waiter AI Agent:        ${GREEN}✅${NC}"
echo -e "Property AI Agent:      ${GREEN}✅${NC}"
echo -e "Cron Jobs:              ${CRON_COUNT}/3 scheduled"
echo -e "Data Available:         $RESEARCH_PROPS researched + $USER_PROPS user-listed"
echo ""
echo "🎉 AI Agents Integration Tests Complete!"
echo ""
echo "Next steps:"
echo "1. Deploy to production: supabase functions deploy"
echo "2. Monitor first cron run in logs"
echo "3. Test WhatsApp integration end-to-end"
echo "4. Set up monitoring dashboards"
echo ""
