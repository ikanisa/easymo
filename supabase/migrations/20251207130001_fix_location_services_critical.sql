-- Migration: Fix Critical Location Services Issues
-- Date: 2025-12-07
-- Priority: P0 - CRITICAL
-- Issues Fixed: #1-#9 from location services investigation

BEGIN;

-- ============================================================================
-- ISSUE #2: Fix column name mismatch (full_name → display_name)
-- ============================================================================

-- Fix match_drivers_for_trip_v2
CREATE OR REPLACE FUNCTION match_drivers_for_trip_v2(
  _trip_id uuid,
  _radius_m integer DEFAULT 10000
)
RETURNS TABLE (
  driver_user_id uuid,
  driver_name text,
  driver_phone text,
  vehicle_plate text,
  distance_meters numeric,
  match_score numeric
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_pickup_geog geography;
BEGIN
  -- Get trip pickup location
  SELECT pickup_latitude, pickup_longitude, pickup
  INTO v_pickup_lat, v_pickup_lng, v_pickup_geog
  FROM rides_trips
  WHERE id = _trip_id;

  IF v_pickup_geog IS NULL AND v_pickup_lat IS NOT NULL THEN
    v_pickup_geog := ST_SetSRID(ST_MakePoint(v_pickup_lng, v_pickup_lat), 4326)::geography;
  END IF;

  RETURN QUERY
  SELECT 
    t.creator_user_id as driver_user_id,
    COALESCE(p.display_name, p.phone_number, 'Driver') AS driver_name,  -- FIXED: full_name → display_name
    p.phone_number as driver_phone,
    t.number_plate as vehicle_plate,
    ST_Distance(t.pickup::geography, v_pickup_geog)::numeric as distance_meters,
    100.0 - (ST_Distance(t.pickup::geography, v_pickup_geog) / _radius_m * 50)::numeric as match_score
  FROM rides_trips t
  LEFT JOIN profiles p ON p.user_id = t.creator_user_id
  WHERE t.trip_type = 'driver_offer'
    AND t.status = 'open'
    AND t.id != _trip_id
    AND ST_DWithin(t.pickup::geography, v_pickup_geog, _radius_m)
    AND COALESCE(t.last_location_at, t.created_at) > now() - interval '60 minutes'  -- FIXED: 30min → 60min
  ORDER BY distance_meters ASC
  LIMIT 20;
END;
$$;

-- Fix match_passengers_for_trip_v2
CREATE OR REPLACE FUNCTION match_passengers_for_trip_v2(
  _trip_id uuid,
  _radius_m integer DEFAULT 10000
)
RETURNS TABLE (
  passenger_user_id uuid,
  passenger_name text,
  passenger_phone text,
  distance_meters numeric,
  match_score numeric
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_pickup_geog geography;
BEGIN
  -- Get trip pickup location
  SELECT pickup_latitude, pickup_longitude, pickup
  INTO v_pickup_lat, v_pickup_lng, v_pickup_geog
  FROM rides_trips
  WHERE id = _trip_id;

  IF v_pickup_geog IS NULL AND v_pickup_lat IS NOT NULL THEN
    v_pickup_geog := ST_SetSRID(ST_MakePoint(v_pickup_lng, v_pickup_lat), 4326)::geography;
  END IF;

  RETURN QUERY
  SELECT 
    t.creator_user_id as passenger_user_id,
    COALESCE(p.display_name, p.phone_number, 'Passenger') AS passenger_name,  -- FIXED: full_name → display_name
    p.phone_number as passenger_phone,
    ST_Distance(t.pickup::geography, v_pickup_geog)::numeric as distance_meters,
    100.0 - (ST_Distance(t.pickup::geography, v_pickup_geog) / _radius_m * 50)::numeric as match_score
  FROM rides_trips t
  LEFT JOIN profiles p ON p.user_id = t.creator_user_id
  WHERE t.trip_type = 'passenger_request'
    AND t.status = 'open'
    AND t.id != _trip_id
    AND ST_DWithin(t.pickup::geography, v_pickup_geog, _radius_m)
    AND COALESCE(t.last_location_at, t.created_at) > now() - interval '60 minutes'  -- FIXED: 30min → 60min
  ORDER BY distance_meters ASC
  LIMIT 20;
END;
$$;

-- ============================================================================
-- ISSUE #18: Add Missing Spatial Indexes
-- ============================================================================

-- Drop existing indexes if they exist (safe recreation)
DROP INDEX IF EXISTS idx_rides_trips_pickup_geog;
DROP INDEX IF EXISTS idx_mobility_trips_pickup_geog;
DROP INDEX IF EXISTS idx_rides_trips_dropoff_geog;
DROP INDEX IF EXISTS idx_mobility_trips_dropoff_geog;

-- Create spatial indexes for rides_trips
CREATE INDEX idx_rides_trips_pickup_geog 
  ON rides_trips USING GIST (pickup) 
  WHERE status = 'open';

CREATE INDEX idx_rides_trips_dropoff_geog 
  ON rides_trips USING GIST (dropoff) 
  WHERE status = 'open';

-- Create spatial indexes for mobility_trips
CREATE INDEX idx_mobility_trips_pickup_geog 
  ON mobility_trips USING GIST (pickup_geog) 
  WHERE status = 'open';

CREATE INDEX idx_mobility_trips_dropoff_geog 
  ON mobility_trips USING GIST (dropoff_geog) 
  WHERE status = 'open';

-- ============================================================================
-- ISSUE #5: Fix last_location_at trigger to update on status change
-- ============================================================================

CREATE OR REPLACE FUNCTION update_last_location_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Update on coordinate change OR status change to 'open'
  IF (NEW.pickup_latitude IS DISTINCT FROM OLD.pickup_latitude OR
      NEW.pickup_longitude IS DISTINCT FROM OLD.pickup_longitude OR
      (NEW.status = 'open' AND OLD.status != 'open')) THEN
    NEW.last_location_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to rides_trips
DROP TRIGGER IF EXISTS trg_update_last_location_at ON rides_trips;
CREATE TRIGGER trg_update_last_location_at
  BEFORE UPDATE ON rides_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_last_location_at();

-- ============================================================================
-- ISSUE #9: Auto-populate geography column on INSERT/UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_populate_geography()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate pickup geography from lat/lng
  IF NEW.pickup_latitude IS NOT NULL AND NEW.pickup_longitude IS NOT NULL THEN
    NEW.pickup = ST_SetSRID(ST_MakePoint(NEW.pickup_longitude, NEW.pickup_latitude), 4326)::geography;
  END IF;
  
  -- Auto-populate dropoff geography from lat/lng
  IF NEW.dropoff_latitude IS NOT NULL AND NEW.dropoff_longitude IS NOT NULL THEN
    NEW.dropoff = ST_SetSRID(ST_MakePoint(NEW.dropoff_longitude, NEW.dropoff_latitude), 4326)::geography;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to rides_trips
DROP TRIGGER IF EXISTS trg_auto_populate_geography ON rides_trips;
CREATE TRIGGER trg_auto_populate_geography
  BEFORE INSERT OR UPDATE ON rides_trips
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_geography();

-- ============================================================================
-- ISSUE #8: Standardize mobility_trips geography columns
-- ============================================================================

-- Add trigger for mobility_trips if not exists
CREATE OR REPLACE FUNCTION auto_populate_mobility_geography()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate pickup_geog from pickup_lat/pickup_lng
  IF NEW.pickup_lat IS NOT NULL AND NEW.pickup_lng IS NOT NULL THEN
    NEW.pickup_geog = ST_SetSRID(ST_MakePoint(NEW.pickup_lng, NEW.pickup_lat), 4326)::geography;
  END IF;
  
  -- Auto-populate dropoff_geog from dropoff_lat/dropoff_lng
  IF NEW.dropoff_lat IS NOT NULL AND NEW.dropoff_lng IS NOT NULL THEN
    NEW.dropoff_geog = ST_SetSRID(ST_MakePoint(NEW.dropoff_lng, NEW.dropoff_lat), 4326)::geography;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_populate_mobility_geography ON mobility_trips;
CREATE TRIGGER trg_auto_populate_mobility_geography
  BEFORE INSERT OR UPDATE ON mobility_trips
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_mobility_geography();

-- ============================================================================
-- ISSUE #15: Add coordinate validation function
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate pickup coordinates
  IF NEW.pickup_latitude IS NOT NULL THEN
    IF NEW.pickup_latitude < -90 OR NEW.pickup_latitude > 90 THEN
      RAISE EXCEPTION 'Invalid pickup latitude: %. Must be between -90 and 90', NEW.pickup_latitude;
    END IF;
  END IF;
  
  IF NEW.pickup_longitude IS NOT NULL THEN
    IF NEW.pickup_longitude < -180 OR NEW.pickup_longitude > 180 THEN
      RAISE EXCEPTION 'Invalid pickup longitude: %. Must be between -180 and 180', NEW.pickup_longitude;
    END IF;
  END IF;
  
  -- Validate dropoff coordinates
  IF NEW.dropoff_latitude IS NOT NULL THEN
    IF NEW.dropoff_latitude < -90 OR NEW.dropoff_latitude > 90 THEN
      RAISE EXCEPTION 'Invalid dropoff latitude: %. Must be between -90 and 90', NEW.dropoff_latitude;
    END IF;
  END IF;
  
  IF NEW.dropoff_longitude IS NOT NULL THEN
    IF NEW.dropoff_longitude < -180 OR NEW.dropoff_longitude > 180 THEN
      RAISE EXCEPTION 'Invalid dropoff longitude: %. Must be between -180 and 180', NEW.dropoff_longitude;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply validation to both tables
DROP TRIGGER IF EXISTS trg_validate_coordinates ON rides_trips;
CREATE TRIGGER trg_validate_coordinates
  BEFORE INSERT OR UPDATE ON rides_trips
  FOR EACH ROW
  EXECUTE FUNCTION validate_coordinates();

DROP TRIGGER IF EXISTS trg_validate_coordinates ON mobility_trips;
CREATE TRIGGER trg_validate_coordinates
  BEFORE INSERT OR UPDATE ON mobility_trips
  FOR EACH ROW
  EXECUTE FUNCTION validate_coordinates();

-- ============================================================================
-- Backfill missing geography data for existing trips
-- ============================================================================

-- Fix rides_trips
UPDATE rides_trips
SET pickup = ST_SetSRID(ST_MakePoint(pickup_longitude, pickup_latitude), 4326)::geography
WHERE pickup IS NULL 
  AND pickup_latitude IS NOT NULL 
  AND pickup_longitude IS NOT NULL;

UPDATE rides_trips
SET dropoff = ST_SetSRID(ST_MakePoint(dropoff_longitude, dropoff_latitude), 4326)::geography
WHERE dropoff IS NULL 
  AND dropoff_latitude IS NOT NULL 
  AND dropoff_longitude IS NOT NULL;

-- Fix mobility_trips
UPDATE mobility_trips
SET pickup_geog = ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
WHERE pickup_geog IS NULL 
  AND pickup_lat IS NOT NULL 
  AND pickup_lng IS NOT NULL;

UPDATE mobility_trips
SET dropoff_geog = ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography
WHERE dropoff_geog IS NULL 
  AND dropoff_lat IS NOT NULL 
  AND dropoff_lng IS NOT NULL;

-- ============================================================================
-- Create monitoring view for location health
-- ============================================================================

CREATE OR REPLACE VIEW mobility_location_health AS
SELECT 
  'rides_trips' as table_name,
  COUNT(*) as total_open_trips,
  COUNT(CASE WHEN pickup IS NULL AND pickup_latitude IS NOT NULL THEN 1 END) as missing_geography,
  COUNT(CASE WHEN COALESCE(last_location_at, created_at) > now() - interval '30 minutes' THEN 1 END) as fresh_30min,
  COUNT(CASE WHEN COALESCE(last_location_at, created_at) > now() - interval '60 minutes' THEN 1 END) as fresh_60min,
  COUNT(CASE WHEN COALESCE(last_location_at, created_at) <= now() - interval '60 minutes' THEN 1 END) as stale,
  AVG(EXTRACT(EPOCH FROM (now() - COALESCE(last_location_at, created_at))) / 60)::numeric(10,2) as avg_age_minutes
FROM rides_trips
WHERE status = 'open'
UNION ALL
SELECT 
  'mobility_trips',
  COUNT(*),
  COUNT(CASE WHEN pickup_geog IS NULL AND pickup_lat IS NOT NULL THEN 1 END),
  COUNT(CASE WHEN updated_at > now() - interval '30 minutes' THEN 1 END),
  COUNT(CASE WHEN updated_at > now() - interval '60 minutes' THEN 1 END),
  COUNT(CASE WHEN updated_at <= now() - interval '60 minutes' THEN 1 END),
  AVG(EXTRACT(EPOCH FROM (now() - updated_at)) / 60)::numeric(10,2)
FROM mobility_trips
WHERE status = 'open';

COMMENT ON VIEW mobility_location_health IS 'Monitor location data quality and freshness across trip tables';

COMMIT;
