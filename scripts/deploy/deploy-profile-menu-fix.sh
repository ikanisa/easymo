#!/bin/bash
set -e

echo "🔧 Deploying Profile Menu Items Fix"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20251210075000_fix_profile_menu_items_alignment.sql" ]; then
  echo "❌ Error: Must run from easymo root directory"
  exit 1
fi

echo "Step 1: Apply database migration..."
supabase db push

echo ""
echo "Step 2: Verify table exists..."
supabase db query "SELECT count(*) as item_count FROM profile_menu_items WHERE is_active = true;" || echo "⚠️  Query failed - check connection"

echo ""
echo "Step 3: Verify RPC function exists..."
supabase db query "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'get_profile_menu_items_v2' AND routine_schema = 'public';" || echo "⚠️  Query failed"

echo ""
echo "Step 4: Test RPC function..."
supabase db query "SELECT item_key, icon, display_order FROM get_profile_menu_items_v2('00000000-0000-0000-0000-000000000000', 'RW', 'en') ORDER BY display_order LIMIT 5;" || echo "⚠️  Query failed"

echo ""
echo "Step 5: Deploy edge function updates..."
supabase functions deploy wa-webhook-profile

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Next steps:"
echo "1. Test WhatsApp profile menu: Send 'Profile' to your bot"
echo "2. Verify menu items appear correctly"
echo "3. Test different languages (en, fr, rw)"
echo "4. Confirm bar/restaurant owners see 'My Bars & Restaurants'"
echo ""
echo "Monitoring:"
echo "- Check logs: supabase functions logs wa-webhook-profile"
echo "- Analytics events: PROFILE_MENU_FETCHED, PROFILE_MENU_FETCH_ERROR"
echo ""
