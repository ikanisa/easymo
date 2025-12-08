-- ============================================================================
-- CANONICAL TRIPS TABLE - Single Source of Truth
-- ============================================================================
-- Migration: 20251208092400_create_canonical_trips_table.sql
-- Purpose: Create unified trips table to consolidate rides_trips, mobility_trips,
--          scheduled_trips, and recurring_trips into a single authoritative source
-- 
-- BREAKING CHANGE: This replaces all previous trip tables with simplified schema
-- Migration strategy: Create new table, migrate data, create compatibility views
-- ============================================================================

BEGIN;

-- Drop existing canonical trips table if re-running
DROP TABLE IF EXISTS public.trips CASCADE;

-- ============================================================================
-- CANONICAL TRIPS TABLE: All trip requests (scheduled + request intents)
-- ============================================================================
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Trip Kind (only distinction needed)
  -- 'scheduled': User explicitly scheduled a trip for future
  -- 'request': User triggered "nearby drivers/passengers" search (intent logging)
  trip_kind text NOT NULL DEFAULT 'request' 
    CHECK (trip_kind IN ('scheduled', 'request')),
  
  -- Role
  role text NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type text NOT NULL DEFAULT 'moto' 
    CHECK (vehicle_type IN ('moto', 'car', 'bus', 'truck', 'cab', 'lifan')),
  
  -- Pickup Location (required)
  pickup_latitude double precision NOT NULL,
  pickup_longitude double precision NOT NULL,
  pickup_geog geography(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(pickup_longitude, pickup_latitude), 4326)::geography
  ) STORED,
  pickup_text text,
  pickup_radius_m integer DEFAULT 10000,
  
  -- Dropoff Location (optional)
  dropoff_latitude double precision,
  dropoff_longitude double precision,
  dropoff_geog geography(Point, 4326) GENERATED ALWAYS AS (
    CASE WHEN dropoff_latitude IS NOT NULL AND dropoff_longitude IS NOT NULL
         THEN ST_SetSRID(ST_MakePoint(dropoff_longitude, dropoff_latitude), 4326)::geography
         ELSE NULL
    END
  ) STORED,
  dropoff_text text,
  
  -- Status (simplified - NO lifecycle states, only intent tracking)
  -- 'open': Active trip/request that can be discovered
  -- 'expired': Past expiry time
  -- 'cancelled': User cancelled before expiry
  status text NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'expired', 'cancelled')),
  
  -- Scheduling
  scheduled_at timestamptz,
  recurrence text CHECK (recurrence IN ('once', 'daily', 'weekdays', 'weekly')),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 minutes'),
  last_location_at timestamptz DEFAULT now(),
  
  -- Reference code for human-readable identification
  ref_code text DEFAULT substring(gen_random_uuid()::text, 1, 8),
  
  -- Vehicle details (for drivers)
  number_plate text,
  
  -- Metadata (flexible for future features, preserve original data)
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Data integrity constraints
  CONSTRAINT valid_coordinates CHECK (
    pickup_latitude BETWEEN -90 AND 90 AND 
    pickup_longitude BETWEEN -180 AND 180 AND
    (dropoff_latitude IS NULL OR (dropoff_latitude BETWEEN -90 AND 90)) AND
    (dropoff_longitude IS NULL OR (dropoff_longitude BETWEEN -180 AND 180))
  ),
  
  CONSTRAINT valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT valid_schedule CHECK (scheduled_at IS NULL OR scheduled_at >= created_at)
);

COMMENT ON TABLE public.trips IS 'Canonical trips table: scheduled trips + request intents. No matching feature.';
COMMENT ON COLUMN public.trips.trip_kind IS 'scheduled: explicitly scheduled for future, request: nearby search intent';
COMMENT ON COLUMN public.trips.role IS 'driver: offering ride, passenger: requesting ride';
COMMENT ON COLUMN public.trips.status IS 'open=active/discoverable, expired=TTL reached, cancelled=user cancelled';
COMMENT ON COLUMN public.trips.pickup_geog IS 'PostGIS geography for spatial queries (auto-generated)';
COMMENT ON COLUMN public.trips.metadata IS 'Flexible JSONB for preserving migration data and future features';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Spatial index for nearby queries (most critical)
CREATE INDEX idx_trips_pickup_geog 
  ON public.trips USING GIST(pickup_geog)
  WHERE status = 'open';

-- Active trips by role and vehicle type
CREATE INDEX idx_trips_open_role_vehicle 
  ON public.trips(role, vehicle_type, status, expires_at)
  WHERE status = 'open';

-- User's recent trips
CREATE INDEX idx_trips_user_recent
  ON public.trips(creator_user_id, created_at DESC);

-- Scheduled trips for future activation
CREATE INDEX idx_trips_scheduled 
  ON public.trips(scheduled_at, status)
  WHERE scheduled_at IS NOT NULL AND status = 'open';

-- Expiry check (for cron job)
CREATE INDEX idx_trips_expiry
  ON public.trips(expires_at)
  WHERE status = 'open';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION trips_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION trips_update_updated_at();

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to expire old trips (called by cron)
CREATE OR REPLACE FUNCTION public.expire_old_trips()
RETURNS integer AS $$
DECLARE
  v_expired_count integer;
BEGIN
  UPDATE public.trips
  SET status = 'expired', updated_at = now()
  WHERE status = 'open' 
    AND expires_at < now();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.expire_old_trips IS 'Expires trips past their TTL. Run via pg_cron every 5 minutes.';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Users can manage their own trips
CREATE POLICY "Users manage own trips" 
  ON public.trips
  FOR ALL 
  USING (auth.uid() = creator_user_id);

-- Users can view open trips (for nearby queries)
CREATE POLICY "Users view open trips" 
  ON public.trips
  FOR SELECT 
  USING (status = 'open');

-- Service role has full access
CREATE POLICY "Service role full access trips" 
  ON public.trips
  FOR ALL 
  TO service_role 
  USING (true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trips'
  ) THEN
    RAISE EXCEPTION 'Canonical trips table was not created';
  END IF;
  
  RAISE NOTICE 'Successfully created canonical trips table';
END;
$$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- NEXT STEPS:
-- 1. Run data migration from old tables (next migration)
-- 2. Update edge functions to use canonical trips table
-- 3. Create simplified RPC functions for nearby queries
-- 4. Archive/remove old tables after verification
-- 
-- ============================================================================
