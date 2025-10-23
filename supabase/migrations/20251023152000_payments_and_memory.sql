BEGIN;

-- Enable pgcrypto (for gen_random_uuid) and pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Payments table for QR-driven flows
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL,
  qr_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies: user can read own, insert own, no update/delete by default
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY payments_insert_self ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sessions + memory tables
CREATE TABLE IF NOT EXISTS public.assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_select_own ON public.assistant_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sessions_insert_self ON public.assistant_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sessions_update_self ON public.assistant_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.assistant_memory (
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.assistant_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_select_own ON public.assistant_memory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY memory_upsert_self ON public.assistant_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY memory_update_self ON public.assistant_memory
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Vectorized memory (user-specific)
CREATE TABLE IF NOT EXISTS public.vector_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  embedding vector(1536) NOT NULL,
  doc_type TEXT NOT NULL,
  ref_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vector_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY vector_select_own ON public.vector_memory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY vector_insert_self ON public.vector_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY vector_update_self ON public.vector_memory
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS payments_user_created_idx ON public.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assistant_sessions_user_idx ON public.assistant_sessions (user_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS assistant_memory_user_key_idx ON public.assistant_memory (user_id, key);
CREATE INDEX IF NOT EXISTS vector_memory_user_idx ON public.vector_memory (user_id);

COMMIT;

