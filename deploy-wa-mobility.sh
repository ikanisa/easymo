#!/bin/bash
set -e

echo "🚀 Deploying wa-webhook-mobility to Supabase..."

# Deploy the function
supabase functions deploy wa-webhook-mobility \
  --project-ref lhbowpbcpwoiparwnwgt \
  --no-verify-jwt

echo "✅ wa-webhook-mobility deployed successfully"
