-- Fix for 20260323100100_agent_registry_seed_configs.sql
-- Add missing 'name' and 'description' columns to agent_registry

BEGIN;

ALTER TABLE public.agent_registry 
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.agent_registry 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for name lookups
CREATE INDEX IF NOT EXISTS idx_agent_registry_name 
  ON public.agent_registry(name);

COMMIT;
