#!/bin/bash
set -e

echo "🚀 Deploying Voice Media Server to Google Cloud Run..."

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-easymo-production}"
REGION="${GCP_REGION:-us-east1}"
SERVICE_NAME="voice-media-server"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Check required environment variables
if [ -z "$SUPABASE_URL" ]; then
  echo "❌ Error: SUPABASE_URL is required"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY is required"
  exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ Error: OPENAI_API_KEY is required"
  exit 1
fi

echo "📦 Building Docker image..."
cd services/voice-media-server
gcloud builds submit --tag "$IMAGE_NAME" --project "$PROJECT_ID"

echo "🚢 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars="SUPABASE_URL=${SUPABASE_URL}" \
  --set-env-vars="SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" \
  --set-env-vars="OPENAI_API_KEY=${OPENAI_API_KEY}" \
  --set-env-vars="OPENAI_REALTIME_MODEL=${OPENAI_REALTIME_MODEL:-gpt-5-realtime}" \
  --project "$PROJECT_ID"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "🔧 Next steps:"
echo "1. Test the service:"
echo "   curl $SERVICE_URL/health"
echo ""
echo "2. Update Supabase Edge Function:"
echo "   supabase secrets set VOICE_MEDIA_SERVER_URL=\"$SERVICE_URL\""
echo ""
echo "3. Redeploy Edge Function:"
echo "   supabase functions deploy wa-webhook-voice-calls"
echo ""
