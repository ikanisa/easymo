-- Migration: Fix profile_menu_items table - ensure correct alignment
-- Purpose: Ensure profile_menu_items exactly matches the 3-item implementation
-- Date: 2025-12-17

BEGIN;

-- ============================================================
-- 1. DELETE ALL EXISTING ITEMS AND RE-INSERT CORRECTLY
-- ============================================================

DELETE FROM public.profile_menu_items;

-- ============================================================
-- 2. INSERT THE 3 PROFILE MENU ITEMS (EXACT MATCH WITH CODE)
-- ============================================================

-- Item 1: MoMo QR Code
-- action_target must be "momoqr_start" (matches IDS.MOMO_QR)
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
-- action_target must be "WALLET" (matches code expectation)
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
-- action_target must be "share_easymo" (matches IDS.SHARE_EASYMO)
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
-- 3. VERIFY THE DATA
-- ============================================================

DO $$
DECLARE
  item_count INTEGER;
  order_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO item_count FROM public.profile_menu_items WHERE is_active = true;
  SELECT COUNT(DISTINCT display_order) INTO order_count FROM public.profile_menu_items WHERE is_active = true;
  
  IF item_count != 3 THEN
    RAISE EXCEPTION 'Expected 3 profile menu items, found %', item_count;
  END IF;
  
  IF order_count != 3 THEN
    RAISE EXCEPTION 'Expected 3 unique display orders, found %', order_count;
  END IF;
  
  -- Verify action_targets match code expectations
  IF NOT EXISTS (SELECT 1 FROM public.profile_menu_items WHERE item_key = 'momo_qr' AND action_target = 'momoqr_start') THEN
    RAISE EXCEPTION 'MoMo QR action_target mismatch';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.profile_menu_items WHERE item_key = 'wallet_transfer' AND action_target = 'WALLET') THEN
    RAISE EXCEPTION 'Wallet action_target mismatch';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.profile_menu_items WHERE item_key = 'share_easymo' AND action_target = 'share_easymo') THEN
    RAISE EXCEPTION 'Share easyMO action_target mismatch';
  END IF;
END $$;

COMMIT;

