BEGIN;

-- Migration: Fix Profile Menu Items Alignment
-- Purpose: Ensure profile_menu_items are properly configured to use correct table structure
-- Date: 2025-12-10

-- Drop and recreate the table with correct structure
DROP TABLE IF EXISTS public.profile_menu_items CASCADE;

-- Create profile_menu_items table (modern structure)
CREATE TABLE public.profile_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Menu Item Identity
  item_key TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Display Configuration
  icon TEXT NOT NULL,
  translations JSONB DEFAULT '{}'::JSONB, -- Stores all language translations
  
  -- Routing & Behavior
  action_type TEXT NOT NULL CHECK (action_type IN ('route', 'ai_agent', 'function', 'external')),
  action_target TEXT NOT NULL,
  
  -- Feature Flags
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_verification BOOLEAN DEFAULT false,
  min_app_version TEXT,
  
  -- Country & Category Availability
  active_countries TEXT[] DEFAULT NULL, -- NULL = all countries
  requires_business_category TEXT[] DEFAULT NULL, -- NULL = no restriction
  
  -- Conditional Visibility
  visibility_conditions JSONB DEFAULT '{}'::JSONB,
  
  -- Analytics & Tracking
  track_analytics BOOLEAN DEFAULT true,
  analytics_event_name TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profile_menu_items_active ON public.profile_menu_items(is_active) WHERE is_active = true;
CREATE INDEX idx_profile_menu_items_order ON public.profile_menu_items(display_order);
CREATE INDEX idx_profile_menu_items_countries ON public.profile_menu_items USING GIN(active_countries) WHERE active_countries IS NOT NULL;

-- Enable RLS
ALTER TABLE public.profile_menu_items ENABLE ROW LEVEL SECURITY;

-- Public read access policy
DROP POLICY IF EXISTS "Anyone can view active menu items" ON public.profile_menu_items;
CREATE POLICY "Anyone can view active menu items" ON public.profile_menu_items
  FOR SELECT
  USING (is_active = true);

