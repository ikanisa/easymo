-- Migration: Trigram Search RPC for SACCOs
-- Description: Creates optimized RPC function for fast SACCO search using trigram similarity
-- Dependencies: pg_trgm extension (enabled in 20251010223000_enable_trigram_extension.sql)

-- Create trigram indexes on saccos table for fast similarity search
-- These indexes enable efficient trigram-based search on name and sector_code columns
CREATE INDEX IF NOT EXISTS idx_saccos_name_trgm ON public.saccos USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_saccos_sector_code_trgm ON public.saccos USING gin (sector_code gin_trgm_ops);

-- Create or replace the search_saccos_trgm function
-- This function leverages trigram indexing for fast fuzzy search on SACCO names and sector codes
-- Returns top 20 matches ordered by similarity score
CREATE OR REPLACE FUNCTION public.search_saccos_trgm(q text)
RETURNS TABLE(
  id uuid,
  name text,
  district text,
  sector_code text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Search SACCOs using trigram similarity on name and sector_code
  -- Returns top 20 results ordered by similarity score
  -- Filters out results with very low similarity (<= 0.05) for performance
  WITH input AS (
    SELECT
      trim(q) AS query_text,
      set_limit(0.05) AS similarity_threshold
  )
  SELECT
    s.id,
    s.name,
    s.district,
    s.sector_code,
    greatest(
      similarity(s.name, input.query_text),
      similarity(s.sector_code, input.query_text)
    ) AS similarity
  FROM input
  JOIN public.saccos s ON true
  WHERE input.query_text <> ''
    AND (
      s.name % input.query_text
      OR s.sector_code % input.query_text
    )
  ORDER BY similarity DESC, s.name ASC
  LIMIT 20
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.search_saccos_trgm(text) IS 
'Fast trigram-based search for SACCOs by name or sector code. Returns top 20 matches ordered by similarity score.';
