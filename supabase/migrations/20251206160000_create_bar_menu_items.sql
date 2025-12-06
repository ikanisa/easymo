-- =====================================================
-- BAR MENU ITEMS TABLE
-- Created: 2025-12-06
-- Description: Table to store menu items for bars/restaurants
-- =====================================================

BEGIN;

-- Create bar_menu_items table
CREATE TABLE IF NOT EXISTS public.bar_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
    bar_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    is_available BOOLEAN DEFAULT true,
    display_order INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    
    -- Constraints
    CONSTRAINT bar_menu_items_price_positive CHECK (price >= 0),
    CONSTRAINT bar_menu_items_unique_item UNIQUE (bar_id, item_name, category)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bar_menu_items_bar_id ON public.bar_menu_items(bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_menu_items_category ON public.bar_menu_items(category);
CREATE INDEX IF NOT EXISTS idx_bar_menu_items_available ON public.bar_menu_items(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_bar_menu_items_bar_category ON public.bar_menu_items(bar_id, category) WHERE is_available = true;

-- Enable RLS
ALTER TABLE public.bar_menu_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can read available menu items" ON public.bar_menu_items;
CREATE POLICY "Anyone can read available menu items"
  ON public.bar_menu_items
  FOR SELECT
  TO authenticated, anon
  USING (is_available = true);

DROP POLICY IF EXISTS "Service role can manage all menu items" ON public.bar_menu_items;
CREATE POLICY "Service role can manage all menu items"
  ON public.bar_menu_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_bar_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bar_menu_items_updated_at ON public.bar_menu_items;
CREATE TRIGGER trigger_bar_menu_items_updated_at
    BEFORE UPDATE ON public.bar_menu_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_bar_menu_items_updated_at();

-- Helper function to get menu by bar_id
CREATE OR REPLACE FUNCTION public.get_bar_menu_items(p_bar_id UUID)
RETURNS TABLE (
    id UUID,
    item_name TEXT,
    category TEXT,
    price NUMERIC,
    description TEXT,
    is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bmi.id,
        bmi.item_name,
        bmi.category,
        bmi.price,
        bmi.description,
        bmi.is_available
    FROM public.bar_menu_items bmi
    WHERE bmi.bar_id = p_bar_id
      AND bmi.is_available = true
    ORDER BY bmi.category, bmi.item_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bar_menu_items(UUID) TO authenticated, anon;

-- Helper function to get menu by category
CREATE OR REPLACE FUNCTION public.get_bar_menu_by_category(p_bar_id UUID, p_category TEXT)
RETURNS TABLE (
    id UUID,
    item_name TEXT,
    price NUMERIC,
    description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bmi.id,
        bmi.item_name,
        bmi.price,
        bmi.description
    FROM public.bar_menu_items bmi
    WHERE bmi.bar_id = p_bar_id
      AND bmi.category = p_category
      AND bmi.is_available = true
    ORDER BY bmi.item_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bar_menu_by_category(UUID, TEXT) TO authenticated, anon;

COMMENT ON TABLE public.bar_menu_items IS 'Menu items for bars and restaurants';
COMMENT ON FUNCTION public.get_bar_menu_items(UUID) IS 'Retrieve all available menu items for a specific bar';
COMMENT ON FUNCTION public.get_bar_menu_by_category(UUID, TEXT) IS 'Retrieve menu items for a specific bar and category';

COMMIT;
