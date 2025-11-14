BEGIN;

-- WhatsApp Home Menu Configuration Table
-- Allows dynamic configuration of home menu items visible to users
CREATE TABLE IF NOT EXISTS public.whatsapp_home_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  active_countries TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_home_menu_active ON public.whatsapp_home_menu_items(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_whatsapp_home_menu_countries ON public.whatsapp_home_menu_items USING gin(active_countries);

-- Add RLS policies
ALTER TABLE public.whatsapp_home_menu_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read active menu items
CREATE POLICY "Users can read active menu items"
  ON public.whatsapp_home_menu_items
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Service role can manage all menu items
CREATE POLICY "Service role can manage menu items"
  ON public.whatsapp_home_menu_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed initial menu items based on current implementation
INSERT INTO public.whatsapp_home_menu_items (name, key, is_active, active_countries, display_order, icon) VALUES
  ('Nearby Drivers', 'nearby_drivers', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 1, '🚖'),
  ('Nearby Passengers', 'nearby_passengers', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 2, '🧍'),
  ('Schedule Trip', 'schedule_trip', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 3, '🚦'),
  ('Motor Insurance', 'motor_insurance', true, ARRAY['RW'], 4, '🛡️'),
  ('Nearby Pharmacies', 'nearby_pharmacies', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 5, '💊'),
  ('Quincailleries', 'quincailleries', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 6, '🔧'),
  ('Shops & Services', 'shops_services', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 7, '🏪'),
  ('Property Rentals', 'property_rentals', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 8, '🏠'),
  ('MOMO QR Code', 'momo_qr', true, ARRAY['RW'], 9, '📱'),
  ('Bars & Restaurants', 'bars_restaurants', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 10, '🍽️'),
  ('Notary Services', 'notary_services', true, ARRAY['RW'], 11, '📜'),
  ('Customer Support', 'customer_support', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 12, '💬')
ON CONFLICT (key) DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_whatsapp_home_menu_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whatsapp_home_menu_updated_at
  BEFORE UPDATE ON public.whatsapp_home_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_home_menu_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.whatsapp_home_menu_items IS 'Dynamic configuration for WhatsApp home menu items. Allows enabling/disabling features and country-specific availability.';

COMMIT;
