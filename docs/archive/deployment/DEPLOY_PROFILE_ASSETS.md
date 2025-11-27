# Profile Assets Menu - Deployment Instructions

## Status

✅ **Code Deployed** - wa-webhook function updated and deployed (457.8kB)  
⏳ **Database Migration** - Ready to apply manually via Supabase Dashboard

## Quick Deployment

### Step 1: Copy SQL

Copy the SQL below:

```sql
-- Apply profile assets menu migration directly
BEGIN;

-- Insert new profile menu items
INSERT INTO whatsapp_profile_menu_items (
  key, name, label_en, label_fr, label_rw, 
  description_en, description_fr, description_rw,
  icon, display_order, action_type, action_target
) VALUES
  ('my_businesses', '🏢 My Businesses', 'My Businesses', 'Mes Entreprises', 'Ubucuruzi Bwanjye',
   'View, add, and manage your businesses', 'Voir, ajouter et gérer vos entreprises',
   'Reba, ongeraho kandi ugenzure ubucuruzi bwawe', '🏢', 2, 'action', 'show_businesses'),
  
  ('my_vehicles', '🚗 My Vehicles', 'My Vehicles', 'Mes Véhicules', 'Ibinyabiziga Byanjye',
   'View, add, and manage your vehicles', 'Voir, ajouter et gérer vos véhicules',
   'Reba, ongeraho kandi ugenzure ibinyabiziga byawe', '🚗', 3, 'action', 'show_vehicles'),
  
  ('my_properties', '🏠 My Properties', 'My Properties', 'Mes Propriétés', 'Imitungo Yanjye',
   'View, add, and manage your properties', 'Voir, ajouter et gérer vos propriétés',
   'Reba, ongeraho kandi ugenzure imitungo yawe', '🏠', 4, 'action', 'show_properties'),
  
  ('my_jobs', '💼 My Jobs', 'My Jobs & Applications', 'Mes Emplois & Candidatures', 'Akazi Kanjye & Ibyasabwe',
   'View your job posts and applications', 'Voir vos offres d''emploi et candidatures',
   'Reba akazi kawe n''ibyasabwe', '💼', 5, 'action', 'show_my_jobs')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, label_en = EXCLUDED.label_en, label_fr = EXCLUDED.label_fr,
  label_rw = EXCLUDED.label_rw, description_en = EXCLUDED.description_en,
  description_fr = EXCLUDED.description_fr, description_rw = EXCLUDED.description_rw,
  icon = EXCLUDED.icon, display_order = EXCLUDED.display_order,
  action_type = EXCLUDED.action_type, action_target = EXCLUDED.action_target,
  updated_at = now();

-- Reorder existing items
UPDATE whatsapp_profile_menu_items SET display_order = 6, updated_at = now() WHERE key = 'momo_qr';
UPDATE whatsapp_profile_menu_items SET display_order = 7, updated_at = now() WHERE key = 'payment_history';
UPDATE whatsapp_profile_menu_items SET display_order = 8, updated_at = now() WHERE key = 'saved_locations';
UPDATE whatsapp_profile_menu_items SET display_order = 9, updated_at = now() WHERE key = 'settings';
UPDATE whatsapp_profile_menu_items SET display_order = 10, updated_at = now() WHERE key = 'change_language';
UPDATE whatsapp_profile_menu_items SET display_order = 11, updated_at = now() WHERE key = 'help_support';

COMMIT;

-- Verify
SELECT key, name, display_order, is_active FROM whatsapp_profile_menu_items ORDER BY display_order;
```

### Step 2: Run in Supabase

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new
2. Paste the SQL above
3. Click "Run"
4. Verify you see 11 rows in the result

### Step 3: Test in WhatsApp

1. Open WhatsApp and message the bot
2. Select "Profile" from main menu
3. Verify all 11 items appear:
   - 👤 My Profile
   - 🏢 My Businesses ← NEW
   - 🚗 My Vehicles ← NEW
   - 🏠 My Properties ← NEW
   - 💼 My Jobs ← NEW
   - 📱 MOMO QR Code
   - 💳 Payment History
   - 📍 Saved Locations
   - ⚙️ Settings
   - 🌍 Language
   - ❓ Help & Support

## What This Adds

Users can now manage all their assets from one centralized Profile menu:

- **My Businesses** - View/add/manage businesses and WhatsApp numbers
- **My Vehicles** - View/add vehicles with OCR certificate processing
- **My Properties** - View/add property listings
- **My Jobs** - View posted jobs and applications

All items have full multilingual support (English, French, Kinyarwanda).

## Technical Details

- **Migration file**: `supabase/migrations/20251115134700_add_profile_assets_menu.sql`
- **Code updated**: `supabase/functions/wa-webhook/domains/profile/index.ts`
- **Handlers**: All exist in `router/interactive_list.ts` (verified working)
- **No breaking changes**: Uses ON CONFLICT to safely update existing data

## Rollback (if needed)

If issues arise, run this SQL:

```sql
BEGIN;
DELETE FROM whatsapp_profile_menu_items 
WHERE key IN ('my_businesses', 'my_vehicles', 'my_properties', 'my_jobs');

UPDATE whatsapp_profile_menu_items SET display_order = 2 WHERE key = 'momo_qr';
UPDATE whatsapp_profile_menu_items SET display_order = 3 WHERE key = 'payment_history';
UPDATE whatsapp_profile_menu_items SET display_order = 4 WHERE key = 'saved_locations';
UPDATE whatsapp_profile_menu_items SET display_order = 5 WHERE key = 'settings';
UPDATE whatsapp_profile_menu_items SET display_order = 6 WHERE key = 'change_language';
UPDATE whatsapp_profile_menu_items SET display_order = 7 WHERE key = 'help_support';
COMMIT;
```

## Support

- Full documentation: `PROFILE_ASSETS_MENU_IMPLEMENTATION.md`
- Deep review report: `WA_WEBHOOK_DEEP_REVIEW_2025-11-15.md`
