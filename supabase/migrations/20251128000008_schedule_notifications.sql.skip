-- Transaction wrapper for production safety
BEGIN;

-- Schedule notification checker to run every hour
SELECT cron.schedule(
  'search-alert-notifications',
  '0 * * * *', -- Every hour at minute 0
  $$ 
  SELECT net.http_post(
    url := 'https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/search-alert-notifier',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"}'::jsonb,
    body := '{}'::jsonb
  ) 
  $$
);

-- Schedule reminder service to run daily at 9 AM UTC
SELECT cron.schedule(
  'daily-reminders',
  '0 9 * * *', -- Every day at 9 AM UTC
  $$ 
  SELECT net.http_post(
    url := 'https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/reminder-service',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"}'::jsonb,
    body := '{}'::jsonb
  ) 
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname IN ('search-alert-notifications', 'daily-reminders');

COMMIT;
