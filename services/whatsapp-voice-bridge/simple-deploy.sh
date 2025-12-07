#!/bin/bash
set -e

echo "🚀 Deploying WhatsApp Voice Bridge to Cloud Run..."
echo ""

# Note: OpenAI API key will be set via Google Cloud Secret Manager or Console
# after initial deployment

gcloud run deploy whatsapp-voice-bridge \
  --source . \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "LOG_LEVEL=info" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN" \
  --set-env-vars "OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU" \
  --set-env-vars "OPENAI_REALTIME_MODEL=gpt-5-realtime" \
  --set-env-vars "SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc" \
  --set-env-vars "OPENAI_API_KEY=PLACEHOLDER"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "⚠️  IMPORTANT: Set the real OPENAI_API_KEY:"
echo "   gcloud run services update whatsapp-voice-bridge --region us-east1 --update-env-vars OPENAI_API_KEY=sk-proj-..."
echo ""
