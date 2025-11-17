BEGIN;

-- =====================================================
-- User Memories (long-term preferences and summaries)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  domain TEXT NOT NULL, -- e.g., 'waiter', 'real_estate', 'job_board', 'marketing'
  memory_type TEXT NOT NULL DEFAULT 'preference', -- 'preference' | 'summary' | 'note'
  mem_key TEXT NOT NULL, -- e.g., 'dietary', 'favorite_items', 'city', 'budget'
  mem_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  first_seen TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memories_key ON public.user_memories(user_id, domain, mem_key);
CREATE INDEX IF NOT EXISTS idx_user_memories_domain ON public.user_memories(domain);

ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_memories' AND policyname='user_memories_owner_select'
  ) THEN
    CREATE POLICY user_memories_owner_select ON public.user_memories
      FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_memories' AND policyname='user_memories_owner_upsert'
  ) THEN
    CREATE POLICY user_memories_owner_upsert ON public.user_memories
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_memories' AND policyname='user_memories_owner_update'
  ) THEN
    CREATE POLICY user_memories_owner_update ON public.user_memories
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

COMMIT;

