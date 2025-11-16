-- =====================================================
-- BAR MENU SYSTEM MIGRATION
-- Generated: 2025-11-12
-- Description: Complete bar menu structure with categories, items, and bar assignments
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: CREATE MENU ITEMS TABLE
-- =====================================================

-- Create menu_items table if not exists (extends existing structure)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id uuid REFERENCES public.bars(id) ON DELETE CASCADE,
    menu_id uuid REFERENCES public.menus(id) ON DELETE SET NULL,
    class text NOT NULL, -- Drinks, Food
    category text NOT NULL, -- BEERS, COCKTAILS, BREAKFAST, etc.
    name text NOT NULL,
    description text,
    price numeric(10,2),
    currency text DEFAULT 'RWF',
    is_available boolean DEFAULT true,
    image_url text,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW(),
    created_by text,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_menu_items_bar_id ON public.menu_items(bar_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_class ON public.menu_items(class);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(is_available) WHERE is_available = true;

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read available menu items" ON public.menu_items;
CREATE POLICY "Anyone can read available menu items"
  ON public.menu_items
  FOR SELECT
  TO authenticated, anon
  USING (is_available = true);

DROP POLICY IF EXISTS "Service role can manage all menu items" ON public.menu_items;
CREATE POLICY "Service role can manage all menu items"
  ON public.menu_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PHASE 2: INSERT MENU ITEMS FOR ALL BARS
-- =====================================================

-- Function to assign menu items to all bars
CREATE OR REPLACE FUNCTION public.assign_menu_to_all_bars()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bar_id uuid;
    v_menu_count integer := 0;
BEGIN
    -- Loop through all active bars
    FOR v_bar_id IN 
        SELECT id FROM public.bars WHERE is_active = true
    LOOP
        -- Insert menu items for this bar
        INSERT INTO public.menu_items (bar_id, class, category, name, description, price, currency)
        VALUES
            -- BEERS
            (v_bar_id, 'Drinks', 'BEERS', 'Amstel 33cl', '5%', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Corona 33cl', '', 3000, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Desperados 33cl', '', 3000, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Guinness 33cl', '6.50%', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Heineken 33cl', '5%', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Leffe Blonde 30cl', '7%', 3500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Legend 30 cl', '', 2000, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Mutzig 33cl', '', 1500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Mutzig 50cl', '', 2000, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Primus 50cl', '', 2000, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'SKOL GATANU 50 CL', '', 1500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Skol Lager 33cl', '', 1500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Skol Malt 33cl', '5.10%', 1500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Skol Maltona 33 CL', '', 1500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Skol Panache Lemon 33 CL', '', 1500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Turbo King 50 CL', '', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Tusker Lager', '', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Tusker Malt', '', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Virunga Gold 33 CL', '6.50%', 2000, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Virunga Mist 33 CL', '6.50%', 2000, 'RWF'),
            (v_bar_id, 'Drinks', 'BEERS', 'Virunga Silver 33 CL', '5%', 2000, 'RWF'),
            
            -- CIDERS
            (v_bar_id, 'Drinks', 'CIDERS', 'Savanna Cider', '', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'CIDERS', 'Smirnoff Guarana', '', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'CIDERS', 'Smirnoff Ice', '', 2500, 'RWF'),
            
            -- COCKTAILS
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Americano', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Aperol Spritz', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Black Russian', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Caipirinha', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Cosmopolitan', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Cuba libre', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Espresso martini', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Gin and Tonic', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Kamikaze', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Last word', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Long island', '', 7000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Mai Tai', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Manhattan', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Margarita', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Martini (Classic)', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Mimosa', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Mojito', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Moscow Mule', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Negroni', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Old fashioned', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Pina colada', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Sex on the beach', '', 5000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Sidecar', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Singapore sling', '', 6000, 'RWF'),
            (v_bar_id, 'Drinks', 'COCKTAILS', 'Tequila sunrise', '', 5000, 'RWF'),
            
            -- COFFEE
            (v_bar_id, 'Drinks', 'COFFEE', 'Americano Coffee', '', 2000, 'RWF'),
            (v_bar_id, 'Drinks', 'COFFEE', 'Cappuccino', '', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'COFFEE', 'Espresso', '', 1500, 'RWF'),
            (v_bar_id, 'Drinks', 'COFFEE', 'Latte', '', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'COFFEE', 'Macchiato', '', 2500, 'RWF'),
            (v_bar_id, 'Drinks', 'COFFEE', 'Mocha', '', 3000, 'RWF'),
            
            -- Continue with remaining categories...
            -- SODAS
            (v_bar_id, 'Drinks', 'SODA', 'Coca-Cola 30cl', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'SODA', 'Coca-Cola Zero 30cl', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'SODA', 'Fanta Citron 30 CL', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'SODA', 'Fanta Fiesta 30 CL', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'SODA', 'Fanta Orange 30cl', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'SODA', 'Fanta Pineapple 30cl', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'SODA', 'Krest Tonic 30 CL', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'SODA', 'Sprite 30 CL', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'SODA', 'Tonic Water', '', 1000, 'RWF'),
            
            -- WATER
            (v_bar_id, 'Drinks', 'WATER', 'Nile Mineral Water 50 CL', '', 500, 'RWF'),
            (v_bar_id, 'Drinks', 'WATER', 'Virunga Sparkling water 33 CL', '', 1000, 'RWF'),
            (v_bar_id, 'Drinks', 'WATER', 'Vital''O 50 CL', '', 500, 'RWF'),
            
            -- BREAKFAST
            (v_bar_id, 'Food', 'BREAKFAST', 'Omelette', 'Omelette with vegetables and sometimes meat, commonly eaten for breakfast.', 3000, 'RWF'),
            
            -- FAST FOOD
            (v_bar_id, 'Food', 'FAST FOOD', 'Beef Burger', 'A classic burger with a beef patty, cheese, and toppings.', 5000, 'RWF'),
            (v_bar_id, 'Food', 'FAST FOOD', 'Chapati', 'A soft, pan-fried flatbread, served with various fillings.', 1500, 'RWF'),
            (v_bar_id, 'Food', 'FAST FOOD', 'Chicken Burger', 'A grilled or crispy chicken burger with lettuce and sauce.', 5000, 'RWF'),
            (v_bar_id, 'Food', 'FAST FOOD', 'Chips and Chicken', 'Fries served with a portion of grilled or fried chicken.', 6000, 'RWF'),
            (v_bar_id, 'Food', 'FAST FOOD', 'Samosas', 'Deep-fried pastries filled with beef, chicken, or vegetables.', 1000, 'RWF'),
            (v_bar_id, 'Food', 'FAST FOOD', 'Shawarma', 'Spiced and grilled meat wrapped in flatbread with sauces.', 4000, 'RWF'),
            
            -- GRILL
            (v_bar_id, 'Food', 'GRILL', 'BBQ Pork Ribs', 'Slow-cooked pork ribs, finished on the grill with a BBQ glaze.', 8000, 'RWF'),
            (v_bar_id, 'Food', 'GRILL', 'Beef Brochettes', 'Skewered and grilled meat (goat, beef, chicken, or fish), marinated in spices.', 5000, 'RWF'),
            (v_bar_id, 'Food', 'GRILL', 'Beef Steak', 'Grilled beef steak, often served with fries or mashed potatoes.', 10000, 'RWF'),
            (v_bar_id, 'Food', 'GRILL', 'Chicken Brochettes', '', 4000, 'RWF'),
            (v_bar_id, 'Food', 'GRILL', 'Fish Brochettes', '', 6000, 'RWF'),
            (v_bar_id, 'Food', 'GRILL', 'Goat brochettes', '', 5000, 'RWF'),
            (v_bar_id, 'Food', 'GRILL', 'Nyama Choma', 'East African-style grilled beef or goat, served with a spicy sauce.', 8000, 'RWF'),
            (v_bar_id, 'Food', 'GRILL', 'Pork Steak', 'Pork chop grilled to perfection, usually with a side of greens.', 8000, 'RWF'),
            (v_bar_id, 'Food', 'GRILL', 'Zingalo Brochettes', '', 5000, 'RWF')
        ON CONFLICT DO NOTHING;
        
        v_menu_count := v_menu_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Menu items assigned to % bars', v_menu_count;
END;
$$;

-- Execute the function to assign menus
SELECT public.assign_menu_to_all_bars();

-- =====================================================
-- PHASE 3: ADD UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trigger_update_menu_items_updated_at
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_menu_items_updated_at();

-- =====================================================
-- PHASE 4: CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get menu by bar_id
CREATE OR REPLACE FUNCTION public.get_bar_menu(p_bar_id uuid)
RETURNS TABLE (
    class text,
    category text,
    name text,
    description text,
    price numeric,
    currency text,
    is_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mi.class,
        mi.category,
        mi.name,
        mi.description,
        mi.price,
        mi.currency,
        mi.is_available
    FROM public.menu_items mi
    WHERE mi.bar_id = p_bar_id
      AND mi.is_available = true
    ORDER BY mi.class, mi.category, mi.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bar_menu(uuid) TO authenticated, anon;

COMMENT ON TABLE public.menu_items IS 'Bar menu items assigned to each bar, includes drinks and food';
COMMENT ON FUNCTION public.get_bar_menu(uuid) IS 'Retrieve complete menu for a specific bar';

COMMIT;
