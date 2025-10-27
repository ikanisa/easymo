-- Router Logs Table
-- Purpose: Record routing decisions and message processing for debugging and analytics.
-- This table captures message_id, text snippet, route_key, status_code, and additional metadata
-- to help troubleshoot routing issues and understand message flow.

BEGIN;

-- Create router_logs table
CREATE TABLE IF NOT EXISTS public.router_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  text_snippet text,
  route_key text,
  status_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_router_logs_message_id
  ON public.router_logs (message_id);

CREATE INDEX IF NOT EXISTS idx_router_logs_route_key
  ON public.router_logs (route_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_router_logs_status_code
  ON public.router_logs (status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_router_logs_created_at
  ON public.router_logs (created_at DESC);

-- Add table comment
COMMENT ON TABLE public.router_logs IS 
  'Logs WhatsApp message routing decisions including message ID, text snippet, matched route, and status. Used for debugging and analytics.';

COMMENT ON COLUMN public.router_logs.message_id IS 
  'WhatsApp message ID from the incoming webhook payload.';

COMMENT ON COLUMN public.router_logs.text_snippet IS 
  'Truncated or sanitized text content from the message (max 500 chars for privacy/storage).';

COMMENT ON COLUMN public.router_logs.route_key IS 
  'The route key that was matched/selected (e.g., insurance, basket, qr, dine, easymo). NULL if no route matched.';

COMMENT ON COLUMN public.router_logs.status_code IS 
  'Processing status code: routed, unmatched, error, filtered, etc.';

COMMENT ON COLUMN public.router_logs.metadata IS 
  'Additional context: matched_keyword, confidence, processing_time_ms, error_details, etc.';

COMMENT ON COLUMN public.router_logs.created_at IS 
  'Timestamp when the log entry was created.';

-- Enable RLS
ALTER TABLE public.router_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full access for writing logs
CREATE POLICY router_logs_service_rw
  ON public.router_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins can read logs for debugging
CREATE POLICY router_logs_authenticated_read
  ON public.router_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant necessary permissions
GRANT SELECT ON public.router_logs TO authenticated;
GRANT INSERT ON public.router_logs TO service_role;

COMMIT;
