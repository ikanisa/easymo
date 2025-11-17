BEGIN;

-- Improve performance of restaurant menu fetches used by WhatsApp list views
-- Common query patterns:
--   SELECT ... FROM restaurant_menu_items WHERE business_id = $1 AND is_available = true ORDER BY category_name NULLS FIRST, name LIMIT 30
--   SELECT ... FROM restaurant_menu_items WHERE bar_id = $1 AND is_available = true ORDER BY category_name NULLS FIRST, name LIMIT 30

-- Ensure useful indexes exist for both link variants
CREATE INDEX IF NOT EXISTS idx_rmi_business_available_name
  ON public.restaurant_menu_items (business_id, is_available, lower(name));

CREATE INDEX IF NOT EXISTS idx_rmi_bar_available_name
  ON public.restaurant_menu_items (bar_id, is_available, lower(name));

-- Also support ordering by category_name first
CREATE INDEX IF NOT EXISTS idx_rmi_business_available_cat
  ON public.restaurant_menu_items (business_id, is_available, lower(category_name), lower(name));

CREATE INDEX IF NOT EXISTS idx_rmi_bar_available_cat
  ON public.restaurant_menu_items (bar_id, is_available, lower(category_name), lower(name));

COMMIT;

