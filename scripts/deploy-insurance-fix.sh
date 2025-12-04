#!/bin/bash
set -e

echo "🔧 Deploying Insurance Admin Notification Fix"
echo "=============================================="

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install: brew install supabase/tap/supabase"
    exit 1
fi

# Link to project if not already linked
if [ ! -f .supabase/config.toml ]; then
    echo "⚠️  Not linked to Supabase project. Please run:"
    echo "   supabase link --project-ref lhbowpbcpwoiparwnwgt"
    exit 1
fi

echo ""
echo "📦 Step 1: Deploying migration (insurance_admin_notifications table)"
echo "--------------------------------------------------------------------"
supabase db push

echo ""
echo "📤 Step 2: Deploying Edge Function (send-insurance-admin-notifications)"
echo "------------------------------------------------------------------------"
supabase functions deploy send-insurance-admin-notifications \
  --no-verify-jwt \
  --project-ref lhbowpbcpwoiparwnwgt

echo ""
echo "📤 Step 3: Deploying Edge Function (wa-webhook-mobility)"
echo "---------------------------------------------------------"
supabase functions deploy wa-webhook-mobility \
  --no-verify-jwt \
  --project-ref lhbowpbcpwoiparwnwgt

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Check Edge Function logs: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions"
echo "2. Verify tables exist:"
echo "   - notifications"
echo "   - insurance_admin_notifications"
echo "3. Test: Submit an insurance certificate via WhatsApp"
echo "4. Monitor logs for: INSURANCE_ADMIN_NOTIFICATION_START, NOTIFICATION_SENT"
echo ""
