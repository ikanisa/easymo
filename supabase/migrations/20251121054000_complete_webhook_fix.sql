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
  phone_number text NOT NULL,
  state jsonb DEFAULT '{}'::jsonb,
  last_updated timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(phone_number)
);

-- Disable RLS on chat_state
ALTER TABLE IF EXISTS public.chat_state DISABLE ROW LEVEL SECURITY;

-- Grant permissions on chat_state
GRANT ALL ON public.chat_state TO anon, authenticated, service_role, postgres;

-- Create indexes on chat_state
CREATE INDEX IF NOT EXISTS idx_chat_state_phone ON public.chat_state(phone_number);
CREATE INDEX IF NOT EXISTS idx_chat_state_updated ON public.chat_state(last_updated DESC);

-- 6. ENSURE webhook tables have no RLS
ALTER TABLE IF EXISTS public.webhook_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wa_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wa_interactions DISABLE ROW LEVEL SECURITY;

-- 7. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
