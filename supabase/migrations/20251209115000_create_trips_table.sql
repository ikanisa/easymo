-- ============================================================================
-- CREATE TRIPS TABLE - Core Mobility Schema
-- ============================================================================
-- Migration: 20251209115000_create_trips_table.sql
-- Date: 2025-12-13
--
-- PURPOSE:
-- Create the canonical trips table for mobility system
-- This migration must run BEFORE 20251209120000 and 20251214000000
--
-- CRITICAL: This creates the table that other migrations depend on
-- ============================================================================

BEGIN;

-- Create trips table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  ref_code TEXT NOT NULL UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8),
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('moto', 'car', 'lifan', 'truck', 'bus', 'van')),
  
  -- Pickup location
  pickup_lat DOUBLE PRECISION NOT NULL CHECK (pickup_lat >= -90 AND pickup_lat <= 90),
  pickup_lng DOUBLE PRECISION NOT NULL CHECK (pickup_lng >= -180 AND pickup_lng <= 180),
  pickup_text TEXT,
  pickup_radius_m INTEGER DEFAULT 1000,
  
  -- Dropoff location (optional)
  dropoff_lat DOUBLE PRECISION CHECK (dropoff_lat >= -90 AND dropoff_lat <= 90),
  dropoff_lng DOUBLE PRECISION CHECK (dropoff_lng >= -180 AND dropoff_lng <= 180),
  dropoff_text TEXT,
  dropoff_radius_m INTEGER,
  
  -- Status and scheduling
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'completed', 'cancelled', 'expired')),
  scheduled_for TIMESTAMPTZ,
  recurrence TEXT CHECK (recurrence IN ('daily', 'weekly', 'weekdays', 'weekends')),
  
  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_role ON public.trips(role);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_type ON public.trips(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_expires_at ON public.trips(expires_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trips_pickup_coords ON public.trips(pickup_lat, pickup_lng) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trips_scheduled_for ON public.trips(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_ref_code ON public.trips(ref_code);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.trips_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trips_set_updated_at ON public.trips;
CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trips_set_updated_at();

-- Add comments
COMMENT ON TABLE public.trips IS 'Canonical table for all trip requests (both drivers and passengers)';
COMMENT ON COLUMN public.trips.role IS 'User role: driver (offering ride) or passenger (seeking ride)';
COMMENT ON COLUMN public.trips.vehicle_type IS 'Vehicle type: moto, car, lifan, truck, bus, van';
COMMENT ON COLUMN public.trips.status IS 'Trip status: open (active), matched, completed, cancelled, expired';
COMMENT ON COLUMN public.trips.expires_at IS 'Auto-expiry timestamp (default 30 minutes)';
COMMENT ON COLUMN public.trips.ref_code IS 'Short reference code for user display';
COMMENT ON COLUMN public.trips.phone IS 'WhatsApp phone number for direct contact';

-- Enable RLS
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
  ON public.trips FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass (for edge functions)
CREATE POLICY "Service role has full access"
  ON public.trips FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

COMMIT;
