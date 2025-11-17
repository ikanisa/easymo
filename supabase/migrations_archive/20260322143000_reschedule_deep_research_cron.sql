BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Helper inline function to fetch settings safely
CREATE OR REPLACE FUNCTION public.__get_setting_for_cron(setting_key TEXT)
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT value FROM public.app_settings WHERE key = setting_key
$$;

-- Unschedule legacy jobs
SELECT cron.unschedule('openai-deep-research-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'openai-deep-research-daily');
SELECT cron.unschedule('daily-source-scraper') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-source-scraper');
SELECT cron.unschedule('send-insurance-admin-notifications') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-insurance-admin-notifications');
SELECT cron.unschedule('daily-job-sources-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-job-sources-sync');
SELECT cron.unschedule('daily-property-sources-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-property-sources-sync');

-- Recreate Deep Research daily run (08:00 UTC)
SELECT cron.schedule(
  'openai-deep-research-daily',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url := public.__get_setting_for_cron('app.supabase_url') || '/functions/v1/openai-deep-research',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || public.__get_setting_for_cron('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('action', 'scrape', 'testMode', false)
    );
  $$
);

-- Recreate daily source scraper (02:00 UTC)
SELECT cron.schedule(
  'daily-source-scraper',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url := public.__get_setting_for_cron('app.supabase_url') || '/functions/v1/source-url-scraper',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || public.__get_setting_for_cron('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('type', 'both', 'limit', 10)
    );
  $$
);

-- Recreate insurance admin notifier (every 5 minutes)
SELECT cron.schedule(
  'send-insurance-admin-notifications',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := public.__get_setting_for_cron('app.supabase_url') || '/functions/v1/send-insurance-admin-notifications',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || public.__get_setting_for_cron('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('limit', 20)
    );
  $$
);

-- Daily job source sync (04:00 UTC)
SELECT cron.schedule(
  'daily-job-sources-sync',
  '0 4 * * *',
  $$
  SELECT
    net.http_post(
      url := public.__get_setting_for_cron('app.supabase_url') || '/functions/v1/job-sources-sync',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || public.__get_setting_for_cron('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('scheduled', true, 'timestamp', now())
    );
  $$
);

-- Daily property source sync (05:00 UTC)
SELECT cron.schedule(
  'daily-property-sources-sync',
  '0 5 * * *',
  $$
  SELECT
    net.http_post(
      url := public.__get_setting_for_cron('app.supabase_url') || '/functions/v1/openai-deep-research',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || public.__get_setting_for_cron('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('action', 'sync_all', 'scheduled', true, 'timestamp', now())
    );
  $$
);

COMMIT;
