-- ============================================================================
-- FIX LOCATION CACHING: Create Missing RPC Functions + saved_locations Table
-- ============================================================================
-- Migration: 20251209180000_fix_location_caching_functions.sql
-- Date: 2025-12-09
-- 
-- PROBLEM:
-- - Code references non-existent RPC functions (update_user_location_cache, get_cached_location)
-- - Code references non-existent user_location_cache table
-- - No saved_locations table for persistent favorites (home, work, etc.)
-- - recent_locations table exists but lacks helper functions
--
-- SOLUTION:
-- 1. Create RPC functions to replace non-existent ones
-- 2. Create saved_locations table for persistent favorites
-- 3. Add indexes and RLS policies
-- ============================================================================

BEGIN;

-- ============================================================================
-- CREATE TABLES
-- ============================================================================

-- Recent locations table (30-minute cache)
CREATE TABLE IF NOT EXISTS public.recent_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  geog geography(Point, 4326),
  source text, -- 'mobility', 'jobs', 'property', etc.
  context jsonb DEFAULT '{}',
  captured_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT recent_locations_valid_coords CHECK (lat >= -90 AND lat <= 90 AND lng >= -180 AND lng <= 180)
);

-- Indexes for recent_locations
CREATE INDEX IF NOT EXISTS idx_recent_locations_user ON public.recent_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_locations_expires ON public.recent_locations(expires_at);
CREATE INDEX IF NOT EXISTS idx_recent_locations_user_expires ON public.recent_locations(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_recent_locations_geog ON public.recent_locations USING GIST(geog);
CREATE INDEX IF NOT EXISTS idx_recent_locations_source ON public.recent_locations(user_id, source);

-- RLS for recent_locations
ALTER TABLE public.recent_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY recent_locations_user_select ON public.recent_locations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY recent_locations_user_insert ON public.recent_locations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY recent_locations_user_delete ON public.recent_locations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY recent_locations_service_all ON public.recent_locations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON public.recent_locations TO authenticated;
GRANT ALL ON public.recent_locations TO service_role;

-- ============================================================================
-- HELPER RPC FUNCTIONS
-- ============================================================================

-- Drop existing functions that may have different signatures
DROP FUNCTION IF EXISTS public.save_recent_location(uuid, numeric, numeric, text, jsonb, integer);
DROP FUNCTION IF EXISTS public.get_recent_location(uuid, text, integer);
DROP FUNCTION IF EXISTS public.has_recent_location(uuid, integer);
DROP FUNCTION IF EXISTS public.update_user_location_cache(uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.get_cached_location(uuid, integer);
DROP FUNCTION IF EXISTS public.save_favorite_location(uuid, text, numeric, numeric, text, text);
DROP FUNCTION IF EXISTS public.get_saved_location(uuid, text);
DROP FUNCTION IF EXISTS public.list_saved_locations(uuid);

-- Save user's recent location with 30-minute TTL
CREATE OR REPLACE FUNCTION public.save_recent_location(
  _user_id uuid,
  _lat numeric,
  _lng numeric,
  _source text DEFAULT NULL,
  _context jsonb DEFAULT '{}',
  _ttl_minutes integer DEFAULT 30
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id uuid;
BEGIN
  -- Validate coordinates
  IF _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates: lat must be [-90,90], lng must be [-180,180]';
  END IF;

  -- Insert location with TTL
  INSERT INTO public.recent_locations (
    user_id,
    lat,
    lng,
    geog,
    source,
    context,
    expires_at
  ) VALUES (
    _user_id,
    _lat,
    _lng,
    ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography,
    _source,
    _context,
    now() + (_ttl_minutes || ' minutes')::interval
  ) RETURNING id INTO v_location_id;

  RETURN v_location_id;
END;
$$;

-- Get user's most recent valid location
CREATE OR REPLACE FUNCTION public.get_recent_location(
  _user_id uuid,
  _source text DEFAULT NULL,
  _max_age_minutes integer DEFAULT 30
) RETURNS TABLE(
  lat numeric,
  lng numeric,
  source text,
  captured_at timestamptz,
  age_minutes integer,
  is_valid boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rl.lat,
    rl.lng,
    rl.source,
    rl.captured_at,
    EXTRACT(EPOCH FROM (now() - rl.captured_at))::integer / 60 AS age_minutes,
    (rl.expires_at > now() AND EXTRACT(EPOCH FROM (now() - rl.captured_at)) / 60 <= _max_age_minutes) AS is_valid
  FROM public.recent_locations rl
  WHERE rl.user_id = _user_id
    AND rl.expires_at > now()
    AND (_source IS NULL OR rl.source = _source)
  ORDER BY rl.captured_at DESC
  LIMIT 1;
END;
$$;

-- Check if user has any recent valid location
CREATE OR REPLACE FUNCTION public.has_recent_location(
  _user_id uuid,
  _max_age_minutes integer DEFAULT 30
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.recent_locations
    WHERE user_id = _user_id
      AND expires_at > now()
      AND EXTRACT(EPOCH FROM (now() - captured_at)) / 60 <= _max_age_minutes
  );
$$;

-- Backward compatibility: Alias for existing code
CREATE OR REPLACE FUNCTION public.update_user_location_cache(
  _user_id uuid,
  _lat numeric,
  _lng numeric
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT save_recent_location(_user_id, _lat, _lng, 'cache', '{}'::jsonb, 30)::text;
$$;

-- Backward compatibility: Get cached location
CREATE OR REPLACE FUNCTION public.get_cached_location(
  _user_id uuid,
  _cache_minutes integer DEFAULT 30
) RETURNS TABLE(
  lat numeric,
  lng numeric,
  cached_at timestamptz,
  is_valid boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rl.lat,
    rl.lng,
    rl.captured_at AS cached_at,
    (rl.expires_at > now()) AS is_valid
  FROM public.recent_locations rl
  WHERE rl.user_id = _user_id
    AND rl.expires_at > now()
    AND EXTRACT(EPOCH FROM (now() - rl.captured_at)) / 60 <= _cache_minutes
  ORDER BY rl.captured_at DESC
  LIMIT 1;
END;
$$;

-- ============================================================================
-- SAVED LOCATIONS TABLE (Persistent Favorites)
-- ============================================================================

-- Check if saved_locations needs geog column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_locations' 
    AND column_name = 'geog'
  ) THEN
    -- Add geog column if it doesn't exist
    ALTER TABLE public.saved_locations ADD COLUMN IF NOT EXISTS geog geography(Point, 4326);
    
    -- Populate geog from lat/lng if data exists
    UPDATE public.saved_locations 
    SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography 
    WHERE geog IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;
  END IF;
END $$;

-- Ensure saved_locations supports mobility kind usage (home/work/school/other)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'saved_locations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'saved_locations' AND column_name = 'kind'
  ) THEN
    ALTER TABLE public.saved_locations ADD COLUMN kind text;
    UPDATE public.saved_locations
    SET kind = CASE
      WHEN lower(COALESCE(label, '')) IN ('home', 'work', 'school', 'other') THEN lower(label)
      ELSE 'other'
    END
    WHERE kind IS NULL;
    ALTER TABLE public.saved_locations ALTER COLUMN kind SET DEFAULT 'other';
    ALTER TABLE public.saved_locations ALTER COLUMN kind SET NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other',
  label text NOT NULL, -- 'home', 'work', 'gym', 'favorite_restaurant', etc.
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  geog geography(Point, 4326),
  address text,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_locations_user_kind_unique UNIQUE(user_id, kind),
  CONSTRAINT saved_locations_user_label_unique UNIQUE(user_id, label),
  CONSTRAINT saved_locations_valid_coords CHECK (lat >= -90 AND lat <= 90 AND lng >= -180 AND lng <= 180)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON public.saved_locations(user_id);

-- Only create geog index if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_locations' 
    AND column_name = 'geog'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_saved_locations_geog ON public.saved_locations USING GIST(geog);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_locations_label ON public.saved_locations(user_id, label);

-- Add unique constraint on (user_id, kind) when safe (avoids duplicate favorites per type)
DO $$
DECLARE
  v_has_duplicates boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'saved_locations'
  ) THEN
    SELECT EXISTS (
      SELECT 1 FROM (
        SELECT user_id, kind, COUNT(*) AS c
        FROM public.saved_locations
        GROUP BY user_id, kind
        HAVING COUNT(*) > 1
      ) dup
    ) INTO v_has_duplicates;

    IF v_has_duplicates THEN
      RAISE NOTICE 'Skipped adding saved_locations_user_kind_unique due to existing duplicates';
      IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'idx_saved_locations_kind'
          AND relkind = 'i'
      ) THEN
        CREATE INDEX idx_saved_locations_kind ON public.saved_locations(user_id, kind);
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'saved_locations_user_kind_unique'
        AND conrelid = 'public.saved_locations'::regclass
    ) THEN
      ALTER TABLE public.saved_locations
      ADD CONSTRAINT saved_locations_user_kind_unique UNIQUE(user_id, kind);
    END IF;
  END IF;
END $$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_saved_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_saved_location_timestamp ON public.saved_locations;
CREATE TRIGGER trigger_update_saved_location_timestamp
  BEFORE UPDATE ON public.saved_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_saved_location_timestamp();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS saved_locations_user_select ON public.saved_locations;
DROP POLICY IF EXISTS saved_locations_user_insert ON public.saved_locations;
DROP POLICY IF EXISTS saved_locations_user_update ON public.saved_locations;
DROP POLICY IF EXISTS saved_locations_user_delete ON public.saved_locations;
DROP POLICY IF EXISTS saved_locations_service_all ON public.saved_locations;

-- Users can manage their own saved locations
CREATE POLICY saved_locations_user_select ON public.saved_locations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY saved_locations_user_insert ON public.saved_locations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_locations_user_update ON public.saved_locations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_locations_user_delete ON public.saved_locations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY saved_locations_service_all ON public.saved_locations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_locations TO authenticated;
GRANT ALL ON public.saved_locations TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS FOR SAVED LOCATIONS
-- ============================================================================

-- Save or update a favorite location
CREATE OR REPLACE FUNCTION public.save_favorite_location(
  _user_id uuid,
  _label text,
  _lat numeric,
  _lng numeric,
  _address text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id uuid;
  v_has_notes boolean;
  v_has_geog boolean;
  v_has_kind boolean;
  v_kind text;
BEGIN
  -- Validate coordinates
  IF _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates: lat must be [-90,90], lng must be [-180,180]';
  END IF;

  -- Check which columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'saved_locations' AND column_name = 'notes'
  ) INTO v_has_notes;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'saved_locations' AND column_name = 'geog'
  ) INTO v_has_geog;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'saved_locations' AND column_name = 'kind'
  ) INTO v_has_kind;

  v_kind := CASE
    WHEN lower(COALESCE(_label, '')) IN ('home', 'work', 'school', 'other') THEN lower(_label)
    ELSE 'other'
  END;

  -- Upsert saved location with dynamic columns
  IF v_has_notes AND v_has_geog THEN
    IF v_has_kind THEN
      INSERT INTO public.saved_locations (user_id, kind, label, lat, lng, geog, address, notes)
      VALUES (_user_id, v_kind, _label, _lat, _lng, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _address, _notes)
      ON CONFLICT (user_id, kind)
      DO UPDATE SET label = EXCLUDED.label, lat = EXCLUDED.lat, lng = EXCLUDED.lng, geog = EXCLUDED.geog, address = EXCLUDED.address, notes = EXCLUDED.notes, updated_at = now()
      RETURNING id INTO v_location_id;
    ELSE
      INSERT INTO public.saved_locations (user_id, label, lat, lng, geog, address, notes)
      VALUES (_user_id, _label, _lat, _lng, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _address, _notes)
      ON CONFLICT (user_id, label)
      DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, geog = EXCLUDED.geog, address = EXCLUDED.address, notes = EXCLUDED.notes, updated_at = now()
      RETURNING id INTO v_location_id;
    END IF;
  ELSIF v_has_geog THEN
    IF v_has_kind THEN
      INSERT INTO public.saved_locations (user_id, kind, label, lat, lng, geog, address)
      VALUES (_user_id, v_kind, _label, _lat, _lng, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _address)
      ON CONFLICT (user_id, kind)
      DO UPDATE SET label = EXCLUDED.label, lat = EXCLUDED.lat, lng = EXCLUDED.lng, geog = EXCLUDED.geog, address = EXCLUDED.address, updated_at = now()
      RETURNING id INTO v_location_id;
    ELSE
      INSERT INTO public.saved_locations (user_id, label, lat, lng, geog, address)
      VALUES (_user_id, _label, _lat, _lng, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _address)
      ON CONFLICT (user_id, label)
      DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, geog = EXCLUDED.geog, address = EXCLUDED.address, updated_at = now()
      RETURNING id INTO v_location_id;
    END IF;
  ELSE
    IF v_has_kind THEN
      INSERT INTO public.saved_locations (user_id, kind, label, lat, lng, address)
      VALUES (_user_id, v_kind, _label, _lat, _lng, _address)
      ON CONFLICT (user_id, kind)
      DO UPDATE SET label = EXCLUDED.label, lat = EXCLUDED.lat, lng = EXCLUDED.lng, address = EXCLUDED.address, updated_at = now()
      RETURNING id INTO v_location_id;
    ELSE
      INSERT INTO public.saved_locations (user_id, label, lat, lng, address)
      VALUES (_user_id, _label, _lat, _lng, _address)
      ON CONFLICT (user_id, label)
      DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, address = EXCLUDED.address, updated_at = now()
      RETURNING id INTO v_location_id;
    END IF;
  END IF;

  RETURN v_location_id;
