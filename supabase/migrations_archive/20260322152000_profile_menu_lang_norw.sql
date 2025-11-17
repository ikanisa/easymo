BEGIN;

-- Ensure profile RPC never selects Kinyarwanda and matches countries case-insensitively
CREATE OR REPLACE FUNCTION public.get_profile_menu_items(user_country_code text DEFAULT 'RW')
RETURNS TABLE (
  key text,
  name text,
  description text,
  display_order int,
  action_type text,
  action_target text
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  detected_region text := 'africa';
  selected_lang text := 'en';
BEGIN
  SELECT region INTO detected_region
  FROM countries
  WHERE code = upper(user_country_code)
  LIMIT 1;

  IF detected_region IS NULL THEN
    detected_region := 'africa';
  END IF;

  -- Map all countries to supported languages only (en/fr). Never select 'rw'.
  selected_lang := CASE
    WHEN upper(user_country_code) IN ('FR', 'BE') THEN 'fr'
    ELSE 'en'
  END;

  RETURN QUERY
  SELECT
    pmi.key,
    COALESCE(
      pmi.country_specific_names ->> upper(user_country_code),
      pmi.country_specific_names ->> lower(selected_lang),
      CASE selected_lang
        WHEN 'fr' THEN NULLIF(pmi.label_fr, '')
        ELSE NULLIF(pmi.label_en, '')
      END,
      NULLIF(pmi.label_en, ''),
      NULLIF(pmi.name, ''),
      pmi.key
    ) AS name,
    COALESCE(
      CASE selected_lang
        WHEN 'fr' THEN NULLIF(pmi.description_fr, '')
        ELSE NULLIF(pmi.description_en, '')
      END,
      pmi.description_en,
      ''
    ) AS description,
    pmi.display_order,
    pmi.action_type,
    COALESCE(pmi.action_target, pmi.key) AS action_target
  FROM whatsapp_profile_menu_items pmi
  WHERE pmi.is_active = true
    -- Region gating
    AND (
      pmi.region_restrictions IS NULL
      OR pmi.region_restrictions = '{}'
      OR detected_region = ANY(pmi.region_restrictions)
    )
    -- Country gating, case-insensitive match for safety
    AND (
      pmi.active_countries IS NULL
      OR array_length(pmi.active_countries, 1) IS NULL
      OR EXISTS (
        SELECT 1 FROM unnest(pmi.active_countries) c(country)
        WHERE upper(c.country) = upper(user_country_code)
      )
    )
  ORDER BY pmi.display_order, pmi.key;
END;
$$;

COMMIT;

