-- Create agent_sessions table if not exists
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  flow_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'searching',
  request_data JSONB,
  metadata JSONB,
  deadline_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_quotes table if not exists
CREATE TABLE IF NOT EXISTS public.agent_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  vendor_id UUID,
  vendor_type TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  offer_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ranking_score INTEGER DEFAULT 0,
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create properties table if not exists
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  rental_type TEXT NOT NULL CHECK (rental_type IN ('short_term', 'long_term')),
  bedrooms INTEGER NOT NULL,
  bathrooms INTEGER DEFAULT 1,
  price NUMERIC NOT NULL,
  location GEOGRAPHY(POINT),
  address TEXT,
  amenities TEXT[] DEFAULT '{}',
  description TEXT,
  images TEXT[] DEFAULT '{}',
  image_analysis TEXT,
  status TEXT DEFAULT 'available',
  available_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  minimum_stay INTEGER,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scheduled_trips table if not exists
CREATE TABLE IF NOT EXISTS public.scheduled_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  pickup_location GEOGRAPHY(POINT) NOT NULL,
  dropoff_location GEOGRAPHY(POINT) NOT NULL,
  pickup_address TEXT,
  dropoff_address TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  vehicle_preference TEXT DEFAULT 'Moto',
  recurrence TEXT DEFAULT 'once',
  max_price NUMERIC,
  notification_minutes INTEGER DEFAULT 30,
  flexibility_minutes INTEGER DEFAULT 15,
  preferred_drivers TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'pending',
  last_processed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create travel_patterns table if not exists
