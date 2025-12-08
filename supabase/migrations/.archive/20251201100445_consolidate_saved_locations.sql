-- Consolidate rides_saved_locations into saved_locations
-- Phase 3: Database cleanup for saved locations feature
-- 
-- This migration:
-- 1. Migrates data from rides_saved_locations to saved_locations (if table exists)
-- 2. Updates references to use profiles instead of whatsapp_users
-- 3. Drops the old rides_saved_locations table
-- 4. Ensures data integrity with proper constraints

BEGIN;

-- Step 1: Check if rides_saved_locations table exists before migrating
DO $$
DECLARE
  rides_count INTEGER := 0;
  saved_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  -- Check if rides_saved_locations exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rides_saved_locations'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'rides_saved_locations table does not exist, skipping migration';
    RETURN;
  END IF;
  
  -- Count existing records
  EXECUTE 'SELECT COUNT(*) FROM rides_saved_locations' INTO rides_count;
  SELECT COUNT(*) INTO saved_count FROM saved_locations;
  
  RAISE NOTICE 'rides_saved_locations: % records', rides_count;
  RAISE NOTICE 'saved_locations: % records', saved_count;
END $$;

-- Step 2: Migrate data from rides_saved_locations to saved_locations (if table exists)
-- Only migrate if data exists and user maps to a profile
DO $$
BEGIN
  -- Check if rides_saved_locations exists before migrating
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rides_saved_locations'
  ) THEN
    INSERT INTO saved_locations (
      user_id,
      label,
      lat,
      lng,
      address,
      created_at
    )
    SELECT 
      rsl.user_id,
      COALESCE(rsl.label, 'other') as label,
      COALESCE(rsl.lat, 0) as lat,
      COALESCE(rsl.lng, 0) as lng,
      rsl.address_text as address,
      rsl.created_at
    FROM rides_saved_locations rsl
    WHERE 
      rsl.user_id IS NOT NULL
      AND rsl.lat IS NOT NULL
      AND rsl.lng IS NOT NULL
      -- Only insert if this user + label combination doesn't exist
      AND NOT EXISTS (
        SELECT 1 FROM saved_locations sl 
        WHERE sl.user_id = rsl.user_id 
        AND sl.label = COALESCE(rsl.label, 'other')
      )
      -- Ensure user exists in profiles
      AND EXISTS (
        SELECT 1 FROM profiles p WHERE p.user_id = rsl.user_id
      );
      
    RAISE NOTICE 'Data migrated from rides_saved_locations to saved_locations';
  END IF;
END $$;

-- Step 3: Log migration results (skip if table doesn't exist)
DO $$
DECLARE
  migrated_count INTEGER := 0;
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rides_saved_locations'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM saved_locations WHERE created_at >= (SELECT MIN(created_at) FROM rides_saved_locations)' INTO migrated_count;
    RAISE NOTICE 'Migrated % records to saved_locations', migrated_count;
  ELSE
    RAISE NOTICE 'Skipping migration logging - rides_saved_locations does not exist';
  END IF;
END $$;

-- Step 4: Drop old table and its dependencies
DROP TABLE IF EXISTS rides_saved_locations CASCADE;

-- Step 5: Ensure saved_locations has all necessary constraints
-- (From previous migration, but ensuring idempotency)
DO $$
BEGIN
  -- Add constraints if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_lat_valid' AND conrelid = 'saved_locations'::regclass
  ) THEN
    ALTER TABLE saved_locations
      ADD CONSTRAINT check_lat_valid CHECK (lat >= -90 AND lat <= 90);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_lng_valid' AND conrelid = 'saved_locations'::regclass
  ) THEN
    ALTER TABLE saved_locations
      ADD CONSTRAINT check_lng_valid CHECK (lng >= -180 AND lng <= 180);
  END IF;
END $$;

-- Step 6: Add helpful comment
COMMENT ON TABLE saved_locations IS 
  'Unified table for user saved locations (home, work, etc). Consolidated from rides_saved_locations on 2025-12-01.';

-- Step 7: Verify final state
DO $$
DECLARE
  final_count INTEGER;
  has_old_table BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO final_count FROM saved_locations;
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'rides_saved_locations'
  ) INTO has_old_table;
  
  RAISE NOTICE 'Final saved_locations count: %', final_count;
  RAISE NOTICE 'Old table exists: %', has_old_table;
  
  IF has_old_table THEN
    RAISE EXCEPTION 'Migration failed: rides_saved_locations still exists';
  END IF;
END $$;

COMMIT;

-- Post-migration verification query (for manual check)
-- SELECT 
--   COUNT(*) as total_locations,
--   COUNT(DISTINCT user_id) as unique_users,
--   COUNT(DISTINCT label) as unique_labels
-- FROM saved_locations;
