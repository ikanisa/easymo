-- BrokerAI — Insurance Intake & Mobility Booking (Additive Only)
-- Safe, idempotent, and wrapped in a transaction for hygiene.

BEGIN;

-- Enable PostGIS for geospatial columns
CREATE EXTENSION IF NOT EXISTS postgis;

-- WhatsApp contacts (system-wide)
CREATE TABLE IF NOT EXISTS public.wa_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text UNIQUE NOT NULL,
  display_name text,
  locale text DEFAULT 'en',
  created_at timestamptz DEFAULT now()
);

-- Insurance: intents + documents + OCR enums
DO $$ BEGIN CREATE TYPE insurance_status AS ENUM ('collecting','ocr_pending','ready_review','submitted','completed','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE doc_type AS ENUM ('logbook','yellow_card','old_policy','id_card','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ocr_status AS ENUM ('pending','processing','done','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.insurance_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  status insurance_status NOT NULL DEFAULT 'collecting',
  vehicle_type text,
  vehicle_plate text,
  insurer_preference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid REFERENCES public.insurance_intents(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  kind doc_type NOT NULL,
  storage_path text NOT NULL,
  checksum text,
  ocr_state ocr_status NOT NULL DEFAULT 'pending',
  ocr_json jsonb,
  ocr_confidence numeric,
  created_at timestamptz DEFAULT now()
);

-- Mobility: drivers, availability, rides, candidates
DO $$ BEGIN CREATE TYPE vehicle_kind AS ENUM ('moto','sedan','suv','van','truck'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text UNIQUE NOT NULL,
  display_name text,
  vehicle_type vehicle_kind,
  vehicle_desc text,
  rating numeric DEFAULT 4.3,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  at timestamptz DEFAULT now(),
  available boolean DEFAULT true,
  loc geography(point,4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_driver_availability_loc ON public.driver_availability USING gist (loc);

DO $$ BEGIN CREATE TYPE ride_status AS ENUM ('searching','shortlisted','booked','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  vehicle_type vehicle_kind NOT NULL,
  pickup geography(point,4326) NOT NULL,
  dropoff geography(point,4326),
  status ride_status NOT NULL DEFAULT 'searching',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN CREATE TYPE candidate_status AS ENUM ('pending','accepted','rejected','timeout'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.ride_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  eta_minutes int,
  offer_price numeric,
  currency text DEFAULT 'RWF',
  status candidate_status DEFAULT 'pending',
  driver_message text,
  created_at timestamptz DEFAULT now()
);

-- Conversations/message audit (optional)
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'whatsapp',
  role text NOT NULL,        -- user|driver|agent
  contact_id uuid,
  driver_id uuid,
  wa_thread_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  dir text NOT NULL,         -- in|out
  body jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Strict RLS (defaults to deny all)
ALTER TABLE public.wa_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_intents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_candidates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;

-- Optional: nearest driver RPC (KNN by point)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'nearest_drivers'
  ) THEN
    CREATE FUNCTION public.nearest_drivers(
      p_lat double precision,
      p_lng double precision,
      p_vehicle text,
      p_limit int DEFAULT 8
    )
    RETURNS TABLE(driver_id uuid, distance_m double precision, eta_guess int)
    LANGUAGE sql STABLE AS $fn$
      SELECT da.driver_id,
             ST_DistanceSphere(da.loc, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) AS distance_m,
             CEIL(ST_DistanceSphere(da.loc, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) / 250)::int AS eta_guess
      FROM public.driver_availability da
      JOIN public.drivers d ON d.id = da.driver_id
      WHERE da.available = true AND (p_vehicle IS NULL OR d.vehicle_type::text = p_vehicle)
      ORDER BY da.loc <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
      LIMIT COALESCE(p_limit, 8)
    $fn$;
  END IF;
END;
$$;

-- Storage bucket for insurance uploads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'insurance_uploads') THEN
    PERFORM storage.create_bucket('insurance_uploads', public => false);
  END IF;
END;
$$;

COMMIT;
