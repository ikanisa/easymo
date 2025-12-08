-- Create processed_webhooks table for idempotency
-- Prevents duplicate webhook processing due to retries

BEGIN;

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  phone_number text NOT NULL,
  webhook_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure uniqueness
  UNIQUE(message_id, webhook_type)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_message_id 
  ON public.processed_webhooks(message_id, webhook_type);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_created_at 
  ON public.processed_webhooks(created_at);

-- Auto-cleanup old entries (keep only last 24 hours)
-- This prevents table bloat
CREATE OR REPLACE FUNCTION cleanup_old_processed_webhooks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.processed_webhooks
  WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Schedule cleanup to run periodically (can be called via cron or manually)
COMMENT ON FUNCTION cleanup_old_processed_webhooks IS 
  'Removes processed webhook records older than 24 hours. Call periodically to prevent table bloat.';

-- Enable RLS
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/select
-- Only service role can insert/select
DROP POLICY IF EXISTS processed_webhooks_service_policy ON public.processed_webhooks;
CREATE POLICY processed_webhooks_service_policy ON public.processed_webhooks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.processed_webhooks TO service_role;

COMMIT;
