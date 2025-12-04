-- Comprehensive Mobility System Fixes
-- Addresses critical issues found in deep audit

BEGIN;

-- ============================================================================
-- FIX #1: Add missing number_plate column to rides_trips
-- ============================================================================
ALTER TABLE public.rides_trips 
ADD COLUMN IF NOT EXISTS number_plate text;

COMMENT ON COLUMN public.rides_trips.number_plate IS 
  'Vehicle license plate number for driver identification';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_rides_trips_number_plate 
  ON public.rides_trips(number_plate) 
  WHERE number_plate IS NOT NULL;

-- ============================================================================
-- FIX #2: Add spatial indexes for better geography query performance
-- ============================================================================
-- Drop old indexes if they exist (non-spatial)
DROP INDEX IF EXISTS idx_rides_trips_pickup_coords;
DROP INDEX IF EXISTS idx_rides_trips_dropoff_coords;

-- Create GIST indexes on geography columns for efficient spatial queries
CREATE INDEX IF NOT EXISTS idx_rides_trips_pickup_gist 
  ON public.rides_trips USING GIST (pickup) 
  WHERE pickup IS NOT NULL 
    AND status IN ('open', 'pending', 'active');

CREATE INDEX IF NOT EXISTS idx_rides_trips_dropoff_gist 
  ON public.rides_trips USING GIST (dropoff) 
  WHERE dropoff IS NOT NULL;

-- Composite index for common query pattern (removed now() from WHERE clause)
CREATE INDEX IF NOT EXISTS idx_rides_trips_active_nearby 
  ON public.rides_trips (status, role, vehicle_type, expires_at, last_location_at)
  WHERE status IN ('open', 'pending', 'active');

-- ============================================================================
-- FIX #3: Add created_at index for time window queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_rides_trips_created_window 
  ON public.rides_trips (created_at DESC, status, role)
  WHERE status IN ('open', 'pending', 'active');

-- ============================================================================
-- FIX #4: Add automated cleanup function for expired trips
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_mobility_trips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count integer;
BEGIN
  -- Archive or mark as expired trips that are past expiry and not matched
  UPDATE public.rides_trips
  SET 
    status = 'expired',
    updated_at = now()
  WHERE status IN ('open', 'pending')
    AND expires_at < now()
    AND matched_at IS NULL;
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Log cleanup event
  INSERT INTO public.system_events (event_type, metadata)
  VALUES ('mobility_cleanup', jsonb_build_object(
    'cleaned_count', cleaned_count,
    'timestamp', now()
  ))
  ON CONFLICT DO NOTHING;
  
  RETURN cleaned_count;
EXCEPTION
  WHEN OTHERS THEN
    -- If system_events doesn't exist, just return count
    RETURN cleaned_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_stale_mobility_trips IS 
  'Marks expired trips as expired status. Run via cron every 15 minutes.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.cleanup_stale_mobility_trips() 
  TO service_role, authenticated;

-- ============================================================================
-- FIX #5: Add location staleness tracking function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_location_staleness_stats()
RETURNS TABLE (
  status text,
  role text,
  total_count bigint,
  stale_count bigint,
  avg_age_minutes numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    status,
    role,
    COUNT(*) as total_count,
    COUNT(*) FILTER (
      WHERE last_location_at < now() - interval '30 minutes'
    ) as stale_count,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (now() - last_location_at)) / 60)::numeric,
      1
    ) as avg_age_minutes
  FROM public.rides_trips
  WHERE status IN ('open', 'pending', 'active')
    AND expires_at > now()
  GROUP BY status, role
  ORDER BY status, role;
$$;

COMMENT ON FUNCTION public.get_location_staleness_stats IS
  'Monitor location freshness for active trips';

GRANT EXECUTE ON FUNCTION public.get_location_staleness_stats() 
  TO service_role, authenticated;

-- ============================================================================
-- FIX #6: Update match functions to handle number_plate properly
-- Already fixed in previous migration 20251204105523
-- ============================================================================

-- ============================================================================
-- FIX #7: Add validation constraints (with data normalization)
-- ============================================================================
-- First normalize vehicle_type values
UPDATE public.rides_trips
SET vehicle_type = CASE 
  WHEN vehicle_type = 'veh_moto' THEN 'moto'
  WHEN vehicle_type = 'veh_cab' THEN 'cab'
  WHEN vehicle_type = 'veh_lifan' THEN 'lifan'
  WHEN vehicle_type = 'veh_truck' THEN 'truck'
  WHEN vehicle_type = 'veh_others' THEN 'other'
  ELSE vehicle_type
END
WHERE vehicle_type LIKE 'veh_%';

-- Ensure vehicle_type is from valid set
ALTER TABLE public.rides_trips
DROP CONSTRAINT IF EXISTS rides_trips_vehicle_type_check;

ALTER TABLE public.rides_trips
ADD CONSTRAINT rides_trips_vehicle_type_check 
  CHECK (vehicle_type IN ('moto', 'cab', 'lifan', 'truck', 'bus', 'van', 'other'));

-- Ensure role is valid
ALTER TABLE public.rides_trips
DROP CONSTRAINT IF EXISTS rides_trips_role_check;

ALTER TABLE public.rides_trips
ADD CONSTRAINT rides_trips_role_check 
  CHECK (role IN ('driver', 'passenger'));

