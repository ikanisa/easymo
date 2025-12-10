-- =====================================================
-- PHASE 1: Foundation & Core Infrastructure
-- =====================================================
-- This phase establishes foundational tables and extensions
-- Safe to run first, no dependencies on other migrations
-- Estimated time: 2-3 minutes
-- =====================================================

BEGIN;

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create shops table (bootstrap for other features)
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

-- Enable RLS on sensitive tables
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
END $$;

-- Add missing foreign key indexes for performance
DO $$
BEGIN
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
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
  END IF;
END $$;

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix timestamp defaults
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'created_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_settings' AND column_name = 'updated_at') THEN
    ALTER TABLE public.client_settings ALTER COLUMN updated_at SET DEFAULT NOW();
  END IF;
END $$;

COMMIT;
