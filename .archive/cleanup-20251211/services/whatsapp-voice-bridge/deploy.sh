#!/bin/bash

# WhatsApp Voice Bridge - Cloud Run Deployment Script

set -e

echo "🚀 Deploying WhatsApp Voice Bridge to Google Cloud Run..."

# Configuration
SERVICE_NAME="whatsapp-voice-bridge"
REGION="us-east1"
PLATFORM="managed"

# Check required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ Error: OPENAI_API_KEY not set"
  echo "Run: export OPENAI_API_KEY=sk-proj-..."
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not set"
  echo "Run: export SUPABASE_SERVICE_ROLE_KEY=..."
  exit 1
fi

echo "✅ Environment variables verified"

# Build and test locally first
echo "📦 Building service..."
pnpm build

echo "✅ Build successful"

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."

gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform $PLATFORM \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "LOG_LEVEL=info" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN" \
  --set-env-vars "OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU" \
  --set-env-vars "OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview" \
  --set-env-vars "SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co" \
  --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"

# Get the deployed URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform $PLATFORM --region $REGION --format 'value(status.url)')

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📋 Service Details:"
echo "   Name: $SERVICE_NAME"
echo "   Region: $REGION"
echo "   URL: $SERVICE_URL"
echo ""
echo "🔧 Next Steps:"
echo "   1. Test health endpoint:"
echo "      curl $SERVICE_URL/health"
echo ""
echo "   2. Set Supabase secret:"
echo "      supabase secrets set VOICE_BRIDGE_URL=\"$SERVICE_URL\""
echo ""
echo "   3. Deploy Edge Function:"
echo "      supabase functions deploy wa-webhook-voice-calls"
echo ""
echo "   4. Make a test call from WhatsApp!"
echo ""
