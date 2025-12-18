-- Migration: Remove Country and Localization Logic (Rwanda-only)
-- Purpose: Remove all country filtering, localization, and internationalization
-- System is now Rwanda-only, no country filtering needed
-- Date: 2025-12-17

BEGIN;

-- ============================================================
-- 1. REMOVE active_countries COLUMNS FROM MENU TABLES
-- ============================================================

-- Remove active_countries from whatsapp_home_menu_items
ALTER TABLE public.whatsapp_home_menu_items 
  DROP COLUMN IF EXISTS active_countries;

-- Remove active_countries from profile_menu_items
ALTER TABLE public.profile_menu_items 
  DROP COLUMN IF EXISTS active_countries;

-- ============================================================
-- 2. UPDATE RPC FUNCTIONS TO REMOVE COUNTRY FILTERING
-- ============================================================

-- Update get_profile_menu_items to remove country parameter
CREATE OR REPLACE FUNCTION public.get_profile_menu_items()
RETURNS TABLE(
  key TEXT,
  name TEXT,
  icon TEXT,
  display_order INTEGER,
  action_type TEXT,
  action_target TEXT,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pmi.item_key::TEXT as key,
    COALESCE(
      pmi.translations->'en'->>'title',
      pmi.item_key
    )::TEXT as name,
    pmi.icon::TEXT,
    pmi.display_order,
    pmi.action_type::TEXT,
    pmi.action_target::TEXT,
    COALESCE(
      pmi.translations->'en'->>'description',
      ''
    )::TEXT as description
  FROM public.profile_menu_items pmi
  WHERE pmi.is_active = true
  ORDER BY pmi.display_order ASC;
END;
$$;

-- Update grants
GRANT EXECUTE ON FUNCTION public.get_profile_menu_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_menu_items() TO anon;

-- Update get_home_menu_for_user to remove country parameter (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_home_menu_for_user') THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.get_home_menu_for_user(text, text)';
  END IF;
END $$;

-- Update get_profile_menu_items_v2 to remove country parameter (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_profile_menu_items_v2') THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.get_profile_menu_items_v2(uuid, text, text)';
  END IF;
END $$;

-- ============================================================
-- 3. REMOVE COUNTRY-RELATED COLUMNS (OPTIONAL - KEEP FOR DATA)
-- ============================================================

-- Note: We keep country_code columns in data tables (businesses, vendors, etc.)
-- for historical data, but remove filtering logic
-- If you want to remove them completely, uncomment:

-- ALTER TABLE public.businesses DROP COLUMN IF EXISTS country;
-- ALTER TABLE public.vendors DROP COLUMN IF EXISTS country_code;
-- ALTER TABLE public.whatsapp_users DROP COLUMN IF EXISTS country;
-- ALTER TABLE public.whatsapp_broadcast_targets DROP COLUMN IF EXISTS country_code;

-- ============================================================
-- 4. DROP COUNTRY-RELATED INDEXES
-- ============================================================

DROP INDEX IF EXISTS idx_profile_menu_items_countries;
DROP INDEX IF EXISTS idx_vendors_country_code;

-- ============================================================
-- 5. COMMENTS
-- ============================================================

COMMENT ON FUNCTION public.get_profile_menu_items() IS 'Returns active profile menu items. Rwanda-only system, no country filtering.';
COMMENT ON TABLE public.profile_menu_items IS 'Profile menu items - Rwanda-only system, 3 items: MoMo QR Code, Wallet (Transfer Tokens), Share easyMO';

COMMIT;

