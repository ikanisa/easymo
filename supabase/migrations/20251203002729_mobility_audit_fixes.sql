-- Migration: Mobility Audit Fixes
-- Date: 2025-12-03
-- Description: Add database indexes, phone columns, and recurring_trips table

-- ============================================================================
-- PART 1: Add Performance Indexes to mobility_matches
-- ============================================================================

-- Index for driver queries filtered by status
CREATE INDEX IF NOT EXISTS idx_mobility_matches_driver_status 
  ON mobility_matches(driver_id, status);

-- Index for passenger queries filtered by status
CREATE INDEX IF NOT EXISTS idx_mobility_matches_passenger_status 
  ON mobility_matches(passenger_id, status);

-- Index for active trip queries (most common statuses)
CREATE INDEX IF NOT EXISTS idx_mobility_matches_active_status 
  ON mobility_matches(status) 
  WHERE status IN ('pending', 'accepted', 'driver_arrived', 'in_progress');

-- Index for recent trips (ordered by creation date)
CREATE INDEX IF NOT EXISTS idx_mobility_matches_created 
  ON mobility_matches(created_at DESC);

-- ============================================================================
-- PART 2: Add Phone Number Columns to mobility_matches
-- ============================================================================

-- Add driver phone column (for payment notifications)
ALTER TABLE mobility_matches 
  ADD COLUMN IF NOT EXISTS driver_phone TEXT;

-- Add passenger phone column (for payment notifications)
ALTER TABLE mobility_matches 
  ADD COLUMN IF NOT EXISTS passenger_phone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN mobility_matches.driver_phone IS 'Driver WhatsApp/phone number for payment notifications';
COMMENT ON COLUMN mobility_matches.passenger_phone IS 'Passenger WhatsApp/phone number for payment notifications';

-- ============================================================================
-- PART 3: Create recurring_trips Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_trips (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Trip details
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type TEXT NOT NULL,
  
  -- Location references (saved locations)
  origin_favorite_id UUID REFERENCES saved_locations(id) ON DELETE CASCADE,
  dest_favorite_id UUID REFERENCES saved_locations(id) ON DELETE CASCADE,
  
  -- Schedule details
  travel_time TIME NOT NULL,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('daily', 'weekdays', 'weekends')),
  timezone TEXT DEFAULT 'Africa/Kigali',
  
  -- Search parameters
  radius_km INTEGER DEFAULT 10,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for recurring_trips
CREATE INDEX IF NOT EXISTS idx_recurring_trips_user 
  ON recurring_trips(user_id, active);

CREATE INDEX IF NOT EXISTS idx_recurring_trips_schedule 
  ON recurring_trips(travel_time, active) 
  WHERE active = TRUE;

-- Add comments for documentation
COMMENT ON TABLE recurring_trips IS 'Stores recurring trip schedules for drivers and passengers';
COMMENT ON COLUMN recurring_trips.role IS 'Whether this is a driver or passenger recurring trip';
COMMENT ON COLUMN recurring_trips.recurrence IS 'Frequency: daily, weekdays (Mon-Fri), or weekends (Sat-Sun)';
COMMENT ON COLUMN recurring_trips.last_triggered_at IS 'Last time this recurring trip was processed by the scheduler';

-- ============================================================================
-- PART 4: Create manual_reviews Table (for OCR fallback)
-- ============================================================================

CREATE TABLE IF NOT EXISTS manual_reviews (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Review details
  review_type TEXT NOT NULL CHECK (review_type IN ('driver_license', 'insurance_certificate', 'vehicle_inspection')),
  media_id TEXT NOT NULL,
  media_url TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Review metadata
  reviewed_by UUID REFERENCES profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for manual_reviews
CREATE INDEX IF NOT EXISTS idx_manual_reviews_user 
  ON manual_reviews(user_id, status);

CREATE INDEX IF NOT EXISTS idx_manual_reviews_pending 
  ON manual_reviews(created_at DESC) 
  WHERE status = 'pending';

-- Add comments
COMMENT ON TABLE manual_reviews IS 'Manual review queue for documents that failed OCR processing';
COMMENT ON COLUMN manual_reviews.review_type IS 'Type of document being reviewed';
COMMENT ON COLUMN manual_reviews.media_id IS 'WhatsApp media ID for the uploaded document';

-- ============================================================================
-- PART 5: Add Updated Trigger for recurring_trips
-- ============================================================================

CREATE OR REPLACE FUNCTION update_recurring_trips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recurring_trips_updated_at
  BEFORE UPDATE ON recurring_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_trips_updated_at();

-- ============================================================================
-- PART 6: Add RPC Functions for recurring_trips
-- ============================================================================

-- Function to find due recurring trips
CREATE OR REPLACE FUNCTION find_due_recurring_trips(
  _window_minutes INTEGER DEFAULT 5,
  _now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role TEXT,
  vehicle_type TEXT,
  origin_favorite_id UUID,
  dest_favorite_id UUID,
  travel_time TIME,
  recurrence TEXT,
  timezone TEXT,
  radius_km INTEGER
) AS $$
DECLARE
  _current_time TIME;
  _current_day INTEGER; -- 0=Sunday, 1=Monday, ..., 6=Saturday
BEGIN
  -- Get current time and day of week in the default timezone
  _current_time := (_now AT TIME ZONE 'Africa/Kigali')::TIME;
  _current_day := EXTRACT(DOW FROM (_now AT TIME ZONE 'Africa/Kigali'));
  
  RETURN QUERY
  SELECT 
    rt.id,
    rt.user_id,
    rt.role,
    rt.vehicle_type,
    rt.origin_favorite_id,
    rt.dest_favorite_id,
    rt.travel_time,
    rt.recurrence,
    rt.timezone,
    rt.radius_km
  FROM recurring_trips rt
  WHERE rt.active = TRUE
    -- Time window check (within _window_minutes of travel_time)
    AND rt.travel_time BETWEEN 
      (_current_time - (_window_minutes || ' minutes')::INTERVAL) 
      AND (_current_time + (_window_minutes || ' minutes')::INTERVAL)
    -- Recurrence check
    AND (
      rt.recurrence = 'daily'
      OR (rt.recurrence = 'weekdays' AND _current_day BETWEEN 1 AND 5)
      OR (rt.recurrence = 'weekends' AND _current_day IN (0, 6))
    )
    -- Not triggered recently (within last hour)
    AND (
      rt.last_triggered_at IS NULL 
      OR rt.last_triggered_at < (_now - INTERVAL '1 hour')
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to record recurring trip trigger
CREATE OR REPLACE FUNCTION record_recurring_trip_trigger(
  _trip_id UUID,
  _triggered_at TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  UPDATE recurring_trips
  SET last_triggered_at = _triggered_at,
      updated_at = NOW()
  WHERE id = _trip_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 7: Grant Permissions
-- ============================================================================

-- Grant access to service role
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_trips TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON manual_reviews TO service_role;
GRANT EXECUTE ON FUNCTION find_due_recurring_trips TO service_role;
GRANT EXECUTE ON FUNCTION record_recurring_trip_trigger TO service_role;

-- Grant read access to authenticated users for their own data
GRANT SELECT ON recurring_trips TO authenticated;
GRANT SELECT ON manual_reviews TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
