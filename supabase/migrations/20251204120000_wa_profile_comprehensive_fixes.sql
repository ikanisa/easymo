-- Comprehensive fixes for wa-webhook-profile database schema
-- Addresses: QA Report Issues 2.1-2.5
-- Date: 2025-12-04

BEGIN;

-- ============================================================================
-- FIX #1: Add saved_locations indexes for performance (Issue 2.1)
-- ============================================================================

-- Spatial index for proximity searches
DROP INDEX IF EXISTS idx_saved_locations_coords_gist_test;
CREATE INDEX IF NOT EXISTS idx_saved_locations_coords_gist 
  ON public.saved_locations USING GIST (
    geography(ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326))
  );

-- User + label lookup index
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_label 
  ON public.saved_locations(user_id, label);

-- Add updated_at for cache invalidation tracking
ALTER TABLE public.saved_locations 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_saved_locations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_saved_locations_timestamp ON public.saved_locations;
CREATE TRIGGER tr_saved_locations_timestamp
BEFORE UPDATE ON public.saved_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_saved_locations_timestamp();

COMMENT ON INDEX idx_saved_locations_coords_gist IS 
  'Spatial index for efficient proximity searches on saved locations';

-- ============================================================================
-- FIX #2: Profile auto-creation race condition (Issue 2.2)
-- ============================================================================

-- Add unique constraint on phone_number if not exists
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT phone_number
    FROM public.profiles
    WHERE phone_number IS NOT NULL
    GROUP BY phone_number
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE NOTICE 'Skipping profiles_phone_number_unique constraint because % duplicate phone_number values exist.', dup_count;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_phone_number_unique'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_phone_number_unique UNIQUE (phone_number);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_phone_number_unique'
  ) THEN
    COMMENT ON CONSTRAINT profiles_phone_number_unique ON public.profiles IS
      'Prevents duplicate profiles from concurrent webhook requests';
  END IF;
END $$;

-- ============================================================================
-- FIX #3: Auto-initialize wallet_balance (Issue 2.3)
-- ============================================================================

DO $wallet$
BEGIN
  IF to_regclass('public.wallet_balance') IS NULL THEN
    RAISE NOTICE 'Skipping wallet initialization: public.wallet_balance is missing.';
    RETURN;
  END IF;

  -- Function to initialize wallet for new users
  CREATE OR REPLACE FUNCTION public.init_user_wallet()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.wallet_balance (user_id, balance, currency)
    VALUES (NEW.user_id, 0, 'RWF')
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Trigger to auto-create wallet on profile creation
  DROP TRIGGER IF EXISTS tr_init_wallet_on_profile ON public.profiles;
  CREATE TRIGGER tr_init_wallet_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.init_user_wallet();

  COMMENT ON FUNCTION public.init_user_wallet IS
    'Auto-creates wallet_balance row when new profile is created';

  -- Backfill existing profiles without wallets
  INSERT INTO public.wallet_balance (user_id, balance, currency)
  SELECT user_id, 0, 'RWF'
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.wallet_balance wb WHERE wb.user_id = p.user_id
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$wallet$;

-- ============================================================================
-- FIX #4: Add RLS policies for businesses/jobs/properties (Issue 2.4)
-- ============================================================================

-- Businesses RLS (skip when schema differs)
DO $$
BEGIN
  IF to_regclass('public.businesses') IS NULL THEN
    RAISE NOTICE 'Skipping businesses RLS: table public.businesses missing.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'owner_user_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'is_published'
  ) THEN
    RAISE NOTICE 'Skipping businesses RLS: expected columns owner_user_id/is_published not present.';
    RETURN;
  END IF;

  ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS businesses_owner_all ON public.businesses;
  CREATE POLICY businesses_owner_all 
    ON public.businesses 
    FOR ALL 
    USING (owner_user_id = auth.uid() OR owner_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid);

  DROP POLICY IF EXISTS businesses_public_read ON public.businesses;
  CREATE POLICY businesses_public_read 
    ON public.businesses 
    FOR SELECT 
    USING (is_published = true);

  COMMENT ON POLICY businesses_owner_all ON public.businesses IS
    'Owners can manage their businesses';
  COMMENT ON POLICY businesses_public_read ON public.businesses IS
    'Published businesses are publicly readable';
