-- =====================================================
-- PHASE 1: CORE INFRASTRUCTURE
-- Generated: 2025-11-12
-- Includes: PostGIS, shops table, RLS, indexes, triggers
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Enable PostGIS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- 2. Create shops table
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
-- 3. Enable RLS on sensitive tables
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
ALTER TABLE IF EXISTS public.insurance_media_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mobility_pro_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.petrol_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.station_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_target_archives ENABLE ROW LEVEL SECURITY;

-- Create basic service role policies for tables without existing policies
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
END $$;

-- =====================================================
-- 4. Add missing foreign key indexes
-- =====================================================
DO $$
BEGIN
  -- Critical high-traffic tables
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trips') THEN
    CREATE INDEX IF NOT EXISTS idx_trips_creator_user_id ON public.trips(creator_user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_events') THEN
    CREATE INDEX IF NOT EXISTS idx_credit_events_user_id ON public.credit_events(user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cart_items') THEN
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_items') THEN
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
  END IF;
END $$;

-- =====================================================
-- 5. Add updated_at triggers
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

-- Apply triggers to key tables
DO $$ 
DECLARE
  table_names TEXT[] := ARRAY['shops', 'bars', 'businesses', 'menus', 'items', 'orders'];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY table_names LOOP
    PERFORM public.add_updated_at_trigger(tbl);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.add_updated_at_trigger(TEXT);

-- =====================================================
-- 6. Fix timestamp defaults
-- =====================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'created_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'updated_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

COMMIT;
