-- Phase 1 Step 2: enforce profile_id, update RLS, and prepare to drop customer_id

-- Ensure mapping still complete before enforcing constraints
BEGIN;
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM public.customers c
  LEFT JOIN public.legacy_customer_profile map ON map.customer_id = c.id
  WHERE map.profile_id IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Profiles still missing for % customers. Aborting migration.', missing_count;
  END IF;
END $$;

-- Enforce NOT NULL where appropriate
ALTER TABLE public.carts
  ALTER COLUMN profile_id SET NOT NULL,
  ADD CONSTRAINT carts_profile_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.orders
  ALTER COLUMN profile_id DROP NOT NULL,
  ADD CONSTRAINT orders_profile_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ALTER COLUMN profile_id DROP NOT NULL,
  ADD CONSTRAINT sessions_profile_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- Update RLS helpers
CREATE OR REPLACE FUNCTION public.auth_profile_id()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT NULLIF(public.auth_claim('profile_id'), '')::uuid;
$$;

-- Temporarily map legacy helper to new claim (will be removed in step 3)
CREATE OR REPLACE FUNCTION public.auth_customer_id()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT public.auth_profile_id();
$$;

-- Update RLS policies to rely on profile_id
ALTER POLICY carts_customer_rw ON public.carts
  USING (public.auth_role() = 'customer' AND public.auth_profile_id() = profile_id)
  WITH CHECK (public.auth_role() = 'customer' AND public.auth_profile_id() = profile_id);

ALTER POLICY cart_items_customer_rw ON public.cart_items
  USING (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.profile_id = public.auth_profile_id()
    )
  )
  WITH CHECK (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.profile_id = public.auth_profile_id()
    )
  );

ALTER POLICY orders_customer_select ON public.orders
  USING (public.auth_role() = 'customer' AND public.auth_profile_id() = profile_id);

ALTER POLICY order_items_customer_select ON public.order_items
  USING (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.profile_id = public.auth_profile_id()
    )
  );

ALTER POLICY order_events_customer_select ON public.order_events
  USING (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_events.order_id
        AND o.profile_id = public.auth_profile_id()
    )
  );

ALTER POLICY sessions_role_rw ON public.sessions
  USING (
    public.auth_role() = 'platform'
    OR (public.auth_role() = 'customer' AND public.auth_profile_id() = profile_id)
    OR (public.auth_role() IN ('vendor_manager','vendor_staff') AND public.auth_bar_id() = sessions.bar_id)
  )
  WITH CHECK (
    public.auth_role() = 'platform'
    OR (public.auth_role() = 'customer' AND public.auth_profile_id() = profile_id)
    OR (public.auth_role() IN ('vendor_manager','vendor_staff') AND public.auth_bar_id() = sessions.bar_id)
  );

-- Sync indexes
DROP INDEX IF EXISTS idx_carts_customer_status;
CREATE INDEX IF NOT EXISTS idx_carts_profile_status ON public.carts(profile_id, status);

-- keep legacy columns until final step (drop in Step 3)
COMMIT;
