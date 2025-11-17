BEGIN;

-- Mirror the shared Rwanda bars/restaurant catalog from restaurant_menu_items
-- into the generic public.menu_items under a single shared menu.

DO $$
DECLARE
  has_cat_name BOOLEAN;
  has_cat BOOLEAN;
  has_cat_id BOOLEAN;
  has_menu_id BOOLEAN;
  has_restaurant_id BOOLEAN;
  cols_prefix TEXT := '';
  vals_prefix TEXT := '';
  v_restaurant_id UUID := NULL;
BEGIN
  -- Make idempotent: clear prior mirrored entries (identified by metadata.source = 'mirror')
  DELETE FROM public.menu_items WHERE COALESCE((metadata->>'source'),'') = 'mirror';

  -- Detect target columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category_name'
  ) INTO has_cat_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'category'
  ) INTO has_cat;

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
  ELSE
    cols_prefix := '';
    vals_prefix := '';
  END IF;

  -- If menu_items requires restaurant_id, try to pick an existing restaurant id
  IF has_restaurant_id THEN
    BEGIN
      SELECT id INTO v_restaurant_id FROM public.restaurants WHERE slug = 'rw-bars-default' LIMIT 1;
      IF v_restaurant_id IS NULL THEN
        SELECT id INTO v_restaurant_id FROM public.restaurants LIMIT 1;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      -- restaurants table not present; leave v_restaurant_id NULL and skip adding restaurant_id
      v_restaurant_id := NULL;
    END;
    IF v_restaurant_id IS NOT NULL THEN
      cols_prefix := cols_prefix || 'restaurant_id, ';
      vals_prefix := vals_prefix || quote_literal(v_restaurant_id::text) || '::uuid, ';
    END IF;
  END IF;

  -- Insert distinct catalog rows (deduplicated across RW bars)
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
  ELSIF has_cat THEN
    EXECUTE format($f$
      INSERT INTO public.menu_items (%sname, description, price, currency, image_url, is_available, sort_order, metadata, category)
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
    -- Fallback: no category columns found; insert without category
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
