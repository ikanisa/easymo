-- Check recent mobility trips
SELECT 
  id,
  role,
  vehicle_type,
  status,
  pickup_lat,
  pickup_lng,
  expires_at,
  created_at,
  NOW() - created_at AS age,
  expires_at > NOW() AS is_active
FROM mobility_trips
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- Count active trips by role
SELECT 
  role,
  vehicle_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM mobility_trips
WHERE expires_at > NOW()
  AND status = 'open'
GROUP BY role, vehicle_type, status
ORDER BY role, vehicle_type;

-- Test matching query for a specific location (Kigali)
SELECT 
  id,
  role,
  vehicle_type,
  ST_Distance(
    ST_SetSRID(ST_MakePoint(30.105907, -1.991554), 4326)::geography,
    pickup_geog
  )::integer AS distance_meters,
  created_at,
  expires_at > NOW() as is_active
FROM mobility_trips
WHERE 
  ST_DWithin(
    ST_SetSRID(ST_MakePoint(30.105907, -1.991554), 4326)::geography,
    pickup_geog,
    10000  -- 10km radius
  )
  AND status = 'open'
  AND expires_at > NOW()
ORDER BY distance_meters
LIMIT 10;
