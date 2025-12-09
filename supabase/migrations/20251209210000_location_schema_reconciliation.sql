-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Location Schema Reconciliation
-- Purpose: Ensure canonical location tables exist without conflicts
-- Date: 2025-12-09
-- 
-- This migration is idempotent and safe to run multiple times.
-- It ensures the location infrastructure from 20251209180000 is properly applied.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- Step 1: Verify saved_locations has required columns
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    -- Add geog column if missing (computed from lat/lng)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'saved_locations'
        AND column_name = 'geog'
    ) THEN
        ALTER TABLE public.saved_locations
        ADD COLUMN geog geography(Point, 4326);
        
        -- Update existing rows
        UPDATE public.saved_locations
        SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        WHERE geog IS NULL;
        
        CREATE INDEX IF NOT EXISTS idx_saved_locations_geog 
        ON public.saved_locations USING GIST(geog);
    END IF;
    
    -- Add kind column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'saved_locations'
        AND column_name = 'kind'
    ) THEN
        ALTER TABLE public.saved_locations
        ADD COLUMN kind TEXT NOT NULL DEFAULT 'other'
        CHECK (kind IN ('home', 'work', 'school', 'other'));
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Step 2: Ensure recent_locations table exists (from 20251209180000)
-- ════════════════════════════════════════════════════════════════════════════

-- This is already created by 20251209180000_fix_location_caching_functions.sql
-- We just verify it exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'recent_locations'
    ) THEN
        RAISE EXCEPTION 'recent_locations table missing - ensure 20251209180000_fix_location_caching_functions.sql was applied';
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Step 3: Verify all required RPCs exist
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    missing_rpcs text[] := ARRAY[]::text[];
BEGIN
    -- Check for required RPCs
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_recent_location') THEN
        missing_rpcs := array_append(missing_rpcs, 'save_recent_location');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_recent_location') THEN
        missing_rpcs := array_append(missing_rpcs, 'get_recent_location');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_recent_location') THEN
        missing_rpcs := array_append(missing_rpcs, 'has_recent_location');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_favorite_location') THEN
        missing_rpcs := array_append(missing_rpcs, 'save_favorite_location');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_saved_location') THEN
        missing_rpcs := array_append(missing_rpcs, 'get_saved_location');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_saved_locations') THEN
        missing_rpcs := array_append(missing_rpcs, 'list_saved_locations');
    END IF;
    
    IF array_length(missing_rpcs, 1) > 0 THEN
        RAISE EXCEPTION 'Missing RPCs: % - ensure 20251209180000_fix_location_caching_functions.sql was applied', 
            array_to_string(missing_rpcs, ', ');
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Step 4: Grant permissions
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_locations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.recent_locations TO authenticated;
GRANT ALL ON public.saved_locations TO service_role;
GRANT ALL ON public.recent_locations TO service_role;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- Verification
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    RAISE NOTICE 'Location schema reconciliation complete';
    RAISE NOTICE '  - saved_locations: % rows', (SELECT COUNT(*) FROM public.saved_locations);
    RAISE NOTICE '  - recent_locations: % rows', (SELECT COUNT(*) FROM public.recent_locations);
END $$;
