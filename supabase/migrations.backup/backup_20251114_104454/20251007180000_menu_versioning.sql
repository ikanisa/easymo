-- Promote draft menus to published versions and clone dependent records
BEGIN;
CREATE OR REPLACE FUNCTION public.promote_draft_menu(
  _bar_id uuid,
  _draft_menu_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.menus%ROWTYPE;
  v_new_menu_id uuid;
  v_next_version integer;
BEGIN
  -- Locate the draft to promote
  IF _draft_menu_id IS NOT NULL THEN
    SELECT * INTO v_draft
    FROM public.menus
    WHERE id = _draft_menu_id
      AND bar_id = _bar_id
      AND status = 'draft'
    FOR UPDATE;
  ELSE
    SELECT * INTO v_draft
    FROM public.menus
    WHERE bar_id = _bar_id
      AND status = 'draft'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft menu not found for bar %', _bar_id USING ERRCODE = 'P0002';
  END IF;

  -- Pick the next semantic version for the published copy
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.menus
  WHERE bar_id = _bar_id;

  v_new_menu_id := gen_random_uuid();

  INSERT INTO public.menus (
    id,
    bar_id,
    version,
    status,
    source,
    source_file_ids,
    created_by,
    created_at,
    updated_at,
    published_at
  )
  VALUES (
    v_new_menu_id,
    _bar_id,
    v_next_version,
    'published',
    v_draft.source,
    v_draft.source_file_ids,
    v_draft.created_by,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  -- Map categories so subcategory relations can be preserved
  CREATE TEMP TABLE tmp_category_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO tmp_category_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.categories
  WHERE menu_id = v_draft.id;

  INSERT INTO public.categories (
    id,
    bar_id,
    menu_id,
    parent_category_id,
    name,
    sort_order,
    is_deleted,
    created_at,
    updated_at
  )
  SELECT
    map.new_id,
    c.bar_id,
    v_new_menu_id,
    CASE
      WHEN c.parent_category_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM tmp_category_map WHERE old_id = c.parent_category_id)
    END,
    c.name,
    c.sort_order,
    c.is_deleted,
    timezone('utc', now()),
    timezone('utc', now())
  FROM public.categories c
  JOIN tmp_category_map map ON map.old_id = c.id
  WHERE c.menu_id = v_draft.id;

  -- Map items for reuse with modifiers
  CREATE TEMP TABLE tmp_item_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO tmp_item_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.items
  WHERE menu_id = v_draft.id;

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
    metadata,
    created_at,
    updated_at
  )
  SELECT
    map.new_id,
    i.bar_id,
    v_new_menu_id,
    CASE
      WHEN i.category_id IS NULL THEN NULL
      ELSE (SELECT new_id FROM tmp_category_map WHERE old_id = i.category_id)
    END,
    i.name,
    i.short_description,
    i.price_minor,
    i.currency,
    i.flags,
    i.is_available,
    i.sort_order,
    i.metadata,
    timezone('utc', now()),
    timezone('utc', now())
  FROM public.items i
  JOIN tmp_item_map map ON map.old_id = i.id
  WHERE i.menu_id = v_draft.id;

  INSERT INTO public.item_modifiers (
    id,
    item_id,
    name,
    modifier_type,
    is_required,
    options,
    sort_order,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    map.new_id,
    m.name,
    m.modifier_type,
    m.is_required,
    m.options,
    m.sort_order,
    timezone('utc', now()),
    timezone('utc', now())
  FROM public.item_modifiers m
  JOIN tmp_item_map map ON map.old_id = m.item_id;

  -- Archive previous published versions
  UPDATE public.menus
  SET status = 'archived', updated_at = timezone('utc', now())
  WHERE bar_id = _bar_id
    AND status = 'published'
    AND id <> v_new_menu_id;

  -- Ensure published snapshot stays in sync
  PERFORM public.refresh_menu_items_snapshot();

  RETURN v_new_menu_id;
END;
$$;
COMMIT;
