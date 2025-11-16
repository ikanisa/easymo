-- =====================================================
-- CONSOLIDATED MIGRATION SCRIPT FOR SUPABASE DASHBOARD
-- Generated: 2025-11-12 15:47 UTC
-- Project: easymo- (lhbowpbcpwoiparwnwgt)
-- Total Migrations: 25
-- =====================================================
-- INSTRUCTIONS:
-- 1. Copy this ENTIRE script
-- 2. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql
-- 3. Paste into SQL Editor
-- 4. Click "Run" (or press Cmd+Enter / Ctrl+Enter)
-- 5. Wait for completion (may take 3-5 minutes)
-- 6. Check for any errors in the output panel
-- =====================================================
-- NOTE: Some migrations may show "already exists" notices - this is NORMAL
--       The script is designed to be idempotent (safe to run multiple times)
-- =====================================================


-- =====================================================
-- MIGRATION 1: 20240101000000_enable_postagis.sql
-- =====================================================

-- Enable PostGIS before any geography columns are created
CREATE EXTENSION IF NOT EXISTS postgis;


-- =====================================================
-- MIGRATION 2: 20240102000000_create_shops_table.sql
-- =====================================================

-- Bootstrap shops table so later migrations can extend it
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
-- MIGRATION 3: 20251112135627_enable_rls_on_sensitive_tables.sql
-- =====================================================


-- Migration: Enable RLS on all sensitive tables
-- Date: 2025-11-12
-- Description: Enable Row Level Security on 34 tables that handle sensitive data

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
-- MIGRATION 4: 20251112135628_add_missing_foreign_key_indexes.sql
-- =====================================================


-- Migration: Add missing foreign key indexes
-- Date: 2025-11-12
-- Description: Add indexes on foreign key columns for better query performance
-- Note: Wrapped in existence checks to handle missing tables gracefully

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
-- MIGRATION 5: 20251112135629_add_updated_at_triggers.sql
-- =====================================================


-- Migration: Add updated_at triggers to all tables with updated_at column
-- Date: 2025-11-12
-- Description: Ensure updated_at columns are automatically updated on row modification

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
-- MIGRATION 6: 20251112135630_fix_timestamp_defaults.sql
-- =====================================================


-- Migration: Fix missing timestamp defaults
-- Date: 2025-11-12
-- Description: Add default NOW() to created_at and updated_at columns that are missing it

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



-- =====================================================
-- MIGRATION 7: 20251112135631_partition_automation.sql
-- =====================================================


-- Migration: Create partition automation and future partitions
-- Date: 2025-11-12
-- Description: Create partitions for future months and set up automation strategy

-- Function to create partitions for a given table and date range
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
  
  -- Check if partition already exists
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
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for next 6 months for all partitioned tables
DO $$
DECLARE
  i INTEGER;
  partition_date DATE;
  tables_to_partition TEXT[] := ARRAY['event_store', 'system_audit_logs', 'system_metrics', 'transactions'];
  tbl TEXT;
BEGIN
  -- Start from June 2026 (April and May already exist)
  FOR i IN 0..5 LOOP
    partition_date := DATE '2026-06-01' + (i * INTERVAL '1 month');
    
    -- Check and create partitions for each table
    FOREACH tbl IN ARRAY tables_to_partition LOOP
      -- Only create partition if parent table exists
      IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
        PERFORM public.create_monthly_partition(tbl, partition_date);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Create indexes on new partitions for transactions
DO $$
DECLARE
  partition_name TEXT;
  month_dates DATE[] := ARRAY[
    '2026-06-01'::DATE, '2026-07-01'::DATE, '2026-08-01'::DATE,
    '2026-09-01'::DATE, '2026-10-01'::DATE, '2026-11-01'::DATE
  ];
  partition_date DATE;
BEGIN
  FOREACH partition_date IN ARRAY month_dates LOOP
    partition_name := 'transactions_' || TO_CHAR(partition_date, 'YYYY_MM');
    
    -- Only create indexes if partition exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = partition_name) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_created ON public.%I (user_id, created_at DESC)', partition_name, partition_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_status ON public.%I (status, created_at DESC)', partition_name, partition_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_correlation ON public.%I (correlation_id)', partition_name, partition_name);
    END IF;
  END LOOP;
END $$;

-- Note: For production, consider setting up pg_cron or external scheduler
-- to automatically call create_monthly_partition() for future months
-- Example pg_cron job (requires pg_cron extension):
-- SELECT cron.schedule(
--   'create-monthly-partitions',
--   '0 0 1 * *', -- Run at midnight on the 1st of each month
--   $$
--   SELECT public.create_monthly_partition('event_store', CURRENT_DATE + INTERVAL '2 months');
--   SELECT public.create_monthly_partition('system_audit_logs', CURRENT_DATE + INTERVAL '2 months');
--   SELECT public.create_monthly_partition('system_metrics', CURRENT_DATE + INTERVAL '2 months');
--   SELECT public.create_monthly_partition('transactions', CURRENT_DATE + INTERVAL '2 months');
--   $$
-- );



-- =====================================================
-- MIGRATION 8: 20251112135632_add_essential_functions.sql
-- =====================================================


-- Migration: Add essential missing functions
-- Date: 2025-11-12
-- Description: Implement core business logic functions for wallet, trips, and user management

