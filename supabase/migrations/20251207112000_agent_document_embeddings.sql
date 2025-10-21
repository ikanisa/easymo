-- Agent document embeddings chunk storage and similarity search
-- Additive-only migration; safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.agent_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.agent_documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  token_count int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS agent_document_chunks_document_idx
  ON public.agent_document_chunks(document_id);

CREATE INDEX IF NOT EXISTS agent_document_chunks_embedding_idx
  ON public.agent_document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS agent_document_chunks_created_idx
  ON public.agent_document_chunks(created_at DESC);

ALTER TABLE public.agent_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER agent_document_chunks_updated
  BEFORE UPDATE ON public.agent_document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY agent_document_chunks_admin_manage ON public.agent_document_chunks
      FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  ELSE
    EXECUTE 'CREATE POLICY agent_document_chunks_admin_manage ON public.agent_document_chunks
      FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_agent_document_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  agent_id uuid,
  min_similarity double precision DEFAULT 0
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  agent_id uuid,
  document_title text,
  chunk_index int,
  content text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.agent_id,
    d.title AS document_title,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.agent_document_chunks c
  JOIN public.agent_documents d ON d.id = c.document_id
  WHERE d.agent_id = agent_id
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= COALESCE(min_similarity, 0)
  ORDER BY c.embedding <-> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 5), 1), 50);
END;
$$;

COMMIT;