-- Ensure status is valid
ALTER TABLE public.rides_trips
DROP CONSTRAINT IF EXISTS rides_trips_status_check;

ALTER TABLE public.rides_trips
ADD CONSTRAINT rides_trips_status_check 
  CHECK (status IN ('open', 'pending', 'active', 'scheduled', 'matched', 'in_progress', 'completed', 'cancelled', 'expired'));

-- Ensure coordinates are valid when present
ALTER TABLE public.rides_trips
DROP CONSTRAINT IF EXISTS rides_trips_coords_check;

ALTER TABLE public.rides_trips
ADD CONSTRAINT rides_trips_coords_check 
  CHECK (
    (pickup_latitude IS NULL AND pickup_longitude IS NULL) OR
    (pickup_latitude BETWEEN -90 AND 90 AND pickup_longitude BETWEEN -180 AND 180)
  );

ALTER TABLE public.rides_trips
DROP CONSTRAINT IF EXISTS rides_trips_dropoff_coords_check;

ALTER TABLE public.rides_trips
ADD CONSTRAINT rides_trips_dropoff_coords_check 
  CHECK (
    (dropoff_latitude IS NULL AND dropoff_longitude IS NULL) OR
    (dropoff_latitude BETWEEN -90 AND 90 AND dropoff_longitude BETWEEN -180 AND 180)
  );

-- ============================================================================
-- FIX #8: Add helpful utility views
-- ============================================================================
CREATE OR REPLACE VIEW public.active_drivers AS
SELECT 
  rt.id,
  rt.creator_user_id,
  rt.vehicle_type,
  rt.number_plate,
  rt.pickup_latitude,
  rt.pickup_longitude,
  rt.pickup_text,
  rt.last_location_at,
  rt.created_at,
  EXTRACT(EPOCH FROM (now() - rt.last_location_at)) / 60 AS age_minutes,
  p.display_name,
  p.phone_number
FROM public.rides_trips rt
INNER JOIN public.profiles p ON p.user_id = rt.creator_user_id
WHERE rt.role = 'driver'
  AND rt.status IN ('open', 'active')
  AND rt.expires_at > now()
  AND rt.last_location_at > now() - interval '30 minutes'
ORDER BY rt.last_location_at DESC;

COMMENT ON VIEW public.active_drivers IS
  'Real-time view of active drivers for admin monitoring';

GRANT SELECT ON public.active_drivers TO service_role, authenticated;

CREATE OR REPLACE VIEW public.active_passengers AS
SELECT 
  rt.id,
  rt.creator_user_id,
  rt.vehicle_type,
  rt.pickup_latitude,
  rt.pickup_longitude,
  rt.pickup_text,
  rt.dropoff_text,
  rt.last_location_at,
  rt.created_at,
  EXTRACT(EPOCH FROM (now() - rt.last_location_at)) / 60 AS age_minutes,
  p.display_name,
  p.phone_number
FROM public.rides_trips rt
INNER JOIN public.profiles p ON p.user_id = rt.creator_user_id
WHERE rt.role = 'passenger'
  AND rt.status IN ('open', 'active')
  AND rt.expires_at > now()
  AND rt.last_location_at > now() - interval '30 minutes'
ORDER BY rt.last_location_at DESC;

COMMENT ON VIEW public.active_passengers IS
  'Real-time view of active passenger requests for admin monitoring';

GRANT SELECT ON public.active_passengers TO service_role, authenticated;

-- ============================================================================
-- FIX #9: Add trip matching analytics function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.analyze_trip_matching_performance(
  _hours_back integer DEFAULT 24
)
RETURNS TABLE (
  metric text,
  value numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('open', 'pending')) as total_open,
      COUNT(*) FILTER (WHERE matched_at IS NOT NULL) as total_matched,
      COUNT(*) FILTER (WHERE status = 'expired') as total_expired,
      AVG(EXTRACT(EPOCH FROM (matched_at - created_at)) / 60) FILTER (WHERE matched_at IS NOT NULL) as avg_match_time_minutes,
      AVG(EXTRACT(EPOCH FROM (expires_at - created_at)) / 60) as avg_expiry_minutes
    FROM public.rides_trips
    WHERE created_at > now() - (_hours_back || ' hours')::interval
  )
  SELECT 'total_trips'::text, (total_open + total_matched + total_expired)::numeric FROM stats
  UNION ALL
  SELECT 'open_trips'::text, total_open::numeric FROM stats
  UNION ALL
  SELECT 'matched_trips'::text, total_matched::numeric FROM stats
  UNION ALL
  SELECT 'expired_trips'::text, total_expired::numeric FROM stats
  UNION ALL
  SELECT 'match_rate_percent'::text, 
    ROUND((total_matched::numeric / NULLIF(total_matched + total_expired, 0) * 100), 2) 
  FROM stats
  UNION ALL
  SELECT 'avg_match_time_minutes'::text, ROUND(avg_match_time_minutes::numeric, 2) FROM stats
  UNION ALL
  SELECT 'avg_expiry_minutes'::text, ROUND(avg_expiry_minutes::numeric, 2) FROM stats;
$$;

COMMENT ON FUNCTION public.analyze_trip_matching_performance IS
  'Analytics for trip matching success rate and performance';

GRANT EXECUTE ON FUNCTION public.analyze_trip_matching_performance 
  TO service_role, authenticated;

COMMIT;
