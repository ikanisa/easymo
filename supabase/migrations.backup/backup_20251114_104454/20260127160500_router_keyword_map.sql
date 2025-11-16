-- Router Keyword Map Table
-- Purpose: Admin-tunable keyword mappings for routing WhatsApp messages to appropriate handlers.
-- This table allows keywords to be associated with route keys (insurance, basket, qr, dine, easymo, etc.)
-- and provides a flexible way to manage aliases and route resolution.

BEGIN;

-- Create router_keyword_map table
CREATE TABLE IF NOT EXISTS public.router_keyword_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_key text NOT NULL CHECK (route_key ~ '^[a-z][a-z0-9_]*$'),
  keyword text NOT NULL CHECK (char_length(keyword) >= 2 AND char_length(keyword) <= 100),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT router_keyword_map_route_key_keyword_unique UNIQUE (route_key, keyword)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_router_keyword_map_keyword
  ON public.router_keyword_map (keyword)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_router_keyword_map_route_key
  ON public.router_keyword_map (route_key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_router_keyword_map_keyword_lower
  ON public.router_keyword_map (LOWER(keyword))
  WHERE is_active = true;

-- Add table comment
COMMENT ON TABLE public.router_keyword_map IS 
  'Stores route_key ↔ keyword mappings for WhatsApp message routing. Allows admins to configure which keywords trigger which handlers.';

COMMENT ON COLUMN public.router_keyword_map.route_key IS 
  'The handler route key (e.g., insurance, basket, qr, dine, easymo). Must be lowercase alphanumeric with underscores.';

COMMENT ON COLUMN public.router_keyword_map.keyword IS 
  'The keyword or alias that triggers this route. Case-insensitive matching is performed.';

COMMENT ON COLUMN public.router_keyword_map.is_active IS 
  'Whether this keyword mapping is currently active. Inactive mappings are ignored during routing.';

COMMENT ON COLUMN public.router_keyword_map.metadata IS 
  'Additional metadata for the keyword mapping (e.g., priority, locale, description).';

-- Enable RLS
ALTER TABLE public.router_keyword_map ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
DROP POLICY IF EXISTS router_keyword_map_service_rw ON public.router_keyword_map;
CREATE POLICY router_keyword_map_service_rw
  ON public.router_keyword_map
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read active keywords
DROP POLICY IF EXISTS router_keyword_map_authenticated_read ON public.router_keyword_map;
CREATE POLICY router_keyword_map_authenticated_read
  ON public.router_keyword_map
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_router_keyword_map_updated ON public.router_keyword_map;
CREATE TRIGGER trg_router_keyword_map_updated
  BEFORE UPDATE ON public.router_keyword_map
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Insert seed data with common keywords and aliases
INSERT INTO public.router_keyword_map (route_key, keyword, metadata)
VALUES
  -- Insurance keywords
  ('insurance', 'insurance', jsonb_build_object('type', 'primary', 'description', 'Main insurance keyword')),
  ('insurance', 'insure', jsonb_build_object('type', 'alias', 'description', 'Insurance alias')),
  ('insurance', 'bima', jsonb_build_object('type', 'alias', 'description', 'Swahili for insurance')),
  ('insurance', 'cover', jsonb_build_object('type', 'alias', 'description', 'Coverage keyword')),
  ('insurance', 'policy', jsonb_build_object('type', 'alias', 'description', 'Policy keyword')),
  ('insurance', 'quote', jsonb_build_object('type', 'alias', 'description', 'Insurance quote keyword')),
  
  -- Basket (Ikimina) keywords
  ('basket', 'basket', jsonb_build_object('type', 'primary', 'description', 'Main basket keyword')),
  ('basket', 'ikimina', jsonb_build_object('type', 'alias', 'description', 'Kinyarwanda for savings group')),
  ('basket', 'sacco', jsonb_build_object('type', 'alias', 'description', 'Savings group alias')),
  ('basket', 'savings', jsonb_build_object('type', 'alias', 'description', 'Savings keyword')),
  ('basket', 'group', jsonb_build_object('type', 'alias', 'description', 'Group savings keyword')),
  ('basket', 'circle', jsonb_build_object('type', 'alias', 'description', 'Savings circle keyword')),
  
  -- QR/MoMo keywords
  ('qr', 'qr', jsonb_build_object('type', 'primary', 'description', 'Main QR code keyword')),
  ('qr', 'momo', jsonb_build_object('type', 'alias', 'description', 'Mobile Money keyword')),
  ('qr', 'pay', jsonb_build_object('type', 'alias', 'description', 'Payment keyword')),
  ('qr', 'code', jsonb_build_object('type', 'alias', 'description', 'QR code alias')),
  ('qr', 'payment', jsonb_build_object('type', 'alias', 'description', 'Payment alias')),
  
  -- Dine-in keywords
  ('dine', 'dine', jsonb_build_object('type', 'primary', 'description', 'Main dine-in keyword')),
  ('dine', 'menu', jsonb_build_object('type', 'alias', 'description', 'Menu keyword')),
  ('dine', 'order', jsonb_build_object('type', 'alias', 'description', 'Order food keyword')),
  ('dine', 'food', jsonb_build_object('type', 'alias', 'description', 'Food ordering keyword')),
  ('dine', 'browse', jsonb_build_object('type', 'alias', 'description', 'Browse menus keyword')),
  ('dine', 'restaurant', jsonb_build_object('type', 'alias', 'description', 'Restaurant keyword')),
  
  -- EasyMO main menu keywords
  ('easymo', 'home', jsonb_build_object('type', 'primary', 'description', 'Return to home menu')),
  ('easymo', 'menu', jsonb_build_object('type', 'alias', 'description', 'Main menu alias')),
  ('easymo', 'start', jsonb_build_object('type', 'alias', 'description', 'Start/home keyword')),
  ('easymo', 'help', jsonb_build_object('type', 'alias', 'description', 'Help/support keyword')),
  ('easymo', 'main', jsonb_build_object('type', 'alias', 'description', 'Main menu keyword')),
  ('easymo', 'services', jsonb_build_object('type', 'alias', 'description', 'Services menu keyword'))
ON CONFLICT (route_key, keyword) DO UPDATE
SET 
  metadata = EXCLUDED.metadata,
  is_active = true,
  updated_at = timezone('utc', now());

COMMIT;
