BEGIN;

-- Add claimed flag to canonical business table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business' AND column_name = 'claimed'
  ) THEN
    ALTER TABLE public.business ADD COLUMN claimed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Backfill claimed=true where an owner is already present
UPDATE public.business
SET claimed = true
WHERE (owner_user_id IS NOT NULL) OR (owner_whatsapp IS NOT NULL);

-- Index for filtering by claimed
CREATE INDEX IF NOT EXISTS idx_business_claimed ON public.business (claimed);

-- Add claimed flag to legacy bars table, used by dashboards/wa flows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bars' AND column_name = 'claimed'
  ) THEN
    ALTER TABLE public.bars ADD COLUMN claimed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bars_claimed ON public.bars (claimed);

COMMENT ON COLUMN public.business.claimed IS 'Whether this business has been claimed by an owner.';
COMMENT ON COLUMN public.bars.claimed IS 'Whether this bar has been claimed by an owner.';

COMMIT;