END $$;

-- Jobs RLS (skip because jobs is a view on this database)
DO $$
BEGIN
  IF to_regclass('public.jobs') IS NULL OR (
    SELECT relkind FROM pg_class c WHERE c.oid = to_regclass('public.jobs')
  ) <> 'r' THEN
    RAISE NOTICE 'Skipping jobs RLS: jobs is not a table on this database.';
    RETURN;
  END IF;
END $$;

-- Properties RLS (skip because properties is a view on this database)
DO $$
BEGIN
  IF to_regclass('public.properties') IS NULL OR (
    SELECT relkind FROM pg_class c WHERE c.oid = to_regclass('public.properties')
  ) <> 'r' THEN
    RAISE NOTICE 'Skipping properties RLS: properties is not a table on this database.';
    RETURN;
  END IF;
END $$;

-- ============================================================================
-- FIX #5: Location cache with TTL (Issue 2.5)
-- ============================================================================

-- Ensure user_location_cache exists with proper columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_location_cache') THEN
    CREATE TABLE IF NOT EXISTS public.user_location_cache (
      user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
      lat double precision NOT NULL,
      lng double precision NOT NULL,
      cached_at timestamptz DEFAULT now(),
      expires_at timestamptz DEFAULT (now() + interval '30 minutes'),
      CONSTRAINT user_location_cache_coords_check CHECK (
        lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180
      )
    );
  END IF;
END $$;

-- Add expires_at column if missing
ALTER TABLE public.user_location_cache
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 minutes');

-- Add cached_at column if missing
ALTER TABLE public.user_location_cache
ADD COLUMN IF NOT EXISTS cached_at timestamptz DEFAULT now();

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_location_cache_expires 
  ON public.user_location_cache(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Function to update location cache with automatic TTL
CREATE OR REPLACE FUNCTION public.update_user_location_cache(
  _user_id uuid,
  _lat double precision,
  _lng double precision
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_location_cache (user_id, lat, lng, cached_at, expires_at)
  VALUES (_user_id, _lat, _lng, now(), now() + interval '30 minutes')
  ON CONFLICT (user_id) 
  DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    cached_at = now(),
    expires_at = now() + interval '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_user_location_cache IS
  'Updates user location cache with 30-minute TTL';

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_stale_location_cache()
RETURNS integer AS $$
DECLARE
  cleaned integer;
BEGIN
  DELETE FROM public.user_location_cache WHERE expires_at < now();
  GET DIAGNOSTICS cleaned = ROW_COUNT;
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_stale_location_cache IS
  'Deletes expired location cache entries. Run via cron every hour.';

GRANT EXECUTE ON FUNCTION public.update_user_location_cache TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_location_cache TO service_role;

-- ============================================================================
-- FIX #6: Add performance indexes (Issue 5.2)
-- ============================================================================

-- Businesses indexes
DO $$
BEGIN
  IF to_regclass('public.businesses') IS NULL THEN
    RAISE NOTICE 'Skipping businesses indexes: table missing.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'owner_user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_businesses_owner_created 
      ON public.businesses(owner_user_id, created_at DESC)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_businesses_published 
      ON public.businesses(is_published, created_at DESC)
      WHERE deleted_at IS NULL AND is_published = true;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'profile_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_businesses_profile_created 
      ON public.businesses(profile_id, created_at DESC);
  ELSE
    RAISE NOTICE 'Skipping businesses indexes: no owner/profile column found.';
  END IF;
END $$;

-- Jobs indexes (jobs is a view here, so skip)
DO $$
BEGIN
  IF to_regclass('public.jobs') IS NULL OR (
    SELECT relkind FROM pg_class c WHERE c.oid = to_regclass('public.jobs')
  ) <> 'r' THEN
    RAISE NOTICE 'Skipping jobs indexes: jobs is not a table on this database.';
  END IF;
END $$;

-- Properties indexes (properties is a view here, so skip)
DO $$
BEGIN
  IF to_regclass('public.properties') IS NULL OR (
    SELECT relkind FROM pg_class c WHERE c.oid = to_regclass('public.properties')
  ) <> 'r' THEN
    RAISE NOTICE 'Skipping properties indexes: properties is not a table on this database.';
  END IF;
END $$;

-- Wallet balance index for quick lookups
DO $$
BEGIN
  IF to_regclass('public.wallet_balance') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_wallet_balance_user 
      ON public.wallet_balance(user_id);
  ELSE
    RAISE NOTICE 'Skipping idx_wallet_balance_user because public.wallet_balance is missing.';
  END IF;
END $$;

-- ============================================================================
-- FIX #7: Add validation constraints
-- ============================================================================

-- Saved locations label validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'saved_locations_label_check'
  ) THEN
    ALTER TABLE public.saved_locations
    ADD CONSTRAINT saved_locations_label_check 
      CHECK (label IN ('home', 'work', 'school', 'other'));
  END IF;
END $$;

-- Coordinate range validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'saved_locations_coords_check'
  ) THEN
    ALTER TABLE public.saved_locations
    ADD CONSTRAINT saved_locations_coords_check 
      CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);
  END IF;
