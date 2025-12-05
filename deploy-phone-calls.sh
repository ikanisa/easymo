#!/bin/bash
# Deploy Phone Calls Integration (SIP Trunk)
# Works with: Twilio, MTN Rwanda, GO Malta, or any SIP provider
# Plug-and-Play: Just add SIP credentials and run!

set -e

echo "📞 Phone Calls Deployment (SIP Trunk)"
echo "====================================="
echo "Supports: Twilio, MTN Rwanda, GO Malta, Any SIP Provider"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Detect SIP provider
echo "🔍 Detecting SIP provider..."
echo ""

SIP_PROVIDER=""

if [ -n "$TWILIO_ACCOUNT_SID" ] && [ -n "$TWILIO_AUTH_TOKEN" ]; then
  SIP_PROVIDER="twilio"
  echo -e "${GREEN}✅ Twilio credentials detected${NC}"
elif [ -n "$MTN_SIP_USERNAME" ] && [ -n "$MTN_SIP_PASSWORD" ]; then
  SIP_PROVIDER="mtn"
  echo -e "${GREEN}✅ MTN Rwanda credentials detected${NC}"
elif [ -n "$GO_SIP_USERNAME" ] && [ -n "$GO_SIP_PASSWORD" ]; then
  SIP_PROVIDER="go_malta"
  echo -e "${GREEN}✅ GO Malta credentials detected${NC}"
elif [ -n "$SIP_USERNAME" ] && [ -n "$SIP_PASSWORD" ] && [ -n "$SIP_DOMAIN" ]; then
  SIP_PROVIDER="generic"
  echo -e "${GREEN}✅ Generic SIP credentials detected${NC}"
else
  echo -e "${RED}❌ No SIP credentials found${NC}"
  echo ""
  echo "Please set credentials for your SIP provider:"
  echo ""
  echo "For Twilio:"
  echo "  export TWILIO_ACCOUNT_SID=your-sid"
  echo "  export TWILIO_AUTH_TOKEN=your-token"
  echo "  export TWILIO_PHONE_NUMBER=+1234567890"
  echo ""
  echo "For MTN Rwanda:"
  echo "  export MTN_SIP_USERNAME=your-username"
  echo "  export MTN_SIP_PASSWORD=your-password"
  echo "  export MTN_SIP_DOMAIN=sip.mtn.rw"
  echo "  export MTN_PHONE_NUMBER=+250123456789"
  echo ""
  echo "For GO Malta:"
  echo "  export GO_SIP_USERNAME=your-username"
  echo "  export GO_SIP_PASSWORD=your-password"
  echo "  export GO_SIP_DOMAIN=sip.go.com.mt"
  echo "  export GO_PHONE_NUMBER=+35621234567"
  echo ""
  echo "For Generic SIP:"
  echo "  export SIP_USERNAME=your-username"
  echo "  export SIP_PASSWORD=your-password"
  echo "  export SIP_DOMAIN=sip.yourprovider.com"
  echo "  export SIP_PHONE_NUMBER=+1234567890"
  exit 1
fi

echo ""
echo "Using SIP Provider: ${SIP_PROVIDER}"
echo ""

# Check required environment variables
echo "📋 Checking environment variables..."

REQUIRED_VARS=(
  "OPENAI_API_KEY"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "VOICE_GATEWAY_URL"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo -e "${RED}❌ Missing required environment variables:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "   - $var"
  done
  echo ""
  echo "Please set:"
  echo "  export OPENAI_API_KEY=your-key"
  echo "  export SUPABASE_URL=https://your-project.supabase.co"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=your-key"
  echo "  export VOICE_GATEWAY_URL=https://your-voice-gateway.com"
  exit 1
fi

echo -e "${GREEN}✅ All required environment variables set${NC}"
echo ""

# Deploy SIP webhook
echo "📦 Deploying SIP webhook (${SIP_PROVIDER})..."
echo ""

# Deploy the webhook function
supabase functions deploy sip-voice-webhook

echo -e "${GREEN}✅ SIP webhook deployed${NC}"
echo ""

# Set Supabase Secrets based on provider
echo "🔐 Setting SIP credentials..."

case $SIP_PROVIDER in
  twilio)
    supabase secrets set \
      SIP_PROVIDER=twilio \
      TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" \
      TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" \
      SIP_PHONE_NUMBER="${TWILIO_PHONE_NUMBER:-+1234567890}" \
      VOICE_GATEWAY_URL="$VOICE_GATEWAY_URL"
    ;;
  mtn)
    supabase secrets set \
      SIP_PROVIDER=mtn \
      MTN_SIP_USERNAME="$MTN_SIP_USERNAME" \
      MTN_SIP_PASSWORD="$MTN_SIP_PASSWORD" \
      MTN_SIP_DOMAIN="${MTN_SIP_DOMAIN:-sip.mtn.rw}" \
      SIP_PHONE_NUMBER="${MTN_PHONE_NUMBER:-+250123456789}" \
      VOICE_GATEWAY_URL="$VOICE_GATEWAY_URL"
    ;;
  go_malta)
    supabase secrets set \
      SIP_PROVIDER=go_malta \
      GO_SIP_USERNAME="$GO_SIP_USERNAME" \
      GO_SIP_PASSWORD="$GO_SIP_PASSWORD" \
      GO_SIP_DOMAIN="${GO_SIP_DOMAIN:-sip.go.com.mt}" \
      SIP_PHONE_NUMBER="${GO_PHONE_NUMBER:-+35621234567}" \
      VOICE_GATEWAY_URL="$VOICE_GATEWAY_URL"
    ;;
  generic)
    supabase secrets set \
      SIP_PROVIDER=generic \
      SIP_USERNAME="$SIP_USERNAME" \
      SIP_PASSWORD="$SIP_PASSWORD" \
      SIP_DOMAIN="$SIP_DOMAIN" \
      SIP_PHONE_NUMBER="${SIP_PHONE_NUMBER:-+1234567890}" \
      VOICE_GATEWAY_URL="$VOICE_GATEWAY_URL"
    ;;
