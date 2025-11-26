-- Test Jobs Location Integration
-- Run this after deployment to verify everything works

-- 1. Check GPS columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'job_listings' 
  AND column_name IN ('lat', 'lng', 'location_geography')
ORDER BY column_name;

-- 2. Check spatial index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'job_listings' 
  AND indexname = 'idx_job_listings_geography';

-- 3. Check RPC functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('search_nearby_jobs', 'get_jobs_for_user_location')
ORDER BY routine_name;

-- 4. Test data: Insert a sample job with GPS coordinates (Kigali, Rwanda)
INSERT INTO job_listings (
  user_id,
  title,
  description,
  location,
  lat,
  lng,
  category,
  job_type,
  pay_min,
  pay_max,
  currency,
  status
)
SELECT 
  (SELECT id FROM whatsapp_users LIMIT 1),
  'Test Driver Position',
  'Test job for location integration',
  'Kigali, Rwanda',
  -1.9536,
  30.0606,
  'transportation',
  'full_time',
  200000,
  300000,
  'RWF',
  'open'
WHERE NOT EXISTS (
  SELECT 1 FROM job_listings WHERE title = 'Test Driver Position'
);

-- 5. Test nearby search (should find the test job within 10km of Kigali)
SELECT 
  id,
  title,
  location,
  distance_km,
  pay_min,
  pay_max,
  currency
FROM search_nearby_jobs(
  _lat := -1.9536,
  _lng := 30.0606,
  _radius_km := 10,
  _limit := 5
)
WHERE title = 'Test Driver Position';

-- 6. Verify geography column auto-populated
SELECT 
  title,
  lat,
  lng,
  ST_AsText(location_geography::geometry) as geography_wkt,
  location_geography IS NOT NULL as has_geography
FROM job_listings
WHERE title = 'Test Driver Position';

-- 7. Test wider search (50km radius)
SELECT 
  COUNT(*) as total_jobs,
  MIN(distance_km) as closest_km,
  MAX(distance_km) as furthest_km,
  AVG(distance_km) as avg_distance_km
FROM search_nearby_jobs(
  _lat := -1.9536,
  _lng := 30.0606,
  _radius_km := 50,
  _limit := 100
);

-- Expected Results:
-- 1. Should show lat (numeric), lng (numeric), location_geography (geography)
-- 2. Should show idx_job_listings_geography
-- 3. Should show both RPC functions
-- 4. Should insert 1 row (or 0 if exists)
-- 5. Should find the test job with distance ~0km
-- 6. Should show geography as POINT(30.0606 -1.9536)
-- 7. Should show count and distance stats

