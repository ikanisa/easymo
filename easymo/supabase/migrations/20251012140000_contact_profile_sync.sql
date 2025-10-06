-- Phase 1: automatic contact/profile linking + rollup view
BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_e164(msisdn text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  digits text;
BEGIN
  IF msisdn IS NULL THEN
    RETURN NULL;
  END IF;
  digits := regexp_replace(msisdn, '[^0-9]', '', 'g');
  IF digits IS NULL OR length(digits) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN '+' || digits;
END;
$$;

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
    SELECT user_id
      INTO existing
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

  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_profile_sync ON public.contacts;
CREATE TRIGGER trg_contacts_profile_sync
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_contact_profile();

CREATE OR REPLACE VIEW public.profile_contact_rollup AS
SELECT
  p.user_id AS profile_id,
  p.whatsapp_e164,
  p.display_name,
  p.locale,
  p.created_at AS profile_created_at,
  p.metadata AS profile_metadata,
  c.id AS contact_id,
  c.opted_in,
  c.opt_in_source,
  c.opt_in_ts,
  c.opted_out,
  c.opt_out_ts,
  c.tags,
  c.sector,
  c.city,
  c.attributes,
  c.last_inbound_at,
  c.updated_at AS contact_updated_at
FROM public.profiles p
LEFT JOIN public.contacts c
  ON c.profile_id = p.user_id;

COMMENT ON VIEW public.profile_contact_rollup IS 'Profile + marketing contact rollup (Phase 1 consolidation).';

COMMIT;
