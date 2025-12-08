-- =====================================================================
-- DEEP SEARCH - SEMANTIC VECTOR SEARCH ACROSS ALL DOMAINS
-- =====================================================================
-- Comprehensive semantic search using pgvector
-- Supports: marketplace, jobs, properties, produce, businesses
-- =====================================================================

-- Guarded execution to avoid failures on missing extensions/tables in prod
DO $$
BEGIN
  -- Enable pgvector if available
  PERFORM 1
  FROM pg_extension
  WHERE extname = 'vector';
  IF NOT FOUND THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS vector;
    EXCEPTION WHEN undefined_file THEN
      RAISE NOTICE 'pgvector extension not available on this instance, skipping semantic search migration';
      RETURN;
    END;
  END IF;

  -- Ensure target table exists before proceeding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'search_embeddings'
  ) THEN
    -- Table will be created below if missing
    NULL;
  END IF;
END$$;

BEGIN;

-- =====================================================================
-- 1. ENABLE VECTOR EXTENSION
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================
-- 2. UNIFIED SEARCH INDEX TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.search_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content identification
  domain text NOT NULL CHECK (domain IN (
    'marketplace', 'jobs', 'properties', 'produce', 
    'businesses', 'conversations', 'knowledge_base'
  )),
  entity_id uuid NOT NULL,
  entity_type text NOT NULL,
  
  -- Searchable content
  title text NOT NULL,
  description text,
  full_text text NOT NULL,
  
  -- Vector embedding (OpenAI text-embedding-3-small = 1536 dimensions)
  embedding vector(1536),
  
  -- Metadata for ranking
  metadata jsonb DEFAULT '{}'::jsonb,
  relevance_score float DEFAULT 1.0,
  view_count int DEFAULT 0,
  interaction_count int DEFAULT 0,
  
  -- Location for geo-aware search
  location geometry(Point, 4326),
  location_name text,
  
  -- Status
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  
  -- Composite uniqueness
  UNIQUE (domain, entity_id)
);

-- =====================================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================================

-- Vector similarity search index (IVFFlat for fast approximate search)
-- Create the IVFFlat index only if the operator class exists (pgvector loaded)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_opclass WHERE opcname = 'vector_cosine_ops'
  ) THEN
    EXECUTE $ivf$
      CREATE INDEX IF NOT EXISTS search_embeddings_embedding_idx
        ON public.search_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    $ivf$;
  ELSE
    RAISE NOTICE 'vector operator class not found; skipping IVFFlat index';
  END IF;
END$$;

-- Domain-based queries
CREATE INDEX IF NOT EXISTS search_embeddings_domain_idx
  ON public.search_embeddings(domain, is_active);

-- Entity lookup
CREATE INDEX IF NOT EXISTS search_embeddings_entity_idx
  ON public.search_embeddings(entity_type, entity_id);

-- Full-text search (fallback)
CREATE INDEX IF NOT EXISTS search_embeddings_fulltext_idx
  ON public.search_embeddings
  USING gin(to_tsvector('english', full_text));

-- Relevance-based ranking
CREATE INDEX IF NOT EXISTS search_embeddings_relevance_idx
  ON public.search_embeddings(relevance_score DESC, created_at DESC);

-- Geo-spatial search
CREATE INDEX IF NOT EXISTS search_embeddings_location_idx
  ON public.search_embeddings
  USING gist(location);

