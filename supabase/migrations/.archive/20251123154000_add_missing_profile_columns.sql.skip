-- Migration: Add Missing Profile Columns
-- Created: 2025-11-23
-- Purpose: Fix "vehicle_plate does not exist" and "locale does not exist" errors

BEGIN;

-- Add locale column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'locale') THEN
        ALTER TABLE public.profiles ADD COLUMN locale text DEFAULT 'en';
        CREATE INDEX IF NOT EXISTS idx_profiles_locale ON public.profiles(locale);
    END IF;
END $$;

-- Add vehicle_plate column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'vehicle_plate') THEN
        ALTER TABLE public.profiles ADD COLUMN vehicle_plate text;
        CREATE INDEX IF NOT EXISTS idx_profiles_vehicle_plate ON public.profiles(vehicle_plate) WHERE vehicle_plate IS NOT NULL;
    END IF;
END $$;

-- Add vehicle_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'vehicle_type') THEN
        ALTER TABLE public.profiles ADD COLUMN vehicle_type text;
        CREATE INDEX IF NOT EXISTS idx_profiles_vehicle_type ON public.profiles(vehicle_type) WHERE vehicle_type IS NOT NULL;
    END IF;
END $$;

COMMIT;
