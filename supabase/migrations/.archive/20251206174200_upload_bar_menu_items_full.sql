-- Upload all bar menu items
-- Generated from CSV data

BEGIN;

-- Clear existing entries to avoid duplicates
DELETE FROM public.bar_menu_items WHERE bar_id IN (
  SELECT DISTINCT bar_id::uuid FROM (VALUES 
    ('4d514423-222a-4b51-83ed-5202d3bf005b'::uuid),
    ('b0d78420-13f8-49d7-b64b-90ad1fbe1fba'::uuid),
    ('ba00fd27-c4f3-4cca-ad4f-a19bc2acad46'::uuid)
  ) AS bars(bar_id)
);

INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category) VALUES
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Americano', 1.6, 'Coffees & Teas'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Aperol Spritz', 8.0, 'Apéritifs'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Asahi', 4.5, 'Bottled Beer & Ciders'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Avocado Sauce', 1.5, 'Burger Extras'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Bajtra Spritz', 8.0, 'Apéritifs'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Barbera D''Alba Superiore   Italy', 26.5, 'Red Wines'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Beef Carpaccio', 11.5, 'Starters to Share Crudités & Carpaccio'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Beef Rib Eye', 28.5, 'Mains'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Beef Teriyaki', 13.5, 'Salads'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Beef Teriyaki Wrap', 10.0, 'Wraps Served Until 6PM)'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Beer Tower 3L)', 25.0, 'Tap Beer & Beer Tower'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Beetroot Carpaccio', 8.5, 'Starters to Share Crudités & Carpaccio'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Berry Mule', 10.0, 'Signature Cocktails'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Black Tea with Fresh Milk', 1.0, 'Coffees & Teas'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Blooming Rose', 6.0, 'Mocktails Non Alcoholic Cocktails)'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Blueberry Dream', 6.5, 'Smoothies & Fresh Juices'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Boost Your Smoothie', 0.5, 'Smoothies & Fresh Juices'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Bruschetta Mare e Monti', 13.0, 'Starters to Share   Sharing Platters'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Caponata', 3.0, 'Sides & Extras'),
('4d514423-222a-4b51-83ed-5202d3bf005b', 'Zion Reggae Bar', 'Cappuccino', 2.5, 'Coffees & Teas')
;


COMMIT;