-- Admin write access policy (simplified - allows service role)
DROP POLICY IF EXISTS "Admins can manage menu items" ON public.profile_menu_items;
CREATE POLICY "Admins can manage menu items" ON public.profile_menu_items
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create or replace the v2 RPC function that matches the code expectations
CREATE OR REPLACE FUNCTION public.get_profile_menu_items_v2(
  p_user_id UUID,
  p_country_code TEXT DEFAULT 'RW',
  p_language TEXT DEFAULT 'en'
)
RETURNS TABLE (
  item_key TEXT,
  display_order INTEGER,
  icon TEXT,
  title TEXT,
  description TEXT,
  action_type TEXT,
  action_target TEXT,
  metadata JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_business BOOLEAN := false;
  v_user_business_categories TEXT[];
  v_has_bar_restaurant BOOLEAN := false;
BEGIN
  -- Check if user has any businesses
  SELECT EXISTS (
    SELECT 1 FROM public.business
    WHERE owner_user_id = p_user_id
      AND is_active = true
    LIMIT 1
  ) INTO v_has_business;
  
  -- Get user's business categories (lowercase for matching)
  SELECT ARRAY_AGG(DISTINCT LOWER(COALESCE(b.category_name, b.tag, '')))
  INTO v_user_business_categories
  FROM public.business b
  WHERE b.owner_user_id = p_user_id
    AND b.is_active = true
    AND (b.category_name IS NOT NULL OR b.tag IS NOT NULL);
  
  -- Ensure we have an array even if empty
  v_user_business_categories := COALESCE(v_user_business_categories, ARRAY[]::TEXT[]);
  
  -- Check if user has bar/restaurant businesses
  SELECT EXISTS (
    SELECT 1
    FROM unnest(v_user_business_categories) AS cat
    WHERE cat ILIKE '%bar%'
       OR cat ILIKE '%restaurant%'
       OR cat ILIKE '%pub%'
       OR cat ILIKE '%cafe%'
       OR cat ILIKE '%bistro%'
    LIMIT 1
  ) INTO v_has_bar_restaurant;
  
  -- Return filtered menu items
  RETURN QUERY
  SELECT 
    pmi.item_key,
    pmi.display_order,
    pmi.icon,
    COALESCE(
      pmi.translations->p_language->>'title',
      pmi.translations->'en'->>'title',
      pmi.item_key
    ) AS title,
    COALESCE(
      pmi.translations->p_language->>'description',
      pmi.translations->'en'->>'description',
      ''
    ) AS description,
    pmi.action_type,
    pmi.action_target,
    jsonb_build_object(
      'has_business', v_has_business,
      'has_bar_restaurant', v_has_bar_restaurant,
      'user_categories', v_user_business_categories
    ) AS metadata
  FROM public.profile_menu_items pmi
  WHERE pmi.is_active = true
    -- Filter by country if active_countries is set
    AND (pmi.active_countries IS NULL OR p_country_code = ANY(pmi.active_countries))
    -- Filter by business category if requires_business_category is set
    AND (
      pmi.requires_business_category IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(pmi.requires_business_category) AS required_cat
        CROSS JOIN unnest(v_user_business_categories) AS user_cat
        WHERE user_cat ILIKE '%' || required_cat || '%'
      )
    )
    -- Filter by visibility conditions
    AND (
      pmi.visibility_conditions = '{}'::JSONB
      OR (
        -- Check has_bar_restaurant condition
        (pmi.visibility_conditions->>'has_bar_restaurant')::BOOLEAN IS NULL
        OR (pmi.visibility_conditions->>'has_bar_restaurant')::BOOLEAN = v_has_bar_restaurant
      )
    )
  ORDER BY pmi.display_order, pmi.item_key;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_profile_menu_items_v2(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_menu_items_v2(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_profile_menu_items_v2(UUID, TEXT, TEXT) TO service_role;

-- Insert default profile menu items with proper JSONB translations
INSERT INTO public.profile_menu_items (
  item_key,
  display_order,
  icon,
  translations,
  action_type,
  action_target,
  active_countries,
  track_analytics,
  analytics_event_name,
  is_active
) VALUES
  -- 1. Edit Profile
  (
    'edit_profile',
    1,
    '✏️',
    '{"en": {"title": "Edit Profile", "description": "Update name, language & settings"}, "fr": {"title": "Modifier le profil", "description": "Mettre à jour le nom, la langue"}, "rw": {"title": "Hindura Umwirondoro", "description": "Hindura izina n''ururimi"}}'::JSONB,
    'route',
    'EDIT_PROFILE',
    ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
    true,
    'PROFILE_EDIT_CLICKED',
    true
  ),
  
  -- 2. Wallet & Tokens
  (
    'wallet_tokens',
    2,
    '💎',
    '{"en": {"title": "Wallet & Tokens", "description": "View balance, transfer, redeem rewards"}, "fr": {"title": "Portefeuille", "description": "Voir le solde, transférer"}, "rw": {"title": "Agasanduku", "description": "Reba amafaranga"}}'::JSONB,
    'route',
    'WALLET_HOME',
    ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
    true,
    'PROFILE_WALLET_CLICKED',
    true
  ),
  
  -- 3. MoMo QR Code
  (
    'momo_qr',
    3,
    '📱',
    '{"en": {"title": "MoMo QR Code", "description": "Generate QR for payments"}, "fr": {"title": "Code QR MoMo", "description": "Générer QR pour paiements"}, "rw": {"title": "QR ya MoMo", "description": "Kora QR yo kwishyura"}}'::JSONB,
    'route',
    'MOMO_QR',
    ARRAY['RW', 'TZ', 'UG'],
    true,
    'PROFILE_MOMO_QR_CLICKED',
    true
  ),
  
  -- 4. My Businesses
  (
    'my_businesses',
    4,
    '🏪',
    '{"en": {"title": "My Businesses", "description": "Manage your business listings"}, "fr": {"title": "Mes Entreprises", "description": "Gérer vos annonces"}, "rw": {"title": "Ubucuruzi Bwanjye", "description": "Gucunga ubucuruzi"}}'::JSONB,
    'route',
    'MY_BUSINESSES',
    ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
    true,
    'PROFILE_BUSINESSES_CLICKED',
    true
  ),
  
  -- 5. My Jobs
  (
    'my_jobs',
    5,
    '💼',
    '{"en": {"title": "My Jobs", "description": "Manage your job postings"}, "fr": {"title": "Mes Emplois", "description": "Gérer vos offres"}, "rw": {"title": "Imirimo Yanjye", "description": "Gucunga imirimo"}}'::JSONB,
    'route',
    'MY_JOBS',
    ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
    true,
    'PROFILE_JOBS_CLICKED',
    true
  ),
  
  -- 6. My Properties
  (
    'my_properties',
    6,
    '🏠',
    '{"en": {"title": "My Properties", "description": "Manage your property listings"}, "fr": {"title": "Mes Propriétés", "description": "Gérer vos annonces"}, "rw": {"title": "Imitungo Yanjye", "description": "Gucunga imitungo"}}'::JSONB,
    'route',
    'MY_PROPERTIES',
    ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
    true,
    'PROFILE_PROPERTIES_CLICKED',
    true
  ),
  
  -- 7. My Vehicles
  (
    'my_vehicles',
    7,
    '🚗',
    '{"en": {"title": "My Vehicles", "description": "Manage your registered vehicles"}, "fr": {"title": "Mes Véhicules", "description": "Gérer vos véhicules"}, "rw": {"title": "Ibinyabiziga Byanjye", "description": "Gucunga ibinyabiziga"}}'::JSONB,
    'route',
    'MY_VEHICLES',
    ARRAY['RW', 'TZ', 'KE', 'UG'],
    true,
    'PROFILE_VEHICLES_CLICKED',
    true
  ),
  
  -- 8. Saved Locations
  (
    'saved_locations',
    8,
    '📍',
    '{"en": {"title": "Saved Locations", "description": "Your favorite places"}, "fr": {"title": "Lieux Enregistrés", "description": "Vos endroits préférés"}, "rw": {"title": "Ahantu Hakoze", "description": "Ahantu ukunda"}}'::JSONB,
    'route',
    'SAVED_LOCATIONS',
    ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
    true,
    'PROFILE_LOCATIONS_CLICKED',
    true
  ),
  
  -- 9. My Bars & Restaurants (conditional - only for bar/restaurant owners)
  (
    'my_bars_restaurants',
    35,
    '🍺',
    '{"en": {"title": "My Bars & Restaurants", "description": "Manage menus, orders & reviews"}, "fr": {"title": "Mes Bars & Restaurants", "description": "Gérer menus, commandes"}, "rw": {"title": "Bar n''Resitora Zanjye", "description": "Gucunga menu n''ibindi"}}'::JSONB,
    'route',
    'MY_BARS',
    ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
    true,
    'PROFILE_BARS_CLICKED',
    true
  ),
  
  -- 10. Back to Menu
  (
    'back_menu',
    999,
    '←',
    '{"en": {"title": "Back to Menu", "description": "Return to main menu"}, "fr": {"title": "Retour Menu", "description": "Retour au menu"}, "rw": {"title": "Subira Menu", "description": "Subira ku menu"}}'::JSONB,
    'route',
    'BACK_MENU',
    ARRAY['RW', 'CD', 'BI', 'TZ', 'KE', 'UG'],
    false,
    NULL,
    true
  )
ON CONFLICT (item_key) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  translations = EXCLUDED.translations,
  action_type = EXCLUDED.action_type,
  action_target = EXCLUDED.action_target,
  active_countries = EXCLUDED.active_countries,
  updated_at = now();

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_profile_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_menu_items_updated_at ON public.profile_menu_items;
CREATE TRIGGER profile_menu_items_updated_at
  BEFORE UPDATE ON public.profile_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_menu_items_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.profile_menu_items IS 'Dynamic configuration for profile menu items with country-specific availability and conditional visibility based on user business ownership';
COMMENT ON COLUMN public.profile_menu_items.item_key IS 'Unique identifier for the menu item';
COMMENT ON COLUMN public.profile_menu_items.translations IS 'JSONB object with language codes as keys, each containing title and description';
COMMENT ON COLUMN public.profile_menu_items.visibility_conditions IS 'JSONB conditions like {"has_bar_restaurant": true} to show/hide items';
COMMENT ON FUNCTION public.get_profile_menu_items_v2 IS 'Fetches filtered profile menu items based on user country, language, and business ownership';

COMMIT;
