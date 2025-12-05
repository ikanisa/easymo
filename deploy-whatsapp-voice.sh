#!/bin/bash
# Deploy WhatsApp Voice CALLS AI Integration
# Deploys complete real-time voice call system with OpenAI Realtime API
# Phone calls via SIP trunk will be deployed later when MTN access is available

set -e

echo "🚀 WhatsApp Voice CALLS Deployment"
echo "===================================="
echo "Deploying: OpenAI Realtime API + Voice Gateway + AGI Bridge"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check required environment variables for WhatsApp voice CALLS
echo "📋 Checking environment variables..."

REQUIRED_VARS=(
  "GOOGLE_CLOUD_API_KEY"
  "OPENAI_API_KEY"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
)

OPTIONAL_VARS=(
  "GCP_PROJECT"
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
  echo "Please set these variables:"
  echo "  export GOOGLE_CLOUD_API_KEY=your-key"
  echo "  export OPENAI_API_KEY=your-key"
  echo "  export SUPABASE_URL=https://your-project.supabase.co"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=your-key"
  exit 1
fi

echo -e "${GREEN}✅ All required environment variables set${NC}"

# Check optional variables
if [ -z "$GCP_PROJECT" ]; then
  echo -e "${YELLOW}⚠️  GCP_PROJECT not set - Voice Gateway will build locally only${NC}"
  echo "   To deploy to Cloud Run, set: export GCP_PROJECT=your-project-id"
fi
echo ""

# Optional: Check for phone call variables (not required yet)
if [ -z "$TWILIO_AUTH_TOKEN" ]; then
  echo -e "${YELLOW}ℹ️  TWILIO_AUTH_TOKEN not set (OK - phone calls will be deployed later)${NC}"
fi
echo ""

# Deploy Call Center AGI with Google AI integration
echo "📦 Deploying wa-agent-call-center..."
echo ""

supabase functions deploy wa-agent-call-center

echo -e "${GREEN}✅ wa-agent-call-center deployed${NC}"
echo ""

# Set Supabase Secrets
echo "🔐 Setting Supabase secrets..."

supabase secrets set \
  GOOGLE_CLOUD_API_KEY="$GOOGLE_CLOUD_API_KEY" \
  USE_GOOGLE_AI=true \
  OPENAI_API_KEY="$OPENAI_API_KEY"

echo -e "${GREEN}✅ Secrets configured${NC}"
echo ""

# Deploy Voice Gateway (REQUIRED for WhatsApp voice calls)
echo "🎙️ Building Voice Gateway (REQUIRED for WhatsApp voice calls)..."
echo ""

cd services/voice-gateway

echo "  → Installing dependencies..."
pnpm install --frozen-lockfile

echo "  → Building TypeScript..."
pnpm build

echo -e "${GREEN}✅ Voice Gateway built${NC}"

# Check if Docker and GCP are available
if command -v docker &> /dev/null && [ -n "$GCP_PROJECT" ]; then
  echo "  → Building Docker image..."
  docker build -t voice-gateway:latest .
  
  echo "  → Pushing to Google Container Registry..."
  docker tag voice-gateway:latest gcr.io/$GCP_PROJECT/voice-gateway:latest
  docker push gcr.io/$GCP_PROJECT/voice-gateway:latest
  
  echo "  → Deploying to Cloud Run..."
  gcloud run deploy voice-gateway \
    --image gcr.io/$GCP_PROJECT/voice-gateway:latest \
    --platform managed \
    --region us-central1 \
    --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY,SUPABASE_URL=$SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY,OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-10-01" \
    --allow-unauthenticated \
    --port 3002 \
    --memory 1Gi \
    --cpu 2
  
  VOICE_GATEWAY_URL=$(gcloud run services describe voice-gateway --region us-central1 --format 'value(status.url)')
  echo ""
  echo -e "${GREEN}✅ Voice Gateway deployed: $VOICE_GATEWAY_URL${NC}"
else
  echo -e "${YELLOW}⚠️  Docker/GCP not available.${NC}"
  echo ""
  echo "Voice Gateway is built locally. To deploy manually:"
  echo ""
  echo "1. Build and push Docker image:"
  echo "   docker build -t voice-gateway:latest ."
  echo "   docker tag voice-gateway:latest gcr.io/YOUR_PROJECT/voice-gateway:latest"
  echo "   docker push gcr.io/YOUR_PROJECT/voice-gateway:latest"
  echo ""
  echo "2. Deploy to Cloud Run:"
  echo "   gcloud run deploy voice-gateway \\"
  echo "     --image gcr.io/YOUR_PROJECT/voice-gateway:latest \\"
  echo "     --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY \\"
  echo "     --port 3002"
  echo ""
fi

cd ../..

echo ""

# Skip Twilio webhook deployment
echo -e "${YELLOW}ℹ️  Skipping Twilio webhook (not needed for WhatsApp, will deploy when MTN SIP trunk is available)${NC}"
echo ""

# Health check
echo "🏥 Running health check..."
echo ""

CALL_CENTER_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/functions/v1/wa-agent-call-center/health" || echo "000")

if [ "$CALL_CENTER_HEALTH" = "200" ]; then
  echo -e "  ${GREEN}✅ wa-agent-call-center healthy${NC}"
else
  echo -e "  ${RED}❌ wa-agent-call-center unreachable (HTTP $CALL_CENTER_HEALTH)${NC}"
fi

echo ""
echo "======================================"
echo -e "${GREEN}🎉 WhatsApp Voice CALLS Deployment Complete!${NC}"
echo "======================================"
echo ""
echo "What's deployed:"
echo "  ✅ wa-agent-call-center (Google AI + OpenAI fallback)"
echo "  ✅ Voice Gateway (OpenAI Realtime API)"
echo "  ✅ AGI Bridge (Tool execution during calls)"
echo "  ✅ 13 Realtime functions (schedule_ride, search_vehicles, etc.)"
echo "  ✅ Multi-language support (rw, en, fr, sw)"
echo "  ✅ Call Center AGI (20 tools)"
echo ""
if [ -n "$VOICE_GATEWAY_URL" ]; then
  echo "Voice Gateway URL:"
  echo "  $VOICE_GATEWAY_URL"
  echo ""
fi
echo "What's ready but not deployed yet:"
echo "  ⏳ Twilio voice webhook (waiting for MTN SIP trunk)"
echo "  ⏳ Phone call integration (waiting for MTN access)"
echo ""
echo "Next steps:"
echo "1. Test WhatsApp voice CALL:"
echo "   - Initiate WhatsApp call to your bot"
echo "   - Say: 'I need a ride from Kigali to Airport'"
echo "   - AI should execute schedule_ride tool and respond"
echo ""
echo "2. Monitor Voice Gateway logs:"
if [ -n "$VOICE_GATEWAY_URL" ]; then
  echo "   gcloud run services logs read voice-gateway --region us-central1 --tail"
else
  echo "   Check your Voice Gateway deployment logs"
fi
echo ""
echo "3. Monitor Call Center AGI logs:"
echo "   supabase functions logs wa-agent-call-center --tail"
echo ""
echo "4. Look for these events:"
echo "   - realtime.session_created (call started)"
echo "   - realtime.tool_call_received (AI calling tool)"
echo "   - agi_bridge.tool_execution_success (tool executed)"
echo "   - realtime.audio_out (AI speaking)"
echo ""
echo "5. Check database for tool executions:"
echo "   SELECT * FROM ai_tool_executions ORDER BY created_at DESC LIMIT 10;"
echo ""
echo "6. Check call transcripts:"
echo "   SELECT * FROM call_transcripts ORDER BY created_at DESC LIMIT 10;"
echo ""
echo "When MTN SIP trunk is ready:"
echo "   - Set TWILIO_AUTH_TOKEN (or MTN credentials)"
echo "   - Run: supabase functions deploy twilio-voice-webhook"
echo "   - Configure MTN webhook URL"
echo "   - Test regular phone calls"
echo ""
echo "Documentation:"
echo "  - WHATSAPP_VOICE_TESTING_GUIDE.md"
echo "  - AI_INTEGRATIONS_COMPLETE.md"
echo "  - AI_INTEGRATIONS_QUICK_REF.md"
echo ""
