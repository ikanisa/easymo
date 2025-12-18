-- =============================================================================
-- Vendor discovery and outreach schema for Buy & Sell agent
-- =============================================================================

BEGIN;

-- Vendors catalog with PostGIS point
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'public', -- 'tier1', 'tier2', 'public'
  coords GEOGRAPHY(Point, 4326),
  city TEXT,
  country TEXT DEFAULT 'RW',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_coords_gix ON public.vendors USING gist (coords);
CREATE INDEX IF NOT EXISTS idx_vendors_active_tier ON public.vendors(is_active, tier);

-- Outreach queue for broadcast to vendors
CREATE TABLE IF NOT EXISTS public.vendor_outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID,
  user_phone TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_phone TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_outreach_status ON public.vendor_outreach_queue(status, created_at);

-- Vendor responses
CREATE TABLE IF NOT EXISTS public.vendor_outreach_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_phone TEXT,
  vendor_phone TEXT,
  message TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RPC: find vendors near a coordinate
CREATE OR REPLACE FUNCTION public.vendor_find_nearby(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_limit INT DEFAULT 30,
  p_radius_km DOUBLE PRECISION DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  tier TEXT,
  distance_m DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    v.id,
    v.name,
    v.phone,
    v.tier,
    ST_Distance(v.coords, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) AS distance_m
  FROM public.vendors v
  WHERE v.is_active = TRUE
    AND v.coords IS NOT NULL
    AND v.phone IS NOT NULL
    AND ST_DWithin(
      v.coords,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000.0
    )
  ORDER BY
    CASE WHEN v.tier = 'tier1' THEN 1 WHEN v.tier = 'tier2' THEN 2 ELSE 3 END,
    distance_m ASC
  LIMIT GREATEST(1, LEAST(p_limit, 30));
$$;

-- RLS: service_role only by default
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_outreach_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_outreach_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role_full_vendors"
  ON public.vendors FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "service_role_full_vendor_outreach_queue"
  ON public.vendor_outreach_queue FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "service_role_full_vendor_outreach_responses"
  ON public.vendor_outreach_responses FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;
