BEGIN;

-- =====================================================
-- COMPLETE WEBHOOK FIX - November 21, 2025
-- =====================================================
-- Fixes all 5 production errors discovered during testing
-- =====================================================

-- 1. SCHEMA PERMISSIONS (already applied, documented here)
-- Grant USAGE on public schema to all roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role, postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role, postgres;

-- 2. FIX wa_events NOT NULL CONSTRAINTS
ALTER TABLE IF EXISTS public.wa_events ALTER COLUMN event_type DROP NOT NULL;
ALTER TABLE IF EXISTS public.wa_events ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE IF EXISTS public.wa_events ALTER COLUMN wa_id DROP NOT NULL;

-- 3. FIX profiles user_id DEFAULT
ALTER TABLE IF EXISTS public.profiles ALTER COLUMN user_id SET DEFAULT gen_random_uuid();

-- 4. DROP profiles FOREIGN KEY CONSTRAINT
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- 5. CREATE chat_state TABLE
CREATE TABLE IF NOT EXISTS public.chat_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text,  -- Made nullable (fixes error #7)
  state jsonb DEFAULT '{}'::jsonb,
  last_updated timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  user_id uuid,  -- Added (fixes error #6)
  UNIQUE(phone_number)
);

-- Disable RLS on chat_state
ALTER TABLE IF EXISTS public.chat_state DISABLE ROW LEVEL SECURITY;

-- Grant permissions on chat_state
GRANT ALL ON public.chat_state TO anon, authenticated, service_role, postgres;

-- Create indexes on chat_state
CREATE INDEX IF NOT EXISTS idx_chat_state_phone ON public.chat_state(phone_number);
CREATE INDEX IF NOT EXISTS idx_chat_state_updated ON public.chat_state(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_chat_state_user_id ON public.chat_state(user_id);

-- 6. ENSURE webhook tables have no RLS
ALTER TABLE IF EXISTS public.webhook_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wa_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wa_interactions DISABLE ROW LEVEL SECURITY;

-- 7. CREATE MISSING TABLES

-- Drop existing views/tables if they exist (replace with proper tables)
DROP VIEW IF EXISTS public.whatsapp_home_menu_items CASCADE;
DROP TABLE IF EXISTS public.app_config CASCADE;

-- Create whatsapp_home_menu_items table with proper schema
CREATE TABLE IF NOT EXISTS public.whatsapp_home_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL,
  is_active boolean DEFAULT true,
  active_countries text[] DEFAULT '{}',
  display_order integer DEFAULT 0,
  icon text,
  country_specific_names jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.whatsapp_home_menu_items DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.whatsapp_home_menu_items TO anon, authenticated, service_role, postgres;
CREATE INDEX IF NOT EXISTS idx_whatsapp_home_menu_items_active ON public.whatsapp_home_menu_items(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_home_menu_items_order ON public.whatsapp_home_menu_items(display_order);

-- Create app_config table with integer id
CREATE TABLE IF NOT EXISTS public.app_config (
  id integer PRIMARY KEY DEFAULT 1,
  search_radius_km numeric,
  max_results integer,
  subscription_price numeric,
  wa_bot_number_e164 text,
  admin_numbers text[],
  insurance_admin_numbers text[],
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT app_config_single_row CHECK (id = 1)
);

ALTER TABLE IF EXISTS public.app_config DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.app_config TO anon, authenticated, service_role, postgres;

-- Create farm_synonyms table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.farm_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid REFERENCES public.farms(id) ON DELETE CASCADE,
  synonym text NOT NULL,
  phrase text,  -- Error #13 fix: code expects phrase column
  created_at timestamptz DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.farm_synonyms DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.farm_synonyms TO anon, authenticated, service_role, postgres;
CREATE INDEX IF NOT EXISTS idx_farm_synonyms_farm_id ON public.farm_synonyms(farm_id);

-- Error #11 fix: Add is_active column to menu_items
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 8. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
