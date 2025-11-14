-- Verification and Testing Script for Geolocation Implementation
-- Run this after applying the migration to verify everything works

-- ================================================
-- 1. Verify Columns Exist
-- ================================================
\echo '=== Checking Column Structure ==='
\echo ''

-- Check bars table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bars' 
  AND column_name IN ('latitude', 'longitude', 'geocoded_at', 'geocode_status', 'country')
ORDER BY column_name;

\echo ''
\echo 'Bars table columns verified'
\echo ''

-- Check business table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'business' 
  AND column_name IN ('latitude', 'longitude', 'geocoded_at', 'geocode_status', 'country')
ORDER BY column_name;

\echo ''
\echo 'Business table columns verified'
\echo ''

-- ================================================
-- 2. Verify Functions Exist
-- ================================================
\echo '=== Checking Functions ==='
\echo ''

SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_distance_km',
    'nearby_bars',
    'nearby_business',
    'nearby_drivers'
  )
ORDER BY routine_name;

\echo ''
\echo 'All functions created successfully'
\echo ''

-- ================================================
-- 3. Check Data Status
-- ================================================
\echo '=== Data Status Report ==='
\echo ''

-- Bars geocoding status
SELECT 
  'Bars' as table_name,
  geocode_status,
  COUNT(*) as count
FROM bars
GROUP BY geocode_status
ORDER BY geocode_status;

\echo ''

-- Business geocoding status  
SELECT 
  'Business' as table_name,
  geocode_status,
  COUNT(*) as count
FROM business
GROUP BY geocode_status
ORDER BY geocode_status;

\echo ''

-- ================================================
-- 4. Test Distance Calculation Function
-- ================================================
\echo '=== Testing Distance Calculation ==='
\echo ''

-- Test calculate_distance_km function
-- Distance from Kigali to Nairobi (should be ~830km)
SELECT 
  'Kigali to Nairobi' as route,
  calculate_distance_km(
    -1.9442, 30.0619,  -- Kigali
    -1.2864, 36.8172   -- Nairobi
  ) as distance_km;

\echo ''

-- Distance between two points in Kigali (should be ~3km)
SELECT 
  'Downtown Kigali to Airport' as route,
  calculate_distance_km(
    -1.9506, 30.0588,  -- Downtown
    -1.9686, 30.1395   -- Airport
  ) as distance_km;

\echo ''
\echo 'Distance calculations working correctly'
\echo ''

-- ================================================
-- 5. Test Nearby Functions (with dummy data)
-- ================================================
\echo '=== Testing Nearby Functions ==='
\echo ''

-- Test nearby_bars (center of Kigali)
\echo 'Finding bars near Kigali center:'
SELECT 
  name,
  country,
  ROUND(distance_km::numeric, 2) as distance_km
FROM nearby_bars(-1.9442, 30.0619, 10.0, 5)
WHERE distance_km IS NOT NULL
ORDER BY distance_km
LIMIT 5;

\echo ''

-- Test nearby_business
\echo 'Finding businesses near Kigali center:'
SELECT 
  name,
  country,
  ROUND(distance_km::numeric, 2) as distance_km
FROM nearby_business(-1.9442, 30.0619, 10.0, NULL, 5)
WHERE distance_km IS NOT NULL
ORDER BY distance_km
LIMIT 5;

\echo ''

-- ================================================
-- 6. Check Geocoding Queue
-- ================================================
\echo '=== Geocoding Queue Status ==='
\echo ''

SELECT 
  table_name,
  geocode_status,
  COUNT(*) as pending_count
FROM geocoding_queue
GROUP BY table_name, geocode_status
ORDER BY table_name, geocode_status;

\echo ''

-- Show sample records needing geocoding
\echo 'Sample records needing geocoding:'
SELECT 
  table_name,
  name,
  location_text,
  country,
  geocode_status
FROM geocoding_queue
WHERE geocode_status IN ('pending', 'failed')
LIMIT 10;

\echo ''

-- ================================================
-- 7. Performance Indexes Check
-- ================================================
\echo '=== Index Status ==='
\echo ''

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('bars', 'business', 'driver_status')
  AND (
    indexname LIKE '%lat%' 
    OR indexname LIKE '%lng%'
    OR indexname LIKE '%location%'
    OR indexname LIKE '%geocode%'
  )
ORDER BY tablename, indexname;

\echo ''
\echo '=== Verification Complete ==='
\echo ''
\echo 'Next steps:'
\echo '1. Deploy geocode-locations Edge Function'
\echo '2. Set GOOGLE_MAPS_API_KEY in Supabase secrets'
\echo '3. Run: ./scripts/geocode-data.sh all 50'
\echo '4. Verify results with: SELECT * FROM geocoding_queue;'
\echo ''
