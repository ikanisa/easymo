-- General Broker Agent: Service Requests
-- Unified structured memory for all user requests across verticals

BEGIN;

-- Unified service request tracking across all verticals
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "earthdistance";

-- Unified service request tracking across all verticals
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,  -- References organizations if/when that table exists
  user_id UUID NOT NULL REFERENCES public.profiles(user_id),
  
  -- Classification
  vertical TEXT CHECK (vertical IN (
    'mobility','commerce','hospitality','insurance','property',
    'legal','jobs','farming','marketing','sora_video','support'
  )) NOT NULL,
  request_type TEXT NOT NULL,  -- 'buy', 'book', 'quote', 'consult', 'post_job', 'onboard_vendor'
  category TEXT,               -- Vertical-specific: 'electronics', 'motor_insurance', etc.
  subcategory TEXT,            -- 'laptop', 'motor_third_party', etc.
  
  -- Details
  title TEXT,
  description TEXT,
  
  -- Location
  location_id UUID REFERENCES public.user_locations(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  
  -- Flexible payload per vertical
  payload JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','fulfilled','cancelled')),
  
  -- Source & timestamps
  source TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON public.service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_org_id ON public.service_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_vertical ON public.service_requests(vertical);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON public.service_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_location ON public.service_requests USING GIST (
  ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- RLS
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_requests' AND policyname = 'service_requests_select') THEN
    CREATE POLICY "service_requests_select" ON public.service_requests
      FOR SELECT USING (
        user_id = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_requests' AND policyname = 'service_requests_insert') THEN
    CREATE POLICY "service_requests_insert" ON public.service_requests
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_requests' AND policyname = 'service_requests_update') THEN
    CREATE POLICY "service_requests_update" ON public.service_requests
      FOR UPDATE USING (
        user_id = auth.uid()
      );
  END IF;
END $$;

COMMIT;