esac

echo -e "${GREEN}✅ SIP credentials configured${NC}"
echo ""

# Health check
echo "🏥 Running health check..."
echo ""

WEBHOOK_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/functions/v1/sip-voice-webhook/health" || echo "000")

if [ "$WEBHOOK_HEALTH" = "200" ]; then
  echo -e "  ${GREEN}✅ sip-voice-webhook healthy${NC}"
else
  echo -e "  ${RED}❌ sip-voice-webhook unreachable (HTTP $WEBHOOK_HEALTH)${NC}"
fi

echo ""
echo "======================================"
echo -e "${GREEN}🎉 Phone Calls Deployment Complete!${NC}"
echo "======================================"
echo ""
echo "Provider: $SIP_PROVIDER"
echo ""
echo "What's deployed:"
echo "  ✅ sip-voice-webhook (Universal SIP handler)"
echo "  ✅ Voice Gateway connection"
echo "  ✅ OpenAI Realtime API integration"
echo "  ✅ AGI Bridge with 20 tools"
echo ""
echo "Webhook URL:"
echo "  ${SUPABASE_URL}/functions/v1/sip-voice-webhook"
echo ""
echo "Next steps for ${SIP_PROVIDER}:"
echo ""

case $SIP_PROVIDER in
  twilio)
    echo "1. Configure Twilio phone number:"
    echo "   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/active"
    echo "   - Select your number: ${TWILIO_PHONE_NUMBER:-+1234567890}"
    echo "   - Voice & Fax → Configure with:"
    echo ""
    echo "   A CALL COMES IN:"
    echo "     Webhook: ${SUPABASE_URL}/functions/v1/sip-voice-webhook/voice"
    echo "     HTTP POST"
    echo ""
    echo "   CALL STATUS CHANGES:"
    echo "     Webhook: ${SUPABASE_URL}/functions/v1/sip-voice-webhook/status"
    echo "     HTTP POST"
    ;;
  mtn)
    echo "1. Configure MTN Rwanda SIP trunk:"
    echo "   - Contact MTN support with webhook URL"
    echo "   - Provide: ${SUPABASE_URL}/functions/v1/sip-voice-webhook/voice"
    echo "   - Request: Incoming call routing to webhook"
    echo ""
    echo "2. MTN will configure:"
    echo "   - SIP domain: ${MTN_SIP_DOMAIN:-sip.mtn.rw}"
    echo "   - Your number: ${MTN_PHONE_NUMBER:-+250123456789}"
    echo "   - Inbound routing: HTTP POST to webhook"
    ;;
  go_malta)
    echo "1. Configure GO Malta SIP trunk:"
    echo "   - Contact GO support with webhook URL"
    echo "   - Provide: ${SUPABASE_URL}/functions/v1/sip-voice-webhook/voice"
    echo "   - Request: Incoming call routing to webhook"
    echo ""
    echo "2. GO will configure:"
    echo "   - SIP domain: ${GO_SIP_DOMAIN:-sip.go.com.mt}"
    echo "   - Your number: ${GO_PHONE_NUMBER:-+35621234567}"
    echo "   - Inbound routing: HTTP POST to webhook"
    ;;
  generic)
    echo "1. Configure your SIP provider:"
    echo "   - Contact support with webhook URL"
    echo "   - Provide: ${SUPABASE_URL}/functions/v1/sip-voice-webhook/voice"
    echo "   - Request: Incoming call routing via HTTP webhook"
    echo ""
    echo "2. Provider should configure:"
    echo "   - SIP domain: ${SIP_DOMAIN}"
    echo "   - Your number: ${SIP_PHONE_NUMBER}"
    echo "   - Inbound routing: HTTP POST to webhook"
    ;;
esac

echo ""
echo "3. Test the integration:"
echo "   - Call your number: ${SIP_PHONE_NUMBER:-configured number}"
echo "   - Should connect to AI"
echo "   - Try: 'I need a ride from Kigali to Airport'"
echo ""
echo "4. Monitor logs:"
echo "   supabase functions logs sip-voice-webhook --tail"
echo ""
echo "   gcloud run services logs read voice-gateway --region us-central1 --tail"
echo ""
echo "Documentation:"
echo "  - PHONE_CALLS_SETUP_GUIDE.md"
echo "  - SIP_PROVIDERS_CONFIG.md"
echo ""
