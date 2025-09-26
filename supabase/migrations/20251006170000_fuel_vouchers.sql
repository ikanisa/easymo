-- Fuel voucher schema additions (vouchers, redemptions, petrol stations)

CREATE TABLE IF NOT EXISTS public.petrol_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  owner_contact text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.petrol_stations
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS owner_contact text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'petrol_stations_status_check'
  ) THEN
    ALTER TABLE public.petrol_stations
      ADD CONSTRAINT petrol_stations_status_check CHECK (status IN ('active','inactive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_petrol_stations_updated'
  ) THEN
    CREATE TRIGGER trg_petrol_stations_updated
      BEFORE UPDATE ON public.petrol_stations
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.station_numbers (
  station_id uuid NOT NULL REFERENCES public.petrol_stations(id) ON DELETE CASCADE,
  wa_e164 text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (station_id, wa_e164)
);

ALTER TABLE public.station_numbers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'station_numbers_role_check'
  ) THEN
    ALTER TABLE public.station_numbers
      ADD CONSTRAINT station_numbers_role_check CHECK (role IN ('manager','staff'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_5 text NOT NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'RWF',
  status text NOT NULL DEFAULT 'issued',
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  whatsapp_e164 text NOT NULL,
  policy_number text NOT NULL,
  plate text,
  qr_payload text NOT NULL,
  image_url text,
  issued_by_admin uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  redeemed_at timestamptz,
  redeemed_by_station_id uuid REFERENCES public.petrol_stations(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS code_5 text,
  ADD COLUMN IF NOT EXISTS amount_minor integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RWF',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_e164 text,
  ADD COLUMN IF NOT EXISTS policy_number text,
  ADD COLUMN IF NOT EXISTS plate text,
  ADD COLUMN IF NOT EXISTS qr_payload text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS issued_by_admin uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz,
  ADD COLUMN IF NOT EXISTS redeemed_by_station_id uuid REFERENCES public.petrol_stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_status_check'
  ) THEN
    ALTER TABLE public.vouchers
      ADD CONSTRAINT vouchers_status_check CHECK (status IN ('issued','redeemed','cancelled','expired'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_code_5_check'
  ) THEN
    ALTER TABLE public.vouchers
      ADD CONSTRAINT vouchers_code_5_check CHECK (code_5 ~ '^[0-9]{5}$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vouchers_updated'
  ) THEN
    CREATE TRIGGER trg_vouchers_updated
      BEFORE UPDATE ON public.vouchers
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS vouchers_code_active_unique
  ON public.vouchers (code_5)
  WHERE status IN ('issued','redeemed');

CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  station_id uuid REFERENCES public.petrol_stations(id) ON DELETE SET NULL,
  redeemer_wa_e164 text,
  reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.voucher_redemptions
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES public.petrol_stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemer_wa_e164 text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS voucher_redemptions_voucher_idx
  ON public.voucher_redemptions (voucher_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_channel' AND e.enumlabel = 'media'
  ) THEN
    ALTER TYPE public.notification_channel ADD VALUE 'media';
  END IF;
END $$;

-- Note: Create storage bucket `vouchers` (private) via Supabase dashboard or CLI before issuing vouchers.
