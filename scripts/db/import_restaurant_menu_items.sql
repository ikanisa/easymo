-- Import restaurant/bar menu items from a local TSV file.
-- Expects file at: supabase/seed/fixtures/restaurant_menu_items_import.tsv
-- Columns (TSV with header): bar_name	bar_id	item_name	price	category

BEGIN;

-- Staging table for import
DROP TABLE IF EXISTS tmp_menu_import;
CREATE TEMP TABLE tmp_menu_import (
  bar_name   TEXT,
  bar_id     UUID,
  country    TEXT,
  item_name  TEXT,
  price_raw  TEXT,
  category   TEXT
);

-- Client-side copy (psql will read local file)
\copy tmp_menu_import FROM 'supabase/seed/fixtures/restaurant_menu_items_import.tsv' WITH (FORMAT csv, HEADER true, DELIMITER E'\t', QUOTE '"', ESCAPE '"')

-- Normalize and insert
;

-- Normalize bar records: ensure country = 'Malta' (or provided), currency = 'EUR'
;

WITH distinct_bars AS (
  SELECT DISTINCT 
    bar_id,
    CASE 
      WHEN lower(COALESCE(NULLIF(trim(country),''),'malta')) IN ('mt','malta') THEN 'Malta'
      ELSE 'Malta'
    END AS country
  FROM tmp_menu_import
  WHERE bar_id IS NOT NULL
), _bars_upd AS (
  UPDATE public.bars b
  SET country = db.country,
      currency = 'EUR'
  FROM distinct_bars db
  WHERE b.id = db.bar_id
    AND (b.country IS DISTINCT FROM db.country OR b.currency IS DISTINCT FROM 'EUR')
  RETURNING b.id
), _delete_existing AS (
  DELETE FROM public.restaurant_menu_items r
  USING distinct_bars db
  WHERE r.bar_id = db.bar_id
  RETURNING r.bar_id
), cleaned AS (
  SELECT
    bar_id,
    trim(item_name)                      AS name,
    trim(category)                       AS category,
    -- Normalize price to numeric(12,2)
    NULLIF(trim(price_raw), '')::numeric(12,2) AS price
  FROM tmp_menu_import
  WHERE bar_id IS NOT NULL
)
INSERT INTO public.restaurant_menu_items (
  bar_id, name, category_name, price, currency, created_by
)
SELECT
  c.bar_id,
  c.name,
  c.category,
  c.price,
  -- Use EUR for this import dataset
  'EUR' AS currency,
  'seed:menu-import:MT' AS created_by
FROM cleaned c
WHERE c.price IS NOT NULL;

COMMIT;
