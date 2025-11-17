BEGIN;

-- Adjust search_businesses_fuzzy to return score as real to match similarity() output
DROP FUNCTION IF EXISTS public.search_businesses_fuzzy(text, integer);

CREATE FUNCTION public.search_businesses_fuzzy(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  address text,
  score real
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cat_expr TEXT := '';
  v_addr_expr TEXT := '';
  v_sql TEXT;
BEGIN
  v_cat_expr := 'COALESCE(' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='category_name')
      THEN 'b.category_name' ELSE '''''' END || ', ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='category')
      THEN 'b.category' ELSE '''''' END || ', ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business' AND column_name='tag')
      THEN 'b.tag' ELSE '''''' END || ', '''')';

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
        SELECT regexp_split_to_table((SELECT q FROM q), '\\s+') AS token
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
      )::real AS score
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
