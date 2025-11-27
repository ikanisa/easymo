-- Setup DLQ Processor Cron Job
-- Automatically processes dead letter queue entries every 5 minutes

BEGIN;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to invoke DLQ processor edge function
CREATE OR REPLACE FUNCTION process_dlq_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get configuration from vault or environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Call DLQ processor via HTTP
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/dlq-processor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  -- Log the processing attempt
  INSERT INTO dlq_processing_log (processed_at, status)
  VALUES (NOW(), 'triggered')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Create logging table for DLQ processing
CREATE TABLE IF NOT EXISTS dlq_processing_log (
  id BIGSERIAL PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  entries_processed INTEGER DEFAULT 0,
  entries_failed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_dlq_processing_log_processed_at 
ON dlq_processing_log(processed_at DESC);

-- Schedule DLQ processor to run every 5 minutes
SELECT cron.schedule(
  'process-dlq-entries',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT process_dlq_entries();'
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_dlq_entries() TO postgres;
GRANT ALL ON TABLE dlq_processing_log TO postgres;

-- Add comment for documentation
COMMENT ON FUNCTION process_dlq_entries() IS 
  'Triggers DLQ processor edge function to retry failed webhook messages. Runs every 5 minutes via pg_cron.';

COMMIT;
