BEGIN;

-- Migration: Location Optimization and Cache Infrastructure
-- Purpose: Geospatial optimization and caching strategy for performance
-- Enhances existing location data with optimized indexes and caching

-- ============================================================================
-- LOCATIONS TABLE (Optimized for geospatial queries)
-- ============================================================================

-- Note: PostGIS extension should already be enabled from previous migrations
-- This table complements existing location data in driver_status, trips, etc.

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  location_type text NOT NULL CHECK (location_type IN ('current', 'home', 'work', 'favorite', 'pickup', 'dropoff')),
  coordinates geography(POINT, 4326) NOT NULL,
  address text,
  place_name text,
  place_id text, -- Google Places ID or similar
  city text,
  country text,
  postal_code text,
  accuracy_meters numeric(10,2),
  altitude_meters numeric(10,2),
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for location queries
CREATE INDEX IF NOT EXISTS idx_locations_user 
  ON public.locations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_locations_geo 
  ON public.locations USING GIST (coordinates);

CREATE INDEX IF NOT EXISTS idx_locations_type 
  ON public.locations (location_type) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_locations_place_id 
  ON public.locations (place_id) 
  WHERE place_id IS NOT NULL;

-- RLS policies for locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_locations" ON public.locations;
CREATE POLICY "service_role_full_access_locations" 
  ON public.locations 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_manage_own_locations" ON public.locations;
CREATE POLICY "users_manage_own_locations" 
  ON public.locations 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;

-- ============================================================================
-- ROUTES TABLE (Cached routing information)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.routes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  destination_location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  origin_coordinates geography(POINT, 4326) NOT NULL,
  destination_coordinates geography(POINT, 4326) NOT NULL,
  path geography(LINESTRING, 4326),
  distance_meters integer NOT NULL,
  duration_seconds integer NOT NULL,
  traffic_multiplier numeric(3,2) DEFAULT 1.0,
  route_polyline text, -- Encoded polyline
  waypoints jsonb DEFAULT '[]'::jsonb,
  provider text, -- 'google', 'mapbox', 'osm', etc.
  provider_route_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  cached_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for routes
CREATE INDEX IF NOT EXISTS idx_routes_origin_dest 
  ON public.routes (origin_location_id, destination_location_id);

CREATE INDEX IF NOT EXISTS idx_routes_cached_until 
  ON public.routes (cached_until);

CREATE INDEX IF NOT EXISTS idx_routes_created 
  ON public.routes (created_at DESC);

-- RLS policies for routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_routes" ON public.routes;
CREATE POLICY "service_role_full_access_routes" 
  ON public.routes 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_routes" ON public.routes;
CREATE POLICY "authenticated_read_routes" 
  ON public.routes 
  FOR SELECT 
  TO authenticated 
  USING (cached_until > timezone('utc', now()));

-- Grant permissions
GRANT SELECT ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;

