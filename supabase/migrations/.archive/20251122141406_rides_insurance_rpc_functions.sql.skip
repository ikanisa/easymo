-- =====================================================================
-- RIDES & INSURANCE AGENT RPC FUNCTIONS
-- =====================================================================
-- Supporting database functions for agent logic
-- Created: 2025-11-22
-- =====================================================================

BEGIN;

-- =====================================================================
-- RIDES: Find nearby drivers
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rides_find_nearby_drivers(
  lat double precision,
  lng double precision,
  radius_km double precision DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  distance_km double precision,
  current_lat double precision,
  current_lng double precision,
  last_seen_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.user_id,
    -- Haversine formula for distance in km
    (
      6371 * acos(
        cos(radians(lat)) * cos(radians(ds.current_lat)) *
        cos(radians(ds.current_lng) - radians(lng)) +
        sin(radians(lat)) * sin(radians(ds.current_lat))
      )
    ) AS distance_km,
    ds.current_lat,
    ds.current_lng,
    ds.last_seen_at,
    ds.metadata
  FROM public.rides_driver_status ds
  WHERE ds.is_online = true
    AND ds.current_lat IS NOT NULL
    AND ds.current_lng IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(lat)) * cos(radians(ds.current_lat)) *
        cos(radians(ds.current_lng) - radians(lng)) +
        sin(radians(lat)) * sin(radians(ds.current_lat))
      )
    ) <= radius_km
  ORDER BY distance_km ASC
  LIMIT 20;
END;
$$;

-- =====================================================================
-- RIDES: Find nearby pending trips (for drivers)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rides_find_nearby_trips(
  lat double precision,
  lng double precision,
  radius_km double precision DEFAULT 5
)
RETURNS TABLE (
  trip_id uuid,
  rider_user_id uuid,
  distance_km double precision,
  pickup_lat double precision,
  pickup_lng double precision,
  pickup_address text,
  dropoff_address text,
  scheduled_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS trip_id,
    t.rider_user_id,
    (
      6371 * acos(
        cos(radians(lat)) * cos(radians(t.pickup_lat)) *
        cos(radians(t.pickup_lng) - radians(lng)) +
        sin(radians(lat)) * sin(radians(t.pickup_lat))
      )
    ) AS distance_km,
    t.pickup_lat,
    t.pickup_lng,
    t.pickup_address,
    t.dropoff_address,
    t.scheduled_at,
    t.metadata
  FROM public.rides_trips t
  WHERE t.status = 'pending'
    AND t.pickup_lat IS NOT NULL
    AND t.pickup_lng IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(lat)) * cos(radians(t.pickup_lat)) *
        cos(radians(t.pickup_lng) - radians(lng)) +
        sin(radians(lat)) * sin(radians(t.pickup_lat))
      )
    ) <= radius_km
  ORDER BY distance_km ASC
  LIMIT 20;
END;
$$;

-- =====================================================================
-- INSURANCE: Get user's insurance requests
-- =====================================================================

CREATE OR REPLACE FUNCTION public.insurance_get_user_requests(
  p_user_id uuid
)
RETURNS TABLE (
  request_id uuid,
  profile_id uuid,
  vehicle_identifier text,
  request_type text,
  status text,
  requested_at timestamptz,
  resolved_at timestamptz,
  quote_details jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    qr.id AS request_id,
    qr.profile_id,
    ip.vehicle_identifier,
    qr.request_type,
    qr.status,
    qr.requested_at,
    qr.resolved_at,
    qr.quote_details
  FROM public.insurance_quote_requests qr
  JOIN public.insurance_profiles ip ON ip.id = qr.profile_id
  WHERE ip.user_id = p_user_id
  ORDER BY qr.requested_at DESC;
END;
$$;

-- =====================================================================
-- INSURANCE: Get profile documents
-- =====================================================================

CREATE OR REPLACE FUNCTION public.insurance_get_profile_documents(
  p_profile_id uuid
)
RETURNS TABLE (
  document_id uuid,
  document_type text,
  file_url text,
  uploaded_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    id AS document_id,
    document_type,
    file_url,
    uploaded_at,
    metadata
  FROM public.insurance_documents
  WHERE profile_id = p_profile_id
  ORDER BY uploaded_at DESC;
END;
$$;

-- =====================================================================
-- GRANT PERMISSIONS
-- =====================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.rides_find_nearby_drivers TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rides_find_nearby_trips TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.insurance_get_user_requests TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.insurance_get_profile_documents TO authenticated, anon;

-- Grant permissions to service role
GRANT EXECUTE ON FUNCTION public.rides_find_nearby_drivers TO service_role;
GRANT EXECUTE ON FUNCTION public.rides_find_nearby_trips TO service_role;
GRANT EXECUTE ON FUNCTION public.insurance_get_user_requests TO service_role;
GRANT EXECUTE ON FUNCTION public.insurance_get_profile_documents TO service_role;

COMMIT;
