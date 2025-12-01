BEGIN;

-- =====================================================
-- COMPLETE PRODUCTION FIX - November 21, 2025
-- =====================================================
-- Fixes "permission denied for schema public" errors
-- and wa_events NOT NULL constraint issues
-- =====================================================

-- 1. GRANT SCHEMA PERMISSIONS (Critical!)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;

-- 2. GRANT TABLE PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role, postgres;

-- 3. SET DEFAULT PRIVILEGES FOR FUTURE OBJECTS
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role, postgres;

-- 4. DISABLE RLS ON CRITICAL WEBHOOK TABLES
ALTER TABLE IF EXISTS public.webhook_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wa_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wa_interactions DISABLE ROW LEVEL SECURITY;

-- 5. FIX wa_events NOT NULL CONSTRAINTS
ALTER TABLE IF EXISTS public.wa_events ALTER COLUMN event_type DROP NOT NULL;
ALTER TABLE IF EXISTS public.wa_events ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE IF EXISTS public.wa_events ALTER COLUMN wa_id DROP NOT NULL;

-- 6. ENSURE webhook_logs HAS ALL REQUIRED COLUMNS
ALTER TABLE IF EXISTS public.webhook_logs 
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 7. CREATE INDEXES IF MISSING
CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint_time 
  ON public.webhook_logs(endpoint, received_at);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_status_code 
  ON public.webhook_logs(status_code) 
  WHERE status_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_events_message_id 
  ON public.wa_events(message_id);

CREATE INDEX IF NOT EXISTS idx_wa_interactions_wa_id 
  ON public.wa_interactions(wa_id);

-- 8. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
