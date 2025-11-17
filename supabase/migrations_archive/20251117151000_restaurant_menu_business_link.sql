BEGIN;

-- 1) Add business_id to restaurant_menu_items if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurant_menu_items'
      AND column_name = 'business_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.restaurant_menu_items ADD COLUMN business_id uuid NULL';
  END IF;
END $$;

-- Add FK to public.business(id) when table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'business'
  ) THEN
    -- Drop previous constraint if it exists with another name
    BEGIN
      ALTER TABLE public.restaurant_menu_items
      DROP CONSTRAINT IF EXISTS restaurant_menu_items_business_id_fkey;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;

    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.business(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_business_id
  ON public.restaurant_menu_items(business_id);

-- 2) Reconciliation procedure: best-effort link between bars and business
CREATE OR REPLACE FUNCTION public.reconcile_menu_business_links()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Match bars to business by name + country and proximity, then backfill business_id
  WITH mapping AS (
    SELECT DISTINCT ON (b.id)
      b.id        AS bar_id,
      biz.id      AS business_id
    FROM public.bars b
    JOIN public.business biz
      ON UPPER(COALESCE(biz.country, '')) = UPPER(COALESCE(b.country, ''))
     AND (
          biz.name ILIKE b.name
          OR (biz.name ILIKE ('%' || b.name || '%'))
         )
     AND (
          (b.location IS NOT NULL AND biz.location IS NOT NULL AND 
             ST_Distance(b.location, biz.location) <= 300::double precision)
          OR (
            b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND
            biz.latitude IS NOT NULL AND biz.longitude IS NOT NULL AND
            public.haversine_km(b.latitude, b.longitude, biz.latitude, biz.longitude) <= 0.3
          )
         )
    ORDER BY b.id, biz.updated_at DESC NULLS LAST
  )
  UPDATE public.restaurant_menu_items r
     SET business_id = m.business_id
    FROM mapping m
   WHERE r.bar_id = m.bar_id
     AND r.business_id IS DISTINCT FROM m.business_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.reconcile_menu_business_links() IS 'Attempts to link restaurant_menu_items to public.business via bars matching (name/country/proximity). Returns number of rows updated.';

COMMIT;

