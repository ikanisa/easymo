-- remove discontinued baskets and vouchers domain objects
BEGIN;

-- Drop dependent triggers first to avoid dangling references
DO $$
BEGIN
  IF to_regclass('public.baskets') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_baskets_rate_limit ON public.baskets';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_baskets_sync ON public.baskets';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_baskets_updated ON public.baskets';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_baskets_updated_v2 ON public.baskets';
  END IF;
  IF to_regclass('public.vouchers') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_vouchers_updated ON public.vouchers';
    EXECUTE 'DROP TRIGGER IF EXISTS vouchers_sync_admin_columns ON public.vouchers';
  END IF;
END
$$;

-- Remove basket helper functions
DROP FUNCTION IF EXISTS public.fn_assert_basket_create_rate_limit() CASCADE;
DROP FUNCTION IF EXISTS public.fn_sync_baskets_to_ibimina() CASCADE;
DROP FUNCTION IF EXISTS public.basket_close(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.basket_create(uuid, text, text, boolean, integer) CASCADE;
DROP FUNCTION IF EXISTS public.basket_create(uuid, text, text, boolean, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.basket_detail(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.basket_discover_nearby(uuid, double precision, double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS public.basket_generate_qr(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.basket_join_by_code(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.basket_leave(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.basket_list_mine(uuid) CASCADE;

-- Remove voucher helper
DROP FUNCTION IF EXISTS public.vouchers_sync_admin_columns() CASCADE;

-- Drop basket tables
DROP TABLE IF EXISTS public.baskets_reminder_events CASCADE;
DROP TABLE IF EXISTS public.baskets_reminders CASCADE;
DROP TABLE IF EXISTS public.basket_invites CASCADE;
DROP TABLE IF EXISTS public.basket_members CASCADE;
DROP TABLE IF EXISTS public.basket_contributions CASCADE;
DROP TABLE IF EXISTS public.baskets CASCADE;

-- Drop voucher tables
DROP TABLE IF EXISTS public.voucher_events CASCADE;
DROP TABLE IF EXISTS public.voucher_redemptions CASCADE;
DROP TABLE IF EXISTS public.vouchers CASCADE;

-- Drop basket enums
DROP TYPE IF EXISTS public.basket_status;
DROP TYPE IF EXISTS public.basket_type;

COMMIT;
