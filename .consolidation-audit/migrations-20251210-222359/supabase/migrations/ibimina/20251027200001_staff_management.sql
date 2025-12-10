-- Staff management: Add fields for password reset, account status, and staff metadata
-- Supports E1: Staff Directory + Add/Invite Staff
-- Note: This migration is deprecated - use staff_members table instead

-- Create enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_account_status') THEN
    CREATE TYPE public.user_account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
  END IF;
END $$;

-- Skip user table modifications if public.users is a view
-- Staff data is handled by staff_members and user_profiles tables
DO $$
BEGIN
  RAISE NOTICE 'Staff management fields are handled by staff_members and user_profiles tables';
END $$;
