-- ============================================================================
-- DATA MIGRATION TO CANONICAL TRIPS TABLE
-- ============================================================================
-- Migration: 20251208092500_migrate_trips_data.sql
-- Purpose: Migrate data from old trip tables to canonical trips table
-- 
-- Source tables:
--   - rides_trips (V1 with pickup_latitude/pickup_longitude)
--   - mobility_trips (V2 with pickup_lat/pickup_lng)
--   - scheduled_trips (if exists)
--   - recurring_trips (convert to scheduled trips)
-- 
-- Strategy: Preserve IDs where possible, deduplicate, map columns correctly
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Migrate from rides_trips (V1 schema)
-- ============================================================================

-- Migrate rides_trips if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'rides_trips'
  ) THEN
    -- Insert from rides_trips, mapping V1 schema to canonical
    INSERT INTO public.trips (
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
      last_location_at,
      ref_code,
      number_plate,
      metadata
    )
    SELECT 
      rt.id,
      rt.creator_user_id,
      -- Determine trip_kind based on scheduled_at
      CASE 
        WHEN rt.scheduled_at IS NOT NULL THEN 'scheduled'
        ELSE 'request'
      END AS trip_kind,
      rt.role,
      COALESCE(rt.vehicle_type, 'moto') AS vehicle_type,
      rt.pickup_latitude,
      rt.pickup_longitude,
      COALESCE(rt.pickup_text, rt.pickup_address) AS pickup_text,
      COALESCE(rt.pickup_radius_m, 10000) AS pickup_radius_m,
      rt.dropoff_latitude,
      rt.dropoff_longitude,
      COALESCE(rt.dropoff_text, rt.dropoff_address) AS dropoff_text,
      -- Map old status to simplified status
      CASE 
        WHEN rt.status IN ('open', 'pending', 'active') THEN 'open'
        WHEN rt.status = 'cancelled' THEN 'cancelled'
        ELSE 'expired'
      END AS status,
      rt.scheduled_at,
      rt.recurrence,
      rt.created_at,
      COALESCE(rt.updated_at, rt.created_at) AS updated_at,
      COALESCE(rt.expires_at, rt.created_at + interval '90 minutes') AS expires_at,
      COALESCE(rt.last_location_at, rt.created_at) AS last_location_at,
      rt.ref_code,
      rt.number_plate,
      -- Preserve original data in metadata
      jsonb_build_object(
        'source_table', 'rides_trips',
        'original_status', rt.status,
        'original_matched_at', rt.matched_at,
        'migrated_at', now()
      ) AS metadata
    FROM public.rides_trips rt
    WHERE rt.pickup_latitude IS NOT NULL 
      AND rt.pickup_longitude IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Migrated data from rides_trips';
  ELSE
    RAISE NOTICE 'Table rides_trips does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate from mobility_trips (V2 schema)
-- ============================================================================

-- Migrate mobility_trips if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'mobility_trips'
  ) THEN
    -- Insert from mobility_trips, mapping V2 schema to canonical
    INSERT INTO public.trips (
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
      last_location_at,
      metadata
    )
    SELECT 
      mt.id,
      mt.creator_user_id,
      -- Determine trip_kind based on scheduled_for
      CASE 
        WHEN mt.scheduled_for IS NOT NULL THEN 'scheduled'
        ELSE 'request'
      END AS trip_kind,
      mt.role,
      COALESCE(mt.vehicle_type, 'moto') AS vehicle_type,
      mt.pickup_lat AS pickup_latitude,
      mt.pickup_lng AS pickup_longitude,
      mt.pickup_text,
      COALESCE(mt.pickup_radius_m, 10000) AS pickup_radius_m,
      mt.dropoff_lat AS dropoff_latitude,
      mt.dropoff_lng AS dropoff_longitude,
      mt.dropoff_text,
      -- Map old status to simplified status
      CASE 
        WHEN mt.status IN ('open', 'matched', 'pending', 'active') THEN 'open'
        WHEN mt.status = 'cancelled' THEN 'cancelled'
        ELSE 'expired'
      END AS status,
      mt.scheduled_for AS scheduled_at,
      mt.recurrence,
      mt.created_at,
      COALESCE(mt.updated_at, mt.created_at) AS updated_at,
      mt.expires_at,
      COALESCE(mt.last_location_update, mt.created_at) AS last_location_at,
      -- Preserve original data in metadata
      jsonb_build_object(
        'source_table', 'mobility_trips',
        'original_status', mt.status,
        'original_matched_at', mt.matched_at,
        'migrated_at', now()
      ) || COALESCE(mt.metadata, '{}'::jsonb) AS metadata
    FROM public.mobility_trips mt
    WHERE mt.pickup_lat IS NOT NULL 
      AND mt.pickup_lng IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Migrated data from mobility_trips';
  ELSE
    RAISE NOTICE 'Table mobility_trips does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Migrate from recurring_trips (convert to scheduled trips)
