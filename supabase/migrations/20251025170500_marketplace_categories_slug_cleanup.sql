-- Normalize marketplace category slugs after prior data fixes.

BEGIN;
UPDATE public.marketplace_categories
SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g')
WHERE slug IS DISTINCT FROM regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g');

-- Ensure required categories remain active and ordered.
UPDATE public.marketplace_categories
SET is_active = true,
    sort_order = CASE lower(name)
      WHEN 'pharmacies' THEN 10
      WHEN 'quincailleries' THEN 20
      WHEN 'auto spareparts' THEN 30
      WHEN 'shops' THEN 35
      WHEN 'saloons' THEN 40
      WHEN 'mobile money agents' THEN 50
      WHEN 'cars rental/sale' THEN 60
      WHEN 'houses rental/sale' THEN 70
      ELSE sort_order
    END
WHERE lower(name) IN (
  'pharmacies',
  'quincailleries',
  'auto spareparts',
  'shops',
  'saloons',
  'mobile money agents',
  'cars rental/sale',
  'houses rental/sale'
);
COMMIT;
