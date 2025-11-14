-- Phase 2: move promote_draft_menu to menu_admin schema and drop unused credits helper
BEGIN;

CREATE SCHEMA IF NOT EXISTS menu_admin AUTHORIZATION postgres;
COMMENT ON SCHEMA menu_admin IS 'Privileged menu management routines (Phase 2).';

ALTER FUNCTION public.promote_draft_menu(uuid, uuid) SET SCHEMA menu_admin;

REVOKE ALL ON FUNCTION menu_admin.promote_draft_menu(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION menu_admin.promote_draft_menu(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION menu_admin.promote_draft_menu(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION menu_admin.promote_draft_menu(uuid, uuid) TO service_role;

COMMENT ON FUNCTION menu_admin.promote_draft_menu(uuid, uuid) IS 'Publishes draft menus into the live catalog (restricted to service role).';

DROP FUNCTION IF EXISTS public.increment_profile_credits(uuid, integer);

COMMIT;