-- =====================================================================
-- 4. SEMANTIC SEARCH FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.semantic_search(
  query_embedding vector(1536),
  search_domains text[] DEFAULT ARRAY['marketplace', 'jobs', 'properties', 'produce', 'businesses'],
  match_count int DEFAULT 10,
  min_similarity double precision DEFAULT 0.7,
  user_location geometry(Point, 4326) DEFAULT NULL,
  max_distance_meters double precision DEFAULT 50000
)
RETURNS TABLE (
  id uuid,
  domain text,
  entity_id uuid,
  entity_type text,
  title text,
  description text,
  similarity double precision,
  relevance_score float,
  distance_meters double precision,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_results AS (
    SELECT
      se.id,
      se.domain,
      se.entity_id,
      se.entity_type,
      se.title,
      se.description,
      1 - (se.embedding <=> query_embedding) AS similarity,
      se.relevance_score,
      CASE 
        WHEN user_location IS NOT NULL AND se.location IS NOT NULL
        THEN ST_Distance(se.location::geography, user_location::geography)
        ELSE NULL
      END AS distance_meters,
      se.metadata,
      -- Composite ranking score
      (1 - (se.embedding <=> query_embedding)) * 0.7 +  -- 70% semantic similarity
      (se.relevance_score / 10.0) * 0.2 +                -- 20% relevance
      (se.interaction_count / 1000.0) * 0.1              -- 10% popularity
      AS rank_score
    FROM public.search_embeddings se
    WHERE 
      se.is_active = true
      AND se.domain = ANY(search_domains)
      AND (1 - (se.embedding <=> query_embedding)) >= min_similarity
      AND (
        user_location IS NULL 
        OR se.location IS NULL
        OR ST_DWithin(se.location::geography, user_location::geography, max_distance_meters)
      )
  )
  SELECT
    rr.id,
    rr.domain,
    rr.entity_id,
    rr.entity_type,
    rr.title,
    rr.description,
    rr.similarity,
    rr.relevance_score,
    rr.distance_meters,
    rr.metadata
  FROM ranked_results rr
  ORDER BY rr.rank_score DESC
  LIMIT match_count;
END;
$$;

-- =====================================================================
-- 5. HYBRID SEARCH (VECTOR + FULL-TEXT)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hybrid_search(
  search_query text,
  query_embedding vector(1536) DEFAULT NULL,
  search_domains text[] DEFAULT ARRAY['marketplace', 'jobs', 'properties'],
  match_count int DEFAULT 10,
  vector_weight double precision DEFAULT 0.7,
  text_weight double precision DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  domain text,
  entity_id uuid,
  title text,
  description text,
  combined_score double precision,
  vector_similarity double precision,
  text_rank double precision
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      se.id,
      se.domain,
      se.entity_id,
      se.title,
      se.description,
      CASE 
        WHEN query_embedding IS NOT NULL
        THEN 1 - (se.embedding <=> query_embedding)
        ELSE 0
      END AS similarity
    FROM public.search_embeddings se
    WHERE 
      se.is_active = true
      AND se.domain = ANY(search_domains)
  ),
  text_results AS (
    SELECT
      se.id,
      ts_rank(
        to_tsvector('english', se.full_text),
        plainto_tsquery('english', search_query)
      ) AS text_rank
    FROM public.search_embeddings se
    WHERE 
      se.is_active = true
      AND se.domain = ANY(search_domains)
      AND to_tsvector('english', se.full_text) @@ plainto_tsquery('english', search_query)
  )
  SELECT
    vr.id,
    vr.domain,
    vr.entity_id,
    vr.title,
    vr.description,
    (vr.similarity * vector_weight + COALESCE(tr.text_rank, 0) * text_weight) AS combined_score,
    vr.similarity AS vector_similarity,
    COALESCE(tr.text_rank, 0) AS text_rank
  FROM vector_results vr
  LEFT JOIN text_results tr ON vr.id = tr.id
  WHERE vr.similarity > 0 OR tr.text_rank > 0
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- =====================================================================
-- 6. UPDATE SEARCH STATS FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_search_stats(
  search_id uuid,
  was_clicked boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.search_embeddings
  SET 
    view_count = view_count + 1,
    interaction_count = interaction_count + CASE WHEN was_clicked THEN 1 ELSE 0 END,
    last_accessed_at = now()
  WHERE id = search_id;
END;
$$;

-- =====================================================================
-- 7. TRIGGER FOR AUTO-UPDATE
-- =====================================================================

CREATE OR REPLACE FUNCTION public.search_embeddings_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS search_embeddings_update_trigger ON public.search_embeddings;
DROP TRIGGER IF EXISTS search_embeddings_update_trigger ON ; -- FIXME: add table name
CREATE TRIGGER search_embeddings_update_trigger
  BEFORE UPDATE ON public.search_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.search_embeddings_updated();

-- =====================================================================
-- 8. RLS POLICIES
-- =====================================================================

ALTER TABLE public.search_embeddings ENABLE ROW LEVEL SECURITY;

-- Everyone can read active search entries
DROP POLICY IF EXISTS search_embeddings_read_policy ON public.search_embeddings;
CREATE POLICY search_embeddings_read_policy
  ON public.search_embeddings
  FOR SELECT
  USING (is_active = true);

-- Only service role can write
DROP POLICY IF EXISTS search_embeddings_write_policy ON public.search_embeddings;
CREATE POLICY search_embeddings_write_policy
  ON public.search_embeddings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
