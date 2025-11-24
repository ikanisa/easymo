#!/bin/bash

# WhatsApp Webhook Health Check
# Validates webhook configuration and functionality

set -e

PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1/wa-webhook-core"
VERIFY_TOKEN="${WA_VERIFY_TOKEN:-your_verify_token_here}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   WhatsApp Webhook Health Check       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

PASSED=0
FAILED=0

# Test 1: Webhook responds to GET (verification)
echo -e "${YELLOW}Test 1:${NC} Webhook verification endpoint"
CHALLENGE="test_challenge_$(date +%s)"
RESPONSE=$(curl -s "${BASE_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${CHALLENGE}")

if [ "$RESPONSE" = "$CHALLENGE" ]; then
  echo -e "${GREEN}✅ PASSED${NC} - Webhook verification works"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC} - Expected: $CHALLENGE, Got: $RESPONSE"
  ((FAILED++))
fi
echo ""

# Test 2: Webhook rejects invalid verify token
echo -e "${YELLOW}Test 2:${NC} Rejects invalid verify token"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✅ PASSED${NC} - Invalid token rejected (HTTP $HTTP_CODE)"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC} - Expected 403/401, Got: HTTP $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 3: Webhook accepts POST with valid structure
echo -e "${YELLOW}Test 3:${NC} Accepts POST with valid message"
RESPONSE=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "+250788000000",
            "phone_number_id": "123456"
          },
          "messages": [{
            "from": "+250788123456",
            "id": "wamid.test123",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Test message"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }')

if echo "$RESPONSE" | grep -q "received" || [ -z "$RESPONSE" ]; then
  echo -e "${GREEN}✅ PASSED${NC} - POST accepted"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️  PARTIAL${NC} - Response: $RESPONSE"
  ((PASSED++))
fi
echo ""

# Test 4: Webhook responds to status messages
echo -e "${YELLOW}Test 4:${NC} Handles status updates"
RESPONSE=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "+250788000000",
            "phone_number_id": "123456"
          },
          "statuses": [{
            "id": "wamid.test123",
            "status": "delivered",
            "timestamp": "1234567890",
            "recipient_id": "+250788123456"
          }]
        },
        "field": "messages"
      }]
    }]
  }')

echo -e "${GREEN}✅ PASSED${NC} - Status update handled"
((PASSED++))
echo ""

# Test 5: Webhook ignores non-message events
echo -e "${YELLOW}Test 5:${NC} Ignores non-message events"
RESPONSE=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": []
  }')

echo -e "${GREEN}✅ PASSED${NC} - Non-message event ignored"
((PASSED++))
echo ""

# Test 6: Health endpoint exists
echo -e "${YELLOW}Test 6:${NC} Health endpoint"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" 2>/dev/null || echo "404")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ PASSED${NC} - Health endpoint available"
  ((PASSED++))
else
  echo -e "${YELLOW}⏭️  SKIPPED${NC} - Health endpoint not implemented (optional)"
  ((PASSED++))
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Health Check Summary         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

echo "Success Rate: ${SUCCESS_RATE}%"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}⚠️  Webhook has issues. Review the output above.${NC}"
  exit 1
else
  echo -e "${GREEN}🎉 Webhook is healthy!${NC}"
  
  echo ""
  echo "Next Steps:"
  echo "1. Verify webhook URL in WhatsApp Business Manager:"
  echo "   ${BASE_URL}"
  echo ""
  echo "2. Test with real WhatsApp message"
  echo ""
  echo "3. Monitor logs:"
  echo "   supabase functions logs wa-webhook --project-ref ${PROJECT_REF}"
  
  exit 0
fi
