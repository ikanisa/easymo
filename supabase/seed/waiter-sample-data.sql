BEGIN;

-- ============================================================================
-- Waiter AI PWA - Sample Data
-- ============================================================================
-- Purpose: Seed sample restaurant, menu, and wine pairing data for testing
-- ============================================================================

-- Insert sample restaurant
INSERT INTO restaurants (
  id, name, slug, description, address, phone, email,
  default_language, supported_languages, currency, is_active
) VALUES (
  'b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid,
  'La Belle Époque',
  'la-belle-epoque',
  'Fine French dining with AI waiter service',
  '123 Champs-Élysées, 75008 Paris, France',
  '+33123456789',
  'contact@labelleepoque.fr',
  'fr',
  ARRAY['en', 'fr', 'es', 'pt', 'de'],
  'EUR',
  true
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Insert restaurant tables
INSERT INTO restaurant_tables (restaurant_id, table_number, qr_code, capacity, floor, section) VALUES
('b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid, '1', 'QR-LBE-T01', 2, 'Ground Floor', 'Window'),
('b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid, '2', 'QR-LBE-T02', 4, 'Ground Floor', 'Center'),
('b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid, '3', 'QR-LBE-T03', 4, 'Ground Floor', 'Corner'),
('b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid, '4', 'QR-LBE-T04', 6, 'Ground Floor', 'Private'),
('b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid, '5', 'QR-LBE-T05', 2, 'First Floor', 'Balcony'),
('b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid, '6', 'QR-LBE-T06', 4, 'First Floor', 'Center'),
('b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid, '7', 'QR-LBE-T07', 8, 'First Floor', 'VIP'),
('b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid, '8', 'QR-LBE-T08', 2, 'Terrace', 'Outdoor')
ON CONFLICT (qr_code) DO NOTHING;

-- Insert menu categories
INSERT INTO menu_categories (restaurant_id, name, name_translations, description, sort_order) VALUES
(
  'b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid,
  'Starters',
  '{"en":"Starters","fr":"Entrées","es":"Entradas","pt":"Entradas","de":"Vorspeisen"}'::jsonb,
  'Begin your culinary journey',
  1
),
(
  'b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid,
  'Mains',
  '{"en":"Main Courses","fr":"Plats Principaux","es":"Platos Principales","pt":"Pratos Principais","de":"Hauptgerichte"}'::jsonb,
  'Our signature dishes',
  2
),
(
  'b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid,
  'Desserts',
  '{"en":"Desserts","fr":"Desserts","es":"Postres","pt":"Sobremesas","de":"Desserts"}'::jsonb,
  'Sweet endings',
  3
),
(
  'b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid,
  'Drinks',
  '{"en":"Drinks","fr":"Boissons","es":"Bebidas","pt":"Bebidas","de":"Getränke"}'::jsonb,
  'Wine, cocktails, and more',
  4
);

-- Get category IDs for menu items
DO $$
DECLARE
  cat_starters UUID;
  cat_mains UUID;
  cat_desserts UUID;
  cat_drinks UUID;
  restaurant_uuid UUID := 'b8f7e6d5-4c3b-2a19-0987-654321fedcba'::uuid;
BEGIN
  SELECT id INTO cat_starters FROM menu_categories 
  WHERE restaurant_id = restaurant_uuid AND name = 'Starters';
  
  SELECT id INTO cat_mains FROM menu_categories 
  WHERE restaurant_id = restaurant_uuid AND name = 'Mains';
  
  SELECT id INTO cat_desserts FROM menu_categories 
  WHERE restaurant_id = restaurant_uuid AND name = 'Desserts';
  
  SELECT id INTO cat_drinks FROM menu_categories 
  WHERE restaurant_id = restaurant_uuid AND name = 'Drinks';

  -- Insert starters
  INSERT INTO menu_items (restaurant_id, category_id, name, name_translations, description, description_translations, price, currency, allergens, is_vegetarian, preparation_time) VALUES
  (
    restaurant_uuid, cat_starters, 'French Onion Soup',
    '{"en":"French Onion Soup","fr":"Soupe à l''Oignon","es":"Sopa de Cebolla","pt":"Sopa de Cebola","de":"Französische Zwiebelsuppe"}'::jsonb,
    'Classic caramelized onion soup with Gruyère crouton',
    '{"en":"Classic caramelized onion soup with Gruyère crouton","fr":"Soupe d''oignons caramélisés avec croûton au Gruyère"}'::jsonb,
    12.50, 'EUR', ARRAY['gluten', 'dairy'], true, 15
  ),
  (
    restaurant_uuid, cat_starters, 'Escargots de Bourgogne',
    '{"en":"Burgundy Snails","fr":"Escargots de Bourgogne","es":"Caracoles de Borgoña"}'::jsonb,
    'Six snails in garlic-parsley butter',
    '{"en":"Six snails in garlic-parsley butter","fr":"Six escargots au beurre d''ail et persil"}'::jsonb,
    15.00, 'EUR', ARRAY['dairy'], false, 10
  ),
  (
    restaurant_uuid, cat_starters, 'Salade Niçoise',
    '{"en":"Niçoise Salad","fr":"Salade Niçoise","es":"Ensalada Nizarda"}'::jsonb,
    'Mixed greens, tuna, eggs, olives, anchovies',
    '{"en":"Mixed greens, tuna, eggs, olives, anchovies","fr":"Mesclun, thon, œufs, olives, anchois"}'::jsonb,
    14.00, 'EUR', ARRAY['fish', 'eggs'], false, 8
  );

  -- Insert mains
  INSERT INTO menu_items (restaurant_id, category_id, name, name_translations, description, price, currency, allergens, is_vegetarian, is_gluten_free, preparation_time) VALUES
  (
    restaurant_uuid, cat_mains, 'Boeuf Bourguignon',
    '{"en":"Beef Burgundy","fr":"Bœuf Bourguignon","es":"Ternera Borgoña"}'::jsonb,
    'Slow-cooked beef in red wine with pearl onions and mushrooms',
    28.00, 'EUR', ARRAY[]::TEXT[], false, true, 35
  ),
  (
    restaurant_uuid, cat_mains, 'Coq au Vin',
    '{"en":"Chicken in Wine","fr":"Coq au Vin","es":"Pollo al Vino"}'::jsonb,
    'Braised chicken in red wine sauce with bacon and mushrooms',
    24.00, 'EUR', ARRAY[]::TEXT[], false, true, 30
  ),
  (
    restaurant_uuid, cat_mains, 'Ratatouille',
    '{"en":"Ratatouille","fr":"Ratatouille","es":"Pisto"}'::jsonb,
    'Provençal stewed vegetables with fresh herbs',
    18.00, 'EUR', ARRAY[]::TEXT[], true, true, 25
  ),
  (
    restaurant_uuid, cat_mains, 'Sole Meunière',
    '{"en":"Sole Meunière","fr":"Sole Meunière","es":"Lenguado Meunière"}'::jsonb,
    'Pan-fried Dover sole in brown butter with lemon',
    32.00, 'EUR', ARRAY['fish', 'dairy'], false, false, 20
  );

  -- Insert desserts
  INSERT INTO menu_items (restaurant_id, category_id, name, name_translations, description, price, currency, allergens, is_vegetarian, preparation_time) VALUES
  (
    restaurant_uuid, cat_desserts, 'Crème Brûlée',
    '{"en":"Crème Brûlée","fr":"Crème Brûlée","es":"Crema Catalana"}'::jsonb,
    'Vanilla custard with caramelized sugar crust',
    9.00, 'EUR', ARRAY['dairy', 'eggs'], true, 5
  ),
  (
    restaurant_uuid, cat_desserts, 'Tarte Tatin',
    '{"en":"Upside-Down Apple Tart","fr":"Tarte Tatin","es":"Tarta Tatin"}'::jsonb,
    'Caramelized apple tart with vanilla ice cream',
    10.00, 'EUR', ARRAY['gluten', 'dairy', 'eggs'], true, 8
  ),
  (
    restaurant_uuid, cat_desserts, 'Profiteroles',
    '{"en":"Profiteroles","fr":"Profiteroles","es":"Profiteroles"}'::jsonb,
    'Choux pastry filled with ice cream, chocolate sauce',
    11.00, 'EUR', ARRAY['gluten', 'dairy', 'eggs'], true, 5
  );

  -- Insert drinks
  INSERT INTO menu_items (restaurant_id, category_id, name, name_translations, description, price, currency, is_vegetarian, is_vegan, is_gluten_free) VALUES
  (
    restaurant_uuid, cat_drinks, 'Bordeaux Rouge',
    '{"en":"Red Bordeaux Wine","fr":"Bordeaux Rouge","es":"Burdeos Tinto"}'::jsonb,
    'Glass of premium Bordeaux red wine',
    12.00, 'EUR', true, true, true
  ),
  (
    restaurant_uuid, cat_drinks, 'Champagne',
    '{"en":"Champagne","fr":"Champagne","es":"Champaña"}'::jsonb,
    'Glass of French Champagne',
    15.00, 'EUR', true, true, true
  ),
  (
    restaurant_uuid, cat_drinks, 'Perrier',
    '{"en":"Sparkling Water","fr":"Eau Pétillante","es":"Agua con Gas"}'::jsonb,
    'Bottle of Perrier sparkling water',
    5.00, 'EUR', true, true, true
  ),
  (
    restaurant_uuid, cat_drinks, 'Espresso',
    '{"en":"Espresso","fr":"Espresso","es":"Café Expreso"}'::jsonb,
    'Double shot espresso',
    4.00, 'EUR', true, true, true
  );

END $$;

-- Insert wine pairings
INSERT INTO wine_pairings (food_category, food_item, wine_name, wine_type, wine_varietal, region, description, confidence_score) VALUES
('Beef', 'Boeuf Bourguignon', 'Château Margaux', 'red', 'Cabernet Sauvignon Blend', 'Bordeaux', 'Full-bodied Bordeaux complements rich beef perfectly', 0.95),
('Beef', 'Steak', 'Côtes du Rhône', 'red', 'Grenache/Syrah', 'Rhône Valley', 'Robust red wine pairs excellently with grilled beef', 0.90),
('Chicken', 'Coq au Vin', 'Pinot Noir', 'red', 'Pinot Noir', 'Burgundy', 'Light red wine enhances the chicken and mushroom flavors', 0.92),
('Chicken', 'Roasted Chicken', 'Chardonnay', 'white', 'Chardonnay', 'Burgundy', 'Buttery white wine complements roasted poultry', 0.88),
('Fish', 'Sole Meunière', 'Chablis', 'white', 'Chardonnay', 'Burgundy', 'Crisp white wine perfect for delicate fish dishes', 0.94),
('Fish', 'Salmon', 'Sancerre', 'white', 'Sauvignon Blanc', 'Loire Valley', 'Fresh white wine balances rich salmon', 0.89),
('Vegetables', 'Ratatouille', 'Rosé de Provence', 'rose', 'Grenache/Cinsault', 'Provence', 'Light rosé complements vegetable dishes beautifully', 0.87),
('Cheese', 'Cheese Plate', 'Sauternes', 'dessert', 'Sémillon', 'Bordeaux', 'Sweet wine pairs wonderfully with strong cheeses', 0.91),
('Dessert', 'Crème Brûlée', 'Champagne', 'sparkling', 'Chardonnay/Pinot Noir', 'Champagne', 'Bubbly cleanses palate after rich dessert', 0.86),
('Dessert', 'Chocolate', 'Banyuls', 'fortified', 'Grenache', 'Roussillon', 'Sweet fortified wine enhances chocolate flavors', 0.90);

COMMIT;
