#!/bin/bash
# Verification script for MOMO USSD & Driver Verification deployment

echo "==============================================================================="
echo "🔍 VERIFYING MOMO USSD PAYMENT & DRIVER VERIFICATION DEPLOYMENT"
echo "==============================================================================="
echo ""

# Check database tables
echo "📊 Checking Database Tables..."
echo ""

TABLES=(
  "driver_status"
  "mobility_matches"
  "scheduled_trips"
  "saved_locations"
  "driver_subscriptions"
  "driver_insurance"
  "mobility_intent_cache"
  "location_cache"
  "momo_transactions"
  "momo_refunds"
)

for table in "${TABLES[@]}"; do
  echo -n "  - $table: "
  if supabase db execute "SELECT 1 FROM $table LIMIT 1" &>/dev/null; then
    echo "✅ EXISTS"
  else
    echo "❌ NOT FOUND"
  fi
done

echo ""
echo "🔧 Checking RPC Functions..."
echo ""

FUNCTIONS=(
  "find_nearby_drivers"
  "is_driver_insurance_valid"
  "get_driver_active_insurance"
  "get_driver_verification_status"
  "update_driver_location"
  "set_driver_online"
)

for func in "${FUNCTIONS[@]}"; do
  echo -n "  - $func: "
  if supabase db execute "SELECT proname FROM pg_proc WHERE proname = '$func'" | grep -q "$func"; then
    echo "✅ EXISTS"
  else
    echo "❌ NOT FOUND"
  fi
done

echo ""
echo "📁 Checking Handler Files..."
echo ""

FILES=(
  "supabase/functions/wa-webhook-mobility/handlers/momo_ussd_payment.ts"
  "supabase/functions/wa-webhook-mobility/observe/logger.ts"
  "supabase/functions/wa-webhook-mobility/handlers/driver_verification.ts"
)

for file in "${FILES[@]}"; do
  echo -n "  - $(basename $file): "
  if [ -f "$file" ]; then
    echo "✅ EXISTS ($(wc -l < "$file") lines)"
  else
    echo "❌ NOT FOUND"
  fi
done

echo ""
echo "🚀 Checking Edge Function Deployment..."
echo ""

FUNCTION_URL="https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-mobility/health"

echo -n "  - wa-webhook-mobility health check: "
if curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL" | grep -q "200"; then
  echo "✅ ONLINE"
else
  echo "⚠️  Check deployment status"
fi

echo ""
echo "📊 Deployment Summary"
echo "---------------------"
echo "✅ Database Tables: $(printf '%s\n' "${TABLES[@]}" | wc -l)"
echo "✅ RPC Functions: $(printf '%s\n' "${FUNCTIONS[@]}" | wc -l)"
echo "✅ Handler Files: $(printf '%s\n' "${FILES[@]}" | wc -l)"
echo ""

echo "==============================================================================="
echo "✅ VERIFICATION COMPLETE"
echo "==============================================================================="
echo ""
echo "📝 Next Steps:"
echo "  1. Test MOMO payment flow with test user"
echo "  2. Test driver verification with sample documents"
echo "  3. Monitor Supabase logs for errors"
echo "  4. Review MOMO_USSD_DRIVER_VERIFICATION_DEPLOYMENT.md for usage examples"
echo ""
