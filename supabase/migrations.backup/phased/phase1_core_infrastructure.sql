-- =====================================================
-- PHASE 1: CORE INFRASTRUCTURE (Migrations 1-7)
-- =====================================================
-- PostGIS, Shops, RLS, Indexes, Triggers, Timestamp fixes, Partitions
-- This phase sets up the foundational database infrastructure
-- =====================================================

BEGIN;

-- =====================================================
-- MIGRATION 1: Enable PostGIS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- MIGRATION 2: Create shops table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location GEOGRAPHY(POINT, 4326),
  categories TEXT[] DEFAULT '{}',
  whatsapp_catalog_url TEXT,
  phone TEXT,
  opening_hours TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  verified BOOLEAN DEFAULT FALSE,
  rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MIGRATION 3: Enable RLS on sensitive tables
-- =====================================================
ALTER TABLE IF EXISTS public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_pin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.momo_qr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_earn_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_redeem_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insurance_media_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mobility_pro_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.petrol_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.station_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_target_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bar_number_canonicalization_conflicts ENABLE ROW LEVEL SECURITY;

-- Basic service role policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_log' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.admin_audit_log FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_categories' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.business_categories FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_categories' AND policyname = 'authenticated_read') THEN
    CREATE POLICY "authenticated_read" ON public.business_categories FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- =====================================================
-- MIGRATION 4: Add missing foreign key indexes
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trips') THEN
    CREATE INDEX IF NOT EXISTS idx_trips_creator_user_id ON public.trips(creator_user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_events') THEN
    CREATE INDEX IF NOT EXISTS idx_credit_events_user_id ON public.credit_events(user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
  END IF;
END $$;

-- =====================================================
-- MIGRATION 5: Add updated_at triggers
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.add_updated_at_trigger(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = p_table_name 
    AND column_name = 'updated_at'
  ) THEN
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', p_table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', p_table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE
  table_names TEXT[] := ARRAY['shops', 'bars', 'carts', 'orders', 'sessions', 'profiles'];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY table_names LOOP
    PERFORM public.add_updated_at_trigger(tbl);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.add_updated_at_trigger(TEXT);

-- =====================================================
-- MIGRATION 6: Fix timestamp defaults
-- =====================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'created_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'updated_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

-- =====================================================
-- MIGRATION 7: Partition automation
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_monthly_partition(
  parent_table TEXT,
  partition_date DATE
)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  partition_name := parent_table || '_' || TO_CHAR(partition_date, 'YYYY_MM');
  start_date := TO_CHAR(partition_date, 'YYYY-MM-01');
  end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-01');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name
    AND n.nspname = 'public'
  ) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
      partition_name, parent_table, start_date, end_date
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Mark migrations as applied
INSERT INTO supabase_migrations.schema_migrations (version, name, inserted_at)
VALUES
  ('20240101000000', 'enable_postgis', NOW()),
  ('20240102000000', 'create_shops_table', NOW()),
  ('20251112135627', 'enable_rls_on_sensitive_tables', NOW()),
  ('20251112135628', 'add_missing_foreign_key_indexes', NOW()),
  ('20251112135629', 'add_updated_at_triggers', NOW()),
  ('20251112135630', 'fix_timestamp_defaults', NOW()),
  ('20251112135631', 'partition_automation', NOW())
ON CONFLICT (version) DO NOTHING;
