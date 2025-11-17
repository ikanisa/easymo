-- Sync business_tags table with actual businesses.tag values
-- ============================================================

BEGIN;

-- Insert missing tags from businesses into business_tags
INSERT INTO public.business_tags (name, slug, icon, is_active, sort_order)
VALUES
  ('Hardware store', 'hardware_store', '🔧', true, 1),
  ('Pharmacy', 'pharmacy', '💊', true, 2),
  ('Bar & Restaurant', 'bar_restaurant', '🍺', true, 3),
  ('Electronics store', 'electronics_store', '📱', true, 4),
  ('Cosmetics store', 'cosmetics_store', '💄', true, 5),
  ('Beauty salon', 'beauty_salon', '💅', true, 6),
  ('Hair salon', 'hair_salon', '✂️', true, 7),
  ('Auto parts store', 'auto_parts_store', '🚗', true, 8),
  ('Store', 'store', '🏪', true, 9),
  ('Coffee shop', 'coffee_shop', '☕', true, 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

COMMIT;
