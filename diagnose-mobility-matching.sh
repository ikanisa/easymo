#!/bin/bash
# Mobility Matching Diagnostics Script
# Checks database state and identifies matching issues

set -e

echo "🔍 Mobility Matching Diagnostics"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we have database connection
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ Error: DATABASE_URL not set${NC}"
  echo "Please set it with: export DATABASE_URL='your-connection-string'"
  exit 1
fi

echo "📋 Step 1: Check PostGIS Extension"
echo "-----------------------------------"
psql "$DATABASE_URL" -t -c "SELECT PostGIS_Version();" 2>/dev/null && echo -e "${GREEN}✅ PostGIS enabled${NC}" || echo -e "${RED}❌ PostGIS not enabled${NC}"
echo ""

echo "📋 Step 2: Check Table Existence"
echo "---------------------------------"
for table in mobility_trips profiles; do
  count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='$table';" 2>/dev/null)
  if [ "$count" -eq "1" ]; then
    echo -e "${GREEN}✅ $table exists${NC}"
  else
    echo -e "${RED}❌ $table missing${NC}"
  fi
done
echo ""

echo "📋 Step 3: Check Matching Functions"
echo "------------------------------------"
for func in match_drivers_for_trip_v2 match_passengers_for_trip_v2; do
  count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname='$func';" 2>/dev/null)
  if [ "$count" -gt "0" ]; then
    echo -e "${GREEN}✅ $func exists${NC}"
  else
    echo -e "${RED}❌ $func missing${NC}"
  fi
done
echo ""

echo "📋 Step 4: Check Column Names in Profiles"
echo "------------------------------------------"
psql "$DATABASE_URL" << 'SQL'
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name IN ('full_name', 'display_name', 'phone_number', 'wa_id')
ORDER BY column_name;
SQL
echo ""

echo "📋 Step 5: Check Active Trips by Role"
echo "--------------------------------------"
psql "$DATABASE_URL" << 'SQL'
SELECT 
  role,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > now()) as active,
  COUNT(*) FILTER (WHERE pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL) as with_location,
  COUNT(*) FILTER (WHERE last_location_update > now() - interval '24 hours' OR created_at > now() - interval '24 hours') as location_fresh
FROM mobility_trips
WHERE status = 'open'
GROUP BY role, status;
SQL
echo ""

echo "📋 Step 6: Check Sample Trips"
echo "------------------------------"
psql "$DATABASE_URL" << 'SQL'
SELECT 
  id,
  role,
  vehicle_type,
  status,
  pickup_lat,
  pickup_lng,
  EXTRACT(EPOCH FROM (now() - COALESCE(last_location_update, created_at)))::integer / 60 as location_age_minutes,
  expires_at,
  created_at
FROM mobility_trips
WHERE status = 'open'
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC
LIMIT 10;
SQL
echo ""

echo "📋 Step 7: Test Matching Function (if trips exist)"
echo "---------------------------------------------------"
trip_id=$(psql "$DATABASE_URL" -t -c "SELECT id FROM mobility_trips WHERE status = 'open' AND (expires_at IS NULL OR expires_at > now()) LIMIT 1;" 2>/dev/null | tr -d ' ')

if [ -n "$trip_id" ]; then
  echo "Testing with trip: $trip_id"
  psql "$DATABASE_URL" << SQL
SELECT 
  trip_id,
  distance_km,
  vehicle_type,
  is_exact_match,
  location_age_minutes,
  driver_name,
  role
FROM match_drivers_for_trip_v2('$trip_id', 5, false, 50000, 7)
LIMIT 5;
SQL
else
  echo -e "${YELLOW}⚠️  No active trips found to test matching${NC}"
fi
echo ""

echo "📋 Step 8: Check for Common Issues"
echo "-----------------------------------"

# Check for expired trips
expired=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM mobility_trips WHERE status = 'open' AND expires_at < now();" 2>/dev/null | tr -d ' ')
if [ "$expired" -gt "0" ]; then
  echo -e "${YELLOW}⚠️  $expired expired trips still marked as open${NC}"
else
  echo -e "${GREEN}✅ No expired trips${NC}"
fi

# Check for trips without location
no_location=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM mobility_trips WHERE status = 'open' AND (pickup_lat IS NULL OR pickup_lng IS NULL);" 2>/dev/null | tr -d ' ')
if [ "$no_location" -gt "0" ]; then
  echo -e "${YELLOW}⚠️  $no_location trips without location${NC}"
else
  echo -e "${GREEN}✅ All trips have location${NC}"
fi

# Check for old location updates
old_location=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM mobility_trips WHERE status = 'open' AND COALESCE(last_location_update, created_at) < now() - interval '24 hours';" 2>/dev/null | tr -d ' ')
if [ "$old_location" -gt "0" ]; then
  echo -e "${YELLOW}⚠️  $old_location trips with stale location (>24h)${NC}"
else
  echo -e "${GREEN}✅ All trips have fresh location${NC}"
fi

echo ""
echo "📋 Step 9: Check Geometry Columns"
echo "----------------------------------"
psql "$DATABASE_URL" << 'SQL'
SELECT 
  COUNT(*) as total_trips,
  COUNT(*) FILTER (WHERE pickup_geog IS NOT NULL) as with_pickup_geog,
  COUNT(*) FILTER (WHERE dropoff_geog IS NOT NULL) as with_dropoff_geog
FROM mobility_trips
WHERE status = 'open';
SQL
echo ""

echo "=================================="
echo "🏁 Diagnostics Complete"
echo "=================================="
echo ""
echo "📝 Next Steps:"
echo "  1. If PostGIS is missing: Run 'CREATE EXTENSION postgis;'"
echo "  2. If functions are missing: Run 'supabase db push'"
echo "  3. If full_name column exists: Migration 20251207130000 will fix it"
echo "  4. If no trips exist: Create test trips via WhatsApp or admin"
echo "  5. If locations are stale: Users need to refresh/search again"
echo ""
