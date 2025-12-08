-- =====================================================================
-- UNIFY SAVED LOCATIONS TABLE
-- =====================================================================
-- Migration: Add kind column and migrate data from legacy tables to saved_locations
-- 
-- Problem: Three different tables were being used across services:
--   - saved_locations: wa-webhook-profile, wa-webhook-mobility (correct)
--   - user_favorites: wa-webhook legacy (PostGIS geog column)
--   - user_saved_locations: Profile NestJS service
--   - rides_saved_locations: Rides SQL functions
-- 
-- Solution: Unify all services to use the saved_locations table with a 
-- consistent schema (id, user_id, label, lat, lng, address, kind)
-- 
-- Created: 2025-12-01
-- =====================================================================

BEGIN;

-- =====================================================================
-- STEP 1: Add kind column to saved_locations table
-- =====================================================================

ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS kind text DEFAULT 'other';

-- Create index for kind lookups
CREATE INDEX IF NOT EXISTS idx_saved_locations_kind 
ON saved_locations(user_id, kind);

-- Add comment for documentation
COMMENT ON COLUMN saved_locations.kind IS 'Location type: home, work, school, or other';

-- =====================================================================
-- STEP 2: Migrate data from user_favorites (if table exists)
-- This table uses PostGIS geog column for coordinates
-- =====================================================================

DO $$
BEGIN
  -- Only run if user_favorites table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_favorites'
  ) THEN
    INSERT INTO saved_locations (user_id, kind, label, address, lat, lng)
    SELECT 
      user_id, 
      COALESCE(kind, 'other')::text,
      label, 
      address,
      ST_Y(geog::geometry) as lat,
      ST_X(geog::geometry) as lng
    FROM user_favorites
    WHERE geog IS NOT NULL
    ON CONFLICT (user_id, label) DO NOTHING;
    
    RAISE NOTICE 'Migrated data from user_favorites to saved_locations';
  END IF;
END $$;

-- =====================================================================
-- STEP 3: Migrate data from rides_saved_locations (if table exists)
-- This table uses lat, lng columns directly
-- =====================================================================

DO $$
BEGIN
  -- Only run if rides_saved_locations table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rides_saved_locations'
  ) THEN
    INSERT INTO saved_locations (user_id, label, address, lat, lng)
    SELECT 
      user_id, 
      label, 
      address_text,
      lat,
      lng
    FROM rides_saved_locations
    WHERE lat IS NOT NULL AND lng IS NOT NULL
    ON CONFLICT (user_id, label) DO NOTHING;
    
    RAISE NOTICE 'Migrated data from rides_saved_locations to saved_locations';
  END IF;
END $$;

-- =====================================================================
-- STEP 4: Update kind based on label for existing records
-- Infer kind from common label patterns
-- =====================================================================

UPDATE saved_locations
SET kind = CASE 
  WHEN LOWER(label) IN ('home', '🏠 home') THEN 'home'
  WHEN LOWER(label) IN ('work', '💼 work') THEN 'work'
  WHEN LOWER(label) IN ('school', '🎓 school') THEN 'school'
  ELSE 'other'
END
WHERE kind IS NULL OR kind = 'other';

COMMIT;
