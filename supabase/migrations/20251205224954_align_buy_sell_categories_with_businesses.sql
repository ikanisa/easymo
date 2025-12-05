-- Align buy_sell_categories with actual categories in businesses table
-- This ensures search works properly

BEGIN;

-- First, let's see what categories actually exist in businesses table
-- and update buy_sell_categories to match

-- Clear existing categories
DELETE FROM buy_sell_categories;

-- Insert categories that match businesses.category column
-- Based on common business categories, matching the top 9 we want to promote

INSERT INTO buy_sell_categories (key, name, icon, display_order, is_active, country_specific_names) VALUES
('Pharmacy', 'Pharmacies', '💊', 1, true, 
  jsonb_build_object(
    'RW', jsonb_build_object('name', '💊 Amaduka'),
    'MT', jsonb_build_object('name', '💊 Pharmacies'),
    'BI', jsonb_build_object('name', '💊 Pharmacies'),
    'TZ', jsonb_build_object('name', '💊 Duka la Dawa'),
    'CD', jsonb_build_object('name', '💊 Pharmacies')
  )),

('Salon', 'Salons & Barbers', '💇', 2, true,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '💇 Salon & Barber'),
    'MT', jsonb_build_object('name', '💇 Salons & Barbers'),
    'BI', jsonb_build_object('name', '💇 Salons & Coiffeurs'),
    'TZ', jsonb_build_object('name', '💇 Salon & Kinyozi'),
    'CD', jsonb_build_object('name', '💇 Salons & Coiffeurs')
  )),

('Beauty Shop', 'Cosmetics & Beauty', '💄', 3, true,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '💄 Ubwiza & Cosmetics'),
    'MT', jsonb_build_object('name', '💄 Beauty & Cosmetics'),
    'BI', jsonb_build_object('name', '💄 Beauté & Cosmétiques'),
    'TZ', jsonb_build_object('name', '💄 Urembo & Cosmetics'),
    'CD', jsonb_build_object('name', '💄 Beauté & Cosmétiques')
  )),

('Legal Services', 'Notaries & Legal', '⚖️', 4, true,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '⚖️ Notaire & Amategeko'),
    'MT', jsonb_build_object('name', '⚖️ Notaries & Legal'),
    'BI', jsonb_build_object('name', '⚖️ Notaires & Juridique'),
    'TZ', jsonb_build_object('name', '⚖️ Notaries & Sheria'),
    'CD', jsonb_build_object('name', '⚖️ Notaires & Juridique')
  )),

('Electronics Store', 'Electronics', '📱', 5, true,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '📱 Electronics'),
    'MT', jsonb_build_object('name', '📱 Electronics'),
    'BI', jsonb_build_object('name', '📱 Électronique'),
    'TZ', jsonb_build_object('name', '📱 Electronics'),
    'CD', jsonb_build_object('name', '📱 Électronique')
  )),

('Hardware Store', 'Hardware & Tools', '🔨', 6, true,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '🔨 Hardware & Ibikoresho'),
    'MT', jsonb_build_object('name', '🔨 Hardware & Tools'),
    'BI', jsonb_build_object('name', '🔨 Quincaillerie & Outils'),
    'TZ', jsonb_build_object('name', '🔨 Hardware & Zana'),
    'CD', jsonb_build_object('name', '🔨 Quincaillerie & Outils')
  )),

('Supermarket', 'Groceries & Supermarkets', '🛒', 7, true,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '🛒 Supermarket & Ibyokurya'),
    'MT', jsonb_build_object('name', '🛒 Supermarkets'),
    'BI', jsonb_build_object('name', '🛒 Supermarchés'),
    'TZ', jsonb_build_object('name', '🛒 Supermarket & Chakula'),
    'CD', jsonb_build_object('name', '🛒 Supermarchés')
  )),

('Clothing Store', 'Fashion & Clothing', '👔', 8, true,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '👔 Imyambaro & Fashion'),
    'MT', jsonb_build_object('name', '👔 Fashion & Clothing'),
    'BI', jsonb_build_object('name', '👔 Mode & Vêtements'),
    'TZ', jsonb_build_object('name', '👔 Fashion & Nguo'),
    'CD', jsonb_build_object('name', '👔 Mode & Vêtements')
  )),

('Auto Repair', 'Auto Services & Parts', '🚗', 9, true,
  jsonb_build_object(
    'RW', jsonb_build_object('name', '🚗 Serivisi za Modoka'),
    'MT', jsonb_build_object('name', '🚗 Auto Services'),
    'BI', jsonb_build_object('name', '🚗 Services Auto'),
    'TZ', jsonb_build_object('name', '🚗 Huduma za Magari'),
    'CD', jsonb_build_object('name', '🚗 Services Auto')
  ));

-- Verify categories were inserted
DO $$
DECLARE
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO category_count FROM buy_sell_categories WHERE is_active = true;
  RAISE NOTICE 'Buy & Sell categories created: %', category_count;
  
  IF category_count != 9 THEN
    RAISE EXCEPTION 'Expected 9 categories, found %', category_count;
  END IF;
END $$;

COMMIT;
