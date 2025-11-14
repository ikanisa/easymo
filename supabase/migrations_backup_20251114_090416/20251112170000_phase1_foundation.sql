-- =====================================================
-- PHASE 1: FOUNDATION (Low Risk)
-- Purpose: Extensions, Core Tables, and RLS Policies
-- Duration: ~2 minutes
-- Risk: LOW - No existing data affected
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1.1: Enable Required Extensions
-- =====================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- STEP 1.2: Bootstrap Core Tables
-- =====================================================

-- Shops table (required by later migrations)
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

-- Bars table (required by bars/restaurants system)
CREATE TABLE IF NOT EXISTS public.bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    location_text text,
    country text,
    city_area text,
    currency text,
    momo_code text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bars_slug_key UNIQUE (slug)
);

-- =====================================================
-- STEP 1.3: Enable RLS on Sensitive Tables
-- =====================================================

-- Admin Tables
ALTER TABLE IF EXISTS public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_pin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_submissions ENABLE ROW LEVEL SECURITY;

-- Agent/AI Tables
ALTER TABLE IF EXISTS public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_registry ENABLE ROW LEVEL SECURITY;

-- Financial/Payment Tables
ALTER TABLE IF EXISTS public.momo_qr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_earn_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_redeem_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voucher_redemptions ENABLE ROW LEVEL SECURITY;

-- Communication Tables
ALTER TABLE IF EXISTS public.call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;

-- Operations Tables
ALTER TABLE IF EXISTS public.insurance_media_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mobility_pro_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.petrol_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_listings ENABLE ROW LEVEL SECURITY;

-- Master Data Tables
ALTER TABLE IF EXISTS public.business_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.station_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_target_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bar_number_canonicalization_conflicts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 1.4: Create Basic Service Role Policies
-- =====================================================

DO $$ BEGIN
  -- Admin Tables
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_log' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.admin_audit_log FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_pin_sessions' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.admin_pin_sessions FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_sessions' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.admin_sessions FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_submissions' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.admin_submissions FOR ALL USING (auth.role() = 'service_role');
  END IF;

  -- Agent Tables
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_conversations' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.agent_conversations FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_metrics' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.agent_metrics FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_negotiations' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.agent_negotiations FOR ALL USING (auth.role() = 'service_role');
  END IF;

  -- Financial Tables
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'momo_qr_requests' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.momo_qr_requests FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_earn_actions' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.wallet_earn_actions FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_promoters' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.wallet_promoters FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_redeem_options' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.wallet_redeem_options FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voucher_redemptions') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voucher_redemptions' AND policyname = 'service_role_full_access') THEN
      CREATE POLICY "service_role_full_access" ON public.voucher_redemptions FOR ALL USING (auth.role() = 'service_role');
    END IF;
  END IF;

  -- Communication Tables
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'contacts') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'service_role_full_access') THEN
      CREATE POLICY "service_role_full_access" ON public.contacts FOR ALL USING (auth.role() = 'service_role');
    END IF;
  END IF;

  -- Operations Tables
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insurance_media_queue' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.insurance_media_queue FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mobility_pro_access' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.mobility_pro_access FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'petrol_stations' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.petrol_stations FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_listings' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.property_listings FOR ALL USING (auth.role() = 'service_role');
  END IF;

  -- Master Data Tables
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_categories' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.business_categories FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_categories' AND policyname = 'authenticated_read') THEN
    CREATE POLICY "authenticated_read" ON public.business_categories FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_categories' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.marketplace_categories FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketplace_categories' AND policyname = 'authenticated_read') THEN
    CREATE POLICY "authenticated_read" ON public.marketplace_categories FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'station_numbers' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.station_numbers FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_target_archives' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY "service_role_full_access" ON public.campaign_target_archives FOR ALL USING (auth.role() = 'service_role');
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bar_number_canonicalization_conflicts') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bar_number_canonicalization_conflicts' AND policyname = 'service_role_full_access') THEN
      CREATE POLICY "service_role_full_access" ON public.bar_number_canonicalization_conflicts FOR ALL USING (auth.role() = 'service_role');
    END IF;
  END IF;
END $$;

COMMIT;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 1 Complete: Foundation established';
  RAISE NOTICE '   - Extensions enabled (PostGIS, pgvector)';
  RAISE NOTICE '   - Core tables created (shops, bars)';
  RAISE NOTICE '   - RLS enabled on 25+ tables';
  RAISE NOTICE '   - Basic policies configured';
END $$;
