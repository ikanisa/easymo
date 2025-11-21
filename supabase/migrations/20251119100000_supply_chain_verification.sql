BEGIN;

-- Ensure helper trigger exists for updated_at columns
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- Shared verification status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'verification_status'
  ) THEN
    CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
  END IF;
END;
$$;

-- Extend profiles with verification metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id_verification_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN id_verification_status public.verification_status NOT NULL DEFAULT 'unverified';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id_document_path'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN id_document_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id_document_uploaded_at'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN id_document_uploaded_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'momo_name_on_file'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN momo_name_on_file text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'momo_verified_name'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN momo_verified_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'momo_verification_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN momo_verification_status public.verification_status NOT NULL DEFAULT 'unverified';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'momo_name_match'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN momo_name_match boolean;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'verification_notes'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN verification_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'verification_reviewer_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN verification_reviewer_id uuid REFERENCES public.profiles(user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'verification_reviewed_at'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN verification_reviewed_at timestamptz;
  END IF;
END;
$$;

-- Storage buckets for verification artifacts and pickup photos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'verification-artifacts') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('verification-artifacts', 'verification-artifacts', false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'pickup-photos') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('pickup-photos', 'pickup-photos', false);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'verification_artifacts_secure_access'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY verification_artifacts_secure_access
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'verification-artifacts'
        AND (auth.role() = 'service_role' OR owner = auth.uid())
      )
      WITH CHECK (
        bucket_id = 'verification-artifacts'
        AND (auth.role() = 'service_role' OR owner = auth.uid())
      );
    $POLICY$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'pickup_photos_secure_access'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY pickup_photos_secure_access
      ON storage.objects
      FOR ALL
      USING (
        bucket_id = 'pickup-photos'
        AND (auth.role() = 'service_role' OR owner = auth.uid())
      )
      WITH CHECK (
        bucket_id = 'pickup-photos'
        AND (auth.role() = 'service_role' OR owner = auth.uid())
      );
    $POLICY$;
  END IF;
END;
$$;

-- Farms registry
CREATE TABLE IF NOT EXISTS public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL,
  cooperative_name text,
  country text DEFAULT 'RW',
  province text,
  district text,
  sector text,
  village text,
  location geography(Point, 4326),
  hectares numeric(10,2) CHECK (hectares IS NULL OR hectares >= 0),
  primary_crops text[] DEFAULT ARRAY[]::text[],
  certifications text[] DEFAULT ARRAY[]::text[],
  momo_number text,
  momo_name text,
  id_document_path text,
  momo_statement_path text,
  id_verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  momo_verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  verification_notes text,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_farms_owner ON public.farms(owner_profile_id);
-- CREATE INDEX IF NOT EXISTS idx_farms_location ON public.farms USING GIST(location);

DROP TRIGGER IF EXISTS set_updated_at_farms ON public.farms;
CREATE TRIGGER set_updated_at_farms
  BEFORE UPDATE ON public.farms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'farms' AND policyname = 'Farm owners manage farms'
  ) THEN
    CREATE POLICY "Farm owners manage farms"
      ON public.farms
      FOR ALL
      TO authenticated
      USING (owner_profile_id = auth.uid())
      WITH CHECK (owner_profile_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'farms' AND policyname = 'Service role manage farms'
  ) THEN
    CREATE POLICY "Service role manage farms"
      ON public.farms
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

COMMENT ON TABLE public.farms IS 'Registered farms tied to verified profiles and MoMo payout identities.';

-- Shipments table for pickup workflows
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  listing_id uuid,
  order_id uuid, -- Remove FK constraint for now (orders table doesn't exist yet)
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_transit','delivered','cancelled','failed')),
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  pickup_scheduled_at timestamptz,
  pickup_confirmed_at timestamptz,
  pickup_confirmed_by uuid REFERENCES public.profiles(user_id),
  pickup_address text,
  pickup_location geography(Point, 4326),
  pickup_notes text,
  pickup_photo_path text NOT NULL,
  pickup_photo_uploaded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  pickup_photo_uploaded_by uuid REFERENCES public.profiles(user_id),
  quantity_committed numeric(12,2) CHECK (quantity_committed IS NULL OR quantity_committed >= 0),
  quantity_collected numeric(12,2) CHECK (quantity_collected IS NULL OR quantity_collected >= 0),
  spoilage_qty numeric(12,2) CHECK (spoilage_qty IS NULL OR spoilage_qty >= 0),
  spoilage_percent numeric(5,2) CHECK (spoilage_percent IS NULL OR spoilage_percent >= 0),
  deposit_amount numeric(12,2),
  deposit_currency text DEFAULT 'RWF',
  deposit_success boolean,
  deposit_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_shipments_farm ON public.shipments(farm_id);
CREATE INDEX IF NOT EXISTS idx_shipments_listing ON public.shipments(listing_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_pickup_time ON public.shipments(pickup_scheduled_at);

DROP TRIGGER IF EXISTS set_updated_at_shipments ON public.shipments;
CREATE TRIGGER set_updated_at_shipments
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipments' AND policyname = 'Farm owners read shipments'
  ) THEN
    CREATE POLICY "Farm owners read shipments"
      ON public.shipments
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.farms f
          WHERE f.id = shipments.farm_id AND f.owner_profile_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipments' AND policyname = 'Service role manage shipments'
  ) THEN
    CREATE POLICY "Service role manage shipments"
      ON public.shipments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- Conditionally add FK to listings if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'shipments' AND constraint_name = 'shipments_listing_id_fkey'
    ) THEN
      ALTER TABLE public.shipments
        ADD CONSTRAINT shipments_listing_id_fkey
        FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;

