BEGIN;

-- =====================================================
-- Waiter AI: Orders/Payments schema + Trending view
-- Aligns payment handlers (momo/revolut) with Waiter AI runtime
-- =====================================================

-- Finalised customer orders (promotion from draft_orders)
CREATE TABLE IF NOT EXISTS public.waiter_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.waiter_conversations(id) ON DELETE SET NULL,
  restaurant_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','served','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','processing','paid','failed','refunded')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  tip NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tip >= 0),
  total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency TEXT NOT NULL DEFAULT 'RWF' CHECK (char_length(currency) = 3),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_waiter_orders_user ON public.waiter_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_status ON public.waiter_orders(status);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_payment_status ON public.waiter_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_waiter_orders_created_at ON public.waiter_orders(created_at DESC);

-- Line items for finalised orders
CREATE TABLE IF NOT EXISTS public.waiter_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.waiter_orders(id) ON DELETE CASCADE,
  menu_item_id UUID,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  options JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_waiter_order_items_order ON public.waiter_order_items(order_id);

-- Payments tied to finalised orders
CREATE TABLE IF NOT EXISTS public.waiter_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.waiter_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RWF' CHECK (char_length(currency) = 3),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('momo','revolut','cash')),
  provider_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','successful','failed','refunded')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_waiter_payments_order ON public.waiter_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_waiter_payments_user ON public.waiter_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_waiter_payments_status ON public.waiter_payments(status);

-- RLS enablement (policies can be extended; start permissive for service role)
ALTER TABLE public.waiter_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_payments ENABLE ROW LEVEL SECURITY;

-- Basic owner read policies (service-role bypasses RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waiter_orders' AND policyname = 'waiter_orders_owner_select'
  ) THEN
    CREATE POLICY waiter_orders_owner_select ON public.waiter_orders
      FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waiter_order_items' AND policyname = 'waiter_order_items_owner_select'
  ) THEN
    CREATE POLICY waiter_order_items_owner_select ON public.waiter_order_items
      FOR SELECT USING (order_id IN (SELECT id FROM public.waiter_orders WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waiter_payments' AND policyname = 'waiter_payments_owner_select'
  ) THEN
    CREATE POLICY waiter_payments_owner_select ON public.waiter_payments
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- =====================================================
-- Trending items (MVP): daily counts by menu_item
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.menu_item_popularity_daily AS
SELECT
  date_trunc('day', o.created_at) AS day,
  i.menu_item_id,
  COUNT(*)::int AS order_count
FROM public.waiter_order_items i
JOIN public.waiter_orders o ON o.id = i.order_id
GROUP BY 1, 2
WITH NO DATA;

-- Refresh helper to be called by scheduler/ops
CREATE OR REPLACE FUNCTION public.refresh_menu_item_popularity_daily()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.menu_item_popularity_daily;
END$$;

COMMIT;

