-- Migration: Bars Menu System
-- Purpose: Create comprehensive menu structure for all bars
-- Date: 2025-11-12

BEGIN;

-- Step 1: Create items table if not exists (with proper structure)
CREATE TABLE IF NOT EXISTS public.items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_id uuid REFERENCES public.bars(id) ON DELETE CASCADE,
  menu_id uuid REFERENCES public.menus(id) ON DELETE SET NULL,
  name text NOT NULL,
  category text NOT NULL,
  class text,
  description text,
  price numeric(10,2),
  currency text DEFAULT 'RWF',
  is_available boolean DEFAULT true,
  image_url text,
  created_by text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_items_bar_id ON public.items(bar_id);
CREATE INDEX IF NOT EXISTS idx_items_menu_id ON public.items(menu_id) WHERE menu_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_class ON public.items(class) WHERE class IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_available ON public.items(is_available) WHERE is_available = true;

-- Enable RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read available items" ON public.items;
CREATE POLICY "Anyone can read available items"
  ON public.items FOR SELECT
  USING (is_available = true);

DROP POLICY IF EXISTS "Service role manages items" ON public.items;
CREATE POLICY "Service role manages items"
  ON public.items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 2: Insert menu items for all bars
-- Get all bar IDs and insert the menu for each
DO $$
DECLARE
  bar_record RECORD;
  menu_data jsonb := '[
    {"class": "Drinks", "category": "BEERS", "name": "Amstel 33cl", "description": "5%"},
    {"class": "Drinks", "category": "BEERS", "name": "Corona 33cl", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Desperados 33cl", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Guinness 33cl", "description": "6.50%"},
    {"class": "Drinks", "category": "BEERS", "name": "Heineken 33cl", "description": "5%"},
    {"class": "Drinks", "category": "BEERS", "name": "Leffe Blonde 30cl", "description": "7%"},
    {"class": "Drinks", "category": "BEERS", "name": "Legend 30 cl", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Mutzig 33cl", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Mutzig 50cl", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Primus 50cl", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "SKOL GATANU 50 CL", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Skol Lager 33cl", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Skol Malt 33cl", "description": "5.10%"},
    {"class": "Drinks", "category": "BEERS", "name": "Skol Maltona 33 CL", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Skol Panache Lemon 33 CL", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Turbo King 50 CL", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Tusker Lager", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Tusker Malt", "description": ""},
    {"class": "Drinks", "category": "BEERS", "name": "Virunga Gold 33 CL", "description": "6.50%"},
    {"class": "Drinks", "category": "BEERS", "name": "Virunga Mist 33 CL", "description": "6.50%"},
    {"class": "Drinks", "category": "BEERS", "name": "Virunga Silver 33 CL", "description": "5%"},
    {"class": "Food", "category": "BREAKFAST", "name": "Omelette", "description": "Omelette with vegetables and sometimes meat, commonly eaten for breakfast."},
    {"class": "Drinks", "category": "CIDERSS", "name": "Savanna Cider", "description": ""},
    {"class": "Drinks", "category": "CIDERSS", "name": "Smirnoff Guarana", "description": ""},
    {"class": "Drinks", "category": "CIDERSS", "name": "Smirnoff Ice", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Americano", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Aperol Spritz", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Black Russian", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Caipirinha", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Cosmopolitan", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Cuba libre", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Espresso martini", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Gin and Tonic", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Kamikaze", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Last word", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Long island", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Mai Tai", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Manhattan", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Margarita", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Martini (Classic)", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Mimosa", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Mojito", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Moscow Mule", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Negroni", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Old fashioned", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Pina colada", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Sex on the beach", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Sidecar", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Singapore sling", "description": ""},
    {"class": "Drinks", "category": "COCKTAILS", "name": "Tequila sunrise", "description": ""},
    {"class": "Drinks", "category": "COFFEE", "name": "Americano Coffee", "description": ""},
    {"class": "Drinks", "category": "COFFEE", "name": "Cappuccino", "description": ""},
    {"class": "Drinks", "category": "COFFEE", "name": "Espresso", "description": ""},
    {"class": "Drinks", "category": "COFFEE", "name": "Latte", "description": ""},
    {"class": "Drinks", "category": "COFFEE", "name": "Macchiato", "description": ""},
    {"class": "Drinks", "category": "COFFEE", "name": "Mocha", "description": ""},
    {"class": "Food", "category": "DESSERTS", "name": "Avocado Smoothie", "description": "A rich and creamy smoothie made from blended avocado."},
    {"class": "Food", "category": "DESSERTS", "name": "Carrot Cake", "description": "A spiced cake made with grated carrots and cinnamon."},
    {"class": "Food", "category": "DESSERTS", "name": "Chocolate Cake", "description": "A rich and moist chocolate-flavored cake."},
    {"class": "Food", "category": "DESSERTS", "name": "Fruit Salad", "description": "A refreshing mix of fresh seasonal fruits."},
    {"class": "Drinks", "category": "ENERGY DRINKS", "name": "Cheetah Energy drink 30 CL", "description": ""},
    {"class": "Drinks", "category": "ENERGY DRINKS", "name": "Monster Energy", "description": ""},
    {"class": "Drinks", "category": "ENERGY DRINKS", "name": "Red Bull", "description": ""},
    {"class": "Food", "category": "FAST FOOD", "name": "Beef Burger", "description": "A classic burger with a beef patty, cheese, and toppings."},
    {"class": "Food", "category": "FAST FOOD", "name": "Chapati", "description": "A soft, pan-fried flatbread, served with various fillings."},
    {"class": "Food", "category": "FAST FOOD", "name": "Chicken Burger", "description": "A grilled or crispy chicken burger with lettuce and sauce."},
    {"class": "Food", "category": "FAST FOOD", "name": "Chips and Chicken", "description": "Fries served with a portion of grilled or fried chicken."},
    {"class": "Food", "category": "FAST FOOD", "name": "Samosas", "description": "Deep-fried pastries filled with beef, chicken, or vegetables."},
    {"class": "Food", "category": "FAST FOOD", "name": "Shawarma", "description": "Spiced and grilled meat wrapped in flatbread with sauces."}
  ]'::jsonb;
  item jsonb;
BEGIN
  -- Loop through all bars
  FOR bar_record IN 
    SELECT id FROM public.bars 
    WHERE id IN (
      '00710229-f8b1-4903-980f-ddcb3580dcf2',
      '01c7812c-b553-4594-a598-52641f057952'
      -- Add more bar IDs as needed
    )
  LOOP
    -- Insert menu items for this bar
    FOR item IN SELECT * FROM jsonb_array_elements(menu_data)
    LOOP
      INSERT INTO public.items (
        bar_id,
        name,
        category,
        class,
        description,
        is_available
      ) VALUES (
        bar_record.id,
        item->>'name',
        item->>'category',
        item->>'class',
        item->>'description',
        true
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Inserted menu items for bar: %', bar_record.id;
  END LOOP;
END $$;

COMMIT;
