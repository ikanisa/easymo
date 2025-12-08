-- Mobility V2 Migration Script
-- Dual-write: Write to both V1 and V2 schemas during migration
--
-- Phase 1: Deploy V2 tables (already done)
-- Phase 2: Dual-write (this script)
-- Phase 3: Backfill historical data
-- Phase 4: Cutover to V2 reads
-- Phase 5: Drop V1 tables

BEGIN;

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS mobility_migration_status (
  id SERIAL PRIMARY KEY,
  phase TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress',
  notes TEXT
);

-- Record migration start
INSERT INTO mobility_migration_status (phase, notes)
VALUES ('dual_write', 'Starting dual-write phase');

-- Create trigger function for dual-write on trip creation
CREATE OR REPLACE FUNCTION mobility_dual_write_trip()
RETURNS TRIGGER AS $$
BEGIN
  -- Write to V2 schema
  INSERT INTO mobility_trips (
    id,
    creator_user_id,
    role,
    vehicle_type,
    pickup_lat,
    pickup_lng,
    pickup_text,
    dropoff_lat,
    dropoff_lng,
    dropoff_text,
    expires_at,
    status,
    created_at
  ) VALUES (
    NEW.id,
    NEW.creator_user_id,
    NEW.role,
    NEW.vehicle_type,
    NEW.pickup_lat,
    NEW.pickup_lng,
    NEW.pickup_text,
    NEW.dropoff_lat,
    NEW.dropoff_lng,
    NEW.dropoff_text,
    NEW.expires_at,
    NEW.status,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    dropoff_lat = EXCLUDED.dropoff_lat,
    dropoff_lng = EXCLUDED.dropoff_lng,
    dropoff_text = EXCLUDED.dropoff_text,
    last_location_update = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Attach trigger to V1 table (mobility_intents) when ready
-- CREATE TRIGGER mobility_dual_write_trigger
-- AFTER INSERT OR UPDATE ON mobility_intents
-- FOR EACH ROW EXECUTE FUNCTION mobility_dual_write_trip();

COMMIT;

-- Instructions for enabling dual-write:
-- 1. Deploy this migration
-- 2. Verify V2 tables are ready
-- 3. Enable trigger (uncomment above)
-- 4. Monitor write latency
-- 5. Verify data consistency
