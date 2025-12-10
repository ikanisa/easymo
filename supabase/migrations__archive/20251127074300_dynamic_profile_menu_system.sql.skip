-- Dynamic Profile Menu System
-- Date: 2025-11-27
-- Purpose: Scalable, country-specific profile menu configuration

BEGIN;

-- Profile Menu Items Table
CREATE TABLE IF NOT EXISTS profile_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Menu Item Identity
  item_key text NOT NULL UNIQUE, -- e.g., 'edit_profile', 'my_businesses'
  display_order integer NOT NULL DEFAULT 0,
  
  -- Display Configuration
  icon text NOT NULL, -- Emoji or icon code
  title_en text NOT NULL,
  title_fr text,
  title_rw text,
  title_sw text, -- Swahili
  title_pt text, -- Portuguese
  title_es text, -- Spanish
  description_en text NOT NULL,
  description_fr text,
  description_rw text,
  description_sw text,
  description_pt text,
  description_es text,
  
  -- Routing & Behavior
  action_type text NOT NULL CHECK (action_type IN ('route', 'ai_agent', 'function', 'external')),
  action_target text NOT NULL, -- IDS constant, AI agent ID, or function name
  
  -- Feature Flags
  enabled boolean NOT NULL DEFAULT true,
  requires_verification boolean DEFAULT false,
  requires_premium boolean DEFAULT false,
  min_app_version text,
  
  -- Country Availability
  available_countries text[] DEFAULT ARRAY['RW', 'CD', 'BI', 'TZ'], -- ISO country codes
  excluded_countries text[] DEFAULT ARRAY[]::text[],
  
  -- Access Control
  required_permissions text[] DEFAULT ARRAY[]::text[],
  user_roles text[] DEFAULT ARRAY[]::text[], -- Empty = all users
  
  -- Analytics & Tracking
  track_analytics boolean DEFAULT true,
  analytics_event_name text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profile_menu_items_enabled ON profile_menu_items(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_profile_menu_items_order ON profile_menu_items(display_order);
CREATE INDEX IF NOT EXISTS idx_profile_menu_items_countries ON profile_menu_items USING GIN(available_countries);

-- Enable RLS
ALTER TABLE profile_menu_items ENABLE ROW LEVEL SECURITY;

-- Public read access (menu items are not sensitive)
CREATE POLICY "Anyone can view enabled menu items" ON profile_menu_items
  FOR SELECT
  USING (enabled = true);

-- Admin write access
CREATE POLICY "Admins can manage menu items" ON profile_menu_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_users
      WHERE id = auth.uid()
      AND 'admin' = ANY(user_roles)
    )
  );

-- Insert Default Profile Menu Items
INSERT INTO profile_menu_items (
  item_key,
  display_order,
  icon,
  title_en,
  title_fr,
  title_rw,
  description_en,
  description_fr,
  description_rw,
  action_type,
  action_target,
  available_countries,
  track_analytics,
  analytics_event_name
) VALUES
  -- 1. Edit Profile
  (
    'edit_profile',
    1,
    '✏️',
    'Edit Profile',
    'Modifier le profil',
    'Hindura umwirondoro',
    'Update name, language & settings',
    'Mettre à jour le nom, la langue et les paramètres',
    'Hindura izina, ururimi n''igenamiterere',
    'route',
    'EDIT_PROFILE',
    ARRAY['RW', 'CD', 'BI', 'TZ'],
    true,
    'profile.edit_clicked'
  ),
  
  -- 2. Wallet & Tokens
  (
    'wallet_tokens',
    2,
    '💎',
    'Wallet & Tokens',
    'Portefeuille et jetons',
    'Umufuka n''ibimenyetso',
    'View balance, transfer, redeem rewards',
    'Voir le solde, transférer, échanger des récompenses',
    'Reba amafaranga, ohereza, gura ibihembo',
    'route',
    'WALLET_HOME',
    ARRAY['RW', 'CD', 'BI', 'TZ'],
    true,
    'profile.wallet_clicked'
  ),
  
  -- 3. MoMo QR Code
  (
    'momo_qr',
    3,
    '📱',
    'MoMo QR Code',
    'Code QR MoMo',
    'Kode QR ya MoMo',
    'Generate QR for payments',
    'Générer un QR pour les paiements',
    'Kora QR yo kwishyura',
    'route',
    'MOMO_QR',
    ARRAY['RW', 'TZ'],
    true,
    'profile.momo_qr_clicked'
  ),
  
  -- 4. My Businesses
  (
    'my_businesses',
    4,
    '🏪',
    'My Businesses',
    'Mes entreprises',
    'Ubucuruzi bwanjye',
    'Manage your business listings',
    'Gérer vos annonces d''entreprise',
    'Gahunda y''ubucuruzi bwawe',
    'route',
    'MY_BUSINESSES',
    ARRAY['RW', 'CD', 'BI', 'TZ'],
    true,
    'profile.businesses_clicked'
  ),
  
  -- 5. My Jobs
  (
    'my_jobs',
    5,
    '💼',
    'My Jobs',
    'Mes emplois',
    'Imirimo yanjye',
    'Manage your job postings',
    'Gérer vos offres d''emploi',
    'Gahunda y''imirimo yawe',
    'route',
    'MY_JOBS',
    ARRAY['RW', 'CD', 'BI', 'TZ'],
    true,
    'profile.jobs_clicked'
  ),
  
  -- 6. My Properties
  (
    'my_properties',
    6,
    '🏠',
    'My Properties',
    'Mes propriétés',
    'Imitungo yanjye',
    'Manage your property listings',
    'Gérer vos annonces immobilières',
    'Gahunda y''imitungo yawe',
    'route',
    'MY_PROPERTIES',
    ARRAY['RW', 'CD', 'BI', 'TZ'],
    true,
    'profile.properties_clicked'
  ),
  
  -- 7. My Vehicles
  (
    'my_vehicles',
    7,
    '🚗',
    'My Vehicles',
    'Mes véhicules',
    'Ibinyabiziga byanjye',
    'Manage your registered vehicles',
    'Gérer vos véhicules enregistrés',
    'Gahunda y''ibinyabiziga byawe',
    'route',
    'MY_VEHICLES',
    ARRAY['RW', 'TZ'],
    true,
    'profile.vehicles_clicked'
  ),
  
  -- 8. Saved Locations
  (
    'saved_locations',
    8,
    '📍',
    'Saved Locations',
    'Lieux enregistrés',
    'Ahantu hakoze',
    'Your favorite places',
    'Vos endroits préférés',
    'Ahantu ukunda',
    'route',
    'SAVED_LOCATIONS',
    ARRAY['RW', 'CD', 'BI', 'TZ'],
    true,
    'profile.locations_clicked'
  ),
  
  -- 9. Back to Menu
  (
    'back_menu',
    999,
    '←',
    'Back to Menu',
    'Retour au menu',
    'Subira ku menu',
    'Return to main menu',
    'Retour au menu principal',
    'Subira ku menu nyamukuru',
    'route',
    'BACK_MENU',
    ARRAY['RW', 'CD', 'BI', 'TZ'],
    false,
    NULL
  )
