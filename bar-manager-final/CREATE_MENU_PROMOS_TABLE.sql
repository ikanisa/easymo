-- Create menu_promos table for promotions and special offers
-- Run this SQL in your Supabase Dashboard → SQL Editor

BEGIN;

CREATE TABLE IF NOT EXISTS public.menu_promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  promo_type TEXT NOT NULL CHECK (promo_type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'happy_hour')),
  discount_value NUMERIC(10,2),
  buy_quantity INTEGER,
  get_quantity INTEGER,
  applies_to TEXT CHECK (applies_to IN ('all', 'category', 'items')),
  category TEXT,
  item_ids UUID[],
  start_time TIME,
  end_time TIME,
  days_of_week INTEGER[],
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_menu_promos_bar ON public.menu_promos(bar_id, is_active);

-- Enable Row Level Security
ALTER TABLE public.menu_promos ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - bars can manage their own promos
DROP POLICY IF EXISTS "Bars can manage their promos" ON public.menu_promos;
CREATE POLICY "Bars can manage their promos"
  ON public.menu_promos
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.bars WHERE id = bar_id
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_menu_promos_updated_at ON public.menu_promos;
CREATE TRIGGER update_menu_promos_updated_at BEFORE UPDATE ON public.menu_promos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
