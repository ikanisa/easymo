#!/bin/bash

# Share EasyMO Fix - Deployment Script
# Fixes: Missing referral_links table & Share button handler in ALL microservices

set -e

echo "🔗 Deploying Share EasyMO Fix (Complete Cross-Microservice Fix)..."
echo ""

# Check environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  exit 1
fi

echo "✅ Environment configured"
echo ""

# Apply database migration
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Applying referral_links migration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
supabase db push

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying wa-webhook function..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
supabase functions deploy wa-webhook --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying wa-webhook-mobility function..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
supabase functions deploy wa-webhook-mobility --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying wa-webhook-buy-sell function..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
supabase functions deploy wa-webhook-buy-sell --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying wa-webhook-property function..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
supabase functions deploy wa-webhook-property --project-ref lhbowpbcpwoiparwnwgt --no-verify-jwt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 What was fixed:"
echo "  1. ✅ Created referral_links table with RLS policies"
echo "  2. ✅ Consolidated 3 duplicate share.ts implementations → single shared version"
echo "  3. ✅ Enhanced observability (logs now include code & wa.me link)"
echo "  4. ✅ Added Share button handler to ALL microservices:"
echo "       - wa-webhook (main)"
echo "       - wa-webhook-mobility"
echo "       - wa-webhook-buy-sell"
echo "       - wa-webhook-property"
echo "  5. ✅ Created shared handleShareEasyMOButton() utility"
echo ""
echo "🧪 Test the Share EasyMO feature:"
echo "1. Send any message to WhatsApp bot (+228 93 00 27 51)"
echo "2. Start any flow (Buy/Sell, Property, Mobility, etc.)"
echo "3. Look for '🔗 Share easyMO' button (auto-appears if <3 buttons)"
echo "4. Tap the button and verify you receive:"
echo "   - wa.me link: https://wa.me/22893002751?text=REF%3AXXXXXXXX"
echo "   - Short link: https://easy.mo/r/XXXXXXXX"
echo "   - Instructions: 'Long press → Forward to 5 contacts'"
echo "   - Note: 'Keep REF code so I earn tokens'"
echo ""
echo "Alternative: Go to Wallet → Earn tokens → Share on WhatsApp (richer UI)"
echo ""

