-- General Broker Agent: User Memory Tables
-- User locations (home/work/school) and persistent facts

BEGIN;

-- User locations for saved places
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT CHECK (label IN ('home','work','school','other')) DEFAULT 'other',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX idx_user_locations_default ON public.user_locations(user_id, is_default) WHERE is_default = TRUE;

-- User facts for persistent key-value memory
CREATE TABLE IF NOT EXISTS public.user_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, key)
);

CREATE INDEX idx_user_facts_user_id ON public.user_facts(user_id);
CREATE INDEX idx_user_facts_key ON public.user_facts(user_id, key);

-- RLS Policies
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_locations_select" ON public.user_locations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_locations_insert" ON public.user_locations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_locations_update" ON public.user_locations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_facts_select" ON public.user_facts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_facts_insert" ON public.user_facts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_facts_update" ON public.user_facts
  FOR UPDATE USING (user_id = auth.uid());

COMMIT;
