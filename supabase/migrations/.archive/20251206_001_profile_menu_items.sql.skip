-- Migration: 20251206_001_profile_menu_items.sql
-- Dynamic profile menu items with visibility conditions

BEGIN;

-- Dynamic profile menu items with visibility conditions
CREATE TABLE IF NOT EXISTS public.profile_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 100,
  icon TEXT NOT NULL DEFAULT '📋',
  title_key TEXT NOT NULL,
  description_key TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'route',
  action_target TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  active_countries TEXT[] DEFAULT ARRAY['RW', 'BI', 'TZ', 'CD', 'ZM', 'MT'],
  requires_business_category TEXT[],
  visibility_conditions JSONB DEFAULT '{}',
  translations JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profile_menu_items' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.profile_menu_items ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profile_menu_items_active ON profile_menu_items(is_active);
CREATE INDEX IF NOT EXISTS idx_profile_menu_items_order ON profile_menu_items(display_order);

COMMIT;
