-- =====================================================
-- PHASE 3: FEATURE TABLES - Video, WhatsApp, Business Extensions
-- Migrations: Video Performance, WhatsApp Menu, Restaurant Menu, Agent Registry, Business Extensions
-- =====================================================

BEGIN;

-- =====================================================
-- MIGRATION 11: 20260312090000_video_performance_analytics.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.video_jobs (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid,
  slot text not null,
  template_id uuid,
  template_label text,
  hook_id uuid,
  hook_label text,
  cta_variant text,
  script_version text,
  renders integer default 0 not null,
  render_cost_cents integer default 0 not null,
  render_currency text default 'USD'::text not null,
  approvals_count integer default 0 not null,
  whatsapp_clicks integer default 0 not null,
  status text default 'draft'::text not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

CREATE INDEX IF NOT EXISTS video_jobs_slot_idx ON public.video_jobs(slot);
CREATE INDEX IF NOT EXISTS video_jobs_status_idx ON public.video_jobs(status);

CREATE TABLE IF NOT EXISTS public.video_approvals (
  id uuid default gen_random_uuid() primary key,
  job_id uuid not null references public.video_jobs(id) on delete cascade,
  reviewer_id uuid,
  status text default 'pending'::text not null check (status in ('pending','approved','changes_requested')),
  whatsapp_clicks integer default 0 not null,
  recorded_at timestamptz default timezone('utc', now()) not null,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

CREATE INDEX IF NOT EXISTS video_approvals_job_idx ON public.video_approvals(job_id);

-- =====================================================
-- MIGRATION 12: 20260322100000_whatsapp_home_menu_config.sql
-- =====================================================

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

CREATE INDEX IF NOT EXISTS idx_whatsapp_home_menu_active ON public.whatsapp_home_menu_items(is_active, display_order);

ALTER TABLE public.whatsapp_home_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read active menu items"
  ON public.whatsapp_home_menu_items
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- =====================================================
-- MIGRATION 13: 20260322110000_bars_restaurants_menu_system.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  is_available BOOLEAN DEFAULT true NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_bar ON public.restaurant_menu_items(bar_id, is_available);

ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read available menu items"
  ON public.restaurant_menu_items
  FOR SELECT
  TO authenticated, anon
  USING (is_available = true);

-- =====================================================
-- MIGRATION 14: 20260323100000_agent_registry_extended_config.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['en']::TEXT[],
  ADD COLUMN IF NOT EXISTS autonomy TEXT DEFAULT 'auto' CHECK (autonomy IN ('auto', 'suggest', 'handoff')),
  ADD COLUMN IF NOT EXISTS guardrails JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS instructions TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_registry_slug ON agent_registry(slug);

-- =====================================================
-- MIGRATION 15: 20260324100000_business_multiple_whatsapp_numbers.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.business_whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  whatsapp_e164 TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT business_whatsapp_unique UNIQUE (business_id, whatsapp_e164),
  CONSTRAINT valid_whatsapp_format CHECK (whatsapp_e164 ~ '^\+[1-9]\d{1,14}$')
);

CREATE INDEX IF NOT EXISTS idx_business_whatsapp_numbers_business_id 
  ON public.business_whatsapp_numbers(business_id);

ALTER TABLE public.business_whatsapp_numbers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- MIGRATION 16: 20260324110000_vehicle_insurance_certificates.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.vehicle_insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  whatsapp_e164 TEXT NOT NULL,
  vehicle_plate TEXT,
  policy_number TEXT,
  policy_expiry DATE NOT NULL,
  is_valid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_profile_id 
  ON public.vehicle_insurance_certificates(profile_id);

ALTER TABLE public.vehicle_insurance_certificates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- MIGRATION 17: 20260324120000_business_vector_embeddings.sql
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS name_embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_businesses_name_embedding 
  ON public.businesses 
  USING ivfflat (name_embedding vector_cosine_ops)
  WITH (lists = 100);

COMMIT;

-- Mark migrations as applied
INSERT INTO supabase_migrations.schema_migrations (version, name, inserted_at)
VALUES
  ('20260312090000', 'video_performance_analytics', NOW()),
  ('20260322100000', 'whatsapp_home_menu_config', NOW()),
  ('20260322110000', 'bars_restaurants_menu_system', NOW()),
  ('20260323100000', 'agent_registry_extended_config', NOW()),
  ('20260324100000', 'business_multiple_whatsapp_numbers', NOW()),
  ('20260324110000', 'vehicle_insurance_certificates', NOW()),
  ('20260324120000', 'business_vector_embeddings', NOW())
ON CONFLICT (version) DO NOTHING;
