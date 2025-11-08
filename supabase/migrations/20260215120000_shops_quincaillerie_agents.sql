-- Migration for Shops and Quincaillerie agents
BEGIN;

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  categories TEXT[] NOT NULL, -- ['saloon', 'supermarket', 'spareparts', 'liquorstore', 'cosmetics', etc]
  whatsapp_catalog_url TEXT,
  phone TEXT,
  opening_hours TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  verified BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3, 2) DEFAULT 0.00,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add rating column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'shops' AND column_name = 'rating') THEN
    ALTER TABLE shops ADD COLUMN rating DECIMAL(3, 2) DEFAULT 0.00;
  END IF;
END $$;

-- Indexes for shops
CREATE INDEX IF NOT EXISTS idx_shops_location ON shops USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_categories ON shops USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_verified ON shops(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_shops_rating ON shops(rating DESC);

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS search_nearby_shops CASCADE;
DROP FUNCTION IF EXISTS search_nearby_vendors CASCADE;

-- Function to search nearby shops
CREATE OR REPLACE FUNCTION search_nearby_shops(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  name TEXT,
  description TEXT,
  categories TEXT[],
  whatsapp_catalog_url TEXT,
  phone TEXT,
  distance DOUBLE PRECISION,
  verified BOOLEAN,
  rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.owner_id,
    s.name,
    s.description,
    s.categories,
    s.whatsapp_catalog_url,
    s.phone,
    ST_DistanceSphere(
      s.location::geometry,
      ST_MakePoint(p_longitude, p_latitude)::geometry
    ) / 1000.0 AS distance,
    s.verified,
    s.rating
  FROM shops s
  WHERE 
    s.status = 'active'
    AND ST_DWithin(
      s.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_km * 1000
    )
    AND (p_category IS NULL OR p_category = ANY(s.categories))
  ORDER BY 
    s.verified DESC,
    distance ASC,
    s.rating DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Generic vendor table for quincailleries and other vendor types
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_type TEXT NOT NULL CHECK (vendor_type IN ('quincaillerie', 'pharmacy', 'restaurant', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  phone TEXT,
  opening_hours TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  verified BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3, 2) DEFAULT 0.00,
  metadata JSONB DEFAULT '{}'::JSONB, -- Store type-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vendors
CREATE INDEX IF NOT EXISTS idx_vendors_location ON vendors USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_vendors_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_owner ON vendors(owner_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_verified ON vendors(verified) WHERE verified = TRUE;

-- Function to search nearby vendors
CREATE OR REPLACE FUNCTION search_nearby_vendors(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_vendor_type TEXT,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  name TEXT,
  description TEXT,
  phone TEXT,
  distance DOUBLE PRECISION,
  verified BOOLEAN,
  rating DECIMAL,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.owner_id,
    v.name,
    v.description,
    v.phone,
    ST_DistanceSphere(
      v.location::geometry,
      ST_MakePoint(p_longitude, p_latitude)::geometry
    ) / 1000.0 AS distance,
    v.verified,
    v.rating,
    v.metadata
  FROM vendors v
  WHERE 
    v.status = 'active'
    AND v.vendor_type = p_vendor_type
    AND ST_DWithin(
      v.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_km * 1000
    )
  ORDER BY 
    v.verified DESC,
    distance ASC,
    v.rating DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Shop reviews table
CREATE TABLE IF NOT EXISTS shop_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_reviews_shop ON shop_reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_user ON shop_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_rating ON shop_reviews(rating);

-- Vendor reviews table
CREATE TABLE IF NOT EXISTS vendor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor ON vendor_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_user ON vendor_reviews(user_id);

-- Product inquiries table (for tracking product requests)
CREATE TABLE IF NOT EXISTS product_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  products TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'completed', 'cancelled')),
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_inquiries_session ON product_inquiries(session_id);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_shop ON product_inquiries(shop_id);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_vendor ON product_inquiries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_user ON product_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_status ON product_inquiries(status);

-- Function to update shop rating
CREATE OR REPLACE FUNCTION update_shop_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shops
  SET 
    rating = (
      SELECT AVG(rating)::DECIMAL(3,2)
      FROM shop_reviews
      WHERE shop_id = NEW.shop_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM shop_reviews
      WHERE shop_id = NEW.shop_id
    ),
    updated_at = NOW()
  WHERE id = NEW.shop_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shop_rating
  AFTER INSERT OR UPDATE ON shop_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_rating();

-- Function to update vendor rating
CREATE OR REPLACE FUNCTION update_vendor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vendors
  SET 
    rating = (
      SELECT AVG(rating)::DECIMAL(3,2)
      FROM vendor_reviews
      WHERE vendor_id = NEW.vendor_id
    ),
    updated_at = NOW()
  WHERE id = NEW.vendor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vendor_rating
  AFTER INSERT OR UPDATE ON vendor_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_rating();

-- RLS policies
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inquiries ENABLE ROW LEVEL SECURITY;

-- Shops policies
CREATE POLICY "Anyone can view active shops"
  ON shops FOR SELECT
  USING (status = 'active');

CREATE POLICY "Users can create own shops"
  ON shops FOR INSERT
  WITH CHECK (auth.uid()::TEXT = owner_id);

CREATE POLICY "Users can update own shops"
  ON shops FOR UPDATE
  USING (auth.uid()::TEXT = owner_id);

-- Vendors policies
CREATE POLICY "Anyone can view active vendors"
  ON vendors FOR SELECT
  USING (status = 'active');

CREATE POLICY "Users can create own vendors"
  ON vendors FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own vendors"
  ON vendors FOR UPDATE
  USING (auth.uid() = owner_id);

-- Reviews policies
CREATE POLICY "Anyone can view reviews"
  ON shop_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews"
  ON shop_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON shop_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view vendor reviews"
  ON vendor_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create vendor reviews"
  ON vendor_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Product inquiries policies
CREATE POLICY "Users can view own inquiries"
  ON product_inquiries FOR SELECT
  USING (
    auth.uid() = user_id 
    OR auth.uid()::TEXT IN (
      SELECT owner_id FROM shops WHERE shops.id = product_inquiries.shop_id
    )
    OR auth.uid() IN (
      SELECT owner_id FROM vendors WHERE vendors.id = product_inquiries.vendor_id
    )
  );

CREATE POLICY "Users can create inquiries"
  ON product_inquiries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMIT;
