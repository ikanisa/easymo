-- Unify all saved location tables into single saved_locations table
-- Migrate data from user_favorites, user_saved_locations, rides_saved_locations
-- This is the P0/P1 critical fix for table fragmentation

BEGIN;

-- 1. Ensure saved_locations table has all necessary columns
ALTER TABLE saved_locations 
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Create index on kind for faster filtering
CREATE INDEX IF NOT EXISTS idx_saved_locations_kind ON saved_locations(kind);
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_kind ON saved_locations(user_id, kind);

-- 3. Migrate from user_favorites (PostGIS geog column) - if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_favorites') THEN
    INSERT INTO saved_locations (user_id, kind, label, address, lat, lng, created_at)
    SELECT 
      user_id,
      kind,
      label,
      address,
      ST_Y(geog::geometry) as lat,
      ST_X(geog::geometry) as lng,
      created_at
    FROM user_favorites
    WHERE NOT EXISTS (
      SELECT 1 FROM saved_locations sl 
      WHERE sl.user_id = user_favorites.user_id 
      AND sl.kind = user_favorites.kind
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 4. Migrate from user_saved_locations (NestJS service table) - if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_saved_locations') THEN
    INSERT INTO saved_locations (user_id, label, address, lat, lng, created_at)
    SELECT 
      user_id,
      label,
      address,
      latitude as lat,
      longitude as lng,
      COALESCE(created_at, now())
    FROM user_saved_locations
    WHERE user_id IS NOT NULL
      AND latitude IS NOT NULL 
      AND longitude IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 5. Migrate from rides_saved_locations - if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rides_saved_locations') THEN
    INSERT INTO saved_locations (user_id, label, address, lat, lng, created_at)
    SELECT 
      user_id,
      label,
      address_text as address,
      lat,
      lng,
      COALESCE(created_at, now())
    FROM rides_saved_locations
    WHERE user_id IS NOT NULL
      AND lat IS NOT NULL
      AND lng IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 6. Infer 'kind' from label for migrated rows that don't have it set
UPDATE saved_locations
SET kind = CASE
  WHEN kind IS NULL OR kind = 'other' THEN
    CASE
      WHEN LOWER(label) LIKE '%home%' OR LOWER(label) LIKE '%house%' THEN 'home'
      WHEN LOWER(label) LIKE '%work%' OR LOWER(label) LIKE '%office%' THEN 'work'
      WHEN LOWER(label) LIKE '%school%' OR LOWER(label) LIKE '%university%' OR LOWER(label) LIKE '%college%' THEN 'school'
      ELSE 'other'
    END
  ELSE kind
END
WHERE kind IS NULL OR kind = 'other';

-- 7. Add trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_saved_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS saved_locations_updated_at_trigger ON saved_locations;
CREATE TRIGGER saved_locations_updated_at_trigger
  BEFORE UPDATE ON saved_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_locations_updated_at();

-- 8. Create view for backward compatibility with user_favorites queries
CREATE OR REPLACE VIEW user_favorites AS
SELECT 
  id,
  user_id,
  kind,
  label,
  address,
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography as geog,
  created_at,
  updated_at
FROM saved_locations;

-- 9. Add comment documenting the migration
COMMENT ON TABLE saved_locations IS 
'Unified saved locations table. Replaces user_favorites, user_saved_locations, and rides_saved_locations. Migration completed 2025-12-01.';

COMMIT;
