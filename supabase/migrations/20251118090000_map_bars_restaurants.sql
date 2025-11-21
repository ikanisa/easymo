BEGIN;

-- Map bars to restaurants for reliable order lookups
CREATE TABLE IF NOT EXISTS public.bar_restaurant_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (bar_id),
  UNIQUE (restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_bar_restaurant_map_bar ON public.bar_restaurant_map(bar_id);
CREATE INDEX IF NOT EXISTS idx_bar_restaurant_map_restaurant ON public.bar_restaurant_map(restaurant_id);

ALTER TABLE public.bar_restaurant_map ENABLE ROW LEVEL SECURITY;

-- Managers can read the mapping for their bars
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'POLICY_NAME_HERE') THEN CREATE POLICY "Managers can read their mappings"
  ON public.bar_restaurant_map
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bar_managers m
      WHERE m.bar_id = bar_restaurant_map.bar_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

-- Service role manages mappings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'POLICY_NAME_HERE') THEN CREATE POLICY "Service role manage mappings"
  ON public.bar_restaurant_map
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.bar_restaurant_map IS 'One-to-one mapping between bars and restaurants for order lookups';

COMMIT;

