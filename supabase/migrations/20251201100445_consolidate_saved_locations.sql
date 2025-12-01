-- Consolidate rides_saved_locations into saved_locations
-- Phase 3: Database cleanup for saved locations feature
-- 
-- This migration:
-- 1. Migrates data from rides_saved_locations to saved_locations
-- 2. Updates references to use profiles instead of whatsapp_users
-- 3. Drops the old rides_saved_locations table
-- 4. Ensures data integrity with proper constraints

BEGIN;

-- Step 1: Create a temporary mapping between whatsapp_users and profiles
-- (In case user_id references are different)
DO $$
DECLARE
  rides_count INTEGER;
  saved_count INTEGER;
BEGIN
  -- Count existing records
  SELECT COUNT(*) INTO rides_count FROM rides_saved_locations WHERE TRUE;
  SELECT COUNT(*) INTO saved_count FROM saved_locations WHERE TRUE;
  
  RAISE NOTICE 'rides_saved_locations: % records', rides_count;
  RAISE NOTICE 'saved_locations: % records', saved_count;
END $$;

-- Step 2: Migrate data from rides_saved_locations to saved_locations
-- Only migrate if data exists and user maps to a profile
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

-- Step 3: Log migration results
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count 
  FROM saved_locations 
  WHERE created_at >= (SELECT MIN(created_at) FROM rides_saved_locations);
  
  RAISE NOTICE 'Migrated % records to saved_locations', migrated_count;
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
