-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Migrate Legacy Location Cache Data
-- Purpose: Move data from whatsapp_users.location_cache to recent_locations
-- Date: 2025-12-09
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Step 1: Migrate from whatsapp_users.location_cache to recent_locations
-- Only migrate valid location data (non-null lat/lng)
-- Check if table exists first
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'app'
        AND table_name = 'whatsapp_users'
    ) THEN
        INSERT INTO app.recent_locations (user_id, lat, lng, address, source, context, expires_at)
        SELECT 
            wu.user_id,
            (wu.location_cache->>'lat')::DOUBLE PRECISION,
            (wu.location_cache->>'lng')::DOUBLE PRECISION,
            wu.location_cache->>'address',
            'migrated_from_whatsapp_users',
            'legacy_cache',
            NOW() + INTERVAL '24 hours'
        FROM app.whatsapp_users wu
        WHERE wu.location_cache IS NOT NULL
        AND wu.location_cache->>'lat' IS NOT NULL
        AND wu.location_cache->>'lng' IS NOT NULL
        AND (wu.location_cache->>'lat')::TEXT ~ '^-?[0-9]+\.?[0-9]*$'  -- Valid number
        AND (wu.location_cache->>'lng')::TEXT ~ '^-?[0-9]+\.?[0-9]*$'  -- Valid number
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Migrated location cache data from whatsapp_users';
    ELSE
        RAISE NOTICE 'Table app.whatsapp_users does not exist, skipping migration';
    END IF;
END $$;

-- Step 2: Log migration statistics
DO $$
DECLARE
    migrated_count INTEGER;
    source_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'app'
        AND table_name = 'whatsapp_users'
    ) THEN
        -- Count migrated records
        SELECT COUNT(*) INTO migrated_count
        FROM app.recent_locations
        WHERE source = 'migrated_from_whatsapp_users';
        
        -- Count source records that had location_cache
        SELECT COUNT(*) INTO source_count
        FROM app.whatsapp_users
        WHERE location_cache IS NOT NULL;
        
        RAISE NOTICE '════════════════════════════════════════════════════════════';
        RAISE NOTICE 'Location Cache Migration Complete';
        RAISE NOTICE '════════════════════════════════════════════════════════════';
        RAISE NOTICE 'Source records with location_cache: %', source_count;
        RAISE NOTICE 'Successfully migrated to recent_locations: %', migrated_count;
        RAISE NOTICE '════════════════════════════════════════════════════════════';
    END IF;
END $$;

-- Step 3: Add migration metadata column (for tracking)
DO $$
BEGIN
    -- Only add column if whatsapp_users table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'app'
        AND table_name = 'whatsapp_users'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'app'
            AND table_name = 'whatsapp_users'
            AND column_name = 'location_cache_migrated_at'
        ) THEN
            ALTER TABLE app.whatsapp_users
            ADD COLUMN location_cache_migrated_at TIMESTAMPTZ;
            
            -- Mark migrated records
            UPDATE app.whatsapp_users
            SET location_cache_migrated_at = NOW()
            WHERE location_cache IS NOT NULL;
            
            RAISE NOTICE 'Added location_cache_migrated_at tracking column';
        END IF;
    ELSE
        RAISE NOTICE 'Table app.whatsapp_users does not exist, skipping metadata column creation';
    END IF;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-Migration Notes:
-- 
-- 1. The location_cache column is NOT dropped yet (safety)
-- 2. After 30 days of verification, run cleanup migration to drop column
-- 3. Bridge functions in code ensure compatibility during transition
-- ═══════════════════════════════════════════════════════════════════════════
