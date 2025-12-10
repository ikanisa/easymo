-- Guard updated_at assignment in ensure_contact_profile trigger
BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_contact_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized text;
  existing uuid;
BEGIN
  normalized := public.normalize_e164(NEW.msisdn_e164);
  IF normalized IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.msisdn_e164 IS DISTINCT FROM normalized THEN
    NEW.msisdn_e164 := normalized;
  END IF;

  IF NEW.profile_id IS NULL THEN
    SELECT user_id INTO existing
    FROM public.profiles
    WHERE whatsapp_e164 = normalized
    LIMIT 1;

    IF existing IS NULL THEN
      INSERT INTO public.profiles (whatsapp_e164)
      VALUES (normalized)
      ON CONFLICT (whatsapp_e164) DO UPDATE
        SET whatsapp_e164 = EXCLUDED.whatsapp_e164
      RETURNING user_id INTO existing;
    END IF;

    NEW.profile_id := existing;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'updated_at'
  ) THEN
    NEW.updated_at := timezone('utc', now());
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
