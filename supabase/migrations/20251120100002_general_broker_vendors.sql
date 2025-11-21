-- General Broker Agent: Vendors & Capabilities
-- Unified vendor registry across all verticals

BEGIN;

-- Unified vendor registry (cross-vertical)
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  
  -- Basic info
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp_number TEXT,
  email TEXT,
  
  -- Location
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'RW',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  verified BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor capabilities per vertical
CREATE TABLE IF NOT EXISTS public.vendor_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  
  vertical TEXT NOT NULL CHECK (vertical IN (
    'mobility','commerce','hospitality','insurance','property',
    'legal','jobs','farming','marketing','sora_video'
  )),
  category TEXT NOT NULL,       -- 'electronics', 'restaurant', 'motor_insurance'
  subcategories TEXT[] DEFAULT '{}'::text[],
  tags TEXT[] DEFAULT '{}'::text[],
  
  -- Service-specific metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_location ON public.vendors USING GIST (
  ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_active ON public.vendors(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_vendors_country ON public.vendors(country);
CREATE INDEX IF NOT EXISTS idx_vendor_capabilities_vertical ON public.vendor_capabilities(vertical);
CREATE INDEX IF NOT EXISTS idx_vendor_capabilities_vendor_id ON public.vendor_capabilities(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_capabilities_category ON public.vendor_capabilities(category);

-- RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_capabilities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendors' AND policyname = 'vendors_select') THEN
    CREATE POLICY "vendors_select" ON public.vendors FOR SELECT USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendors' AND policyname = 'vendors_insert') THEN
    CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT WITH CHECK (
      org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendors' AND policyname = 'vendors_update') THEN
    CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE USING (
      org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendor_capabilities' AND policyname = 'vendor_capabilities_select') THEN
    CREATE POLICY "vendor_capabilities_select" ON public.vendor_capabilities FOR SELECT USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendor_capabilities' AND policyname = 'vendor_capabilities_insert') THEN
    CREATE POLICY "vendor_capabilities_insert" ON public.vendor_capabilities FOR INSERT WITH CHECK (
      vendor_id IN (SELECT id FROM public.vendors WHERE org_id IN (
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      ))
    );
  END IF;
END $$;

-- PostGIS function for nearby vendor search
CREATE OR REPLACE FUNCTION vendors_nearby(
  p_vertical TEXT,
  p_category TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  whatsapp_number TEXT,
  phone TEXT,
  address TEXT,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  -- If no location provided, return closest active vendors
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN QUERY
    SELECT 
      v.id,
      v.name,
      v.whatsapp_number,
      v.phone,
      v.address,
      NULL::DOUBLE PRECISION AS distance_km
    FROM public.vendors v
    INNER JOIN public.vendor_capabilities vc ON v.id = vc.vendor_id
    WHERE v.is_active = TRUE
      AND vc.vertical = p_vertical
      AND (p_category IS NULL OR vc.category = p_category)
    LIMIT p_limit;
  ELSE
    -- Return vendors within radius, sorted by distance
    RETURN QUERY
    SELECT 
      v.id,
      v.name,
      v.whatsapp_number,
      v.phone,
      v.address,
      earth_distance(
        ll_to_earth(v.latitude, v.longitude),
        ll_to_earth(p_latitude, p_longitude)
      ) / 1000.0 AS distance_km
    FROM public.vendors v
    INNER JOIN public.vendor_capabilities vc ON v.id = vc.vendor_id
    WHERE v.is_active = TRUE
      AND vc.vertical = p_vertical
      AND (p_category IS NULL OR vc.category = p_category)
      AND earth_distance(
        ll_to_earth(v.latitude, v.longitude),
        ll_to_earth(p_latitude, p_longitude)
      ) <= p_radius_km * 1000
    ORDER BY distance_km ASC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
