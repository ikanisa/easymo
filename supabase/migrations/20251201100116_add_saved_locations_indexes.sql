-- Add missing indexes for saved_locations performance
-- Part of Phase 2 UX improvements

BEGIN;

-- Fast label lookup for saved locations
CREATE INDEX IF NOT EXISTS idx_saved_locations_label 
ON saved_locations(user_id, label);

-- Fast default location lookup
CREATE INDEX IF NOT EXISTS idx_saved_locations_default 
ON saved_locations(user_id) 
WHERE is_default = true;

-- Recent locations for listing
CREATE INDEX IF NOT EXISTS idx_saved_locations_recent 
ON saved_locations(user_id, created_at DESC);

-- Add coordinate validation constraints
ALTER TABLE saved_locations
  DROP CONSTRAINT IF EXISTS check_lat_valid,
  DROP CONSTRAINT IF EXISTS check_lng_valid;

ALTER TABLE saved_locations
  ADD CONSTRAINT check_lat_valid CHECK (lat >= -90 AND lat <= 90),
  ADD CONSTRAINT check_lng_valid CHECK (lng >= -180 AND lng <= 180);

-- Add helpful comments
COMMENT ON INDEX idx_saved_locations_label IS 'Fast lookup of saved locations by label (home, work, etc)';
COMMENT ON INDEX idx_saved_locations_default IS 'Quickly find user default location';
COMMENT ON INDEX idx_saved_locations_recent IS 'List locations by most recently created';
COMMENT ON CONSTRAINT check_lat_valid ON saved_locations IS 'Ensure latitude is in valid range';
COMMENT ON CONSTRAINT check_lng_valid ON saved_locations IS 'Ensure longitude is in valid range';

COMMIT;
