#!/bin/bash
set -e

echo "🚀 Deploying wa-webhook-mobility..."

if [ -z "$SUPABASE_ACCESS_TOKEN" ] || [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo "❌ Environment variables not set"
  exit 1
fi

echo "✅ Environment OK"
echo "🔍 Type checking..."
deno check index.ts

echo "🚀 Deploying..."
supabase functions deploy wa-webhook-mobility --project-ref $SUPABASE_PROJECT_ID --no-verify-jwt

echo "✅ Deployed!"
echo "Test: curl https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/wa-webhook-mobility/health"
