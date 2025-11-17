BEGIN;

-- Schedule hourly refresh of trending items materialized view
-- Runs at minute 5 of every hour

DO $$
BEGIN
  PERFORM cron.schedule(
    'waiter_trending_refresh_hourly',
    '5 * * * *',
    $$SELECT public.refresh_menu_item_popularity_daily()$$
  );
EXCEPTION WHEN OTHERS THEN
  -- Ignore if cron extension not available or schedule exists
  NULL;
END$$;

COMMIT;

