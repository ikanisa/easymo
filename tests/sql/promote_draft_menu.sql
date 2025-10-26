\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;
SET LOCAL search_path TO public, menu_admin;

SELECT plan(10);

SELECT set_config('promote.bar_id', gen_random_uuid()::text, true);
SELECT set_config('promote.slug', 'test-bar-' || substring(gen_random_uuid()::text, 1, 8), true);
SELECT set_config('promote.draft_menu_id', gen_random_uuid()::text, true);
SELECT set_config('promote.category_id', gen_random_uuid()::text, true);
SELECT set_config('promote.item_id', gen_random_uuid()::text, true);
SELECT set_config('promote.modifier_id', gen_random_uuid()::text, true);

INSERT INTO public.bars (id, slug, name, currency, is_active, created_at, updated_at, location_text, country)
VALUES (
  current_setting('promote.bar_id')::uuid,
  current_setting('promote.slug'),
  'Test Phase Menu',
  'RWF',
  true,
  timezone('utc', now()),
  timezone('utc', now()),
  'Kigali',
  'RW'
);

INSERT INTO public.menus (id, bar_id, version, status, source, source_file_ids, created_by)
VALUES (
  current_setting('promote.draft_menu_id')::uuid,
  current_setting('promote.bar_id')::uuid,
  1,
  'draft',
  'manual',
  ARRAY['seed'],
  'automation'
);

INSERT INTO public.categories (id, bar_id, menu_id, parent_category_id, name, sort_order, is_deleted)
VALUES (
  current_setting('promote.category_id')::uuid,
  current_setting('promote.bar_id')::uuid,
  current_setting('promote.draft_menu_id')::uuid,
  NULL,
  'Starters',
  1,
  false
);

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
  current_setting('promote.item_id')::uuid,
  current_setting('promote.bar_id')::uuid,
  current_setting('promote.draft_menu_id')::uuid,
  current_setting('promote.category_id')::uuid,
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
  current_setting('promote.modifier_id')::uuid,
  current_setting('promote.item_id')::uuid,
  'Sauce',
  'single',
  false,
  '[{"label":"Chili","price_delta_minor":0}]'::jsonb,
  1
);

SELECT set_config(
  'promote.published_menu_id',
  menu_admin.promote_draft_menu(
    current_setting('promote.bar_id')::uuid,
    current_setting('promote.draft_menu_id')::uuid
  )::text,
  true
);

SELECT isnt_null(
  current_setting('promote.published_menu_id', true),
  'promote_draft_menu returns a published menu id'
);

SELECT isnt(
  current_setting('promote.published_menu_id')::uuid,
  current_setting('promote.draft_menu_id')::uuid,
  'published menu id differs from draft menu id'
);

SELECT is(
  (
    SELECT count(*)
      FROM public.menus
     WHERE bar_id = current_setting('promote.bar_id')::uuid
       AND status = 'published'
  ),
  1::bigint,
  'creates exactly one published menu'
);

SELECT is(
  (
    SELECT count(*)
      FROM public.menus
     WHERE bar_id = current_setting('promote.bar_id')::uuid
       AND status = 'archived'
  ),
  0::bigint,
  'does not archive menus during first publish'
);

SELECT set_config(
  'promote.new_category_id',
  (
    SELECT id
      FROM public.categories
     WHERE menu_id = current_setting('promote.published_menu_id')::uuid
     LIMIT 1
  )::text,
  true
);

SELECT isnt(
  current_setting('promote.new_category_id')::uuid,
  current_setting('promote.category_id')::uuid,
  'cloned category has a new id'
);

SELECT set_config(
  'promote.new_item_id',
  (
    SELECT id
      FROM public.items
     WHERE menu_id = current_setting('promote.published_menu_id')::uuid
     LIMIT 1
  )::text,
  true
);

SELECT isnt(
  current_setting('promote.new_item_id')::uuid,
  current_setting('promote.item_id')::uuid,
  'cloned item has a new id'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM public.item_modifiers m
     WHERE m.item_id = current_setting('promote.new_item_id')::uuid
       AND m.name = 'Sauce'
  ),
  'modifiers are cloned for the published menu item'
);

SELECT ok(
  has_function_privilege('service_role', 'menu_admin.promote_draft_menu(uuid, uuid)', 'EXECUTE'),
  'service_role retains EXECUTE on menu_admin.promote_draft_menu'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'menu_admin.promote_draft_menu(uuid, uuid)', 'EXECUTE'),
  'authenticated role cannot execute menu_admin.promote_draft_menu'
);

SELECT ok(
  NOT has_function_privilege('anon', 'menu_admin.promote_draft_menu(uuid, uuid)', 'EXECUTE'),
  'anon role cannot execute menu_admin.promote_draft_menu'
);

SELECT * FROM finish();

ROLLBACK;
