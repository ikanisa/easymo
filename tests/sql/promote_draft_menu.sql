-- SQL assertions for menu_admin.promote_draft_menu()
BEGIN;
SET LOCAL search_path TO public, menu_admin;

DO $$
DECLARE
  v_bar_id uuid := gen_random_uuid();
  v_slug text := 'test-bar-' || substring(gen_random_uuid()::text, 1, 8);
  v_draft_menu_id uuid := gen_random_uuid();
  v_category_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_modifier_id uuid := gen_random_uuid();
  v_published uuid;
  v_new_category uuid;
  v_new_item uuid;
  v_published_cnt int;
  v_archived_cnt int;
BEGIN
  INSERT INTO public.bars (id, slug, name, currency, is_active, created_at, updated_at, location_text, country)
  VALUES (v_bar_id, v_slug, 'Test Phase Menu', 'RWF', true, timezone('utc', now()), timezone('utc', now()), 'Kigali', 'RW');

  INSERT INTO public.menus (id, bar_id, version, status, source, source_file_ids, created_by)
  VALUES (v_draft_menu_id, v_bar_id, 1, 'draft', 'manual', ARRAY['seed'], 'automation');

  INSERT INTO public.categories (id, bar_id, menu_id, parent_category_id, name, sort_order, is_deleted)
  VALUES (v_category_id, v_bar_id, v_draft_menu_id, NULL, 'Starters', 1, false);

  INSERT INTO public.items (
    id,
    bar_id,
    menu_id,
    category_id,
    name,
    short_description,
    price_minor,
    currency,
    flags,
    is_available,
    sort_order,
    metadata
  )
  VALUES (
    v_item_id,
    v_bar_id,
    v_draft_menu_id,
    v_category_id,
    'Samosa',
    'Crispy vegetarian samosa',
    2500,
    'RWF',
    '[]'::jsonb,
    true,
    1,
    '{}'::jsonb
  );

  INSERT INTO public.item_modifiers (id, item_id, name, modifier_type, is_required, options, sort_order)
  VALUES (
    v_modifier_id,
    v_item_id,
    'Sauce',
    'single',
    false,
    '[{"label":"Chili","price_delta_minor":0}]'::jsonb,
    1
  );

  v_published := menu_admin.promote_draft_menu(v_bar_id, v_draft_menu_id);
  IF v_published IS NULL THEN
    RAISE EXCEPTION 'Expected promote_draft_menu to return new menu id';
  END IF;

  SELECT count(*) INTO v_published_cnt
  FROM public.menus
  WHERE bar_id = v_bar_id AND status = 'published';
  IF v_published_cnt <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one published menu, found %', v_published_cnt;
  END IF;

  SELECT count(*) INTO v_archived_cnt
  FROM public.menus
  WHERE bar_id = v_bar_id AND status = 'archived';
  IF v_archived_cnt <> 0 THEN
    RAISE EXCEPTION 'Did not expect archived menus during first publish (found %)', v_archived_cnt;
  END IF;

  SELECT id INTO v_new_category
  FROM public.categories
  WHERE menu_id = v_published;
  IF v_new_category IS NULL OR v_new_category = v_category_id THEN
    RAISE EXCEPTION 'Expected published menu to have cloned category distinct from draft';
  END IF;

  SELECT id INTO v_new_item
  FROM public.items
  WHERE menu_id = v_published;
  IF v_new_item IS NULL OR v_new_item = v_item_id THEN
    RAISE EXCEPTION 'Expected published menu to clone item with new id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.item_modifiers m
    WHERE m.item_id = v_new_item
      AND m.name = 'Sauce'
  ) THEN
    RAISE EXCEPTION 'Expected modifiers to be cloned for new menu item';
  END IF;

  -- Clean up inserted seed data
  DELETE FROM public.item_modifiers WHERE item_id IN (v_item_id, v_new_item);
  DELETE FROM public.items WHERE id IN (v_item_id, v_new_item);
  DELETE FROM public.categories WHERE id IN (v_category_id, v_new_category);
  DELETE FROM public.menus WHERE bar_id = v_bar_id;
  DELETE FROM public.bars WHERE id = v_bar_id;
END;
$$;

DO $$
BEGIN
  IF NOT has_function_privilege('service_role', 'menu_admin.promote_draft_menu(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must retain execute privilege on promote_draft_menu';
  END IF;
  IF has_function_privilege('authenticated', 'menu_admin.promote_draft_menu(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role must not execute promote_draft_menu';
  END IF;
  IF has_function_privilege('anon', 'menu_admin.promote_draft_menu(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon role must not execute promote_draft_menu';
  END IF;
END;
$$;

ROLLBACK;
