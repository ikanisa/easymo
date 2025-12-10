BEGIN;

-- Check if mobility_requests table exists, if not create it
CREATE TABLE IF NOT EXISTS public.mobility_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing loc column before creating index
ALTER TABLE public.mobility_requests 
  ADD COLUMN IF NOT EXISTS loc GEOGRAPHY(POINT, 4326);

-- Update loc from existing coordinates
UPDATE public.mobility_requests 
SET loc = ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
WHERE loc IS NULL AND pickup_lng IS NOT NULL AND pickup_lat IS NOT NULL;

-- Now create the spatial index
CREATE INDEX IF NOT EXISTS idx_mobility_requests_pickup_loc 
  ON public.mobility_requests USING GIST (loc);

-- Add insurance request tracking
CREATE TABLE IF NOT EXISTS public.insurance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  vehicle_details JSONB,
  status TEXT DEFAULT 'pending',
  quote_amount DECIMAL(10,2),
  policy_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_requests_profile ON public.insurance_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_requests_status ON public.insurance_requests(status);

COMMIT;
