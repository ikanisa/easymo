BEGIN;

ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS bar_id uuid REFERENCES public.bars(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_bar_id ON public.business(bar_id);

COMMENT ON COLUMN public.business.bar_id IS 'Linked bars.id for venues that have full menu/order management';

COMMIT;