END;
$$;

-- Get saved location by label
CREATE OR REPLACE FUNCTION public.get_saved_location(
  _user_id uuid,
  _label text
) RETURNS TABLE(
  id uuid,
  label text,
  lat numeric,
  lng numeric,
  address text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, label, lat, lng, address, created_at, updated_at
  FROM public.saved_locations
  WHERE user_id = _user_id AND label = _label;
$$;

-- List all saved locations for user
CREATE OR REPLACE FUNCTION public.list_saved_locations(
  _user_id uuid
) RETURNS TABLE(
  id uuid,
  label text,
  lat numeric,
  lng numeric,
  address text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, label, lat, lng, address, created_at, updated_at
  FROM public.saved_locations
  WHERE user_id = _user_id
  ORDER BY created_at DESC;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'LOCATION CACHING FUNCTIONS CREATED';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'RPC Functions:';
  RAISE NOTICE '  - save_recent_location()';
  RAISE NOTICE '  - get_recent_location()';
  RAISE NOTICE '  - has_recent_location()';
  RAISE NOTICE '  - update_user_location_cache() [backward compat]';
  RAISE NOTICE '  - get_cached_location() [backward compat]';
  RAISE NOTICE '  - save_favorite_location()';
  RAISE NOTICE '  - get_saved_location()';
  RAISE NOTICE '  - list_saved_locations()';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables:';
  RAISE NOTICE '  - saved_locations (NEW)';
  RAISE NOTICE '  - recent_locations (existing, now with helper functions)';
  RAISE NOTICE '====================================================================';
END $$;

COMMIT;
