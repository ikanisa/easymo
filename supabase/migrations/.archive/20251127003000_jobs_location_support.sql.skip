BEGIN;

-- ============================================================================
-- Jobs Service - Location Support Migration
-- ============================================================================
-- Adds GPS location support to job_listings table and creates RPC functions
-- for nearby job searches using PostGIS.
--
-- Features:
-- 1. Add lat/lng columns to job_listings
-- 2. Add geography column with spatial index for fast searches
-- 3. Create nearby_jobs() RPC function
-- 4. Add location cache integration
--
-- Part of: Phase 1 - Jobs Service Location Integration
-- ============================================================================

-- Add location columns to job_listings table
ALTER TABLE job_listings
ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS location_geography geography(POINT, 4326);

-- Create spatial index for efficient nearby searches
CREATE INDEX IF NOT EXISTS idx_job_listings_geography 
ON job_listings USING GIST (location_geography);

-- Create trigger to automatically update geography column when lat/lng change
CREATE OR REPLACE FUNCTION update_job_listing_geography()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location_geography := ST_SetSRID(
      ST_MakePoint(NEW.lng, NEW.lat),
      4326
    )::geography;
  ELSE
    NEW.location_geography := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_listing_geography ON job_listings;
CREATE TRIGGER trg_job_listing_geography
  BEFORE INSERT OR UPDATE OF lat, lng
  ON job_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_job_listing_geography();

-- ============================================================================
-- RPC Function: search_nearby_jobs
-- ============================================================================
-- Search for jobs near a given location using GPS coordinates
-- Returns jobs ordered by distance with relevance scoring
--
-- Parameters:
--   _lat: User latitude
--   _lng: User longitude
--   _radius_km: Search radius in kilometers (default 50km)
--   _limit: Maximum results (default 20)
--   _category: Optional job category filter
--   _job_type: Optional job type filter (full_time, part_time, contract, etc)
--
-- Returns: Jobs with distance, ordered by distance ASC
-- ============================================================================
CREATE OR REPLACE FUNCTION search_nearby_jobs(
  _lat NUMERIC,
  _lng NUMERIC,
  _radius_km NUMERIC DEFAULT 50,
  _limit INTEGER DEFAULT 20,
  _category TEXT DEFAULT NULL,
  _job_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  company TEXT,
  location TEXT,
  lat NUMERIC,
  lng NUMERIC,
  distance_km NUMERIC,
  pay_min NUMERIC,
  pay_max NUMERIC,
  currency TEXT,
  job_type TEXT,
  category TEXT,
  required_skills TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  relevance_score NUMERIC
) AS $$
DECLARE
  _user_location geography;
BEGIN
  -- Create user location point
  _user_location := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;
  
  -- Search jobs within radius
  RETURN QUERY
  SELECT
    jl.id,
    jl.title,
    jl.description,
    jl.company,
    jl.location,
    jl.lat,
    jl.lng,
    ROUND(
      (ST_Distance(jl.location_geography, _user_location) / 1000)::NUMERIC,
      2
    ) AS distance_km,
    jl.pay_min,
    jl.pay_max,
    jl.currency,
    jl.job_type,
    jl.category,
    jl.required_skills,
    jl.status,
    jl.created_at,
    -- Relevance score: closer = higher score, newer = higher score
    ROUND(
      (1.0 / (1.0 + (ST_Distance(jl.location_geography, _user_location) / 10000))) * 100 +
      (EXTRACT(EPOCH FROM (NOW() - jl.created_at)) / 86400)::NUMERIC * -0.1,
      2
    ) AS relevance_score
  FROM
    job_listings jl
  WHERE
    jl.status IN ('open', 'active')
    AND jl.location_geography IS NOT NULL
    AND ST_DWithin(jl.location_geography, _user_location, _radius_km * 1000)
    AND (_category IS NULL OR jl.category = _category)
    AND (_job_type IS NULL OR jl.job_type = _job_type)
  ORDER BY
    distance_km ASC,
    relevance_score DESC
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_nearby_jobs IS 
'Search for jobs near user location using GPS coordinates. Returns jobs within radius ordered by distance and relevance.';

-- ============================================================================
-- RPC Function: get_jobs_for_user_location
-- ============================================================================
-- Convenience function that automatically uses cached/saved location
-- Falls back to text-based search if no GPS data available
--
-- Parameters:
--   _user_id: User profile ID
--   _radius_km: Search radius (default 50km)
--   _category: Optional category filter
--   _limit: Max results (default 20)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_jobs_for_user_location(
  _user_id UUID,
  _radius_km NUMERIC DEFAULT 50,
  _category TEXT DEFAULT NULL,
  _limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  distance_km NUMERIC,
  pay_min NUMERIC,
  pay_max NUMERIC,
  currency TEXT,
  job_type TEXT,
  category TEXT,
  status TEXT,
  location_source TEXT
) AS $$
DECLARE
  _user_lat NUMERIC;
  _user_lng NUMERIC;
  _location_source TEXT;
BEGIN
  -- Try to get cached location (30 min TTL)
  SELECT lat, lng, 'cache' 
  INTO _user_lat, _user_lng, _location_source
  FROM get_cached_location(_user_id, 30)
  WHERE is_valid = true
  LIMIT 1;
  
  -- If no cache, try saved home location
  IF _user_lat IS NULL THEN
    SELECT sl.lat, sl.lng, 'saved_home'
    INTO _user_lat, _user_lng, _location_source
    FROM saved_locations sl
    WHERE sl.user_id = _user_id
      AND sl.label = 'home'
    LIMIT 1;
  END IF;
  
  -- If still no location, try any saved location
  IF _user_lat IS NULL THEN
    SELECT sl.lat, sl.lng, 'saved_any'
    INTO _user_lat, _user_lng, _location_source
    FROM saved_locations sl
    WHERE sl.user_id = _user_id
    ORDER BY sl.created_at DESC
    LIMIT 1;
  END IF;
  
  -- If we have location, use GPS search
  IF _user_lat IS NOT NULL AND _user_lng IS NOT NULL THEN
    RETURN QUERY
    SELECT
      snj.id,
      snj.title,
      snj.description,
      snj.location,
      snj.distance_km,
      snj.pay_min,
      snj.pay_max,
      snj.currency,
      snj.job_type,
      snj.category,
      snj.status,
      _location_source AS location_source
    FROM search_nearby_jobs(
      _user_lat,
      _user_lng,
      _radius_km,
      _limit,
      _category
    ) snj;
  ELSE
    -- Fallback: Return recent jobs without distance
    RETURN QUERY
    SELECT
      jl.id,
      jl.title,
      jl.description,
      jl.location,
      NULL::NUMERIC AS distance_km,
      jl.pay_min,
      jl.pay_max,
      jl.currency,
      jl.job_type,
      jl.category,
      jl.status,
      'none'::TEXT AS location_source
    FROM job_listings jl
    WHERE jl.status IN ('open', 'active')
      AND (_category IS NULL OR jl.category = _category)
    ORDER BY jl.created_at DESC
    LIMIT _limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_jobs_for_user_location IS 
'Get jobs for user using their cached/saved location. Falls back to recent jobs if no location available.';

-- ============================================================================
-- Update existing jobs with geography if they have lat/lng
-- ============================================================================
UPDATE job_listings
SET location_geography = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL 
  AND lng IS NOT NULL 
  AND location_geography IS NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_nearby_jobs TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_jobs_for_user_location TO authenticated, anon, service_role;

COMMIT;
