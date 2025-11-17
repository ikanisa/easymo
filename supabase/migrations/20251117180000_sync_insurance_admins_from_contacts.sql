BEGIN;

-- Function to upsert insurance_admins from insurance_admin_contacts (whatsapp only)
CREATE OR REPLACE FUNCTION public.sync_insurance_admins_from_contacts()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  upserted INTEGER := 0;
BEGIN
  WITH src AS (
    SELECT
      regexp_replace(c.contact_value, '\\D', '', 'g') AS wa_id,
      COALESCE(NULLIF(c.display_name, ''), 'Insurance Admin') AS name,
      c.is_active
    FROM public.insurance_admin_contacts c
    WHERE lower(c.contact_type) = 'whatsapp' AND c.is_active = true
  ), ins AS (
    INSERT INTO public.insurance_admins (wa_id, name, role, is_active, receives_all_alerts)
    SELECT s.wa_id, s.name, 'admin', true, true
    FROM src s
    WHERE length(s.wa_id) >= 8
    ON CONFLICT (wa_id) DO UPDATE
      SET is_active = EXCLUDED.is_active,
          name = COALESCE(NULLIF(EXCLUDED.name, ''), public.insurance_admins.name),
          receives_all_alerts = true,
          updated_at = now()
    RETURNING 1
  )
  SELECT COALESCE(COUNT(*),0) INTO upserted FROM ins;

  RETURN upserted;
END;
$$;

-- One-time seed to ensure core admins are present and active
INSERT INTO public.insurance_admins (wa_id, name, role, is_active, receives_all_alerts)
VALUES
  ('250788767816','Insurance Admin 1','admin',true,true),
  ('250793094876','Insurance Admin 2','admin',true,true),
  ('250795588248','Insurance Admin 3','admin',true,true)
ON CONFLICT (wa_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  receives_all_alerts = EXCLUDED.receives_all_alerts,
  updated_at = now();

COMMIT;

