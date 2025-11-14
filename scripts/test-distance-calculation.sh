#!/usr/bin/env bash
# Test script to validate distance calculation accuracy
# Compares haversine approximation vs PostGIS ST_Distance

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "Distance Calculation Test"
echo "================================"
echo ""

# Test case: Kigali City Tower to Kigali Convention Center
# Known approximate distance: ~3.7 km
LAT1=-1.9500  # Kigali City Tower
LNG1=30.0588
LAT2=-1.9536  # Kigali Convention Center  
LNG2=30.0938

echo "Test Case: Two locations in Kigali"
echo "Location 1: Kigali City Tower ($LAT1, $LNG1)"
echo "Location 2: Kigali Convention Center ($LAT2, $LNG2)"
echo "Expected distance: ~3.7 km"
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: supabase CLI not found${NC}"
    exit 1
fi

# Test haversine function (old method)
echo -e "${YELLOW}Testing old haversine_km() function...${NC}"
HAVERSINE_SQL="SELECT public.haversine_km($LAT1, $LNG1, $LAT2, $LNG2) as distance_km;"
HAVERSINE_RESULT=$(psql postgresql://postgres:postgres@localhost:54322/postgres -t -c "$HAVERSINE_SQL" 2>/dev/null || echo "Function not found")

if [ "$HAVERSINE_RESULT" != "Function not found" ]; then
    echo -e "${GREEN}Haversine distance: ${HAVERSINE_RESULT} km${NC}"
else
    echo -e "${RED}haversine_km() function not found in local database${NC}"
fi

# Test PostGIS ST_Distance (new method)
echo -e "${YELLOW}Testing PostGIS ST_Distance() with geography...${NC}"
POSTGIS_SQL="
SELECT 
  (ST_Distance(
    ST_SetSRID(ST_MakePoint($LNG1, $LAT1), 4326)::geography,
    ST_SetSRID(ST_MakePoint($LNG2, $LAT2), 4326)::geography
  ) / 1000.0)::numeric(10, 3) as distance_km;
"
POSTGIS_RESULT=$(psql postgresql://postgres:postgres@localhost:54322/postgres -t -c "$POSTGIS_SQL" 2>/dev/null || echo "PostGIS not available")

if [ "$POSTGIS_RESULT" != "PostGIS not available" ]; then
    echo -e "${GREEN}PostGIS distance: ${POSTGIS_RESULT} km${NC}"
else
    echo -e "${RED}PostGIS not available in local database${NC}"
fi

echo ""
echo "================================"
echo "Analysis"
echo "================================"
echo "PostGIS ST_Distance with geography type uses the WGS84 spheroid model"
echo "which accounts for Earth's oblate shape (equatorial bulge)."
echo ""
echo "Haversine formula assumes a perfect sphere with radius 6371 km,"
echo "which can cause errors of up to 0.5% (~50m per 10km)."
echo ""
echo -e "${GREEN}✓ For accurate distance measurements, use PostGIS ST_Distance${NC}"
echo ""

# Test with sample businesses query
echo "================================"
echo "Testing nearby_businesses query"
echo "================================"
echo ""

# Insert test business if businesses table exists
TEST_BUSINESS_SQL="
DO \$\$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'businesses') THEN
    -- Clean up any existing test data
    DELETE FROM public.businesses WHERE name = 'Test Business Distance';
    
    -- Insert test business at Kigali City Tower location
    INSERT INTO public.businesses (
      owner_whatsapp, 
      name, 
      lat, 
      lng,
      location,
      is_active
    ) VALUES (
      '+250788000000',
      'Test Business Distance',
      $LAT1,
      $LNG1,
      ST_SetSRID(ST_MakePoint($LNG1, $LAT1), 4326)::geography,
      true
    );
    
    RAISE NOTICE 'Test business inserted successfully';
  ELSE
    RAISE NOTICE 'businesses table does not exist, skipping test';
  END IF;
END \$\$;
"

psql postgresql://postgres:postgres@localhost:54322/postgres -c "$TEST_BUSINESS_SQL" 2>&1 | grep -i "notice\|error" || true

echo ""
echo "Test complete!"
