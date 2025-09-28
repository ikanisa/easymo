-- Business categories for bars, pharmacies, saloons, etc.
BEGIN;
CREATE TABLE IF NOT EXISTS public.business_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_business_categories_updated_at
  BEFORE UPDATE ON public.business_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.business_categories (slug, label, description)
VALUES
  ('bars-restaurants', 'Bars & restaurants', 'Food, beverage, and hospitality venues.'),
  ('pharmacies', 'Pharmacies', 'Drugstores, chemists, and medical supply shops.'),
  ('saloons', 'Saloons & beauty', 'Hair, spa, and beauty care providers.'),
  ('groceries', 'Groceries', 'Markets, groceries, and convenience stores.'),
  ('services', 'Professional services', 'General professional or field services.')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      updated_at = now();

COMMENT ON TABLE public.business_categories IS
  'Top-level business categories (pharmacies, saloons, etc) used when onboarding outlets.';

CREATE OR REPLACE FUNCTION public.top_bar_items(
  p_bar uuid,
  p_limit integer DEFAULT 9
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  short_description text,
  price_minor integer,
  currency text,
  category_name text,
  is_available boolean,
  total_qty bigint,
  last_order timestamptz
)
LANGUAGE sql
STABLE
AS $$
  WITH agg AS (
    SELECT
      oi.item_id,
      SUM(oi.qty)::bigint AS total_qty,
      MAX(o.created_at) AS last_order
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.bar_id = p_bar
    GROUP BY oi.item_id
  )
  SELECT
    i.id AS item_id,
    i.name AS item_name,
    i.short_description,
    i.price_minor,
    COALESCE(i.currency, b.currency) AS currency,
    cat.name AS category_name,
    i.is_available,
    COALESCE(agg.total_qty, 0) AS total_qty,
    agg.last_order
  FROM public.items i
  JOIN public.bars b ON b.id = i.bar_id
  LEFT JOIN public.categories cat ON cat.id = i.category_id
  LEFT JOIN agg ON agg.item_id = i.id
  WHERE i.bar_id = p_bar
  ORDER BY COALESCE(agg.total_qty, 0) DESC, i.name ASC
  LIMIT COALESCE(p_limit, 9);
$$;

CREATE OR REPLACE FUNCTION public.recent_bar_orders(
  p_bar uuid,
  p_limit integer DEFAULT 9
)
RETURNS TABLE (
  order_id uuid,
  order_code text,
  created_at timestamptz,
  items text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    o.id AS order_id,
    o.order_code,
    o.created_at,
    COALESCE(
      STRING_AGG(
        CONCAT(oi.item_name, ' ×', oi.qty),
        ', ' ORDER BY oi.created_at
      ),
      'No items'
    ) AS items
  FROM public.orders o
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.bar_id = p_bar
  GROUP BY o.id
  ORDER BY o.created_at DESC
  LIMIT COALESCE(p_limit, 9);
$$;
COMMIT;
