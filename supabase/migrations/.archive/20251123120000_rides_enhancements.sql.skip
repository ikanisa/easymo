-- Migration: Rides Enhancements
-- Created: 2025-11-23
-- Purpose: 
-- 1. Add location caching to profiles.
-- 2. Create ride_requests table to track requests and driver responses.
-- 3. Create ride_notifications table to log notifications.

BEGIN;

-- 1. Add location caching to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_location geography(POINT, 4326),
ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

-- 2. Create ride_requests table
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id uuid, -- Nullable, no FK constraint since trips table may not exist
    passenger_id uuid REFERENCES public.profiles(user_id),
    driver_id uuid REFERENCES public.profiles(user_id),
    status text DEFAULT 'pending', -- pending, accepted, rejected, expired
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Create ride_notifications table
CREATE TABLE IF NOT EXISTS public.ride_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id uuid, -- Nullable, no FK constraint since trips table may not exist
    driver_id uuid REFERENCES public.profiles(user_id),
    wa_message_id text,
    status text DEFAULT 'sent',
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_notifications ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ride_requests TO service_role;
GRANT ALL ON public.ride_notifications TO service_role;

-- Index for spatial queries on profiles (for "Go Online" feature if we query profiles directly later)
CREATE INDEX IF NOT EXISTS profiles_last_location_idx ON public.profiles USING GIST (last_location);

COMMIT;