ON CONFLICT (item_key) DO NOTHING;

-- Function to get profile menu for a user in their country
CREATE OR REPLACE FUNCTION get_profile_menu_items(
  p_user_id uuid,
  p_country_code text DEFAULT 'RW',
  p_language text DEFAULT 'en'
)
RETURNS TABLE (
  item_key text,
  display_order integer,
  icon text,
  title text,
  description text,
  action_type text,
  action_target text,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pmi.item_key,
    pmi.display_order,
    pmi.icon,
    -- Dynamic title based on language
    CASE p_language
      WHEN 'fr' THEN COALESCE(pmi.title_fr, pmi.title_en)
      WHEN 'rw' THEN COALESCE(pmi.title_rw, pmi.title_en)
      WHEN 'sw' THEN COALESCE(pmi.title_sw, pmi.title_en)
      WHEN 'pt' THEN COALESCE(pmi.title_pt, pmi.title_en)
      WHEN 'es' THEN COALESCE(pmi.title_es, pmi.title_en)
      ELSE pmi.title_en
    END as title,
    -- Dynamic description based on language
    CASE p_language
      WHEN 'fr' THEN COALESCE(pmi.description_fr, pmi.description_en)
      WHEN 'rw' THEN COALESCE(pmi.description_rw, pmi.description_en)
      WHEN 'sw' THEN COALESCE(pmi.description_sw, pmi.description_en)
      WHEN 'pt' THEN COALESCE(pmi.description_pt, pmi.description_en)
      WHEN 'es' THEN COALESCE(pmi.description_es, pmi.description_en)
      ELSE pmi.description_en
    END as description,
    pmi.action_type,
    pmi.action_target,
    pmi.metadata
  FROM profile_menu_items pmi
  WHERE pmi.enabled = true
    -- Check country availability
    AND (
      p_country_code = ANY(pmi.available_countries)
      OR pmi.available_countries IS NULL
      OR array_length(pmi.available_countries, 1) IS NULL
    )
    -- Check country exclusions
    AND (
      NOT (p_country_code = ANY(pmi.excluded_countries))
      OR pmi.excluded_countries IS NULL
      OR array_length(pmi.excluded_countries, 1) IS NULL
    )
    -- Check user permissions if required
    AND (
      pmi.required_permissions IS NULL
      OR array_length(pmi.required_permissions, 1) IS NULL
      OR EXISTS (
        SELECT 1 FROM whatsapp_users wu
        WHERE wu.id = p_user_id
        AND wu.metadata->'permissions' ?| pmi.required_permissions
      )
    )
  ORDER BY pmi.display_order ASC, pmi.item_key ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_profile_menu_items(uuid, text, text) TO authenticated, anon;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_profile_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_menu_items_updated_at
  BEFORE UPDATE ON profile_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_menu_items_updated_at();

-- Comments
COMMENT ON TABLE profile_menu_items IS 'Dynamic configuration for profile menu items with country-specific availability and multilingual support';
COMMENT ON COLUMN profile_menu_items.item_key IS 'Unique identifier for the menu item (used in code)';
COMMENT ON COLUMN profile_menu_items.action_type IS 'Type of action: route (navigate to ID), ai_agent (start AI conversation), function (call Edge Function), external (open URL)';
COMMENT ON COLUMN profile_menu_items.available_countries IS 'ISO country codes where this item is available. NULL = all countries';
COMMENT ON COLUMN profile_menu_items.excluded_countries IS 'ISO country codes where this item is explicitly hidden';
COMMENT ON FUNCTION get_profile_menu_items IS 'Fetches profile menu items for a specific user, country, and language with proper permissions filtering';

COMMIT;
