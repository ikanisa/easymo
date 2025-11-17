BEGIN;

-- Insert a "Recent" entry into profile menu if not present
INSERT INTO whatsapp_profile_menu_items (
  key,
  name,
  label_en,
  label_fr,
  label_rw,
  description_en,
  description_fr,
  description_rw,
  display_order,
  is_active,
  action_type,
  action_target,
  country_specific_names,
  region_restrictions
) VALUES (
  'recent',
  '🕘 Recent',
  'Recent',
  'Récents',
  'Biheruka',
  'Open your recent places and actions.',
  'Ouvrez vos lieux et actions récents.',
  'Fungura ibikorwa bya vuba uherukamo.',
  2,
  true,
  'action',
  'show_recent',
  jsonb_build_object(
    'en', 'Recent',
    'fr', 'Récents',
    'rw', 'Biheruka'
  ),
  NULL
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  label_en = EXCLUDED.label_en,
  label_fr = EXCLUDED.label_fr,
  label_rw = EXCLUDED.label_rw,
  description_en = EXCLUDED.description_en,
  description_fr = EXCLUDED.description_fr,
  description_rw = EXCLUDED.description_rw,
  display_order = LEAST(2, whatsapp_profile_menu_items.display_order),
  is_active = true,
  action_type = 'action',
  action_target = 'show_recent',
  country_specific_names = EXCLUDED.country_specific_names,
  updated_at = now();

COMMIT;

