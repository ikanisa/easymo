-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Location Schema Reconciliation
-- Purpose: Ensure canonical location tables exist without conflicts
-- Author: GitHub Copilot
-- Date: 2025-12-09
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 1: Verify and enhance saved_locations (canonical favorites)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    -- Add geog column if missing (for proximity queries)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app'
        AND table_name = 'saved_locations'
        AND column_name = 'geog'
    ) THEN
        ALTER TABLE app.saved_locations
        ADD COLUMN geog GEOGRAPHY(POINT, 4326)
        GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED;
        
        CREATE INDEX idx_saved_locations_geog 
        ON app.saved_locations USING GIST(geog);
        
        RAISE NOTICE 'Added geog column to saved_locations';
    END IF;
    
    -- Add kind column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app'
        AND table_name = 'saved_locations'
        AND column_name = 'kind'
    ) THEN
        ALTER TABLE app.saved_locations
        ADD COLUMN kind TEXT NOT NULL DEFAULT 'other'
        CHECK (kind IN ('home', 'work', 'school', 'other'));
        
        RAISE NOTICE 'Added kind column to saved_locations';
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 2: Create recent_locations (canonical cache with TTL)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app.recent_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL CHECK (lat >= -90 AND lat <= 90),
    lng DOUBLE PRECISION NOT NULL CHECK (lng >= -180 AND lng <= 180),
    address TEXT,
    source TEXT DEFAULT 'whatsapp',
    context JSONB,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    geog GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) STORED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recent_locations_user_captured 
ON app.recent_locations(user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_recent_locations_geog 
ON app.recent_locations USING GIST(geog);

CREATE INDEX IF NOT EXISTS idx_recent_locations_expires 
ON app.recent_locations(expires_at) 
WHERE expires_at > NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 3: RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE app.recent_locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'recent_locations' 
        AND policyname = 'Users can manage own recent locations'
    ) THEN
        CREATE POLICY "Users can manage own recent locations"
        ON app.recent_locations
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 4: Helper RPCs for Recent Locations (Cache)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app.save_recent_location(
    _user_id UUID,
    _lat DOUBLE PRECISION,
    _lng DOUBLE PRECISION,
    _source TEXT DEFAULT 'whatsapp',
    _context JSONB DEFAULT NULL,
    _ttl_minutes INTEGER DEFAULT 30
)
RETURNS app.recent_locations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
DECLARE
    result app.recent_locations;
BEGIN
    -- Delete existing recent locations for this user and source
    DELETE FROM app.recent_locations 
    WHERE user_id = _user_id AND source = _source;
    
    -- Insert new location
    INSERT INTO app.recent_locations (
        user_id, lat, lng, source, context, expires_at
    ) VALUES (
        _user_id, _lat, _lng, _source, _context,
        NOW() + (_ttl_minutes || ' minutes')::INTERVAL
    )
    RETURNING * INTO result;
    
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_recent_location(
    _user_id UUID,
    _source TEXT DEFAULT NULL,
    _max_age_minutes INTEGER DEFAULT NULL
)
RETURNS app.recent_locations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
DECLARE
    result app.recent_locations;
    cutoff_time TIMESTAMPTZ;
BEGIN
    -- Calculate cutoff time if max_age specified
    IF _max_age_minutes IS NOT NULL THEN
        cutoff_time := NOW() - (_max_age_minutes || ' minutes')::INTERVAL;
    ELSE
        cutoff_time := '1970-01-01'::TIMESTAMPTZ; -- far past
    END IF;
    
    SELECT * INTO result
    FROM app.recent_locations
    WHERE user_id = _user_id
    AND expires_at > NOW()
    AND created_at >= cutoff_time
    AND (_source IS NULL OR source = _source)
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION app.has_recent_location(
    _user_id UUID,
    _max_age_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
DECLARE
    cutoff_time TIMESTAMPTZ;
BEGIN
    IF _max_age_minutes IS NOT NULL THEN
        cutoff_time := NOW() - (_max_age_minutes || ' minutes')::INTERVAL;
    ELSE
        cutoff_time := '1970-01-01'::TIMESTAMPTZ;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM app.recent_locations
        WHERE user_id = _user_id
        AND expires_at > NOW()
        AND created_at >= cutoff_time
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 5: Helper RPCs for Saved Locations (Favorites)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app.save_favorite_location(
    _user_id UUID,
    _kind TEXT,
    _lat DOUBLE PRECISION,
    _lng DOUBLE PRECISION,
    _address TEXT DEFAULT NULL,
    _label TEXT DEFAULT NULL
)
RETURNS SETOF app.saved_locations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO app.saved_locations (
        user_id, lat, lng, address, kind, label
    ) VALUES (
        _user_id, _lat, _lng, _address, _kind, _label
    )
    ON CONFLICT (user_id, kind)
    DO UPDATE SET
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        address = EXCLUDED.address,
        label = EXCLUDED.label,
        updated_at = NOW()
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_saved_location(
    _user_id UUID,
    _kind TEXT DEFAULT 'home'
)
RETURNS SETOF app.saved_locations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM app.saved_locations
    WHERE user_id = _user_id
    AND kind = _kind
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION app.list_saved_locations(_user_id UUID)
RETURNS SETOF app.saved_locations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM app.saved_locations
    WHERE user_id = _user_id
    ORDER BY kind, created_at DESC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Step 6: Cleanup function for expired cache entries
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app.cleanup_expired_locations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, pg_temp
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app.recent_locations
    WHERE expires_at <= NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMIT;
