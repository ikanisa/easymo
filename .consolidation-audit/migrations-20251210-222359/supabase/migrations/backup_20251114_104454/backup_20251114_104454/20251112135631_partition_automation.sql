BEGIN;

-- Migration: Create partition automation and future partitions
-- Date: 2025-11-12
-- Description: Create partitions for future months and set up automation strategy

-- Function to create partitions for a given table and date range
CREATE OR REPLACE FUNCTION public.create_monthly_partition(
  parent_table TEXT,
  partition_date DATE
)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  partition_name := parent_table || '_' || TO_CHAR(partition_date, 'YYYY_MM');
  start_date := TO_CHAR(partition_date, 'YYYY-MM-01');
  end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-01');
  
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name
    AND n.nspname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
      partition_name, parent_table, start_date, end_date
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for next 6 months for all partitioned tables
DO $$
DECLARE
  i INTEGER;
  partition_date DATE;
  tables_to_partition TEXT[] := ARRAY['event_store', 'system_audit_logs', 'system_metrics', 'transactions'];
  tbl TEXT;
BEGIN
  -- Start from June 2026 (April and May already exist)
  FOR i IN 0..5 LOOP
    partition_date := DATE '2026-06-01' + (i * INTERVAL '1 month');
    
    -- Check and create partitions for each table
    FOREACH tbl IN ARRAY tables_to_partition LOOP
      -- Only create partition if parent table exists
      IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
        PERFORM public.create_monthly_partition(tbl, partition_date);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Create indexes on new partitions for transactions
DO $$
DECLARE
  partition_name TEXT;
  month_dates DATE[] := ARRAY[
    '2026-06-01'::DATE, '2026-07-01'::DATE, '2026-08-01'::DATE,
    '2026-09-01'::DATE, '2026-10-01'::DATE, '2026-11-01'::DATE
  ];
  partition_date DATE;
BEGIN
  FOREACH partition_date IN ARRAY month_dates LOOP
    partition_name := 'transactions_' || TO_CHAR(partition_date, 'YYYY_MM');
    
    -- Only create indexes if partition exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = partition_name) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_created ON public.%I (user_id, created_at DESC)', partition_name, partition_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_status ON public.%I (status, created_at DESC)', partition_name, partition_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_correlation ON public.%I (correlation_id)', partition_name, partition_name);
    END IF;
  END LOOP;
END $$;

-- Note: For production, consider setting up pg_cron or external scheduler
-- to automatically call create_monthly_partition() for future months
-- Example pg_cron job (requires pg_cron extension):
-- SELECT cron.schedule(
--   'create-monthly-partitions',
--   '0 0 1 * *', -- Run at midnight on the 1st of each month
--   $$
--   SELECT public.create_monthly_partition('event_store', CURRENT_DATE + INTERVAL '2 months');
--   SELECT public.create_monthly_partition('system_audit_logs', CURRENT_DATE + INTERVAL '2 months');
--   SELECT public.create_monthly_partition('system_metrics', CURRENT_DATE + INTERVAL '2 months');
--   SELECT public.create_monthly_partition('transactions', CURRENT_DATE + INTERVAL '2 months');
--   $$
-- );

COMMIT;
