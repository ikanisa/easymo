-- Fix for 20251004100000_insurance_pipeline.sql
-- Add missing assigned_agent_id column to insurance_requests

BEGIN;

-- Add assigned_agent_id to insurance_requests
ALTER TABLE public.insurance_requests
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;

-- Add foreign key if profiles table exists (not users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_insurance_requests_agent'
  ) THEN
    ALTER TABLE public.insurance_requests
      ADD CONSTRAINT fk_insurance_requests_agent
      FOREIGN KEY (assigned_agent_id)
      REFERENCES public.profiles(user_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_insurance_requests_assigned_agent 
  ON public.insurance_requests(assigned_agent_id);

-- Add workflow columns if needed
ALTER TABLE public.insurance_requests
ADD COLUMN IF NOT EXISTS workflow_stage TEXT DEFAULT 'initial';

ALTER TABLE public.insurance_requests
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

ALTER TABLE public.insurance_requests
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMIT;
