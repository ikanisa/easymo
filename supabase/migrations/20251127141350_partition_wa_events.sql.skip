-- Partition wa_events table for optimal performance
-- Monthly partitions for webhook event storage

BEGIN;

-- Step 1: Create partitioned table structure
CREATE TABLE IF NOT EXISTS wa_events_new (
  id UUID DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  from_number TEXT,
  to_number TEXT,
  message_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Step 2: Create monthly partitions (last 3 months + next 3 months)
CREATE TABLE wa_events_2025_09 PARTITION OF wa_events_new
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE wa_events_2025_10 PARTITION OF wa_events_new
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE wa_events_2025_11 PARTITION OF wa_events_new
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE wa_events_2025_12 PARTITION OF wa_events_new
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE wa_events_2026_01 PARTITION OF wa_events_new
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE wa_events_2026_02 PARTITION OF wa_events_new
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Step 3: Create indexes on partitioned table
CREATE INDEX IF NOT EXISTS idx_wa_events_new_from_number_time 
  ON wa_events_new (from_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_events_new_message_id 
  ON wa_events_new (message_id) WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_events_new_processed 
  ON wa_events_new (created_at DESC) WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_wa_events_new_event_type 
  ON wa_events_new (event_type, created_at DESC);

-- Step 4: Create function to automatically create future partitions
CREATE OR REPLACE FUNCTION create_wa_events_partition()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  -- Create partition for 3 months in the future
  partition_date := DATE_TRUNC('month', NOW() + INTERVAL '3 months')::DATE;
  partition_name := 'wa_events_' || TO_CHAR(partition_date, 'YYYY_MM');
  start_date := partition_date::TEXT;
  end_date := (partition_date + INTERVAL '1 month')::TEXT;
  
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = partition_name 
    AND schemaname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF wa_events_new FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
    
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Schedule automatic partition creation (runs monthly)
SELECT cron.schedule(
  'create-wa-events-partitions',
  '0 0 1 * *',  -- First day of each month at midnight
  'SELECT create_wa_events_partition();'
);

-- Step 6: Create function to drop old partitions (older than 6 months)
CREATE OR REPLACE FUNCTION drop_old_wa_events_partitions()
RETURNS void AS $$
DECLARE
  partition_record RECORD;
  cutoff_date DATE;
BEGIN
  cutoff_date := DATE_TRUNC('month', NOW() - INTERVAL '6 months')::DATE;
  
  FOR partition_record IN
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename LIKE 'wa_events_%'
      AND tablename ~ '^\d{4}_\d{2}$'
  LOOP
    -- Extract date from partition name and check if it's old
    IF TO_DATE(
      SUBSTRING(partition_record.tablename FROM 'wa_events_(\d{4}_\d{2})'),
      'YYYY_MM'
    ) < cutoff_date THEN
      EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
      RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Schedule automatic partition cleanup (runs monthly)
SELECT cron.schedule(
  'drop-old-wa-events-partitions',
  '0 2 1 * *',  -- First day of each month at 2 AM
  'SELECT drop_old_wa_events_partitions();'
);

-- Step 8: Add comments for documentation
COMMENT ON TABLE wa_events_new IS 
  'Partitioned wa_events table (by created_at, monthly). Old data automatically dropped after 6 months.';

COMMENT ON FUNCTION create_wa_events_partition() IS 
  'Automatically creates wa_events partition for 3 months in future. Scheduled via cron (monthly).';

COMMENT ON FUNCTION drop_old_wa_events_partitions() IS 
  'Automatically drops wa_events partitions older than 6 months. Scheduled via cron (monthly).';

-- Step 9: Grant permissions
GRANT ALL ON TABLE wa_events_new TO postgres;
GRANT SELECT ON TABLE wa_events_new TO authenticated;
GRANT ALL ON TABLE wa_events_new TO service_role;

-- Note: Migration of data from old wa_events table to wa_events_new
-- should be done separately in a maintenance window to avoid downtime
-- Use: INSERT INTO wa_events_new SELECT * FROM wa_events;

COMMIT;
