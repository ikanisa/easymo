-- =====================================================
-- PHASE 1: CORE INFRASTRUCTURE (RLS, Indexes, Triggers)
-- =====================================================
-- This phase sets up critical security and performance foundations
-- Safe to run independently - no data dependencies
-- =====================================================

BEGIN;

-- =====================================================
-- MIGRATION: Enable RLS on sensitive tables
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

  -- Communication Tables (may not exist)
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

-- =====================================================
-- MIGRATION: Add missing foreign key indexes
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
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);
  END IF;
  
  -- E-commerce related
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
    CREATE INDEX IF NOT EXISTS idx_categories_bar_id ON public.categories(bar_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'item_modifiers') THEN
    CREATE INDEX IF NOT EXISTS idx_item_modifiers_item_id ON public.item_modifiers(item_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'carts') THEN
    CREATE INDEX IF NOT EXISTS idx_carts_bar_id ON public.carts(bar_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_source_cart_id ON public.orders(source_cart_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_bar_id ON public.sessions(bar_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ocr_jobs') THEN
    CREATE INDEX IF NOT EXISTS idx_ocr_jobs_bar_id ON public.ocr_jobs(bar_id);
    CREATE INDEX IF NOT EXISTS idx_ocr_jobs_menu_id ON public.ocr_jobs(menu_id);
  END IF;
  
  -- Business/marketplace
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'businesses') THEN
    CREATE INDEX IF NOT EXISTS idx_businesses_category_id ON public.businesses(category_id);
  END IF;
  
  -- Insurance and verification
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'insurance_media_queue') THEN
    CREATE INDEX IF NOT EXISTS idx_insurance_media_queue_profile_id ON public.insurance_media_queue(profile_id);
  END IF;
  
  -- Vouchers
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vouchers') THEN
    CREATE INDEX IF NOT EXISTS idx_vouchers_redeemed_by_station_id ON public.vouchers(redeemed_by_station_id);
    CREATE INDEX IF NOT EXISTS idx_vouchers_issued_by_admin ON public.vouchers(issued_by_admin);
    CREATE INDEX IF NOT EXISTS idx_vouchers_created_by ON public.vouchers(created_by);
    CREATE INDEX IF NOT EXISTS idx_vouchers_station_scope ON public.vouchers(station_scope);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voucher_redemptions') THEN
    CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_station_id ON public.voucher_redemptions(station_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voucher_events') THEN
    CREATE INDEX IF NOT EXISTS idx_voucher_events_actor_id ON public.voucher_events(actor_id);
  END IF;
  
  -- Mobility/trips
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recurring_trips') THEN
    CREATE INDEX IF NOT EXISTS idx_recurring_trips_origin_favorite_id ON public.recurring_trips(origin_favorite_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_trips_dest_favorite_id ON public.recurring_trips(dest_favorite_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'driver_availability') THEN
    CREATE INDEX IF NOT EXISTS idx_driver_availability_parking_id ON public.driver_availability(parking_id);
  END IF;
  
  -- Voice/calls
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voice_events') THEN
    CREATE INDEX IF NOT EXISTS idx_voice_events_call_id ON public.voice_events(call_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transcripts') THEN
    CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON public.transcripts(call_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'call_consents') THEN
    CREATE INDEX IF NOT EXISTS idx_call_consents_call_id ON public.call_consents(call_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mcp_tool_calls') THEN
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_call_id ON public.mcp_tool_calls(call_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wa_threads') THEN
    CREATE INDEX IF NOT EXISTS idx_wa_threads_call_id ON public.wa_threads(call_id);
  END IF;
  
  -- Agent deployment
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_deployments') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_deployments_version_id ON public.agent_deployments(version_id);
  END IF;
END $$;

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);

-- =====================================================
-- MIGRATION: Add updated_at triggers
-- =====================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to safely add trigger
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

-- Apply triggers to all relevant tables
DO $$ 
DECLARE
  table_names TEXT[] := ARRAY[
    'admin_alert_prefs', 'admin_sessions', 'agent_document_chunks', 'agent_personas',
    'agent_registry', 'agent_toolkits', 'agent_versions', 'app_config', 'background_jobs',
    'bar_numbers', 'bar_settings', 'bar_tables', 'bars', 'cache_entries', 'carts',
    'categories', 'chat_state', 'contacts', 'driver_status', 'driver_presence',
    'driver_availability', 'driver_parking', 'properties', 'scheduled_trips',
    'recurring_trips', 'shops', 'businesses', 'menus', 'items', 'orders',
    'notifications', 'wallet_accounts', 'payment_methods', 'locations', 'routes',
    'feature_flags', 'service_registry', 'profiles', 'trips', 'vouchers',
    'subscriptions', 'settings', 'sessions', 'petrol_stations', 'campaigns'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY table_names LOOP
    PERFORM public.add_updated_at_trigger(tbl);
  END LOOP;
END $$;

-- Clean up helper function
DROP FUNCTION IF EXISTS public.add_updated_at_trigger(TEXT);

-- =====================================================
-- MIGRATION: Fix timestamp defaults
-- =====================================================

-- Fix client_settings (only if columns exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'created_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'updated_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

-- Fix feature_flag_overview
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feature_flag_overview' AND column_name = 'updated_at') THEN
    ALTER TABLE public.feature_flag_overview ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

-- Fix published_menus
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'published_menus' AND column_name = 'created_at') THEN
    ALTER TABLE public.published_menus ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'published_menus' AND column_name = 'updated_at') THEN
    ALTER TABLE public.published_menus ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

COMMIT;

RAISE NOTICE '✅ Phase 1 Complete: Core infrastructure deployed';
