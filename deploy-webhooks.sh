#!/bin/bash
# Deploy webhook functions to Supabase
set -e

export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

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
