-- Migration for Property Rental Agent support functions
BEGIN;

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS search_nearby_properties CASCADE;

-- Function to search nearby properties with filtering
CREATE FUNCTION search_nearby_properties(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_rental_type TEXT DEFAULT NULL,
  p_bedrooms INTEGER DEFAULT NULL,
  p_min_budget DECIMAL DEFAULT 0,
  p_max_budget DECIMAL DEFAULT 999999999
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  owner_name TEXT,
  rental_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  price DECIMAL,
  address TEXT,
  amenities TEXT[],
  images TEXT[],
  distance DOUBLE PRECISION,
  available_from TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.owner_id,
    u.phone AS owner_name,
    p.rental_type,
    p.bedrooms,
    p.bathrooms,
    p.price,
    p.address,
    p.amenities,
    p.images,
    ST_DistanceSphere(
      p.location::geometry,
      ST_MakePoint(p_longitude, p_latitude)::geometry
    ) / 1000.0 AS distance,
    p.available_from,
    p.status
  FROM properties p
  LEFT JOIN auth.users u ON u.id = p.owner_id
  WHERE 
    p.status = 'available'
    AND ST_DWithin(
      p.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_km * 1000
    )
    AND (p_rental_type IS NULL OR p.rental_type = p_rental_type)
    AND (p_bedrooms IS NULL OR p.bedrooms >= p_bedrooms)
    AND p.price BETWEEN p_min_budget AND p_max_budget
  ORDER BY distance ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Properties table if not exists
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rental_type TEXT NOT NULL CHECK (rental_type IN ('short_term', 'long_term')),
  bedrooms INTEGER NOT NULL CHECK (bedrooms > 0),
  bathrooms INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'delisted')),
  available_from TIMESTAMPTZ DEFAULT NOW(),
  minimum_stay INTEGER, -- days
  maximum_stay INTEGER, -- days
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_rental_type ON properties(rental_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);

-- Property inquiries table
CREATE TABLE IF NOT EXISTS property_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_inquiries_property ON property_inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_user ON property_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_status ON property_inquiries(status);

-- Property reviews table
CREATE TABLE IF NOT EXISTS property_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_reviews_property ON property_reviews(property_id);
CREATE INDEX IF NOT EXISTS idx_property_reviews_user ON property_reviews(user_id);

-- Function to update property ratings
CREATE OR REPLACE FUNCTION update_property_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE properties
  SET updated_at = NOW()
  WHERE id = NEW.property_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_property_rating
  AFTER INSERT ON property_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_property_rating();

-- RLS policies
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_reviews ENABLE ROW LEVEL SECURITY;

-- Property policies
CREATE POLICY "Anyone can view available properties"
  ON properties FOR SELECT
  USING (status = 'available');

CREATE POLICY "Users can insert own properties"
  ON properties FOR INSERT
  WITH CHECK (auth.uid()::TEXT = owner_id::TEXT);

CREATE POLICY "Users can update own properties"
  ON properties FOR UPDATE
  USING (auth.uid()::TEXT = owner_id::TEXT);

-- Inquiry policies
CREATE POLICY "Users can view own inquiries"
  ON property_inquiries FOR SELECT
  USING (auth.uid()::TEXT = user_id::TEXT OR auth.uid()::TEXT IN (
    SELECT owner_id::TEXT FROM properties WHERE id = property_id
  ));

CREATE POLICY "Users can create inquiries"
  ON property_inquiries FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

-- Review policies
CREATE POLICY "Anyone can view reviews"
  ON property_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews"
  ON property_reviews FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

COMMIT;
