-- Migration: Create ride notifications and requests tables
-- Created: 2025-11-23

BEGIN;

CREATE TABLE IF NOT EXISTS public.ride_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ride_notifications_trip ON public.ride_notifications(trip_id);

CREATE TABLE IF NOT EXISTS public.ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  passenger_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ride_requests_trip ON public.ride_requests(trip_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_driver ON public.ride_requests(driver_id);

ALTER TABLE public.ride_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ride_notifications TO service_role;
GRANT ALL ON public.ride_requests TO service_role;

COMMIT;

