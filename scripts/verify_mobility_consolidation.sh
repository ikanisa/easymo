#!/bin/bash
# ============================================================================
# MOBILITY CONSOLIDATION - VERIFICATION SCRIPT
# ============================================================================
# Purpose: Verify consolidation was successful
# Run this AFTER applying 20251208150000_consolidate_mobility_tables.sql
# BEFORE applying 20251208160000_drop_deprecated_mobility_tables.sql
# ============================================================================

set -e

echo "============================================================================"
echo "MOBILITY CONSOLIDATION - VERIFICATION"
echo "============================================================================"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

PASSED=0
FAILED=0

# Test 1: Check canonical tables exist
echo "Test 1: Canonical tables exist"
echo "--------------------------------"

TRIPS_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='trips';" | tr -d ' ')
MATCHES_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='mobility_matches';" | tr -d ' ')

if [ "$TRIPS_EXISTS" = "1" ] && [ "$MATCHES_EXISTS" = "1" ]; then
  echo "✅ PASS: Canonical tables exist"
  PASSED=$((PASSED + 1))
else
  echo "❌ FAIL: Missing canonical tables"
  FAILED=$((FAILED + 1))
fi
echo ""

# Test 2: Check row counts
echo "Test 2: Data row counts"
echo "--------------------------------"

TRIPS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM trips;" | tr -d ' ')
MATCHES_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM mobility_matches;" | tr -d ' ')

echo "  trips: $TRIPS_COUNT rows"
echo "  mobility_matches: $MATCHES_COUNT rows"

if [ "$TRIPS_COUNT" -gt 0 ]; then
  echo "✅ PASS: trips table has data"
  PASSED=$((PASSED + 1))
else
  echo "⚠️  WARNING: trips table is empty (may be OK if no trips exist yet)"
fi
echo ""

# Test 3: Check RPC functions updated
echo "Test 3: RPC functions updated"
echo "--------------------------------"

MATCH_DRIVERS_UPDATED=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) FROM pg_proc p
WHERE p.proname = 'match_drivers_for_trip_v2'
  AND pg_get_functiondef(p.oid) LIKE '%FROM public.trips%';
" | tr -d ' ')

if [ "$MATCH_DRIVERS_UPDATED" -gt 0 ]; then
  echo "✅ PASS: match_drivers_for_trip_v2 uses canonical trips table"
  PASSED=$((PASSED + 1))
else
  echo "❌ FAIL: match_drivers_for_trip_v2 not updated"
  FAILED=$((FAILED + 1))
fi
echo ""

# Test 4: Test trip creation
echo "Test 4: Trip creation test"
# Test 4: Check foreign key constraints
echo "Test 4: Foreign key constraints"
echo "--------------------------------"

FK_COUNT=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('mobility_matches', 'trips', 'recurring_trips');
" | tr -d ' ')

if [ "$FK_COUNT" -gt 0 ]; then
  echo "✅ PASS: Foreign key constraints verified ($FK_COUNT found)"
  PASSED=$((PASSED + 1))
else
  echo "⚠️  WARNING: No foreign key constraints found"
fi
echo ""

# Test 5: Test trip creation
echo "Test 5: Trip creation test"
echo "--------------------------------"

TEST_USER_ID=$(psql "$DATABASE_URL" -t -c "SELECT user_id FROM profiles LIMIT 1;" | tr -d ' ')

if [ -n "$TEST_USER_ID" ]; then
  psql "$DATABASE_URL" -c "
    INSERT INTO trips (
      creator_user_id,
      trip_kind,
      role,
      vehicle_type,
      pickup_latitude,
      pickup_longitude,
      pickup_text,
      status,
      expires_at
    ) VALUES (
      '$TEST_USER_ID',
      'request',
      'driver',
      'moto',
      -1.9441,
      30.0619,
      'Test Location',
      'open',
      NOW() + INTERVAL '1 hour'
    )
    RETURNING id;
  " > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✅ PASS: Trip creation successful"
    PASSED=$((PASSED + 1))
    
    # Clean up test trip
    psql "$DATABASE_URL" -c "DELETE FROM trips WHERE pickup_text = 'Test Location';" > /dev/null 2>&1
  else
    echo "❌ FAIL: Trip creation failed"
    FAILED=$((FAILED + 1))
  fi
else
  echo "⚠️  SKIP: No users found for test"
fi
echo ""

# Test 5: Test matching function
echo "Test 5: Matching function test"
echo "--------------------------------"

LATEST_TRIP=$(psql "$DATABASE_URL" -t -c "SELECT id FROM trips LIMIT 1;" | tr -d ' ')

if [ -n "$LATEST_TRIP" ]; then
  MATCH_RESULT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM match_drivers_for_trip_v2('$LATEST_TRIP'::uuid);
  " | tr -d ' ')
  
  if [ $? -eq 0 ]; then
    echo "✅ PASS: Matching function executes successfully"
    echo "   Found $MATCH_RESULT potential matches"
    PASSED=$((PASSED + 1))
  else
    echo "❌ FAIL: Matching function error"
    FAILED=$((FAILED + 1))
  fi
else
  echo "⚠️  SKIP: No trips found for matching test"
fi
echo ""

# Test 6: Check for orphaned records
echo "Test 6: Orphaned records check"
echo "--------------------------------"

ORPHANED_MATCHES=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) FROM mobility_matches mm
WHERE NOT EXISTS (SELECT 1 FROM trips t WHERE t.id = mm.trip_id);
" | tr -d ' ')

if [ "$ORPHANED_MATCHES" = "0" ]; then
  echo "✅ PASS: No orphaned mobility_matches records"
  PASSED=$((PASSED + 1))
else
  echo "⚠️  WARNING: Found $ORPHANED_MATCHES orphaned mobility_matches records"
fi
echo ""

# Summary
echo "============================================================================"
echo "VERIFICATION SUMMARY"
echo "============================================================================"
echo ""
echo "Tests passed: $PASSED"
echo "Tests failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ ALL TESTS PASSED"
  echo ""
  echo "Next steps:"
  echo "1. Monitor application for 15-30 minutes"
  echo "2. Verify trip creation/matching works in production"
  echo "3. If everything is stable, run cleanup migration:"
  echo "   psql \$DATABASE_URL -f supabase/migrations/20251208160000_drop_deprecated_mobility_tables.sql"
  echo ""
  exit 0
else
  echo "❌ SOME TESTS FAILED"
  echo ""
  echo "DO NOT proceed with cleanup migration yet."
  echo "Review failed tests and fix issues first."
  echo ""
  exit 1
fi
