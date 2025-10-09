-- Row Level Security policies for dine-in platform
-- Requires schema objects from 20251002120000_core_schema.sql

-- Guard clause to prevent redefinition if rerun
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'platform_role'
  ) THEN
    CREATE ROLE platform_role;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'vendor_manager_role'
  ) THEN
    CREATE ROLE vendor_manager_role;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'vendor_staff_role'
  ) THEN
    CREATE ROLE vendor_staff_role;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'customer_role'
  ) THEN
    CREATE ROLE customer_role;
  END IF;
END $$;

-- Helper function to extract auth claims (wa_id, role, bar context, customer id)
CREATE OR REPLACE FUNCTION public.auth_claim(text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claim.' || $1, true), '');
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.auth_claim('role');
$$;

CREATE OR REPLACE FUNCTION public.auth_wa_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT public.auth_claim('wa_id');
$$;

CREATE OR REPLACE FUNCTION public.auth_bar_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.auth_claim('bar_id'), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.auth_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.auth_claim('customer_id'), '')::uuid;
$$;

-- Enable RLS on tables requiring tenant isolation
ALTER TABLE public.bars          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_numbers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_tables    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs  ENABLE ROW LEVEL SECURITY;

-- Platform/service role bypasses
CREATE POLICY bars_platform_full ON public.bars
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY generic_platform_read ON public.bars
  FOR SELECT USING (public.auth_role() = 'platform');

-- Bars: vendor managers/staff read their own bar; managers can update
CREATE POLICY bars_vendor_select ON public.bars
  FOR SELECT USING (
    public.auth_role() IN ('vendor_manager', 'vendor_staff')
    AND public.auth_bar_id() = bars.id
  );
CREATE POLICY bars_vendor_update ON public.bars
  FOR UPDATE USING (
    public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = bars.id
  ) WITH CHECK (
    public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = bars.id
  );

-- Bar numbers
CREATE POLICY bar_numbers_platform_full ON public.bar_numbers
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY bar_numbers_vendor_select ON public.bar_numbers
  FOR SELECT USING (
    public.auth_role() IN ('vendor_manager', 'vendor_staff')
    AND public.auth_bar_id() = bar_numbers.bar_id
  );
CREATE POLICY bar_numbers_vendor_manage ON public.bar_numbers
  FOR INSERT
  WITH CHECK (
    public.auth_role() = 'vendor_manager'
    AND public.auth_bar_id() = bar_numbers.bar_id
  );
CREATE POLICY bar_numbers_vendor_update ON public.bar_numbers
  FOR UPDATE USING (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = bar_numbers.bar_id)
  WITH CHECK (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = bar_numbers.bar_id);

-- Bar settings
CREATE POLICY bar_settings_platform_full ON public.bar_settings
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY bar_settings_vendor_rw ON public.bar_settings
  USING (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = bar_settings.bar_id)
  WITH CHECK (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = bar_settings.bar_id);

-- Menus (published menus accessible to all customers)
CREATE POLICY menus_platform_full ON public.menus
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY menus_published_select ON public.menus
  FOR SELECT USING (
    public.auth_role() IN ('customer', 'vendor_manager', 'vendor_staff')
    AND (
      public.auth_role() = 'customer'
      OR public.auth_bar_id() = menus.bar_id
    )
  );
CREATE POLICY menus_vendor_manage ON public.menus
  FOR ALL USING (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = menus.bar_id)
  WITH CHECK (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = menus.bar_id);

-- Categories
CREATE POLICY categories_platform_full ON public.categories
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY categories_published_select ON public.categories
  FOR SELECT USING (
    public.auth_role() IN ('customer', 'vendor_manager', 'vendor_staff')
    AND (
      public.auth_role() = 'customer'
      OR public.auth_bar_id() = categories.bar_id
    )
  );
CREATE POLICY categories_vendor_manage ON public.categories
  FOR ALL USING (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = categories.bar_id)
  WITH CHECK (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = categories.bar_id);

-- Items
CREATE POLICY items_platform_full ON public.items
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY items_published_select ON public.items
  FOR SELECT USING (
    public.auth_role() IN ('customer', 'vendor_manager', 'vendor_staff')
    AND (
      public.auth_role() = 'customer'
      OR public.auth_bar_id() = items.bar_id
    )
  );
CREATE POLICY items_vendor_manage ON public.items
  FOR ALL USING (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = items.bar_id)
  WITH CHECK (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = items.bar_id);

-- Item modifiers
CREATE POLICY item_modifiers_platform_full ON public.item_modifiers
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY item_modifiers_vendor_rw ON public.item_modifiers
  USING (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = (SELECT items.bar_id FROM public.items WHERE items.id = item_modifiers.item_id))
  WITH CHECK (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = (SELECT items.bar_id FROM public.items WHERE items.id = item_modifiers.item_id));

-- Tables (QR)
CREATE POLICY bar_tables_platform_full ON public.bar_tables
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY bar_tables_vendor_rw ON public.bar_tables
  USING (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = bar_tables.bar_id)
  WITH CHECK (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = bar_tables.bar_id);