-- ============================================================================
-- CACHE ENTRIES TABLE (General-purpose caching)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cache_entries (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  cache_type text DEFAULT 'generic',
  tags text[] DEFAULT ARRAY[]::text[],
  expires_at timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for cache entries
CREATE INDEX IF NOT EXISTS idx_cache_expires 
  ON public.cache_entries (expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_type 
  ON public.cache_entries (cache_type, expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_tags 
  ON public.cache_entries USING GIN (tags);

-- RLS policies for cache
ALTER TABLE public.cache_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_cache" ON public.cache_entries;
CREATE POLICY "service_role_full_access_cache" 
  ON public.cache_entries 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.cache_entries TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to find nearby locations
CREATE OR REPLACE FUNCTION public.find_nearby_locations(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer DEFAULT 5000,
  p_location_type text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  location_type text,
  address text,
  distance_meters integer,
  coordinates geography
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.user_id,
    l.location_type,
    l.address,
    ST_Distance(
      l.coordinates,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::integer as distance_meters,
    l.coordinates
  FROM public.locations l
  WHERE l.is_active = true
    AND (p_location_type IS NULL OR l.location_type = p_location_type)
    AND ST_DWithin(
      l.coordinates,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY l.coordinates <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  LIMIT p_limit;
END;
$$;

-- Function to get or create cached route
CREATE OR REPLACE FUNCTION public.get_cached_route(
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_dest_lat double precision,
  p_dest_lng double precision,
  p_max_age_minutes integer DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  distance_meters integer,
  duration_seconds integer,
  route_polyline text,
  is_cached boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_origin_point geography;
  v_dest_point geography;
  v_route record;
BEGIN
  v_origin_point := ST_SetSRID(ST_MakePoint(p_origin_lng, p_origin_lat), 4326)::geography;
  v_dest_point := ST_SetSRID(ST_MakePoint(p_dest_lng, p_dest_lat), 4326)::geography;
  
  -- Try to find a cached route
  SELECT r.* INTO v_route
  FROM public.routes r
  WHERE ST_DWithin(r.origin_coordinates, v_origin_point, 100) -- Within 100m
    AND ST_DWithin(r.destination_coordinates, v_dest_point, 100)
    AND r.cached_until > timezone('utc', now())
    AND r.created_at > timezone('utc', now()) - (p_max_age_minutes || ' minutes')::interval
  ORDER BY r.created_at DESC
  LIMIT 1;
  
  IF v_route.id IS NOT NULL THEN
    -- Return cached route
    RETURN QUERY
    SELECT 
      v_route.id,
      v_route.distance_meters,
      v_route.duration_seconds,
      v_route.route_polyline,
      true as is_cached;
  ELSE
    -- No cached route found - return null to signal need for API call
    RETURN;
  END IF;
END;
$$;

-- Function to set cache value
CREATE OR REPLACE FUNCTION public.set_cache(
  p_key text,
  p_value jsonb,
  p_ttl_seconds integer DEFAULT 3600,
  p_cache_type text DEFAULT 'generic',
  p_tags text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.cache_entries (
    key,
    value,
    cache_type,
    tags,
    expires_at
  ) VALUES (
    p_key,
    p_value,
    p_cache_type,
    p_tags,
    timezone('utc', now()) + (p_ttl_seconds || ' seconds')::interval
  )
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    cache_type = EXCLUDED.cache_type,
    tags = EXCLUDED.tags,
    expires_at = EXCLUDED.expires_at,
    updated_at = timezone('utc', now());
END;
$$;

-- Function to get cache value
CREATE OR REPLACE FUNCTION public.get_cache(
  p_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT value INTO v_value
  FROM public.cache_entries
  WHERE key = p_key
    AND expires_at > timezone('utc', now());
  
  RETURN v_value;
END;
$$;

-- Function to cleanup expired cache
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.cache_entries
  WHERE expires_at < timezone('utc', now());
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- Function to invalidate cache by tag
CREATE OR REPLACE FUNCTION public.invalidate_cache_by_tag(
  p_tag text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.cache_entries
  WHERE p_tag = ANY(tags);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.find_nearby_locations(double precision, double precision, integer, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cached_route(double precision, double precision, double precision, double precision, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_cache(text, jsonb, integer, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cache(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cache() TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_cache_by_tag(text) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for cache statistics
CREATE OR REPLACE VIEW public.cache_stats AS
SELECT 
  cache_type,
  COUNT(*) as entry_count,
  SUM(CASE WHEN expires_at > timezone('utc', now()) THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN expires_at <= timezone('utc', now()) THEN 1 ELSE 0 END) as expired_count,
  AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_ttl_seconds
FROM public.cache_entries
GROUP BY cache_type
ORDER BY cache_type;

-- View for route cache statistics
CREATE OR REPLACE VIEW public.route_cache_stats AS
SELECT 
  provider,
  COUNT(*) as route_count,
  SUM(CASE WHEN cached_until > timezone('utc', now()) THEN 1 ELSE 0 END) as active_count,
  AVG(distance_meters) as avg_distance_meters,
  AVG(duration_seconds) as avg_duration_seconds
FROM public.routes
WHERE created_at > now() - interval '7 days'
GROUP BY provider
ORDER BY provider;

-- Grant view access
GRANT SELECT ON public.cache_stats TO authenticated;
GRANT SELECT ON public.route_cache_stats TO authenticated;

COMMIT;
