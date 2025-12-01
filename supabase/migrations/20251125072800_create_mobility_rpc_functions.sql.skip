-- Migration: Create missing RPC functions for wa-webhook-mobility
-- Created: 2025-11-25
-- Purpose: Add RPC functions referenced by wa-webhook-mobility edge function
-- Related: WA_WEBHOOK_MOBILITY_DEEP_ANALYSIS.md

BEGIN;

-- Ensure PostGIS is available for geography helpers used in mobility RPCs.
-- Supabase projects generally support CREATE EXTENSION; this will no-op if
-- PostGIS is already installed.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- Function 1: rides_update_driver_location
-- Purpose: Update driver's last known location for matching
-- Used by: handlers/go_online.ts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rides_update_driver_location(
  p_driver_id UUID,
  p_latitude DECIMAL,
  p_longitude DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profile with new location
  UPDATE public.profiles
  SET 
    last_location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326),
    updated_at = NOW()
  WHERE id = p_driver_id;
  
  -- Also update driver status if exists
  UPDATE public.rides_driver_status
  SET
    last_location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326),
    updated_at = NOW()
  WHERE driver_id = p_driver_id;
  
END;
$$;

COMMENT ON FUNCTION public.rides_update_driver_location IS 
'Updates driver location in profiles and rides_driver_status tables';

-- ============================================================================
-- Function 2: is_driver_insurance_valid
-- Purpose: Check if driver has valid active insurance
-- Used by: handlers/driver_insurance.ts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_driver_insurance_valid(
  p_driver_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  -- Check if driver has active, non-expired insurance certificate
  SELECT EXISTS(
    SELECT 1 
    FROM public.driver_insurance_certificates
    WHERE driver_id = p_driver_id
      AND status = 'verified'
      AND expiry_date > NOW()
  ) INTO v_valid;
  
  RETURN COALESCE(v_valid, false);
END;
$$;

COMMENT ON FUNCTION public.is_driver_insurance_valid IS 
'Returns true if driver has at least one verified, non-expired insurance certificate';

-- ============================================================================
-- Function 3: get_driver_active_insurance
-- Purpose: Get driver's active insurance details
-- Used by: handlers/driver_insurance.ts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_driver_active_insurance(
  p_driver_id UUID
)
RETURNS TABLE(
  id UUID,
  policy_number TEXT,
  provider TEXT,
  expiry_date TIMESTAMP WITH TIME ZONE,
  status TEXT,
  certificate_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dic.id,
    dic.policy_number,
    dic.provider,
    dic.expiry_date,
    dic.status,
    dic.certificate_url
  FROM public.driver_insurance_certificates dic
  WHERE dic.driver_id = p_driver_id
    AND dic.status = 'verified'
    AND dic.expiry_date > NOW()
  ORDER BY dic.expiry_date DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_driver_active_insurance IS 
'Returns the most recent active insurance certificate for a driver';

-- ============================================================================
-- Function 4: find_online_drivers_near_trip
-- Purpose: Find online drivers within radius of a location
-- Used by: notifications/drivers.ts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_online_drivers_near_trip(
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_radius_meters INTEGER DEFAULT 10000,
  p_vehicle_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  driver_id UUID,
  distance_meters DECIMAL,
  phone TEXT,
  full_name TEXT,
  vehicle_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as driver_id,
    ST_Distance(
      p.last_location::geography,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
    ) as distance_meters,
    p.phone,
    p.full_name,
    COALESCE(p.metadata->>'vehicle_type', 'standard') as vehicle_type
  FROM public.profiles p
  INNER JOIN public.rides_driver_status rds ON rds.driver_id = p.id
  WHERE 
    p.role = 'driver'
    AND rds.status = 'online'
    AND p.last_location IS NOT NULL
    AND ST_DWithin(
      p.last_location::geography,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_meters
    )
    AND (p_vehicle_type IS NULL OR p.metadata->>'vehicle_type' = p_vehicle_type)
  ORDER BY distance_meters ASC
  LIMIT 20;
END;
$$;

COMMENT ON FUNCTION public.find_online_drivers_near_trip IS 
'Finds up to 20 online drivers within specified radius, optionally filtered by vehicle type';

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.rides_update_driver_location TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_insurance_valid TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_active_insurance TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_online_drivers_near_trip TO authenticated;

GRANT EXECUTE ON FUNCTION public.rides_update_driver_location TO service_role;
GRANT EXECUTE ON FUNCTION public.is_driver_insurance_valid TO service_role;
GRANT EXECUTE ON FUNCTION public.get_driver_active_insurance TO service_role;
GRANT EXECUTE ON FUNCTION public.find_online_drivers_near_trip TO service_role;

COMMIT;
