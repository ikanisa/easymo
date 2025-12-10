-- Fix users table staff management columns
-- This migration handles the case where public.users might be a view

-- Create enum types if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_account_status') THEN
    CREATE TYPE public.user_account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
  END IF;
END $$;

-- Check if public.users is a table or view
DO $$
DECLARE
  v_is_table boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'users'
  ) INTO v_is_table;

  IF v_is_table THEN
    -- It's a table, add columns directly
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'pw_reset_required'
    ) THEN
      ALTER TABLE public.users ADD COLUMN pw_reset_required BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'account_status'
    ) THEN
      ALTER TABLE public.users ADD COLUMN account_status public.user_account_status NOT NULL DEFAULT 'ACTIVE';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
    ) THEN
      ALTER TABLE public.users ADD COLUMN full_name TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone_number'
    ) THEN
      ALTER TABLE public.users ADD COLUMN phone_number TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_login'
    ) THEN
      ALTER TABLE public.users ADD COLUMN last_login TIMESTAMPTZ;
    END IF;
  ELSE
    RAISE NOTICE 'public.users is a view or does not exist as a table. Staff columns should be in user_profiles or staff_members tables instead.';
  END IF;
END $$;
