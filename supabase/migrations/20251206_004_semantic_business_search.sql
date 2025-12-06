BEGIN;

-- Migration 4: Enable pg_trgm extension and create semantic business search function

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on business name for faster similarity search
CREATE INDEX IF NOT EXISTS idx_business_name_trgm ON public.business USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_business_name_lower_trgm ON public.business USING gin (lower(name) gin_trgm_ops);

-- Create semantic business search function with similarity scoring
CREATE OR REPLACE FUNCTION public.search_businesses_semantic(
  p_search_term TEXT,
  p_country TEXT DEFAULT 'RW',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category_name TEXT,
  location_text TEXT,
  owner_whatsapp TEXT,
  owner_user_id UUID,
  similarity_score REAL,
  match_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search_lower TEXT;
  v_similarity_threshold REAL := 0.2;
BEGIN
  v_search_lower := lower(trim(p_search_term));
  
  -- Return empty if search term is too short
  IF length(v_search_lower) < 2 THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH ranked_businesses AS (
    SELECT 
      b.id,
      b.name,
      b.category_name,
      b.location_text,
      b.owner_whatsapp,
      b.owner_user_id,
      GREATEST(
        similarity(lower(b.name), v_search_lower),
        CASE 
          WHEN lower(b.name) LIKE '%' || v_search_lower || '%' THEN 0.8
          ELSE 0.0
        END,
        CASE
          WHEN lower(b.name) = v_search_lower THEN 1.0
          ELSE 0.0
        END
      ) AS sim_score,
      CASE
        WHEN lower(b.name) = v_search_lower THEN 'exact'
        WHEN lower(b.name) LIKE v_search_lower || '%' THEN 'prefix'
        WHEN lower(b.name) LIKE '%' || v_search_lower || '%' THEN 'contains'
        ELSE 'fuzzy'
      END AS match_type
    FROM public.business b
    WHERE b.is_active = true
      AND (p_country IS NULL OR b.country = p_country)
      AND (
        lower(b.name) LIKE '%' || v_search_lower || '%'
        OR similarity(lower(b.name), v_search_lower) > v_similarity_threshold
      )
  )
  SELECT 
    rb.id,
    rb.name,
    rb.category_name,
    rb.location_text,
    rb.owner_whatsapp,
    rb.owner_user_id,
    rb.sim_score AS similarity_score,
    rb.match_type
  FROM ranked_businesses rb
  WHERE rb.sim_score > v_similarity_threshold
  ORDER BY 
    rb.sim_score DESC,
    CASE rb.match_type
      WHEN 'exact' THEN 1
      WHEN 'prefix' THEN 2
      WHEN 'contains' THEN 3
      ELSE 4
    END,
    rb.name
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_businesses_semantic(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_businesses_semantic(TEXT, TEXT, INTEGER) TO anon;

COMMIT;