-- View for ops-friendly metrics
CREATE OR REPLACE VIEW public.ops_pickup_metrics AS
SELECT
  date_trunc('day', COALESCE(pickup_scheduled_at, created_at)) AS bucket_day,
  COUNT(*) AS pickups,
  AVG(quantity_collected / NULLIF(quantity_committed, 0)) AS avg_fill_rate,
  AVG(spoilage_percent) AS avg_spoilage_percent,
  AVG(CASE WHEN deposit_success IS TRUE THEN 1 ELSE 0 END) AS deposit_success_rate,
  AVG(CASE WHEN pickup_confirmed_at IS NOT NULL THEN 1 ELSE 0 END) AS pickup_utilization_rate
FROM public.shipments
GROUP BY 1
ORDER BY bucket_day DESC;

COMMENT ON VIEW public.ops_pickup_metrics IS 'Daily aggregate of fill rate, spoilage, deposit success, and pickup utilization.';

GRANT SELECT ON public.ops_pickup_metrics TO authenticated;
GRANT SELECT ON public.ops_pickup_metrics TO service_role;

-- schedule_pickup RPC to enforce pickup photo + linkage
CREATE OR REPLACE FUNCTION public.schedule_pickup(
  p_farm_id uuid,
  p_pickup_at timestamptz,
  p_pickup_photo_path text,
  p_listing_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_pickup_address text DEFAULT NULL,
  p_pickup_lat double precision DEFAULT NULL,
  p_pickup_lng double precision DEFAULT NULL,
  p_quantity_committed numeric DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.shipments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_pickup geography(Point, 4326);
  v_new public.shipments%ROWTYPE;
BEGIN
  IF p_farm_id IS NULL THEN
    RAISE EXCEPTION 'farm_id is required';
  END IF;

  IF p_listing_id IS NULL AND p_order_id IS NULL THEN
    RAISE EXCEPTION 'listing_id or order_id must be provided';
  END IF;

  IF p_pickup_photo_path IS NULL OR length(trim(p_pickup_photo_path)) = 0 THEN
    RAISE EXCEPTION 'pickup_photo_path is required';
  END IF;

  IF position('pickup-photos/' IN p_pickup_photo_path) <> 1 THEN
    RAISE EXCEPTION 'pickup_photo_path must point to the secure pickup-photos bucket';
  END IF;

  SELECT owner_profile_id
  INTO v_owner
  FROM public.farms
  WHERE id = p_farm_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Farm % not found', p_farm_id;
  END IF;

  IF auth.role() <> 'service_role' AND v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'You are not allowed to schedule pickups for this farm';
  END IF;

  IF p_pickup_lat IS NOT NULL AND p_pickup_lng IS NOT NULL THEN
    v_pickup := ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::geography;
  ELSE
    v_pickup := NULL;
  END IF;

  INSERT INTO public.shipments (
    farm_id,
    listing_id,
    order_id,
    pickup_scheduled_at,
    pickup_address,
    pickup_location,
    pickup_photo_path,
    pickup_photo_uploaded_at,
    pickup_photo_uploaded_by,
    quantity_committed,
    metadata
  )
  VALUES (
    p_farm_id,
    p_listing_id,
    p_order_id,
    p_pickup_at,
    p_pickup_address,
    v_pickup,
    p_pickup_photo_path,
    timezone('utc', now()),
    auth.uid(),
    p_quantity_committed,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_pickup(uuid, uuid, uuid, timestamptz, text, text, double precision, double precision, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_pickup(uuid, uuid, uuid, timestamptz, text, text, double precision, double precision, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_pickup(uuid, uuid, uuid, timestamptz, text, text, double precision, double precision, numeric, jsonb) TO service_role;

COMMIT;
