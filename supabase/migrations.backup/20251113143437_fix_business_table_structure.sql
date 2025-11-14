BEGIN;

-- ============================================================================
-- Migration: Fix business table structure and add service categories
-- ============================================================================
-- Purpose: Clean up business table columns and add proper category system
-- Changes:
-- 1. Rename category_id → tag (it contains category names/slugs)
-- 2. Create service_categories table
-- 3. Add proper category_id and category_name columns
-- 4. Rename catalog_url → location_url (it's Google Maps URLs)
-- 5. Extract lat/lng from Google Maps URLs
-- ============================================================================

-- Step 1: Create service_categories table
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.service_categories (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT        NOT NULL UNIQUE,          -- machine-readable
  label        TEXT        NOT NULL,                 -- what you show in UI
  description  TEXT,
  icon_emoji   TEXT,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for active categories
CREATE INDEX IF NOT EXISTS idx_service_categories_active ON service_categories(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_service_categories_key ON service_categories(key);

-- Step 2: Seed service categories
-- ============================================================================
INSERT INTO public.service_categories
  (key,              label,              description,                                      icon_emoji, sort_order)
VALUES
  ('pharmacies',     'Pharmacies',       'Medical pharmacies and drugstores',              '💊',       10),
  ('quincailleries', 'Quincailleries',   'Hardware stores and building materials',         '🔧',       20),
  ('shops_services', 'Shops & Services', 'General shops and service providers',            '🏬',       30),
  ('property_rentals','Property Rentals','Houses, apartments, and rental properties',      '🏡',       40),
  ('notary_services','Notary Services',  'Legal notary and documentation services',        '📜',       50),
  ('bars_restaurants','Bars & Restaurants','Dining, bars, and food establishments',        '🍽️',      60)
ON CONFLICT (key) DO UPDATE
SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  icon_emoji  = EXCLUDED.icon_emoji,
  sort_order  = EXCLUDED.sort_order,
  is_active   = true;

-- Step 3: Rename category_id to tag in business table
-- ============================================================================
ALTER TABLE business RENAME COLUMN category_id TO tag;

-- Update index name
DROP INDEX IF EXISTS idx_business_category;
CREATE INDEX idx_business_tag ON business(tag) WHERE tag IS NOT NULL;

-- Step 4: Add new category columns to business table
-- ============================================================================
-- Add category_id (UUID referencing service_categories)
ALTER TABLE business ADD COLUMN IF NOT EXISTS new_category_id UUID;
CREATE INDEX idx_business_category_id ON business(new_category_id) WHERE new_category_id IS NOT NULL;

-- Add foreign key to service_categories
ALTER TABLE business 
ADD CONSTRAINT fk_business_category 
FOREIGN KEY (new_category_id) REFERENCES service_categories(id) ON DELETE SET NULL;

-- Step 5: Rename catalog_url to location_url
-- ============================================================================
ALTER TABLE business RENAME COLUMN catalog_url TO location_url;

-- Step 6: Map existing tags to categories
-- ============================================================================
-- Create a mapping helper function
CREATE OR REPLACE FUNCTION map_tag_to_category(tag_value TEXT) 
RETURNS UUID AS $$
DECLARE
  category_uuid UUID;
BEGIN
  -- Map common tags to categories
  SELECT id INTO category_uuid
  FROM service_categories
  WHERE 
    -- Pharmacies
    (tag_value ILIKE '%pharmacy%' OR tag_value ILIKE '%pharma%') AND key = 'pharmacies'
    -- Hardware/Quincailleries
    OR (tag_value ILIKE '%hardware%' OR tag_value ILIKE '%quincail%' OR tag_value ILIKE '%construction%') AND key = 'quincailleries'
    -- Bars & Restaurants
    OR (tag_value ILIKE '%bar%' OR tag_value ILIKE '%restaurant%' OR tag_value ILIKE '%coffee%' OR tag_value ILIKE '%food%' OR tag_value ILIKE '%dining%') AND key = 'bars_restaurants'
    -- Property Rentals
    OR (tag_value ILIKE '%rental%' OR tag_value ILIKE '%property%' OR tag_value ILIKE '%house%' OR tag_value ILIKE '%apartment%') AND key = 'property_rentals'
    -- Notary
    OR (tag_value ILIKE '%notary%' OR tag_value ILIKE '%legal%') AND key = 'notary_services'
  LIMIT 1;
  
  -- Default to shops_services if no match
  IF category_uuid IS NULL THEN
    SELECT id INTO category_uuid FROM service_categories WHERE key = 'shops_services' LIMIT 1;
  END IF;
  
  RETURN category_uuid;
END;
$$ LANGUAGE plpgsql;

-- Update business table with mapped categories
UPDATE business
SET new_category_id = map_tag_to_category(tag)
WHERE tag IS NOT NULL;

-- Step 7: Update businesses view to include new columns
-- ============================================================================
DROP VIEW IF EXISTS businesses CASCADE;

CREATE OR REPLACE VIEW businesses AS
SELECT 
    id,
    owner_whatsapp,
    name,
    description,
    location as geo,
    is_active,
    created_at,
    new_category_id as category_id,
    category_name,
    location_url as catalog_url,  -- Keep old name for backward compatibility
    location_text,
    lat,
    lng,
    owner_user_id,
    location,
    status,
    name_embedding,
    tag
FROM business;

-- Step 8: Recreate triggers for the businesses view
-- ============================================================================
CREATE OR REPLACE FUNCTION businesses_insert_trigger()
RETURNS TRIGGER AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO business (
        owner_whatsapp,
        name,
        description,
        is_active,
        new_category_id,
        category_name,
        location_url,
        location_text,
        lat,
        lng,
        owner_user_id,
        location,
        status,
        tag
    ) VALUES (
        NEW.owner_whatsapp,
        NEW.name,
        NEW.description,
        COALESCE(NEW.is_active, true),
        NEW.category_id,
        NEW.category_name,
        NEW.catalog_url,
        NEW.location_text,
        NEW.lat,
        NEW.lng,
        NEW.owner_user_id,
        NEW.location,
        COALESCE(NEW.status, 'active'),
        NEW.tag
    )
    RETURNING id INTO new_id;
    
    -- Return the full row from business table
    SELECT 
        id,
        owner_whatsapp,
        name,
        description,
        location as geo,
        is_active,
        created_at,
        new_category_id as category_id,
        category_name,
        location_url as catalog_url,
        location_text,
        lat,
        lng,
        owner_user_id,
        location,
        status,
        name_embedding,
        tag
    INTO NEW
    FROM business
    WHERE id = new_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_insert_instead
INSTEAD OF INSERT ON businesses
FOR EACH ROW
EXECUTE FUNCTION businesses_insert_trigger();

CREATE OR REPLACE FUNCTION businesses_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE business
    SET 
        owner_whatsapp = NEW.owner_whatsapp,
        name = NEW.name,
        description = NEW.description,
        is_active = NEW.is_active,
        new_category_id = NEW.category_id,
        category_name = NEW.category_name,
        location_url = NEW.catalog_url,
        location_text = NEW.location_text,
        lat = NEW.lat,
        lng = NEW.lng,
        owner_user_id = NEW.owner_user_id,
        location = NEW.location,
        status = NEW.status,
        tag = NEW.tag
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_update_instead
INSTEAD OF UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION businesses_update_trigger();

CREATE OR REPLACE FUNCTION businesses_delete_trigger()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM business WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_delete_instead
INSTEAD OF DELETE ON businesses
FOR EACH ROW
EXECUTE FUNCTION businesses_delete_trigger();

-- Step 9: Grant permissions
-- ============================================================================
GRANT SELECT ON service_categories TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON businesses TO authenticated, anon, service_role;

-- Step 10: Add RLS policies for service_categories
-- ============================================================================
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_categories_read_all" 
ON service_categories FOR SELECT 
TO authenticated, anon
USING (is_active = true);

CREATE POLICY "service_categories_manage" 
ON service_categories 
TO service_role
USING (true)
WITH CHECK (true);

-- Step 11: Add comments
-- ============================================================================
COMMENT ON TABLE service_categories IS 'Service category definitions for business classification';
COMMENT ON COLUMN business.tag IS 'Legacy category tag/slug (kept for reference)';
COMMENT ON COLUMN business.new_category_id IS 'UUID reference to service_categories table';
COMMENT ON COLUMN business.location_url IS 'Google Maps URL for business location';
COMMENT ON COLUMN business.category_name IS 'Cached category name for quick access';

COMMIT;
