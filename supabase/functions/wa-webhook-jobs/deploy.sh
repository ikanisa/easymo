#!/bin/bash
set -e

echo "🚀 Deploying wa-webhook-jobs..."
echo ""

# Check environment variables
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN not set"
  echo "💡 Set it with: export SUPABASE_ACCESS_TOKEN='your-token'"
  exit 1
fi

if [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo "❌ SUPABASE_PROJECT_ID not set"
  echo "💡 Set it with: export SUPABASE_PROJECT_ID='your-project-id'"
  exit 1
fi

echo "✅ Environment variables OK"
echo "📦 Project ID: $SUPABASE_PROJECT_ID"
echo ""

# Type check
echo "🔍 Type checking..."
deno check index.ts
echo "✅ Type check passed"
echo ""

# Run tests
echo "🧪 Running tests..."
deno test --allow-all --no-check handlers/jobs-handler.test.ts
echo "✅ Tests passed"
echo ""

# Deploy
echo "🚀 Deploying to Supabase..."
supabase functions deploy wa-webhook-jobs --project-ref $SUPABASE_PROJECT_ID

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔗 Test the deployed function:"
echo "   curl https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/wa-webhook-jobs/health"
echo ""
