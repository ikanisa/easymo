-- Phase 1 Step 3: remove legacy customer references after code rollout

-- Final safety check: ensure new profile_id usage is complete
BEGIN;
DO $$
DECLARE
  carts_missing integer;
  orders_missing integer;
  sessions_missing integer;
BEGIN
  SELECT COUNT(*) INTO carts_missing FROM public.carts WHERE profile_id IS NULL;
  SELECT COUNT(*) INTO orders_missing FROM public.orders WHERE profile_id IS NULL;
  SELECT COUNT(*) INTO sessions_missing FROM public.sessions WHERE profile_id IS NULL;

  IF carts_missing > 0 OR orders_missing > 0 OR sessions_missing > 0 THEN
    RAISE EXCEPTION 'profile_id still NULL in carts=% order=% sessions=%', carts_missing, orders_missing, sessions_missing;
  END IF;
END $$;

-- Ensure downstream policies no longer reference customer_id
ALTER POLICY order_items_customer_select ON public.order_items
  USING (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.profile_id = public.auth_profile_id()
    )
  );

ALTER POLICY order_events_customer_select ON public.order_events
  USING (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_events.order_id
        AND o.profile_id = public.auth_profile_id()
    )
  );

-- Drop legacy customer references
ALTER TABLE public.carts DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.sessions DROP COLUMN IF EXISTS customer_id;

-- Drop mapping table
DROP TABLE IF EXISTS public.legacy_customer_profile;

-- Archive and drop customers table if it still exists
DO $$
BEGIN
  PERFORM 1 FROM pg_catalog.pg_class WHERE relname = 'customers' AND relnamespace = 'public'::regnamespace;
  IF FOUND THEN
    CREATE SCHEMA IF NOT EXISTS archive;
    DROP TABLE IF EXISTS archive.customers;
    EXECUTE 'CREATE TABLE archive.customers AS TABLE public.customers WITH DATA';
    DROP TABLE public.customers;
  END IF;
END $$;

-- Deprecate auth_customer_id helper
CREATE OR REPLACE FUNCTION public.auth_customer_id()
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'auth_customer_id() is deprecated. Use auth_profile_id().' USING ERRCODE = 'P0001';
  RETURN NULL;
END;
$$;
COMMIT;
