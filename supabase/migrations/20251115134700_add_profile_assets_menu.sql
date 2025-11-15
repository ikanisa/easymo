-- =====================================================
-- ADD BUSINESSES, VEHICLES, PROPERTIES, JOBS TO PROFILE MENU
-- =====================================================
-- Adds 4 new profile menu items for managing user assets
-- =====================================================

BEGIN;

-- Insert new profile menu items
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
  -- My Businesses
  (
    'my_businesses',
    '🏢 My Businesses',
    'My Businesses',
    'Mes Entreprises',
    'Ubucuruzi Bwanjye',
    'View, add, and manage your businesses',
    'Voir, ajouter et gérer vos entreprises',
    'Reba, ongeraho kandi ugenzure ubucuruzi bwawe',
    '🏢',
    2,
    'action',
    'show_businesses'
  ),
  -- My Vehicles
  (
    'my_vehicles',
    '🚗 My Vehicles',
    'My Vehicles',
    'Mes Véhicules',
    'Ibinyabiziga Byanjye',
    'View, add, and manage your vehicles',
    'Voir, ajouter et gérer vos véhicules',
    'Reba, ongeraho kandi ugenzure ibinyabiziga byawe',
    '🚗',
    3,
    'action',
    'show_vehicles'
  ),
  -- My Properties
  (
    'my_properties',
    '🏠 My Properties',
    'My Properties',
    'Mes Propriétés',
    'Imitungo Yanjye',
    'View, add, and manage your properties',
    'Voir, ajouter et gérer vos propriétés',
    'Reba, ongeraho kandi ugenzure imitungo yawe',
    '🏠',
    4,
    'action',
    'show_properties'
  ),
  -- My Jobs
  (
    'my_jobs',
    '💼 My Jobs',
    'My Jobs & Applications',
    'Mes Emplois & Candidatures',
    'Akazi Kanjye & Ibyasabwe',
    'View your job posts and applications',
    'Voir vos offres d''emploi et candidatures',
    'Reba akazi kawe n''ibyasabwe',
    '💼',
    5,
    'action',
    'show_my_jobs'
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

-- Reorder existing items to make room
-- MOMO QR moves to position 6
UPDATE whatsapp_profile_menu_items 
SET display_order = 6, updated_at = now()
WHERE key = 'momo_qr';

-- Payment History moves to position 7
UPDATE whatsapp_profile_menu_items 
SET display_order = 7, updated_at = now()
WHERE key = 'payment_history';

-- Saved Locations moves to position 8
UPDATE whatsapp_profile_menu_items 
SET display_order = 8, updated_at = now()
WHERE key = 'saved_locations';

-- Settings moves to position 9
UPDATE whatsapp_profile_menu_items 
SET display_order = 9, updated_at = now()
WHERE key = 'settings';

-- Language moves to position 10
UPDATE whatsapp_profile_menu_items 
SET display_order = 10, updated_at = now()
WHERE key = 'change_language';

-- Help & Support moves to position 11
UPDATE whatsapp_profile_menu_items 
SET display_order = 11, updated_at = now()
WHERE key = 'help_support';

-- Add comment
COMMENT ON TABLE whatsapp_profile_menu_items IS 
  'Profile submenu items. Now includes: Profile, Businesses, Vehicles, Properties, Jobs, MOMO QR, Payment History, Saved Locations, Settings, Language, Help.';

COMMIT;
