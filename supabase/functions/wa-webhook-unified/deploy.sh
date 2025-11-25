#!/bin/bash
# Deployment script for wa-webhook-unified
# Usage: ./deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}

echo "🚀 Deploying wa-webhook-unified to $ENVIRONMENT..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    exit 1
fi

# Apply database migrations
echo "📦 Applying database migrations..."
supabase db push

# Deploy the function
echo "🔧 Deploying function..."
supabase functions deploy wa-webhook-unified \
  --project-ref ${SUPABASE_PROJECT_REF} \
  --no-verify-jwt

# Set environment variables
echo "🔐 Setting environment variables..."
supabase secrets set \
  GEMINI_API_KEY="${GEMINI_API_KEY}" \
  WHATSAPP_APP_SECRET="${WHATSAPP_APP_SECRET}" \
  WA_VERIFY_TOKEN="${WA_VERIFY_TOKEN}" \
  --project-ref ${SUPABASE_PROJECT_REF}

# Health check
echo "🏥 Running health check..."
FUNCTION_URL=$(supabase functions list --project-ref ${SUPABASE_PROJECT_REF} | grep wa-webhook-unified | awk '{print $2}')
HEALTH_RESPONSE=$(curl -s "${FUNCTION_URL}/health")

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "✅ Deployment successful! Service is healthy."
    echo "$HEALTH_RESPONSE" | jq '.'
else
    echo "❌ Health check failed!"
    echo "$HEALTH_RESPONSE"
    exit 1
fi

echo "🎉 Deployment complete!"