CREATE TABLE IF NOT EXISTS public.travel_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  hour INTEGER NOT NULL,
  pickup_location GEOGRAPHY(POINT),
  dropoff_location GEOGRAPHY(POINT),
  vehicle_type TEXT,
  frequency_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shops table if not exists (extend existing if necessary)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'owner_id') THEN
    ALTER TABLE public.shops ADD COLUMN owner_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'location') THEN
    ALTER TABLE public.shops ADD COLUMN location GEOGRAPHY(POINT);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'categories') THEN
    ALTER TABLE public.shops ADD COLUMN categories TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'description') THEN
    ALTER TABLE public.shops ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'whatsapp_catalog_url') THEN
    ALTER TABLE public.shops ADD COLUMN whatsapp_catalog_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'phone') THEN
    ALTER TABLE public.shops ADD COLUMN phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'opening_hours') THEN
    ALTER TABLE public.shops ADD COLUMN opening_hours TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'status') THEN
    ALTER TABLE public.shops ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'verified') THEN
    ALTER TABLE public.shops ADD COLUMN verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON public.agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON public.agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_quotes_session_id ON public.agent_quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_user_id ON public.scheduled_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_scheduled_time ON public.scheduled_trips(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_travel_patterns_user_id ON public.travel_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_location ON public.shops USING GIST(location);

-- Create function to search nearby properties
CREATE OR REPLACE FUNCTION public.search_nearby_properties(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_rental_type TEXT DEFAULT NULL,
  p_bedrooms INTEGER DEFAULT NULL,
  p_min_budget NUMERIC DEFAULT 0,
  p_max_budget NUMERIC DEFAULT 999999999
)
RETURNS TABLE (
  id UUID,
  owner_id TEXT,
  rental_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  price NUMERIC,
  address TEXT,
  amenities TEXT[],
  images TEXT[],
  distance DOUBLE PRECISION,
  owner_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.owner_id,
    p.rental_type,
    p.bedrooms,
    p.bathrooms,
    p.price,
    p.address,
    p.amenities,
    p.images,
    ST_Distance(
      p.location::geography,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
    ) / 1000 AS distance,
    COALESCE(u.name, 'Property Owner') AS owner_name
  FROM public.properties p
  LEFT JOIN auth.users u ON u.id::text = p.owner_id
  WHERE 
    p.status = 'available'
    AND ST_DWithin(
      p.location::geography,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_km * 1000
    )
    AND (p_rental_type = p.rental_type OR p_rental_type IS NULL)
    AND (p.bedrooms >= p_bedrooms OR p_bedrooms IS NULL)
    AND p.price BETWEEN p_min_budget AND p_max_budget
  ORDER BY distance
  LIMIT 20;
END;
$$;

-- Create function to search nearby shops
CREATE OR REPLACE FUNCTION public.search_nearby_shops(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  categories TEXT[],
  whatsapp_catalog_url TEXT,
  phone TEXT,
  verified BOOLEAN,
  distance DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.description,
    s.categories,
    s.whatsapp_catalog_url,
    s.phone,
    s.verified,
    ST_Distance(
      s.location::geography,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
    ) / 1000 AS distance
  FROM public.shops s
  WHERE 
    s.status = 'active'
    AND s.is_active = TRUE
    AND ST_DWithin(
      s.location::geography,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_km * 1000
    )
    AND (p_category IS NULL OR p_category = ANY(s.categories))
  ORDER BY 
    CASE WHEN s.verified THEN 0 ELSE 1 END,
    distance
  LIMIT p_limit;
END;
$$;

-- Create function to search nearby vendors (generic)
CREATE OR REPLACE FUNCTION public.search_nearby_vendors(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_vendor_type TEXT,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  distance DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- This is a placeholder - in production, you'd query actual vendor tables
  -- For now, return shops when vendor_type is 'quincaillerie'
  IF p_vendor_type = 'quincaillerie' THEN
    RETURN QUERY
    SELECT 
      s.id,
      s.name,
      s.phone,
      ST_Distance(
        s.location::geography,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
      ) / 1000 AS distance
    FROM public.shops s
    WHERE 
      s.status = 'active'
      AND s.is_active = TRUE
      AND 'quincaillerie' = ANY(s.categories)
      AND ST_DWithin(
        s.location::geography,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        p_radius_km * 1000
      )
    ORDER BY distance
    LIMIT p_limit;
  END IF;

  -- Return empty set for other vendor types
  RETURN;
END;
$$;

-- Create function to upsert travel pattern
CREATE OR REPLACE FUNCTION public.upsert_travel_pattern(
  p_user_id TEXT,
  p_day_of_week INTEGER,
  p_hour INTEGER,
  p_pickup_location GEOGRAPHY(POINT),
  p_dropoff_location GEOGRAPHY(POINT),
  p_vehicle_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.travel_patterns (
    user_id,
    day_of_week,
    hour,
    pickup_location,
    dropoff_location,
    vehicle_type,
    frequency_count
  )
  VALUES (
    p_user_id,
    p_day_of_week,
    p_hour,
    p_pickup_location,
    p_dropoff_location,
    p_vehicle_type,
    1
  )
  ON CONFLICT (user_id, day_of_week, hour, pickup_location, dropoff_location)
  DO UPDATE SET
    frequency_count = public.travel_patterns.frequency_count + 1,
    vehicle_type = p_vehicle_type;
END;
$$;

-- Add unique constraint for travel patterns
CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_patterns_unique 
  ON public.travel_patterns(user_id, day_of_week, hour, pickup_location, dropoff_location);

-- Enable RLS (Row Level Security) on new tables
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_patterns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow service role full access)
CREATE POLICY "Allow service role full access" ON public.agent_sessions FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON public.agent_quotes FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON public.properties FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON public.scheduled_trips FOR ALL USING (true);
CREATE POLICY "Allow service role full access" ON public.travel_patterns FOR ALL USING (true);

-- Grant necessary permissions
GRANT ALL ON public.agent_sessions TO service_role;
GRANT ALL ON public.agent_quotes TO service_role;
GRANT ALL ON public.properties TO service_role;
GRANT ALL ON public.scheduled_trips TO service_role;
GRANT ALL ON public.travel_patterns TO service_role;
GRANT ALL ON public.shops TO service_role;
