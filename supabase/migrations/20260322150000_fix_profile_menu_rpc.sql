BEGIN;

-- Remove legacy overloaded function that caused RPC ambiguity
DROP FUNCTION IF EXISTS public.get_profile_menu_items(text, text);

-- Ensure the latest single-argument version exists
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

  selected_lang := CASE
    WHEN upper(user_country_code) IN ('FR', 'BE') THEN 'fr'
    WHEN upper(user_country_code) IN ('PT') THEN 'pt'
    WHEN upper(user_country_code) IN ('DE') THEN 'de'
    WHEN upper(user_country_code) IN ('ES') THEN 'es'
    WHEN upper(user_country_code) IN ('RW', 'BI', 'UG') THEN 'rw'
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
        WHEN 'rw' THEN NULLIF(pmi.label_rw, '')
        WHEN 'pt' THEN NULLIF(pmi.label_fr, '')
        WHEN 'de' THEN NULLIF(pmi.label_en, '')
        WHEN 'es' THEN NULLIF(pmi.label_en, '')
        ELSE NULLIF(pmi.label_en, '')
      END,
      NULLIF(pmi.label_en, ''),
      pmi.name
    ) AS name,
    COALESCE(
      CASE selected_lang
        WHEN 'fr' THEN NULLIF(pmi.description_fr, '')
        WHEN 'rw' THEN NULLIF(pmi.description_rw, '')
        WHEN 'pt' THEN NULLIF(pmi.description_fr, '')
        WHEN 'de' THEN NULLIF(pmi.description_en, '')
        WHEN 'es' THEN NULLIF(pmi.description_en, '')
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
    AND (
      pmi.region_restrictions IS NULL
      OR pmi.region_restrictions = '{}'
      OR detected_region = ANY(pmi.region_restrictions)
    )
  ORDER BY pmi.display_order;
END;
$$;

COMMIT;
