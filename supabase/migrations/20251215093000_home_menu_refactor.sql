BEGIN;

-- ============================================================================
-- HOME MENU REFACTOR
-- Purpose: Move home menu to database-driven configuration in wa-webhook-core
-- Date: 2025-12-15
-- ============================================================================

-- 1. Create home menu items table
CREATE TABLE IF NOT EXISTS public.whatsapp_home_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL,
  target_service TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  active_countries TEXT[] DEFAULT ARRAY['RW'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_home_menu_items_active 
  ON whatsapp_home_menu_items(is_active, display_order) 
  WHERE is_active = true;

-- RLS
ALTER TABLE whatsapp_home_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_home_menu" 
  ON whatsapp_home_menu_items FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "anon_read_home_menu" 
  ON whatsapp_home_menu_items FOR SELECT 
  USING (is_active = true);

-- 2. Seed menu items
INSERT INTO whatsapp_home_menu_items (key, title, description, icon, target_service, display_order, active_countries) VALUES
('rides', 'Rides', 'Book rides & transport', '🚗', 'wa-webhook-mobility', 1, ARRAY['RW']),
('buy_sell', 'Buy & Sell', 'Browse marketplace', '🛒', 'wa-webhook-buy-sell', 2, ARRAY['RW']),
('insurance', 'Insurance', 'Get insurance quotes', '🛡️', 'wa-webhook-insurance', 3, ARRAY['RW']),
('wallet', 'Wallet', 'Manage tokens & payments', '💰', 'wa-webhook-wallet', 4, ARRAY['RW']),
('profile', 'Profile', 'View your profile', '👤', 'wa-webhook-profile', 5, ARRAY['RW'])
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  target_service = EXCLUDED.target_service,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 3. Function to get menu for user (with country filtering)
CREATE OR REPLACE FUNCTION public.get_home_menu_for_user(
  p_country_code TEXT DEFAULT 'RW',
  p_locale TEXT DEFAULT 'en'
)
RETURNS TABLE (
  key TEXT,
  title TEXT,
  description TEXT,
  icon TEXT,
  target_service TEXT,
  display_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.key,
    m.title,
    m.description,
    m.icon,
    m.target_service,
    m.display_order
  FROM whatsapp_home_menu_items m
  WHERE m.is_active = true
    AND (m.active_countries IS NULL OR p_country_code = ANY(m.active_countries))
  ORDER BY m.display_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_home_menu_for_user(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_home_menu_for_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_home_menu_for_user(TEXT, TEXT) TO service_role;

COMMENT ON TABLE whatsapp_home_menu_items IS 'Home menu items shown in WhatsApp - database-driven configuration for independent services';

COMMIT;
