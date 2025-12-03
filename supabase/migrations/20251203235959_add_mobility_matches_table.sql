-- Create mobility_matches table for trip lifecycle management
-- This table tracks active trips between drivers and passengers
-- Referenced by wa-webhook-mobility/handlers/trip_lifecycle.ts

BEGIN;

-- Create mobility_matches table if not exists
CREATE TABLE IF NOT EXISTS public.mobility_matches (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trip participants
  driver_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  passenger_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  
  -- Trip reference (links to rides_trips)
  trip_id uuid REFERENCES public.rides_trips(id) ON DELETE CASCADE,
  
  -- Trip details
  vehicle_type text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  pickup_text text,
  dropoff_latitude double precision,
  dropoff_longitude double precision,
  dropoff_text text,
  
  -- Fare information
  fare_estimate numeric(10, 2),
  actual_fare numeric(10, 2),
  currency text DEFAULT 'RWF',
  distance_km numeric(10, 2),
  duration_minutes integer,
  
  -- Trip lifecycle status
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',           -- Driver/passenger matched, awaiting acceptance
      'accepted',          -- Driver accepted the ride
      'driver_arrived',    -- Driver at pickup location
      'in_progress',       -- Trip in progress
      'completed',         -- Trip successfully completed
      'cancelled_by_driver',
      'cancelled_by_passenger',
      'expired'            -- No response within time limit
    )
  ),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  pickup_time timestamptz,
  dropoff_time timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  
  -- Cancellation details
  cancellation_reason text,
  
  -- Contact information (for notifications)
  driver_phone text,
  passenger_phone text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Add comments
COMMENT ON TABLE public.mobility_matches IS 'Tracks matched trips between drivers and passengers with full lifecycle';
COMMENT ON COLUMN public.mobility_matches.status IS 'Trip lifecycle status: pending -> accepted -> driver_arrived -> in_progress -> completed';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mobility_matches_driver_status 
  ON public.mobility_matches(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_passenger_status 
  ON public.mobility_matches(passenger_id, status);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_active_status 
  ON public.mobility_matches(status) 
  WHERE status IN ('pending', 'accepted', 'driver_arrived', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_mobility_matches_created 
  ON public.mobility_matches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobility_matches_trip_id
  ON public.mobility_matches(trip_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_mobility_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mobility_matches_updated_at ON public.mobility_matches;
CREATE TRIGGER trg_mobility_matches_updated_at
  BEFORE UPDATE ON public.mobility_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_mobility_matches_updated_at();

-- Enable RLS
ALTER TABLE public.mobility_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Service role full access" ON public.mobility_matches;
CREATE POLICY "Service role full access"
  ON public.mobility_matches
  FOR ALL
  USING (current_setting('role') = 'service_role');

DROP POLICY IF EXISTS "Users can view own matches" ON public.mobility_matches;
CREATE POLICY "Users can view own matches"
  ON public.mobility_matches
  FOR SELECT
  USING (auth.uid() = driver_id OR auth.uid() = passenger_id);

DROP POLICY IF EXISTS "Users can update own matches" ON public.mobility_matches;
CREATE POLICY "Users can update own matches"
  ON public.mobility_matches
  FOR UPDATE
  USING (auth.uid() = driver_id OR auth.uid() = passenger_id)
  WITH CHECK (auth.uid() = driver_id OR auth.uid() = passenger_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.mobility_matches TO service_role;
GRANT SELECT, UPDATE ON public.mobility_matches TO authenticated;

COMMIT;
