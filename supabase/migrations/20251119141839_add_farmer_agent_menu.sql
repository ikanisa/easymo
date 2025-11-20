BEGIN;

-- Add Farmer AI Agent to home menu for Rwanda
-- This enables farmers and buyers to access the AI-powered agricultural marketplace

-- First, check if table exists, if not create it
CREATE TABLE IF NOT EXISTS public.whatsapp_home_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  active_countries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  display_order INTEGER NOT NULL DEFAULT 100,
  icon TEXT,
  country_specific_names JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS whatsapp_home_menu_items_key_idx ON public.whatsapp_home_menu_items(key);
CREATE INDEX IF NOT EXISTS whatsapp_home_menu_items_active_idx ON public.whatsapp_home_menu_items(is_active);
CREATE INDEX IF NOT EXISTS whatsapp_home_menu_items_order_idx ON public.whatsapp_home_menu_items(display_order);

-- Enable RLS
ALTER TABLE public.whatsapp_home_menu_items ENABLE ROW LEVEL SECURITY;

-- Allow public read for active items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='whatsapp_home_menu_items' 
    AND policyname='Public read active items'
  ) THEN
    CREATE POLICY "Public read active items" ON public.whatsapp_home_menu_items
      FOR SELECT TO anon, authenticated
      USING (is_active = true);
  END IF;
END $$;

-- Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='whatsapp_home_menu_items' 
    AND policyname='Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON public.whatsapp_home_menu_items
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Insert farmer agent menu item for Rwanda (RW) only
INSERT INTO public.whatsapp_home_menu_items (
  name,
  key,
  is_active,
  active_countries,
  display_order,
  icon,
  country_specific_names
)
VALUES (
  'Farmers & Buyers',
  'farmer_agent',
  true,
  ARRAY['RW'],
  15,
  '🌾',
  jsonb_build_object(
    'RW', jsonb_build_object(
      'name', 'Abahinzi & Abaguzi',
      'description', 'Gura no kugurisha ibihingwa byawe'
    ),
    'KE', jsonb_build_object(
      'name', 'Farmers & Buyers',
      'description', 'Buy and sell your produce'
    ),
    'UG', jsonb_build_object(
      'name', 'Farmers & Buyers',
      'description', 'Buy and sell your produce'
    ),
    'TZ', jsonb_build_object(
      'name', 'Wakulima & Wanunuzi',
      'description', 'Nunua na uza mazao yako'
    )
  )
)
ON CONFLICT (key) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  active_countries = EXCLUDED.active_countries,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  country_specific_names = EXCLUDED.country_specific_names,
  updated_at = timezone('utc', now());

COMMENT ON TABLE public.whatsapp_home_menu_items IS 'Dynamic home menu items for WhatsApp bot by country';
COMMENT ON COLUMN public.whatsapp_home_menu_items.key IS 'Unique key matching MenuItemKey type';
COMMENT ON COLUMN public.whatsapp_home_menu_items.active_countries IS 'ISO country codes where this item is shown';
COMMENT ON COLUMN public.whatsapp_home_menu_items.country_specific_names IS 'Localized names and descriptions per country';

COMMIT;
