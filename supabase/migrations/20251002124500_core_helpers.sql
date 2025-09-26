-- Helper sequences, trigger functions, and supporting views for dine-in schema

-- Order code sequence and generator
CREATE SEQUENCE IF NOT EXISTS public.order_code_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq bigint;
BEGIN
  SELECT nextval('public.order_code_seq') INTO v_seq;
  RETURN upper(lpad(to_hex(v_seq), 6, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_code IS NULL OR NEW.order_code = '' THEN
    NEW.order_code := public.generate_order_code();
  END IF;
  IF NEW.created_at IS NULL THEN
    NEW.created_at := timezone('utc', now());
  END IF;
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_defaults ON public.orders;
CREATE TRIGGER trg_orders_defaults
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_set_defaults();

-- Convenience view for published menus (latest published per bar)
CREATE OR REPLACE VIEW public.published_menus AS
SELECT DISTINCT ON (bar_id)
  m.*
FROM public.menus m
WHERE m.status = 'published'
ORDER BY bar_id, m.published_at DESC NULLS LAST, m.updated_at DESC;

-- Materialized view for item availability (optional read cache)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.menu_items_snapshot AS
SELECT
  i.id AS item_id,
  i.bar_id,
  i.menu_id,
  i.category_id,
  i.name,
  i.short_description,
  i.price_minor,
  COALESCE(i.currency, b.currency) AS currency,
  i.flags,
  i.is_available,
  i.sort_order,
  i.metadata,
  i.updated_at
FROM public.items i
JOIN public.bars b ON b.id = i.bar_id
WHERE i.is_available = true;

CREATE INDEX IF NOT EXISTS idx_menu_items_snapshot_bar_category
  ON public.menu_items_snapshot (bar_id, category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_snapshot_item ON public.menu_items_snapshot (item_id);

-- Refresh helper
CREATE OR REPLACE FUNCTION public.refresh_menu_items_snapshot()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.menu_items_snapshot;
$$;

-- Ensure snapshot refresh on publish
CREATE OR REPLACE FUNCTION public.on_menu_publish_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_menu_items_snapshot();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_menus_refresh_snapshot ON public.menus;
CREATE TRIGGER trg_menus_refresh_snapshot
  AFTER UPDATE OF status ON public.menus
  FOR EACH ROW
  WHEN (NEW.status = 'published')
  EXECUTE FUNCTION public.on_menu_publish_refresh();
