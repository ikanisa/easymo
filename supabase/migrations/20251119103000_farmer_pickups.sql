BEGIN;

CREATE TABLE IF NOT EXISTS public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  farm_name text NOT NULL,
  district text,
  sector text,
  region text,
  hectares numeric,
  commodities text[] DEFAULT ARRAY[]::text[],
  certifications text[] DEFAULT ARRAY[]::text[],
  irrigation boolean,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_farms_profile ON public.farms(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_farms_district ON public.farms(district);

CREATE TABLE IF NOT EXISTS public.farm_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  locale text DEFAULT 'rw',
  category text DEFAULT 'commodity',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_synonyms_unique ON public.farm_synonyms(farm_id, lower(phrase));

CREATE TABLE IF NOT EXISTS public.farm_pickup_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity text NOT NULL,
  district text NOT NULL,
  sector text,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  capacity_tonnes numeric NOT NULL CHECK (capacity_tonnes > 0),
  reserved_tonnes numeric NOT NULL DEFAULT 0 CHECK (reserved_tonnes >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','completed','cancelled')),
  logistics_partner text,
  buyer_focus text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_farm_pickup_windows_lookup
  ON public.farm_pickup_windows(commodity, district, window_start);

CREATE TABLE IF NOT EXISTS public.farm_pickup_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id uuid NOT NULL REFERENCES public.farm_pickup_windows(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  commodity text NOT NULL,
  quantity_tonnes numeric NOT NULL CHECK (quantity_tonnes > 0),
  price_per_tonne numeric,
  buyer_focus text,
  deposit_percent numeric,
  deposit_amount numeric,
  deposit_status text DEFAULT 'pending' CHECK (deposit_status IN ('pending','processing','succeeded','failed','skipped')),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_farm_pickup_registrations_window ON public.farm_pickup_registrations(window_id);
CREATE INDEX IF NOT EXISTS idx_farm_pickup_registrations_farm ON public.farm_pickup_registrations(farm_id);

CREATE TABLE IF NOT EXISTS public.farm_pickup_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.farm_pickup_registrations(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES public.farms(id) ON DELETE SET NULL,
  farmer_profile_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'RWF',
  provider text NOT NULL DEFAULT 'mtn',
  phone_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','succeeded','failed')),
  provider_transaction_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_farm_pickup_deposits_registration ON public.farm_pickup_deposits(registration_id);

CREATE OR REPLACE FUNCTION public.reserve_farm_pickup_capacity(p_window_id uuid, p_quantity numeric)
RETURNS public.farm_pickup_windows
LANGUAGE plpgsql
AS $$
DECLARE
  updated public.farm_pickup_windows;
BEGIN
  UPDATE public.farm_pickup_windows
    SET reserved_tonnes = reserved_tonnes + p_quantity,
        updated_at = timezone('utc', now())
  WHERE id = p_window_id
    AND reserved_tonnes + p_quantity <= capacity_tonnes
  RETURNING * INTO updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'capacity_exceeded';
  END IF;

  RETURN updated;
END;
$$;

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_pickup_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_pickup_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_pickup_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS farms_service_role_full_access
  ON public.farms
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS farm_synonyms_service_role_full_access
  ON public.farm_synonyms
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS farm_pickup_windows_service_role_full_access
  ON public.farm_pickup_windows
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS farm_pickup_registrations_service_role_full_access
  ON public.farm_pickup_registrations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS farm_pickup_deposits_service_role_full_access
  ON public.farm_pickup_deposits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE TRIGGER trg_farms_updated
  BEFORE UPDATE ON public.farms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_farm_pickup_windows_updated
  BEFORE UPDATE ON public.farm_pickup_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_farm_pickup_registrations_updated
  BEFORE UPDATE ON public.farm_pickup_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_farm_pickup_deposits_updated
  BEFORE UPDATE ON public.farm_pickup_deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
