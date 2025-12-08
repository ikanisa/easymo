-- =====================================================================
-- PREFERRED SUPPLIERS NETWORK
-- =====================================================================
-- Implements a priority supplier system for goods/products marketplace
-- Enables intelligent supplier recommendations based on location, product
-- availability, partnership tiers, and benefits (discounts, free delivery)
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. PREFERRED SUPPLIERS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.preferred_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL CHECK (business_type IN ('grocery', 'pharmacy', 'hardware', 'farm_produce', 'general')),
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  whatsapp_number TEXT,
  
  -- Location
  address TEXT,
  city TEXT,
  district TEXT,
  country TEXT DEFAULT 'Rwanda',
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  
  -- Partnership details
  partnership_tier TEXT DEFAULT 'standard' CHECK (partnership_tier IN ('standard', 'silver', 'gold', 'platinum')),
  commission_rate NUMERIC(5, 2) DEFAULT 5.00, -- % EasyMO takes
  priority_score INTEGER DEFAULT 0, -- Higher = more priority
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  verified_at TIMESTAMPTZ,
  partnership_started_at TIMESTAMPTZ DEFAULT now(),
  partnership_expires_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_commission CHECK (commission_rate >= 0 AND commission_rate <= 100),
  CONSTRAINT valid_coordinates CHECK (
    (lat IS NULL AND lng IS NULL) OR 
    (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_preferred_suppliers_location ON public.preferred_suppliers (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_preferred_suppliers_tier ON public.preferred_suppliers (partnership_tier, is_active);
CREATE INDEX IF NOT EXISTS idx_preferred_suppliers_type ON public.preferred_suppliers (business_type, is_active);
CREATE INDEX IF NOT EXISTS idx_preferred_suppliers_active ON public.preferred_suppliers (is_active, priority_score DESC);

-- =====================================================================
-- 2. SUPPLIER PRODUCTS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.preferred_suppliers(id) ON DELETE CASCADE,
  
  -- Product details
  product_name TEXT NOT NULL,
  product_category TEXT NOT NULL, -- 'vegetables', 'fruits', 'medicines', 'tools', 'grains', etc.
  unit TEXT NOT NULL, -- 'kg', 'piece', 'liter', 'box', 'bag', etc.
  
  -- Pricing
  price_per_unit NUMERIC(12, 2),
  currency TEXT DEFAULT 'RWF',
  
  -- Quantity limits
  min_quantity NUMERIC(10, 2) DEFAULT 1,
  max_quantity NUMERIC(10, 2),
  
  -- Stock
  in_stock BOOLEAN DEFAULT true,
  stock_quantity NUMERIC(10, 2),
  last_stock_update TIMESTAMPTZ DEFAULT now(),
  
  -- Description
  description TEXT,
  image_url TEXT,
  
  -- Search optimization
  search_keywords TEXT[], -- For better matching: ['potato', 'irish potato', 'white potato']
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_price CHECK (price_per_unit IS NULL OR price_per_unit >= 0),
  CONSTRAINT valid_quantities CHECK (
    min_quantity > 0 AND 
    (max_quantity IS NULL OR max_quantity >= min_quantity)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON public.supplier_products (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_category ON public.supplier_products (product_category, in_stock);
CREATE INDEX IF NOT EXISTS idx_supplier_products_name ON public.supplier_products USING gin(to_tsvector('english', product_name));
CREATE INDEX IF NOT EXISTS idx_supplier_products_keywords ON public.supplier_products USING gin(search_keywords);
CREATE INDEX IF NOT EXISTS idx_supplier_products_stock ON public.supplier_products (in_stock, stock_quantity);

-- =====================================================================
-- 3. SUPPLIER BENEFITS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.supplier_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.preferred_suppliers(id) ON DELETE CASCADE,
  
  -- Benefit type
  benefit_type TEXT NOT NULL CHECK (benefit_type IN ('discount', 'free_delivery', 'cashback', 'loyalty_points', 'bundle_deal')),
  benefit_name TEXT NOT NULL,
  benefit_description TEXT,
  
  -- Discount details
  discount_percent NUMERIC(5, 2), -- For discount/cashback types
  discount_amount NUMERIC(12, 2), -- Fixed amount discount
  
  -- Conditions
  min_order_amount NUMERIC(12, 2), -- Minimum order to qualify
  max_discount_amount NUMERIC(12, 2), -- Cap on discount
  
  -- Free delivery details
  delivery_radius_km NUMERIC(5, 2), -- For free delivery
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  
  -- Terms
  terms_conditions TEXT,
  applies_to_products TEXT[], -- Specific product IDs or categories
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_discount_percent CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
  CONSTRAINT valid_amounts CHECK (
    (discount_amount IS NULL OR discount_amount >= 0) AND
    (min_order_amount IS NULL OR min_order_amount >= 0) AND
    (max_discount_amount IS NULL OR max_discount_amount >= 0)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_benefits_supplier ON public.supplier_benefits (supplier_id, is_active);
CREATE INDEX IF NOT EXISTS idx_supplier_benefits_type ON public.supplier_benefits (benefit_type, is_active);
CREATE INDEX IF NOT EXISTS idx_supplier_benefits_validity ON public.supplier_benefits (is_active, valid_from, valid_until);

-- =====================================================================
-- 4. SUPPLIER SERVICE AREAS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.supplier_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.preferred_suppliers(id) ON DELETE CASCADE,
  
  -- Area definition
  area_name TEXT NOT NULL, -- 'Kigali', 'Nyarugenge', 'Kimironko', etc.
  area_type TEXT NOT NULL CHECK (area_type IN ('city', 'district', 'sector', 'radius')),
  
  -- For radius-based areas
  radius_km NUMERIC(5, 2), -- If area_type = 'radius'
  center_lat NUMERIC(10, 7),
  center_lng NUMERIC(10, 7),
  
  -- Delivery details
  delivery_fee NUMERIC(12, 2) DEFAULT 0,
  min_order_for_free_delivery NUMERIC(12, 2),
  estimated_delivery_time_minutes INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_radius CHECK (radius_km IS NULL OR radius_km > 0),
  CONSTRAINT valid_coords CHECK (
    (center_lat IS NULL AND center_lng IS NULL) OR 
    (center_lat BETWEEN -90 AND 90 AND center_lng BETWEEN -180 AND 180)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_service_areas_supplier ON public.supplier_service_areas (supplier_id, is_active);
CREATE INDEX IF NOT EXISTS idx_supplier_service_areas_location ON public.supplier_service_areas (center_lat, center_lng) WHERE center_lat IS NOT NULL;

-- =====================================================================
-- 5. SUPPLIER ORDERS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.preferred_suppliers(id),
  user_id UUID REFERENCES public.profiles(id),
  
  -- Order details
  order_number TEXT UNIQUE NOT NULL,
  items JSONB NOT NULL, -- Array of {product_id, product_name, quantity, unit, price_per_unit}
  
  -- Pricing
  subtotal NUMERIC(12, 2) NOT NULL,
  delivery_fee NUMERIC(12, 2) DEFAULT 0,
  discount_amount NUMERIC(12, 2) DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL,
  
  -- Benefits applied
  benefits_applied JSONB DEFAULT '[]'::jsonb, -- Array of benefit IDs and descriptions
  
  -- Delivery
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC(10, 7),
  delivery_lng NUMERIC(10, 7),
  delivery_phone TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  
  -- Payment
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method TEXT,
  payment_reference TEXT,
  
  -- Timestamps
  confirmed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier ON public.supplier_orders (supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_user ON public.supplier_orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON public.supplier_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_number ON public.supplier_orders (order_number);

-- Generate unique order number
CREATE OR REPLACE FUNCTION generate_supplier_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  counter := (SELECT COUNT(*) FROM public.supplier_orders) + 1;
  new_number := 'SUP-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_supplier_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_supplier_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_supplier_order_number
BEFORE INSERT ON public.supplier_orders
FOR EACH ROW
EXECUTE FUNCTION set_supplier_order_number();

-- =====================================================================
-- 6. SEARCH FUNCTION - PREFERRED SUPPLIERS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.search_preferred_suppliers(
  p_product_query TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_radius_km NUMERIC DEFAULT 10,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  supplier_id UUID,
  business_name TEXT,
  business_type TEXT,
  contact_phone TEXT,
  whatsapp_number TEXT,
  distance_km NUMERIC,
  product_name TEXT,
  price_per_unit NUMERIC,
  unit TEXT,
  stock_quantity NUMERIC,
  is_preferred BOOLEAN,
  partnership_tier TEXT,
  priority_score INTEGER,
  benefits JSONB,
  total_price NUMERIC,
  delivery_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH supplier_distances AS (
    SELECT 
      ps.id,
      ps.business_name,
      ps.business_type,
      ps.contact_phone,
      ps.whatsapp_number,
      ps.partnership_tier,
      ps.priority_score,
      ps.lat,
      ps.lng,
      CASE 
        WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND ps.lat IS NOT NULL AND ps.lng IS NOT NULL THEN
          (6371 * acos(
            cos(radians(p_user_lat)) * cos(radians(ps.lat)) *
            cos(radians(ps.lng) - radians(p_user_lng)) +
            sin(radians(p_user_lat)) * sin(radians(ps.lat))
          ))::NUMERIC(10, 2)
        ELSE NULL
      END AS distance_km
    FROM public.preferred_suppliers ps
    WHERE ps.is_active = true
      AND (p_user_lat IS NULL OR p_user_lng IS NULL OR ps.lat IS NULL OR ps.lng IS NULL OR
        (6371 * acos(
          cos(radians(p_user_lat)) * cos(radians(ps.lat)) *
          cos(radians(ps.lng) - radians(p_user_lng)) +
          sin(radians(p_user_lat)) * sin(radians(ps.lat))
        )) <= p_radius_km
      )
  ),
  matching_products AS (
    SELECT 
      sp.supplier_id,
      sp.product_name,
      sp.price_per_unit,
      sp.unit,
      sp.stock_quantity,
      sp.in_stock
    FROM public.supplier_products sp
    WHERE sp.in_stock = true
      AND (
        sp.product_name ILIKE '%' || p_product_query || '%'
        OR p_product_query = ANY(sp.search_keywords)
        OR sp.product_category ILIKE '%' || p_product_query || '%'
      )
  ),
  supplier_benefits_agg AS (
    SELECT 
      sb.supplier_id,
      jsonb_agg(
        jsonb_build_object(
          'type', sb.benefit_type,
          'name', sb.benefit_name,
          'description', sb.benefit_description,
          'discount_percent', sb.discount_percent,
          'discount_amount', sb.discount_amount,
          'min_order', sb.min_order_amount,
          'free_delivery_radius', sb.delivery_radius_km
        ) ORDER BY sb.discount_percent DESC NULLS LAST
      ) AS benefits
    FROM public.supplier_benefits sb
    WHERE sb.is_active = true
      AND (sb.valid_until IS NULL OR sb.valid_until > now())
    GROUP BY sb.supplier_id
  ),
  service_areas AS (
    SELECT 
      ssa.supplier_id,
      bool_or(
        CASE 
          WHEN p_user_lat IS NULL OR p_user_lng IS NULL THEN true
          WHEN ssa.area_type = 'radius' AND ssa.center_lat IS NOT NULL AND ssa.center_lng IS NOT NULL THEN
            (6371 * acos(
              cos(radians(p_user_lat)) * cos(radians(ssa.center_lat)) *
              cos(radians(ssa.center_lng) - radians(p_user_lng)) +
              sin(radians(p_user_lat)) * sin(radians(ssa.center_lat))
            )) <= ssa.radius_km
          ELSE true
        END
      ) AS delivery_available
    FROM public.supplier_service_areas ssa
    WHERE ssa.is_active = true
    GROUP BY ssa.supplier_id
  )
  SELECT 
    sd.id AS supplier_id,
    sd.business_name,
    sd.business_type,
    sd.contact_phone,
    sd.whatsapp_number,
    sd.distance_km,
    mp.product_name,
    mp.price_per_unit,
    mp.unit,
    mp.stock_quantity,
    true AS is_preferred,
    sd.partnership_tier,
    sd.priority_score,
    COALESCE(sba.benefits, '[]'::jsonb) AS benefits,
    mp.price_per_unit AS total_price,
    COALESCE(sa.delivery_available, false) AS delivery_available
  FROM supplier_distances sd
  INNER JOIN matching_products mp ON sd.id = mp.supplier_id
  LEFT JOIN supplier_benefits_agg sba ON sd.id = sba.supplier_id
  LEFT JOIN service_areas sa ON sd.id = sa.supplier_id
  ORDER BY 
    -- Priority: Platinum > Gold > Silver > Standard
    CASE sd.partnership_tier
      WHEN 'platinum' THEN 1
      WHEN 'gold' THEN 2
      WHEN 'silver' THEN 3
      ELSE 4
    END,
    -- Then by priority score (higher is better)
    sd.priority_score DESC,
    -- Then by distance (closer is better)
    sd.distance_km ASC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_preferred_suppliers(TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER) 
  TO authenticated, anon, service_role;

-- =====================================================================
-- 7. COMBINED SEARCH FUNCTION (Preferred + Regular)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.search_suppliers_combined(
  p_product_query TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_radius_km NUMERIC DEFAULT 10,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  supplier_id UUID,
  business_name TEXT,
  business_type TEXT,
  contact_phone TEXT,
  whatsapp_number TEXT,
  distance_km NUMERIC,
  product_name TEXT,
  price_per_unit NUMERIC,
  unit TEXT,
  stock_quantity NUMERIC,
  is_preferred BOOLEAN,
  partnership_tier TEXT,
  priority_score INTEGER,
  benefits JSONB,
  total_price NUMERIC,
  delivery_available BOOLEAN
) AS $$
BEGIN
  -- First, get preferred suppliers
  RETURN QUERY
  SELECT * FROM public.search_preferred_suppliers(
    p_product_query,
    p_user_lat,
    p_user_lng,
    p_radius_km,
    p_limit
  );
  
  -- If we don't have enough results, fill with regular businesses
  -- (This would integrate with existing businesses table)
  -- Implementation depends on your current business schema
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.search_suppliers_combined(TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER) 
  TO authenticated, anon, service_role;

-- =====================================================================
-- 8. UPDATED_AT TRIGGERS
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_preferred_suppliers_updated_at
BEFORE UPDATE ON public.preferred_suppliers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_products_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_benefits_updated_at
BEFORE UPDATE ON public.supplier_benefits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_service_areas_updated_at
BEFORE UPDATE ON public.supplier_service_areas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_orders_updated_at
BEFORE UPDATE ON public.supplier_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 9. RLS POLICIES
-- =====================================================================

-- Preferred suppliers: Public read, admin write
ALTER TABLE public.preferred_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers are viewable by everyone" ON public.preferred_suppliers;
CREATE POLICY "Suppliers are viewable by everyone"
ON public.preferred_suppliers FOR SELECT
TO authenticated, anon
USING (is_active = true);

DROP POLICY IF EXISTS "Suppliers are manageable by service role" ON public.preferred_suppliers;
CREATE POLICY "Suppliers are manageable by service role"
ON public.preferred_suppliers FOR ALL
TO service_role
USING (true);

-- Supplier products: Public read
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.supplier_products;
CREATE POLICY "Products are viewable by everyone"
ON public.supplier_products FOR SELECT
TO authenticated, anon
USING (in_stock = true);

DROP POLICY IF EXISTS "Products are manageable by service role" ON public.supplier_products;
CREATE POLICY "Products are manageable by service role"
ON public.supplier_products FOR ALL
TO service_role
USING (true);

-- Supplier benefits: Public read
ALTER TABLE public.supplier_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Benefits are viewable by everyone" ON public.supplier_benefits;
CREATE POLICY "Benefits are viewable by everyone"
ON public.supplier_benefits FOR SELECT
TO authenticated, anon
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

DROP POLICY IF EXISTS "Benefits are manageable by service role" ON public.supplier_benefits;
CREATE POLICY "Benefits are manageable by service role"
ON public.supplier_benefits FOR ALL
TO service_role
USING (true);

-- Service areas: Public read
ALTER TABLE public.supplier_service_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service areas are viewable by everyone" ON public.supplier_service_areas;
CREATE POLICY "Service areas are viewable by everyone"
ON public.supplier_service_areas FOR SELECT
TO authenticated, anon
USING (is_active = true);

DROP POLICY IF EXISTS "Service areas are manageable by service role" ON public.supplier_service_areas;
CREATE POLICY "Service areas are manageable by service role"
ON public.supplier_service_areas FOR ALL
TO service_role
USING (true);

-- Supplier orders: Users can view their own orders
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own orders" ON public.supplier_orders;
CREATE POLICY "Users can view their own orders"
ON public.supplier_orders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own orders" ON public.supplier_orders;
CREATE POLICY "Users can create their own orders"
ON public.supplier_orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all orders" ON public.supplier_orders;
CREATE POLICY "Service role can manage all orders"
ON public.supplier_orders FOR ALL
TO service_role
USING (true);

-- =====================================================================
-- 10. SAMPLE SEED DATA
-- =====================================================================

-- Insert sample preferred supplier
INSERT INTO public.preferred_suppliers (
  business_name, business_type, contact_phone, whatsapp_number,
  address, city, district, country, lat, lng,
  partnership_tier, commission_rate, priority_score, is_active
) VALUES (
  'Kigali Fresh Market',
  'grocery',
  '+250788123456',
  '+250788123456',
  'KN 5 Ave, Kigali',
  'Kigali',
  'Nyarugenge',
  'Rwanda',
  -1.9441,
  30.0619,
  'platinum',
  3.50,
  100,
  true
) ON CONFLICT DO NOTHING;

-- Get the supplier ID for sample products
DO $$
DECLARE
  supplier_id UUID;
BEGIN
  SELECT id INTO supplier_id FROM public.preferred_suppliers WHERE business_name = 'Kigali Fresh Market' LIMIT 1;
  
  IF supplier_id IS NOT NULL THEN
    -- Insert sample products
    INSERT INTO public.supplier_products (
      supplier_id, product_name, product_category, unit, price_per_unit,
      min_quantity, in_stock, search_keywords
    ) VALUES
    (supplier_id, 'Potatoes (Irish)', 'vegetables', 'kg', 800, 1, true, ARRAY['potato', 'irish potato', 'white potato']),
    (supplier_id, 'Tomatoes', 'vegetables', 'kg', 1200, 1, true, ARRAY['tomato', 'fresh tomato']),
    (supplier_id, 'Onions', 'vegetables', 'kg', 900, 1, true, ARRAY['onion', 'red onion']),
    (supplier_id, 'Carrots', 'vegetables', 'kg', 1000, 1, true, ARRAY['carrot', 'fresh carrot'])
    ON CONFLICT DO NOTHING;
    
    -- Insert sample benefits
    INSERT INTO public.supplier_benefits (
      supplier_id, benefit_type, benefit_name, benefit_description,
      discount_percent, min_order_amount, is_active
    ) VALUES
    (supplier_id, 'discount', '10% EasyMO Discount', '10% discount for all EasyMO users', 10.00, 5000, true),
    (supplier_id, 'free_delivery', 'Free Delivery', 'Free delivery for orders over 5,000 RWF', NULL, 5000, true)
    ON CONFLICT DO NOTHING;
    
    -- Insert sample service area
    INSERT INTO public.supplier_service_areas (
      supplier_id, area_name, area_type, radius_km, center_lat, center_lng,
      delivery_fee, min_order_for_free_delivery, is_active
    ) VALUES
    (supplier_id, 'Kigali Central', 'radius', 10, -1.9441, 30.0619, 1000, 5000, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

COMMIT;
