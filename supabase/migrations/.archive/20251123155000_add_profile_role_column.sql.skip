-- Migration: Add role column to profiles
-- Created: 2025-11-23
-- Purpose: Fix "Could not find the 'role' column of 'profiles'" error

BEGIN;

-- Add role column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'buyer';
        CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role) WHERE role IS NOT NULL;
    END IF;
END $$;

COMMIT;
