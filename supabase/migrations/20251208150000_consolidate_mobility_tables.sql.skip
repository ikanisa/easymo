-- ============================================================================
-- MOBILITY CONSOLIDATION MIGRATION
-- ============================================================================
-- Migration: 20251208150000_consolidate_mobility_tables.sql
-- Purpose: Consolidate all mobility trip tables into canonical schema
-- 
-- CRITICAL: This migration:
-- 1. Migrates data from rides_trips → trips (if exists)
-- 2. Migrates data from mobility_trips → trips (if exists)
-- 3. Migrates data from mobility_trip_matches → mobility_matches
-- 4. Updates all RPC functions to use canonical tables
-- 5. Fixes foreign key constraints
--
-- SAFETY: Run backup_mobility_tables.sh BEFORE applying this migration
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DATA MIGRATION - rides_trips → trips (if table exists)
-- ============================================================================

DO $$
BEGIN
  -- Check if rides_trips table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'rides_trips'
  ) THEN
    RAISE NOTICE 'Migrating data from rides_trips to trips...';
    
    -- Insert data from rides_trips into canonical trips table
    INSERT INTO trips (
      id,
      creator_user_id,
      trip_kind,
      role,
      vehicle_type,
      pickup_latitude,
      pickup_longitude,
      pickup_text,
      pickup_radius_m,
      dropoff_latitude,
      dropoff_longitude,
      dropoff_text,
      status,
      scheduled_at,
      recurrence,
      created_at,
      updated_at,
      expires_at,
      ref_code,
      number_plate,
      metadata
    )
    SELECT 
      id,
      creator_user_id,
      CASE 
        WHEN scheduled_at IS NOT NULL THEN 'scheduled'::text
        ELSE 'request'::text
      END as trip_kind,
      role,
      COALESCE(vehicle_type, 'moto'),
      pickup_latitude,
      pickup_longitude,
      pickup_text,
      COALESCE(pickup_radius_m, 10000),
      dropoff_latitude,
      dropoff_longitude,
      dropoff_text,
      CASE 
        WHEN status IN ('pending', 'active', 'open') THEN 'open'::text
        WHEN status = 'cancelled' THEN 'cancelled'::text
        ELSE 'expired'::text
      END as status,
      scheduled_at,
      recurrence,
      created_at,
      COALESCE(updated_at, created_at),
      COALESCE(expires_at, created_at + interval '90 minutes'),
      ref_code,
      number_plate,
      jsonb_build_object(
        'source', 'rides_trips', 
        'original_status', status,
        'migrated_at', now()
      )
    FROM rides_trips
    WHERE NOT EXISTS (SELECT 1 FROM trips WHERE trips.id = rides_trips.id)
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'rides_trips migration complete';
  ELSE
    RAISE NOTICE 'rides_trips table does not exist - skipping migration';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: DATA MIGRATION - mobility_trips → trips (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'mobility_trips'
  ) THEN
    RAISE NOTICE 'Migrating data from mobility_trips to trips...';
    
    INSERT INTO trips (
      id,
      creator_user_id,
      trip_kind,
      role,
      vehicle_type,
      pickup_latitude,
      pickup_longitude,
      pickup_text,
      pickup_radius_m,
      dropoff_latitude,
      dropoff_longitude,
      dropoff_text,
      status,
      scheduled_at,
      recurrence,
      created_at,
      updated_at,
      expires_at,
      metadata
    )
    SELECT 
      id,
      creator_user_id,
      CASE 
        WHEN scheduled_for IS NOT NULL THEN 'scheduled'::text
        ELSE 'request'::text
      END,
      role,
      vehicle_type,
      pickup_lat,
      pickup_lng,
      pickup_text,
      COALESCE(pickup_radius_m, 10000),
      dropoff_lat,
      dropoff_lng,
      dropoff_text,
      CASE 
        WHEN status = 'matched' THEN 'open'::text
        ELSE status::text
      END,
      scheduled_for,
      recurrence,
      created_at,
      created_at,
      expires_at,
      jsonb_build_object(
        'source', 'mobility_trips',
        'original_status', status,
        'migrated_at', now()
      )
    FROM mobility_trips
    WHERE NOT EXISTS (SELECT 1 FROM trips WHERE trips.id = mobility_trips.id)
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'mobility_trips migration complete';
  ELSE
    RAISE NOTICE 'mobility_trips table does not exist - skipping migration';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: DATA MIGRATION - mobility_trip_matches → mobility_matches
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'mobility_trip_matches'
  ) THEN
    RAISE NOTICE 'Migrating data from mobility_trip_matches to mobility_matches...';
    
    INSERT INTO mobility_matches (
      id,
      driver_id,
      passenger_id,
      trip_id,
      vehicle_type,
      pickup_latitude,
      pickup_longitude,
      pickup_text,
      dropoff_latitude,
      dropoff_longitude,
      dropoff_text,
      fare_estimate,
      actual_fare,
      currency,
      distance_km,
      duration_minutes,
      status,
      created_at,
      updated_at,
      matched_at,
      accepted_at,
      started_at,
      pickup_time,
      completed_at,
      cancelled_at,
      cancellation_reason,
      driver_phone,
      passenger_phone,
      metadata
    )
    SELECT 
      mtm.id,
      mtm.driver_user_id,
      mtm.passenger_user_id,
      mtm.passenger_trip_id,
      mtm.vehicle_type,
      COALESCE(ST_Y(mtm.pickup_location::geometry), 0),
      COALESCE(ST_X(mtm.pickup_location::geometry), 0),
      mtm.pickup_address,
      CASE WHEN mtm.dropoff_location IS NOT NULL 
           THEN ST_Y(mtm.dropoff_location::geometry) 
           ELSE NULL END,
      CASE WHEN mtm.dropoff_location IS NOT NULL 
           THEN ST_X(mtm.dropoff_location::geometry) 
           ELSE NULL END,
      mtm.dropoff_address,
      mtm.estimated_fare,
      mtm.actual_fare,
      COALESCE(mtm.currency, 'RWF'),
      mtm.distance_km,
      mtm.duration_minutes,
      mtm.status,
      mtm.created_at,
      mtm.updated_at,
      mtm.created_at,
      mtm.accepted_at,
      mtm.started_at,
      mtm.picked_up_at,
      mtm.completed_at,
      mtm.cancelled_at,
      mtm.cancellation_reason,
      mtm.driver_phone,
      mtm.passenger_phone,
      jsonb_build_object(
        'source', 'mobility_trip_matches',
        'driver_trip_id', mtm.driver_trip_id,
        'passenger_trip_id', mtm.passenger_trip_id,
        'rating_by_passenger', mtm.rating_by_passenger,
        'rating_by_driver', mtm.rating_by_driver,
        'feedback_by_passenger', mtm.feedback_by_passenger,
        'feedback_by_driver', mtm.feedback_by_driver,
        'migrated_at', now()
      )
    FROM mobility_trip_matches mtm
    WHERE NOT EXISTS (
      SELECT 1 FROM mobility_matches mm WHERE mm.id = mtm.id
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'mobility_trip_matches migration complete';
  ELSE
    RAISE NOTICE 'mobility_trip_matches table does not exist - skipping migration';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: UPDATE FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Fix trip_payment_requests to reference mobility_matches instead of mobility_trip_matches
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trip_payment_requests_trip_id_fkey'
      AND table_name = 'trip_payment_requests'
  ) THEN
    ALTER TABLE trip_payment_requests 
      DROP CONSTRAINT trip_payment_requests_trip_id_fkey;
    
    ALTER TABLE trip_payment_requests 
      ADD CONSTRAINT trip_payment_requests_trip_id_fkey 
      FOREIGN KEY (trip_id) REFERENCES mobility_matches(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated trip_payment_requests foreign key';
  END IF;
END $$;

-- Fix trip_status_audit to reference mobility_matches
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trip_status_audit_trip_id_fkey'
      AND table_name = 'trip_status_audit'
  ) THEN
    ALTER TABLE trip_status_audit 
      DROP CONSTRAINT trip_status_audit_trip_id_fkey;
    
    ALTER TABLE trip_status_audit 
      ADD CONSTRAINT trip_status_audit_trip_id_fkey 
      FOREIGN KEY (trip_id) REFERENCES mobility_matches(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated trip_status_audit foreign key';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: UPDATE RPC FUNCTIONS TO USE CANONICAL TABLES
-- ============================================================================

-- Update match_drivers_for_trip_v2 to query canonical trips table
CREATE OR REPLACE FUNCTION public.match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 30
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text,
  number_plate text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_radius_km double precision;
BEGIN
  -- Get trip details from CANONICAL trips table
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  -- Find matching drivers from CANONICAL trips table
  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
              cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
            ))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    NULL::timestamptz AS matched_at,
    t.created_at,
    t.vehicle_type,
    t.number_plate
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'driver'
    AND t.status = 'open'
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND (v_vehicle_type IS NULL OR t.vehicle_type = v_vehicle_type)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= v_radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- Update match_passengers_for_trip_v2
CREATE OR REPLACE FUNCTION public.match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 30
)
RETURNS TABLE (
  trip_id uuid,
  creator_user_id uuid,
  whatsapp_e164 text,
  ref_code text,
  distance_km numeric,
  drop_bonus_m numeric,
  pickup_text text,
  dropoff_text text,
  matched_at timestamptz,
  created_at timestamptz,
  vehicle_type text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pickup_lat double precision;
  v_pickup_lng double precision;
  v_dropoff_lat double precision;
  v_dropoff_lng double precision;
  v_vehicle_type text;
  v_radius_km double precision;
BEGIN
  SELECT 
    t.pickup_latitude,
    t.pickup_longitude,
    t.dropoff_latitude,
    t.dropoff_longitude,
    t.vehicle_type,
    CASE 
      WHEN _radius_m IS NULL OR _radius_m <= 0 THEN 10.0
      ELSE _radius_m::double precision / 1000.0
    END
  INTO 
    v_pickup_lat,
    v_pickup_lng,
    v_dropoff_lat,
    v_dropoff_lng,
    v_vehicle_type,
    v_radius_km
  FROM public.trips t
  WHERE t.id = _trip_id;

  IF v_pickup_lat IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    t.id AS trip_id,
    t.creator_user_id,
    COALESCE(p.phone_number, p.wa_id) AS whatsapp_e164,
    COALESCE(t.ref_code, SUBSTRING(t.id::text, 1, 8)) AS ref_code,
    ROUND(
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      ))::numeric, 2
    ) AS distance_km,
    CASE
      WHEN _prefer_dropoff AND v_dropoff_lat IS NOT NULL AND t.dropoff_latitude IS NOT NULL THEN
        ROUND(
          (6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(v_dropoff_lat)) * cos(radians(t.dropoff_latitude)) *
              cos(radians(t.dropoff_longitude) - radians(v_dropoff_lng)) +
              sin(radians(v_dropoff_lat)) * sin(radians(t.dropoff_latitude))
            ))
          ))::numeric, 0
        )
      ELSE NULL
    END AS drop_bonus_m,
    t.pickup_text,
    t.dropoff_text,
    NULL::timestamptz,
    t.created_at,
    t.vehicle_type
  FROM public.trips t
  INNER JOIN public.profiles p ON p.user_id = t.creator_user_id
  WHERE t.role = 'passenger'
    AND t.status = 'open'
    AND t.expires_at > now()
    AND t.pickup_latitude IS NOT NULL
    AND t.pickup_longitude IS NOT NULL
    AND (v_vehicle_type IS NULL OR t.vehicle_type = v_vehicle_type)
    AND t.created_at >= NOW() - (INTERVAL '1 day' * _window_days)
    AND t.id != _trip_id
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_pickup_lat)) * cos(radians(t.pickup_latitude)) *
          cos(radians(t.pickup_longitude) - radians(v_pickup_lng)) +
          sin(radians(v_pickup_lat)) * sin(radians(t.pickup_latitude))
        ))
      )
    ) <= v_radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

