-- =====================================================
-- PHASE 1: FOUNDATION & CORE INFRASTRUCTURE
-- Purpose: Essential extensions, base tables, RLS, and indexes
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Enable PostGIS Extension
-- =====================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- 2. Enable pgvector for semantic search
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 3. Create shops table (foundation for business operations)
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
-- 4. Enable RLS on sensitive tables
-- =====================================================
DO $$ 
DECLARE
  tables_to_secure TEXT[] := ARRAY[
    'admin_audit_log', 'admin_pin_sessions', 'admin_sessions', 'admin_submissions',
    'agent_conversations', 'agent_metrics', 'agent_negotiations', 'agent_registry',
    'momo_qr_requests', 'wallet_earn_actions', 'wallet_promoters', 'wallet_redeem_options',
    'call_events', 'calls', 'contacts',
    'insurance_media_queue', 'mobility_pro_access', 'petrol_stations', 'property_listings',
    'business_categories', 'marketplace_categories', 'station_numbers', 'campaign_target_archives'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables_to_secure LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      
      -- Add service_role full access policy if not exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = tbl AND policyname = 'service_role_full_access'
      ) THEN
        EXECUTE format(
          'CREATE POLICY "service_role_full_access" ON public.%I FOR ALL USING (auth.role() = ''service_role'')',
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 5. Add missing foreign key indexes (Critical for performance)
-- =====================================================
DO $$
BEGIN
  -- High-traffic tables
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trips') THEN
    CREATE INDEX IF NOT EXISTS idx_trips_creator_user_id ON public.trips(creator_user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_events') THEN
    CREATE INDEX IF NOT EXISTS idx_credit_events_user_id ON public.credit_events(user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_source_cart_id ON public.orders(source_cart_id);
  END IF;

  -- Business/marketplace
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'businesses') THEN
    CREATE INDEX IF NOT EXISTS idx_businesses_category_id ON public.businesses(category_id);
  END IF;
  
  -- Campaigns
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
  END IF;
END $$;

-- =====================================================
-- 6. Add updated_at triggers
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to key tables
DO $$ 
DECLARE
  table_names TEXT[] := ARRAY[
    'shops', 'bars', 'businesses', 'menus', 'items', 'orders',
    'profiles', 'trips', 'campaigns'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY table_names LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = tbl 
      AND column_name = 'updated_at'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', tbl);
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 7. Fix timestamp defaults
-- =====================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'created_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN created_at SET DEFAULT NOW();
    ALTER TABLE public.client_settings ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

COMMIT;

-- Mark migration as complete
INSERT INTO supabase_migrations.schema_migrations (version, name, inserted_at)
VALUES ('20260412100001', 'phase1_foundation', NOW())
ON CONFLICT (version) DO NOTHING;
