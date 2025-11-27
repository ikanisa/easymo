#!/bin/bash

# Deploy wa-webhook-core critical infrastructure
# - DLQ processor
# - Session cleanup  
# - Scheduled jobs

set -e

echo "🚀 Deploying wa-webhook-core critical infrastructure..."

# Check required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  exit 1
fi

echo ""
echo "📦 Deploying Edge Functions..."

# Deploy DLQ processor
echo "  → Deploying dlq-processor..."
supabase functions deploy dlq-processor --no-verify-jwt

# Deploy session cleanup
echo "  → Deploying session-cleanup..."
supabase functions deploy session-cleanup --no-verify-jwt

echo ""
echo "🗄️  Applying database migrations..."

# Apply scheduled jobs migration
supabase db push

echo ""
echo "🧪 Running integration tests..."

# Run integration tests
cd supabase/functions/wa-webhook-core/__tests__
deno test --allow-net --allow-env integration.test.ts || {
  echo "⚠️  Warning: Some integration tests failed. Review logs above."
}

cd - > /dev/null

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Verify DLQ processor: curl -X POST ${SUPABASE_URL}/functions/v1/dlq-processor \\"
echo "       -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"
echo ""
echo "  2. Verify session cleanup: curl -X POST ${SUPABASE_URL}/functions/v1/session-cleanup \\"
echo "       -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"
echo ""
echo "  3. Check scheduled jobs:"
echo "     supabase db exec 'SELECT * FROM cron.job;'"
echo ""
echo "🎯 Critical infrastructure deployment complete!"
