BEGIN;

-- Rolling trending windows (7d and 30d)

CREATE MATERIALIZED VIEW IF NOT EXISTS public.menu_item_popularity_7d AS
SELECT
  i.menu_item_id,
  COUNT(*)::int AS order_count
FROM public.waiter_order_items i
JOIN public.waiter_orders o ON o.id = i.order_id
WHERE o.created_at >= (now() AT TIME ZONE 'utc') - interval '7 days'
GROUP BY 1
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.menu_item_popularity_30d AS
SELECT
  i.menu_item_id,
  COUNT(*)::int AS order_count
FROM public.waiter_order_items i
JOIN public.waiter_orders o ON o.id = i.order_id
WHERE o.created_at >= (now() AT TIME ZONE 'utc') - interval '30 days'
GROUP BY 1
WITH NO DATA;

CREATE OR REPLACE FUNCTION public.refresh_menu_item_popularity_windows()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.menu_item_popularity_7d;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.menu_item_popularity_30d;
END$$;

-- Nightly backfill schedule at 03:05 UTC
DO $$
BEGIN
  PERFORM cron.schedule(
    'waiter_trending_refresh_nightly',
    '5 3 * * *',
    $$SELECT public.refresh_menu_item_popularity_windows()$$
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

COMMIT;

