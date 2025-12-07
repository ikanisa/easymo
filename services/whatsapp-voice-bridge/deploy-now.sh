#!/bin/bash
set -e

echo "🚀 Deploying WhatsApp Voice Bridge to Cloud Run..."

# Get OpenAI key from Google Secret Manager (if available) or use placeholder
OPENAI_KEY=$(gcloud secrets versions access latest --secret="OPENAI_API_KEY" 2>/dev/null || echo "NEEDS_REAL_KEY")

if [ "$OPENAI_KEY" = "NEEDS_REAL_KEY" ]; then
  echo "⚠️  Using Supabase-stored OpenAI key via environment injection"
  # We'll use --set-secrets to inject from Google Secret Manager
  OPENAI_KEY_FLAG="--update-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest"
else
  OPENAI_KEY_FLAG="--set-env-vars OPENAI_API_KEY=$OPENAI_KEY"
fi

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
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "LOG_LEVEL=info" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN" \
  --set-env-vars "OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU" \
  --set-env-vars "OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview" \
  --set-env-vars "SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc" \
  $OPENAI_KEY_FLAG

echo "✅ Deployment initiated!"
