BEGIN;

-- Add embedding column for vector similarity if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='businesses' AND column_name='embedding'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN embedding vector(1536);
  END IF;
EXCEPTION WHEN others THEN NULL; END$$;

-- Create IVFFlat index if vector extension present
DO $$
BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'vector';
  IF FOUND THEN
    CREATE INDEX IF NOT EXISTS businesses_embedding_ivfflat ON public.businesses USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
EXCEPTION WHEN others THEN NULL; END$$;

COMMIT;