CREATE POLICY bar_tables_vendor_select ON public.bar_tables
  FOR SELECT USING (public.auth_role() IN ('vendor_manager', 'vendor_staff') AND public.auth_bar_id() = bar_tables.bar_id);
CREATE POLICY bar_tables_customer_select ON public.bar_tables
  FOR SELECT USING (public.auth_role() = 'customer');

-- Customers table (platform only; customers mutate via service)
CREATE POLICY customers_platform_full ON public.customers
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY customers_self_select ON public.customers
  FOR SELECT USING (public.auth_role() = 'customer' AND public.auth_customer_id() = customers.id);

-- Carts
CREATE POLICY carts_platform_full ON public.carts
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY carts_customer_rw ON public.carts
  USING (public.auth_role() = 'customer' AND public.auth_customer_id() = carts.customer_id)
  WITH CHECK (public.auth_role() = 'customer' AND public.auth_customer_id() = carts.customer_id);
CREATE POLICY carts_vendor_select ON public.carts
  FOR SELECT USING (
    public.auth_role() IN ('vendor_manager', 'vendor_staff')
    AND public.auth_bar_id() = carts.bar_id
  );

-- Cart items
CREATE POLICY cart_items_platform_full ON public.cart_items
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY cart_items_customer_rw ON public.cart_items
  USING (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
        AND carts.customer_id = public.auth_customer_id()
    )
  ) WITH CHECK (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
        AND carts.customer_id = public.auth_customer_id()
    )
  );

-- Orders
CREATE POLICY orders_platform_full ON public.orders
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY orders_customer_select ON public.orders
  FOR SELECT USING (public.auth_role() = 'customer' AND public.auth_customer_id() = orders.customer_id);
CREATE POLICY orders_vendor_rw ON public.orders
  USING (public.auth_role() IN ('vendor_manager', 'vendor_staff') AND public.auth_bar_id() = orders.bar_id)
  WITH CHECK (public.auth_role() IN ('vendor_manager', 'vendor_staff') AND public.auth_bar_id() = orders.bar_id);

-- Order items
CREATE POLICY order_items_platform_full ON public.order_items
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY order_items_customer_select ON public.order_items
  FOR SELECT USING (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.customer_id = public.auth_customer_id()
    )
  );
CREATE POLICY order_items_vendor_select ON public.order_items
  FOR SELECT USING (
    public.auth_role() IN ('vendor_manager', 'vendor_staff')
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.bar_id = public.auth_bar_id()
    )
  );

-- Order events
CREATE POLICY order_events_platform_full ON public.order_events
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY order_events_customer_select ON public.order_events
  FOR SELECT USING (
    public.auth_role() = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_events.order_id
        AND orders.customer_id = public.auth_customer_id()
    )
  );
CREATE POLICY order_events_vendor_rw ON public.order_events
  USING (
    public.auth_role() IN ('vendor_manager', 'vendor_staff')
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_events.order_id
        AND orders.bar_id = public.auth_bar_id()
    )
  ) WITH CHECK (
    public.auth_role() IN ('vendor_manager', 'vendor_staff')
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_events.order_id
        AND orders.bar_id = public.auth_bar_id()
    )
  );

-- Sessions
CREATE POLICY sessions_platform_full ON public.sessions
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY sessions_role_rw ON public.sessions
  USING (
    (public.auth_role() = 'customer' AND public.auth_customer_id() = sessions.customer_id)
    OR (public.auth_role() IN ('vendor_manager', 'vendor_staff') AND public.auth_bar_id() = sessions.bar_id)
  )
  WITH CHECK (
    (public.auth_role() = 'customer' AND public.auth_customer_id() = sessions.customer_id)
    OR (public.auth_role() IN ('vendor_manager', 'vendor_staff') AND public.auth_bar_id() = sessions.bar_id)
  );

-- Notifications
CREATE POLICY notifications_platform_full ON public.notifications
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY notifications_role_select ON public.notifications
  FOR SELECT USING (
    (public.auth_role() = 'customer' AND public.auth_wa_id() = notifications.to_wa_id)
    OR (public.auth_role() IN ('vendor_manager', 'vendor_staff') AND EXISTS (
      SELECT 1 FROM public.orders WHERE public.orders.id = notifications.order_id AND public.orders.bar_id = public.auth_bar_id()
    ))
  );

-- OCR jobs (platform + vendor managers for their bar)
CREATE POLICY ocr_jobs_platform_full ON public.ocr_jobs
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
CREATE POLICY ocr_jobs_vendor_select ON public.ocr_jobs
  FOR SELECT USING (public.auth_role() = 'vendor_manager' AND public.auth_bar_id() = ocr_jobs.bar_id);

-- Flow submissions (platform only)
CREATE POLICY flow_submissions_platform_full ON public.flow_submissions
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');

-- Webhook logs (platform only)
CREATE POLICY webhook_logs_platform_full ON public.webhook_logs
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');

-- Audit log (platform only)
CREATE POLICY audit_log_platform_full ON public.audit_log
  FOR ALL USING (public.auth_role() = 'platform') WITH CHECK (public.auth_role() = 'platform');
COMMIT;
