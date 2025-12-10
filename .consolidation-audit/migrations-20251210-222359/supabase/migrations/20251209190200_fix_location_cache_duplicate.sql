-- Fix: Remove duplicate update_user_location_cache function
-- Date: 2025-12-09
-- Issue: PGRST203 - Function overloading conflict

BEGIN;

-- Drop the old numeric version (conflicts with double precision version)
DROP FUNCTION IF EXISTS public.update_user_location_cache(_user_id uuid, _lat numeric, _lng numeric);

-- Keep only the double precision version (correct one)
-- This function already exists, no need to recreate

COMMIT;
