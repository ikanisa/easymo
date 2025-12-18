-- =============================================================================
-- Fix ensure_whatsapp_user ambiguous column references (FINAL PATCH)
-- Purpose: Resolve "column reference \"user_id\" is ambiguous - 42702" seen in prod logs
-- Applies fully qualified column references in INSERT...ON CONFLICT and SELECT
-- =============================================================================

BEGIN;

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
AS $$
DECLARE
  v_normalized_phone TEXT;
  v_digits TEXT;
  v_profile_id UUID;
  v_user_id UUID;
  v_locale TEXT;
BEGIN
  IF _wa_id IS NULL OR LENGTH(TRIM(_wa_id)) = 0 THEN
    RAISE EXCEPTION 'ensure_whatsapp_user: _wa_id is required';
  END IF;

  -- normalize phone
  v_normalized_phone := regexp_replace(_wa_id, '[^0-9+]', '', 'g');
  IF LEFT(v_normalized_phone, 1) <> '+' THEN
    v_normalized_phone := '+' || v_normalized_phone;
  END IF;
  v_digits := regexp_replace(v_normalized_phone, '[^0-9]', '', 'g');

  -- Try to find existing user by phone
  SELECT u.user_id
  INTO v_user_id
  FROM auth.users u
  WHERE u.phone = v_normalized_phone
     OR u.phone = v_digits
  LIMIT 1;

  IF FOUND THEN
    -- Insert/update profile with fully qualified columns to avoid ambiguity
    INSERT INTO public.profiles AS p (user_id, wa_id, phone_number, full_name, language)
    VALUES (v_user_id, v_digits, v_normalized_phone, _profile_name, 'en')
    ON CONFLICT (user_id) DO UPDATE SET
      wa_id = COALESCE(p.wa_id, EXCLUDED.wa_id),
      phone_number = COALESCE(p.phone_number, EXCLUDED.phone_number),
      full_name = COALESCE(p.full_name, EXCLUDED.full_name),
      updated_at = NOW()
    RETURNING p.id, p.user_id, COALESCE(p.language, 'en')
    INTO v_profile_id, v_user_id, v_locale;

    RETURN QUERY SELECT v_profile_id, v_user_id, v_locale;
    RETURN;
  END IF;

  -- No user found; return nothing
  RETURN;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in ensure_whatsapp_user: % - %', SQLERRM, SQLSTATE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_whatsapp_user(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_whatsapp_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_whatsapp_user(TEXT, TEXT) TO anon;
NOTIFY pgrst, 'reload schema';

COMMIT;
