#!/bin/bash
# Quick Property Webhook Deployment

set -e

export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
export SUPABASE_PROJECT_REF="lhbowpbcpwoiparwnwgt"

cd "$(dirname "$0")/supabase/functions"

echo "🚀 Deploying Property Routing Fix..."
echo ""

# Deploy wa-webhook-property
echo "📦 Deploying wa-webhook-property..."
supabase functions deploy wa-webhook-property --no-verify-jwt --project-ref "$SUPABASE_PROJECT_REF"

echo ""

# Deploy wa-webhook-core  
echo "📦 Deploying wa-webhook-core..."
supabase functions deploy wa-webhook-core --no-verify-jwt --project-ref "$SUPABASE_PROJECT_REF"

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🧪 Test by:"
echo "  1. Open WhatsApp"
echo "  2. Send 'Hi' to bot"
echo "  3. Tap '🏠 Property Rentals'"
echo "  4. Should see role selection menu"
echo ""
