BEGIN;

-- Enable trigram for fuzzy matching if available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram index on business.name if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business' AND column_name = 'name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_business_name_trgm ON public.business USING gin (name gin_trgm_ops)';
  END IF;
END $$;

-- Create trigram index on category_name if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business' AND column_name = 'category_name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_business_category_name_trgm ON public.business USING gin (category_name gin_trgm_ops)';
  END IF;
END $$;

-- Create trigram index on location_text if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business' AND column_name = 'location_text'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_business_location_text_trgm ON public.business USING gin (location_text gin_trgm_ops)';
  END IF;
END $$;

-- Fuzzy business search by partial name/category/address
CREATE OR REPLACE FUNCTION public.search_businesses_fuzzy(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  address text,
  score numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cat_expr TEXT := '';
  v_addr_expr TEXT := '';
  v_sql TEXT;
BEGIN
  -- Build safe expressions based on available columns
  v_cat_expr := '(' ||
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='category_name'
    ) THEN 'COALESCE(b.category_name'
    ELSE 'NULL'
    END || ')' ;

  -- v_cat_expr: COALESCE(category_name, category, tag, '')
  v_cat_expr := 'COALESCE(' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='category_name')
      THEN 'b.category_name' ELSE '''''' END || ', ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='category')
      THEN 'b.category' ELSE '''''' END || ', ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='tag')
      THEN 'b.tag' ELSE '''''' END || ', '''')';

  -- v_addr_expr: COALESCE(location_text, address, '')
  v_addr_expr := 'COALESCE(' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='location_text')
      THEN 'b.location_text' ELSE '''''' END || ', ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='address')
      THEN 'b.address' ELSE '''''' END || ', '''')';

  v_sql := format($f$
    WITH q AS (
      SELECT lower(trim(%L)) AS q
    ),
    tokens AS (
      SELECT token FROM (
        SELECT regexp_split_to_table((SELECT q FROM q), '\s+') AS token
      ) t WHERE length(token) > 0
    )
    SELECT
      b.id,
      b.name,
      %s AS category,
      %s AS address,
      GREATEST(
        similarity(lower(b.name), (SELECT q FROM q)),
        similarity(lower(%s), (SELECT q FROM q)),
        similarity(lower(%s), (SELECT q FROM q))
      ) AS score
    FROM public.business b
    WHERE COALESCE(b.is_active, true) = true
      AND (
        b.name ILIKE '%%' || (SELECT q FROM q) || '%%'
        OR %s ILIKE '%%' || (SELECT q FROM q) || '%%'
        OR %s ILIKE '%%' || (SELECT q FROM q) || '%%'
        OR EXISTS (
          SELECT 1 FROM tokens tk
          WHERE b.name ILIKE '%%' || tk.token || '%%'
             OR %s ILIKE '%%' || tk.token || '%%'
             OR %s ILIKE '%%' || tk.token || '%%'
        )
      )
    ORDER BY score DESC, b.name ASC
    LIMIT LEAST(GREATEST(%s, 1), 50)
  $f$, p_query, v_cat_expr, v_addr_expr, v_cat_expr, v_addr_expr, v_cat_expr, v_addr_expr, v_cat_expr, v_addr_expr, p_limit::text);

  RETURN QUERY EXECUTE v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_businesses_fuzzy(text, integer) TO anon, authenticated, service_role;

COMMIT;
