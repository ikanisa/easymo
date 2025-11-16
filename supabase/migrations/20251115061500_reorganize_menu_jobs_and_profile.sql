-- =====================================================
-- REORGANIZE WHATSAPP MENU: JOBS & PROFILE
-- =====================================================
-- 1. Move "Jobs" to display_order 9 (first page)
-- 2. Move "MOMO QR Code" functionality under Profile
-- 3. Update menu structure for better UX
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Update Jobs menu to display_order 9 (first page)
-- =====================================================
-- First page typically shows items 1-9

UPDATE whatsapp_home_menu_items 
SET display_order = 9,
    page_number = 1
WHERE key = 'jobs';

-- =====================================================
-- 2. Remove standalone MOMO QR menu item
-- =====================================================
-- MOMO QR will be accessible from Profile submenu instead

-- Mark as inactive rather than delete (for audit trail)
UPDATE whatsapp_home_menu_items 
SET is_active = false,
    updated_at = now()
WHERE key = 'momo_qr';

-- =====================================================
-- 3. Create Profile submenu table (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS whatsapp_profile_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  label_en text NOT NULL,
  label_fr text,
  label_rw text,
  description_en text,
  description_fr text,
  description_rw text,
  icon text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  requires_verification boolean DEFAULT false,
  feature_flag text,
  action_type text CHECK (action_type IN ('navigate', 'action', 'external')) DEFAULT 'action',
  action_target text, -- function name, route, or URL
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_menu_items_order_idx ON whatsapp_profile_menu_items(display_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS profile_menu_items_active_idx ON whatsapp_profile_menu_items(is_active);

-- =====================================================
-- 4. Seed Profile submenu items
-- =====================================================

INSERT INTO whatsapp_profile_menu_items (
  key,
  name,
  label_en,
  label_fr,
  label_rw,
  description_en,
  description_fr,
  description_rw,
  icon,
  display_order,
  action_type,
  action_target
) VALUES
  -- View/Edit Profile
  (
    'view_profile',
    '👤 My Profile',
    'My Profile',
    'Mon Profil',
    'Umwirondoro Wanjye',
    'View and edit your profile information',
    'Voir et modifier vos informations de profil',
    'Reba kandi uhindure amakuru yawe',
    '👤',
    1,
    'action',
    'show_profile_details'
  ),
  -- MOMO QR Code (moved from main menu)
  (
    'momo_qr',
    '📱 MOMO QR & Tokens',
    'MOMO QR & Tokens',
    'QR MOMO & Jetons',
    'QR ya MOMO n''Ibimenyetso',
    'View your MOMO QR code and payment tokens',
    'Voir votre code QR MOMO et jetons de paiement',
    'Reba QR yawe ya MOMO n''ibimenyetso byo kwishyura',
    '📱',
    2,
    'action',
    'show_momo_qr'
  ),
  -- Payment History
  (
    'payment_history',
    '💳 Payment History',
    'Payment History',
    'Historique des Paiements',
    'Amateka y''Ubwishyu',
    'View your transaction history',
    'Voir l''historique de vos transactions',
    'Reba amateka y''ibikorwa byawe',
    '💳',
    3,
    'action',
    'show_payment_history'
  ),
  -- Saved Locations
  (
    'saved_locations',
    '📍 Saved Locations',
    'Saved Locations',
    'Lieux Sauvegardés',
    'Ahantu Habitswe',
    'Manage your saved addresses',
    'Gérer vos adresses sauvegardées',
    'Genzura aderesi zawe zabitswe',
    '📍',
    4,
    'action',
    'show_saved_locations'
  ),
  -- Settings
  (
    'settings',
    '⚙️ Settings',
    'Settings',
    'Paramètres',
    'Igenamiterere',
    'Manage your account settings and preferences',
    'Gérer les paramètres de votre compte',
    'Genzura igenamiterere rya konti yawe',
    '⚙️',
    5,
    'action',
    'show_settings'
  ),
  -- Language
  (
    'change_language',
    '🌍 Language',
    'Change Language',
    'Changer de Langue',
    'Hindura Ururimi',
    'Choose your preferred language',
    'Choisissez votre langue préférée',
    'Hitamo ururimi ukunda',
    '🌍',
    6,
    'action',
    'change_language'
  ),
  -- Help & Support
  (
    'help_support',
    '❓ Help & Support',
    'Help & Support',
    'Aide & Support',
    'Ubufasha & Inkunga',
    'Get help and contact support',
    'Obtenir de l''aide et contacter le support',
    'Kubona ubufasha no kuvugana n''abakunzi',
    '❓',
    7,
    'action',
    'show_help'
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  label_en = EXCLUDED.label_en,
  label_fr = EXCLUDED.label_fr,
  label_rw = EXCLUDED.label_rw,
  description_en = EXCLUDED.description_en,
  description_fr = EXCLUDED.description_fr,
  description_rw = EXCLUDED.description_rw,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  action_type = EXCLUDED.action_type,
  action_target = EXCLUDED.action_target,
  updated_at = now();

-- =====================================================
-- 5. Add RLS policies for profile menu
-- =====================================================

ALTER TABLE whatsapp_profile_menu_items ENABLE ROW LEVEL SECURITY;

-- Public read access for active menu items
DROP POLICY IF EXISTS "Anyone can view active profile menu items" ON whatsapp_profile_menu_items;
CREATE POLICY "Anyone can view active profile menu items"
  ON whatsapp_profile_menu_items FOR SELECT
  USING (is_active = true);

-- Admin write access (service role only)
DROP POLICY IF EXISTS "Service role can manage profile menu items" ON whatsapp_profile_menu_items;
CREATE POLICY "Service role can manage profile menu items"
  ON whatsapp_profile_menu_items FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 6. Reorder remaining main menu items
-- =====================================================
-- Ensure Jobs is at position 9, adjust others as needed

-- Core services (page 1: orders 1-9)
UPDATE whatsapp_home_menu_items SET display_order = 1 WHERE key = 'profile';
UPDATE whatsapp_home_menu_items SET display_order = 2 WHERE key = 'nearby_drivers';
UPDATE whatsapp_home_menu_items SET display_order = 3 WHERE key = 'nearby_passengers';
UPDATE whatsapp_home_menu_items SET display_order = 4 WHERE key = 'schedule_trip';
UPDATE whatsapp_home_menu_items SET display_order = 5 WHERE key = 'motor_insurance';
UPDATE whatsapp_home_menu_items SET display_order = 6 WHERE key = 'nearby_pharmacies';
UPDATE whatsapp_home_menu_items SET display_order = 7 WHERE key = 'bars_restaurants';
UPDATE whatsapp_home_menu_items SET display_order = 8 WHERE key = 'shops_services';
UPDATE whatsapp_home_menu_items SET display_order = 9 WHERE key = 'jobs'; -- Jobs now on first page

-- Additional services (page 2: orders 10+)
UPDATE whatsapp_home_menu_items SET display_order = 10 WHERE key = 'property_rentals';
UPDATE whatsapp_home_menu_items SET display_order = 11 WHERE key = 'quincailleries';
UPDATE whatsapp_home_menu_items SET display_order = 12 WHERE key = 'notary_services';
UPDATE whatsapp_home_menu_items SET display_order = 13 WHERE key = 'customer_support';

-- =====================================================
-- 7. Add function to get profile menu items
-- =====================================================

CREATE OR REPLACE FUNCTION get_profile_menu_items(user_country_code text DEFAULT 'RW')
RETURNS TABLE (
  key text,
  name text,
  label text,
  description text,
  icon text,
  display_order int,
  action_type text,
  action_target text
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  user_lang text;
BEGIN
  -- Detect language from country (simplified)
  user_lang := CASE 
    WHEN user_country_code IN ('RW', 'BI', 'UG') THEN 'rw'
    WHEN user_country_code IN ('FR', 'BE', 'CI', 'SN', 'CD') THEN 'fr'
    ELSE 'en'
  END;
  
  RETURN QUERY
  SELECT 
    pmi.key,
    pmi.name,
    CASE user_lang
      WHEN 'fr' THEN COALESCE(pmi.label_fr, pmi.label_en)
      WHEN 'rw' THEN COALESCE(pmi.label_rw, pmi.label_en)
      ELSE pmi.label_en
    END as label,
    CASE user_lang
      WHEN 'fr' THEN COALESCE(pmi.description_fr, pmi.description_en)
      WHEN 'rw' THEN COALESCE(pmi.description_rw, pmi.description_en)
      ELSE pmi.description_en
    END as description,
    pmi.icon,
    pmi.display_order,
    pmi.action_type,
    pmi.action_target
  FROM whatsapp_profile_menu_items pmi
  WHERE pmi.is_active = true
  ORDER BY pmi.display_order;
END;
$$;

-- =====================================================
-- 8. Add documentation comments
-- =====================================================

COMMENT ON TABLE whatsapp_profile_menu_items IS 
  'Profile submenu items for WhatsApp interface. MOMO QR moved here from main menu for better UX.';

COMMENT ON FUNCTION get_profile_menu_items IS 
  'Returns localized profile menu items based on user country. Used by Profile section in WhatsApp flow.';

COMMENT ON COLUMN whatsapp_home_menu_items.is_active IS 
  'Active status. MOMO QR set to false as it moved to profile submenu (see whatsapp_profile_menu_items).';

-- =====================================================
-- 9. Update webhook context mapping (for reference)
-- =====================================================
-- Note: Actual webhook code needs update to handle profile submenu
-- This is just metadata for reference

DO $$
BEGIN
  -- Add note about profile submenu structure
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'agent_configs'
  ) THEN
    -- Update profile agent instructions if it exists
    UPDATE agent_configs
    SET instructions = instructions || E'\n\n' || 
      'Profile Menu Structure:' || E'\n' ||
      '- When user selects Profile from main menu, show profile submenu' || E'\n' ||
      '- Submenu includes: View Profile, MOMO QR, Payment History, Saved Locations, Settings, Language, Help' || E'\n' ||
      '- MOMO QR is now inside Profile (not in main menu)'
    WHERE slug = 'profile' AND instructions NOT LIKE '%Profile Menu Structure%';
  END IF;
END;
$$;

COMMIT;
