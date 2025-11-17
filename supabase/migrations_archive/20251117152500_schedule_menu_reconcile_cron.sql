BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule previous job if exists
SELECT cron.unschedule('reconcile-restaurant-menu-business-link')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-restaurant-menu-business-link');

-- Schedule daily at 03:15 UTC
SELECT cron.schedule(
  'reconcile-restaurant-menu-business-link',
  '15 3 * * *',
  $$
  SELECT public.reconcile_menu_business_links();
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Nightly menu↔business reconciliation (03:15 UTC).';

COMMIT;

