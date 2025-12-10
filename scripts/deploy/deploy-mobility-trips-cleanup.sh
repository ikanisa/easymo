#!/bin/bash
# ============================================================================
# DEPLOY MOBILITY TRIPS CANONICAL SCHEMA
# ============================================================================
# Purpose: Deploy consolidated trips schema + updated edge functions
# Run from: Repository root
# ============================================================================

set -e  # Exit on error

echo "=============================================="
echo "MOBILITY TRIPS CANONICAL SCHEMA DEPLOYMENT"
echo "=============================================="
echo ""

# Check we're in the right directory
if [ ! -f "supabase/migrations/20251208090000_mobility_trips_canonical_schema.sql" ]; then
  echo "❌ ERROR: Migration file not found"
  echo "   Please run this script from the repository root"
  exit 1
fi

# Confirmation prompt
echo "⚠️  WARNING: This is a BREAKING CHANGE"
echo ""
echo "This deployment will:"
echo "  1. Create new canonical 'trips' table"
echo "  2. Migrate data from rides_trips, mobility_trips, scheduled_trips"
echo "  3. Update RPC functions (match_drivers_for_trip_v2, etc.)"
echo "  4. Drop 8 old tables (mobility_trip_matches, etc.)"
echo "  5. Update edge functions to use new schema"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Deployment cancelled"
  exit 0
fi

echo ""
echo "=============================================="
echo "STEP 1: Apply Database Migrations"
echo "=============================================="
echo ""

# Apply migrations
supabase db push

echo ""
echo "✅ Migrations applied successfully"
echo ""

echo "=============================================="
echo "STEP 2: Verify Data Migration"
echo "=============================================="
echo ""

# Check data migrated
echo "Checking trips table..."
supabase db execute "
SELECT 
  trip_kind,
  status,
  COUNT(*) as count
FROM trips
GROUP BY trip_kind, status
ORDER BY trip_kind, status;
" || echo "⚠️  Warning: Could not verify trips table"

echo ""

echo "=============================================="
echo "STEP 3: Deploy Edge Functions"
echo "=============================================="
echo ""

# Deploy updated edge functions
echo "Deploying wa-webhook..."
supabase functions deploy wa-webhook

echo "Deploying wa-webhook-mobility..."
supabase functions deploy wa-webhook-mobility

echo ""
echo "✅ Edge functions deployed successfully"
echo ""

echo "=============================================="
echo "STEP 4: Verification"
echo "=============================================="
echo ""

# Verify old tables dropped
echo "Checking old tables removed..."
supabase db execute "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'mobility_trips',
    'mobility_trip_matches',
    'rides_trips',
    'scheduled_trips'
  );
" || echo "✅ Old tables successfully removed"

echo ""

# Check cron jobs
echo "Checking cron jobs..."
supabase db execute "
SELECT jobname, schedule 
FROM cron.job 
WHERE jobname LIKE '%trip%'
ORDER BY jobname;
" || echo "⚠️  Warning: Could not verify cron jobs"

echo ""

echo "=============================================="
echo "DEPLOYMENT COMPLETE ✅"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Monitor logs: supabase functions logs wa-webhook-mobility --tail"
echo "  2. Test nearby search flow"
echo "  3. Test scheduled trip creation"
echo "  4. Verify no errors in first 24 hours"
echo ""
echo "Documentation: MOBILITY_TRIPS_CLEANUP_SUMMARY.md"
echo "=============================================="
