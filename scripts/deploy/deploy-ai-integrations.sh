#!/bin/bash
# AI Integrations Deployment Script
# Deploys all AI components: Google AI, OpenAI Realtime, SIP Trunk

set -e

echo "🚀 EasyMO AI Integrations Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check required environment variables
echo "📋 Checking environment variables..."

REQUIRED_VARS=(
  "GOOGLE_CLOUD_API_KEY"
  "OPENAI_API_KEY"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "TWILIO_ACCOUNT_SID"
  "TWILIO_AUTH_TOKEN"
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
  echo "Please set these variables in your .env file or export them:"
  echo "  export GOOGLE_CLOUD_API_KEY=your-key"
  echo "  export OPENAI_API_KEY=your-key"
  echo "  etc..."
  exit 1
fi

echo -e "${GREEN}✅ All required environment variables set${NC}"
echo ""

# 1. Deploy Supabase Edge Functions
echo "📦 Deploying Supabase Edge Functions..."
echo ""

# Deploy twilio-voice-webhook
echo "  → Deploying twilio-voice-webhook..."
supabase functions deploy twilio-voice-webhook

# Deploy wa-agent-call-center (updated with Google AI)
echo "  → Deploying wa-agent-call-center..."
supabase functions deploy wa-agent-call-center

echo -e "${GREEN}✅ Supabase functions deployed${NC}"
echo ""

# 2. Set Supabase Secrets
echo "🔐 Setting Supabase secrets..."

supabase secrets set \
  GOOGLE_CLOUD_API_KEY="$GOOGLE_CLOUD_API_KEY" \
  USE_GOOGLE_AI=true \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" \
  TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID"

echo -e "${GREEN}✅ Secrets set${NC}"
echo ""

# 3. Build and deploy Voice Gateway
echo "🎙️ Building Voice Gateway service..."
cd services/voice-gateway

# Install dependencies
echo "  → Installing dependencies..."
pnpm install --frozen-lockfile

# Build
echo "  → Building TypeScript..."
pnpm build

# Check if Docker is available
if command -v docker &> /dev/null; then
  echo "  → Building Docker image..."
  docker build -t voice-gateway:latest .
  
  # Tag for Google Container Registry if GCP_PROJECT is set
  if [ -n "$GCP_PROJECT" ]; then
    docker tag voice-gateway:latest gcr.io/$GCP_PROJECT/voice-gateway:latest
    echo "  → Pushing to GCR..."
    docker push gcr.io/$GCP_PROJECT/voice-gateway:latest
    
    echo "  → Deploying to Cloud Run..."
    gcloud run deploy voice-gateway \
      --image gcr.io/$GCP_PROJECT/voice-gateway:latest \
      --platform managed \
      --region us-central1 \
      --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY,SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY,OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-10-01" \
      --allow-unauthenticated \
      --port 3002
    
    VOICE_GATEWAY_URL=$(gcloud run services describe voice-gateway --region us-central1 --format 'value(status.url)')
    echo ""
    echo -e "${GREEN}✅ Voice Gateway deployed to: $VOICE_GATEWAY_URL${NC}"
  else
    echo -e "${YELLOW}⚠️  GCP_PROJECT not set. Skipping Cloud Run deployment.${NC}"
    echo "   Docker image built locally as 'voice-gateway:latest'"
  fi
else
  echo -e "${YELLOW}⚠️  Docker not available. Skipping Docker build.${NC}"
fi

cd ../..

echo -e "${GREEN}✅ Voice Gateway ready${NC}"
echo ""

# 4. Configure Twilio
echo "📞 Twilio Configuration"
echo ""
echo "To complete setup, configure these webhook URLs in Twilio Console:"
echo ""
echo "  Voice Webhook URL:"
echo "    ${SUPABASE_URL}/functions/v1/twilio-voice-webhook/voice"
echo ""
echo "  Status Callback URL:"
echo "    ${SUPABASE_URL}/functions/v1/twilio-voice-webhook/status"
echo ""
echo "  Voice Gateway URL (for Media Streams):"
if [ -n "$VOICE_GATEWAY_URL" ]; then
  echo "    ${VOICE_GATEWAY_URL}/stream"
else
  echo "    https://your-voice-gateway-url/stream"
fi
echo ""

# 5. Health Checks
echo "🏥 Running health checks..."
echo ""

# Check Supabase functions
echo "  → Checking twilio-voice-webhook..."
TWILIO_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/functions/v1/twilio-voice-webhook/health" || echo "000")
if [ "$TWILIO_HEALTH" = "200" ]; then
  echo -e "     ${GREEN}✅ twilio-voice-webhook healthy${NC}"
else
  echo -e "     ${RED}❌ twilio-voice-webhook unreachable (HTTP $TWILIO_HEALTH)${NC}"
fi

echo "  → Checking wa-agent-call-center..."
CALL_CENTER_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/functions/v1/wa-agent-call-center/health" || echo "000")
if [ "$CALL_CENTER_HEALTH" = "200" ]; then
  echo -e "     ${GREEN}✅ wa-agent-call-center healthy${NC}"
else
  echo -e "     ${RED}❌ wa-agent-call-center unreachable (HTTP $CALL_CENTER_HEALTH)${NC}"
fi

# Check Voice Gateway if URL is set
if [ -n "$VOICE_GATEWAY_URL" ]; then
  echo "  → Checking voice-gateway..."
  GATEWAY_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${VOICE_GATEWAY_URL}/health" || echo "000")
  if [ "$GATEWAY_HEALTH" = "200" ]; then
    echo -e "     ${GREEN}✅ voice-gateway healthy${NC}"
  else
    echo -e "     ${RED}❌ voice-gateway unreachable (HTTP $GATEWAY_HEALTH)${NC}"
  fi
fi

echo ""
echo "======================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Configure Twilio webhook URLs (see above)"
echo "2. Test with a WhatsApp voice message"
echo "3. Test with a phone call to your Twilio number"
echo "4. Monitor logs: supabase functions logs"
echo ""
echo "Documentation: AI_INTEGRATIONS_COMPLETE.md"
echo ""
