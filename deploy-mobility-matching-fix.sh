#!/bin/bash
# Deploy Mobility Matching Fix
# Fixes "No matches found" issue by correcting table mismatch

set -euo pipefail

echo "========================================="
echo "MOBILITY MATCHING FIX DEPLOYMENT"
echo "========================================="
echo ""
echo "This script will:"
echo "1. Run diagnostic checks"
echo "2. Apply database migration"
echo "3. Deploy edge function"
echo "4. Verify the fix"
echo ""

# Check if we're in the right directory
if [[ ! -f "supabase/migrations/20251209120000_fix_matching_table_mismatch.sql" ]]; then
  echo "❌ ERROR: Migration file not found. Are you in the repository root?"
  exit 1
fi

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo "❌ ERROR: Supabase CLI not installed"
  echo "Install: npm install -g supabase"
  exit 1
fi

echo "✓ Supabase CLI found"
echo ""

# Step 1: Run diagnostics (optional, requires DATABASE_URL)
echo "========================================="
echo "STEP 1: DIAGNOSTICS (Optional)"
echo "========================================="
if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running diagnostics..."
  ./diagnose-mobility-matching.sh || echo "⚠️  Diagnostics failed (non-critical)"
else
  echo "⚠️  DATABASE_URL not set - skipping diagnostics"
  echo "   (Set DATABASE_URL to run pre-deployment checks)"
fi
echo ""

# Step 2: Apply migration
echo "========================================="
echo "STEP 2: APPLY MIGRATION"
echo "========================================="
echo "Applying migration: 20251209120000_fix_matching_table_mismatch.sql"
echo ""

read -p "Deploy to (1) local, (2) remote, (3) both? [1/2/3]: " choice

case $choice in
  1)
    echo "Deploying to local..."
    supabase db push
    ;;
  2)
    echo "Deploying to remote..."
    supabase db push --linked
    ;;
  3)
    echo "Deploying to local..."
    supabase db push
    echo ""
    echo "Deploying to remote..."
    supabase db push --linked
    ;;
  *)
    echo "❌ Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""
echo "✅ Migration applied successfully"
echo ""

# Step 3: Deploy edge function (if changed)
echo "========================================="
echo "STEP 3: DEPLOY EDGE FUNCTION"
echo "========================================="
read -p "Deploy wa-webhook-mobility edge function? [y/N]: " deploy_edge

if [[ "$deploy_edge" =~ ^[Yy]$ ]]; then
  echo "Deploying wa-webhook-mobility..."
  supabase functions deploy wa-webhook-mobility --no-verify-jwt || echo "⚠️  Edge function deployment failed"
else
  echo "Skipping edge function deployment"
fi
echo ""

# Step 4: Verification
echo "========================================="
echo "STEP 4: VERIFICATION"
echo "========================================="
echo "Testing matching functions..."
echo ""

if [[ -n "${DATABASE_URL:-}" ]]; then
  # Test that functions exist and have correct return types
  psql "$DATABASE_URL" -c "
    SELECT 
      proname as function_name,
      pronargs as arg_count,
      prorettype::regtype as return_type
    FROM pg_proc 
    WHERE proname IN ('match_drivers_for_trip_v2', 'match_passengers_for_trip_v2')
    ORDER BY proname;
  " || echo "⚠️  Verification query failed"
else
  echo "⚠️  DATABASE_URL not set - cannot verify deployment"
  echo "   Set DATABASE_URL and run: ./diagnose-mobility-matching.sh"
fi

echo ""
echo "========================================="
echo "DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Monitor logs for MATCHES_RESULT events"
echo "2. Test nearby search with real users"
echo "3. Check that counts are > 0 when trips exist"
echo ""
echo "Monitoring commands:"
echo "  supabase functions logs wa-webhook-mobility --tail"
echo "  # Look for: MATCHES_RESULT events with count > 0"
echo ""
echo "Test coordinates from logs:"
echo "  Kigali: -1.9916, 30.1059"
echo ""
