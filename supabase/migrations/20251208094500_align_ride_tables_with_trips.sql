-- Align ride_requests, ride_notifications, rides_driver_status with canonical trips table
BEGIN;

-- ============================================================================
-- 1. FIX ride_requests: Add FK to trips, add RLS, clean up
-- ============================================================================

-- Add foreign key to trips (if not already there)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ride_requests_trip_id_fkey' 
    AND table_name = 'ride_requests'
  ) THEN
    ALTER TABLE ride_requests
      ADD CONSTRAINT ride_requests_trip_id_fkey 
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_ride_requests_passenger ON ride_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_created ON ride_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_requests_pending ON ride_requests(status, created_at DESC) 
  WHERE status = 'pending';

-- Add status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'ride_requests_status_check'
  ) THEN
    ALTER TABLE ride_requests 
      ADD CONSTRAINT ride_requests_status_check 
      CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));
  END IF;
END $$;

-- Add RLS policies
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ride_requests_passenger_rw" ON ride_requests;
DROP POLICY IF EXISTS "ride_requests_passenger_rw" ON ride_requests;
CREATE POLICY "ride_requests_passenger_rw"
  ON ride_requests
  FOR ALL
  USING (auth.uid() = passenger_id)
  WITH CHECK (auth.uid() = passenger_id);

DROP POLICY IF EXISTS "ride_requests_driver_read" ON ride_requests;
DROP POLICY IF EXISTS "ride_requests_driver_read" ON ride_requests;
CREATE POLICY "ride_requests_driver_read"
  ON ride_requests
  FOR SELECT
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "ride_requests_driver_update" ON ride_requests;
DROP POLICY IF EXISTS "ride_requests_driver_update" ON ride_requests;
CREATE POLICY "ride_requests_driver_update"
  ON ride_requests
  FOR UPDATE
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "ride_requests_service_role_all" ON ride_requests;
DROP POLICY IF EXISTS "ride_requests_service_role_all" ON ride_requests;
CREATE POLICY "ride_requests_service_role_all"
  ON ride_requests
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION ride_requests_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ride_requests_updated_at ON ride_requests;
CREATE TRIGGER trg_ride_requests_updated_at
  BEFORE UPDATE ON ride_requests
  FOR EACH ROW
  EXECUTE FUNCTION ride_requests_set_updated_at();

COMMENT ON TABLE ride_requests IS 'Ride match requests sent to drivers for specific trips';
COMMENT ON COLUMN ride_requests.trip_id IS 'Reference to trips table (canonical)';
COMMENT ON COLUMN ride_requests.status IS 'pending | accepted | declined | expired | cancelled';

-- ============================================================================
-- 2. FIX ride_notifications: Add FK to trips, add RLS
-- ============================================================================

-- Add foreign key to trips
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ride_notifications_trip_id_fkey' 
    AND table_name = 'ride_notifications'
  ) THEN
    ALTER TABLE ride_notifications
      ADD CONSTRAINT ride_notifications_trip_id_fkey 
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_ride_notifications_driver ON ride_notifications(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_created ON ride_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_notifications_status ON ride_notifications(status, created_at DESC);

-- Add status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'ride_notifications_status_check'
  ) THEN
    ALTER TABLE ride_notifications 
      ADD CONSTRAINT ride_notifications_status_check 
      CHECK (status IN ('sent', 'delivered', 'read', 'failed'));
  END IF;
END $$;

-- Add RLS policies
ALTER TABLE ride_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ride_notifications_driver_read" ON ride_notifications;
DROP POLICY IF EXISTS "ride_notifications_driver_read" ON ride_notifications;
CREATE POLICY "ride_notifications_driver_read"
  ON ride_notifications
  FOR SELECT
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "ride_notifications_service_role_all" ON ride_notifications;
DROP POLICY IF EXISTS "ride_notifications_service_role_all" ON ride_notifications;
CREATE POLICY "ride_notifications_service_role_all"
  ON ride_notifications
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE ride_notifications IS 'WhatsApp notifications sent to drivers about ride requests';
COMMENT ON COLUMN ride_notifications.trip_id IS 'Reference to trips table (canonical)';
COMMENT ON COLUMN ride_notifications.status IS 'sent | delivered | read | failed';

-- ============================================================================
-- 3. FIX rides_driver_status: Align with profiles, add geography, add RLS
-- ============================================================================

