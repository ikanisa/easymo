-- =====================================================
-- Migration 2: Cron Schedule (1x daily at 11am EAT)
-- Copy and paste this entire file into Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/vacltfdslodqybxojytc/sql/new
-- =====================================================

-- =====================================================
-- Schedule OpenAI Deep Research - Once Daily at 11am EAT
-- =====================================================
BEGIN;

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension for calling edge functions
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule 11am EAT (8am UTC) - Single daily research run
SELECT cron.schedule(
  'openai-deep-research-daily',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/openai-deep-research',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'action', 'scrape',
        'testMode', false
      )
    ) AS request_id;
  $$
);

-- Create settings table for runtime configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO app_settings (key, value, description) VALUES
  ('app.supabase_url', 'https://YOUR_PROJECT.supabase.co', 'Supabase project URL'),
  ('app.service_role_key', 'YOUR_SERVICE_ROLE_KEY', 'Service role key for edge function calls'),
  ('app.econfary_api_key', 'c548f5e85718225f50752750e5be2837035009df30ed57d99b67527c9f200bd7', 'Econfary API key for property data'),
  ('app.serpapi_key', 'YOUR_SERPAPI_KEY', 'SerpAPI key for web searches')
ON CONFLICT (key) DO NOTHING;

-- Function to get setting value
CREATE OR REPLACE FUNCTION current_setting(setting_key TEXT)
RETURNS TEXT AS $$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value INTO setting_value
  FROM app_settings
  WHERE key = setting_key;
  
  RETURN COALESCE(setting_value, '');
END;
$$ LANGUAGE plpgsql STABLE;

-- View cron jobs
COMMENT ON EXTENSION pg_cron IS 'OpenAI Deep Research scheduled once daily at 11am EAT (8am UTC)';

COMMIT;
