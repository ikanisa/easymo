BEGIN;

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  registration_plate text NOT NULL,
  insurer_name text,
  policy_number text,
  certificate_number text,
  policy_inception date,
  policy_expiry date,
  carte_jaune_number text,
  carte_jaune_expiry date,
  make text,
  model text,
  vehicle_year integer,
  vin_chassis text,
  usage text,
  licensed_to_carry integer,
  document_path text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON public.vehicles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(registration_plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);

-- RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename = 'vehicles' AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_full_access ON public.vehicles FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
  END IF;
END $$;

-- Allow users to see their own vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename = 'vehicles' AND policyname = 'user_select_own_vehicles'
  ) THEN
    EXECUTE 'CREATE POLICY user_select_own_vehicles ON public.vehicles FOR SELECT USING (auth.uid() = owner_user_id)';
  END IF;
END $$;

-- Update trigger
CREATE OR REPLACE FUNCTION public.update_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.update_vehicles_updated_at();

COMMENT ON TABLE public.vehicles IS 'Registered vehicles verified via insurance certificate OCR';

COMMIT;
