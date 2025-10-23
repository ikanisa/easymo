BEGIN;

-- Create a helper function for vector-based business matching if an embedding column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='businesses' AND column_name='embedding'
  ) THEN
    CREATE OR REPLACE FUNCTION public.match_businesses(
      p_query vector,
      p_category text DEFAULT NULL,
      p_region text DEFAULT NULL,
      p_limit int DEFAULT 5
    ) RETURNS SETOF public.businesses AS $$
      SELECT b.*
      FROM public.businesses b
      WHERE (p_category IS NULL OR b.category = p_category)
        AND (p_region IS NULL OR b.region ILIKE ('%' || p_region || '%'))
      ORDER BY b.embedding <-> p_query
      LIMIT COALESCE(p_limit, 5);
    $$ LANGUAGE sql STABLE;
  END IF;
EXCEPTION WHEN others THEN
  -- ignore if vector extension or embedding not configured
  NULL;
END$$;

COMMIT;

