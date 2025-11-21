BEGIN;

-- Create business_directory table for storing business listings from easyMOAI
CREATE TABLE IF NOT EXISTS public.business_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Business identification
  external_id TEXT UNIQUE, -- Original ID from source system
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  
  -- Location information
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  country TEXT DEFAULT 'Rwanda',
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  
  -- Contact information
  phone TEXT,
  website TEXT,
  email TEXT,
  
  -- Business details
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'DO_NOT_CALL')),
  rating DECIMAL(2, 1) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
  review_count INTEGER DEFAULT 0,
  
  -- Additional metadata
  notes TEXT,
  google_maps_url TEXT,
  place_id TEXT,
  business_type TEXT,
  operating_hours JSONB,
  
  -- Timestamps
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Import tracking
  source TEXT DEFAULT 'easymoai',
  import_batch_id UUID,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_business_directory_category ON public.business_directory(category);
CREATE INDEX IF NOT EXISTS idx_business_directory_city ON public.business_directory(city);
CREATE INDEX IF NOT EXISTS idx_business_directory_status ON public.business_directory(status);
CREATE INDEX IF NOT EXISTS idx_business_directory_rating ON public.business_directory(rating DESC);
CREATE INDEX IF NOT EXISTS idx_business_directory_created_at ON public.business_directory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_directory_external_id ON public.business_directory(external_id);
CREATE INDEX IF NOT EXISTS idx_business_directory_source ON public.business_directory(source);

-- Create GiST index for location-based queries if PostGIS is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    -- Add geometry column for spatial queries
    EXECUTE 'ALTER TABLE public.business_directory ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_business_directory_location ON public.business_directory USING GIST(location)';
  END IF;
END
$$;

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_business_directory_search 
  ON public.business_directory 
  USING gin(to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(category, '') || ' ' || 
    COALESCE(address, '') || ' ' ||
    COALESCE(city, '') || ' ' ||
    COALESCE(notes, '')
  ));

-- Enable Row Level Security
ALTER TABLE public.business_directory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Read access for authenticated users
CREATE POLICY "business_directory_read_authenticated"
  ON public.business_directory
  FOR SELECT
  TO authenticated
  USING (true);

-- Read access for anon users (public directory)
CREATE POLICY "business_directory_read_public"
  ON public.business_directory
  FOR SELECT
  TO anon
  USING (true);

-- Write access for authenticated users (service role for imports)
CREATE POLICY "business_directory_write_service"
  ON public.business_directory
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_business_directory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_business_directory_updated_at
  BEFORE UPDATE ON public.business_directory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_directory_updated_at();

-- Comment on table
COMMENT ON TABLE public.business_directory IS 'Business directory imported from easyMOAI and other sources for sales prospecting';

COMMIT;
