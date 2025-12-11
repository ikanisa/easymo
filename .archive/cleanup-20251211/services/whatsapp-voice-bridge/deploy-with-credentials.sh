#!/bin/bash

#######################################################################
# WhatsApp Voice Bridge - Deployment with Credentials
#######################################################################

set -e

echo "============================================================================"
echo "WhatsApp Voice Bridge - Complete Deployment"
echo "============================================================================"
echo ""

# Set Supabase credentials
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
export SUPABASE_DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "Step 1: Deploying Voice Bridge to Fly.io"
echo "============================================================================"
cd "$(dirname "$0")"

echo "Building and deploying..."
flyctl deploy

echo ""
echo "Step 2: Deploying Edge Function to Supabase"
echo "============================================================================"
cd ../../supabase

echo "Deploying wa-webhook-voice-calls function..."
supabase functions deploy wa-webhook-voice-calls \
  --project-ref lhbowpbcpwoiparwnwgt

echo ""
echo "============================================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================================================"
echo ""
echo "Next: Test the voice calling"
echo "  1. Watch logs: flyctl logs --app whatsapp-voice-bridge-dark-dew-6515"
echo "  2. Make a test call to your WhatsApp business number"
echo "  3. Verify AI responds (should work now!)"
echo ""
