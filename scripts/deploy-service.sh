#!/bin/bash
# Deploy a single service with verification
# Usage: ./deploy-service.sh <service-name>

set -e

SERVICE=$1
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-lhbowpbcpwoiparwnwgt}"

if [ -z "$SERVICE" ]; then
    echo "Usage: $0 <service-name>"
    echo "Available services:"
    echo "  - wa-webhook-core"
    echo "  - wa-webhook-profile"
    echo "  - wa-webhook-mobility"
    echo "  - wa-webhook-insurance"
    exit 1
fi

echo "🚀 Deploying ${SERVICE}..."

# Type check
echo "📝 Running type check..."
deno check "supabase/functions/${SERVICE}/index.ts" || true

# Deploy
echo "📦 Deploying..."
supabase functions deploy "${SERVICE}" --no-verify-jwt --project-ref "${SUPABASE_PROJECT_REF}"

# Verify
echo "🔍 Verifying deployment..."
sleep 2  # Wait for deployment to propagate

HEALTH_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${SERVICE}/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Deployment successful! Health check passed."
    curl -s "$HEALTH_URL" | jq .
else
    echo "⚠️ Health check returned HTTP ${HTTP_CODE}"
    curl -s "$HEALTH_URL"
fi
