BEGIN;

-- Check if tables exist before dropping (removed basket/sacco references)
DO $$
BEGIN
  -- Only drop tables that actually exist
  DROP TABLE IF EXISTS public.remote_sync_status CASCADE;
  DROP TABLE IF EXISTS public.remote_sync_logs CASCADE;
  
  -- Skip dropping non-existent tables:
  -- baskets_reminders, campaigns, saccos are already removed
END $$;

-- Create new remote sync infrastructure
CREATE TABLE IF NOT EXISTS public.remote_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_remote_sync_status_entity ON public.remote_sync_status(entity_type, entity_id);
CREATE INDEX idx_remote_sync_status_sync ON public.remote_sync_status(sync_status, last_sync_at);

COMMIT;
