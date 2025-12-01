-- Add cron jobs for mobility system maintenance
-- 1. Daily cleanup of expired intents
-- 2. Recurring trip activation (creates trip records from recurring_trips table)

BEGIN;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: Cleanup expired intents
CREATE OR REPLACE FUNCTION public.cleanup_expired_mobility_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.mobility_intents
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Log the cleanup
  INSERT INTO public.system_logs (event_type, details)
  VALUES ('MOBILITY_INTENT_CLEANUP', jsonb_build_object(
    'deleted_count', v_deleted_count,
    'timestamp', now()
  ));
  
  RETURN v_deleted_count;
END;
$$;

-- Function: Create trip records from recurring_trips for today
CREATE OR REPLACE FUNCTION public.activate_recurring_trips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recurring_trip RECORD;
  v_created_count integer := 0;
  v_today_dow integer;
  v_today_date date := CURRENT_DATE;
  v_origin RECORD;
  v_dest RECORD;
BEGIN
  -- Get day of week (1=Monday, 7=Sunday)
  v_today_dow := EXTRACT(ISODOW FROM v_today_date);
  
  -- Loop through active recurring trips that apply today
  FOR v_recurring_trip IN
    SELECT rt.*, p.user_id
    FROM public.recurring_trips rt
    JOIN public.profiles p ON p.user_id = rt.user_id
    WHERE rt.active = true
      AND v_today_dow = ANY(rt.days_of_week)
  LOOP
    -- Get origin and destination favorites
    SELECT lat, lng, label INTO v_origin
    FROM public.saved_locations
    WHERE id = v_recurring_trip.origin_favorite_id;
    
    SELECT lat, lng, label INTO v_dest
    FROM public.saved_locations
    WHERE id = v_recurring_trip.dest_favorite_id;
    
    IF v_origin.lat IS NOT NULL AND v_dest.lat IS NOT NULL THEN
      -- Check if trip already created today
      IF NOT EXISTS (
        SELECT 1 FROM public.rides_trips
        WHERE creator_user_id = v_recurring_trip.user_id
          AND DATE(scheduled_at) = v_today_date
          AND pickup_latitude = v_origin.lat
          AND pickup_longitude = v_origin.lng
      ) THEN
        -- Create the scheduled trip
        INSERT INTO public.rides_trips (
          creator_user_id,
          role,
          vehicle_type,
          pickup_latitude,
          pickup_longitude,
          pickup,
          pickup_text,
          dropoff_latitude,
          dropoff_longitude,
          dropoff,
          dropoff_text,
          status,
          scheduled_at,
          recurrence,
          expires_at
        ) VALUES (
          v_recurring_trip.user_id,
          v_recurring_trip.role,
          v_recurring_trip.vehicle_type,
          v_origin.lat,
          v_origin.lng,
          ST_SetSRID(ST_MakePoint(v_origin.lng, v_origin.lat), 4326),
          v_origin.label,
          v_dest.lat,
          v_dest.lng,
          ST_SetSRID(ST_MakePoint(v_dest.lng, v_dest.lat), 4326),
          v_dest.label,
          'scheduled',
          (v_today_date + v_recurring_trip.time_local)::timestamptz,
          CASE 
            WHEN array_length(v_recurring_trip.days_of_week, 1) = 7 THEN 'daily'
            WHEN array_length(v_recurring_trip.days_of_week, 1) = 5 AND 
                 v_recurring_trip.days_of_week @> ARRAY[1,2,3,4,5] THEN 'weekdays'
            ELSE 'weekly'
          END,
          (v_today_date + v_recurring_trip.time_local + interval '2 hours')::timestamptz
        );
        
        v_created_count := v_created_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  -- Log the activation
  IF v_created_count > 0 THEN
    INSERT INTO public.system_logs (event_type, details)
    VALUES ('RECURRING_TRIPS_ACTIVATED', jsonb_build_object(
      'created_count', v_created_count,
      'date', v_today_date,
      'timestamp', now()
    ));
  END IF;
  
  RETURN v_created_count;
END;
$$;

-- Add system_logs table if it doesn't exist (for tracking cron job execution)
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON public.system_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON public.system_logs(created_at DESC);

-- Add role and vehicle_type to recurring_trips if not exists
ALTER TABLE public.recurring_trips 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'passenger' CHECK (role IN ('driver', 'passenger')),
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Schedule cron jobs
-- 1. Cleanup expired intents every day at 2 AM
SELECT cron.schedule(
  'cleanup-expired-mobility-intents',
  '0 2 * * *',  -- Every day at 2 AM
  $$SELECT public.cleanup_expired_mobility_intents();$$
);

-- 2. Activate recurring trips every day at 1 AM (before people wake up)
SELECT cron.schedule(
  'activate-recurring-trips',
  '0 1 * * *',  -- Every day at 1 AM
  $$SELECT public.activate_recurring_trips();$$
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_mobility_intents() TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_recurring_trips() TO service_role;

COMMIT;
