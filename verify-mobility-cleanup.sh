#!/bin/bash
# ============================================================================
# VERIFY MOBILITY TRIPS CLEANUP DEPLOYMENT
# ============================================================================
# Purpose: Verify canonical trips schema deployed correctly
# Run from: Repository root
# Usage: ./verify-mobility-cleanup.sh
# ============================================================================

set -e

echo "=============================================="
echo "MOBILITY TRIPS CLEANUP - VERIFICATION"
echo "=============================================="
echo ""

ERRORS=0

# Helper function to check query
check_query() {
  local description="$1"
  local query="$2"
  local expected="$3"
  
  echo -n "Checking $description... "
  
  result=$(supabase db execute "$query" 2>&1) || {
    echo "❌ FAILED"
    echo "   Error: $result"
    ((ERRORS++))
    return 1
  }
  
  if [ -n "$expected" ]; then
    if echo "$result" | grep -q "$expected"; then
      echo "✅ PASS"
    else
      echo "❌ FAILED"
      echo "   Expected: $expected"
      echo "   Got: $result"
      ((ERRORS++))
    fi
  else
    echo "✅ PASS"
  fi
}

echo "=============================================="
echo "1. SCHEMA VERIFICATION"
echo "=============================================="
echo ""

# Check trips table exists
check_query "trips table exists" \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'trips' AND table_schema = 'public';" \
  "1"

# Check trips has correct columns
check_query "trips has trip_kind column" \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'trip_kind';" \
  "1"

check_query "trips has pickup_geog column" \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'pickup_geog';" \
  "1"

# Check old tables dropped
check_query "mobility_trips dropped" \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'mobility_trips';" \
  "0"

check_query "rides_trips dropped" \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'rides_trips';" \
  "0"

check_query "mobility_trip_matches dropped" \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'mobility_trip_matches';" \
  "0"

echo ""
echo "=============================================="
echo "2. INDEX VERIFICATION"
echo "=============================================="
echo ""

# Check critical indexes exist
check_query "pickup_geog GIST index exists" \
  "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'trips' AND indexname = 'idx_trips_pickup_geog';" \
  "1"

check_query "role_vehicle_active index exists" \
  "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'trips' AND indexname = 'idx_trips_role_vehicle_active';" \
  "1"

echo ""
echo "=============================================="
echo "3. DATA VERIFICATION"
echo "=============================================="
echo ""

# Check trips table has data (if migration ran)
echo "Checking trips data summary..."
supabase db execute "
SELECT 
  trip_kind,
  status,
  role,
  COUNT(*) as count
FROM trips
GROUP BY ROLLUP(trip_kind, status, role)
ORDER BY trip_kind NULLS LAST, status NULLS LAST, role NULLS LAST;
" || echo "⚠️  Warning: Could not retrieve trips data"

echo ""

# Check no NULL geographies
check_query "no NULL pickup_geog" \
  "SELECT COUNT(*) FROM trips WHERE pickup_geog IS NULL;" \
  "0"

echo ""
echo "=============================================="
echo "4. RPC FUNCTION VERIFICATION"
echo "=============================================="
echo ""

# Check RPC functions exist
check_query "match_drivers_for_trip_v2 exists" \
  "SELECT COUNT(*) FROM pg_proc WHERE proname = 'match_drivers_for_trip_v2';" \
  "1"

check_query "match_passengers_for_trip_v2 exists" \
  "SELECT COUNT(*) FROM pg_proc WHERE proname = 'match_passengers_for_trip_v2';" \
  "1"

check_query "find_nearby_trips exists" \
  "SELECT COUNT(*) FROM pg_proc WHERE proname = 'find_nearby_trips';" \
  "1"

check_query "expire_old_trips exists" \
  "SELECT COUNT(*) FROM pg_proc WHERE proname = 'expire_old_trips';" \
  "1"

echo ""
echo "=============================================="
echo "5. CRON JOB VERIFICATION"
echo "=============================================="
echo ""

# Check cron jobs scheduled
echo "Checking cron jobs..."
supabase db execute "
SELECT 
  jobname,
  schedule,
  command
FROM cron.job 
WHERE jobname IN ('expire-trips', 'expire-scheduled-trips')
ORDER BY jobname;
" || echo "⚠️  Warning: Could not retrieve cron jobs"

echo ""

check_query "expire-trips cron job exists" \
  "SELECT COUNT(*) FROM cron.job WHERE jobname = 'expire-trips';" \
  "1"

check_query "expire-scheduled-trips cron job exists" \
  "SELECT COUNT(*) FROM cron.job WHERE jobname = 'expire-scheduled-trips';" \
  "1"

echo ""
echo "=============================================="
echo "6. MIGRATION VERIFICATION"
echo "=============================================="
echo ""

# Check all migrations applied
echo "Checking applied migrations..."
supabase db execute "
SELECT version 
FROM supabase_migrations.schema_migrations 
WHERE version LIKE '20251208090%'
ORDER BY version;
" || echo "⚠️  Warning: Could not retrieve migration history"

echo ""

check_query "canonical schema migration applied" \
  "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = '20251208090000';" \
  "1"

check_query "data migration applied" \
  "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = '20251208090001';" \
  "1"

check_query "RPC update migration applied" \
  "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = '20251208090002';" \
  "1"

echo ""
echo "=============================================="
echo "7. PERFORMANCE CHECK"
echo "=============================================="
echo ""

# Test a nearby query for performance
echo "Testing nearby query performance..."
supabase db execute "
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  t.id,
  ROUND((ST_Distance(
    t.pickup_geog,
    ST_SetSRID(ST_MakePoint(30.06, -1.95), 4326)::geography
  ) / 1000.0)::numeric, 2) AS distance_km
FROM trips t
WHERE t.role = 'driver'
  AND t.status = 'active'
  AND t.vehicle_type = 'moto'
  AND ST_DWithin(
    t.pickup_geog,
    ST_SetSRID(ST_MakePoint(30.06, -1.95), 4326)::geography,
    10000
  )
ORDER BY distance_km
LIMIT 10;
" | grep -E "(Index|Execution Time)" || echo "⚠️  Could not analyze query performance"

echo ""
echo "=============================================="
echo "VERIFICATION SUMMARY"
echo "=============================================="
echo ""

if [ $ERRORS -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED"
  echo ""
  echo "Deployment successful! Next steps:"
  echo "  1. Monitor logs: supabase functions logs wa-webhook-mobility --tail"
  echo "  2. Test end-to-end flows"
  echo "  3. Check for errors in first 24 hours"
else
  echo "❌ $ERRORS CHECKS FAILED"
  echo ""
  echo "Please review errors above and fix before proceeding."
  exit 1
fi

echo ""
echo "=============================================="
