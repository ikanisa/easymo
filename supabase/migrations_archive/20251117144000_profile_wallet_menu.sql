-- Separate MOMO QR code from wallet/tokens entry
BEGIN;

-- Ensure label columns exist for localization (older tables did not have them)
ALTER TABLE whatsapp_profile_menu_items
  ADD COLUMN IF NOT EXISTS label_en text,
  ADD COLUMN IF NOT EXISTS label_fr text,
  ADD COLUMN IF NOT EXISTS label_rw text;

UPDATE whatsapp_profile_menu_items
SET label_en = COALESCE(label_en, name),
    label_fr = COALESCE(label_fr, name),
    label_rw = COALESCE(label_rw, name)
WHERE label_en IS NULL OR label_fr IS NULL OR label_rw IS NULL;

-- Ensure MOMO QR entry uses the updated naming
UPDATE whatsapp_profile_menu_items
SET name = '📱 MOMO QR Code',
    label_en = 'MOMO QR Code',
    label_fr = 'Code QR MOMO',
    label_rw = 'MOMO QR Code',
    description_en = 'Show or share your MOMO QR payment code.',
    description_fr = 'Affichez ou partagez votre code de paiement MOMO.',
    description_rw = 'Reba cyangwa usangize QR yawe ya MOMO yo kwishyura.',
    country_specific_names = jsonb_build_object(
      'en', 'MOMO QR Code',
      'fr', 'Code QR MOMO',
      'rw', 'MOMO QR Code'
    ),
    updated_at = now()
WHERE key = 'momo_qr';

-- Insert dedicated Wallet & Tokens menu item
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
  'wallet_tokens',
  '💰 Wallet & Tokens',
  'Wallet & Tokens',
  'Portefeuille & Tokens',
  'Ububiko & Tokens',
  'View your balance, earnings, and withdrawals.',
  'Consultez votre solde, vos gains et vos retraits.',
  'Reba ububiko bwawe, ibyinjijwe n''ibisohoka.',
  7,
  true,
  'action',
  'show_wallet',
  jsonb_build_object(
    'en', 'Wallet & Tokens',
    'fr', 'Portefeuille & Tokens',
    'rw', 'Ububiko & Tokens'
  ),
  ARRAY['africa']::text[]
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  label_en = EXCLUDED.label_en,
  label_fr = EXCLUDED.label_fr,
  label_rw = EXCLUDED.label_rw,
  description_en = EXCLUDED.description_en,
  description_fr = EXCLUDED.description_fr,
  description_rw = EXCLUDED.description_rw,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  action_type = EXCLUDED.action_type,
  action_target = EXCLUDED.action_target,
  country_specific_names = EXCLUDED.country_specific_names,
  region_restrictions = EXCLUDED.region_restrictions,
  updated_at = now();

-- Shift the remaining items down to keep ordering intact
UPDATE whatsapp_profile_menu_items
SET display_order = 8, updated_at = now()
WHERE key = 'payment_history';

UPDATE whatsapp_profile_menu_items
SET display_order = 9, updated_at = now()
WHERE key = 'saved_locations';

UPDATE whatsapp_profile_menu_items
SET display_order = 10, updated_at = now()
WHERE key = 'settings';

UPDATE whatsapp_profile_menu_items
SET display_order = 11, updated_at = now()
WHERE key = 'change_language';

UPDATE whatsapp_profile_menu_items
SET display_order = 12, updated_at = now()
WHERE key = 'help_support';

COMMIT;
