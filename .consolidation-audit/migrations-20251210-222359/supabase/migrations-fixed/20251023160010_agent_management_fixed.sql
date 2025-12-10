BEGIN;

-- Create agent registry table first
CREATE TABLE IF NOT EXISTS public.agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE,
  agent_type TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  capabilities TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing agent_id column to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS agent_id UUID;

-- Link profiles to agents (add constraint if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_profiles_agent' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT fk_profiles_agent 
      FOREIGN KEY (agent_id) 
      REFERENCES public.agent_registry(agent_id) 
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_registry_type ON public.agent_registry(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON public.agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_profiles_agent_id ON public.profiles(agent_id);

COMMIT;
