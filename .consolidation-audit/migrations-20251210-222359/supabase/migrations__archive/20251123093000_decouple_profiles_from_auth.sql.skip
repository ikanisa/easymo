-- Migration: Decouple profiles from auth.users
-- Created: 2025-11-23
-- Purpose: Allow profiles to exist without a corresponding auth.users record (for WhatsApp-only users)

BEGIN;

-- Drop the foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_user_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_user_id_fkey;
  END IF;
END $$;

-- Also ensure referral_links doesn't strictly require profiles if we want to be safe, 
-- but keeping it is fine if we ensure profiles are created.
-- However, let's ensure referral_links.user_id is just a UUID, the FK to profiles is fine 
-- as long as profiles can be created.

-- Ensure wallet_accounts also works
-- (It references profiles, so it should be fine once profiles is fixed)

COMMIT;
