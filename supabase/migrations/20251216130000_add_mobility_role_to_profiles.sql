-- ============================================================================
-- Add mobility_role to profiles table
-- Migration: 20251216130000_add_mobility_role_to_profiles.sql
-- Date: 2025-12-16
--
-- PURPOSE: 
-- Add mobility_role column to profiles to store whether user is driver or passenger
-- This is a persistent role that doesn't change per trip
-- ============================================================================

BEGIN;

-- Add mobility_role column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mobility_role TEXT CHECK (mobility_role IN ('driver', 'passenger'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_mobility_role ON public.profiles(mobility_role) WHERE mobility_role IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.mobility_role IS 'Persistent mobility role: driver (offering rides) or passenger (seeking rides). Set once on first use.';

COMMIT;

