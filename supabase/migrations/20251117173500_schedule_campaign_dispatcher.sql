BEGIN;

-- Run dispatcher every 5 minutes
DO $$
BEGIN
  PERFORM cron.schedule(
    'campaign_dispatcher_5min',
    '*/5 * * * *',
    $$SELECT net.http_post(
      url := current_setting('app.service_url', true) || '/functions/v1/campaign-dispatcher',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true)),
      body := '{}'::jsonb
    )$$
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

COMMIT;

