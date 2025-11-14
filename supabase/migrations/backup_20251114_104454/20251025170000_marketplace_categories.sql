-- Marketplace categories enhancements (add columns + seed required rows)

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text,
  description text,
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.marketplace_categories(id) ON DELETE SET NULL;

-- Add metadata columns for slugs, descriptions, and icons.
ALTER TABLE public.marketplace_categories
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icon text;

-- Ensure slug uniqueness when present.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_categories_slug_key
  ON public.marketplace_categories (slug)
  WHERE slug IS NOT NULL;

-- Backfill slug values from names when missing.
UPDATE public.marketplace_categories
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g')
WHERE (slug IS NULL OR slug = '')
  AND name IS NOT NULL;

-- Normalize legacy names to match current taxonomy.
UPDATE public.marketplace_categories
SET name = 'Auto Spareparts'
WHERE lower(name) IN ('auto spare parts', 'auto spareparts');

UPDATE public.marketplace_categories
SET name = 'Cars Rental/Sale'
WHERE lower(name) IN ('cars (rental/sales)', 'cars rental/sale');

UPDATE public.marketplace_categories
SET name = 'Houses Rental/Sale'
WHERE lower(name) IN ('properties (rentals/sales)', 'houses rental/sale');

-- Seed / refresh required categories with descriptions and emojis.
INSERT INTO public.marketplace_categories (name, slug, description, icon, sort_order, is_active)
VALUES
  ('Pharmacies', 'pharmacies', 'Trusted medicine & wellness.', '💊', 10, true),
  ('Quincailleries', 'quincailleries', 'Hardware & building supplies.', '🛠️', 20, true),
  ('Auto Spareparts', 'auto_spareparts', 'Parts & garages for vehicles.', '🚗', 30, true),
  ('Shops', 'shops', 'Everyday shops for essentials.', '🛍️', 35, true),
  ('Saloons', 'saloons', 'Beauty and grooming services.', '💈', 40, true),
  ('Mobile Money Agents', 'mobile_money_agents', 'Send, receive & cash-out here.', '💵', 50, true),
  ('Cars Rental/Sale', 'cars_rental_sale', 'Hire or buy cars nearby.', '🚘', 60, true),
  ('Houses Rental/Sale', 'houses_rental_sale', 'Find homes to rent or buy.', '🏠', 70, true)
ON CONFLICT (name) DO UPDATE
SET slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- Provide defaults for other existing categories to avoid null metadata.
UPDATE public.marketplace_categories
SET description = COALESCE(description,
    CASE lower(name)
      WHEN 'cosmetics' THEN 'Beauty & cosmetics specialty shops.'
      WHEN 'liquorstores' THEN 'Liquor stores and bottle shops.'
      WHEN 'bars & restaurants' THEN 'Bars, cafés, and restaurants.'
      ELSE 'Marketplace listing.'
    END),
    icon = COALESCE(icon,
    CASE lower(name)
      WHEN 'cosmetics' THEN '💄'
      WHEN 'liquorstores' THEN '🍾'
      WHEN 'bars & restaurants' THEN '🍽️'
      ELSE '🏷️'
    END);

-- Guarantee slug backfill after renames.
UPDATE public.marketplace_categories
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g')
WHERE slug IS NULL OR slug = '';

-- Backfill business category_id from legacy text column when possible.
UPDATE public.businesses AS b
SET category_id = mc.id
FROM public.marketplace_categories AS mc
WHERE b.category_id IS NULL
  AND lower(coalesce(b.category, '')) = lower(mc.name);

COMMIT;
