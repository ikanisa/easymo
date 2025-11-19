-- Seeds pilot farm metadata and synonym tables for the farmer broker agent.
-- Run with: supabase db remote commit supabase/sql/backfill_farm_metadata.sql

BEGIN;

WITH raw_farmers AS (
  SELECT * FROM (
    VALUES
      (
        '+250781234567',
        'Nziza Harvest Collective',
        'rw',
        'Rubavu',
        'Nyamyumba',
        14.2::numeric,
        ARRAY['maize','beans','sorghum']::text[],
        ARRAY['RICA traceability']::text[],
        true,
        jsonb_build_object(
          'farmer_role', 'producer',
          'preferred_language', 'rw',
          'distribution_focus', 'kigali_wholesale'
        ),
        jsonb_build_array(
          jsonb_build_object('phrase','ibigori','locale','rw','category','commodity'),
          jsonb_build_object('phrase','maize','locale','en','category','commodity'),
          jsonb_build_object('phrase','sorghum grain','locale','en','category','commodity'),
          jsonb_build_object('phrase','amasaka','locale','rw','category','commodity'),
          jsonb_build_object('phrase','Rubavu pool','locale','en','category','pickup_zone')
        )
      ),
      (
        '+250788204410',
        'Imirasire Agro Hub',
        'rw',
        'Rulindo',
        'Rusiga',
        9.8::numeric,
        ARRAY['irish potatoes','carrots']::text[],
        ARRAY['GAP bronze']::text[],
        false,
        jsonb_build_object(
          'farmer_role', 'cooperative',
          'preferred_language', 'rw',
          'distribution_focus', 'kigali_retail'
        ),
        jsonb_build_array(
          jsonb_build_object('phrase','ibirayi','locale','rw','category','commodity'),
          jsonb_build_object('phrase','irish potatoes','locale','en','category','commodity'),
          jsonb_build_object('phrase','karoti','locale','rw','category','commodity'),
          jsonb_build_object('phrase','carrots','locale','en','category','commodity'),
          jsonb_build_object('phrase','Kimironko drop','locale','en','category','pickup_zone')
        )
      )
  ) AS t(
    whatsapp,
    farm_name,
    locale,
    district,
    sector,
    hectares,
    commodities,
    certifications,
    irrigation,
    profile_metadata,
    synonym_payload
  )
), profile_upserts AS (
  INSERT INTO public.profiles (whatsapp_e164, locale, metadata)
  SELECT
    t.whatsapp,
    t.locale,
    coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
      'farmer_profile', jsonb_build_object(
        'label', t.farm_name,
        'district', t.district,
        'sector', t.sector,
        'hectares', t.hectares,
        'commodities', t.commodities,
        'certifications', t.certifications,
        'irrigation', t.irrigation,
        'attributes', t.profile_metadata
      )
    )
  FROM raw_farmers t
  LEFT JOIN public.profiles p ON p.whatsapp_e164 = t.whatsapp
  ON CONFLICT (whatsapp_e164) DO UPDATE
    SET locale = excluded.locale,
        metadata = excluded.metadata,
        updated_at = timezone('utc', now())
  RETURNING user_id, whatsapp_e164
), farm_upserts AS (
  INSERT INTO public.farms (
    profile_id,
    farm_name,
    district,
    sector,
    region,
    hectares,
    commodities,
    certifications,
    irrigation,
    metadata
  )
  SELECT
    p.user_id,
    t.farm_name,
    t.district,
    t.sector,
    CASE WHEN t.district ILIKE ANY(ARRAY['kigali%','gasabo','nyarugenge']) THEN 'Kigali' ELSE 'Rwanda' END,
    t.hectares,
    t.commodities,
    t.certifications,
    t.irrigation,
    jsonb_build_object('synonym_payload', t.synonym_payload)
  FROM raw_farmers t
  JOIN profile_upserts p ON p.whatsapp_e164 = t.whatsapp
  ON CONFLICT (profile_id) DO UPDATE
    SET farm_name = excluded.farm_name,
        district = excluded.district,
        sector = excluded.sector,
        region = excluded.region,
        hectares = excluded.hectares,
        commodities = excluded.commodities,
        certifications = excluded.certifications,
        irrigation = excluded.irrigation,
        metadata = excluded.metadata,
        updated_at = timezone('utc', now())
  RETURNING id AS farm_id, metadata
), synonym_rows AS (
  SELECT
    f.farm_id,
    (syn->>'phrase')::text AS phrase,
    coalesce(syn->>'locale','rw') AS locale,
    coalesce(syn->>'category','commodity') AS category
  FROM farm_upserts f
  CROSS JOIN LATERAL jsonb_array_elements(f.metadata->'synonym_payload') syn
)
INSERT INTO public.farm_synonyms (farm_id, phrase, locale, category)
SELECT farm_id, phrase, locale, category
FROM synonym_rows
ON CONFLICT (farm_id, lower(phrase)) DO NOTHING;

COMMIT;
