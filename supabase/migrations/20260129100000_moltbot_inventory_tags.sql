-- =============================================================================
-- Vendor Inventory Tags for Product Taxonomy
-- Enables precise vendor filtering based on inventory capabilities
-- =============================================================================

BEGIN;

-- Vendor inventory tags table
CREATE TABLE IF NOT EXISTS public.vendor_inventory_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  
  -- Taxonomy fields
  category TEXT NOT NULL,             -- 'electronics', 'pharmacy', etc.
  subcategory TEXT,                   -- 'phone_accessories', 'prescription_meds'
  tag TEXT NOT NULL,                  -- normalized tag: 'iphone_case', 'charger'
  
  -- Specific attributes
  brand TEXT,                         -- 'Apple', 'Samsung'
  model TEXT,                         -- 'iPhone 15 Pro', 'Galaxy S24'
  
  -- Price range (in local currency, e.g., RWF)
  price_min INT,
  price_max INT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for category + tag lookups
CREATE INDEX IF NOT EXISTS idx_vendor_inventory_tags_category_tag 
  ON public.vendor_inventory_tags(category, tag) 
  WHERE is_active = TRUE;

-- Index for vendor + category lookups
CREATE INDEX IF NOT EXISTS idx_vendor_inventory_tags_vendor_category 
  ON public.vendor_inventory_tags(vendor_id, category);

-- Index for brand + model lookups (product-specific matching)
CREATE INDEX IF NOT EXISTS idx_vendor_inventory_tags_brand_model 
  ON public.vendor_inventory_tags(brand, model) 
  WHERE brand IS NOT NULL;

-- Composite index for full product matching
CREATE INDEX IF NOT EXISTS idx_vendor_inventory_tags_full_match
  ON public.vendor_inventory_tags(category, subcategory, brand, model)
  WHERE is_active = TRUE;

-- Trigger to update updated_at on modification
CREATE OR REPLACE FUNCTION public.update_vendor_inventory_tags_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_inventory_tags_updated_at ON public.vendor_inventory_tags;
CREATE TRIGGER vendor_inventory_tags_updated_at
  BEFORE UPDATE ON public.vendor_inventory_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendor_inventory_tags_updated_at();

-- RLS: service_role only
ALTER TABLE public.vendor_inventory_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_vendor_inventory_tags" ON public.vendor_inventory_tags;
CREATE POLICY "service_role_full_vendor_inventory_tags"
  ON public.vendor_inventory_tags FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- Function: search vendors by inventory tag
-- Returns vendors with matching inventory tags, prioritized by match quality
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_vendors_by_inventory(
  p_category TEXT,
  p_subcategory TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_brand TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_limit INT DEFAULT 15
)
RETURNS TABLE (
  vendor_id UUID,
  vendor_name TEXT,
  vendor_phone TEXT,
  match_type TEXT,           -- 'exact', 'brand', 'category'
  match_score INT,
  price_min INT,
  price_max INT
)
LANGUAGE sql
STABLE
AS $$
  WITH matched_tags AS (
    SELECT
      vit.vendor_id,
      v.name AS vendor_name,
      v.phone AS vendor_phone,
      vit.price_min,
      vit.price_max,
      CASE
        -- Exact match: brand + model
        WHEN p_brand IS NOT NULL 
             AND p_model IS NOT NULL 
             AND LOWER(vit.brand) = LOWER(p_brand)
             AND LOWER(vit.model) = LOWER(p_model)
        THEN 'exact'
        -- Brand match
        WHEN p_brand IS NOT NULL 
             AND LOWER(vit.brand) = LOWER(p_brand)
        THEN 'brand'
        -- Tag match
        WHEN p_tag IS NOT NULL 
             AND LOWER(vit.tag) = LOWER(p_tag)
        THEN 'tag'
        -- Subcategory match
        WHEN p_subcategory IS NOT NULL 
             AND LOWER(vit.subcategory) = LOWER(p_subcategory)
        THEN 'subcategory'
        -- Category match
        ELSE 'category'
      END AS match_type,
      CASE
        WHEN p_brand IS NOT NULL AND p_model IS NOT NULL 
             AND LOWER(vit.brand) = LOWER(p_brand) 
             AND LOWER(vit.model) = LOWER(p_model)
        THEN 100
        WHEN p_brand IS NOT NULL AND LOWER(vit.brand) = LOWER(p_brand)
        THEN 80
        WHEN p_tag IS NOT NULL AND LOWER(vit.tag) = LOWER(p_tag)
        THEN 70
        WHEN p_subcategory IS NOT NULL AND LOWER(vit.subcategory) = LOWER(p_subcategory)
        THEN 50
        ELSE 30
      END AS match_score
    FROM public.vendor_inventory_tags vit
    JOIN public.vendors v ON v.id = vit.vendor_id
    WHERE vit.is_active = TRUE
      AND v.is_active = TRUE
      AND LOWER(vit.category) = LOWER(p_category)
      AND (p_subcategory IS NULL OR LOWER(vit.subcategory) = LOWER(p_subcategory))
  )
  SELECT DISTINCT ON (vendor_id)
    vendor_id,
    vendor_name,
    vendor_phone,
    match_type,
    match_score,
    price_min,
    price_max
  FROM matched_tags
  ORDER BY vendor_id, match_score DESC
  LIMIT LEAST(p_limit, 15);
$$;

COMMENT ON TABLE public.vendor_inventory_tags IS 
  'Vendor inventory capabilities for taxonomy-based matching';

COMMENT ON FUNCTION public.search_vendors_by_inventory IS
  'Search vendors by inventory tags with match scoring';

COMMIT;
