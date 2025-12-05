-- Country-aware agents: Jobs and Real Estate for Malta only
-- Buy & Sell hybrid workflow with top 9 categories

BEGIN;

-- 1. Update Jobs Agent - Malta only
UPDATE whatsapp_home_menu_items
SET active_countries = ARRAY['MT']::text[]
WHERE key = 'jobs_agent';

-- 2. Update Real Estate Agent - Malta only
UPDATE whatsapp_home_menu_items
SET active_countries = ARRAY['MT']::text[]
WHERE key = 'real_estate_agent';

-- 3. Ensure Buy & Sell is available in all countries
UPDATE whatsapp_home_menu_items
SET 
  active_countries = ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'TG', 'MT']::text[],
  name = 'Buy & Sell',
  country_specific_names = jsonb_build_object(
    'RW', jsonb_build_object('name', '🛒 Kugura & Kugurisha', 'description', 'Find businesses & services near you'),
    'MT', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses & services near you'),
    'BI', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises et services'),
    'TZ', jsonb_build_object('name', '🛒 Nunua & Uza', 'description', 'Pata biashara karibu nawe'),
    'CD', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises près de vous'),
    'ZM', jsonb_build_object('name', '🛒 Buy & Sell', 'description', 'Find businesses near you'),
    'TG', jsonb_build_object('name', '🛒 Acheter & Vendre', 'description', 'Trouvez entreprises')
  )
WHERE key IN ('business_broker_agent', 'buy_and_sell_agent');

-- 4. Create top 9 business categories for Buy & Sell
CREATE TABLE IF NOT EXISTS public.buy_sell_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL,
  display_order int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  country_specific_names jsonb,
  excluded_subcategories text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert top 9 categories (excluding banks, restaurants, hotels)
INSERT INTO public.buy_sell_categories (key, name, icon, display_order, country_specific_names, excluded_subcategories)
VALUES
  ('pharmacies', 'Pharmacies', '💊', 1, 
   '{"RW": {"name": "Farmaси"}, "MT": {"name": "Pharmacies"}, "FR": {"name": "Pharmacies"}}'::jsonb,
   ARRAY['hospital']::text[]),
  
  ('salons', 'Salons & Barbers', '💇', 2,
   '{"RW": {"name": "Salon"}, "MT": {"name": "Salons"}, "FR": {"name": "Salons"}}'::jsonb,
   ARRAY[]::text[]),
  
  ('cosmetics', 'Cosmetics & Beauty', '💄', 3,
   '{"RW": {"name": "Ubwiza"}, "MT": {"name": "Beauty"}, "FR": {"name": "Cosmétiques"}}'::jsonb,
   ARRAY[]::text[]),
  
  ('notaries', 'Notaries & Legal', '⚖️', 4,
   '{"RW": {"name": "Notaire"}, "MT": {"name": "Notaries"}, "FR": {"name": "Notaires"}}'::jsonb,
   ARRAY[]::text[]),
  
  ('electronics', 'Electronics', '📱', 5,
   '{"RW": {"name": "Elegitoronike"}, "MT": {"name": "Electronics"}, "FR": {"name": "Électronique"}}'::jsonb,
   ARRAY[]::text[]),
  
  ('hardware', 'Hardware & Tools', '🔨', 6,
   '{"RW": {"name": "Ibikoresho"}, "MT": {"name": "Hardware"}, "FR": {"name": "Quincaillerie"}}'::jsonb,
   ARRAY[]::text[]),
  
  ('groceries', 'Groceries & Supermarkets', '🛒', 7,
   '{"RW": {"name": "Ibiribwa"}, "MT": {"name": "Groceries"}, "FR": {"name": "Épicerie"}}'::jsonb,
   ARRAY['restaurant', 'hotel', 'cafe']::text[]),
  
  ('fashion', 'Fashion & Clothing', '👔', 8,
   '{"RW": {"name": "Imyenda"}, "MT": {"name": "Fashion"}, "FR": {"name": "Mode"}}'::jsonb,
   ARRAY[]::text[]),
  
  ('auto', 'Auto Services & Parts', '🚗', 9,
   '{"RW": {"name": "Imodoka"}, "MT": {"name": "Auto Services"}, "FR": {"name": "Auto"}}'::jsonb,
   ARRAY['car_rental', 'taxi']::text[])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  country_specific_names = EXCLUDED.country_specific_names,
  excluded_subcategories = EXCLUDED.excluded_subcategories,
  updated_at = now();

-- 5. Create index for fast category lookup
CREATE INDEX IF NOT EXISTS idx_buy_sell_categories_active 
  ON public.buy_sell_categories(is_active, display_order);

-- 6. RLS policies
ALTER TABLE public.buy_sell_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY buy_sell_categories_public_read ON public.buy_sell_categories
  FOR SELECT
  USING (is_active = true);

GRANT SELECT ON public.buy_sell_categories TO anon, authenticated;

COMMIT;
