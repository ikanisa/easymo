-- Create missing tables for unified-ocr
-- Date: 2025-12-08
-- Purpose: Support menu and vehicle OCR domains

BEGIN;

-- 1. Create menus table (for menu versioning)
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source TEXT NOT NULL DEFAULT 'ocr' CHECK (source IN ('ocr', 'manual', 'import')),
  source_file_ids TEXT[],
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bar_id, version)
);

CREATE INDEX IF NOT EXISTS idx_menus_bar_id ON menus(bar_id);
CREATE INDEX IF NOT EXISTS idx_menus_status ON menus(status);

-- 2. Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES menus(id) ON DELETE CASCADE,
  parent_category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_bar_id ON categories(bar_id);
CREATE INDEX IF NOT EXISTS idx_categories_menu_id ON categories(menu_id);

-- 3. Create items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES menus(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_description TEXT,
  price_minor INT NOT NULL DEFAULT 0, -- Price in cents/minor units
  currency TEXT,
  flags TEXT[] DEFAULT '{}', -- ['spicy', 'vegan', etc.]
  is_available BOOLEAN DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_bar_id ON items(bar_id);
CREATE INDEX IF NOT EXISTS idx_items_menu_id ON items(menu_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_available ON items(is_available) WHERE is_available = TRUE;

-- 4. Create insurance_certificates table (for vehicle domain)
CREATE TABLE IF NOT EXISTS insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  policy_no TEXT,
  insurer TEXT,
  effective_from DATE,
  expires_on DATE,
  ocr_raw JSONB,
  ocr_confidence FLOAT CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
  verified BOOLEAN DEFAULT FALSE,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_certs_vehicle_id ON insurance_certificates(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_insurance_certs_verified ON insurance_certificates(verified);
CREATE INDEX IF NOT EXISTS idx_insurance_certs_expires ON insurance_certificates(expires_on);

-- 5. Add RLS policies
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_certificates ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menus' AND policyname = 'menus_service_role') THEN
    CREATE POLICY menus_service_role ON menus USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'categories_service_role') THEN
    CREATE POLICY categories_service_role ON categories USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'items' AND policyname = 'items_service_role') THEN
    CREATE POLICY items_service_role ON items USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insurance_certificates' AND policyname = 'insurance_certs_service_role') THEN
    CREATE POLICY insurance_certs_service_role ON insurance_certificates USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- Verify creation
SELECT 
  'menus' as table_name, COUNT(*) as count FROM menus
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'items', COUNT(*) FROM items
UNION ALL
SELECT 'insurance_certificates', COUNT(*) FROM insurance_certificates;