END $$;

-- ============================================================================
-- FIX #8: Add helpful views for monitoring
-- ============================================================================
DO $profile_view$
BEGIN
  IF to_regclass('public.wallet_balance') IS NOT NULL THEN
    CREATE OR REPLACE VIEW public.active_profile_users AS
    SELECT 
      p.user_id,
      p.display_name,
      p.phone_number,
      p.language,
      wb.balance as wallet_balance,
      COUNT(DISTINCT sl.id) as saved_locations_count,
      COUNT(DISTINCT b.id) as businesses_count,
      0::bigint as jobs_count,
      0::bigint as properties_count,
      p.created_at as profile_created_at,
      MAX(GREATEST(
        COALESCE(sl.updated_at, sl.created_at),
        COALESCE(b.updated_at, b.created_at)
      )) as last_activity
    FROM public.profiles p
    LEFT JOIN public.wallet_balance wb ON wb.user_id = p.user_id
    LEFT JOIN public.saved_locations sl ON sl.user_id = p.user_id
    LEFT JOIN public.businesses b ON b.profile_id = p.user_id
    GROUP BY p.user_id, p.display_name, p.phone_number, p.language, wb.balance, p.created_at
    ORDER BY last_activity DESC NULLS LAST;
  ELSE
    CREATE OR REPLACE VIEW public.active_profile_users AS
    SELECT 
      p.user_id,
      p.display_name,
      p.phone_number,
      p.language,
      0::numeric as wallet_balance,
      COUNT(DISTINCT sl.id) as saved_locations_count,
      COUNT(DISTINCT b.id) as businesses_count,
      0::bigint as jobs_count,
      0::bigint as properties_count,
      p.created_at as profile_created_at,
      MAX(GREATEST(
        COALESCE(sl.updated_at, sl.created_at),
        COALESCE(b.updated_at, b.created_at)
      )) as last_activity
    FROM public.profiles p
    LEFT JOIN public.saved_locations sl ON sl.user_id = p.user_id
    LEFT JOIN public.businesses b ON b.profile_id = p.user_id
    GROUP BY p.user_id, p.display_name, p.phone_number, p.language, p.created_at
    ORDER BY last_activity DESC NULLS LAST;
  END IF;
END;
$profile_view$;

COMMENT ON VIEW public.active_profile_users IS
  'Profile overview for admin monitoring';

GRANT SELECT ON public.active_profile_users TO service_role, authenticated;

COMMIT;
