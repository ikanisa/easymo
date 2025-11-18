BEGIN;

-- Minimal orders schema for bars (works with admin dashboard + WA flows)

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  order_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  table_label TEXT,
  total_minor INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT orders_status_valid CHECK (status IN ('pending','preparing','confirmed','served','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_orders_bar ON public.orders(bar_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  price_minor INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Bar managers can read orders for their bars
CREATE POLICY IF NOT EXISTS "Managers can read their bar orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = orders.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  );

CREATE POLICY IF NOT EXISTS "Managers can read their bar order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.bar_managers m ON m.bar_id = o.bar_id
      WHERE o.id = order_items.order_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

-- Service role full access
CREATE POLICY IF NOT EXISTS "Service role can manage orders"
  ON public.orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can manage order items"
  ON public.order_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

COMMENT ON TABLE public.orders IS 'Lightweight bar orders for dashboards and WA overview';
COMMENT ON TABLE public.order_items IS 'Items composing each order';

COMMIT;

