-- Upload menu items from CSV data
BEGIN;

-- First, let's check if we need to handle the bars table
-- The CSV has bar names and bar_ids, so bars should exist

-- Insert menu items from the CSV
-- Format: bar_name, bar_id, item_name, price, category

-- Zion Reggae Bar items
INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)
VALUES 
    ('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Americano', 1.6, 'Coffees & Teas', true),
    ('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Aperol Spritz', 8, 'Apéritifs', true),
    ('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Asahi', 4.5, 'Bottled Beer & Ciders', true)
ON CONFLICT (bar_id, item_name, category) DO UPDATE
SET 
    price = EXCLUDED.price,
    bar_name = EXCLUDED.bar_name,
    updated_at = timezone('utc', now());

COMMIT;
