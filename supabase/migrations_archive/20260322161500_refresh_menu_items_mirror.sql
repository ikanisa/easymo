BEGIN;

-- Refresh mirror of Rwanda bars/restaurant catalog into public.menu_items.
-- This is idempotent and safe to re-run: it clears previous mirrored rows (metadata.source = 'mirror').

DO $$
DECLARE
  has_cat_name BOOLEAN;
  has_cat_id BOOLEAN;
  has_menu_id BOOLEAN;
  has_restaurant_id BOOLEAN;
  cols_prefix TEXT := '';
  vals_prefix TEXT := '';
  v_restaurant_id UUID := NULL;
BEGIN
  -- Remove previously mirrored rows
  BEGIN
    DELETE FROM public.menu_items WHERE COALESCE((metadata->>'source'),'') = 'mirror';
  EXCEPTION WHEN undefined_column THEN
    -- metadata column might not exist; skip cleanup
    NULL;
  END;

  -- Detect available target columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_name'
  ) INTO has_cat_name;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_id'
  ) INTO has_cat_id;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'menu_id'
  ) INTO has_menu_id;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'restaurant_id'
  ) INTO has_restaurant_id;

  IF has_menu_id THEN
    cols_prefix := 'menu_id, ';
    vals_prefix := 'NULL::uuid, ';
  END IF;

  IF has_restaurant_id THEN
    BEGIN
      SELECT id INTO v_restaurant_id FROM public.restaurants WHERE slug = 'rw-bars-default' LIMIT 1;
      IF v_restaurant_id IS NULL THEN
        SELECT id INTO v_restaurant_id FROM public.restaurants LIMIT 1;
      END IF;
      IF v_restaurant_id IS NOT NULL THEN
        cols_prefix := cols_prefix || 'restaurant_id, ';
        vals_prefix := vals_prefix || quote_literal(v_restaurant_id::text) || '::uuid, ';
      END IF;
    EXCEPTION WHEN undefined_table THEN
      -- No restaurants table; skip
      NULL;
    END;
  END IF;

  -- Insert catalog rows from restaurant_menu_items for Rwanda bars
  IF has_cat_name AND has_cat_id THEN
    EXECUTE format($f$
      INSERT INTO public.menu_items (%sname, description, price, currency, image_url, is_available, sort_order, metadata, category_name, category_id)
      SELECT %srmi.name, rmi.description, rmi.price, COALESCE(rmi.currency, 'RWF'), rmi.image_url, COALESCE(rmi.is_available, true), 0,
             jsonb_build_object('source','mirror','from','restaurant_menu_items'), rmi.category_name, rmi.category_id
      FROM (
        SELECT DISTINCT ON (r.category_id, r.category_name, r.name, COALESCE(r.description,'')) r.*
        FROM public.restaurant_menu_items r
        JOIN public.bars b ON b.id = r.bar_id
        WHERE b.country = 'Rwanda'
        ORDER BY r.category_id, r.category_name, r.name, COALESCE(r.description,''), r.created_at
      ) rmi
      ORDER BY rmi.category_name, rmi.name
    $f$, cols_prefix, vals_prefix);
  ELSIF has_cat_name THEN
    EXECUTE format($f$
      INSERT INTO public.menu_items (%sname, description, price, currency, image_url, is_available, sort_order, metadata, category_name)
      SELECT %srmi.name, rmi.description, rmi.price, COALESCE(rmi.currency, 'RWF'), rmi.image_url, COALESCE(rmi.is_available, true), 0,
             jsonb_build_object('source','mirror','from','restaurant_menu_items'), rmi.category_name
      FROM (
        SELECT DISTINCT ON (r.category_name, r.name, COALESCE(r.description,'')) r.*
        FROM public.restaurant_menu_items r
        JOIN public.bars b ON b.id = r.bar_id
        WHERE b.country = 'Rwanda'
        ORDER BY r.category_name, r.name, COALESCE(r.description,''), r.created_at
      ) rmi
      ORDER BY rmi.category_name, rmi.name
    $f$, cols_prefix, vals_prefix);
  ELSE
    EXECUTE format($f$
      INSERT INTO public.menu_items (%sname, description, price, currency, image_url, is_available, sort_order, metadata)
      SELECT %srmi.name, rmi.description, rmi.price, COALESCE(rmi.currency, 'RWF'), rmi.image_url, COALESCE(rmi.is_available, true), 0,
             jsonb_build_object('source','mirror','from','restaurant_menu_items')
      FROM (
        SELECT DISTINCT ON (r.name, COALESCE(r.description,'')) r.*
        FROM public.restaurant_menu_items r
        JOIN public.bars b ON b.id = r.bar_id
        WHERE b.country = 'Rwanda'
        ORDER BY r.name, COALESCE(r.description,''), r.created_at
      ) rmi
      ORDER BY rmi.name
    $f$, cols_prefix, vals_prefix);
  END IF;
END $$;

COMMIT;

