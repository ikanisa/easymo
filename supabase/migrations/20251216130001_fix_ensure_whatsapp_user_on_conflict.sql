-- ============================================================================
-- Fix ensure_whatsapp_user Function - Fix ON CONFLICT DO UPDATE SET clause
-- Migration: 20251216130001_fix_ensure_whatsapp_user_on_conflict.sql
-- Date: 2025-12-16
--
-- PURPOSE: 
-- Fix ambiguous column reference in ON CONFLICT DO UPDATE SET clause
-- Use unqualified table name (profiles) instead of public.profiles
-- ============================================================================

BEGIN;

-- Recreate the function with correct ON CONFLICT clause
CREATE OR REPLACE FUNCTION public.ensure_whatsapp_user(
  _wa_id TEXT,
  _profile_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  profile_id UUID,
  user_id UUID,
  locale TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_phone TEXT;
  v_digits TEXT;
  v_existing_profile RECORD;
  v_existing_user_id UUID;
  v_profile_id UUID;
  v_user_id UUID;
  v_locale TEXT := 'en';
  v_profile_name TEXT;
BEGIN
  -- Normalize phone number (E.164 format: +1234567890)
  -- Remove all non-digit characters and add + prefix
  v_digits := REGEXP_REPLACE(_wa_id, '[^0-9]', '', 'g');
  
  -- Validate we have digits (allow shorter numbers for testing, but warn)
  IF v_digits IS NULL OR LENGTH(v_digits) < 4 OR LENGTH(v_digits) > 15 THEN
    RAISE EXCEPTION 'Invalid phone number format: % (length: %)', _wa_id, COALESCE(LENGTH(v_digits), 0);
  END IF;
  
  -- Warn if phone number seems incomplete (less than 9 digits)
  IF LENGTH(v_digits) < 9 THEN
    RAISE WARNING 'Phone number seems incomplete: % (only % digits)', _wa_id, LENGTH(v_digits);
  END IF;
  
  -- Create E.164 format
  v_normalized_phone := '+' || v_digits;
  
  -- Set profile name
  v_profile_name := COALESCE(_profile_name, 'User');
  
  -- ============================================================================
  -- STEP 1: Check for existing profile by wa_id or phone_number
  -- ============================================================================
  
  -- Try to find existing profile by wa_id (digits only)
  SELECT p.id, p.user_id, 
         COALESCE(p.language, 'en') as locale
  INTO v_existing_profile
  FROM public.profiles p
  WHERE p.wa_id = v_digits
     OR p.wa_id = v_normalized_phone
  LIMIT 1;
  
  -- If not found, try phone_number
  IF NOT FOUND THEN
    SELECT p.id, p.user_id,
           COALESCE(p.language, 'en') as locale
    INTO v_existing_profile
    FROM public.profiles p
    WHERE p.phone_number = v_digits
       OR p.phone_number = v_normalized_phone
    LIMIT 1;
  END IF;
  
  -- If profile exists, return it
  IF FOUND THEN
    -- Update last seen info if profile_name provided
    IF _profile_name IS NOT NULL THEN
      UPDATE public.profiles
      SET full_name = COALESCE(full_name, _profile_name),
          updated_at = NOW()
      WHERE id = v_existing_profile.id
        AND (full_name IS NULL OR full_name = 'User');
    END IF;
    
    RETURN QUERY SELECT 
      v_existing_profile.id as profile_id,
      v_existing_profile.user_id,
      v_existing_profile.locale;
    RETURN;
  END IF;
  
  -- ============================================================================
  -- STEP 2: Check for existing auth user by phone
  -- ============================================================================
  
  -- Try to find existing auth user by phone
  SELECT au.id INTO v_existing_user_id
  FROM auth.users au
  WHERE au.phone = v_normalized_phone
     OR au.phone = v_digits
     OR (au.raw_user_meta_data->>'phone')::TEXT = v_normalized_phone
     OR (au.raw_user_meta_data->>'phone')::TEXT = v_digits
  LIMIT 1;
  
  -- If auth user exists, create/update profile
  IF FOUND THEN
    -- Ensure profile exists for this user
    -- In ON CONFLICT DO UPDATE SET, use unqualified column names (they refer to the target table)
    -- Use EXCLUDED to refer to the row that would have been inserted
    INSERT INTO public.profiles AS p (user_id, wa_id, phone_number, full_name, language)
    VALUES (v_existing_user_id, v_digits, v_normalized_phone, v_profile_name, v_locale)
    ON CONFLICT (user_id) 
    DO UPDATE SET
      wa_id = COALESCE(p.wa_id, EXCLUDED.wa_id),
      phone_number = COALESCE(p.phone_number, EXCLUDED.phone_number),
      full_name = COALESCE(p.full_name, EXCLUDED.full_name),
      updated_at = NOW()
    RETURNING id, user_id, COALESCE(language, 'en') 
    INTO v_profile_id, v_user_id, v_locale;
    
    RETURN QUERY SELECT v_profile_id, v_user_id, v_locale;
    RETURN;
  END IF;
  
  -- ============================================================================
  -- STEP 3: No existing user or profile found
  -- ============================================================================
  -- Note: We cannot create auth.users from a database function directly
  -- The TypeScript code (ensureProfile) should handle auth user creation
  -- This function will return NULL to indicate profile needs to be created via TypeScript
  
  -- Return NULL to indicate no profile found and auth user creation needed
  RETURN;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Error in ensure_whatsapp_user: % - %', SQLERRM, SQLSTATE;
END;
$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

