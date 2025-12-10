#!/usr/bin/env bash
#
# Voice Calls Deployment Script
# Deploys OpenAI SIP Realtime integration for WhatsApp voice calls
#

set -euo pipefail

echo "🎙️  EasyMO Voice Calls Deployment"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Verify environment variables
echo "📋 Step 1: Verifying environment variables..."
echo ""

REQUIRED_VARS=(
  "OPENAI_API_KEY"
  "OPENAI_PROJECT_ID"
  "OPENAI_WEBHOOK_SECRET"
  "WHATSAPP_ACCESS_TOKEN"
  "WHATSAPP_PHONE_NUMBER_ID"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if supabase secrets list | grep -q "$var"; then
    echo -e "${GREEN}✓${NC} $var is set"
  else
    echo -e "${RED}✗${NC} $var is missing"
    MISSING_VARS+=("$var")
  fi
done

echo ""

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo -e "${RED}❌ Missing required environment variables:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "   - $var"
  done
  echo ""
  echo "Set them with:"
  echo "  supabase secrets set $var=\"your-value-here\""
  exit 1
fi

echo -e "${GREEN}✅ All environment variables configured${NC}"
echo ""

# Step 2: Deploy function
echo "📦 Step 2: Deploying openai-sip-webhook function..."
echo ""

supabase functions deploy openai-sip-webhook

echo ""
echo -e "${GREEN}✅ Function deployed successfully${NC}"
echo ""

# Step 3: Show webhook URL
echo "🔗 Step 3: OpenAI Webhook Configuration"
echo ""
echo "Configure this webhook in OpenAI Dashboard:"
echo ""
echo -e "${YELLOW}URL:${NC} https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook"
echo -e "${YELLOW}Events:${NC} realtime.call.incoming, realtime.call.ended"
echo -e "${YELLOW}Secret:${NC} whsec_7B7U3XqU7ZuFzUvBauNsYDITpdGbPXcIAavH1XtH9d4="
echo ""

# Step 4: Show SIP configuration
echo "📞 Step 4: WhatsApp SIP Configuration"
echo ""
echo "Configure SIP routing in Facebook Developer Console:"
echo ""
echo -e "${YELLOW}SIP URI:${NC} sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls"
echo ""

# Step 5: Test
echo "🧪 Step 5: Testing endpoint..."
echo ""

HEALTH_CHECK=$(curl -s https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook/health)

if echo "$HEALTH_CHECK" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Health check passed:${NC}"
  echo "$HEALTH_CHECK" | jq '.'
else
  echo -e "${RED}❌ Health check failed:${NC}"
  echo "$HEALTH_CHECK"
  exit 1
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Configure OpenAI Webhook (see URL above)"
echo "   → Go to: https://platform.openai.com/settings/organization/webhooks"
echo ""
echo "2. Configure WhatsApp SIP routing (see SIP URI above)"
echo "   → Go to: Facebook Developer Console → WhatsApp → Configuration"
echo ""
echo "3. Test with a live call:"
echo "   → Call your WhatsApp Business number"
echo "   → You should hear the AI greeting"
echo ""
echo "For detailed instructions, see:"
echo "  📄 VOICE_CALLS_IMPLEMENTATION_AUDIT.md"
echo ""
