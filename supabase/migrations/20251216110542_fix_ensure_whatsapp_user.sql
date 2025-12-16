-- Fix ensure_whatsapp_user to be compatible with current profiles schema:
-- profiles.user_id is NOT NULL, so we must never insert a profile without a user_id.

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits TEXT;
  v_e164   TEXT;
  v_existing RECORD;
  v_auth_user_id UUID;
  v_locale TEXT := 'en';
  v_name TEXT;
BEGIN
  IF _wa_id IS NULL OR btrim(_wa_id) = '' THEN
    RAISE EXCEPTION 'ensure_whatsapp_user: _wa_id is required';
  END IF;

  -- Normalize
  v_digits := regexp_replace(_wa_id, '[^0-9]', '', 'g');
  v_e164   := CASE
                WHEN left(btrim(_wa_id), 1) = '+' THEN regexp_replace(_wa_id, '[^0-9+]', '', 'g')
                ELSE '+' || v_digits
              END;

  IF v_digits IS NULL OR length(v_digits) < 6 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'ensure_whatsapp_user: invalid wa_id/phone: %', _wa_id;
  END IF;

  v_name := COALESCE(NULLIF(btrim(_profile_name), ''), NULL);

  -- 1) Existing profile by wa_id or phone_number
  SELECT p.id, p.user_id, COALESCE(p.language, 'en') AS locale
    INTO v_existing
  FROM public.profiles p
  WHERE p.wa_id = _wa_id
     OR p.wa_id = v_digits
     OR p.wa_id = v_e164
     OR p.phone_number = _wa_id
     OR p.phone_number = v_digits
     OR p.phone_number = v_e164
  LIMIT 1;

  IF FOUND THEN
    -- Opportunistic fill of name if missing
    IF v_name IS NOT NULL THEN
      UPDATE public.profiles
         SET full_name = COALESCE(full_name, v_name),
             updated_at = NOW()
       WHERE id = v_existing.id;
    END IF;

    RETURN QUERY SELECT v_existing.id, v_existing.user_id, v_existing.locale;
    RETURN;
  END IF;

  -- 2) If an auth user already exists for this phone, create/ensure profile for them
  SELECT au.id
    INTO v_auth_user_id
  FROM auth.users au
  WHERE au.phone = v_e164
     OR au.phone = v_digits
     OR (au.raw_user_meta_data->>'phone') = v_e164
     OR (au.raw_user_meta_data->>'phone') = v_digits
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.profiles (user_id, phone_number, wa_id, full_name, language)
    VALUES (v_auth_user_id, v_e164, v_digits, v_name, v_locale)
    ON CONFLICT (user_id) DO UPDATE SET
      phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
      wa_id        = COALESCE(public.profiles.wa_id, EXCLUDED.wa_id),
      full_name    = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      updated_at   = NOW()
    RETURNING id, user_id, COALESCE(language, 'en')
    INTO profile_id, user_id, locale;

    RETURN QUERY SELECT profile_id, user_id, locale;
    RETURN;
  END IF;

  -- 3) No profile + no auth user: return zero rows.
  -- Caller (Edge Function) must create auth user then insert profile.
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_whatsapp_user(TEXT, TEXT) TO service_role, authenticated, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