-- Change FK from whatsapp_users to profiles for consistency
DO $$
BEGIN
  -- Drop old FK if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'rides_driver_status_user_id_fkey' 
    AND table_name = 'rides_driver_status'
  ) THEN
    ALTER TABLE rides_driver_status DROP CONSTRAINT rides_driver_status_user_id_fkey;
  END IF;

  -- Add new FK to profiles
  ALTER TABLE rides_driver_status
    ADD CONSTRAINT rides_driver_status_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
END $$;

-- Add geography column for spatial queries
ALTER TABLE rides_driver_status 
  ADD COLUMN IF NOT EXISTS current_geog geography(Point, 4326) 
  GENERATED ALWAYS AS (
    CASE 
      WHEN current_lat IS NOT NULL AND current_lng IS NOT NULL 
      THEN ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography
      ELSE NULL
    END
  ) STORED;

-- Add geography index
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_geog 
  ON rides_driver_status USING GIST (current_geog)
  WHERE is_online = true AND current_geog IS NOT NULL;

-- Add coordinate validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'rides_driver_status_valid_coords'
  ) THEN
    ALTER TABLE rides_driver_status
      ADD CONSTRAINT rides_driver_status_valid_coords 
      CHECK (
        (current_lat IS NULL AND current_lng IS NULL) OR
        (current_lat BETWEEN -90 AND 90 AND current_lng BETWEEN -180 AND 180)
      );
  END IF;
END $$;

-- Add RLS policies
ALTER TABLE rides_driver_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rides_driver_status_owner_rw" ON rides_driver_status;
DROP POLICY IF EXISTS "rides_driver_status_owner_rw" ON rides_driver_status;
CREATE POLICY "rides_driver_status_owner_rw"
  ON rides_driver_status
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rides_driver_status_public_read_online" ON rides_driver_status;
DROP POLICY IF EXISTS "rides_driver_status_public_read_online" ON rides_driver_status;
CREATE POLICY "rides_driver_status_public_read_online"
  ON rides_driver_status
  FOR SELECT
  USING (is_online = true);

DROP POLICY IF EXISTS "rides_driver_status_service_role_all" ON rides_driver_status;
DROP POLICY IF EXISTS "rides_driver_status_service_role_all" ON rides_driver_status;
CREATE POLICY "rides_driver_status_service_role_all"
  ON rides_driver_status
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION rides_driver_status_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_seen_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rides_driver_status_updated_at ON rides_driver_status;
CREATE TRIGGER trg_rides_driver_status_updated_at
  BEFORE UPDATE ON rides_driver_status
  FOR EACH ROW
  EXECUTE FUNCTION rides_driver_status_set_updated_at();

COMMENT ON TABLE rides_driver_status IS 'Real-time driver online status and location';
COMMENT ON COLUMN rides_driver_status.current_geog IS 'Generated geography point for spatial queries';

-- ============================================================================
-- 4. CREATE HELPER VIEWS
-- ============================================================================

-- Active drivers with recent location
DROP VIEW IF EXISTS active_drivers_with_location;
CREATE OR REPLACE VIEW active_drivers_with_location AS
SELECT 
  ds.user_id,
  ds.is_online,
  ds.current_lat,
  ds.current_lng,
  ds.current_geog,
  ds.last_seen_at,
  ds.metadata,
  p.phone_number,
  p.display_name,
  p.vehicle_type,
  p.vehicle_plate
FROM rides_driver_status ds
JOIN profiles p ON p.user_id = ds.user_id
WHERE ds.is_online = true
  AND ds.last_seen_at > now() - interval '10 minutes'
  AND ds.current_geog IS NOT NULL;

COMMENT ON VIEW active_drivers_with_location IS 'Active drivers with location updated in last 10 minutes';

-- Pending ride requests with trip details
DROP VIEW IF EXISTS pending_ride_requests_with_trips;
CREATE OR REPLACE VIEW pending_ride_requests_with_trips AS
SELECT 
  rr.id as request_id,
  rr.trip_id,
  rr.passenger_id,
  rr.driver_id,
  rr.status as request_status,
  rr.created_at as request_created_at,
  rr.notified_at,
  t.kind as trip_kind,
  t.role as trip_role,
  t.vehicle_type,
  t.pickup_lat,
  t.pickup_lng,
  t.pickup_text,
  t.scheduled_for,
  t.status as trip_status
FROM ride_requests rr
JOIN trips t ON t.id = rr.trip_id
WHERE rr.status = 'pending';

COMMENT ON VIEW pending_ride_requests_with_trips IS 'Pending ride requests joined with trip details';

COMMIT;
