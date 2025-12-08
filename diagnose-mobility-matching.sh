#!/bin/bash
# Mobility Matching Diagnostic Script
# Identifies root causes of "No matches found" issue

set -euo pipefail

echo "========================================="
echo "MOBILITY MATCHING DIAGNOSTIC SCRIPT"
echo "========================================="
echo ""

# Check if DATABASE_URL is set
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  echo "Please set DATABASE_URL to your Supabase PostgreSQL connection string"
  exit 1
fi

echo "✓ DATABASE_URL configured"
echo ""

# Function to run SQL and format output
run_sql() {
  psql "$DATABASE_URL" -c "$1" 2>&1
}

echo "========================================="
echo "1. CHECK ACTIVE TABLES"
echo "========================================="
run_sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE '%trip%' OR tablename LIKE '%mobility%') ORDER BY tablename;"
echo ""

echo "========================================="
echo "2. CHECK TRIP DATA IN CANONICAL TABLE"
echo "========================================="
echo "Checking 'trips' table (canonical V2 table):"
run_sql "SELECT COUNT(*) as total_trips, COUNT(*) FILTER (WHERE status = 'open') as open_trips, COUNT(*) FILTER (WHERE role = 'driver') as drivers, COUNT(*) FILTER (WHERE role = 'passenger') as passengers FROM trips;" || echo "Table 'trips' does not exist"
echo ""

echo "========================================="
echo "3. CHECK MOBILITY_TRIPS TABLE (V2)"
echo "========================================="
run_sql "SELECT COUNT(*) as total_trips, COUNT(*) FILTER (WHERE status = 'open') as open_trips, COUNT(*) FILTER (WHERE role = 'driver') as drivers, COUNT(*) FILTER (WHERE role = 'passenger') as passengers FROM mobility_trips;" || echo "Table 'mobility_trips' does not exist"
echo ""

echo "========================================="
echo "4. CHECK MATCHING FUNCTIONS"
echo "========================================="
run_sql "SELECT proname, prosrc FROM pg_proc WHERE proname IN ('match_drivers_for_trip_v2', 'match_passengers_for_trip_v2') ORDER BY proname;" | head -50
echo ""

echo "========================================="
echo "5. SAMPLE OPEN TRIPS (Last 5)"
echo "========================================="
run_sql "SELECT id, role, vehicle_type, status, pickup_lat, pickup_lng, created_at, expires_at FROM trips WHERE status = 'open' ORDER BY created_at DESC LIMIT 5;" || run_sql "SELECT id, role, vehicle_type, status, pickup_lat, pickup_lng, created_at, expires_at FROM mobility_trips WHERE status = 'open' ORDER BY created_at DESC LIMIT 5;" || echo "No open trips found in any table"
echo ""

echo "========================================="
echo "6. CHECK LOCATION FRESHNESS"
echo "========================================="
run_sql "SELECT role, COUNT(*) as count, MIN(created_at) as oldest, MAX(created_at) as newest FROM trips WHERE status = 'open' GROUP BY role;" || echo "Cannot check location freshness"
echo ""

echo "========================================="
echo "7. TEST MATCHING FUNCTION DIRECTLY"
echo "========================================="
echo "Testing if matching functions can be called..."
run_sql "SELECT 'match_drivers_for_trip_v2' as function_name, COUNT(*) as exists FROM pg_proc WHERE proname = 'match_drivers_for_trip_v2' UNION ALL SELECT 'match_passengers_for_trip_v2', COUNT(*) FROM pg_proc WHERE proname = 'match_passengers_for_trip_v2';"
echo ""

echo "========================================="
echo "DIAGNOSIS COMPLETE"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Review the output above to identify which table contains trip data"
echo "2. Verify that matching functions reference the correct table"
echo "3. Check if there are open trips in the database"
echo "4. Run fix-mobility-matching.sql to apply corrections"
echo ""
