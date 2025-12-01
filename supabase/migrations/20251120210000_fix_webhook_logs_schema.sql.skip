BEGIN;

-- =====================================================
-- FIX WEBHOOK_LOGS SCHEMA - CRITICAL PRODUCTION FIX
-- =====================================================
-- Adds missing columns that code expects but table lacks
-- This resolves "permission denied for schema public" errors
-- Reference: DEEP_REVIEW_REPORT_2025-11-20.md Issue #1
-- =====================================================

-- Add missing columns to webhook_logs
ALTER TABLE public.webhook_logs 
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Enable RLS if not already enabled
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists (for idempotency)
DROP POLICY IF EXISTS svc_rw_webhook_logs ON public.webhook_logs;

-- Create service role policy
CREATE POLICY svc_rw_webhook_logs ON public.webhook_logs
  FOR ALL 
  USING (auth.role() = 'service_role' OR auth.role() = 'postgres')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'postgres');

-- Grant permissions to all roles that might need access
GRANT ALL ON TABLE public.webhook_logs TO service_role, postgres, anon, authenticated;

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_code 
  ON public.webhook_logs(status_code) 
  WHERE status_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_error 
  ON public.webhook_logs(endpoint, received_at) 
  WHERE error_message IS NOT NULL;

-- Add index for payload queries (GIN for JSONB)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_payload 
  ON public.webhook_logs USING GIN (payload);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Add helpful comments
COMMENT ON COLUMN public.webhook_logs.payload IS 'Full webhook payload (JSONB for flexible querying)';
COMMENT ON COLUMN public.webhook_logs.headers IS 'HTTP headers from webhook request';
COMMENT ON COLUMN public.webhook_logs.status_code IS 'HTTP status code of response';
COMMENT ON COLUMN public.webhook_logs.error_message IS 'Error message if request failed';

COMMIT;
