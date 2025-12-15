#!/bin/bash
# Deploy webhook functions to Supabase
set -e

# SECURITY: Credentials MUST be provided via environment variables or CI/CD secrets
# DO NOT hardcode credentials in this script
# Set SUPABASE_ACCESS_TOKEN and DATABASE_URL via:
# - GitHub Secrets (for CI/CD)
# - Local .env file (not committed to git)
# - Environment variable exports

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN environment variable is not set"
  echo "Please set this via GitHub Secrets or your local environment"
  exit 1
fi

echo "=== Deploying Webhook Functions ==="
echo "Project: lhbowpbcpwoiparwnwgt"
echo ""

# Deploy wa-webhook-profile
echo "Deploying wa-webhook-profile..."
supabase functions deploy wa-webhook-profile --project-ref lhbowpbcpwoiparwnwgt

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Verify deployments:"
echo "1. Mobility: curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-mobility/health"
echo "2. Profile: curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-profile/health"
