-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily reconciliation at 1 AM UTC
-- This calls the run_daily_reconciliation() RPC function
SELECT cron.schedule(
  'wallet-daily-reconciliation', -- Job name
  '0 1 * * *',                   -- Schedule (1 AM daily)
  $$SELECT run_daily_reconciliation()$$
);

-- Grant usage to postgres (or appropriate role)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
