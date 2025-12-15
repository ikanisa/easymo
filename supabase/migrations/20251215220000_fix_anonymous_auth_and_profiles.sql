-- ============================================================================
-- Fix Anonymous Authentication and Profiles
-- Migration: 20251215220000_fix_anonymous_auth_and_profiles.sql
-- Date: 2025-12-15
--
-- PURPOSE: 
-- 1. Add unique constraints on phone_number and wa_id in profiles table
-- 2. Ensure WhatsApp number is used as unique identifier
-- 3. Support anonymous authentication for WhatsApp users
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Add unique constraints to profiles table
-- ============================================================================

-- Add unique constraint on phone_number (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'phone_number'
  ) THEN
    -- Drop existing unique index if it exists
    DROP INDEX IF EXISTS idx_profiles_phone_number_unique;
    
    -- Add unique constraint (will fail if duplicates exist)
    BEGIN
      ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_phone_number_unique 
      UNIQUE (phone_number) 
      WHERE phone_number IS NOT NULL;
      
      RAISE NOTICE 'Added unique constraint on profiles.phone_number';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not add unique constraint on phone_number: %', SQLERRM;
    END;
  END IF;
END $$;

-- Add unique constraint on wa_id (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'wa_id'
  ) THEN
    -- Drop existing unique index if it exists
    DROP INDEX IF EXISTS idx_profiles_wa_id_unique;
    
    -- Add unique constraint (will fail if duplicates exist)
    BEGIN
      ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_wa_id_unique 
      UNIQUE (wa_id) 
      WHERE wa_id IS NOT NULL;
      
      RAISE NOTICE 'Added unique constraint on profiles.wa_id';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not add unique constraint on wa_id: %', SQLERRM;
    END;
  END IF;
END $$;

-- ============================================================================
-- PART 2: Create function to automatically create profile when auth user is created
-- ============================================================================

-- Function to create profile automatically when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  -- Get phone from auth.users
  v_phone := NEW.raw_user_meta_data->>'phone';
  IF v_phone IS NULL THEN
    v_phone := NEW.phone;
  END IF;
  
  -- Create profile if phone exists and profile doesn't exist
  IF v_phone IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, phone_number, wa_id, language)
    VALUES (
      NEW.id,
      v_phone,
      v_phone,
      COALESCE((NEW.raw_user_meta_data->>'language')::TEXT, 'en')
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    -- Create profile without phone (for anonymous users without phone)
    INSERT INTO public.profiles (user_id, language)
    VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'language')::TEXT, 'en'))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO anon;

COMMENT ON FUNCTION public.handle_new_auth_user() IS 'Automatically creates profile when new auth user is created (for anonymous WhatsApp users)';

COMMIT;