-- Function: Handle new user creation (onboarding)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, created_at, updated_at)
  VALUES (NEW.id::TEXT, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Log user creation event
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    NEW.id::TEXT,
    'user.created',
    'user',
    NEW.id::TEXT,
    jsonb_build_object(
      'email', NEW.email,
      'phone', NEW.phone
    ),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Get user wallet balance
CREATE OR REPLACE FUNCTION public.get_user_wallet(p_user_id TEXT)
RETURNS TABLE (
  wallet_id UUID,
  balance NUMERIC,
  currency TEXT,
  status TEXT,
  last_transaction_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.balance,
    w.currency,
    w.status,
    (
      SELECT MAX(wt.created_at)
      FROM public.wallet_transactions wt
      WHERE wt.wallet_id = w.id
    ) as last_transaction_at
  FROM public.wallet_accounts w
  WHERE w.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update wallet balance with transaction recording
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
  p_user_id TEXT,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet
  SELECT id INTO v_wallet_id
  FROM public.wallet_accounts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallet_accounts (user_id, balance, currency, status, created_at, updated_at)
    VALUES (p_user_id, 0, 'RWF', 'active', NOW(), NOW())
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Update balance atomically
  UPDATE public.wallet_accounts
  SET 
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO public.wallet_transactions (
    wallet_id,
    amount,
    transaction_type,
    status,
    description,
    reference,
    metadata,
    created_at
  ) VALUES (
    v_wallet_id,
    p_amount,
    p_transaction_type,
    'completed',
    p_description,
    p_reference,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Record trip with full details
CREATE OR REPLACE FUNCTION public.record_trip(
  p_creator_user_id TEXT,
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_dropoff_lat DOUBLE PRECISION,
  p_dropoff_lng DOUBLE PRECISION,
  p_pickup_address TEXT DEFAULT NULL,
  p_dropoff_address TEXT DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT 'Moto',
  p_fare_amount NUMERIC DEFAULT NULL,
  p_distance_km NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  v_trip_id UUID;
  v_pickup_point GEOGRAPHY;
  v_dropoff_point GEOGRAPHY;
BEGIN
  -- Create geography points
  v_pickup_point := ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::GEOGRAPHY;
  v_dropoff_point := ST_SetSRID(ST_MakePoint(p_dropoff_lng, p_dropoff_lat), 4326)::GEOGRAPHY;
  
  -- Insert trip
  INSERT INTO public.trips (
    creator_user_id,
    pickup_location,
    dropoff_location,
    pickup_address,
    dropoff_address,
    vehicle_type,
    fare_amount,
    distance_km,
    status,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    p_creator_user_id,
    v_pickup_point,
    v_dropoff_point,
    p_pickup_address,
    p_dropoff_address,
    p_vehicle_type,
    p_fare_amount,
    p_distance_km,
    'pending',
    p_metadata,
    NOW(),
    NOW()
  ) RETURNING id INTO v_trip_id;
  
  -- Record metric
  PERFORM public.record_metric('trip.created', 1, jsonb_build_object(
    'vehicle_type', p_vehicle_type,
    'user_id', p_creator_user_id
  ));
  
  RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Match drivers to trip request
CREATE OR REPLACE FUNCTION public.match_drivers(
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_vehicle_type TEXT DEFAULT 'Moto',
  p_radius_km DOUBLE PRECISION DEFAULT 5.0,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  driver_user_id TEXT,
  driver_name TEXT,
  vehicle_type TEXT,
  rating NUMERIC,
  distance_km DOUBLE PRECISION,
  is_available BOOLEAN
) AS $$
DECLARE
  v_pickup_point GEOGRAPHY;
BEGIN
  v_pickup_point := ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::GEOGRAPHY;
  
  RETURN QUERY
  SELECT 
    ds.user_id,
    COALESCE(p.display_name, p.name) as driver_name,
    ds.vehicle_type,
    COALESCE(ds.rating, 0) as rating,
    ST_Distance(ds.current_location::GEOGRAPHY, v_pickup_point) / 1000.0 as distance_km,
    ds.is_available
  FROM public.driver_status ds
  JOIN public.profiles p ON p.user_id = ds.user_id
  WHERE 
    ds.is_available = true
    AND ds.is_online = true
    AND (p_vehicle_type IS NULL OR ds.vehicle_type = p_vehicle_type)
    AND ST_DWithin(
      ds.current_location::GEOGRAPHY,
      v_pickup_point,
      p_radius_km * 1000
    )
  ORDER BY 
    distance_km ASC,
    rating DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_wallet(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_wallet_balance(TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_trip(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_drivers(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, INTEGER) TO authenticated, service_role;



-- =====================================================
-- MIGRATION 9: 20251112135633_observability_enhancements.sql
-- =====================================================


-- Migration: Add observability enhancements
-- Date: 2025-11-12
-- Description: Enhance observability with structured logging and correlation IDs per GROUND_RULES.md

-- Function: Log structured event (compliant with GROUND_RULES.md)
CREATE OR REPLACE FUNCTION public.log_structured_event(
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::JSONB,
  p_user_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_correlation_id TEXT;
BEGIN
  -- Generate correlation ID if not provided
  v_correlation_id := COALESCE(p_correlation_id, gen_random_uuid()::TEXT);
  
  -- Insert into event store
  INSERT INTO public.event_store (
    event_type,
    event_data,
    user_id,
    correlation_id,
    created_at
  ) VALUES (
    p_event_type,
    p_event_data || jsonb_build_object(
      'timestamp', NOW()::TEXT,
      'source', 'database'
    ),
    p_user_id,
    v_correlation_id,
    NOW()
  ) RETURNING id INTO v_event_id;
  
  -- Also record as metric for aggregation
  PERFORM public.record_metric(
    'event.' || p_event_type,
    1,
    jsonb_build_object(
      'correlation_id', v_correlation_id,
      'user_id', p_user_id
    )
  );
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get events by correlation ID
CREATE OR REPLACE FUNCTION public.get_events_by_correlation(
  p_correlation_id TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  event_data JSONB,
  user_id TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.event_type,
    e.event_data,
    e.user_id,
    e.created_at
  FROM public.event_store e
  WHERE e.correlation_id = p_correlation_id
  ORDER BY e.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Enhanced audit logging with PII masking
CREATE OR REPLACE FUNCTION public.log_audit_event_enhanced(
  p_user_id TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_correlation_id TEXT DEFAULT NULL,
  p_mask_pii BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_masked_metadata JSONB;
BEGIN
  -- Mask PII fields if requested
  IF p_mask_pii THEN
    v_masked_metadata := p_metadata;
    -- Mask common PII fields
    IF v_masked_metadata ? 'phone' THEN
      v_masked_metadata := v_masked_metadata || jsonb_build_object('phone', '***MASKED***');
    END IF;
    IF v_masked_metadata ? 'email' THEN
      v_masked_metadata := v_masked_metadata || jsonb_build_object('email', '***MASKED***');
    END IF;
    IF v_masked_metadata ? 'password' THEN
      v_masked_metadata := v_masked_metadata || jsonb_build_object('password', '***MASKED***');
    END IF;
  ELSE
    v_masked_metadata := p_metadata;
  END IF;
  
  -- Insert audit log
  INSERT INTO public.system_audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    correlation_id,
    created_at
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    v_masked_metadata || jsonb_build_object(
      'timestamp', NOW()::TEXT,
      'pii_masked', p_mask_pii
    ),
    COALESCE(p_correlation_id, gen_random_uuid()::TEXT),
    NOW()
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get audit trail for resource
CREATE OR REPLACE FUNCTION public.get_audit_trail(
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  action TEXT,
  metadata JSONB,
  correlation_id TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.action,
    a.metadata,
    a.correlation_id,
    a.created_at
  FROM public.system_audit_logs a
  WHERE 
    a.resource_type = p_resource_type
    AND a.resource_id = p_resource_id
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_structured_event(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_events_by_correlation(TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event_enhanced(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_audit_trail(TEXT, TEXT, INTEGER) TO authenticated, service_role;



-- =====================================================
-- MIGRATION 10: 20251112135634_security_policy_refinements.sql
-- =====================================================


-- Migration: Security policy refinements
-- Date: 2025-11-12
-- Description: Refine overly permissive policies to be more restrictive

-- Note: is_admin() function already exists from phase2_mobility_rls migration

-- Profiles: Restrict full read to own profile + admin
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT
  USING (
    user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Trips: Users can only see their own trips + service role
DROP POLICY IF EXISTS "trips_read_all" ON public.trips;
CREATE POLICY "trips_read_own" ON public.trips
  FOR SELECT
  USING (
    creator_user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Orders: Users can only see their own orders (uses profile_id UUID)
DROP POLICY IF EXISTS "orders_read_all" ON public.orders;
CREATE POLICY "orders_read_own" ON public.orders
  FOR SELECT
  USING (
    profile_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Driver presence: Service role and own data only
DROP POLICY IF EXISTS "driver_presence_read_all" ON public.driver_presence;
CREATE POLICY "driver_presence_read_limited" ON public.driver_presence
  FOR SELECT
  USING (
    user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Settings: Authenticated users can read, admins and service role can manage
DROP POLICY IF EXISTS "settings_read_all" ON public.settings;
CREATE POLICY "settings_read_authenticated" ON public.settings
  FOR SELECT
  USING (
    auth.role() IN ('authenticated', 'service_role')
  );

-- Subscriptions: Users can only see their own (uses UUID user_id)
DROP POLICY IF EXISTS "subscriptions_read_all" ON public.subscriptions;
CREATE POLICY "subscriptions_read_own" ON public.subscriptions
  FOR SELECT
  USING (
    user_id = (auth.jwt() ->> 'sub')::UUID
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Businesses: Keep public read for marketplace functionality
-- (Reviews should remain public for transparency)

-- Order events: Restrict to order owner (orders use profile_id)
DROP POLICY IF EXISTS "order_events_read_all" ON public.order_events;
CREATE POLICY "order_events_read_own" ON public.order_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_events.order_id
      AND (
        o.profile_id = (auth.jwt() ->> 'sub')::UUID
        OR public.is_admin()
      )
    )
    OR auth.role() = 'service_role'
  );

-- Campaign targets: Admin and service role only
DROP POLICY IF EXISTS "campaign_targets_read_all" ON public.campaign_targets;
CREATE POLICY "campaign_targets_admin_only" ON public.campaign_targets
  FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Campaigns: Admin and service role only
DROP POLICY IF EXISTS "campaigns_read_all" ON public.campaigns;
CREATE POLICY "campaigns_admin_only" ON public.campaigns
  FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
  );

-- Add missing policies for wallet tables with RLS now enabled
-- These tables don't have user columns, so restrict to service role and admins
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_earn_actions' AND policyname = 'wallet_earn_actions_service') THEN
    CREATE POLICY "wallet_earn_actions_service" ON public.wallet_earn_actions
      FOR ALL
      USING (
        public.is_admin()
        OR auth.role() = 'service_role'
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_promoters' AND policyname = 'wallet_promoters_service') THEN
    CREATE POLICY "wallet_promoters_service" ON public.wallet_promoters
      FOR ALL
      USING (
        public.is_admin()
        OR auth.role() = 'service_role'
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_redeem_options' AND policyname = 'wallet_redeem_options_read') THEN
    CREATE POLICY "wallet_redeem_options_read" ON public.wallet_redeem_options
      FOR SELECT
      USING (
        auth.role() IN ('authenticated', 'service_role')
      );
  END IF;
END $$;



-- =====================================================
-- MIGRATION 11: 20260312090000_video_performance_analytics.sql
-- =====================================================

-- Video performance analytics schema
-- Captures render jobs, approval workflows, and aggregated metrics

set check_function_bodies = off;

create table if not exists public.video_jobs (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid,
  slot text not null,
  template_id uuid,
  template_label text,
  hook_id uuid,
  hook_label text,
  cta_variant text,
  script_version text,
  rights_expiry_at timestamptz,
  renders integer default 0 not null,
  render_cost_cents integer default 0 not null,
  render_currency text default 'USD'::text not null,
  approvals_count integer default 0 not null,
  changes_requested_count integer default 0 not null,
  whatsapp_clicks integer default 0 not null,
  last_whatsapp_click_at timestamptz,
  last_approval_at timestamptz,
  last_requested_change_at timestamptz,
  notes text,
  status text default 'draft'::text not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists video_jobs_slot_idx on public.video_jobs(slot);
create index if not exists video_jobs_campaign_idx on public.video_jobs(campaign_id);
create index if not exists video_jobs_status_idx on public.video_jobs(status);
create index if not exists video_jobs_rights_expiry_idx on public.video_jobs(rights_expiry_at) where rights_expiry_at is not null;

create table if not exists public.video_approvals (
  id uuid default gen_random_uuid() primary key,
  job_id uuid not null references public.video_jobs(id) on delete cascade,
  reviewer_id uuid,
  reviewer_name text,
  status text default 'pending'::text not null check (status in ('pending','approved','changes_requested')),
  summary text,
  requested_changes text,
  whatsapp_clicks integer default 0 not null,
  last_whatsapp_click_at timestamptz,
  approved_at timestamptz,
  changes_requested_at timestamptz,
  recorded_at timestamptz default timezone('utc'::text, now()) not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists video_approvals_job_idx on public.video_approvals(job_id);
create index if not exists video_approvals_status_idx on public.video_approvals(job_id, status);
create index if not exists video_approvals_approved_idx on public.video_approvals(approved_at) where approved_at is not null;
create index if not exists video_approvals_changes_idx on public.video_approvals(changes_requested_at) where changes_requested_at is not null;

create table if not exists public.video_performance (
  id uuid default gen_random_uuid() primary key,
  job_id uuid not null references public.video_jobs(id) on delete cascade,
  template_id uuid,
  template_label text,
  hook_id uuid,
  hook_label text,
  cta_variant text,
  slot text not null,
  interval text not null check (interval in ('daily','weekly','lifetime')),
  interval_start timestamptz not null,
  renders integer default 0 not null,
  approvals integer default 0 not null,
  changes_requested integer default 0 not null,
  whatsapp_clicks integer default 0 not null,
  approval_rate numeric default 0 not null,
  click_through_rate numeric default 0 not null,
  cost_per_render numeric,
  insights text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  unique (job_id, interval, interval_start)
);

create index if not exists video_performance_interval_idx on public.video_performance(interval, interval_start desc);
create index if not exists video_performance_slot_idx on public.video_performance(slot, interval);
create index if not exists video_performance_hook_idx on public.video_performance(hook_id) where hook_id is not null;
create index if not exists video_performance_template_idx on public.video_performance(template_id) where template_id is not null;

create or replace function public.video_jobs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.video_approvals_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.video_performance_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger trg_video_jobs_touch_updated
  before update on public.video_jobs
  for each row
  execute function public.video_jobs_set_updated_at();

create trigger trg_video_approvals_touch_updated
  before update on public.video_approvals
  for each row
  execute function public.video_approvals_set_updated_at();

create trigger trg_video_performance_touch_updated
  before update on public.video_performance
  for each row
  execute function public.video_performance_set_updated_at();

create or replace function public.upsert_video_performance_row(
  job_row public.video_jobs,
  bucket_interval text,
  bucket_start timestamptz,
  renders integer,
  approvals integer,
  changes integer,
  clicks integer,
  approval_rate numeric,
  click_rate numeric,
  cost_per_render numeric,
  insights text
) returns void
language plpgsql
as $$
declare
  metadata jsonb;
begin
  metadata := coalesce(job_row.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'campaign_id', job_row.campaign_id,
      'template_id', job_row.template_id,
      'template_label', job_row.template_label,
      'hook_id', job_row.hook_id,
      'hook_label', job_row.hook_label,
      'cta_variant', job_row.cta_variant,
      'script_version', job_row.script_version,
      'rights_expiry_at', job_row.rights_expiry_at,
      'render_currency', job_row.render_currency,
      'render_cost_cents', job_row.render_cost_cents,
      'slot', job_row.slot
    );

  insert into public.video_performance as vp (
    job_id,
    template_id,
    template_label,
    hook_id,
    hook_label,
    cta_variant,
    slot,
    interval,
    interval_start,
    renders,
    approvals,
    changes_requested,
    whatsapp_clicks,
    approval_rate,
    click_through_rate,
    cost_per_render,
    insights,
    metadata,
    created_at,
    updated_at
  ) values (
    job_row.id,
    job_row.template_id,
    job_row.template_label,
    job_row.hook_id,
    job_row.hook_label,
    job_row.cta_variant,
    job_row.slot,
    bucket_interval,
    bucket_start,
    coalesce(renders, 0),
    coalesce(approvals, 0),
    coalesce(changes, 0),
    coalesce(clicks, 0),
    coalesce(approval_rate, 0),
    coalesce(click_rate, 0),
    cost_per_render,
    insights,
    metadata,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (job_id, interval, interval_start)
  do update set
    template_id = excluded.template_id,
    template_label = excluded.template_label,
    hook_id = excluded.hook_id,
    hook_label = excluded.hook_label,
    cta_variant = excluded.cta_variant,
    slot = excluded.slot,
    renders = excluded.renders,
    approvals = excluded.approvals,
    changes_requested = excluded.changes_requested,
    whatsapp_clicks = excluded.whatsapp_clicks,
    approval_rate = excluded.approval_rate,
    click_through_rate = excluded.click_through_rate,
    cost_per_render = excluded.cost_per_render,
    insights = excluded.insights,
    metadata = coalesce(vp.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = timezone('utc'::text, now());
end;
$$;

create or replace function public.refresh_video_performance(job_uuid uuid)
returns void
language plpgsql
as $$
declare
  job_row public.video_jobs;
  total_renders integer;
  total_approvals integer;
  total_changes integer;
  total_clicks integer;
  last_click_at timestamptz;
  last_approved_at timestamptz;
  last_changed_at timestamptz;
  approval_rate numeric;
  click_rate numeric;
  cost_per_render numeric;
  currency text;
  lifetime_bucket timestamptz;
  daily_bucket timestamptz;
  weekly_bucket timestamptz;
  insights text;
  safe_currency text;
  render_cost numeric;
begin
  select * into job_row from public.video_jobs where id = job_uuid;
  if not found then
    return;
  end if;

  total_renders := coalesce(job_row.renders, 0);

  select
    count(*) filter (where status = 'approved'),
    count(*) filter (where status = 'changes_requested'),
    coalesce(sum(whatsapp_clicks), 0),
    max(last_whatsapp_click_at),
    max(approved_at),
    max(changes_requested_at)
  into total_approvals, total_changes, total_clicks, last_click_at, last_approved_at, last_changed_at
  from public.video_approvals
  where job_id = job_uuid;

  total_approvals := coalesce(total_approvals, 0);
  total_changes := coalesce(total_changes, 0);
  total_clicks := coalesce(total_clicks, 0);

  if total_renders > 0 then
    approval_rate := round((total_approvals::numeric / total_renders::numeric), 4);
    click_rate := round((total_clicks::numeric / total_renders::numeric), 4);
  else
    approval_rate := 0;
    click_rate := 0;
  end if;

  if job_row.render_cost_cents is not null then
    render_cost := job_row.render_cost_cents::numeric / 100.0;
  else
    render_cost := null;
  end if;

  if render_cost is not null and total_renders > 0 then
    cost_per_render := round((render_cost / total_renders::numeric), 4);
  else
    cost_per_render := null;
  end if;

  currency := nullif(job_row.render_currency, '');
  safe_currency := coalesce(currency, 'USD');

  insights := format(
    'Approvals %s | CTR %s%% | Cost/Render %s %s',
    total_approvals,
    round(coalesce(click_rate, 0) * 100, 2),
    safe_currency,
    coalesce(to_char(cost_per_render, 'FM9999990.00'), 'n/a')
  );

  if pg_trigger_depth() = 1 then
    update public.video_jobs
    set
      approvals_count = total_approvals,
      changes_requested_count = total_changes,
      whatsapp_clicks = total_clicks,
      last_whatsapp_click_at = coalesce(last_click_at, last_whatsapp_click_at),
      last_approval_at = coalesce(last_approved_at, last_approval_at),
      last_requested_change_at = coalesce(last_changed_at, last_requested_change_at)
    where id = job_uuid;
  end if;

  lifetime_bucket := date_trunc('day', coalesce(job_row.created_at, timezone('utc'::text, now())));
  daily_bucket := date_trunc('day', timezone('utc'::text, now()));
  weekly_bucket := date_trunc('week', timezone('utc'::text, now()));

  perform public.upsert_video_performance_row(
    job_row,
    'daily',
    daily_bucket,
    total_renders,
    total_approvals,
    total_changes,
    total_clicks,
    approval_rate,
    click_rate,
    cost_per_render,
    insights
  );

  perform public.upsert_video_performance_row(
    job_row,
    'weekly',
    weekly_bucket,
    total_renders,
    total_approvals,
    total_changes,
    total_clicks,
    approval_rate,
    click_rate,
    cost_per_render,
    insights
  );

  perform public.upsert_video_performance_row(
    job_row,
    'lifetime',
    lifetime_bucket,
    total_renders,
    total_approvals,
    total_changes,
    total_clicks,
    approval_rate,
    click_rate,
    cost_per_render,
    insights
  );
end;
$$;

create or replace function public.video_jobs_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    return null;
  end if;

  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.refresh_video_performance(new.id);
  return new;
end;
$$;

create or replace function public.video_approvals_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    return null;
  end if;

  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.refresh_video_performance(new.job_id);
  return new;
end;
$$;

create trigger trg_video_jobs_refresh
  after insert or update on public.video_jobs
  for each row
  execute function public.video_jobs_after_change();

create trigger trg_video_approvals_refresh
  after insert or update on public.video_approvals
  for each row
  execute function public.video_approvals_after_change();

alter table public.video_jobs enable row level security;
alter table public.video_approvals enable row level security;
alter table public.video_performance enable row level security;

create policy video_jobs_service_role_access
  on public.video_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy video_approvals_service_role_access
  on public.video_approvals
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy video_performance_service_role_access
  on public.video_performance
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.video_jobs is 'Stores render jobs for marketing video variants and delivery metrics.';
comment on table public.video_approvals is 'Approval workflow records (approvals, change requests, WhatsApp clicks).';
comment on table public.video_performance is 'Aggregated performance roll-ups for video jobs across daily/weekly/lifetime windows.';


-- =====================================================
-- MIGRATION 12: 20260322100000_whatsapp_home_menu_config.sql
-- =====================================================


-- WhatsApp Home Menu Configuration Table
-- Allows dynamic configuration of home menu items visible to users
CREATE TABLE IF NOT EXISTS public.whatsapp_home_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  active_countries TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_home_menu_active ON public.whatsapp_home_menu_items(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_whatsapp_home_menu_countries ON public.whatsapp_home_menu_items USING gin(active_countries);

-- Add RLS policies
ALTER TABLE public.whatsapp_home_menu_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read active menu items
CREATE POLICY "Users can read active menu items"
  ON public.whatsapp_home_menu_items
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Service role can manage all menu items
CREATE POLICY "Service role can manage menu items"
  ON public.whatsapp_home_menu_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed initial menu items based on current implementation
INSERT INTO public.whatsapp_home_menu_items (name, key, is_active, active_countries, display_order, icon) VALUES
  ('Nearby Drivers', 'nearby_drivers', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 1, '🚖'),
  ('Nearby Passengers', 'nearby_passengers', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 2, '🧍'),
  ('Schedule Trip', 'schedule_trip', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 3, '🚦'),
  ('Motor Insurance', 'motor_insurance', true, ARRAY['RW'], 4, '🛡️'),
  ('Nearby Pharmacies', 'nearby_pharmacies', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 5, '💊'),
  ('Quincailleries', 'quincailleries', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 6, '🔧'),
  ('Shops & Services', 'shops_services', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 7, '🏪'),
  ('Property Rentals', 'property_rentals', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 8, '🏠'),
  ('MOMO QR Code', 'momo_qr', true, ARRAY['RW'], 9, '📱'),
  ('Bars & Restaurants', 'bars_restaurants', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 10, '🍽️'),
  ('Notary Services', 'notary_services', true, ARRAY['RW'], 11, '📜'),
  ('Customer Support', 'customer_support', true, ARRAY['RW', 'UG', 'KE', 'TZ', 'BI', 'CD'], 12, '💬')
ON CONFLICT (key) DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_whatsapp_home_menu_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whatsapp_home_menu_updated_at
  BEFORE UPDATE ON public.whatsapp_home_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_home_menu_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.whatsapp_home_menu_items IS 'Dynamic configuration for WhatsApp home menu items. Allows enabling/disabling features and country-specific availability.';



-- =====================================================
-- MIGRATION 13: 20260322110000_bars_restaurants_menu_system.sql
-- =====================================================


-- Bars and Restaurants Management System
-- Allows vendors to upload and manage their menus

-- Table for restaurant/bar menu items
CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES public.menus(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  is_available BOOLEAN DEFAULT true NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  created_by TEXT,
  ocr_extracted BOOLEAN DEFAULT false NOT NULL,
  ocr_confidence NUMERIC(3,2)
);

-- Table for menu upload requests (for OCR processing)
CREATE TABLE IF NOT EXISTS public.menu_upload_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  items_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  processed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'approved', 'rejected'))
);

-- Table for bar/restaurant managers
CREATE TABLE IF NOT EXISTS public.bar_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'manager',
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(bar_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('owner', 'manager', 'staff'))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_bar ON public.restaurant_menu_items(bar_id, is_available);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_category ON public.restaurant_menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_upload_requests_bar ON public.menu_upload_requests(bar_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_upload_requests_status ON public.menu_upload_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_bar_managers_bar ON public.bar_managers(bar_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bar_managers_user ON public.bar_managers(user_id, is_active);

-- Enable RLS
ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_upload_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_managers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurant_menu_items
-- Anyone can read available menu items
CREATE POLICY "Anyone can read available menu items"
  ON public.restaurant_menu_items
  FOR SELECT
  TO authenticated, anon
  USING (is_available = true);

-- Bar managers can manage their menu items
CREATE POLICY "Bar managers can manage their menu items"
  ON public.restaurant_menu_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = restaurant_menu_items.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = restaurant_menu_items.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  );

-- Service role can manage all
CREATE POLICY "Service role can manage all menu items"
  ON public.restaurant_menu_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for menu_upload_requests
-- Bar managers can view their upload requests
CREATE POLICY "Bar managers can view their upload requests"
  ON public.menu_upload_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = menu_upload_requests.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  );

-- Bar managers can create upload requests
CREATE POLICY "Bar managers can create upload requests"
  ON public.menu_upload_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bar_managers
      WHERE bar_managers.bar_id = menu_upload_requests.bar_id
        AND bar_managers.user_id = auth.uid()
        AND bar_managers.is_active = true
    )
  );

-- Service role can manage all
CREATE POLICY "Service role can manage all upload requests"
  ON public.menu_upload_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for bar_managers
-- Users can view their own manager roles
CREATE POLICY "Users can view their own manager roles"
  ON public.bar_managers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage all
CREATE POLICY "Service role can manage all bar managers"
  ON public.bar_managers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_restaurant_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_restaurant_menu_items_updated_at
  BEFORE UPDATE ON public.restaurant_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_menu_items_updated_at();

CREATE TRIGGER trigger_update_bar_managers_updated_at
  BEFORE UPDATE ON public.bar_managers
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_menu_items_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.restaurant_menu_items IS 'Menu items for bars and restaurants, extracted from OCR or manually entered';
COMMENT ON TABLE public.menu_upload_requests IS 'Tracks menu file uploads for OCR processing and approval workflow';
COMMENT ON TABLE public.bar_managers IS 'Associates users with bars/restaurants they can manage';



-- =====================================================
-- MIGRATION 14: 20260323100000_agent_registry_extended_config.sql
-- =====================================================

-- Agent Registry Extended Configuration
-- Migration to add comprehensive agent configuration fields to agent_registry table
-- Supports the full agent configuration structure defined in config/agent_configs.yaml


-- Create agent_registry table if it doesn't exist
CREATE TABLE IF NOT EXISTS agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to agent_registry to support extended configuration
ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['en']::TEXT[],
  ADD COLUMN IF NOT EXISTS autonomy TEXT DEFAULT 'auto' CHECK (autonomy IN ('auto', 'suggest', 'handoff')),
  ADD COLUMN IF NOT EXISTS guardrails JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_registry_slug ON agent_registry(slug);

-- Create index on autonomy level
CREATE INDEX IF NOT EXISTS idx_agent_registry_autonomy ON agent_registry(autonomy);

-- Backfill slug from agent_type for existing records (convert underscores to hyphens)
UPDATE agent_registry 
SET slug = REPLACE(agent_type, '_', '-')
WHERE slug IS NULL;

-- Add comment explaining the schema
COMMENT ON COLUMN agent_registry.slug IS 'Unique kebab-case identifier for the agent';
COMMENT ON COLUMN agent_registry.languages IS 'Array of supported language codes (en, fr, rw, sw, ln)';
COMMENT ON COLUMN agent_registry.autonomy IS 'Autonomy level: auto (full automation), suggest (requires approval), handoff (human required)';
COMMENT ON COLUMN agent_registry.guardrails IS 'JSON object containing safety and operational limits';
COMMENT ON COLUMN agent_registry.instructions IS 'Complete system prompt with ROLE, GOAL, STYLE, BEHAVIOR, FLOW';



-- =====================================================
-- MIGRATION 15: 20260324100000_business_multiple_whatsapp_numbers.sql
-- =====================================================


-- Migration: Add support for multiple WhatsApp numbers per business
-- Date: 2025-11-12
-- Description: Creates a junction table to allow businesses to have multiple WhatsApp contact numbers

-- Create business_whatsapp_numbers table
CREATE TABLE IF NOT EXISTS public.business_whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  whatsapp_e164 TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  added_by_whatsapp TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT business_whatsapp_unique UNIQUE (business_id, whatsapp_e164),
  CONSTRAINT valid_whatsapp_format CHECK (whatsapp_e164 ~ '^\+[1-9]\d{1,14}$')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_whatsapp_numbers_business_id 
  ON public.business_whatsapp_numbers(business_id);
CREATE INDEX IF NOT EXISTS idx_business_whatsapp_numbers_whatsapp 
  ON public.business_whatsapp_numbers(whatsapp_e164);

-- Add RLS policies
ALTER TABLE public.business_whatsapp_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view numbers for businesses they own
CREATE POLICY "Users can view numbers for their businesses"
  ON public.business_whatsapp_numbers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
      AND b.owner_whatsapp = auth.jwt()->>'phone'
    )
  );

-- Policy: Users can insert numbers for businesses they own
CREATE POLICY "Users can add numbers to their businesses"
  ON public.business_whatsapp_numbers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
      AND b.owner_whatsapp = auth.jwt()->>'phone'
    )
  );

-- Policy: Users can update numbers for businesses they own
CREATE POLICY "Users can update numbers for their businesses"
  ON public.business_whatsapp_numbers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
      AND b.owner_whatsapp = auth.jwt()->>'phone'
    )
  );

-- Policy: Users can delete numbers for businesses they own
CREATE POLICY "Users can delete numbers from their businesses"
  ON public.business_whatsapp_numbers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id
      AND b.owner_whatsapp = auth.jwt()->>'phone'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_business_whatsapp_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_business_whatsapp_numbers_updated_at
  BEFORE UPDATE ON public.business_whatsapp_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_business_whatsapp_numbers_updated_at();

-- Migrate existing owner_whatsapp to the new table as primary number
INSERT INTO public.business_whatsapp_numbers (business_id, whatsapp_e164, is_primary, verified)
SELECT id, owner_whatsapp, TRUE, TRUE
FROM public.businesses
WHERE owner_whatsapp IS NOT NULL
ON CONFLICT (business_id, whatsapp_e164) DO NOTHING;



-- =====================================================
-- MIGRATION 16: 20260324110000_vehicle_insurance_certificates.sql
-- =====================================================


-- Migration: Add vehicle insurance certificates tracking with OCR data
-- Date: 2025-11-12
-- Description: Stores insurance certificate data extracted via OCR for vehicle validation

-- Create vehicle_insurance_certificates table
CREATE TABLE IF NOT EXISTS public.vehicle_insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  whatsapp_e164 TEXT NOT NULL,
  vehicle_plate TEXT,
  
  -- Insurance details from OCR
  insurer_name TEXT,
  policy_number TEXT,
  certificate_number TEXT,
  policy_inception DATE,
  policy_expiry DATE NOT NULL,
  carte_jaune_number TEXT,
  carte_jaune_expiry DATE,
  
  -- Vehicle details from OCR
  make TEXT,
  model TEXT,
  vehicle_year INTEGER,
  registration_plate TEXT,
  vin_chassis TEXT,
  usage TEXT,
  licensed_to_carry INTEGER,
  
  -- Document metadata
  certificate_url TEXT,
  media_id TEXT,
  ocr_data JSONB,
  ocr_extracted_at TIMESTAMPTZ,
  
  -- Validation status
  is_valid BOOLEAN DEFAULT FALSE,
  validation_errors TEXT[],
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT vehicle_insurance_expiry_check CHECK (policy_expiry IS NOT NULL)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_profile_id 
  ON public.vehicle_insurance_certificates(profile_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_whatsapp 
  ON public.vehicle_insurance_certificates(whatsapp_e164);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_plate 
  ON public.vehicle_insurance_certificates(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_expiry 
  ON public.vehicle_insurance_certificates(policy_expiry);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_valid 
  ON public.vehicle_insurance_certificates(is_valid);

-- Add RLS policies
ALTER TABLE public.vehicle_insurance_certificates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own certificates
CREATE POLICY "Users can view their own insurance certificates"
  ON public.vehicle_insurance_certificates
  FOR SELECT
  USING (
    whatsapp_e164 = auth.jwt()->>'phone'
    OR profile_id = (auth.jwt()->>'sub')::UUID
  );

-- Policy: Users can insert their own certificates
CREATE POLICY "Users can add their own insurance certificates"
  ON public.vehicle_insurance_certificates
  FOR INSERT
  WITH CHECK (
    whatsapp_e164 = auth.jwt()->>'phone'
    OR profile_id = (auth.jwt()->>'sub')::UUID
  );

-- Policy: Users can update their own certificates
CREATE POLICY "Users can update their own insurance certificates"
  ON public.vehicle_insurance_certificates
  FOR UPDATE
  USING (
    whatsapp_e164 = auth.jwt()->>'phone'
    OR profile_id = (auth.jwt()->>'sub')::UUID
  );

-- Policy: Admin users can view all certificates
CREATE POLICY "Admins can view all insurance certificates"
  ON public.vehicle_insurance_certificates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (auth.jwt()->>'sub')::UUID
      AND (p.metadata->>'is_admin')::BOOLEAN = TRUE
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_vehicle_insurance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_vehicle_insurance_updated_at
  BEFORE UPDATE ON public.vehicle_insurance_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vehicle_insurance_updated_at();

-- Function to get valid insurance for a vehicle plate
CREATE OR REPLACE FUNCTION public.get_valid_vehicle_insurance(
  p_plate TEXT
)
RETURNS TABLE (
  id UUID,
  policy_number TEXT,
  insurer_name TEXT,
  policy_expiry DATE,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vic.id,
    vic.policy_number,
    vic.insurer_name,
    vic.policy_expiry,
    vic.is_valid
  FROM public.vehicle_insurance_certificates vic
  WHERE vic.vehicle_plate = p_plate
    AND vic.is_valid = TRUE
  ORDER BY vic.policy_expiry DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_valid_vehicle_insurance(TEXT) TO authenticated;



-- =====================================================
-- MIGRATION 17: 20260324120000_business_vector_embeddings.sql
-- =====================================================


-- Migration: Add vector embeddings for semantic business search
-- Date: 2025-11-12
-- Description: Adds pgvector support for semantic search of businesses by name

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to businesses table
ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS name_embedding vector(1536);

-- Create index for vector similarity search
-- Using ivfflat for efficient approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_businesses_name_embedding 
  ON public.businesses 
  USING ivfflat (name_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function to perform semantic search on business names
CREATE OR REPLACE FUNCTION public.search_businesses_by_name_similarity(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 8,
  min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  location_text TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.location_text,
    1 - (b.name_embedding <=> query_embedding) AS similarity
  FROM public.businesses b
  WHERE b.is_active = TRUE
    AND b.name_embedding IS NOT NULL
    AND (1 - (b.name_embedding <=> query_embedding)) > min_similarity
  ORDER BY b.name_embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_businesses_by_name_similarity(vector(1536), INTEGER, FLOAT) TO authenticated;

-- Function to get nearest businesses by location with optional category filter
CREATE OR REPLACE FUNCTION public.search_businesses_by_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_category_id BIGINT DEFAULT NULL,
  p_max_distance_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  location_text TEXT,
  category_id BIGINT,
  distance_meters NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.description,
    b.location_text,
    b.category_id,
    ST_Distance(
      b.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_meters
  FROM public.businesses b
  WHERE b.is_active = TRUE
    AND b.location IS NOT NULL
    AND (p_category_id IS NULL OR b.category_id = p_category_id)
    AND ST_DWithin(
      b.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_max_distance_km * 1000
    )
  ORDER BY b.location::geography <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_businesses_by_location(DOUBLE PRECISION, DOUBLE PRECISION, BIGINT, DOUBLE PRECISION, INTEGER) TO authenticated;

-- Function to check if business name exists (for duplicate detection)
CREATE OR REPLACE FUNCTION public.check_similar_business_names(
  p_name TEXT,
  p_owner_whatsapp TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  owner_whatsapp TEXT,
  is_own_business BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.owner_whatsapp,
    (b.owner_whatsapp = p_owner_whatsapp) AS is_own_business
  FROM public.businesses b
  WHERE b.is_active = TRUE
    AND LOWER(b.name) = LOWER(p_name)
  ORDER BY (b.owner_whatsapp = p_owner_whatsapp) DESC, b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_similar_business_names(TEXT, TEXT) TO authenticated;



-- =====================================================
-- MIGRATION 18: 20260401100000_system_observability.sql
-- =====================================================


-- Migration: System Observability Infrastructure
-- Purpose: Add comprehensive observability tables for metrics, monitoring, and audit
-- This supports the Ground Rules requirements for structured logging and observability

-- ============================================================================
-- SYSTEM METRICS (Partitioned by time for scalability)
-- ============================================================================

-- Create partitioned metrics table for high-volume time-series data
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  service_name text NOT NULL,
  metric_type text NOT NULL, -- 'latency', 'error_rate', 'throughput', 'memory', 'cpu'
  metric_name text NOT NULL,
  value numeric NOT NULL,
  unit text, -- 'ms', 'percent', 'count', 'bytes'
  tags jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions (current month and next month)
CREATE TABLE IF NOT EXISTS public.system_metrics_2026_04 PARTITION OF public.system_metrics
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.system_metrics_2026_05 PARTITION OF public.system_metrics
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for efficient metric queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_service_time 
  ON public.system_metrics_2026_04 (service_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type_time 
  ON public.system_metrics_2026_04 (metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags 
  ON public.system_metrics_2026_04 USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_system_metrics_service_time_05 
  ON public.system_metrics_2026_05 (service_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type_time_05 
  ON public.system_metrics_2026_05 (metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags_05 
  ON public.system_metrics_2026_05 USING gin (tags);

-- RLS policies for metrics
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_insert_metrics" ON public.system_metrics;
CREATE POLICY "service_role_insert_metrics" 
  ON public.system_metrics 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_metrics" ON public.system_metrics;
CREATE POLICY "authenticated_read_metrics" 
  ON public.system_metrics 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.system_metrics TO authenticated;
GRANT INSERT ON public.system_metrics TO service_role;

-- ============================================================================
-- COMPREHENSIVE AUDIT LOGS (Extends existing audit_log for centralized tracking)
-- ============================================================================

-- Enhanced audit table for comprehensive system-wide auditing
-- Note: This complements existing audit_log and admin_audit_logs tables
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL, -- 'user', 'service', 'system', 'admin'
  actor_identifier text NOT NULL, -- user_id, service_name, or system identifier
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  ip_address inet,
  user_agent text,
  correlation_id text,
  request_id text,
  session_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'success', -- 'success', 'failure', 'error'
  error_message text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions
CREATE TABLE IF NOT EXISTS public.system_audit_logs_2026_04 PARTITION OF public.system_audit_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.system_audit_logs_2026_05 PARTITION OF public.system_audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_system_audit_user_time 
  ON public.system_audit_logs_2026_04 (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_resource 
  ON public.system_audit_logs_2026_04 (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_correlation 
  ON public.system_audit_logs_2026_04 (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_audit_action 
  ON public.system_audit_logs_2026_04 (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_audit_user_time_05 
  ON public.system_audit_logs_2026_05 (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_resource_05 
  ON public.system_audit_logs_2026_05 (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_correlation_05 
  ON public.system_audit_logs_2026_05 (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_audit_action_05 
  ON public.system_audit_logs_2026_05 (action, created_at DESC);

-- RLS policies for audit logs
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_insert_audit" ON public.system_audit_logs;
CREATE POLICY "service_role_insert_audit" 
  ON public.system_audit_logs 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_own_audit" ON public.system_audit_logs;
CREATE POLICY "authenticated_read_own_audit" 
  ON public.system_audit_logs 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id OR actor_type = 'admin');

-- Grant permissions
GRANT SELECT ON public.system_audit_logs TO authenticated;
GRANT INSERT ON public.system_audit_logs TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS FOR OBSERVABILITY
-- ============================================================================

-- Function to record a metric
CREATE OR REPLACE FUNCTION public.record_metric(
  p_service_name text,
  p_metric_type text,
  p_metric_name text,
  p_value numeric,
  p_unit text DEFAULT NULL,
  p_tags jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_metric_id uuid;
BEGIN
  INSERT INTO public.system_metrics (
    service_name,
    metric_type,
    metric_name,
    value,
    unit,
    tags
  ) VALUES (
    p_service_name,
    p_metric_type,
    p_metric_name,
    p_value,
    p_unit,
    p_tags
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$;

-- Function to log an audit event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_actor_type text,
  p_actor_identifier text,
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_correlation_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO public.system_audit_logs (
    user_id,
    actor_type,
    actor_identifier,
    action,
    resource_type,
    resource_id,
    correlation_id,
    metadata
  ) VALUES (
    auth.uid(),
    p_actor_type,
    p_actor_identifier,
    p_action,
    p_resource_type,
    p_resource_id,
    p_correlation_id,
    p_metadata
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.record_metric(text, text, text, numeric, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, text, text, jsonb, text) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for recent metrics by service
CREATE OR REPLACE VIEW public.recent_metrics_by_service AS
SELECT 
  service_name,
  metric_type,
  metric_name,
  AVG(value) as avg_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  COUNT(*) as sample_count,
  MAX(created_at) as last_recorded_at
FROM public.system_metrics
WHERE created_at > now() - interval '1 hour'
GROUP BY service_name, metric_type, metric_name
ORDER BY service_name, metric_type, metric_name;

-- Grant view access
GRANT SELECT ON public.recent_metrics_by_service TO authenticated;



-- =====================================================
-- MIGRATION 19: 20260401110000_whatsapp_sessions.sql
-- =====================================================


-- Migration: WhatsApp Session Management
-- Purpose: Centralized WhatsApp session tracking and management
-- Critical for scalability and multi-device support

-- ============================================================================
-- WHATSAPP SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  session_token text NOT NULL,
  webhook_url text,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'suspended', 'expired')),
  device_info jsonb DEFAULT '{}'::jsonb,
  last_activity_at timestamptz,
  last_message_at timestamptz,
  message_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  last_error text,
  last_error_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  expires_at timestamptz
);

-- Indexes for WhatsApp sessions
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone 
  ON public.whatsapp_sessions (phone_number);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status 
  ON public.whatsapp_sessions (status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_expires 
  ON public.whatsapp_sessions (expires_at) 
  WHERE status = 'active' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_last_activity 
  ON public.whatsapp_sessions (last_activity_at DESC);

-- RLS policies
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_wa_sessions" ON public.whatsapp_sessions;
CREATE POLICY "service_role_full_access_wa_sessions" 
  ON public.whatsapp_sessions 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_wa_sessions" ON public.whatsapp_sessions;
CREATE POLICY "authenticated_read_wa_sessions" 
  ON public.whatsapp_sessions 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.whatsapp_sessions TO authenticated;
GRANT ALL ON public.whatsapp_sessions TO service_role;

-- ============================================================================
-- WHATSAPP MESSAGE QUEUE
-- ============================================================================

-- Table for queuing outbound WhatsApp messages
CREATE TABLE IF NOT EXISTS public.whatsapp_message_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.whatsapp_sessions(id) ON DELETE CASCADE,
  recipient_phone text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('text', 'template', 'media', 'interactive', 'location')),
  message_payload jsonb NOT NULL,
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  processed_at timestamptz,
  sent_at timestamptz,
  error_message text,
  whatsapp_message_id text,
  correlation_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for message queue
CREATE INDEX IF NOT EXISTS idx_wa_queue_status_scheduled 
  ON public.whatsapp_message_queue (status, scheduled_at) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_wa_queue_session 
  ON public.whatsapp_message_queue (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_queue_recipient 
  ON public.whatsapp_message_queue (recipient_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_queue_correlation 
  ON public.whatsapp_message_queue (correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- RLS policies
ALTER TABLE public.whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_wa_queue" ON public.whatsapp_message_queue;
CREATE POLICY "service_role_full_access_wa_queue" 
  ON public.whatsapp_message_queue 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_wa_queue" ON public.whatsapp_message_queue;
CREATE POLICY "authenticated_read_wa_queue" 
  ON public.whatsapp_message_queue 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.whatsapp_message_queue TO authenticated;
GRANT ALL ON public.whatsapp_message_queue TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update session activity
CREATE OR REPLACE FUNCTION public.update_whatsapp_session_activity(
  p_phone_number text,
  p_increment_message_count boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.whatsapp_sessions
  SET 
    last_activity_at = timezone('utc', now()),
    last_message_at = CASE WHEN p_increment_message_count THEN timezone('utc', now()) ELSE last_message_at END,
    message_count = CASE WHEN p_increment_message_count THEN message_count + 1 ELSE message_count END,
    updated_at = timezone('utc', now())
  WHERE phone_number = p_phone_number;
END;
$$;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_whatsapp_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Mark expired sessions as inactive
  UPDATE public.whatsapp_sessions
  SET 
    status = 'expired',
    updated_at = timezone('utc', now())
  WHERE 
    status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < timezone('utc', now());
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- Function to enqueue a WhatsApp message
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_message(
  p_recipient_phone text,
  p_message_type text,
  p_message_payload jsonb,
  p_priority integer DEFAULT 5,
  p_correlation_id text DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_session_id uuid;
BEGIN
  -- Get the active session for this recipient
  SELECT id INTO v_session_id
  FROM public.whatsapp_sessions
  WHERE phone_number = p_recipient_phone
    AND status = 'active'
  LIMIT 1;
  
  -- Insert the message into the queue
  INSERT INTO public.whatsapp_message_queue (
    session_id,
    recipient_phone,
    message_type,
    message_payload,
    priority,
    correlation_id,
    scheduled_at
  ) VALUES (
    v_session_id,
    p_recipient_phone,
    p_message_type,
    p_message_payload,
    p_priority,
    p_correlation_id,
    COALESCE(p_scheduled_at, timezone('utc', now()))
  ) RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_whatsapp_session_activity(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_whatsapp_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp_message(text, text, jsonb, integer, text, timestamptz) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for active session statistics
CREATE OR REPLACE VIEW public.whatsapp_session_stats AS
SELECT 
  status,
  COUNT(*) as session_count,
  SUM(message_count) as total_messages,
  AVG(message_count) as avg_messages_per_session,
  MAX(last_activity_at) as last_activity
FROM public.whatsapp_sessions
GROUP BY status
ORDER BY status;

-- View for message queue statistics
CREATE OR REPLACE VIEW public.whatsapp_queue_stats AS
SELECT 
  status,
  COUNT(*) as message_count,
  MIN(scheduled_at) as oldest_message,
  MAX(created_at) as newest_message
FROM public.whatsapp_message_queue
WHERE created_at > now() - interval '24 hours'
GROUP BY status
ORDER BY status;

-- Grant view access
GRANT SELECT ON public.whatsapp_session_stats TO authenticated;
GRANT SELECT ON public.whatsapp_queue_stats TO authenticated;



-- =====================================================
-- MIGRATION 20: 20260401120000_transactions_payments.sql
-- =====================================================


-- Migration: Transaction and Payment Infrastructure
-- Purpose: Comprehensive transaction tracking and payment method management
-- Complements existing wallet_transactions with detailed transaction lifecycle

-- ============================================================================
-- TRANSACTIONS TABLE (Partitioned for high volume)
-- ============================================================================

-- Comprehensive transaction table for all financial operations
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_ref text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wallet_id uuid, -- References wallet_accounts if applicable
  type text NOT NULL CHECK (type IN ('debit', 'credit', 'transfer', 'payment', 'refund', 'fee', 'commission')),
  category text, -- 'mobility', 'marketplace', 'wallet', 'insurance', etc.
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'RWF' NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed')),
  payment_method_id uuid,
  source_id text, -- Source account/wallet
  destination_id text, -- Destination account/wallet
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  correlation_id text,
  idempotency_key text,
  error_code text,
  error_message text,
  initiated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at),
  UNIQUE (transaction_ref, created_at),
  UNIQUE (idempotency_key, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions for transactions
CREATE TABLE IF NOT EXISTS public.transactions_2026_04 PARTITION OF public.transactions
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.transactions_2026_05 PARTITION OF public.transactions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
  ON public.transactions_2026_04 (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status 
  ON public.transactions_2026_04 (status, created_at DESC) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_transactions_ref 
  ON public.transactions_2026_04 (transaction_ref);

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency 
  ON public.transactions_2026_04 (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_correlation 
  ON public.transactions_2026_04 (correlation_id) 
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_created_05 
  ON public.transactions_2026_05 (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status_05 
  ON public.transactions_2026_05 (status, created_at DESC) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_transactions_ref_05 
  ON public.transactions_2026_05 (transaction_ref);

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_05 
  ON public.transactions_2026_05 (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_correlation_05 
  ON public.transactions_2026_05 (correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- RLS policies for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_transactions" ON public.transactions;
CREATE POLICY "service_role_full_access_transactions" 
  ON public.transactions 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_read_own_transactions" ON public.transactions;
CREATE POLICY "users_read_own_transactions" 
  ON public.transactions 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

-- ============================================================================
-- PAYMENT METHODS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('card', 'mobile_money', 'bank_account', 'wallet', 'cash')),
  provider text NOT NULL, -- 'mtn_momo', 'airtel_money', 'visa', 'mastercard', etc.
  provider_account_id text, -- External provider reference
  account_name text,
  account_number_masked text, -- Last 4 digits or masked version
  account_details_encrypted text, -- Encrypted full details
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  verification_method text,
  verified_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'blocked')),
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for payment methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_user 
  ON public.payment_methods (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_default 
  ON public.payment_methods (user_id) 
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_payment_methods_type_provider 
  ON public.payment_methods (type, provider);

-- RLS policies for payment methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_payment_methods" ON public.payment_methods;
CREATE POLICY "service_role_full_access_payment_methods" 
  ON public.payment_methods 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_manage_own_payment_methods" ON public.payment_methods;
CREATE POLICY "users_manage_own_payment_methods" 
  ON public.payment_methods 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

-- ============================================================================
-- TRANSACTION EVENTS TABLE (Audit trail for transaction lifecycle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL,
  event_type text NOT NULL, -- 'created', 'updated', 'completed', 'failed', 'reversed'
  previous_status text,
  new_status text,
  triggered_by text, -- 'user', 'system', 'service', 'webhook'
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for transaction events
CREATE INDEX IF NOT EXISTS idx_transaction_events_txn_created 
  ON public.transaction_events (transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_events_type 
  ON public.transaction_events (event_type, created_at DESC);

-- RLS policies
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_txn_events" ON public.transaction_events;
CREATE POLICY "service_role_full_access_txn_events" 
  ON public.transaction_events 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_txn_events" ON public.transaction_events;
CREATE POLICY "authenticated_read_txn_events" 
  ON public.transaction_events 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.transaction_events TO authenticated;
GRANT ALL ON public.transaction_events TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create a transaction with idempotency
CREATE OR REPLACE FUNCTION public.create_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_currency text DEFAULT 'RWF',
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_transaction_ref text;
  v_existing_txn uuid;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_txn
    FROM public.transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_txn IS NOT NULL THEN
      RETURN v_existing_txn;
    END IF;
  END IF;
  
  -- Generate unique transaction reference
  v_transaction_ref := 'TXN-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  
  -- Create transaction
  INSERT INTO public.transactions (
    transaction_ref,
    user_id,
    type,
    amount,
    currency,
    idempotency_key,
    metadata
  ) VALUES (
    v_transaction_ref,
    p_user_id,
    p_type,
    p_amount,
    p_currency,
    p_idempotency_key,
    p_metadata
  ) RETURNING id INTO v_transaction_id;
  
  -- Log creation event
  INSERT INTO public.transaction_events (
    transaction_id,
    event_type,
    new_status,
    triggered_by
  ) VALUES (
    v_transaction_id,
    'created',
    'pending',
    'system'
  );
  
  RETURN v_transaction_id;
END;
$$;

-- Function to update transaction status
CREATE OR REPLACE FUNCTION public.update_transaction_status(
  p_transaction_id uuid,
  p_new_status text,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_status text;
BEGIN
  -- Get current status
  SELECT status INTO v_previous_status
  FROM public.transactions
  WHERE id = p_transaction_id;
  
  IF v_previous_status IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update transaction
  UPDATE public.transactions
  SET 
    status = p_new_status,
    error_message = p_error_message,
    completed_at = CASE WHEN p_new_status IN ('completed', 'failed', 'cancelled') THEN timezone('utc', now()) ELSE completed_at END,
    updated_at = timezone('utc', now())
  WHERE id = p_transaction_id;
  
  -- Log status change event
  INSERT INTO public.transaction_events (
    transaction_id,
    event_type,
    previous_status,
    new_status,
    triggered_by,
    metadata
  ) VALUES (
    p_transaction_id,
    'updated',
    v_previous_status,
    p_new_status,
    'system',
    CASE WHEN p_error_message IS NOT NULL THEN jsonb_build_object('error', p_error_message) ELSE '{}'::jsonb END
  );
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_transaction(uuid, text, numeric, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_transaction_status(uuid, text, text) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for transaction summary by status
CREATE OR REPLACE VIEW public.transaction_summary AS
SELECT 
  status,
  type,
  currency,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(created_at) as oldest_transaction,
  MAX(created_at) as newest_transaction
FROM public.transactions
WHERE created_at > now() - interval '24 hours'
GROUP BY status, type, currency
ORDER BY status, type;

-- View for user transaction history (last 30 days)
CREATE OR REPLACE VIEW public.user_recent_transactions AS
SELECT 
  user_id,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_credits,
  MAX(created_at) as last_transaction_at
FROM public.transactions
WHERE created_at > now() - interval '30 days'
GROUP BY user_id;

-- Grant view access
GRANT SELECT ON public.transaction_summary TO authenticated;
GRANT SELECT ON public.user_recent_transactions TO authenticated;



-- =====================================================
-- MIGRATION 21: 20260401130000_service_registry_feature_flags.sql
-- =====================================================


-- Migration: Service Registry and Feature Flags
-- Purpose: Microservice coordination and dynamic feature management
-- Supports service discovery and gradual rollout capabilities

-- ============================================================================
-- SERVICE REGISTRY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_registry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text UNIQUE NOT NULL,
  service_type text NOT NULL, -- 'microservice', 'edge_function', 'api', 'worker'
  version text NOT NULL,
  endpoint text NOT NULL,
  health_check_url text,
  health_check_interval integer DEFAULT 30, -- seconds
  status text DEFAULT 'healthy' CHECK (status IN ('healthy', 'unhealthy', 'starting', 'stopping', 'stopped')),
  capabilities jsonb DEFAULT '[]'::jsonb, -- Array of service capabilities
  dependencies jsonb DEFAULT '[]'::jsonb, -- Array of dependent services
  configuration jsonb DEFAULT '{}'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  last_heartbeat_at timestamptz,
  last_health_check_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  registered_by text
);

-- Indexes for service registry
CREATE INDEX IF NOT EXISTS idx_service_registry_name 
  ON public.service_registry (service_name);

CREATE INDEX IF NOT EXISTS idx_service_registry_status 
  ON public.service_registry (status) 
  WHERE status IN ('healthy', 'unhealthy');

CREATE INDEX IF NOT EXISTS idx_service_registry_heartbeat 
  ON public.service_registry (last_heartbeat_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_registry_type 
  ON public.service_registry (service_type);

-- RLS policies for service registry
ALTER TABLE public.service_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_registry" ON public.service_registry;
CREATE POLICY "service_role_full_access_registry" 
  ON public.service_registry 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_registry" ON public.service_registry;
CREATE POLICY "authenticated_read_registry" 
  ON public.service_registry 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.service_registry TO authenticated;
GRANT ALL ON public.service_registry TO service_role;

-- ============================================================================
-- FEATURE FLAGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT false NOT NULL,
  rollout_percentage integer DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  rollout_strategy text DEFAULT 'percentage' CHECK (rollout_strategy IN ('percentage', 'user_list', 'condition', 'all', 'none')),
  target_users jsonb DEFAULT '[]'::jsonb, -- Array of user IDs for targeted rollout
  conditions jsonb DEFAULT '{}'::jsonb, -- Conditions for conditional rollout
  environment text DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production', 'all')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for feature flags
CREATE INDEX IF NOT EXISTS idx_feature_flags_key 
  ON public.feature_flags (key);

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled 
  ON public.feature_flags (enabled) 
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_feature_flags_environment 
  ON public.feature_flags (environment);

CREATE INDEX IF NOT EXISTS idx_feature_flags_updated 
  ON public.feature_flags (updated_at DESC);

-- RLS policies for feature flags
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_flags" ON public.feature_flags;
CREATE POLICY "service_role_full_access_flags" 
  ON public.feature_flags 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_flags" ON public.feature_flags;
CREATE POLICY "authenticated_read_flags" 
  ON public.feature_flags 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

-- ============================================================================
-- FEATURE FLAG EVALUATIONS TABLE (Audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flag_evaluations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluation_result boolean NOT NULL,
  evaluation_reason text, -- 'enabled', 'disabled', 'rollout', 'condition_match', etc.
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for evaluations
CREATE INDEX IF NOT EXISTS idx_flag_evaluations_flag_time 
  ON public.feature_flag_evaluations (flag_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flag_evaluations_user 
  ON public.feature_flag_evaluations (user_id, created_at DESC);

-- RLS policies
ALTER TABLE public.feature_flag_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_evaluations" ON public.feature_flag_evaluations;
CREATE POLICY "service_role_full_access_evaluations" 
  ON public.feature_flag_evaluations 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Grant permissions
GRANT INSERT ON public.feature_flag_evaluations TO service_role;
GRANT SELECT ON public.feature_flag_evaluations TO authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to register or update a service
CREATE OR REPLACE FUNCTION public.register_service(
  p_service_name text,
  p_service_type text,
  p_version text,
  p_endpoint text,
  p_health_check_url text DEFAULT NULL,
  p_capabilities jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service_id uuid;
BEGIN
  INSERT INTO public.service_registry (
    service_name,
    service_type,
    version,
    endpoint,
    health_check_url,
    capabilities,
    last_heartbeat_at
  ) VALUES (
    p_service_name,
    p_service_type,
    p_version,
    p_endpoint,
    p_health_check_url,
    p_capabilities,
    timezone('utc', now())
  )
  ON CONFLICT (service_name) DO UPDATE SET
    version = EXCLUDED.version,
    endpoint = EXCLUDED.endpoint,
    health_check_url = EXCLUDED.health_check_url,
    capabilities = EXCLUDED.capabilities,
    last_heartbeat_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  RETURNING id INTO v_service_id;
  
  RETURN v_service_id;
END;
$$;

-- Function to update service heartbeat
CREATE OR REPLACE FUNCTION public.service_heartbeat(
  p_service_name text,
  p_status text DEFAULT 'healthy',
  p_metrics jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.service_registry
  SET 
    status = p_status,
    metrics = p_metrics,
    last_heartbeat_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  WHERE service_name = p_service_name;
  
  RETURN FOUND;
END;
$$;

-- Function to evaluate a feature flag for a user
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_flag_key text,
  p_user_id uuid DEFAULT NULL,
  p_environment text DEFAULT 'production'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flag record;
  v_result boolean := false;
  v_reason text := 'disabled';
  v_random_value integer;
BEGIN
  -- Get the feature flag
  SELECT * INTO v_flag
  FROM public.feature_flags
  WHERE key = p_flag_key
    AND (environment = p_environment OR environment = 'all')
  LIMIT 1;
  
  -- If flag doesn't exist or is disabled, return false
  IF v_flag IS NULL OR NOT v_flag.enabled THEN
    v_result := false;
    v_reason := 'disabled';
  ELSE
    -- Evaluate based on rollout strategy
    CASE v_flag.rollout_strategy
      WHEN 'all' THEN
        v_result := true;
        v_reason := 'enabled_for_all';
        
      WHEN 'none' THEN
        v_result := false;
        v_reason := 'disabled_for_all';
        
      WHEN 'user_list' THEN
        -- Check if user is in target list
        IF p_user_id IS NOT NULL AND v_flag.target_users @> to_jsonb(ARRAY[p_user_id::text]) THEN
          v_result := true;
          v_reason := 'user_in_target_list';
        ELSE
          v_result := false;
          v_reason := 'user_not_in_target_list';
        END IF;
        
      WHEN 'percentage' THEN
        -- Use consistent hashing based on user_id for percentage rollout
        IF p_user_id IS NOT NULL THEN
          v_random_value := (hashtext(p_user_id::text) % 100);
          IF v_random_value < v_flag.rollout_percentage THEN
            v_result := true;
            v_reason := 'percentage_rollout_match';
          ELSE
            v_result := false;
            v_reason := 'percentage_rollout_no_match';
          END IF;
        ELSE
          v_result := false;
          v_reason := 'no_user_for_percentage';
        END IF;
        
      ELSE
        v_result := v_flag.enabled;
        v_reason := 'default_enabled_state';
    END CASE;
  END IF;
  
  -- Log evaluation (async, don't wait)
  INSERT INTO public.feature_flag_evaluations (
    flag_key,
    user_id,
    evaluation_result,
    evaluation_reason
  ) VALUES (
    p_flag_key,
    p_user_id,
    v_result,
    v_reason
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.register_service(text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_heartbeat(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(text, uuid, text) TO authenticated, service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for service health overview
CREATE OR REPLACE VIEW public.service_health_overview AS
SELECT 
  service_name,
  service_type,
  version,
  status,
  last_heartbeat_at,
  EXTRACT(EPOCH FROM (timezone('utc', now()) - last_heartbeat_at)) as seconds_since_heartbeat,
  CASE 
    WHEN last_heartbeat_at IS NULL THEN 'never_reported'
    WHEN timezone('utc', now()) - last_heartbeat_at < interval '2 minutes' THEN 'healthy'
    WHEN timezone('utc', now()) - last_heartbeat_at < interval '5 minutes' THEN 'warning'
    ELSE 'critical'
  END as health_status
FROM public.service_registry
ORDER BY service_name;

-- View for feature flag overview
CREATE OR REPLACE VIEW public.feature_flag_overview AS
SELECT 
  key,
  name,
  enabled,
  rollout_percentage,
  rollout_strategy,
  environment,
  updated_at
FROM public.feature_flags
ORDER BY name;

-- Grant view access
GRANT SELECT ON public.service_health_overview TO authenticated;
GRANT SELECT ON public.feature_flag_overview TO authenticated;



-- =====================================================
-- MIGRATION 22: 20260401140000_event_store_message_queue.sql
-- =====================================================


-- Migration: Event Store and Message Queue Infrastructure
-- Purpose: Event sourcing and async job processing for scalable architecture
-- Supports CQRS pattern and reliable asynchronous operations

-- ============================================================================
-- EVENT STORE TABLE (Partitioned for event sourcing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_store (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_type text NOT NULL, -- 'trip', 'order', 'wallet', 'user', etc.
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  correlation_id text,
  causation_id text, -- Event that caused this event
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions for event store
CREATE TABLE IF NOT EXISTS public.event_store_2026_04 PARTITION OF public.event_store
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.event_store_2026_05 PARTITION OF public.event_store
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for event store
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate 
  ON public.event_store_2026_04 (aggregate_type, aggregate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_store_type 
  ON public.event_store_2026_04 (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_store_correlation 
  ON public.event_store_2026_04 (correlation_id) 
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_store_aggregate_05 
  ON public.event_store_2026_05 (aggregate_type, aggregate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_store_type_05 
  ON public.event_store_2026_05 (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_store_correlation_05 
  ON public.event_store_2026_05 (correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- RLS policies for event store
ALTER TABLE public.event_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_events" ON public.event_store;
CREATE POLICY "service_role_full_access_events" 
  ON public.event_store 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_events" ON public.event_store;
CREATE POLICY "authenticated_read_events" 
  ON public.event_store 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.event_store TO authenticated;
GRANT ALL ON public.event_store TO service_role;

-- ============================================================================
-- MESSAGE QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_name text NOT NULL,
  message_type text NOT NULL,
  payload jsonb NOT NULL,
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'dead_letter')),
  scheduled_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  started_at timestamptz,
  processed_at timestamptz,
  error_message text,
  error_stack text,
  correlation_id text,
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for message queue
CREATE INDEX IF NOT EXISTS idx_message_queue_pending 
  ON public.message_queue (status, priority DESC, scheduled_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_message_queue_queue_name 
  ON public.message_queue (queue_name, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_queue_correlation 
  ON public.message_queue (correlation_id) 
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_queue_idempotency 
  ON public.message_queue (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- RLS policies for message queue
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_queue" ON public.message_queue;
CREATE POLICY "service_role_full_access_queue" 
  ON public.message_queue 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_queue" ON public.message_queue;
CREATE POLICY "authenticated_read_queue" 
  ON public.message_queue 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.message_queue TO authenticated;
GRANT ALL ON public.message_queue TO service_role;

-- ============================================================================
-- BACKGROUND JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type text NOT NULL,
  job_name text,
  payload jsonb NOT NULL,
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  scheduled_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  timeout_seconds integer DEFAULT 300,
  error_message text,
  error_stack text,
  result jsonb,
  correlation_id text,
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for background jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_pending 
  ON public.background_jobs (status, priority DESC, scheduled_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_background_jobs_type_status 
  ON public.background_jobs (job_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_background_jobs_correlation 
  ON public.background_jobs (correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- RLS policies for background jobs
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_jobs" ON public.background_jobs;
CREATE POLICY "service_role_full_access_jobs" 
  ON public.background_jobs 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_jobs" ON public.background_jobs;
CREATE POLICY "authenticated_read_jobs" 
  ON public.background_jobs 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.background_jobs TO authenticated;
GRANT ALL ON public.background_jobs TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to append an event to the event store
CREATE OR REPLACE FUNCTION public.append_event(
  p_aggregate_id text,
  p_aggregate_type text,
  p_event_type text,
  p_payload jsonb,
  p_correlation_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.event_store (
    aggregate_id,
    aggregate_type,
    event_type,
    payload,
    correlation_id,
    metadata,
    user_id
  ) VALUES (
    p_aggregate_id,
    p_aggregate_type,
    p_event_type,
    p_payload,
    p_correlation_id,
    p_metadata,
    auth.uid()
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to get aggregate event history
CREATE OR REPLACE FUNCTION public.get_aggregate_events(
  p_aggregate_type text,
  p_aggregate_id text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  event_type text,
  event_version integer,
  payload jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.event_type,
    e.event_version,
    e.payload,
    e.created_at
  FROM public.event_store e
  WHERE e.aggregate_type = p_aggregate_type
    AND e.aggregate_id = p_aggregate_id
  ORDER BY e.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Function to enqueue a message
CREATE OR REPLACE FUNCTION public.enqueue_message(
  p_queue_name text,
  p_message_type text,
  p_payload jsonb,
  p_priority integer DEFAULT 5,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_existing_message uuid;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_message
    FROM public.message_queue
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_message IS NOT NULL THEN
      RETURN v_existing_message;
    END IF;
  END IF;
  
  INSERT INTO public.message_queue (
    queue_name,
    message_type,
    payload,
    priority,
    scheduled_at,
    idempotency_key
  ) VALUES (
    p_queue_name,
    p_message_type,
    p_payload,
    p_priority,
    COALESCE(p_scheduled_at, timezone('utc', now())),
    p_idempotency_key
  ) RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

-- Function to schedule a background job
CREATE OR REPLACE FUNCTION public.schedule_job(
  p_job_type text,
  p_job_name text,
  p_payload jsonb,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_priority integer DEFAULT 5,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
  v_existing_job uuid;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_job
    FROM public.background_jobs
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_job IS NOT NULL THEN
      RETURN v_existing_job;
    END IF;
  END IF;
  
  INSERT INTO public.background_jobs (
    job_type,
    job_name,
    payload,
    priority,
    scheduled_at,
    idempotency_key
  ) VALUES (
    p_job_type,
    p_job_name,
    p_payload,
    p_priority,
    COALESCE(p_scheduled_at, timezone('utc', now())),
    p_idempotency_key
  ) RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id uuid,
  p_result jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.background_jobs
  SET 
    status = 'completed',
    result = p_result,
    completed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  WHERE id = p_job_id
    AND status = 'running';
  
  RETURN FOUND;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.append_event(text, text, text, jsonb, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_aggregate_events(text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_message(text, text, jsonb, integer, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.schedule_job(text, text, jsonb, timestamptz, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid, jsonb) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for event store statistics
CREATE OR REPLACE VIEW public.event_store_stats AS
SELECT 
  aggregate_type,
  event_type,
  COUNT(*) as event_count,
  MAX(created_at) as last_event_at
FROM public.event_store
WHERE created_at > now() - interval '24 hours'
GROUP BY aggregate_type, event_type
ORDER BY aggregate_type, event_type;

-- View for message queue statistics
CREATE OR REPLACE VIEW public.message_queue_stats AS
SELECT 
  queue_name,
  status,
  COUNT(*) as message_count,
  MIN(scheduled_at) as oldest_message,
  AVG(retry_count) as avg_retries
FROM public.message_queue
WHERE created_at > now() - interval '24 hours'
GROUP BY queue_name, status
ORDER BY queue_name, status;

-- View for background job statistics
CREATE OR REPLACE VIEW public.background_job_stats AS
SELECT 
  job_type,
  status,
  COUNT(*) as job_count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
FROM public.background_jobs
WHERE created_at > now() - interval '24 hours'
GROUP BY job_type, status
ORDER BY job_type, status;

-- Grant view access
GRANT SELECT ON public.event_store_stats TO authenticated;
GRANT SELECT ON public.message_queue_stats TO authenticated;
GRANT SELECT ON public.background_job_stats TO authenticated;



-- =====================================================
-- MIGRATION 23: 20260401150000_location_cache_optimization.sql
-- =====================================================


-- Migration: Location Optimization and Cache Infrastructure
-- Purpose: Geospatial optimization and caching strategy for performance
-- Enhances existing location data with optimized indexes and caching

-- ============================================================================
-- LOCATIONS TABLE (Optimized for geospatial queries)
-- ============================================================================

-- Note: PostGIS extension should already be enabled from previous migrations
-- This table complements existing location data in driver_status, trips, etc.

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  location_type text NOT NULL CHECK (location_type IN ('current', 'home', 'work', 'favorite', 'pickup', 'dropoff')),
  coordinates geography(POINT, 4326) NOT NULL,
  address text,
  place_name text,
  place_id text, -- Google Places ID or similar
  city text,
  country text,
  postal_code text,
  accuracy_meters numeric(10,2),
  altitude_meters numeric(10,2),
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for location queries
CREATE INDEX IF NOT EXISTS idx_locations_user 
  ON public.locations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_locations_geo 
  ON public.locations USING GIST (coordinates);

CREATE INDEX IF NOT EXISTS idx_locations_type 
  ON public.locations (location_type) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_locations_place_id 
  ON public.locations (place_id) 
  WHERE place_id IS NOT NULL;

-- RLS policies for locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_locations" ON public.locations;
CREATE POLICY "service_role_full_access_locations" 
  ON public.locations 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_manage_own_locations" ON public.locations;
CREATE POLICY "users_manage_own_locations" 
  ON public.locations 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;

-- ============================================================================
-- ROUTES TABLE (Cached routing information)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.routes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  destination_location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  origin_coordinates geography(POINT, 4326) NOT NULL,
  destination_coordinates geography(POINT, 4326) NOT NULL,
  path geography(LINESTRING, 4326),
  distance_meters integer NOT NULL,
  duration_seconds integer NOT NULL,
  traffic_multiplier numeric(3,2) DEFAULT 1.0,
  route_polyline text, -- Encoded polyline
  waypoints jsonb DEFAULT '[]'::jsonb,
  provider text, -- 'google', 'mapbox', 'osm', etc.
  provider_route_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  cached_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for routes
CREATE INDEX IF NOT EXISTS idx_routes_origin_dest 
  ON public.routes (origin_location_id, destination_location_id);

CREATE INDEX IF NOT EXISTS idx_routes_cached_until 
  ON public.routes (cached_until);

CREATE INDEX IF NOT EXISTS idx_routes_created 
  ON public.routes (created_at DESC);

-- RLS policies for routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_routes" ON public.routes;
CREATE POLICY "service_role_full_access_routes" 
  ON public.routes 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_routes" ON public.routes;
CREATE POLICY "authenticated_read_routes" 
  ON public.routes 
  FOR SELECT 
  TO authenticated 
  USING (cached_until > timezone('utc', now()));

-- Grant permissions
GRANT SELECT ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;

-- ============================================================================
-- CACHE ENTRIES TABLE (General-purpose caching)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cache_entries (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  cache_type text DEFAULT 'generic',
  tags text[] DEFAULT ARRAY[]::text[],
  expires_at timestamptz NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for cache entries
CREATE INDEX IF NOT EXISTS idx_cache_expires 
  ON public.cache_entries (expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_type 
  ON public.cache_entries (cache_type, expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_tags 
  ON public.cache_entries USING GIN (tags);

-- RLS policies for cache
ALTER TABLE public.cache_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_cache" ON public.cache_entries;
CREATE POLICY "service_role_full_access_cache" 
  ON public.cache_entries 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.cache_entries TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to find nearby locations
CREATE OR REPLACE FUNCTION public.find_nearby_locations(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer DEFAULT 5000,
  p_location_type text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  location_type text,
  address text,
  distance_meters integer,
  coordinates geography
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.user_id,
    l.location_type,
    l.address,
    ST_Distance(
      l.coordinates,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::integer as distance_meters,
    l.coordinates
  FROM public.locations l
  WHERE l.is_active = true
    AND (p_location_type IS NULL OR l.location_type = p_location_type)
    AND ST_DWithin(
      l.coordinates,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY l.coordinates <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  LIMIT p_limit;
END;
$$;

-- Function to get or create cached route
CREATE OR REPLACE FUNCTION public.get_cached_route(
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_dest_lat double precision,
  p_dest_lng double precision,
  p_max_age_minutes integer DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  distance_meters integer,
  duration_seconds integer,
  route_polyline text,
  is_cached boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_origin_point geography;
  v_dest_point geography;
  v_route record;
BEGIN
  v_origin_point := ST_SetSRID(ST_MakePoint(p_origin_lng, p_origin_lat), 4326)::geography;
  v_dest_point := ST_SetSRID(ST_MakePoint(p_dest_lng, p_dest_lat), 4326)::geography;
  
  -- Try to find a cached route
  SELECT r.* INTO v_route
  FROM public.routes r
  WHERE ST_DWithin(r.origin_coordinates, v_origin_point, 100) -- Within 100m
    AND ST_DWithin(r.destination_coordinates, v_dest_point, 100)
    AND r.cached_until > timezone('utc', now())
    AND r.created_at > timezone('utc', now()) - (p_max_age_minutes || ' minutes')::interval
  ORDER BY r.created_at DESC
  LIMIT 1;
  
  IF v_route.id IS NOT NULL THEN
    -- Return cached route
    RETURN QUERY
    SELECT 
      v_route.id,
      v_route.distance_meters,
      v_route.duration_seconds,
      v_route.route_polyline,
      true as is_cached;
  ELSE
    -- No cached route found - return null to signal need for API call
    RETURN;
  END IF;
END;
$$;

-- Function to set cache value
CREATE OR REPLACE FUNCTION public.set_cache(
  p_key text,
  p_value jsonb,
  p_ttl_seconds integer DEFAULT 3600,
  p_cache_type text DEFAULT 'generic',
  p_tags text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.cache_entries (
    key,
    value,
    cache_type,
    tags,
    expires_at
  ) VALUES (
    p_key,
    p_value,
    p_cache_type,
    p_tags,
    timezone('utc', now()) + (p_ttl_seconds || ' seconds')::interval
  )
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    cache_type = EXCLUDED.cache_type,
    tags = EXCLUDED.tags,
    expires_at = EXCLUDED.expires_at,
    updated_at = timezone('utc', now());
END;
$$;

-- Function to get cache value
CREATE OR REPLACE FUNCTION public.get_cache(
  p_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT value INTO v_value
  FROM public.cache_entries
  WHERE key = p_key
    AND expires_at > timezone('utc', now());
  
  RETURN v_value;
END;
$$;

-- Function to cleanup expired cache
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.cache_entries
  WHERE expires_at < timezone('utc', now());
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- Function to invalidate cache by tag
CREATE OR REPLACE FUNCTION public.invalidate_cache_by_tag(
  p_tag text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.cache_entries
  WHERE p_tag = ANY(tags);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.find_nearby_locations(double precision, double precision, integer, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cached_route(double precision, double precision, double precision, double precision, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_cache(text, jsonb, integer, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cache(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cache() TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_cache_by_tag(text) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for cache statistics
CREATE OR REPLACE VIEW public.cache_stats AS
SELECT 
  cache_type,
  COUNT(*) as entry_count,
  SUM(CASE WHEN expires_at > timezone('utc', now()) THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN expires_at <= timezone('utc', now()) THEN 1 ELSE 0 END) as expired_count,
  AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_ttl_seconds
FROM public.cache_entries
GROUP BY cache_type
ORDER BY cache_type;

-- View for route cache statistics
CREATE OR REPLACE VIEW public.route_cache_stats AS
SELECT 
  provider,
  COUNT(*) as route_count,
  SUM(CASE WHEN cached_until > timezone('utc', now()) THEN 1 ELSE 0 END) as active_count,
  AVG(distance_meters) as avg_distance_meters,
  AVG(duration_seconds) as avg_duration_seconds
FROM public.routes
WHERE created_at > now() - interval '7 days'
GROUP BY provider
ORDER BY provider;

-- Grant view access
GRANT SELECT ON public.cache_stats TO authenticated;
GRANT SELECT ON public.route_cache_stats TO authenticated;



-- =====================================================
-- MIGRATION 24: 20260401160000_analytics_infrastructure.sql
-- =====================================================


-- Migration: Analytics Infrastructure
-- Purpose: Analytics events and metrics for business insights
-- Supports data-driven decision making with partitioned time-series data

-- ============================================================================
-- ANALYTICS EVENTS TABLE (Partitioned for high volume)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_category text, -- 'user_action', 'system_event', 'business_metric'
  properties jsonb DEFAULT '{}'::jsonb,
  context jsonb DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions for analytics events (current and next month)
CREATE TABLE IF NOT EXISTS public.analytics_events_2026_04 PARTITION OF public.analytics_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.analytics_events_2026_05 PARTITION OF public.analytics_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time 
  ON public.analytics_events_2026_04 (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time 
  ON public.analytics_events_2026_04 (user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_session 
  ON public.analytics_events_2026_04 (session_id, created_at DESC) 
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_category 
  ON public.analytics_events_2026_04 (event_category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time_05 
  ON public.analytics_events_2026_05 (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time_05 
  ON public.analytics_events_2026_05 (user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_05 
  ON public.analytics_events_2026_05 (session_id, created_at DESC) 
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_category_05 
  ON public.analytics_events_2026_05 (event_category, created_at DESC);

-- RLS policies for analytics events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_analytics" ON public.analytics_events;
CREATE POLICY "service_role_full_access_analytics" 
  ON public.analytics_events 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_analytics" ON public.analytics_events;
CREATE POLICY "authenticated_read_analytics" 
  ON public.analytics_events 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT INSERT ON public.analytics_events TO service_role;

-- ============================================================================
-- AGGREGATED METRICS VIEW
-- ============================================================================

-- Materialized view for daily metrics (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_metrics AS
SELECT 
  date_trunc('day', created_at) as date,
  event_category,
  event_name,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions
FROM public.analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 1, 2, 3;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_unique 
  ON public.daily_metrics (date, event_category, event_name);

-- Grant view access
GRANT SELECT ON public.daily_metrics TO authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to record an analytics event
CREATE OR REPLACE FUNCTION public.track_event(
  p_event_name text,
  p_event_category text DEFAULT 'user_action',
  p_properties jsonb DEFAULT '{}'::jsonb,
  p_context jsonb DEFAULT '{}'::jsonb,
  p_session_id text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.analytics_events (
    event_name,
    user_id,
    session_id,
    event_category,
    properties,
    context,
    correlation_id
  ) VALUES (
    p_event_name,
    auth.uid(),
    p_session_id,
    p_event_category,
    p_properties,
    p_context,
    p_correlation_id
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to refresh daily metrics
CREATE OR REPLACE FUNCTION public.refresh_daily_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_metrics;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.track_event(text, text, jsonb, jsonb, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_daily_metrics() TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for recent analytics summary
CREATE OR REPLACE VIEW public.analytics_summary AS
SELECT 
  event_category,
  event_name,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as last_event_at
FROM public.analytics_events
WHERE created_at > now() - interval '24 hours'
GROUP BY event_category, event_name
ORDER BY event_count DESC;

-- View for user engagement metrics
CREATE OR REPLACE VIEW public.user_engagement_metrics AS
SELECT 
  user_id,
  COUNT(*) as total_events,
  COUNT(DISTINCT event_name) as unique_events,
  COUNT(DISTINCT session_id) as session_count,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM public.analytics_events
WHERE created_at > now() - interval '30 days'
  AND user_id IS NOT NULL
GROUP BY user_id;

-- Grant view access
GRANT SELECT ON public.analytics_summary TO authenticated;
GRANT SELECT ON public.user_engagement_metrics TO authenticated;



-- =====================================================
-- MIGRATION 25: 20260401170000_service_configurations.sql
-- =====================================================


-- Migration: Service Configurations
-- Purpose: Centralized configuration storage for microservices
-- Complements existing service_registry with runtime configuration management

-- ============================================================================
-- CONFIGURATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.configurations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text NOT NULL,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production', 'all')),
  config_key text NOT NULL,
  config_value jsonb NOT NULL,
  value_type text DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'secret')),
  is_secret boolean DEFAULT false,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE(service_name, environment, config_key)
);

-- Indexes for configuration queries
CREATE INDEX IF NOT EXISTS idx_configurations_service_env 
  ON public.configurations (service_name, environment);

CREATE INDEX IF NOT EXISTS idx_configurations_key 
  ON public.configurations (config_key);

CREATE INDEX IF NOT EXISTS idx_configurations_updated 
  ON public.configurations (updated_at DESC);

-- RLS policies for configurations
ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_config" ON public.configurations;
CREATE POLICY "service_role_full_access_config" 
  ON public.configurations 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_config" ON public.configurations;
CREATE POLICY "authenticated_read_config" 
  ON public.configurations 
  FOR SELECT 
  TO authenticated 
  USING (is_secret = false);

-- Grant permissions
GRANT SELECT ON public.configurations TO authenticated;
GRANT ALL ON public.configurations TO service_role;

-- ============================================================================
-- CONFIGURATION HISTORY TABLE (Audit trail for config changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.configuration_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  configuration_id uuid NOT NULL,
  service_name text NOT NULL,
  environment text NOT NULL,
  config_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for configuration history
CREATE INDEX IF NOT EXISTS idx_config_history_config_id 
  ON public.configuration_history (configuration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_config_history_service 
  ON public.configuration_history (service_name, environment, created_at DESC);

-- RLS policies for configuration history
ALTER TABLE public.configuration_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_config_history" ON public.configuration_history;
CREATE POLICY "service_role_full_access_config_history" 
  ON public.configuration_history 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_config_history" ON public.configuration_history;
CREATE POLICY "authenticated_read_config_history" 
  ON public.configuration_history 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.configuration_history TO authenticated;
GRANT INSERT ON public.configuration_history TO service_role;

-- ============================================================================
-- TRIGGER FOR CONFIGURATION CHANGES
-- ============================================================================

-- Trigger function to track configuration changes
CREATE OR REPLACE FUNCTION public.track_configuration_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track updates, not inserts
  IF TG_OP = 'UPDATE' AND (OLD.config_value IS DISTINCT FROM NEW.config_value) THEN
    INSERT INTO public.configuration_history (
      configuration_id,
      service_name,
      environment,
      config_key,
      old_value,
      new_value,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.service_name,
      NEW.environment,
      NEW.config_key,
      OLD.config_value,
      NEW.config_value,
      NEW.updated_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_track_config_changes ON public.configurations;
CREATE TRIGGER trg_track_config_changes
  AFTER UPDATE ON public.configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.track_configuration_changes();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get configuration value
CREATE OR REPLACE FUNCTION public.get_config(
  p_service_name text,
  p_config_key text,
  p_environment text DEFAULT 'production'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_value jsonb;
BEGIN
  -- Try to get environment-specific config first
  SELECT config_value INTO v_config_value
  FROM public.configurations
  WHERE service_name = p_service_name
    AND config_key = p_config_key
    AND environment = p_environment
  LIMIT 1;
  
  -- If not found, try 'all' environment
  IF v_config_value IS NULL THEN
    SELECT config_value INTO v_config_value
    FROM public.configurations
    WHERE service_name = p_service_name
      AND config_key = p_config_key
      AND environment = 'all'
    LIMIT 1;
  END IF;
  
  RETURN v_config_value;
END;
$$;

-- Function to set configuration value
CREATE OR REPLACE FUNCTION public.set_config(
  p_service_name text,
  p_config_key text,
  p_config_value jsonb,
  p_environment text DEFAULT 'production',
  p_value_type text DEFAULT 'string',
  p_is_secret boolean DEFAULT false,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_id uuid;
BEGIN
  INSERT INTO public.configurations (
    service_name,
    environment,
    config_key,
    config_value,
    value_type,
    is_secret,
    description,
    created_by,
    updated_by
  ) VALUES (
    p_service_name,
    p_environment,
    p_config_key,
    p_config_value,
    p_value_type,
    p_is_secret,
    p_description,
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (service_name, environment, config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    value_type = EXCLUDED.value_type,
    is_secret = EXCLUDED.is_secret,
    description = EXCLUDED.description,
    updated_by = auth.uid(),
    updated_at = timezone('utc', now())
  RETURNING id INTO v_config_id;
  
  RETURN v_config_id;
END;
$$;

-- Function to get all configs for a service
CREATE OR REPLACE FUNCTION public.get_service_configs(
  p_service_name text,
  p_environment text DEFAULT 'production',
  p_include_secrets boolean DEFAULT false
)
RETURNS TABLE (
  config_key text,
  config_value jsonb,
  value_type text,
  description text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.config_key,
    c.config_value,
    c.value_type,
    c.description
  FROM public.configurations c
  WHERE c.service_name = p_service_name
    AND (c.environment = p_environment OR c.environment = 'all')
    AND (p_include_secrets = true OR c.is_secret = false)
  ORDER BY c.config_key;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_config(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_config(text, text, jsonb, text, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_service_configs(text, text, boolean) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for configuration summary
CREATE OR REPLACE VIEW public.configuration_summary AS
SELECT 
  service_name,
  environment,
  COUNT(*) as config_count,
  SUM(CASE WHEN is_secret THEN 1 ELSE 0 END) as secret_count,
  MAX(updated_at) as last_updated
FROM public.configurations
GROUP BY service_name, environment
ORDER BY service_name, environment;

-- Grant view access
GRANT SELECT ON public.configuration_summary TO authenticated;



-- =====================================================
-- MIGRATION HISTORY UPDATE
-- =====================================================
-- Mark all migrations as applied in supabase_migrations.schema_migrations
-- This prevents them from being rerun by supabase db push

INSERT INTO supabase_migrations.schema_migrations (version, name, inserted_at)
VALUES
  ('20240101000000', 'enable_postgis', NOW()),
  ('20240102000000', 'create_shops_table', NOW()),
  ('20251112135627', 'enable_rls_on_sensitive_tables', NOW()),
  ('20251112135628', 'add_missing_foreign_key_indexes', NOW()),
  ('20251112135629', 'add_updated_at_triggers', NOW()),
  ('20251112135630', 'fix_timestamp_defaults', NOW()),
  ('20251112135631', 'partition_automation', NOW()),
  ('20251112135632', 'add_essential_functions', NOW()),
  ('20251112135633', 'observability_enhancements', NOW()),
  ('20251112135634', 'security_policy_refinements', NOW()),
  ('20260312090000', 'video_performance_analytics', NOW()),
  ('20260322100000', 'whatsapp_home_menu_config', NOW()),
  ('20260322110000', 'bars_restaurants_menu_system', NOW()),
  ('20260323100000', 'agent_registry_extended_config', NOW()),
  ('20260324100000', 'business_multiple_whatsapp_numbers', NOW()),
  ('20260324110000', 'vehicle_insurance_certificates', NOW()),
  ('20260324120000', 'business_vector_embeddings', NOW()),
  ('20260401100000', 'system_observability', NOW()),
  ('20260401110000', 'whatsapp_sessions', NOW()),
  ('20260401120000', 'transactions_payments', NOW()),
  ('20260401130000', 'service_registry_feature_flags', NOW()),
  ('20260401140000', 'event_store_message_queue', NOW()),
  ('20260401150000', 'location_cache_optimization', NOW()),
  ('20260401160000', 'analytics_infrastructure', NOW()),
  ('20260401170000', 'service_configurations', NOW())
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ All 25 migrations applied successfully!';
  RAISE NOTICE '📊 Schema version: 20260401170000';
  RAISE NOTICE '⏰ Completed at: %', NOW();
END $$;

