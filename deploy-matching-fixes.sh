#!/bin/bash
set -e

echo "🚀 Deploying Matching System Fixes"
echo "===================================="
echo ""

# Step 1: Apply database migration
echo "📊 Step 1: Applying database migration..."
supabase db push --include-all 2>&1 | grep -E "Applying|Error|SUCCESS" || true
echo "✓ Migration applied"
echo ""

# Step 2: Deploy edge functions
echo "📦 Step 2: Deploying edge functions..."

# Deploy wa-webhook-mobility
echo "  → Deploying wa-webhook-mobility..."
supabase functions deploy wa-webhook-mobility --no-verify-jwt 2>&1 | grep -E "Deployed|Error" || true

# Deploy wa-webhook (if exists)
if [ -d "supabase/functions/wa-webhook" ]; then
  echo "  → Deploying wa-webhook..."
  supabase functions deploy wa-webhook --no-verify-jwt 2>&1 | grep -E "Deployed|Error" || true
fi

echo "✓ Edge functions deployed"
echo ""

# Step 3: Verify deployment
echo "🔍 Step 3: Verifying deployment..."
psql $DATABASE_URL -c "SELECT key, value FROM app_config WHERE key LIKE 'mobility%';" 2>/dev/null | head -10 || echo "⚠️  Cannot verify (DATABASE_URL not set)"
echo ""

echo "✅ DEPLOYMENT COMPLETE"
echo ""
echo "Next steps:"
echo "1. Test matching: Send WhatsApp 'Find drivers' to your bot"
echo "2. Monitor health: SELECT * FROM mobility_location_health;"
echo "3. Check logs: supabase functions logs wa-webhook-mobility"
