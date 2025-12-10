#!/bin/bash

# Quick Deploy Script for WhatsApp Voice Bridge
# This script handles environment variables and deployment

set -e

echo "🚀 WhatsApp Voice Bridge - Quick Deploy"
echo "========================================"
echo ""

# Check if running from repo root
if [ ! -f "services/whatsapp-voice-bridge/package.json" ]; then
  echo "❌ Error: Must run from repository root"
  echo "   cd /path/to/easymo && bash quick-deploy-voice.sh"
  exit 1
fi

echo "📦 Building service..."
cd services/whatsapp-voice-bridge
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Build successful"
echo ""

# Get environment variables
if [ -f .env ]; then
  echo "📋 Loading environment from .env..."
  source .env
else
  echo "⚠️  No .env file found"
  echo ""
  echo "Please create services/whatsapp-voice-bridge/.env with:"
  echo "  OPENAI_API_KEY=sk-proj-..."
  echo "  SUPABASE_SERVICE_ROLE_KEY=eyJhbG..."
  echo ""
  exit 1
fi

# Validate required vars
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ OPENAI_API_KEY not found in .env"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY not found in .env"
  exit 1
fi

echo "✅ Environment variables loaded"
echo "   OPENAI_API_KEY: ${OPENAI_API_KEY:0:15}..."
echo "   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:15}..."
echo ""

# Deploy to Cloud Run
echo "☁️  Deploying to Google Cloud Run..."
echo ""

gcloud run deploy whatsapp-voice-bridge \
  --source . \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,LOG_LEVEL=info,PORT=8080" \
  --set-env-vars "OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN" \
  --set-env-vars "OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU" \
  --set-env-vars "OPENAI_REALTIME_MODEL=gpt-5-realtime" \
  --set-env-vars "SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co" \
  --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed"
  exit 1
fi

# Get service URL
SERVICE_URL=$(gcloud run services describe whatsapp-voice-bridge --platform managed --region us-east1 --format 'value(status.url)')

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo "📋 Service Details:"
echo "   Name: whatsapp-voice-bridge"
echo "   Region: us-east1"
echo "   URL: $SERVICE_URL"
echo ""
echo "🧪 Next Steps:"
echo ""
echo "1. Test health endpoint:"
echo "   curl $SERVICE_URL/health"
echo ""
echo "2. Update Supabase secret:"
echo "   cd ../.."
echo "   supabase secrets set VOICE_BRIDGE_URL=\"$SERVICE_URL\" --project-ref lhbowpbcpwoiparwnwgt"
echo ""
echo "3. Deploy edge function:"
echo "   supabase functions deploy wa-webhook-voice-calls --project-ref lhbowpbcpwoiparwnwgt"
echo ""
echo "4. Make a test call from WhatsApp!"
echo ""
echo "📚 Documentation:"
echo "   - AUDIO_PIPELINE_IMPLEMENTATION.md (technical details)"
echo "   - DEPLOYMENT_COMPLETE_AUDIO_PIPELINE.md (deployment guide)"
echo ""
