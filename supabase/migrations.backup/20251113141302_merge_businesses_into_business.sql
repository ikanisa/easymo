BEGIN;

-- ============================================================================
-- Migration: Merge businesses table into business table
-- ============================================================================
-- Purpose: Consolidate duplicate business tables
-- - business table: Contains 885 imported businesses (from database dump)
-- - businesses table: Contains 4 user-created businesses (from WhatsApp flow)
-- Strategy: Migrate data from businesses -> business, then deprecate businesses
-- ============================================================================

-- Step 1: Ensure business table has all necessary columns
-- (Most columns already exist, just ensure compatibility)

-- Add category_name column to business if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'business' AND column_name = 'category_name') THEN
        ALTER TABLE business ADD COLUMN category_name TEXT;
        CREATE INDEX idx_business_category_name ON business(category_name);
    END IF;
END $$;

-- Step 2: Migrate data from businesses to business
-- Insert businesses that don't conflict with existing names
INSERT INTO business (
    id,
    owner_whatsapp,
    name,
    description,
    is_active,
    created_at,
    category_id,
    catalog_url,
    location_text,
    lat,
    lng,
    owner_user_id,
    location,
    status,
    name_embedding,
    category_name
)
SELECT 
    b.id,
    b.owner_whatsapp,
    b.name,
    b.description,
    b.is_active,
    b.created_at,
    b.category_id::TEXT, -- Convert bigint to text
    b.catalog_url,
    b.location_text,
    b.lat,
    b.lng,
    b.owner_user_id,
    COALESCE(b.location, b.geo), -- Use location, fallback to geo
    COALESCE(b.status, 'active')::TEXT,
    b.name_embedding,
    b.category_name
FROM businesses b
WHERE NOT EXISTS (
    SELECT 1 FROM business 
    WHERE business.name = b.name
)
ON CONFLICT (name) DO NOTHING;

-- Step 3: Handle the business_whatsapp_numbers foreign key
-- Update references to point to business table
DO $$
BEGIN
    -- Check if business_whatsapp_numbers table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'business_whatsapp_numbers') THEN
        
        -- Drop existing foreign key
        ALTER TABLE business_whatsapp_numbers 
        DROP CONSTRAINT IF EXISTS business_whatsapp_numbers_business_id_fkey;
        
        -- Add new foreign key pointing to business table
        ALTER TABLE business_whatsapp_numbers 
        ADD CONSTRAINT business_whatsapp_numbers_business_id_fkey 
        FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Create a view for backward compatibility
-- This allows existing code to still reference "businesses" temporarily
CREATE OR REPLACE VIEW businesses_view AS
SELECT 
    id,
    owner_whatsapp,
    name,
    description,
    location as geo, -- Map to old column name
    is_active,
    created_at,
    category_id::BIGINT, -- Convert back to bigint for compatibility
    catalog_url,
    location_text,
    lat,
    lng,
    owner_user_id,
    location,
    status,
    name_embedding,
    category_name
FROM business;

-- Step 5: Drop policies on businesses table
DROP POLICY IF EXISTS "businesses_block_writes" ON businesses;
DROP POLICY IF EXISTS "businesses_read_all" ON businesses;
DROP POLICY IF EXISTS "deny_all_biz" ON businesses;

-- Step 6: Rename businesses table to businesses_deprecated (for safety, don't drop yet)
ALTER TABLE businesses RENAME TO businesses_deprecated;

-- Step 7: Create businesses as an alias view to business
-- This ensures WhatsApp flow inserts go to business table
CREATE OR REPLACE VIEW businesses AS
SELECT 
    id,
    owner_whatsapp,
    name,
    description,
    location as geo,
    is_active,
    created_at,
    category_id::BIGINT,
    catalog_url,
    location_text,
    lat,
    lng,
    owner_user_id,
    location,
    status,
    name_embedding,
    category_name
FROM business;

-- Step 8: Create INSTEAD OF triggers for the businesses view
-- This allows INSERTs to the view to go to business table
CREATE OR REPLACE FUNCTION businesses_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO business (
        owner_whatsapp,
        name,
        description,
        is_active,
        category_id,
        catalog_url,
        location_text,
        lat,
        lng,
        owner_user_id,
        location,
        status,
        category_name
    ) VALUES (
        NEW.owner_whatsapp,
        NEW.name,
        NEW.description,
        COALESCE(NEW.is_active, true),
        NEW.category_id::TEXT,
        NEW.catalog_url,
        NEW.location_text,
        NEW.lat,
        NEW.lng,
        NEW.owner_user_id,
        NEW.location,
        COALESCE(NEW.status, 'active'),
        NEW.category_name
    )
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER businesses_insert_instead
INSTEAD OF INSERT ON businesses
FOR EACH ROW
EXECUTE FUNCTION businesses_insert_trigger();

-- Step 9: Add UPDATE and DELETE triggers for completeness
CREATE OR REPLACE FUNCTION businesses_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE business
    SET 
        owner_whatsapp = NEW.owner_whatsapp,
        name = NEW.name,
        description = NEW.description,
        is_active = NEW.is_active,
        category_id = NEW.category_id::TEXT,
        catalog_url = NEW.catalog_url,
        location_text = NEW.location_text,
        lat = NEW.lat,
        lng = NEW.lng,
        owner_user_id = NEW.owner_user_id,
        location = NEW.location,
        status = NEW.status,
        category_name = NEW.category_name
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER businesses_update_instead
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

CREATE OR REPLACE TRIGGER businesses_delete_instead
INSTEAD OF DELETE ON businesses
FOR EACH ROW
EXECUTE FUNCTION businesses_delete_trigger();

-- Step 10: Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON businesses TO authenticated, anon, service_role;

-- Step 11: Add comment for documentation
COMMENT ON VIEW businesses IS 'Legacy view: redirects to business table. Use business table directly for new code.';
COMMENT ON TABLE business IS 'Unified business directory. Contains both imported and user-created businesses.';
COMMENT ON TABLE businesses_deprecated IS 'DEPRECATED: Old businesses table. Data migrated to business. Safe to drop after verification.';

COMMIT;
