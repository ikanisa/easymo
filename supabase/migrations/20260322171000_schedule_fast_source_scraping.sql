BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule if already present
SELECT cron.unschedule('rw-source-scraper-properties-fast') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rw-source-scraper-properties-fast');
SELECT cron.unschedule('rw-source-scraper-jobs-fast') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rw-source-scraper-jobs-fast');

-- Every 15 minutes: scrape one RW property source in fast mode
SELECT cron.schedule(
  'rw-source-scraper-properties-fast',
  '*/15 * * * *',
  $$
  WITH s AS (
    SELECT id
    FROM get_property_sources_to_scrape(24)
    WHERE country_code = 'RW'
    LIMIT 1
  )
  SELECT CASE WHEN EXISTS (SELECT 1 FROM s) THEN
    net.http_post(
      url := public.__get_setting_for_cron('app.supabase_url') || '/functions/v1/source-url-scraper',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || public.__get_setting_for_cron('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('type','properties','source_id',(SELECT id FROM s),'fast',true,'limit',1)
    )
  ELSE NULL END;
  $$
);

-- Every 20 minutes: scrape one RW job source in fast mode
SELECT cron.schedule(
  'rw-source-scraper-jobs-fast',
  '*/20 * * * *',
  $$
  WITH s AS (
    SELECT id
    FROM get_job_sources_to_scrape(24)
    WHERE country_code = 'RW'
    LIMIT 1
  )
  SELECT CASE WHEN EXISTS (SELECT 1 FROM s) THEN
    net.http_post(
      url := public.__get_setting_for_cron('app.supabase_url') || '/functions/v1/source-url-scraper',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || public.__get_setting_for_cron('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('type','jobs','source_id',(SELECT id FROM s),'fast',true,'limit',1)
    )
  ELSE NULL END;
  $$
);

COMMIT;

