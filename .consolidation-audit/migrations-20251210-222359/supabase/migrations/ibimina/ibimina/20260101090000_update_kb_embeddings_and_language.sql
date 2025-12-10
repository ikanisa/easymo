-- Migration: Align knowledge base schemas with text-embedding-3-large
-- Description: Increase embedding dimensions, add language metadata, and expose kb.search helper
-- Date: 2026-01-01

BEGIN;

-- Ensure pgvector is available
CREATE EXTENSION IF NOT EXISTS vector;

-- ===== Update org_kb =====
DROP INDEX IF EXISTS idx_org_kb_embedding;

ALTER TABLE public.org_kb
  ALTER COLUMN embedding TYPE vector(3072)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    WHEN COALESCE(array_length(embedding::float4[], 1), 0) = 3072 THEN embedding
    WHEN COALESCE(array_length(embedding::float4[], 1), 0) > 3072 THEN
      vector((embedding::float4[])[1:3072])
    ELSE
      vector(
        array_cat(
          embedding::float4[],
          array_fill(
            0::float4,
            ARRAY[3072 - COALESCE(array_length(embedding::float4[], 1), 0)]
          )
        )
      )
  END;

-- Add language metadata if missing
ALTER TABLE public.org_kb
  ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT 'en';

UPDATE public.org_kb
SET language_code = COALESCE(NULLIF(language_code, ''), 'en');

ALTER TABLE public.org_kb
  ALTER COLUMN language_code SET NOT NULL;

ALTER TABLE public.org_kb
  ALTER COLUMN language_code DROP DEFAULT;

-- Add uniqueness and lookup helpers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_kb_org_lang_title_key'
  ) THEN
    ALTER TABLE public.org_kb
      ADD CONSTRAINT org_kb_org_lang_title_key UNIQUE (org_id, language_code, title);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_kb_language ON public.org_kb(language_code);

-- Recreate vector index with the new dimension
CREATE INDEX IF NOT EXISTS idx_org_kb_embedding
  ON public.org_kb USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);

COMMENT ON COLUMN public.org_kb.language_code IS 'BCP-47 language tag for localized content (e.g., en, rw, fr).';
COMMENT ON COLUMN public.org_kb.embedding IS '3072-d vector embedding for RAG similarity search (text-embedding-3-large).';

-- ===== Update global_kb =====
DROP INDEX IF EXISTS idx_global_kb_embedding;

ALTER TABLE public.global_kb
  ALTER COLUMN embedding TYPE vector(3072)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    WHEN COALESCE(array_length(embedding::float4[], 1), 0) = 3072 THEN embedding
    WHEN COALESCE(array_length(embedding::float4[], 1), 0) > 3072 THEN
      vector((embedding::float4[])[1:3072])
    ELSE
      vector(
        array_cat(
          embedding::float4[],
          array_fill(
            0::float4,
            ARRAY[3072 - COALESCE(array_length(embedding::float4[], 1), 0)]
          )
        )
      )
  END;

ALTER TABLE public.global_kb
  ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT 'en';

UPDATE public.global_kb
SET language_code = COALESCE(NULLIF(language_code, ''), 'en');

ALTER TABLE public.global_kb
  ALTER COLUMN language_code SET NOT NULL;

ALTER TABLE public.global_kb
  ALTER COLUMN language_code DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'global_kb_lang_title_key'
  ) THEN
    ALTER TABLE public.global_kb
      ADD CONSTRAINT global_kb_lang_title_key UNIQUE (language_code, title);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_global_kb_language ON public.global_kb(language_code);

CREATE INDEX IF NOT EXISTS idx_global_kb_embedding
  ON public.global_kb USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);

COMMENT ON COLUMN public.global_kb.language_code IS 'BCP-47 language tag for localized content (e.g., en, rw, fr).';
COMMENT ON COLUMN public.global_kb.embedding IS '3072-d vector embedding for RAG similarity search (text-embedding-3-large).';

-- ===== Knowledge base search helper =====
CREATE SCHEMA IF NOT EXISTS kb;

CREATE OR REPLACE FUNCTION kb.search(
  query_embedding vector(3072),
  target_org uuid DEFAULT NULL,
  language_filter text DEFAULT NULL,
  match_limit integer DEFAULT 8,
  min_similarity double precision DEFAULT 0.2
)
RETURNS TABLE (
  source text,
  id uuid,
  org_id uuid,
  language_code text,
  title text,
  content text,
  tags text[],
  policy_tag text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM (
    SELECT
      'org_kb'::text AS source,
      o.id,
      o.org_id,
      o.language_code,
      o.title,
      o.content,
      o.tags,
      o.policy_tag,
      1 - (o.embedding <=> query_embedding) AS similarity
    FROM public.org_kb o
    WHERE (target_org IS NULL OR o.org_id = target_org)
      AND (language_filter IS NULL OR o.language_code = language_filter)

    UNION ALL

    SELECT
      'global_kb'::text AS source,
      g.id,
      NULL::uuid AS org_id,
      g.language_code,
      g.title,
      g.content,
      g.tags,
      g.policy_tag,
      1 - (g.embedding <=> query_embedding) AS similarity
    FROM public.global_kb g
    WHERE (language_filter IS NULL OR g.language_code = language_filter)
  ) AS combined
  WHERE combined.similarity >= min_similarity
  ORDER BY combined.similarity DESC
  LIMIT match_limit;
END;
$$;

COMMENT ON FUNCTION kb.search(vector(3072), uuid, text, integer, double precision)
IS 'Perform cosine-similarity RAG search across org and global knowledge bases.';

GRANT USAGE ON SCHEMA kb TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION kb.search(vector(3072), uuid, text, integer, double precision) TO authenticated, service_role;

COMMIT;
