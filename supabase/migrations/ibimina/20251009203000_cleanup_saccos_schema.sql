CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Remove deprecated SACCO metadata columns and refresh derived fields
DROP INDEX IF EXISTS public.saccos_bnr_index_unique;
ALTER TABLE public.saccos
  DROP COLUMN IF EXISTS merchant_code,
  DROP COLUMN IF EXISTS bnr_index,
  DROP COLUMN IF EXISTS brand_color,
  DROP COLUMN IF EXISTS sms_sender,
  DROP COLUMN IF EXISTS pdf_header_text,
  DROP COLUMN IF EXISTS pdf_footer_text;
WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN NULLIF(trim(sector), '') IS NOT NULL THEN trim(sector)
      WHEN NULLIF(trim(sector_code), '') IS NOT NULL THEN trim(sector_code)
      ELSE trim(district)
    END AS normalized_sector,
    COALESCE(NULLIF(trim(province), ''), trim(district)) AS normalized_province,
    COALESCE(NULLIF(trim(category), ''), 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)') AS normalized_category,
    CASE
      WHEN NULLIF(trim(name), '') IS NOT NULL THEN trim(name)
      ELSE trim(district || ' ' || COALESCE(NULLIF(trim(sector), ''), trim(sector_code)))
    END AS normalized_name
  FROM public.saccos
), computed AS (
  SELECT
    n.id,
    n.normalized_sector,
    n.normalized_province,
    n.normalized_category,
    n.normalized_name,
    trim(both '-' FROM lower(regexp_replace(n.normalized_name, '[^a-z0-9]+', '-', 'g'))) AS normalized_search_slug,
    trim(both '-' FROM regexp_replace(upper(trim(s.district) || '-' || n.normalized_sector), '[^A-Z0-9]+', '-', 'g')) AS normalized_sector_code
  FROM normalized n
  JOIN public.saccos s ON s.id = n.id
)
UPDATE public.saccos AS s
SET
  sector = computed.normalized_sector,
  province = computed.normalized_province,
  category = computed.normalized_category,
  name = computed.normalized_name,
  search_slug = computed.normalized_search_slug,
  sector_code = computed.normalized_sector_code
FROM computed
WHERE s.id = computed.id;
DROP FUNCTION IF EXISTS public.search_saccos(TEXT, INTEGER, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.search_saccos(
  query TEXT,
  limit_count INTEGER DEFAULT 20,
  district_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  sector TEXT,
  district TEXT,
  province TEXT,
  email TEXT,
  category TEXT,
  similarity_score NUMERIC,
  rank_score NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      NULLIF(trim(query), '') AS sanitized_query,
      NULLIF(trim(district_filter), '') AS district_like,
      NULLIF(trim(province_filter), '') AS province_like,
      LEAST(GREATEST(COALESCE(limit_count, 20), 1), 100) AS limit_size
  ), expanded AS (
    SELECT
      params.limit_size,
      params.district_like,
      params.province_like,
      params.sanitized_query,
      CASE
        WHEN params.sanitized_query IS NULL THEN NULL
        ELSE websearch_to_tsquery('simple', params.sanitized_query)
      END AS ts_query
    FROM params
  ), ranked AS (
    SELECT
      s.id,
      s.name,
      s.sector,
      s.district,
      s.province,
      s.email,
      s.category,
      expanded.sanitized_query,
      expanded.ts_query,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(s.name, expanded.sanitized_query)
      END AS trigram_name,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query)
      END AS trigram_location,
      CASE
        WHEN expanded.ts_query IS NULL THEN 0
        ELSE ts_rank(s.search_document, expanded.ts_query)
      END AS ts_rank_score
    FROM public.saccos s
    CROSS JOIN expanded
    WHERE (
      expanded.sanitized_query IS NULL
      OR (
        (expanded.ts_query IS NOT NULL AND s.search_document @@ expanded.ts_query)
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(s.name, expanded.sanitized_query) > 0.1
        )
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query) > 0.1
        )
      )
    )
      AND (expanded.district_like IS NULL OR s.district ILIKE expanded.district_like)
      AND (expanded.province_like IS NULL OR s.province ILIKE expanded.province_like)
  )
  SELECT
    id,
    name,
    sector,
    district,
    province,
    email,
    category,
    GREATEST(trigram_name, trigram_location) AS similarity_score,
    ts_rank_score + GREATEST(trigram_name, trigram_location) AS rank_score
  FROM ranked
  ORDER BY rank_score DESC, similarity_score DESC, name ASC
  LIMIT (SELECT limit_size FROM expanded LIMIT 1)
$$;
