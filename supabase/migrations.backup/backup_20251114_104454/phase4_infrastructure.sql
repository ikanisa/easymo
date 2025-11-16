-- =====================================================
-- PHASE 4: INFRASTRUCTURE SYSTEMS - Observability, Sessions, Transactions, Event Store
-- Migrations: System Observability, WhatsApp Sessions, Transactions, Service Registry, Event Store, Analytics
-- =====================================================

BEGIN;

-- =====================================================
-- MIGRATION 18: 20260401100000_system_observability.sql (Partial - Core Tables Only)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.system_metrics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  service_name text NOT NULL,
  metric_type text NOT NULL,
  metric_name text NOT NULL,
  value numeric NOT NULL,
  unit text,
  tags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS public.system_metrics_2026_04 PARTITION OF public.system_metrics
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX IF NOT EXISTS idx_system_metrics_service_time 
  ON public.system_metrics_2026_04 (service_name, created_at DESC);

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert_metrics" 
  ON public.system_metrics 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

GRANT SELECT ON public.system_metrics TO authenticated;
GRANT INSERT ON public.system_metrics TO service_role;

-- =====================================================
-- MIGRATION 19: 20260401110000_whatsapp_sessions.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  session_token text NOT NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'suspended', 'expired')),
  last_activity_at timestamptz,
  message_count integer DEFAULT 0,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone 
  ON public.whatsapp_sessions (phone_number);

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_wa_sessions" 
  ON public.whatsapp_sessions 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT ON public.whatsapp_sessions TO authenticated;
GRANT ALL ON public.whatsapp_sessions TO service_role;

-- =====================================================
-- MIGRATION 20: 20260401120000_transactions_payments.sql (Partial)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_ref text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('debit', 'credit', 'transfer', 'payment', 'refund')),
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'RWF' NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at),
  UNIQUE (transaction_ref, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS public.transactions_2026_04 PARTITION OF public.transactions
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
  ON public.transactions_2026_04 (user_id, created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_transactions" 
  ON public.transactions 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

-- =====================================================
-- MIGRATION 21: 20260401130000_service_registry_feature_flags.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.service_registry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text UNIQUE NOT NULL,
  service_type text NOT NULL,
  version text NOT NULL,
  endpoint text NOT NULL,
  status text DEFAULT 'healthy',
  last_heartbeat_at timestamptz,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  enabled boolean DEFAULT false NOT NULL,
  rollout_percentage integer DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.service_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_registry" ON public.service_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_flags" ON public.feature_flags FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.service_registry TO authenticated;
GRANT ALL ON public.service_registry TO service_role;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

-- =====================================================
-- MIGRATION 22: 20260401140000_event_store_message_queue.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.event_store (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_type text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  correlation_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS public.event_store_2026_04 PARTITION OF public.event_store
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX IF NOT EXISTS idx_event_store_aggregate 
  ON public.event_store_2026_04 (aggregate_type, aggregate_id, created_at DESC);

ALTER TABLE public.event_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_events" 
  ON public.event_store 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT ON public.event_store TO authenticated;
GRANT ALL ON public.event_store TO service_role;

-- =====================================================
-- MIGRATION 23: 20260401150000_location_cache_optimization.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  location_type text NOT NULL CHECK (location_type IN ('current', 'home', 'work', 'favorite')),
  coordinates geography(POINT, 4326) NOT NULL,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locations_geo 
  ON public.locations USING GIST (coordinates);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_locations" 
  ON public.locations 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.locations TO authenticated;

-- =====================================================
-- MIGRATION 24: 20260401160000_analytics_infrastructure.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS public.analytics_events_2026_04 PARTITION OF public.analytics_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time 
  ON public.analytics_events_2026_04 (event_name, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_analytics" 
  ON public.analytics_events 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT ON public.analytics_events TO authenticated;
GRANT INSERT ON public.analytics_events TO service_role;

-- =====================================================
-- MIGRATION 25: 20260401170000_service_configurations.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.configurations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  config_key text NOT NULL,
  config_value jsonb NOT NULL,
  is_secret boolean DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(service_name, environment, config_key)
);

ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_config" 
  ON public.configurations 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT ON public.configurations TO authenticated;
GRANT ALL ON public.configurations TO service_role;

COMMIT;

-- Mark migrations as applied
INSERT INTO supabase_migrations.schema_migrations (version, name, inserted_at)
VALUES
  ('20260401100000', 'system_observability', NOW()),
  ('20260401110000', 'whatsapp_sessions', NOW()),
  ('20260401120000', 'transactions_payments', NOW()),
  ('20260401130000', 'service_registry_feature_flags', NOW()),
  ('20260401140000', 'event_store_message_queue', NOW()),
  ('20260401150000', 'location_cache_optimization', NOW()),
  ('20260401160000', 'analytics_infrastructure', NOW()),
  ('20260401170000', 'service_configurations', NOW())
ON CONFLICT (version) DO NOTHING;
