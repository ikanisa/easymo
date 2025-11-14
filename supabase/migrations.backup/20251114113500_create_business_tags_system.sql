BEGIN;

-- =====================================================
-- BUSINESS TAGS SYSTEM
-- Dynamic, AI-powered business categorization
-- =====================================================

-- 1. Create business_tags table
CREATE TABLE IF NOT EXISTS business_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '🏷️',
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  search_keywords TEXT[] DEFAULT '{}',
  parent_tag_id UUID REFERENCES business_tags(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Create indexes
CREATE INDEX idx_business_tags_slug ON business_tags(slug);
CREATE INDEX idx_business_tags_active ON business_tags(is_active) WHERE is_active = true;
CREATE INDEX idx_business_tags_parent ON business_tags(parent_tag_id) WHERE parent_tag_id IS NOT NULL;
CREATE INDEX idx_business_tags_search ON business_tags USING GIN(search_keywords);

-- 3. Create business_tag_assignments (many-to-many)
CREATE TABLE IF NOT EXISTS business_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES business_tags(id) ON DELETE CASCADE,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  assigned_by TEXT, -- 'ai', 'manual', 'import'
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, tag_id)
);

-- 4. Create indexes for assignments
CREATE INDEX idx_tag_assignments_business ON business_tag_assignments(business_id);
CREATE INDEX idx_tag_assignments_tag ON business_tag_assignments(tag_id);
CREATE INDEX idx_tag_assignments_confidence ON business_tag_assignments(confidence_score);

-- 5. Insert predefined tags for Shops & Services
INSERT INTO business_tags (name, slug, description, icon, sort_order, search_keywords) VALUES
  ('Electronics', 'electronics', 'Electronic devices, computers, phones, accessories', '📱', 1, 
   ARRAY['electronics', 'computer', 'phone', 'mobile', 'laptop', 'tablet', 'gadget', 'tech']),
   
  ('Household Goods', 'household_goods', 'Home essentials, kitchenware, furniture, decor', '🏠', 2,
   ARRAY['household', 'home', 'furniture', 'kitchen', 'decor', 'appliance', 'homeware']),
   
  ('Spareparts', 'spareparts', 'Auto and motorcycle parts, accessories, repairs', '🔧', 3,
   ARRAY['spareparts', 'auto', 'car', 'motorcycle', 'moto', 'parts', 'repair', 'garage', 'mechanic']),
   
  ('Salon & Beauty', 'salon_beauty', 'Hair salons, beauty services, cosmetics, spa', '💅', 4,
   ARRAY['salon', 'beauty', 'hair', 'cosmetic', 'spa', 'nail', 'barber', 'makeup', 'hairdresser']),
   
  ('Clothing & Fashion', 'clothing_fashion', 'Clothes, shoes, accessories, boutiques', '👔', 5,
   ARRAY['clothing', 'fashion', 'clothes', 'boutique', 'apparel', 'shoes', 'dress', 'jeans', 'wear']),
   
  ('Liquor Store', 'liquor_store', 'Wine, spirits, beer, alcoholic beverages', '🍷', 6,
   ARRAY['liquor', 'wine', 'beer', 'spirits', 'alcohol', 'drinks', 'beverage']),
   
  ('Mini Markets', 'mini_markets', 'Grocery stores, supermarkets, convenience stores', '🛒', 7,
   ARRAY['minimarket', 'grocery', 'supermarket', 'convenience', 'store', 'shop', 'mart']),
   
  ('Boutiques', 'boutiques', 'Specialty shops, gift stores, unique items', '🎁', 8,
   ARRAY['boutique', 'gift', 'specialty', 'unique', 'artisan', 'craft']),
   
  ('Office Supplies', 'office_supplies', 'Stationery, printing, business equipment', '📎', 9,
   ARRAY['office', 'stationery', 'printing', 'business', 'supplies', 'paper']),
   
  ('Pet Supplies', 'pet_supplies', 'Pet food, accessories, veterinary services', '🐕', 10,
   ARRAY['pet', 'animal', 'dog', 'cat', 'veterinary', 'vet']),
   
  ('Sports & Fitness', 'sports_fitness', 'Sporting goods, gym equipment, activewear', '⚽', 11,
   ARRAY['sports', 'fitness', 'gym', 'sporting', 'athletic', 'exercise']),
   
  ('Other Services', 'other_services', 'Miscellaneous services and businesses', '🏪', 99,
   ARRAY['other', 'service', 'misc', 'general'])
ON CONFLICT (slug) DO NOTHING;

-- 6. Create function to get businesses by tag
CREATE OR REPLACE FUNCTION get_businesses_by_tag(
  p_tag_slug TEXT,
  p_user_lat DOUBLE PRECISION,
  p_user_lon DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10.0,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  owner_whatsapp TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_text TEXT,
  tag TEXT,
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.owner_whatsapp,
    b.latitude,
    b.longitude,
    b.location_text,
    b.tag,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography
    ) / 1000.0 AS distance
  FROM business b
  INNER JOIN business_tag_assignments bta ON b.id = bta.business_id
  INNER JOIN business_tags bt ON bta.tag_id = bt.id
  WHERE 
    bt.slug = p_tag_slug
    AND b.is_active = true
    AND b.latitude IS NOT NULL
    AND b.longitude IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography,
      p_radius_km * 1000
    )
  ORDER BY distance
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Create function to get all active tags
CREATE OR REPLACE FUNCTION get_active_business_tags()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  icon TEXT,
  sort_order INTEGER,
  business_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id,
    bt.name,
    bt.slug,
    bt.description,
    bt.icon,
    bt.sort_order,
    COUNT(DISTINCT bta.business_id) AS business_count
  FROM business_tags bt
  LEFT JOIN business_tag_assignments bta ON bt.id = bta.tag_id
  WHERE bt.is_active = true
  GROUP BY bt.id, bt.name, bt.slug, bt.description, bt.icon, bt.sort_order
  ORDER BY bt.sort_order, bt.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Add RLS policies
ALTER TABLE business_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Anyone can read active tags
CREATE POLICY "Anyone can read active tags"
  ON business_tags FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Service role can manage tags
CREATE POLICY "Service role can manage tags"
  ON business_tags
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anyone can read tag assignments
CREATE POLICY "Anyone can read tag assignments"
  ON business_tag_assignments FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role can manage assignments
CREATE POLICY "Service role can manage tag assignments"
  ON business_tag_assignments
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 9. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_business_tags_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER business_tags_updated_at
  BEFORE UPDATE ON business_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_business_tags_timestamp();

-- 10. Create logging table for AI classifications
CREATE TABLE IF NOT EXISTS business_tag_classification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_description TEXT,
  original_tag TEXT,
  classified_tags JSONB, -- Array of {tag: string, confidence: number}
  ai_model TEXT,
  ai_response TEXT,
  processing_time_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classification_logs_business ON business_tag_classification_logs(business_id);
CREATE INDEX idx_classification_logs_created ON business_tag_classification_logs(created_at);
CREATE INDEX idx_classification_logs_success ON business_tag_classification_logs(success);

COMMIT;
