-- Migration: Refactor profile_menu_items to match current 3-item implementation
-- Purpose: Update profile_menu_items table to align with simplified profile menu
-- Date: 2025-12-17

BEGIN;

-- ============================================================
-- 1. DELETE ALL EXISTING PROFILE MENU ITEMS
-- ============================================================

DELETE FROM public.profile_menu_items;

-- ============================================================
-- 2. INSERT THE 3 PROFILE MENU ITEMS (matching implementation)
-- ============================================================

-- Item 1: MoMo QR Code
INSERT INTO public.profile_menu_items (
  item_key,
  display_order,
  icon,
  translations,
  action_type,
  action_target,
  is_active,
  requires_verification,
  active_countries,
  track_analytics,
  analytics_event_name,
  metadata
) VALUES (
  'momo_qr',
  1,
  '📱',
  '{
    "en": {"title": "MoMo QR Code", "description": "Generate payment QR code"},
    "fr": {"title": "Code QR MoMo", "description": "Générer QR pour paiements"},
    "rw": {"title": "QR ya MoMo", "description": "Kora QR yo kwishyura"}
  }'::jsonb,
  'route',
  'momoqr_start',
  true,
  false,
  ARRAY['RW', 'TZ', 'UG'],
  true,
  'PROFILE_MOMO_QR_CLICKED',
  '{}'::jsonb
);

-- Item 2: Wallet (Transfer Tokens)
INSERT INTO public.profile_menu_items (
  item_key,
  display_order,
  icon,
  translations,
  action_type,
  action_target,
  is_active,
  requires_verification,
  active_countries,
  track_analytics,
  analytics_event_name,
  metadata
) VALUES (
  'wallet_transfer',
  2,
  '💰',
  '{
    "en": {"title": "Wallet (Transfer Tokens)", "description": "Send tokens to other users"},
    "fr": {"title": "Portefeuille (Transférer)", "description": "Envoyer des tokens"},
    "rw": {"title": "Agasanduku (Kohereza)", "description": "Kohereza tokens"}
  }'::jsonb,
  'route',
  'WALLET',
  true,
  false,
  ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
  true,
  'PROFILE_WALLET_CLICKED',
  '{}'::jsonb
);

-- Item 3: Share easyMO
INSERT INTO public.profile_menu_items (
  item_key,
  display_order,
  icon,
  translations,
  action_type,
  action_target,
  is_active,
  requires_verification,
  active_countries,
  track_analytics,
  analytics_event_name,
  metadata
) VALUES (
  'share_easymo',
  3,
  '🔗',
  '{
    "en": {"title": "Share easyMO", "description": "Get your referral link"},
    "fr": {"title": "Partager easyMO", "description": "Obtenir votre lien de parrainage"},
    "rw": {"title": "Sangira easyMO", "description": "Bona link yawe"}
  }'::jsonb,
  'route',
  'share_easymo',
  true,
  false,
  ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
  true,
  'PROFILE_SHARE_EASYMO_CLICKED',
  '{}'::jsonb
);

-- ============================================================
-- 3. CREATE/UPDATE RPC FUNCTION TO FETCH PROFILE MENU ITEMS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_profile_menu_items(
  user_country_code TEXT DEFAULT 'RW'
)
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
    AND (
      pmi.active_countries IS NULL
      OR user_country_code = ANY(pmi.active_countries)
    )
  ORDER BY pmi.display_order ASC;
END;
$$;

-- ============================================================
-- 4. GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_profile_menu_items(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_menu_items(TEXT) TO anon;

-- ============================================================
-- 5. COMMENTS
-- ============================================================

COMMENT ON FUNCTION public.get_profile_menu_items(TEXT) IS 'Returns active profile menu items filtered by country code. Returns exactly 3 items: MoMo QR Code, Wallet (Transfer Tokens), and Share easyMO.';
COMMENT ON TABLE public.profile_menu_items IS 'Profile menu items - exactly 3 items: MoMo QR Code, Wallet (Transfer Tokens), Share easyMO';

COMMIT;

