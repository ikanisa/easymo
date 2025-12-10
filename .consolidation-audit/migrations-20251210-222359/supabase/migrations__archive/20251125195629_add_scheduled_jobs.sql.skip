BEGIN;

-- Add pg_cron extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule DLQ processor to run every 5 minutes
-- Remove existing job if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'dlq-processor'
  ) THEN
    PERFORM cron.unschedule('dlq-processor');
  END IF;
END $$;

-- Schedule DLQ processor
SELECT cron.schedule(
  'dlq-processor',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/dlq-processor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('scheduled', true)
    ) AS request_id;
  $$
);

-- Schedule session cleanup to run daily at 2 AM
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'session-cleanup'
  ) THEN
    PERFORM cron.unschedule('session-cleanup');
  END IF;
END $$;

SELECT cron.schedule(
  'session-cleanup',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/session-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('scheduled', true)
    ) AS request_id;
  $$
);

-- Create settings table for storing URLs (alternative to app.settings)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add settings (will be populated by environment)
INSERT INTO public.system_settings (key, value)
VALUES 
  ('supabase_url', COALESCE(current_setting('app.settings.supabase_url', true), 'https://placeholder.supabase.co')),
  ('service_role_key', COALESCE(current_setting('app.settings.service_role_key', true), 'placeholder'))
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

COMMENT ON TABLE public.system_settings IS 'System configuration for scheduled jobs and background tasks';

COMMIT;
