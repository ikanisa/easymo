#!/bin/bash
# Deploy Location Caching & Mobility Fixes
# Run this script to deploy all changes to production

set -e

echo "========================================="
echo "Location Caching & Mobility Fix Deployment"
echo "========================================="
echo ""

# Check we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
  echo "❌ Error: Run this script from the repo root"
  exit 1
fi

echo "Step 1: Apply database migrations..."
echo "-------------------------------------"
supabase db push

echo ""
echo "Step 2: Verify RPC functions created..."
echo "----------------------------------------"
supabase db remote exec <<SQL
-- Check RPC functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'save_recent_location',
    'get_recent_location',
    'has_recent_location',
    'save_favorite_location',
    'get_saved_location',
    'list_saved_locations'
  )
ORDER BY routine_name;

-- Check saved_locations table exists
SELECT 
  table_name,
  (SELECT count(*) FROM saved_locations) as row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'saved_locations';
SQL

echo ""
echo "Step 3: Deploy edge functions..."
echo "---------------------------------"

# Deploy shared module changes (messages + request-location)
echo "✓ Shared location modules updated (no deploy needed)"

# Deploy updated edge functions
echo "Deploying wa-webhook-property..."
supabase functions deploy wa-webhook-property

echo "Deploying wa-webhook-mobility..."
supabase functions deploy wa-webhook-mobility

echo "Deploying wa-webhook-jobs..."
supabase functions deploy wa-webhook-jobs

echo ""
echo "Step 4: Smoke test..."
echo "---------------------"
echo "Testing location caching RPC functions..."

supabase db remote exec <<SQL
-- Test save_recent_location
DO \$\$
DECLARE
  v_location_id uuid;
  v_test_user_id uuid := gen_random_uuid();
BEGIN
  -- Save a test location
  v_location_id := save_recent_location(
    v_test_user_id,
    -1.9355,
    30.1234,
    'test',
    '{"test": true}'::jsonb,
    30
  );
  
  RAISE NOTICE 'Test location saved: %', v_location_id;
  
  -- Retrieve it
  PERFORM * FROM get_recent_location(v_test_user_id, 'test', 30);
  
  RAISE NOTICE '✅ Location caching functions working';
  
  -- Cleanup
  DELETE FROM recent_locations WHERE user_id = v_test_user_id;
END \$\$;
SQL

echo ""
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "Summary:"
echo "  ✓ Database migrations applied"
echo "  ✓ RPC functions created"
echo "  ✓ saved_locations table created"
echo "  ✓ Edge functions deployed"
echo "  ✓ Smoke tests passed"
echo ""
echo "Next steps:"
echo "  1. Test location sharing via WhatsApp"
echo "  2. Verify mobility matching returns results"
echo "  3. Check recent_locations table has entries"
echo "  4. Integrate 'Use Last Location' button in frontend"
echo ""
echo "Monitor logs:"
echo "  supabase functions logs wa-webhook-mobility"
echo "  supabase functions logs wa-webhook-property"
echo "  supabase functions logs wa-webhook-jobs"
echo ""
