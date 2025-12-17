BEGIN;

-- Fallback creation of public.businesses to satisfy dependent migrations in local dev
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  category TEXT,
  category_name TEXT,
  description TEXT,
  address TEXT,
  phone_number TEXT,
  country TEXT,
  tag TEXT,
  tag_id UUID,
  new_category_id UUID,
  owner_user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  owner_whatsapp TEXT,
  status TEXT DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  location_text TEXT,
  location_url TEXT,
  maps_url TEXT,
  geocode_status TEXT,
  geocoded_at TIMESTAMPTZ,
  name_embedding TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_lat_lng_base 
  ON public.businesses(lat, lng) 
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_status 
  ON public.businesses(status);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'businesses' AND policyname = 'service_role_manage_businesses') THEN
    CREATE POLICY "service_role_manage_businesses" ON public.businesses
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.businesses IS 'Lightweight placeholder for local dev; ensures dependent migrations succeed.';

COMMIT;
