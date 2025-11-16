BEGIN;

-- Migration: Fix missing timestamp defaults
-- Date: 2025-11-12
-- Description: Add default NOW() to created_at and updated_at columns that are missing it

-- Fix client_settings (only if columns exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'created_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'updated_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

-- Fix feature_flag_overview
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feature_flag_overview' AND column_name = 'updated_at') THEN
    ALTER TABLE public.feature_flag_overview ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

-- Fix published_menus
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'published_menus' AND column_name = 'created_at') THEN
    ALTER TABLE public.published_menus ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'published_menus' AND column_name = 'updated_at') THEN
    ALTER TABLE public.published_menus ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

COMMIT;
