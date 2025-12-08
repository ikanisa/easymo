-- Rollback duplicate table creation
-- Date: 2025-12-08
-- Reason: Should have checked existing tables first, NOT create duplicates

BEGIN;

-- Drop the incorrectly created tables (all empty, no data loss)
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS menus CASCADE;
DROP TABLE IF EXISTS insurance_certificates CASCADE;

COMMIT;

-- Note: Will update unified-ocr code to use existing tables:
-- - menu_items (instead of items)
-- - menu_categories (instead of categories)
-- - driver_insurance_certificates (instead of insurance_certificates)
-- - Check if menus table is needed or use existing menu system
