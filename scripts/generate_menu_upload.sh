#!/bin/bash
# Generate SQL file for uploading bar menu items

cat > /Users/jeanbosco/workspace/easymo/supabase/migrations/20251206170000_upload_bar_menu_items.sql << 'EOFMAIN'
-- =====================================================
-- UPLOAD BAR MENU ITEMS FROM CSV
-- Created: 2025-12-06
-- Description: Bulk upload menu items for all bars
-- Note: Uses UPSERT to handle duplicates
-- =====================================================

BEGIN;

-- Delete existing menu items to ensure clean upload
-- (Optional - remove if you want to preserve existing data)
-- DELETE FROM public.bar_menu_items;

-- Insert all menu items with conflict resolution
INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)
VALUES
-- Zion Reggae Bar (4d514423-222a-4b51-83ed-5202d3bf005b)
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Americano', 1.6, 'Coffees & Teas', true),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Aperol Spritz', 8, 'Apéritifs', true),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Asahi', 4.5, 'Bottled Beer & Ciders', true),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Avocado Sauce', 1.5, 'Burger Extras', true),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Bajtra Spritz', 8, 'Apéritifs', true),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Barbera D''Alba Superiore   Italy', 26.5, 'Red Wines', true),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Beef Carpaccio', 11.5, 'Starters to Share Crudités & Carpaccio', true)

ON CONFLICT (bar_id, item_name, category) 
DO UPDATE SET 
    price = EXCLUDED.price,
    bar_name = EXCLUDED.bar_name,
    is_available = EXCLUDED.is_available,
    updated_at = timezone('utc', now());

COMMIT;
EOFMAIN

echo "Migration file created successfully!"
echo "Location: supabase/migrations/20251206170000_upload_bar_menu_items.sql"
