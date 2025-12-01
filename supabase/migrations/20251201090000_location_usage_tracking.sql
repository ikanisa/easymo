-- Phase 3.2: Location Usage Tracking
-- Track how often locations are used for smart sorting and suggestions

BEGIN;

-- Add usage tracking columns
ALTER TABLE saved_locations 
  ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- Create index for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_saved_locations_usage 
  ON saved_locations(user_id, usage_count DESC NULLS LAST, last_used_at DESC NULLS LAST);

-- Function to increment location usage
CREATE OR REPLACE FUNCTION increment_location_usage(
  _location_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE saved_locations
  SET 
    usage_count = COALESCE(usage_count, 0) + 1,
    last_used_at = now()
  WHERE id = _location_id;
END;
$$;

-- Comment
COMMENT ON FUNCTION increment_location_usage IS 
'Increments usage counter and updates last_used_at timestamp for location analytics and smart suggestions';

COMMIT;
