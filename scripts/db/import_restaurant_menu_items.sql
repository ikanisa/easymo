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

WITH resolved AS (
  SELECT
    b.id AS bar_id,
    CASE WHEN lower(COALESCE(NULLIF(trim(t.country),''),'malta')) IN ('mt','malta') THEN 'Malta' ELSE 'Malta' END AS country,
    trim(t.item_name) AS name,
    trim(t.category)  AS category,
    NULLIF(trim(t.price_raw), '')::numeric(12,2) AS price
  FROM tmp_menu_import t
  JOIN public.bars b ON lower(b.name) = lower(trim(t.bar_name))
), distinct_bars AS (
  SELECT DISTINCT bar_id, country FROM resolved
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
)
INSERT INTO public.restaurant_menu_items (
  bar_id, name, category_name, price, currency, created_by
)
SELECT
  r.bar_id,
  r.name,
  r.category,
  r.price,
  -- Use EUR for this import dataset
  'EUR' AS currency,
  'seed:menu-import:MT' AS created_by
FROM resolved r
WHERE r.price IS NOT NULL;

COMMIT;