-- Update activate_recurring_trips to insert into canonical trips table
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
  v_today_dow := EXTRACT(ISODOW FROM v_today_date);
  
  FOR v_recurring_trip IN
    SELECT rt.*, p.user_id
    FROM public.recurring_trips rt
    JOIN public.profiles p ON p.user_id = rt.user_id
    WHERE rt.active = true
      AND v_today_dow = ANY(rt.days_of_week)
  LOOP
    SELECT lat, lng, label INTO v_origin
    FROM public.saved_locations
    WHERE id = v_recurring_trip.origin_favorite_id;
    
    SELECT lat, lng, label INTO v_dest
    FROM public.saved_locations
    WHERE id = v_recurring_trip.dest_favorite_id;
    
    IF v_origin.lat IS NOT NULL AND v_dest.lat IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.trips
        WHERE creator_user_id = v_recurring_trip.user_id
          AND DATE(scheduled_at) = v_today_date
          AND pickup_latitude = v_origin.lat
          AND pickup_longitude = v_origin.lng
      ) THEN
        INSERT INTO public.trips (
          creator_user_id,
          trip_kind,
          role,
          vehicle_type,
          pickup_latitude,
          pickup_longitude,
          pickup_text,
          dropoff_latitude,
          dropoff_longitude,
          dropoff_text,
          status,
          scheduled_at,
          recurrence,
          expires_at
        ) VALUES (
          v_recurring_trip.user_id,
          'scheduled',
          v_recurring_trip.role,
          v_recurring_trip.vehicle_type,
          v_origin.lat,
          v_origin.lng,
          v_origin.label,
          v_dest.lat,
          v_dest.lng,
          v_dest.label,
          'open',
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

-- ============================================================================
-- STEP 6: LOG CONSOLIDATION COMPLETION (Optional - only if system_logs exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs') THEN
    INSERT INTO public.system_logs (event_type, details)
    VALUES ('MOBILITY_CONSOLIDATION_COMPLETE', jsonb_build_object(
      'migration', '20251208150000_consolidate_mobility_tables',
      'timestamp', now(),
      'tables_consolidated', ARRAY['rides_trips', 'mobility_trips', 'mobility_trip_matches'],
      'canonical_tables', ARRAY['trips', 'mobility_matches'],
      'functions_updated', ARRAY['match_drivers_for_trip_v2', 'match_passengers_for_trip_v2', 'activate_recurring_trips']
    ));
  ELSE
    RAISE NOTICE 'system_logs table does not exist - skipping consolidation log';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- CONSOLIDATION COMPLETE
-- ============================================================================
-- Next step: Verify data integrity, then run 20251208160000_drop_deprecated_mobility_tables.sql
-- ============================================================================