-- ============================================================================

-- Migrate recurring_trips if table exists
DO $$
DECLARE
  v_rec RECORD;
  v_count integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'recurring_trips'
  ) THEN
    -- Create scheduled trips from active recurring patterns
    FOR v_rec IN 
      SELECT * FROM public.recurring_trips 
      WHERE active = true
    LOOP
      -- Create a scheduled trip for today (if applicable)
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
        metadata
      ) VALUES (
        v_rec.user_id,
        'scheduled',
        COALESCE(v_rec.role, 'passenger'),
        COALESCE(v_rec.vehicle_type, 'moto'),
        v_rec.pickup_latitude,
        v_rec.pickup_longitude,
        v_rec.pickup_text,
        v_rec.dropoff_latitude,
        v_rec.dropoff_longitude,
        v_rec.dropoff_text,
        'open',
        -- Schedule for next occurrence (simplified - just use current time + 1 day)
        now() + interval '1 day',
        -- Convert recurrence JSON to text
        CASE 
          WHEN (v_rec.recurrence->>'days')::text LIKE '%0,1,2,3,4,5,6%' THEN 'daily'
          WHEN (v_rec.recurrence->>'days')::text LIKE '%1,2,3,4,5%' THEN 'weekdays'
          ELSE 'weekly'
        END,
        jsonb_build_object(
          'source_table', 'recurring_trips',
          'original_recurrence', v_rec.recurrence,
          'migrated_at', now()
        )
      );
      v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Migrated % recurring trip patterns to scheduled trips', v_count;
  ELSE
    RAISE NOTICE 'Table recurring_trips does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Verification and Statistics
-- ============================================================================

DO $$
DECLARE
  v_total_count integer;
  v_request_count integer;
  v_scheduled_count integer;
  v_open_count integer;
BEGIN
  SELECT COUNT(*) INTO v_total_count FROM public.trips;
  SELECT COUNT(*) INTO v_request_count FROM public.trips WHERE trip_kind = 'request';
  SELECT COUNT(*) INTO v_scheduled_count FROM public.trips WHERE trip_kind = 'scheduled';
  SELECT COUNT(*) INTO v_open_count FROM public.trips WHERE status = 'open';
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migration Statistics:';
  RAISE NOTICE 'Total trips migrated: %', v_total_count;
  RAISE NOTICE 'Request intents: %', v_request_count;
  RAISE NOTICE 'Scheduled trips: %', v_scheduled_count;
  RAISE NOTICE 'Currently open: %', v_open_count;
  RAISE NOTICE '===========================================';
  
  IF v_total_count = 0 THEN
    RAISE WARNING 'No trips were migrated. This might be expected if tables were empty.';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- COMPLETED:
-- ✓ Migrated rides_trips data
-- ✓ Migrated mobility_trips data
-- ✓ Converted recurring_trips to scheduled trips
-- ✓ Preserved original data in metadata field
-- ✓ Deduplicated based on ID
-- 
-- NEXT STEPS:
-- 1. Create simplified RPC functions for nearby queries
-- 2. Update edge functions to use canonical trips table
-- 3. Create backward compatibility views
-- 4. Archive/remove old tables
-- 
-- ============================================================================
