╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🚀 MANUAL DEPLOYMENT INSTRUCTIONS - COPY & PASTE               ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

STEP 1: Open Supabase SQL Editor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

URL: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new


STEP 2: Copy and Paste This SQL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

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

-- Grant permissions
GRANT ALL ON TABLE public.webhook_logs TO service_role, postgres, anon, authenticated;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_code 
  ON public.webhook_logs(status_code) 
  WHERE status_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_error 
  ON public.webhook_logs(endpoint, received_at) 
  WHERE error_message IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_payload 
  ON public.webhook_logs USING GIN (payload);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Comments
COMMENT ON COLUMN public.webhook_logs.payload IS 'Full webhook payload (JSONB for flexible querying)';
COMMENT ON COLUMN public.webhook_logs.headers IS 'HTTP headers from webhook request';
COMMENT ON COLUMN public.webhook_logs.status_code IS 'HTTP status code of response';
COMMENT ON COLUMN public.webhook_logs.error_message IS 'Error message if request failed';

COMMIT;


STEP 3: Click "RUN"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Click the green "RUN" button in the SQL Editor


STEP 4: Verify Success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test the webhook:
  curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook/health

Expected: HTTP 200 with JSON response

Monitor logs:
  https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/logs/edge-functions

Look for:
  ✅ Status 200 responses
  ✅ No more "permission denied" errors


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHY MANUAL DEPLOYMENT?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Supabase CLI cannot connect because:
  • Database connection pool is exhausted
  • wa-webhook is generating 16+ errors per minute
  • Each error attempt consumes a connection
  • Pool cannot recover while errors continue

The dashboard SQL editor bypasses the connection pool.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️  ESTIMATED TIME: 2 minutes
🎯  IMPACT: Restores production immediately
✅  SAFE: Idempotent migration (can run multiple times)
