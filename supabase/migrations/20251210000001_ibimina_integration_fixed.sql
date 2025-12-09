-- Ibimina SACCO Platform Schema Integration
-- Merged from ibimina repository on 2025-12-09
-- This migration adds all vendor-portal (ibimina) tables and functions
-- 
-- CRITICAL: This combines 119 migrations from ibimina into a single baseline
-- All migrations are wrapped in BEGIN/COMMIT as per GROUND_RULES.md

BEGIN;


-- From: 00000000000000_bootstrap.sql

-- Supabase bootstrap schema for ICUPA Phase 0
-- Enables required extensions and creates foundational tables used across the diner shell.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.tenants (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    region text not null check (region in ('RW','EU')),
    created_at timestamptz not null default now()
);

create table if not exists public.locations (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    currency char(3) not null,
    timezone text not null,
    region text not null check (region in ('RW','EU')),
    created_at timestamptz not null default now()
);

create table if not exists public.items (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid not null references public.locations(id) on delete cascade,
    name text not null,
    description text,
    price_cents integer not null,
    currency char(3) not null,
    allergens text[] not null default '{}',
    tags text[] not null default '{}',
    created_at timestamptz not null default now()
);

create table if not exists public.orders (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    location_id uuid not null references public.locations(id) on delete cascade,
    status text not null default 'draft',
    subtotal_cents integer not null default 0,
    total_cents integer not null default 0,
    currency char(3) not null,
    created_at timestamptz not null default now()
);

create table if not exists public.agent_events (
    id uuid primary key default uuid_generate_v4(),
    agent_type text not null,
    session_id uuid,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- Helpful indexes for local testing
create index if not exists idx_locations_tenant on public.locations(tenant_id);
create index if not exists idx_items_location on public.items(location_id);
create index if not exists idx_orders_location on public.orders(location_id);


-- From: 20250103_qr_auth_tables.sql

-- Database migration for QR authentication tables

-- Create auth_qr_sessions table
CREATE TABLE IF NOT EXISTS auth_qr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  challenge TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'authenticated', 'expired', 'cancelled')),
  staff_id UUID REFERENCES auth.users(id),
  device_id TEXT,
  web_access_token TEXT,
  web_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  biometric_verified BOOLEAN DEFAULT FALSE,
  browser_fingerprint TEXT,
  ip_address TEXT,
  signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  authenticated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_auth_qr_sessions_session_id ON auth_qr_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_auth_qr_sessions_status ON auth_qr_sessions(status);
CREATE INDEX IF NOT EXISTS idx_auth_qr_sessions_staff_id ON auth_qr_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_auth_qr_sessions_expires_at ON auth_qr_sessions(expires_at);

-- Create staff_devices table for registered devices
CREATE TABLE IF NOT EXISTS staff_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  push_token TEXT,
  biometric_enabled BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for devices
CREATE INDEX IF NOT EXISTS idx_staff_devices_device_id ON staff_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_staff_devices_staff_id ON staff_devices(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_devices_status ON staff_devices(status);

-- Create auth_logs table for audit trail
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  device_id TEXT,
  session_id TEXT,
  biometric_used BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  browser_fingerprint TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for auth logs
CREATE INDEX IF NOT EXISTS idx_auth_logs_staff_id ON auth_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event_type ON auth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE auth_qr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auth_qr_sessions
-- Anyone can create a session (for web login)
CREATE POLICY "Anyone can create QR session"
  ON auth_qr_sessions
  FOR INSERT
  WITH CHECK (TRUE);

-- Only allow reading own sessions
CREATE POLICY "Users can read own sessions"
  ON auth_qr_sessions
  FOR SELECT
  USING (
    staff_id = auth.uid() OR
    staff_id IS NULL -- Allow reading pending sessions
  );

-- Only allow updating own sessions
CREATE POLICY "Users can update own sessions"
  ON auth_qr_sessions
  FOR UPDATE
  USING (staff_id = auth.uid() OR staff_id IS NULL);

-- RLS Policies for staff_devices
CREATE POLICY "Staff can view own devices"
  ON staff_devices
  FOR SELECT
  USING (staff_id = auth.uid());

CREATE POLICY "Staff can register devices"
  ON staff_devices
  FOR INSERT
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff can update own devices"
  ON staff_devices
  FOR UPDATE
  USING (staff_id = auth.uid());

-- RLS Policies for auth_logs
CREATE POLICY "Staff can view own logs"
  ON auth_logs
  FOR SELECT
  USING (staff_id = auth.uid());

CREATE POLICY "Service role can insert logs"
  ON auth_logs
  FOR INSERT
  WITH CHECK (TRUE);

-- Function to cleanup expired sessions (runs every 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_qr_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth_qr_sessions
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
  
  -- Delete sessions older than 24 hours
  DELETE FROM auth_qr_sessions
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Schedule cleanup job with pg_cron (if available)
-- SELECT cron.schedule('cleanup-expired-qr-sessions', '*/10 * * * *', 'SELECT cleanup_expired_qr_sessions()');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for staff_devices
CREATE TRIGGER update_staff_devices_updated_at
  BEFORE UPDATE ON staff_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON auth_qr_sessions TO anon, authenticated, service_role;
GRANT ALL ON staff_devices TO authenticated, service_role;
GRANT ALL ON auth_logs TO authenticated, service_role;


-- From: 20250104_push_tokens.sql

-- Push notification tokens table
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform)
);

-- Index for efficient lookups
create index if not exists push_tokens_user_id_idx on push_tokens(user_id);
create index if not exists push_tokens_token_idx on push_tokens(token);

-- RLS policies
alter table push_tokens enable row level security;

-- Users can manage their own push tokens
create policy "Users can insert their own push tokens"
  on push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own push tokens"
  on push_tokens for select
  using (auth.uid() = user_id);

create policy "Users can update their own push tokens"
  on push_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
  on push_tokens for delete
  using (auth.uid() = user_id);

-- Service role can manage all tokens (for admin purposes)
create policy "Service role can manage all push tokens"
  on push_tokens for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- Function to update updated_at timestamp
create or replace function update_push_tokens_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger push_tokens_updated_at
  before update on push_tokens
  for each row
  execute function update_push_tokens_updated_at();

-- Grant permissions
grant usage on schema public to authenticated;
grant all on push_tokens to authenticated;
grant all on push_tokens to service_role;


-- From: 20250201090000_config_ussd_templates.sql

create schema if not exists config;

grant usage on schema config to authenticated;
grant usage on schema config to service_role;
grant usage on schema config to supabase_admin;

create table if not exists config.ussd_templates (
  operator_id text primary key,
  version text not null,
  ttl_seconds integer not null check (ttl_seconds > 0),
  payload jsonb not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  metadata jsonb
);

comment on table config.ussd_templates is 'Mobile money USSD templates with versioning and TTL for OTA refreshes';
comment on column config.ussd_templates.operator_id is 'Unique operator identifier (e.g., mtn-rw)';
comment on column config.ussd_templates.payload is 'Raw template payload mirroring packages/config/ussd.json structure';
comment on column config.ussd_templates.ttl_seconds is 'Suggested cache TTL for this operator in seconds';
comment on column config.ussd_templates.version is 'Semantic version or date tag for the template payload';
comment on column config.ussd_templates.metadata is 'Optional metadata for auditing/template provenance';

alter table config.ussd_templates enable row level security;

grant select on config.ussd_templates to authenticated;
grant select on config.ussd_templates to service_role;
grant select on config.ussd_templates to supabase_admin;

create policy "Authenticated read USSD templates" on config.ussd_templates
  for select
  using (auth.role() in ('authenticated', 'service_role', 'supabase_admin'));

insert into config.ussd_templates (operator_id, version, ttl_seconds, payload, metadata)
values
  (
    'mtn-rw',
    '2025-01-15',
    86400,
    jsonb_build_object(
      'id', 'mtn-rw',
      'name', 'MTN MoMo',
      'network', 'MTN',
      'country', 'RW',
      'currency', 'RWF',
      'supportsAutoDial', true,
      'default', true,
      'shortcode', '*182#',
      'templates', jsonb_build_object(
        'shortcut', '*182*8*1*{MERCHANT}*{AMOUNT}#',
        'menu', '*182*8*1*{MERCHANT}#',
        'base', '*182#'
      ),
      'placeholders', jsonb_build_object(
        'merchant', '{MERCHANT}',
        'amount', '{AMOUNT}',
        'reference', '{REFERENCE}'
      ),
      'locales', jsonb_build_object(
        'en-RW', jsonb_build_object(
          'copy', 'Dial {code} to pay {amount} with reference {reference}.',
          'cta', 'Tap to dial',
          'instructions', jsonb_build_array(
            'Ensure you have sufficient balance before dialing.',
            'Dial {code} and follow the prompts to confirm the payment.',
            'Enter the reference {reference} when prompted.'
          )
        ),
        'rw-RW', jsonb_build_object(
          'copy', 'Hamagara {code} wishyure {amount} ukoresheje indangamubare {reference}.',
          'cta', 'Kanda uhageze',
          'instructions', jsonb_build_array(
            'Reba ko ufite amafaranga ahagije kuri konti yawe ya MoMo.',
            'Hamagara {code} hanyuma ukurikize amabwiriza kuri telefoni.',
            'Shyiramo indangamubare {reference} igihe bayigusabye.'
          )
        ),
        'fr-RW', jsonb_build_object(
          'copy', 'Composez {code} pour payer {amount} avec la référence {reference}.',
          'cta', 'Appuyer pour appeler',
          'instructions', jsonb_build_array(
            'Vérifiez votre solde avant de composer le code.',
            'Composez {code} et suivez les instructions pour confirmer le paiement.',
            'Saisissez la référence {reference} lorsque demandé.'
          )
        )
      )
    ),
    jsonb_build_object('source', 'packages/config/ussd.json')
  ),
  (
    'airtel-rw',
    '2025-01-15',
    86400,
    jsonb_build_object(
      'id', 'airtel-rw',
      'name', 'Airtel Money',
      'network', 'Airtel',
      'country', 'RW',
      'currency', 'RWF',
      'supportsAutoDial', true,
      'default', false,
      'shortcode', '*500#',
      'templates', jsonb_build_object(
        'shortcut', '*500*1*3*{MERCHANT}*{AMOUNT}#',
        'menu', '*500*1*3*{MERCHANT}#',
        'base', '*500#'
      ),
      'placeholders', jsonb_build_object(
        'merchant', '{MERCHANT}',
        'amount', '{AMOUNT}',
        'reference', '{REFERENCE}'
      ),
      'locales', jsonb_build_object(
        'en-RW', jsonb_build_object(
          'copy', 'Dial {code} to pay {amount} with reference {reference}.',
          'cta', 'Tap to dial',
          'instructions', jsonb_build_array(
            'Make sure your Airtel Money wallet has enough balance.',
            'Dial {code} and approve the transaction.',
            'Provide reference {reference} if requested.'
          )
        ),
        'rw-RW', jsonb_build_object(
          'copy', 'Hamagara {code} wishyure {amount} ukoresheje indangamubare {reference}.',
          'cta', 'Kanda uhageze',
          'instructions', jsonb_build_array(
            'Menya neza ko ufite amafaranga kuri Airtel Money.',
            'Hamagara {code} hanyuma wemere ubwishyu.',
            'Uzabwire indangamubare {reference} niba basabye.'
          )
        ),
        'fr-RW', jsonb_build_object(
          'copy', 'Composez {code} pour payer {amount} avec la référence {reference}.',
          'cta', 'Appuyer pour appeler',
          'instructions', jsonb_build_array(
            'Assurez-vous d''avoir assez de solde Airtel Money.',
            'Composez {code} puis validez le paiement.',
            'Donnez la référence {reference} si nécessaire.'
          )
        )
      )
    ),
    jsonb_build_object('source', 'packages/config/ussd.json')
  )
on conflict (operator_id) do update
  set version = excluded.version,
      ttl_seconds = excluded.ttl_seconds,
      payload = excluded.payload,
      metadata = excluded.metadata,
      is_active = true,
      updated_at = now();


-- From: 20250203120000_metrics_anomaly_samples.sql

-- Helper function for role checking using org_memberships
CREATE OR REPLACE FUNCTION public.has_admin_role(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if user has admin role in any organization
  RETURN EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE user_id = p_user_id 
      AND role IN ('ADMIN', 'OWNER', 'SYSTEM_ADMIN')
      AND status = 'ACTIVE'
  );
END;
$$;

COMMENT ON FUNCTION public.has_admin_role(uuid) IS 'Check if user has admin privileges via org_memberships';

create table if not exists public.system_metric_samples (
  id bigserial primary key,
  event text not null,
  total bigint not null default 0,
  collected_at timestamptz not null default now()
);

create index if not exists idx_system_metric_samples_event_time
  on public.system_metric_samples (event, collected_at desc);

alter table public.system_metric_samples enable row level security;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Admins can view metric samples" ON public.system_metric_samples;
DROP POLICY IF EXISTS "Admins can manage metric samples" ON public.system_metric_samples;

-- Create new policies using the fixed function
create policy "Admins can view metric samples"
  on public.system_metric_samples for select
  using (public.has_admin_role(auth.uid()));

create policy "Admins can manage metric samples"
  on public.system_metric_samples for all
  using (public.has_admin_role(auth.uid()))
  with check (public.has_admin_role(auth.uid()));

-- Grant permissions
GRANT SELECT ON public.system_metric_samples TO authenticated;
GRANT ALL ON public.system_metric_samples TO service_role;

COMMENT ON TABLE public.system_metric_samples IS 'System-wide metric samples for anomaly detection and monitoring';


-- From: 20251007111647_0ad74d87-9b06-4a13-b252-8ecd3533e366.sql

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('SYSTEM_ADMIN', 'SACCO_MANAGER', 'SACCO_STAFF');
-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'SACCO_STAFF',
  sacco_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create SACCOs table
CREATE TABLE IF NOT EXISTS public.saccos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  sector_code TEXT NOT NULL,
  merchant_code TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create Ibimina table
CREATE TABLE IF NOT EXISTS public.ibimina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES public.saccos(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create Ikimina Members table
CREATE TABLE IF NOT EXISTS public.ikimina_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ikimina_id UUID NOT NULL REFERENCES public.ibimina(id) ON DELETE CASCADE,
  member_code TEXT,
  full_name TEXT NOT NULL,
  national_id TEXT,
  msisdn TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create SMS Inbox table
CREATE TABLE IF NOT EXISTS public.sms_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID REFERENCES public.saccos(id),
  raw_text TEXT NOT NULL,
  msisdn TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  vendor_meta JSONB,
  parsed_json JSONB,
  parse_source TEXT,
  confidence FLOAT,
  status TEXT NOT NULL DEFAULT 'NEW',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'SMS',
  sacco_id UUID NOT NULL REFERENCES public.saccos(id),
  ikimina_id UUID REFERENCES public.ibimina(id),
  member_id UUID REFERENCES public.ikimina_members(id),
  msisdn TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  txn_id TEXT NOT NULL,
  reference TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  source_id UUID REFERENCES public.sms_inbox(id),
  ai_version TEXT,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create Accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create Ledger Entries table
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_id UUID NOT NULL REFERENCES public.accounts(id),
  credit_id UUID NOT NULL REFERENCES public.accounts(id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  value_date TIMESTAMPTZ NOT NULL,
  external_id TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create Audit Log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  diff_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add foreign key for users.sacco_id
ALTER TABLE public.users 
  ADD CONSTRAINT users_sacco_id_fkey 
  FOREIGN KEY (sacco_id) REFERENCES public.saccos(id) ON DELETE SET NULL;
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saccos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibimina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ikimina_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id AND role = _role
  )
$$;
-- Create security definer function to get user's SACCO
CREATE OR REPLACE FUNCTION public.get_user_sacco(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sacco_id FROM public.users WHERE id = _user_id
$$;
-- RLS Policies for users table
CREATE POLICY "Users can view their own record"
  ON public.users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "System admins can view all users"
  ON public.users FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
CREATE POLICY "System admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
CREATE POLICY "System admins can update users"
  ON public.users FOR UPDATE
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
-- RLS Policies for saccos table
CREATE POLICY "System admins can view all SACCOs"
  ON public.saccos FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
CREATE POLICY "SACCO staff can view their SACCO"
  ON public.saccos FOR SELECT
  USING (id = public.get_user_sacco(auth.uid()));
CREATE POLICY "System admins can manage SACCOs"
  ON public.saccos FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
-- RLS Policies for ibimina table
CREATE POLICY "Users can view ibimina in their SACCO"
  ON public.ibimina FOR SELECT
  USING (sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
CREATE POLICY "SACCO staff can manage ibimina in their SACCO"
  ON public.ibimina FOR ALL
  USING (sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
-- RLS Policies for ikimina_members table
CREATE POLICY "Users can view members in their SACCO's ibimina"
  ON public.ikimina_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ibimina
      WHERE ibimina.id = ikimina_members.ikimina_id
      AND (ibimina.sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
    )
  );
CREATE POLICY "SACCO staff can manage members in their SACCO's ibimina"
  ON public.ikimina_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.ibimina
      WHERE ibimina.id = ikimina_members.ikimina_id
      AND (ibimina.sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
    )
  );
-- RLS Policies for sms_inbox table
CREATE POLICY "Users can view SMS in their SACCO"
  ON public.sms_inbox FOR SELECT
  USING (sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
CREATE POLICY "SACCO staff can manage SMS in their SACCO"
  ON public.sms_inbox FOR ALL
  USING (sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
-- RLS Policies for payments table
CREATE POLICY "Users can view payments in their SACCO"
  ON public.payments FOR SELECT
  USING (sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
CREATE POLICY "SACCO staff can manage payments in their SACCO"
  ON public.payments FOR ALL
  USING (sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
-- RLS Policies for accounts table
CREATE POLICY "Users can view accounts in their SACCO"
  ON public.accounts FOR SELECT
  USING (
    owner_type = 'IKIMINA' AND EXISTS (
      SELECT 1 FROM public.ibimina
      WHERE ibimina.id = accounts.owner_id::UUID
      AND (ibimina.sacco_id = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
    )
    OR owner_type = 'SACCO' AND (owner_id::UUID = public.get_user_sacco(auth.uid()) OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
    OR public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  );
CREATE POLICY "SACCO staff can manage accounts in their SACCO"
  ON public.accounts FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
-- RLS Policies for ledger_entries table
CREATE POLICY "Users can view ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (true);
CREATE POLICY "System admins can manage ledger entries"
  ON public.ledger_entries FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
-- RLS Policies for audit_logs table
CREATE POLICY "Users can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN') OR actor_id = auth.uid());
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);
-- Create trigger for user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'SACCO_STAFF'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ibimina_sacco_id ON public.ibimina(sacco_id);
CREATE INDEX IF NOT EXISTS idx_ikimina_members_ikimina_id ON public.ikimina_members(ikimina_id);
CREATE INDEX IF NOT EXISTS idx_ikimina_members_msisdn ON public.ikimina_members(msisdn);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_status ON public.sms_inbox(status);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_received_at ON public.sms_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_sacco_id ON public.payments(sacco_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_txn_id ON public.payments(txn_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_external_id ON public.ledger_entries(external_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
-- Field level encryption columns for sensitive data
ALTER TABLE public.ikimina_members
  ADD COLUMN IF NOT EXISTS msisdn_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS msisdn_masked TEXT,
  ADD COLUMN IF NOT EXISTS msisdn_hash TEXT,
  ADD COLUMN IF NOT EXISTS national_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS national_id_masked TEXT,
  ADD COLUMN IF NOT EXISTS national_id_hash TEXT;
ALTER TABLE public.sms_inbox
  ADD COLUMN IF NOT EXISTS msisdn_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS msisdn_masked TEXT,
  ADD COLUMN IF NOT EXISTS msisdn_hash TEXT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS msisdn_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS msisdn_masked TEXT,
  ADD COLUMN IF NOT EXISTS msisdn_hash TEXT;
-- Ensure audit logs can be written without explicit actor (system generated)
ALTER TABLE public.audit_logs
  ALTER COLUMN actor_id SET DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;
-- Rate limiting support
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  window_expires TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  key TEXT,
  max_hits INTEGER,
  window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  existing RECORD;
BEGIN
  SELECT * INTO existing FROM public.rate_limit_counters WHERE public.rate_limit_counters.key = consume_rate_limit.key;

  IF existing.key IS NULL OR existing.window_expires < NOW() THEN
    INSERT INTO public.rate_limit_counters(key, hits, window_expires)
    VALUES (consume_rate_limit.key, 1, NOW() + make_interval(secs => GREATEST(window_seconds, 1)))
    ON CONFLICT (key) DO UPDATE
      SET hits = EXCLUDED.hits,
          window_expires = EXCLUDED.window_expires;
    RETURN TRUE;
  END IF;

  IF existing.hits >= max_hits THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limit_counters
    SET hits = existing.hits + 1
  WHERE key = consume_rate_limit.key;

  RETURN TRUE;
END;
$$;
-- Metrics aggregation
CREATE TABLE IF NOT EXISTS public.system_metrics (
  event TEXT PRIMARY KEY,
  total BIGINT NOT NULL DEFAULT 0,
  last_occurred TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'::jsonb
);
CREATE OR REPLACE FUNCTION public.increment_metric(
  event_name TEXT,
  delta INTEGER,
  meta JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.system_metrics(event, total, last_occurred, meta)
  VALUES (event_name, delta, NOW(), COALESCE(meta, '{}'::jsonb))
  ON CONFLICT (event) DO UPDATE
    SET total = public.system_metrics.total + GREATEST(delta, 0),
        last_occurred = NOW(),
        meta = CASE
          WHEN meta = '{}'::jsonb THEN public.system_metrics.meta
          ELSE meta
        END;
END;
$$;
-- Notification queue for automation hooks
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  payment_id UUID,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_queue_payment ON public.notification_queue(payment_id) WHERE payment_id IS NOT NULL;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage notification queue"
  ON public.notification_queue FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
-- Indexes to support encrypted lookup patterns
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ikimina_members_msisdn_hash ON public.ikimina_members(msisdn_hash);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ikimina_members_national_id_hash ON public.ikimina_members(national_id_hash);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payments_msisdn_hash ON public.payments(msisdn_hash);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sms_inbox_msisdn_hash ON public.sms_inbox(msisdn_hash);
-- Seed masked values for existing rows
UPDATE public.ikimina_members
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;
UPDATE public.payments
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;
UPDATE public.sms_inbox
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view metrics"
  ON public.system_metrics FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
CREATE POLICY "Admins can manage metrics"
  ON public.system_metrics FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));


-- From: 20251007162733_2795ee87-5113-4ac4-bf60-4c94e6a9b4d3.sql

-- Drop duplicate encryption columns if they exist
ALTER TABLE public.ikimina_members
  DROP COLUMN IF EXISTS msisdn_encrypted,
  DROP COLUMN IF EXISTS msisdn_masked,
  DROP COLUMN IF EXISTS msisdn_hash,
  DROP COLUMN IF EXISTS national_id_encrypted,
  DROP COLUMN IF EXISTS national_id_masked,
  DROP COLUMN IF EXISTS national_id_hash;
ALTER TABLE public.sms_inbox
  DROP COLUMN IF EXISTS msisdn_encrypted,
  DROP COLUMN IF EXISTS msisdn_masked,
  DROP COLUMN IF EXISTS msisdn_hash;
ALTER TABLE public.payments
  DROP COLUMN IF EXISTS msisdn_encrypted,
  DROP COLUMN IF EXISTS msisdn_masked,
  DROP COLUMN IF EXISTS msisdn_hash;
-- Add encryption columns cleanly (one time only)
ALTER TABLE public.ikimina_members
  ADD COLUMN msisdn_encrypted TEXT,
  ADD COLUMN msisdn_masked TEXT,
  ADD COLUMN msisdn_hash TEXT,
  ADD COLUMN national_id_encrypted TEXT,
  ADD COLUMN national_id_masked TEXT,
  ADD COLUMN national_id_hash TEXT;
ALTER TABLE public.sms_inbox
  ADD COLUMN msisdn_encrypted TEXT,
  ADD COLUMN msisdn_masked TEXT,
  ADD COLUMN msisdn_hash TEXT;
ALTER TABLE public.payments
  ADD COLUMN msisdn_encrypted TEXT,
  ADD COLUMN msisdn_masked TEXT,
  ADD COLUMN msisdn_hash TEXT;
-- Recreate indexes for encrypted lookup patterns
DROP INDEX IF EXISTS idx_ikimina_members_msisdn_hash;
DROP INDEX IF EXISTS idx_ikimina_members_national_id_hash;
DROP INDEX IF EXISTS idx_payments_msisdn_hash;
DROP INDEX IF EXISTS idx_sms_inbox_msisdn_hash;
CREATE INDEX IF NOT EXISTS idx_ikimina_members_msisdn_hash ON public.ikimina_members(msisdn_hash);
CREATE INDEX IF NOT EXISTS idx_ikimina_members_national_id_hash ON public.ikimina_members(national_id_hash);
CREATE INDEX IF NOT EXISTS idx_payments_msisdn_hash ON public.payments(msisdn_hash);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_msisdn_hash ON public.sms_inbox(msisdn_hash);
-- Seed masked values for existing rows
UPDATE public.ikimina_members
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;
UPDATE public.payments
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;
UPDATE public.sms_inbox
SET msisdn_masked = CASE
  WHEN msisdn IS NULL THEN NULL
  ELSE substr(msisdn, 1, 5) || '••••' || substr(msisdn, greatest(length(msisdn) - 2, 1), 3)
END
WHERE msisdn_masked IS NULL;


-- From: 20251007172207_62b714d9-104f-4afd-87b8-410fe6520410.sql

-- Update the handle_new_user trigger to auto-promote specific email to admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Check if this is the admin email and set role accordingly
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.email = 'info@ikanisa.com' THEN 'SYSTEM_ADMIN'::app_role
      ELSE 'SACCO_STAFF'::app_role
    END
  );
  RETURN NEW;
END;
$function$;


-- From: 20251007175801_445427d3-4918-4a49-8ce2-19dd594e775e.sql

-- Intentionally empty migration file
-- This migration was created as a placeholder or the changes were rolled back.
-- Keeping this file maintains the migration sequence integrity.
;


-- From: 20251007194126_69e2de70-aa8e-4254-ad9f-b1824d86d3b3.sql

-- Rollback the previous bad migration that tried to insert into auth.users
-- This was causing schema errors because email_change column was missing

-- Remove any incorrectly created admin users from the bad migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND column_name = 'email_change'
  ) THEN
    DELETE FROM auth.users WHERE email = 'info@ikanisa.com' AND email_change IS NULL;
  ELSE
    DELETE FROM auth.users WHERE email = 'info@ikanisa.com';
  END IF;
END;
$$;
-- The correct approach is to use the bootstrap-admin edge function
-- which uses the Supabase Admin API to properly create users;


-- From: 20251007231413_5c172e5f-7458-4672-a879-43101e3cb903.sql

-- Add missing columns to saccos table
ALTER TABLE public.saccos 
ADD COLUMN IF NOT EXISTS province text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS category text DEFAULT 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)';
-- Insert all SACCO data
INSERT INTO public.saccos (name, sector_code, district, province, email, category, status) VALUES
('UMWALIMU SACCO', 'KIMIRONKO', 'GASABO', 'CITY OF KIGALI', 'umwalimu.sacco@umwalimusacco.rw', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC UBAKA', 'KIMIRONKO', 'GASABO', 'CITY OF KIGALI', 'coopecubaka@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC ZAMUKA', 'GATENGA', 'KICUKIRO', 'CITY OF KIGALI', 'coopeczamuka2018@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('CYCLE INVESTMENT COOPERATIVE (CIC SACCO)', 'GISOZI', 'GASABO', 'CITY OF KIGALI', 'cycleinvestmentcooperative@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC IKIRENGA', 'BASE', 'RULINDO', 'NORTHERN PROVINCE', 'coopecikirenga@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MTG ISHEMA SACCO', 'KANIGA', 'GICUMBI', 'NORTHERN PROVINCE', 'mtgishemasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('PFUNDA TEA FARMERS AND WORKERS SACCO (PTFW SACCO)', 'NYUNDO', 'RUBAVU', 'WESTERN PROVINCE', 'ptfwsacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COMICOKA', 'KANAMA', 'RUBAVU', 'WESTERN PROVINCE', 'comicokacoopec2021@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TEA SHAGASHA', 'GIHEKE', 'RUSIZI', 'WESTERN PROVINCE', 'saccoteas@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPERATIVE OF PROGRESS AND FINANCING (CPF) INEZA', 'NYAMABUYE', 'MUHANGA', 'SOUTHERN PROVINCE', 'cpfineza@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC IMPAMBA', 'GIKONKO', 'GISAGARA', 'SOUTHERN PROVINCE', 'saccoimpamba@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('CT NYAMAGABE', 'GASAKA', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'ctnyamagabe63@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC TWIZIGAMIRE', 'GASAKA', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'coopectwizigamire@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GATARE TEA FARMERS SACCO', 'KARAMBI', 'NYAMASHEKE', 'WESTERN PROVINCE', 'gatareteafarmerssacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOJAD BUGESERA', 'NYAMATA', 'BUGESERA', 'EASTERN PROVINCE', 'coojadbugeserac@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC INGASHYA', 'KARENGE', 'RWAMAGANA', 'EASTERN PROVINCE', 'coopingashya09@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('AMIZERO SACCO GISAKURA', 'BUSHEKERI', 'NYAMASHEKE', 'WESTERN PROVINCE', 'amizero2011@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MUGANGA SACCO', 'KICUKIRO', 'KICUKIRO', 'CITY OF KIGALI', 'info@mugangasacco.rw', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IKAPAGI', 'BUMBOGO', 'GASABO', 'CITY OF KIGALI', 'koperativeikapagi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('HOPE SACCO MUHIMA', 'MUHIMA', 'NYARUGENGE', 'CITY OF KIGALI', 'muhimahopesacco@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KIGALI SACCO', 'KIGALI', 'NYARUGENGE', 'CITY OF KIGALI', 'kigali10sacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('EJOHEZA SACCO', 'NYARUGENGE', 'NYARUGENGE', 'CITY OF KIGALI', 'kehn2020@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ICYIZERE SACCO GITEGA', 'GITEGA', 'NYARUGENGE', 'CITY OF KIGALI', 'icyizeresacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO MAGERAGERE ICYEREKEZO', 'MAGERAGERE', 'NYARUGENGE', 'CITY OF KIGALI', 'saccomageragere@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INDATWA SACCO KANYINYA', 'KANYINYA', 'NYARUGENGE', 'CITY OF KIGALI', 'indatwasaccokanyinya@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KUNGAHARA SACCO NYAKABANDA', 'NYAKABANDA', 'NYARUGENGE', 'CITY OF KIGALI', 'kungaharasacconyakabanda7@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('URUGWIRO SACCO', 'RWEZAMENYO', 'NYARUGENGE', 'CITY OF KIGALI', 'urugwirosaccorwezamenyo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('DEVELOPMENT VISION SACCO', 'KIMISAGARA', 'NYARUGENGE', 'CITY OF KIGALI', 'kimisagarasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TRUST SACCO NYAMIRAMBO', 'NYAMIRAMBO', 'NYARUGENGE', 'CITY OF KIGALI', 'trustsacco2020@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GATSATA SACCO AMIZERO', 'GATSATA', 'GASABO', 'CITY OF KIGALI', 'amizerogatsata@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GIKOMERO SACCO(KOPEKUKUGI)', 'GIKOMERO', 'GASABO', 'CITY OF KIGALI', 'gikomerosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GISOZI SACCO', 'GISOZI', 'GASABO', 'CITY OF KIGALI', 'gisozisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ICYEREKEZO KINYINYA', 'KINYINYA', 'GASABO', 'CITY OF KIGALI', 'sacco2014sik@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IJABO REMERA SACCO', 'REMERA', 'GASABO', 'CITY OF KIGALI', 'ijaboremera@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INDATSIKIRA SACCO KIMIHURURA', 'KIMIHURURA', 'GASABO', 'CITY OF KIGALI', 'indatsikirasaccokimihurura@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('JABANA SACCO', 'JABANA', 'GASABO', 'CITY OF KIGALI', 'jabanasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUNARA SACCO JALI', 'JALI', 'GASABO', 'CITY OF KIGALI', 'umunarasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KACYIRU SACCO', 'KACYIRU', 'GASABO', 'CITY OF KIGALI', 'kacyiru.sacco2018@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('HOME BASKET SACCO KIMIRONKO', 'KIMIRONKO', 'GASABO', 'CITY OF KIGALI', 'hobasketsacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOPERATIVE ZIGAMA GURINZWA NDUBA', 'NDUBA', 'GASABO', 'CITY OF KIGALI', 'kozigundusacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RUSORORO SACCO', 'RUSORORO', 'GASABO', 'CITY OF KIGALI', 'rusororosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO RUTUNGA', 'RUTUNGA', 'GASABO', 'CITY OF KIGALI', 'saccorutunga@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ZAMUKA BUMBOGO SACCO', 'BUMBOGO', 'GASABO', 'CITY OF KIGALI', 'zamukabumbogosacco1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NDERA SACCO', 'NDERA', 'GASABO', 'CITY OF KIGALI', 'saccondera@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KANOMBE SACCO', 'KANOMBE', 'KICUKIRO', 'CITY OF KIGALI', 'kanombesaccoo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBONEZA SACCO', 'NYARUGUNGA', 'KICUKIRO', 'CITY OF KIGALI', 'imbonezasacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ABAHIZI SACCO', 'GIKONDO', 'KICUKIRO', 'CITY OF KIGALI', 'saccogikondo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IJABO SACCO KIGARAMA', 'KIGARAMA', 'KICUKIRO', 'CITY OF KIGALI', 'ijabosaccokigaramaa@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IJABO SACCO KICUKIRO', 'KICUKIRO', 'KICUKIRO', 'CITY OF KIGALI', 'ijabo.sacco@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('VISION SACCO GAHANGA (VISAGA)', 'GAHANGA', 'KICUKIRO', 'CITY OF KIGALI', 'saccogahanga@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ICYEREKEZO MASAKA SACCO', 'MASAKA', 'KICUKIRO', 'CITY OF KIGALI', 'icyerekezomasakasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GATENGA SACCO', 'GATENGA', 'KICUKIRO', 'CITY OF KIGALI', 'gatengasacco18@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KAGARAMA SAVINGS AND CREDIT COOPERATIVE', 'KAGARAMA', 'KICUKIRO', 'CITY OF KIGALI', 'kagasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INDAHIGWA SACCO NIBOYE', 'NIBOYE', 'KICUKIRO', 'CITY OF KIGALI', 'niboyesacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TWIYUBAKE GASHORA SACCO', 'GASHORA', 'BUGESERA', 'EASTERN PROVINCE', 'twiyubakegashorasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ZAMUKA JURU SACCO', 'JURU', 'BUGESERA', 'EASTERN PROVINCE', 'zamukaj@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KAMABUYE SACCO', 'KAMABUYE', 'BUGESERA', 'EASTERN PROVINCE', 'kamabuyesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('JYAMBERE MAREBA SACCO', 'MAREBA', 'BUGESERA', 'EASTERN PROVINCE', 'jambescom@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MAYANGE SACCO', 'MAYANGE', 'BUGESERA', 'EASTERN PROVINCE', 'saccomaya@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBARUTSO MUSENYI SACCO', 'MUSENYI', 'BUGESERA', 'EASTERN PROVINCE', 'musenyisacco2009@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MWOGO SACCO', 'MWOGO', 'BUGESERA', 'EASTERN PROVINCE', 'mwogosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IJABO NGERUKA SACCO', 'NGERUKA', 'BUGESERA', 'EASTERN PROVINCE', 'ijabongerukasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NTARAMA SACCO', 'NTARAMA', 'BUGESERA', 'EASTERN PROVINCE', 'saccontarama@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NYAMATA SACCO', 'NYAMATA', 'BUGESERA', 'EASTERN PROVINCE', 'nyamatasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NYARUGENGE ICYEREKEZO SACCO', 'NYARUGENGE', 'BUGESERA', 'EASTERN PROVINCE', 'nyarugengesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RILIMA SACCO', 'RILIMA', 'BUGESERA', 'EASTERN PROVINCE', 'saccorilima1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RUHUHA DEVELOPMENT SACCO', 'RUHUHA', 'BUGESERA', 'EASTERN PROVINCE', 'ruhuhadevelop2021@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RWERU SACCO', 'RWERU', 'BUGESERA', 'EASTERN PROVINCE', 'rwerusacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SHYARA SACCO', 'SHYARA', 'BUGESERA', 'EASTERN PROVINCE', 'saccoshyaranews@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBONI KIGABIRO SACCO', 'KIGABIRO', 'RWAMAGANA', 'EASTERN PROVINCE', 'imbonikigabiro@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBADUKO MUHAZI SACCO', 'MUHAZI', 'RWAMAGANA', 'EASTERN PROVINCE', 'imbaduko2010@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ICYEREKEZO GISHARI SACCO', 'GISHARI', 'RWAMAGANA', 'EASTERN PROVINCE', 'saccogishari@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MUNYIGINYA SACCO (MY SACCO)', 'MUNYIGINYA', 'RWAMAGANA', 'EASTERN PROVINCE', 'smunyiginya@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMPORE MWULIRE SACCO', 'MWULIRE', 'RWAMAGANA', 'EASTERN PROVINCE', 'saccomwulire2014@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUSARE SACCO-MUSHA', 'MUSHA', 'RWAMAGANA', 'EASTERN PROVINCE', 'umusaresacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SANGWA SACCO GAHENGERI', 'GAHENGERI', 'RWAMAGANA', 'EASTERN PROVINCE', 'sangwasaccogahengeri1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('FUMBWE SACCO', 'FUMBWE', 'RWAMAGANA', 'EASTERN PROVINCE', 'fumbwesacco20@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUGISHA SACCO MUYUMBU', 'MUYUMBU', 'RWAMAGANA', 'EASTERN PROVINCE', 'umugisha.sacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC UBUMWE BWA NYAKARIRO', 'NYAKARIRO', 'RWAMAGANA', 'EASTERN PROVINCE', 'ubumwebwanyakaliro@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GWIZA KARENGE SACCO', 'KARENGE', 'RWAMAGANA', 'EASTERN PROVINCE', 'gwizakarenges@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IZIGAMIRE NZIGE SACCO', 'NZIGE', 'RWAMAGANA', 'EASTERN PROVINCE', 'kpnzigesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IZERE RUBONA SACCO', 'RUBONA', 'RWAMAGANA', 'EASTERN PROVINCE', 'rubonasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TWIYUBAKE MUNYAGA SACCO', 'MUNYAGA', 'RWAMAGANA', 'EASTERN PROVINCE', 'twiyubakesaccomunyaga@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GAHINI SACCO', 'GAHINI', 'KAYONZA', 'EASTERN PROVINCE', 'gahinisacco2020@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOPERATIVE KUNGAHARA KABARE', 'KABARE', 'KAYONZA', 'EASTERN PROVINCE', 'coopeckuka2009@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO DUKIRE KABARONDO', 'KABARONDO', 'KAYONZA', 'EASTERN PROVINCE', 'kabarondosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ICYOGERE MUKARANGE', 'MUKARANGE', 'KAYONZA', 'EASTERN PROVINCE', 'saccomukarange@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('DUKIRE SACCO MURAMA', 'MURAMA', 'KAYONZA', 'EASTERN PROVINCE', 'saccodukiremurama2020@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCOMURUNDI', 'MURUNDI', 'KAYONZA', 'EASTERN PROVINCE', 'saccomurundi2021@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MWILI SACCO', 'MWIRI', 'KAYONZA', 'EASTERN PROVINCE', 'saccomwili@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO DUKIRE NDEGO', 'NDEGO', 'KAYONZA', 'EASTERN PROVINCE', 'saccoyacu@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC ABANZUMUGAYO/NYAMIRAMA', 'NYAMIRAMA', 'KAYONZA', 'EASTERN PROVINCE', 'sacconyamirama.rw@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO UMUCYO RUKARA', 'RUKARA', 'KAYONZA', 'EASTERN PROVINCE', 'saccoumucyo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO RURAMIRA ICYEREKEZO', 'RURAMIRA', 'KAYONZA', 'EASTERN PROVINCE', 'ruramirasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TWIFATANYE RWINKWAVU', 'RWINKWAVU', 'KAYONZA', 'EASTERN PROVINCE', 'twifatanyesacco@gmil.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOPERATIVE ABIZERANYE Y''I GASHANDA(KOPABIGA)', 'GASHANDA', 'NGOMA', 'EASTERN PROVINCE', 'saccogashanda@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('AMEREKEZO JARAMA SACCO (KOPAJA)', 'JARAMA', 'NGOMA', 'EASTERN PROVINCE', 'sacco2009jarama@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPERATIVE IMENA ZA KAREMBO(CIMEKA)', 'KAREMBO', 'NGOMA', 'EASTERN PROVINCE', 'saccokarembocimeka@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KAZO SAVING AND CREDIT COOPERATIVE', 'KAZO', 'NGOMA', 'EASTERN PROVINCE', 'saccokazo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOPERATIVE ZIGAMA KIBUNGO (KOZIKI)', 'KIBUNGO', 'NGOMA', 'EASTERN PROVINCE', 'kozikingo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IBYIZA MUGESERA SACCO', 'MUGESERA', 'NGOMA', 'EASTERN PROVINCE', 'saccomugesera@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOTIMU', 'MURAMA', 'NGOMA', 'EASTERN PROVINCE', 'saccomurama@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INGOBOKA MUTENDERI', 'MUTENDERI', 'NGOMA', 'EASTERN PROVINCE', 'ingobokamutenderisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('REMERA PEOPLE SAVING AND CREDIT COOPERATIVE', 'REMERA', 'NGOMA', 'EASTERN PROVINCE', 'repsaccoremera@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KUNGAHARA RUKIRA SACCO', 'RUKIRA', 'NGOMA', 'EASTERN PROVINCE', 'saccorukira20@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ZIGAMA INTERA RUKUMBELI', 'RUKUMBERI', 'NGOMA', 'EASTERN PROVINCE', 'koziru@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RURENGE PEOPLE SACCO (RP SACCO)', 'RURENGE', 'NGOMA', 'EASTERN PROVINCE', 'saccorurenge13@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOPERATIVE ZIGAMA ISANGE MURI SAKE(KOZISA)', 'SAKE', 'NGOMA', 'EASTERN PROVINCE', 'saccosake@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO NTUSIGARE(KOZINTU)', 'ZAZA', 'NGOMA', 'EASTERN PROVINCE', 'saccozaza20@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('JYAMBERE GAHARA', 'GAHARA', 'KIREHE', 'EASTERN PROVINCE', 'saccojyamberegahara@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('VISION SACCO GATORE', 'GATORE', 'KIREHE', 'EASTERN PROVINCE', 'visionsaccogatore1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMIRASIRE Y''ITERAMBERE SACCO KIGARAMA', 'KIGARAMA', 'KIREHE', 'EASTERN PROVINCE', 'saccokigarama@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KIGINA SACCO', 'KIGINA', 'KIREHE', 'EASTERN PROVINCE', 'casacoki@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO RUGERO', 'KIREHE', 'KIREHE', 'EASTERN PROVINCE', 'saccorugero@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IMBERE HEZA MAHAMA', 'MAHAMA', 'KIREHE', 'EASTERN PROVINCE', 'saccoimbereheza@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO HAGURUKA UKORE-MPANGA', 'MPANGA', 'KIREHE', 'EASTERN PROVINCE', 'saccompanga@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMURUNGA SACCO MUSAZA', 'MUSAZA', 'KIREHE', 'EASTERN PROVINCE', 'umurungasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MUSHIKIRI SACCO DEVELOPMENT(M.S.D)', 'MUSHIKIRI', 'KIREHE', 'EASTERN PROVINCE', 'mushikirisacoo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO MENYIBANGA', 'NASHO', 'KIREHE', 'EASTERN PROVINCE', 'saccomenyibanganasho@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TWUNGURANE SACCO', 'NYAMUGARI', 'KIREHE', 'EASTERN PROVINCE', 'twunguranesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NYARUBUYE SACCO VISION', 'NYARUBYE', 'KIREHE', 'EASTERN PROVINCE', 'nyarubuyesaccovision@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBARUTSO SACCO GATUNDA', 'GATUNDA', 'NYAGATARE', 'EASTERN PROVINCE', 'imbarutsosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC ISANGE KARAMA', 'KARAMA', 'NYAGATARE', 'EASTERN PROVINCE', 'umurenge12@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KARANGAZI UMURENGE SACCO', 'KARANGAZI', 'NYAGATARE', 'EASTERN PROVINCE', 'karangazisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KATABAGEMU SACCO (CESEKA)', 'KATABAGEMU', 'NYAGATARE', 'EASTERN PROVINCE', 'katabagemusacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UBUSUGIRE SACCO KIYOMBE', 'KIYOMBE', 'NYAGATARE', 'EASTERN PROVINCE', 'ubusugiresaccokiyombe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MATIMBA VISION SACCO', 'MATIMBA', 'NYAGATARE', 'EASTERN PROVINCE', 'mavisacco2020@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMURABYO SACCO MIMURI', 'MIMURI', 'NYAGATARE', 'EASTERN PROVINCE', 'saccoumurabyo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INGOBOKA MUKAMA', 'MUKAMA', 'NYAGATARE', 'EASTERN PROVINCE', 'saccoingobokamukama@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MUSHELI SACCO', 'MUSHERI', 'NYAGATARE', 'EASTERN PROVINCE', 'musacco07@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NYAGATARE DEVELOPMENT SACCO', 'NYAGATARE', 'NYAGATARE', 'EASTERN PROVINCE', 'nyagataresacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KARIBU SACCO RUKOMO', 'RUKOMO', 'NYAGATARE', 'EASTERN PROVINCE', 'karibusacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RWEMPASHA SACCO', 'RWEMPASHA', 'NYAGATARE', 'EASTERN PROVINCE', 'saccorwempasha@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TURWANYUBUKENE RWIMIYAGA', 'RWIMIYAGA', 'NYAGATARE', 'EASTERN PROVINCE', 'saccorwimiyaga@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TABAGWE', 'TABAGWE', 'NYAGATARE', 'EASTERN PROVINCE', 'umurenge10scco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TURWUBAKANE GASANGE "COTUGA SACCO"', 'GASANGE', 'GATSIBO', 'EASTERN PROVINCE', 'cotugasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GATSIBO UMURAGE SACCO', 'GATSIBO', 'GATSIBO', 'EASTERN PROVINCE', 'umuragewubukire@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GITOKI IZERE SACCO', 'GITOKI', 'GATSIBO', 'EASTERN PROVINCE', 'gitokiizeresacco01@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ISONGA SACCO KABARORE', 'KABARORE', 'GATSIBO', 'EASTERN PROVINCE', 'kabaroreisongasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KAGEYO SACCO IZIGAME', 'KAGEYO', 'GATSIBO', 'EASTERN PROVINCE', 'kageyosaccoizigame@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KIRAMURUZI UKURI SACCO', 'KIRAMURUZI', 'GATSIBO', 'EASTERN PROVINCE', 'ukurisaccokiramuruzi10@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KIZIGURO ISONGA SACCO', 'KIZIGURO', 'GATSIBO', 'EASTERN PROVINCE', 'kizigurosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUHIGO SACCO MUHURA', 'MUHURA', 'GATSIBO', 'EASTERN PROVINCE', 'umuhigosacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INGENZI MURAMBI SACCO', 'MURAMBI', 'GATSIBO', 'EASTERN PROVINCE', 'musaccingenzi2009@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NGARAMA ISUNGE SACCO', 'NGARAMA', 'GATSIBO', 'EASTERN PROVINCE', 'ngaramasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TERIMBERE NYAGIHANGA (SACCOTENYA)', 'NYAGIHANGA', 'GATSIBO', 'EASTERN PROVINCE', 'saccotenya@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('REMERA SACCO GIRIBAKWE', 'REMERA', 'GATSIBO', 'EASTERN PROVINCE', 'saccogiribakwe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RUGARAMA URUMURI SACCO', 'RUGARAMA', 'GATSIBO', 'EASTERN PROVINCE', 'rugaramaurumurisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TUGANEHEZA SACCO RWIMBOGO', 'RWIMBOGO', 'GATSIBO', 'EASTERN PROVINCE', 'tuganehezasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IREMBO RY''UBUKIRE KAYENZI', 'KAYENZI', 'KAMONYI', 'SOUTHERN PROVINCE', 'saccokayenzi@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IBONEMO GACURABWENGE (SIGA)', 'GACURABWENGE', 'KAMONYI', 'SOUTHERN PROVINCE', 'saccogacurabwege@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IMARABUKENE NGAMBA', 'NGAMBA', 'KAMONYI', 'SOUTHERN PROVINCE', 'saccongamba@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO URUYANGERUKOMA (SUR)', 'RUKOMA', 'KAMONYI', 'SOUTHERN PROVINCE', 'saccorukoma@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INYUMBA YA KAYUMBU', 'KAYUMBU', 'KAMONYI', 'SOUTHERN PROVINCE', 'ssaccoinyumba@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO MBONEZISONGA MUSAMBIRA', 'MUSAMBIRA', 'KAMONYI', 'SOUTHERN PROVINCE', 'saccombonezisonga@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO URUFUNGUZO RW''UBUKIRE RUNDA', 'RUNDA', 'KAMONYI', 'SOUTHERN PROVINCE', 'ubukirerundasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ICYUZUZO RUGALIKA', 'RUGALIKA', 'KAMONYI', 'SOUTHERN PROVINCE', 'rugalikasacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO KIRA KARAMA', 'KARAMA', 'KAMONYI', 'SOUTHERN PROVINCE', 'saccokarama@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ISHEMA RY''UMURYANGO NYAMIYAGA (SISUNYA)', 'NYAMIYAGA', 'KAMONYI', 'SOUTHERN PROVINCE', 'sisunyasacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO DUSIZE UBUKENE NYARUBAKA', 'NYARUBAKA', 'KAMONYI', 'SOUTHERN PROVINCE', 'nyarubakasacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO MUGINA JYAMBERE (SAMUJYA)', 'MUGINA', 'KAMONYI', 'SOUTHERN PROVINCE', 'saccomugina@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ICYEREKEZO SACCO', 'MUSHISHIRO', 'MUHANGA', 'SOUTHERN PROVINCE', 'mushishiro1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IMBANGUKIRAGUKIRA', 'KIBANGU', 'MUHANGA', 'SOUTHERN PROVINCE', 'imbangukiragukirasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TERIMBERE SHYOGWE', 'SHYOGWE', 'MUHANGA', 'SOUTHERN PROVINCE', 'saccoshyogwe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO AMIZERO RONGI', 'RONGI', 'MUHANGA', 'SOUTHERN PROVINCE', 'saccoumurengerongi18@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO KORA UTEGANYA', 'NYAMABUYE', 'MUHANGA', 'SOUTHERN PROVINCE', 'saccokoruteganya2018@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TUGANE SACCO NYABINONI', 'NYABINONI', 'MUHANGA', 'SOUTHERN PROVINCE', 'tuganesacconyabinoni@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO DUKIRE NYARUSANGE', 'NYARUSANGE', 'MUHANGA', 'SOUTHERN PROVINCE', 'nyarusangesacco1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ICYEREKEZO KIYUMBA', 'KIYUMBA', 'MUHANGA', 'SOUTHERN PROVINCE', 'saccokiyumba2020@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IZIGAMIRE KABACUZI', 'KABACUZI', 'MUHANGA', 'SOUTHERN PROVINCE', 'saccoizigamire@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO WISIGARA MUHANGA', 'MUHANGA', 'MUHANGA', 'SOUTHERN PROVINCE', 'msaccowisigara@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO AMIZERO RUGENDABARI', 'RUGENDABARI', 'MUHANGA', 'SOUTHERN PROVINCE', 'saccamirug2009@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INGERI CYEZA', 'CYEZA', 'MUHANGA', 'SOUTHERN PROVINCE', 'saccoingericyeza@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('JYAMBERE BWERAMANA', 'BWERAMANA', 'RUHANGO', 'SOUTHERN PROVINCE', 'saccobweramana2018@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INGENZI SACCO BYIMANA', 'BYIMANA', 'RUHANGO', 'SOUTHERN PROVINCE', 'sbyimana@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC KABAGALI', 'KABAGALI', 'RUHANGO', 'SOUTHERN PROVINCE', 'saccokabagali@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('', 'KINAZI', 'RUHANGO', 'SOUTHERN PROVINCE', 'saccokinazi2017@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC URUBUTO KINIHIRA', 'KINIHIRA', 'RUHANGO', 'SOUTHERN PROVINCE', 'coopecurubutokinihira@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBONEZACYEREKEZO SACCO', 'MBUYE', 'RUHANGO', 'SOUTHERN PROVINCE', 'saccombuye@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ABAHIZI DUKIRE MWENDO', 'MWENDO', 'RUHANGO', 'SOUTHERN PROVINCE', 'sacco.abahizidukire@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NKUNGANIRE', 'NTONGWE', 'RUHANGO', 'SOUTHERN PROVINCE', 'sacconkunganirentongwe2018@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO BATUREBEREHO RUHANGO', 'RUHANGO', 'RUHANGO', 'SOUTHERN PROVINCE', 'saccobaturebereho2@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TEGANYA BUSASAMANA', 'BUSASAMANA', 'NYANZA', 'SOUTHERN PROVINCE', 'busasamanasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO VISION BUSORO', 'BUSORO', 'NYANZA', 'SOUTHERN PROVINCE', 'savibu@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO JYEJURU CYABAKAMYI', 'CYABAKAMYI', 'NYANZA', 'SOUTHERN PROVINCE', 'saccojyejurucyabakamyi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('EJO HEZA TUZAMURANA SACCO KIBIRIZI', 'KIBIRIZI', 'NYANZA', 'SOUTHERN PROVINCE', 'saccokibirizi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO UMURAVA KIGOMA', 'KIGOMA', 'NYANZA', 'SOUTHERN PROVINCE', 'saccokigoma@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TUZAMURANE MUKINGO', 'MUKINGO', 'NYANZA', 'SOUTHERN PROVINCE', 'mukingosacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO MUYIRA DUSHYIGIKIRANE', 'MUYIRA', 'NYANZA', 'SOUTHERN PROVINCE', 'sacco.muyira@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOPERATIVE URUMURI RW''AMAJYAMBERE', 'NTYAZO', 'NYANZA', 'SOUTHERN PROVINCE', 'saccourumuri1@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO GANAHEZA NYAGISOZI', 'NYAGISOZI', 'NYANZA', 'SOUTHERN PROVINCE', 'sacconyagisozi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IGISUBIZO RWABICUMA', 'RWABICUMA', 'NYANZA', 'SOUTHERN PROVINCE', 'saccoigisubizorwabicuma@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC INGERI GISHAMVU', 'GISHAMVU', 'HUYE', 'SOUTHERN PROVINCE', 'gishamvusacco@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TUJYANE HUYE SACCO', 'HUYE', 'HUYE', 'SOUTHERN PROVINCE', 'tuhusa@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TUGEREHEZA KARAMA', 'KARAMA', 'HUYE', 'SOUTHERN PROVINCE', 'karamasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TEGANYA KIGOMA SACCO', 'KIGOMA', 'HUYE', 'SOUTHERN PROVINCE', 'kigomasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KINAZI AMIZERO SACCO', 'KINAZI', 'HUYE', 'SOUTHERN PROVINCE', 'amizerosaccokinazi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC KIRA MARABA', 'MARABA', 'HUYE', 'SOUTHERN PROVINCE', 'saccomaraba@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MBAZI ISONGA SACCO', 'MBAZI', 'HUYE', 'SOUTHERN PROVINCE', 'isongasaccombazi@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UBWUGAMO MUKURA SACCO', 'MUKURA', 'HUYE', 'SOUTHERN PROVINCE', 'mukurasacco2@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ISANGE NGOMA SACCO', 'NGOMA', 'HUYE', 'SOUTHERN PROVINCE', 'ngomasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TUGENDANE N''IGIHE RUHASHYA SACCO', 'RUHASHYA', 'HUYE', 'SOUTHERN PROVINCE', 'tugendanenigihe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SHISHOZA UKIRE RUSATIRA SACCO', 'RUSATIRA', 'HUYE', 'SOUTHERN PROVINCE', 'saccorusatira@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO HIRWA RWANIRO', 'RWANIRO', 'HUYE', 'SOUTHERN PROVINCE', 'saccorwaniro@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('DUKIRE SIMBI SACCO', 'SIMBI', 'HUYE', 'SOUTHERN PROVINCE', 'simbisacco5@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RATWA TUMBA SACCO', 'TUMBA', 'HUYE', 'SOUTHERN PROVINCE', 'ratwasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TERIMBERE KIBIRIZI SACCO', 'KIBIRIZI', 'GISAGARA', 'SOUTHERN PROVINCE', 'termbere@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IZERE GIKONKO', 'GIKONKO', 'GISAGARA', 'SOUTHERN PROVINCE', 'saccoizeregikonko@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC URUGERO MUGOMBWA', 'MUGOMBWA', 'GISAGARA', 'SOUTHERN PROVINCE', 'saccourugeromugombwa@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('URUMURI MAMBA SACCO', 'MAMBA', 'GISAGARA', 'SOUTHERN PROVINCE', 'mambasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INDATWA KIGEMBE', 'KIGEMBE', 'GISAGARA', 'SOUTHERN PROVINCE', 'indatwasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IMBEREHEZA NDORA', 'NDORA', 'GISAGARA', 'SOUTHERN PROVINCE', 'imberehezandora@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INDASHYIKIRWA MUGANZA', 'MUGANZA', 'GISAGARA', 'SOUTHERN PROVINCE', 'saccomuganza@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INTWARI SACCO SAVE', 'SAVE', 'GISAGARA', 'SOUTHERN PROVINCE', 'intwarisaccosave@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO NYANZA DUKIRE', 'NYANZA', 'GISAGARA', 'SOUTHERN PROVINCE', 'nyanzadukire611@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TUGANEHEZA GISHUBI', 'GISHUBI', 'GISAGARA', 'SOUTHERN PROVINCE', 'saccogishubi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUCYO SACCO MUKINDO', 'MUKINDO', 'GISAGARA', 'SOUTHERN PROVINCE', 'saccomukindo@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ISHYAKA KANSI SACCO', 'KANSI', 'GISAGARA', 'SOUTHERN PROVINCE', 'saccoishyakakansi2020@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ITEGANYIRIZE MUSHA', 'MUSHA', 'GISAGARA', 'SOUTHERN PROVINCE', 'mushasacco1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO KIRA BURUHUKIRO', 'BURUHUKIRO', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'saccokiraburuhukiro12@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBEREHEZA CYANIKA SACCO', 'CYANIKA', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'cyanikasaccoimbereheza@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INGENZI GASAKA SACCO', 'GASAKA', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'ingenzigasakasacco82@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO JYAMBERE GATARE', 'GATARE', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'gataresacco04@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('URUFUNGUZO RW''UBUKIRE KADUHA SACCO', 'KADUHA', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'saccokaduha@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INDAHIGWA KAMEGERI', 'KAMEGERI', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'saccoindahigwakamegeri@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INDATWA KIBIRIZI', 'KIBIRIZI', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'indatwakibirizisacco16@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INDANGAMIRWA KIBUMBWE SACCO (IKS)', 'KIBUMBWE', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'indangamirwakibumbwesacco2022@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TWITEGANYIRIZE KITABI', 'KITABI', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'twiteganyirizekitabisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ICYEREKEZO MBAZI SACCO (IMS)', 'MBAZI', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'icyerekezombazisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INSHUTI Z''I MUGANO SACCO', 'MUGANO', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'inshutizimuganosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('URUMURI RWA MUSANGE SACCO (UMS)', 'MUSANGE', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'musangesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INDATWA MUSEBEYA', 'MUSEBEYA', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'indatwamusebeyasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INDASHYIKIRWA MUSHUBI SACCO', 'MUSHUBI', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'indashyikirwamushubisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TUBWAMBUKENKOMANE SACCO', 'NKOMANE', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'tubwambukenkomanesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TUZAMURANE TARE', 'TARE', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'tuzamuranetaresacco2009@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IBYIRINGIRO UWINKINGI', 'UWINKINGI', 'NYAMAGABE', 'SOUTHERN PROVINCE', 'ibyiringirosacco.uwinkingi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO JYAMBERE BUSANZE', 'BUSANZE', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccojyamberebusanze@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO AMIZERO CYAHINDA', 'CYAHINDA', 'NYARUGURU', 'SOUTHERN PROVINCE', 'cyahindasacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IMBONI KIBEHO', 'KIBEHO', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccoimbonikibeho@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INKINGI Y''ITERAMBERE KIVU', 'KIVU', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccokivu@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ITEZIMBERE MATA', 'MATA', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccomata@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO UMURAVA MUGANZA', 'MUGANZA', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccoumurava@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO WISIGARA MUNINI', 'MUNINI', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccowisigaramunini@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TWIZIGAMIRE NGERA', 'NGERA', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccotwizigamire@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ZAMUKA NGOMA', 'NGOMA', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccozamuka@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UKURI NYABIMATA SACCO', 'NYABIMATA', 'NYARUGURU', 'SOUTHERN PROVINCE', 'nyabimatasaccoukuri@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO EJOHAZAZA NYAGISOZI', 'NYAGISOZI', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccoejohazazanyagisozi70@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO NKUNGANIRE', 'RUHERU', 'NYARUGURU', 'SOUTHERN PROVINCE', 'nkunganiresaccco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KORUKIRE RURAMBA', 'RURAMBA', 'NYARUGURU', 'SOUTHERN PROVINCE', 'korukiresacco1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INOZAMIHIGO RUSENGE', 'RUSENGE', 'NYARUGURU', 'SOUTHERN PROVINCE', 'saccoinozamihigorusenge@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IZUBA SACCO BASE', 'BASE', 'RULINDO', 'NORTHERN PROVINCE', 'izubasacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBADUKO SACCO BUREGA', 'BUREGA', 'RULINDO', 'NORTHERN PROVINCE', 'imbadukosaccoburega@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPERATIVE DE DEVELOPMENT DE BUSHOKI', 'BUSHOKI', 'RULINDO', 'NORTHERN PROVINCE', 'coopedebusaccobushoki@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GIRUBUKIRE SACCO BUYOGA', 'BUYOGA', 'RULINDO', 'NORTHERN PROVINCE', 'girubukire@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IGISABO CYINZUZI SACCO', 'CYINZUZI', 'RULINDO', 'NORTHERN PROVINCE', 'cyinzuzisacco@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TERIMBERE SACCO CYUNGO', 'CYUNGO', 'RULINDO', 'NORTHERN PROVINCE', 'saccotecyu@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOPERATIVETUGIRUBUKIRE KINIHIRA', 'KINIHIRA', 'RULINDO', 'NORTHERN PROVINCE', 'kotukisacco@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUSINGIMW ITERAMBERE (UMITE)', 'KISARO', 'RULINDO', 'NORTHERN PROVINCE', 'saccoumite@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO COOPEBAMU', 'MASORO', 'RULINDO', 'NORTHERN PROVINCE', 'saccomasoro@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MBOGO DEVELOPMENT COOPERATIVE', 'MBOGO', 'RULINDO', 'NORTHERN PROVINCE', 'mdecosaccombogo@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IJABO SACCO MURAMBI', 'MURAMBI', 'RULINDO', 'NORTHERN PROVINCE', 'saccoimu123@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SHIRUBUKENE SACCO NGOMA', 'NGOMA', 'RULINDO', 'NORTHERN PROVINCE', 'saccongoma@yahoo.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INGANZA SACCO NTARABANA', 'NTARABANA', 'RULINDO', 'NORTHERN PROVINCE', 'inganzasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPERATIVE GARAGAZUMUSARURO RUKOZO', 'RUKOZO', 'RULINDO', 'NORTHERN PROVINCE', 'saccorukozo2@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBARUTSO SACCO RUSIGA', 'RUSIGA', 'RULINDO', 'NORTHERN PROVINCE', 'saccoimbarutso@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('BADUKA SACCO SHYORONGI', 'SHYORONGI', 'RULINDO', 'NORTHERN PROVINCE', 'badukashyorongisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ABAHIZI SACCO TUMBA', 'TUMBA', 'RULINDO', 'NORTHERN PROVINCE', 'saccoabahizitumba@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO BUSENGO', 'BUSENGO', 'GAKENKE', 'NORTHERN PROVINCE', 'busengosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('REBAKURE SACCO', 'COKO', 'GAKENKE', 'NORTHERN PROVINCE', 'saccorebakurecoko@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('CYABINGO SACCO', 'CYABINGO', 'GAKENKE', 'NORTHERN PROVINCE', 'saccocyabingo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO KUNGAHARA GAKENKE', 'GAKENKE', 'GAKENKE', 'NORTHERN PROVINCE', 'saccokungahara@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO GASE', 'GASHENYI', 'GAKENKE', 'NORTHERN PROVINCE', 'saccogase123@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UZAZUREBE SACCO', 'JANJA', 'GAKENKE', 'NORTHERN PROVINCE', 'saccojanja@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IZIYIGIHE SACCO', 'KAMUBUGA', 'GAKENKE', 'NORTHERN PROVINCE', 'iziyigihesacco18@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KARAMBO VA MU BUKENE SACCO', 'KARAMBO', 'GAKENKE', 'NORTHERN PROVINCE', 'kavabusacco7@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GIRINTEGO SACCO', 'KIVURUGA', 'GAKENKE', 'NORTHERN PROVINCE', 'girintegosacco2021@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SIGARABUKENE SACCO', 'MATABA', 'GAKENKE', 'NORTHERN PROVINCE', 'sigarabukenesaccomataba@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO INDASHYIKIRWA', 'MINAZI', 'GAKENKE', 'NORTHERN PROVINCE', 'saccominazi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO NEW HOPE', 'MUGUNGA', 'GAKENKE', 'NORTHERN PROVINCE', 'sacconewhope@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TWAMBUTSANYE', 'MUHONDO', 'GAKENKE', 'NORTHERN PROVINCE', 'twambusacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO KATAZA MUYONGWE', 'MUYONGWE', 'GAKENKE', 'NORTHERN PROVINCE', 'muyongwesaccokataza2020@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('', 'MUZO', 'GAKENKE', 'NORTHERN PROVINCE', 'saccotugireubukire@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INDASHYIKIRWA SACCO', 'NEMBA', 'GAKENKE', 'NORTHERN PROVINCE', 'isacconemba@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBONERA SACCO', 'RULI', 'GAKENKE', 'NORTHERN PROVINCE', 'imboneraruli@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TUGIRE UBUKIRE', 'RUSASA', 'GAKENKE', 'NORTHERN PROVINCE', 'saccotugireubukire@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUSINGI SACCO RUSHASHI', 'RUSHASHI', 'GAKENKE', 'NORTHERN PROVINCE', 'umusingisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ISONGA SACCO', 'BUNGWE', 'BURERA', 'NORTHERN PROVINCE', 'saccobungwe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NDORWA SACCO', 'BUTARO', 'BURERA', 'NORTHERN PROVINCE', 'saccondorwabutaro@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IYUNGURE CYANIKA', 'CYANIKA', 'BURERA', 'NORTHERN PROVINCE', 'iyunguresacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMURUNGA W''ITERAMBERE SACCO CYERU', 'CYERU', 'BURERA', 'NORTHERN PROVINCE', 'saccocyeru@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO AKABANDO', 'GAHUNGA', 'BURERA', 'NORTHERN PROVINCE', 'saccoakabando@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO DUKIRE GATEBE', 'GATEBE', 'BURERA', 'NORTHERN PROVINCE', 'saccodukiregatebee@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GITOVU SACCO', 'GITOVU', 'BURERA', 'NORTHERN PROVINCE', 'saccogitovu@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KAGOGO VISION SACCO (KAVISACCO)', 'KAGOGO', 'BURERA', 'NORTHERN PROVINCE', 'kavisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KINONI SACCO', 'KINONI', 'BURERA', 'NORTHERN PROVINCE', 'kinonisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INDORERWAMO KINYABABA SACCO', 'KINYABABA', 'BURERA', 'NORTHERN PROVINCE', 'saccoindorerwamo2@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPEC ICYEREKEZO KIZIMA', 'KIVUYE', 'BURERA', 'NORTHERN PROVINCE', 'saccoicyerekezokizima@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('DUHORANE IJABO SACCO', 'NEMBA', 'BURERA', 'NORTHERN PROVINCE', 'duhoraneijabo54@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO RUGARAMA IMBERE HEZA', 'RUGARAMA', 'BURERA', 'NORTHERN PROVINCE', 'saccorugarama@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMURAGE SACCO', 'RUGENGABARI', 'BURERA', 'NORTHERN PROVINCE', 'umuragesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RUHUNDE SACCO', 'RUHUNDE', 'BURERA', 'NORTHERN PROVINCE', 'ruhundesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO REBAKURE RUSARABUYE', 'RUSARABUYE', 'BURERA', 'NORTHERN PROVINCE', 'saccorebakure@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('RUGEZI SACCO', 'RWERERE', 'BURERA', 'NORTHERN PROVINCE', 'saccorugezi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('BUKURE SACCO', 'BUKURE', 'GICUMBI', 'NORTHERN PROVINCE', 'bukuresacco2018@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBARUTSO SACCO', 'GITI', 'GICUMBI', 'NORTHERN PROVINCE', 'imbarutsosaccogiti@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMBONI SACCO KAGEYO', 'KAGEYO', 'GICUMBI', 'NORTHERN PROVINCE', 'imbonisacco@yahoo.fr', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('AGASHYA MANYAGIRO SACCO', 'MANYANGIRO', 'GICUMBI', 'NORTHERN PROVINCE', 'manyagirosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('WISIGARA RUSHAKI SACCO', 'RUSHAKI', 'GICUMBI', 'NORTHERN PROVINCE', 'wisigararushakisacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TSIMBURA SACCO', 'SHANGASHA', 'GICUMBI', 'NORTHERN PROVINCE', 'Saccotsimbura@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KIRA MUTETE SACCO', 'MUTETE', 'GICUMBI', 'NORTHERN PROVINCE', 'kiramutete@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('HASHYUBUKENE SACCO RWAMIKO', 'RWAMIKO', 'GICUMBI', 'NORTHERN PROVINCE', 'saccorwamiko@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('BYUMBA SACCO', 'BYUMBA', 'GICUMBI', 'NORTHERN PROVINCE', 'byumbasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('BWISIGE SACCO', 'BWISIGE', 'GICUMBI', 'NORTHERN PROVINCE', 'bwisigesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TUGENDANE N''IGIHE SACCO', 'KANIGA', 'GICUMBI', 'NORTHERN PROVINCE', 'stugendanenigihe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IBAKWE SACCO MUKARANGE', 'MUKARANGE', 'GICUMBI', 'NORTHERN PROVINCE', 'saccoibakwe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMURABYO SACCO NYAMIYAGA', 'NYAMIYAGA', 'GICUMBI', 'NORTHERN PROVINCE', 'umurabyosacconyamiyaga@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMIRASIRE Y''ITERAMBERE SACCO RUKOMO', 'RUKOMO', 'GICUMBI', 'NORTHERN PROVINCE', 'rukomosacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ITEGANYIRIZE SACCO RUTARE', 'RUTARE', 'GICUMBI', 'NORTHERN PROVINCE', 'saccorutare@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SHIRUBUKENE SACCO RUVUNE', 'RUVUNE', 'GICUMBI', 'NORTHERN PROVINCE', 'shirubukenescco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IZIGAMIRE SACCO MIYOVE', 'MIYOVE', 'GICUMBI', 'NORTHERN PROVINCE', 'isaccomiyove@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('TUVUDUKE SACCO RUBAYA', 'RUBAYA', 'GICUMBI', 'NORTHERN PROVINCE', 'tuvudukerubaya123@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('MFASHNKIRE SACCO', 'NYANKENKE', 'GICUMBI', 'NORTHERN PROVINCE', 'nyankenkesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INDATWA SACCO MUKO', 'MUKO', 'GICUMBI', 'NORTHERN PROVINCE', 'indatwasaccomuko1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('HIRWA CYUMBA SACCO', 'CYUMBA', 'GICUMBI', 'NORTHERN PROVINCE', 'hirwasacco10@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IHIRWE BUSOGO SACCO', 'BUSOGO', 'MUSANZE', 'NORTHERN PROVINCE', 'ihirwesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INYONGERA SACCO', 'CYUVE', 'MUSANZE', 'NORTHERN PROVINCE', 'saccoinyongera@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NEW VISION SACCO', 'GACACA', 'MUSANZE', 'NORTHERN PROVINCE', 'sacconewvisiongacaca@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMURAVA SACCO GASHAKI', 'GASHAKI', 'MUSANZE', 'NORTHERN PROVINCE', 'umuravasaccogashaki@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('GATARAGA TWIBUMBE SACCO', 'GATARAGA', 'MUSANZE', 'NORTHERN PROVINCE', 'saccogataragatwibumbe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KIMONYI SACCO', 'KIMONYI', 'MUSANZE', 'NORTHERN PROVINCE', 'kimonyisacco506@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO ABIHUTA KINIGI', 'KINIGI', 'MUSANZE', 'NORTHERN PROVINCE', 'sakimanager@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ABAMUHOZA SACCO', 'MUHOZA', 'MUSANZE', 'NORTHERN PROVINCE', 'abamsacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO IRENGERE', 'MUKO', 'MUSANZE', 'NORTHERN PROVINCE', 'irengeresacco250@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUTUZO SACCO', 'MUSANZE', 'MUSANZE', 'NORTHERN PROVINCE', 'umutuzosacco2021@gmial.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IGIHONDOHONDOSACCO', 'NKOTSI', 'MUSANZE', 'NORTHERN PROVINCE', 'saccoigihondo@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('INYANGE SACCO', 'NYANGE', 'MUSANZE', 'NORTHERN PROVINCE', 'inyangesacco66@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ITEGANYIRIZE SACCO', 'REMERA', 'MUSANZE', 'NORTHERN PROVINCE', 'iteganyirizesacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMUSINGI RWAZA SACCO', 'RWAZA', 'MUSANZE', 'NORTHERN PROVINCE', 'saccoumusingi@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('NEZERWA 2020 SACCO', 'SHINGIRO', 'MUSANZE', 'NORTHERN PROVINCE', 'nezerwasacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO TWIHUTE KARAGO', 'KARAGO', 'NYABIHU', 'WESTERN PROVINCE', 'usaccokarago@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('KOPERATIVE IMBARUTSO Y''UBUKIRE', 'JOMBA', 'NYABIHU', 'WESTERN PROVINCE', 'imbarutsoyubukire@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IFUMBA Y''UBUKIRE', 'RAMBURA', 'NYABIHU', 'WESTERN PROVINCE', 'usaccorambura2@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('SACCO KIRA KABATWA', 'KABATWA', 'NYABIHU', 'WESTERN PROVINCE', 'saccokira1@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('IMIRASIRE SACCO', 'KINTOBO', 'NYABIHU', 'WESTERN PROVINCE', 'imirasirek@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('UMURAVA SACCO BIGOGWE', 'BIGOGWE', 'NYABIHU', 'WESTERN PROVINCE', 'saccobigogwe@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('ISOKO Y''AMAJYAMBERE SACCO', 'MUKAMIRA', 'NYABIHU', 'WESTERN PROVINCE', 'usaccomukamira@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE'),
('COOPERATIVE D''EPARGNE ET DE CREDIT DE RUGERA', 'RUGERA', 'NYABIHU', 'WESTERN PROVINCE', 'coecrusacco@gmail.com', 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)', 'ACTIVE')
ON CONFLICT DO NOTHING;


-- From: 20251008120000_enrich_saccos_with_umurenge_master.sql

-- Intentionally empty migration file
-- This migration was created as a placeholder or the changes were rolled back.
-- Keeping this file maintains the migration sequence integrity.
;


-- From: 20251008163451_4bd7b6a1-70fd-4fe9-824b-9466b41979af.sql

-- Intentionally empty migration file
-- This migration was created as a placeholder or the changes were rolled back.
-- Keeping this file maintains the migration sequence integrity.
;


-- From: 20251009121500_admin_branding_sms.sql

-- SACCO branding columns and SMS templates table
ALTER TABLE public.saccos
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS sms_sender TEXT;
-- SMS templates catalogue scoped to SACCOs
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES public.saccos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sacco_id, name)
);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS sms_templates_sacco_id_idx ON public.sms_templates(sacco_id);
-- ensure updated_at stays fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sms_templates_set_updated_at ON public.sms_templates;
CREATE TRIGGER sms_templates_set_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- From: 20251009140500_admin_enhancements.sql

-- Phase 6 admin enhancements: branding copy + template metadata
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'saccos' and column_name = 'pdf_header_text'
  ) then
    alter table public.saccos
      add column pdf_header_text text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'saccos' and column_name = 'pdf_footer_text'
  ) then
    alter table public.saccos
      add column pdf_footer_text text;
  end if;
end $$;
alter table public.sms_templates
  add column if not exists version integer not null default 1,
  add column if not exists tokens jsonb not null default '[]'::jsonb,
  add column if not exists description text;
alter table public.sms_templates drop constraint if exists sms_templates_sacco_id_name_key;
alter table public.sms_templates add constraint sms_templates_sacco_id_name_version_key unique (sacco_id, name, version);
create index if not exists sms_templates_version_idx on public.sms_templates(sacco_id, name, version);


-- From: 20251009170000_restrict_ledger_entries_visibility.sql

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Users can view ledger entries" ON public.ledger_entries;
-- Helper to determine account visibility for a user
CREATE OR REPLACE FUNCTION public.can_user_access_account(_account_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = _account_id
      AND (
        public.has_role(_user_id, 'SYSTEM_ADMIN')
        OR (
          a.owner_type = 'SACCO'
          AND a.owner_id = public.get_user_sacco(_user_id)
        )
        OR (
          a.owner_type = 'IKIMINA'
          AND EXISTS (
            SELECT 1
            FROM public.ibimina i
            WHERE i.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'MEMBER'
          AND EXISTS (
            SELECT 1
            FROM public.ikimina_members m
            JOIN public.ibimina i ON i.id = m.ikimina_id
            WHERE m.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'USER'
          AND a.owner_id = _user_id
        )
      )
  );
$$;
-- Restrictive policy tying ledger entries to accessible accounts
CREATE POLICY "Users can view ledger entries for accessible accounts"
  ON public.ledger_entries FOR SELECT
  USING (
    public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    OR public.can_user_access_account(ledger_entries.debit_id, auth.uid())
    OR public.can_user_access_account(ledger_entries.credit_id, auth.uid())
  );


-- From: 20251009170500_secure_ikimina_members.sql

-- Restrict direct access to unmasked ikimina member data
DROP POLICY IF EXISTS "Users can view members in their SACCO's ibimina" ON public.ikimina_members;
CREATE POLICY "System admins can view ikimina members"
  ON public.ikimina_members FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
DROP VIEW IF EXISTS public.ikimina_members_public;
CREATE VIEW public.ikimina_members_public
WITH (security_barrier = true)
AS
SELECT
  m.id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.status,
  m.joined_at,
  m.msisdn_masked AS msisdn,
  m.national_id_masked AS national_id,
  i.name AS ikimina_name,
  i.sacco_id
FROM public.ikimina_members m
JOIN public.ibimina i ON i.id = m.ikimina_id
WHERE
  public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  OR i.sacco_id = public.get_user_sacco(auth.uid());
GRANT SELECT ON public.ikimina_members_public TO authenticated;
GRANT SELECT ON public.ikimina_members_public TO service_role;


-- From: 20251009175000_prepare_saccos_search_columns.sql

-- Ensure SACCO search metadata columns exist before normalization cleanup
ALTER TABLE public.saccos
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS search_slug TEXT,
  ADD COLUMN IF NOT EXISTS search_document TSVECTOR;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS saccos_search_document_idx ON public.saccos USING GIN(search_document);


-- From: 20251009175910_feature_flags_configuration.sql

-- Create configuration key-value store for feature flags and operational settings
CREATE TABLE IF NOT EXISTS public.configuration (
  key TEXT PRIMARY KEY,
  description TEXT,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.configuration (key, description, value)
VALUES (
  'feature_flags',
  'Feature toggle map managed by operations. Example: {"enable_offline_queue": true}',
  '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins manage configuration"
  ON public.configuration
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "Staff can read configuration"
  ON public.configuration
  FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE OR REPLACE FUNCTION public.update_configuration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS configuration_set_updated_at ON public.configuration;
CREATE TRIGGER configuration_set_updated_at
  BEFORE UPDATE ON public.configuration
  FOR EACH ROW
  EXECUTE FUNCTION public.update_configuration_timestamp();


-- From: 20251009180500_add_mfa_and_trusted_devices.sql

-- Add MFA support columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret_enc BYTEA,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_methods TEXT[] NOT NULL DEFAULT ARRAY['TOTP']::TEXT[],
  ADD COLUMN IF NOT EXISTS mfa_backup_hashes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS last_mfa_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_mfa_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_mfa_step BIGINT;

-- Trusted device registry
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  ip_prefix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_devices_user_device_idx
  ON public.trusted_devices(user_id, device_id);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their trusted devices"
  ON public.trusted_devices
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "Users can manage their trusted devices"
  ON public.trusted_devices
  FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "System admins can insert trusted devices"
  ON public.trusted_devices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'SYSTEM_ADMIN'));


-- From: 20251009193000_add_sacco_viewer_role.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'SACCO_VIEWER'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'SACCO_VIEWER';
  END IF;
END $$;


-- From: 20251009203000_cleanup_saccos_schema.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Remove deprecated SACCO metadata columns and refresh derived fields
DROP INDEX IF EXISTS public.saccos_bnr_index_unique;
ALTER TABLE public.saccos
  DROP COLUMN IF EXISTS merchant_code,
  DROP COLUMN IF EXISTS bnr_index,
  DROP COLUMN IF EXISTS brand_color,
  DROP COLUMN IF EXISTS sms_sender,
  DROP COLUMN IF EXISTS pdf_header_text,
  DROP COLUMN IF EXISTS pdf_footer_text;
WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN NULLIF(trim(sector), '') IS NOT NULL THEN trim(sector)
      WHEN NULLIF(trim(sector_code), '') IS NOT NULL THEN trim(sector_code)
      ELSE trim(district)
    END AS normalized_sector,
    COALESCE(NULLIF(trim(province), ''), trim(district)) AS normalized_province,
    COALESCE(NULLIF(trim(category), ''), 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)') AS normalized_category,
    CASE
      WHEN NULLIF(trim(name), '') IS NOT NULL THEN trim(name)
      ELSE trim(district || ' ' || COALESCE(NULLIF(trim(sector), ''), trim(sector_code)))
    END AS normalized_name
  FROM public.saccos
), computed AS (
  SELECT
    n.id,
    n.normalized_sector,
    n.normalized_province,
    n.normalized_category,
    n.normalized_name,
    trim(both '-' FROM lower(regexp_replace(n.normalized_name, '[^a-z0-9]+', '-', 'g'))) AS normalized_search_slug,
    trim(both '-' FROM regexp_replace(upper(trim(s.district) || '-' || n.normalized_sector), '[^A-Z0-9]+', '-', 'g')) AS normalized_sector_code
  FROM normalized n
  JOIN public.saccos s ON s.id = n.id
)
UPDATE public.saccos AS s
SET
  sector = computed.normalized_sector,
  province = computed.normalized_province,
  category = computed.normalized_category,
  name = computed.normalized_name,
  search_slug = computed.normalized_search_slug,
  sector_code = computed.normalized_sector_code
FROM computed
WHERE s.id = computed.id;
DROP FUNCTION IF EXISTS public.search_saccos(TEXT, INTEGER, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.search_saccos(
  query TEXT,
  limit_count INTEGER DEFAULT 20,
  district_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  sector TEXT,
  district TEXT,
  province TEXT,
  email TEXT,
  category TEXT,
  similarity_score NUMERIC,
  rank_score NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      NULLIF(trim(query), '') AS sanitized_query,
      NULLIF(trim(district_filter), '') AS district_like,
      NULLIF(trim(province_filter), '') AS province_like,
      LEAST(GREATEST(COALESCE(limit_count, 20), 1), 100) AS limit_size
  ), expanded AS (
    SELECT
      params.limit_size,
      params.district_like,
      params.province_like,
      params.sanitized_query,
      CASE
        WHEN params.sanitized_query IS NULL THEN NULL
        ELSE websearch_to_tsquery('simple', params.sanitized_query)
      END AS ts_query
    FROM params
  ), ranked AS (
    SELECT
      s.id,
      s.name,
      s.sector,
      s.district,
      s.province,
      s.email,
      s.category,
      expanded.sanitized_query,
      expanded.ts_query,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(s.name, expanded.sanitized_query)
      END AS trigram_name,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query)
      END AS trigram_location,
      CASE
        WHEN expanded.ts_query IS NULL THEN 0
        ELSE ts_rank(s.search_document, expanded.ts_query)
      END AS ts_rank_score
    FROM public.saccos s
    CROSS JOIN expanded
    WHERE (
      expanded.sanitized_query IS NULL
      OR (
        (expanded.ts_query IS NOT NULL AND s.search_document @@ expanded.ts_query)
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(s.name, expanded.sanitized_query) > 0.1
        )
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query) > 0.1
        )
      )
    )
      AND (expanded.district_like IS NULL OR s.district ILIKE expanded.district_like)
      AND (expanded.province_like IS NULL OR s.province ILIKE expanded.province_like)
  )
  SELECT
    id,
    name,
    sector,
    district,
    province,
    email,
    category,
    GREATEST(trigram_name, trigram_location) AS similarity_score,
    ts_rank_score + GREATEST(trigram_name, trigram_location) AS rank_score
  FROM ranked
  ORDER BY rank_score DESC, similarity_score DESC, name ASC
  LIMIT (SELECT limit_size FROM expanded LIMIT 1)
$$;


-- From: 20251010220000_seed_admin_user.sql

-- Ensure the primary system admin account exists with the expected credentials
DO $$
DECLARE
  admin_id uuid;
  new_password_hash text := '$2b$10$Kp2OO179kzGCO/hFRjJk.OcbXRRMxc.pOaWegF79nQcZanVpITOFe';
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'info@ikanisa.com';

  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_current,
      email_change_token_new,
      recovery_token,
      phone_change_token,
      reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'info@ikanisa.com',
      new_password_hash,
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      '{}'::jsonb,
      false,
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = new_password_hash,
      updated_at = now(),
      confirmation_token = coalesce(confirmation_token, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      recovery_token = coalesce(recovery_token, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      reauthentication_token = coalesce(reauthentication_token, '')
    WHERE id = admin_id;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    INSERT INTO public.users (id, email, role, created_at, updated_at)
    VALUES (admin_id, 'info@ikanisa.com', 'SYSTEM_ADMIN', now(), now())
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          role = 'SYSTEM_ADMIN',
          updated_at = now();
  END IF;
END $$;


-- From: 20251010223000_enable_trigram_extension.sql

-- Ensure the pg_trgm extension is available for text similarity features
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- From: 20251011140000_reintroduce_brand_color_and_backfill.sql

-- Re-introduce optional brand_color for SACCO branding in the admin UI
-- This column was previously dropped in cleanup; restore it for branding controls.

alter table if exists public.saccos
  add column if not exists brand_color text;

-- Backfill a safe default brand accent where missing
update public.saccos
   set brand_color = coalesce(brand_color, '#009fdc')
 where brand_color is null;



-- From: 20251011153000_dashboard_materialization.sql

-- 0) Schemas and safe extension setup
create schema if not exists analytics;
do $do$
begin
  -- pg_net: prefer real extension if present; otherwise, create a stub in schema net
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    -- extension already installed; leave as-is
    null;
  elsif exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension pg_net';
  else
    execute 'create schema if not exists net';
    execute $func$
      create or replace function net.http_post(
        url text,
        headers jsonb default '{}'::jsonb,
        body jsonb default '{}'::jsonb,
        timeout_msec integer default null
      )
      returns jsonb
      language sql
      as $body$
        select jsonb_build_object('status', 'stubbed');
      $body$;
    $func$;
  end if;
end;
$do$;
-- pg_cron: install only if available (managed pg instances sometimes restrict it)
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and current_database() = 'postgres' then
    execute 'create extension if not exists pg_cron';
  end if;
end;
$do$;
-- 1) Aggregated payment rollups per SACCO and globally
create materialized view if not exists public.analytics_payment_rollups_mv as
with params as (
  select
    timezone('utc', current_date)::timestamp as today_start,
    timezone('utc', current_date - interval '7 days')::timestamp as week_start,
    date_trunc('month', timezone('utc', current_date)) as month_start,
    timezone('utc', now()) as refreshed_at
),
scoped as (
  select
    p.sacco_id,
    p.amount,
    p.status,
    p.occurred_at,
    params.today_start,
    params.week_start,
    params.month_start,
    params.refreshed_at
  from public.payments p
  cross join params
)
select
  sacco_id,
  sum(case when status in ('POSTED', 'SETTLED') and occurred_at >= month_start then amount else 0 end) as month_total,
  sum(case when status in ('POSTED', 'SETTLED') and occurred_at >= week_start then amount else 0 end) as week_total,
  sum(case when status in ('POSTED', 'SETTLED') and occurred_at >= today_start then amount else 0 end) as today_total,
  count(*) filter (where status = 'UNALLOCATED') as unallocated_count,
  max(occurred_at) filter (where status in ('POSTED', 'SETTLED')) as latest_payment_at,
  max(refreshed_at) as refreshed_at
from scoped
group by rollup(sacco_id);
-- Unique index needed for CONCURRENTLY refreshes
create unique index if not exists analytics_payment_rollups_mv_sacco_idx
  on public.analytics_payment_rollups_mv ((coalesce(sacco_id::text, '00000000-0000-0000-0000-000000000000')));
-- 2) Ikimina level monthly aggregates
create materialized view if not exists public.analytics_ikimina_monthly_mv as
with params as (
  select
    date_trunc('month', timezone('utc', current_date)) as month_start,
    timezone('utc', now()) as refreshed_at
)
select
  i.id as ikimina_id,
  i.sacco_id,
  i.name,
  i.code,
  i.status,
  i.updated_at,
  coalesce(sum(case when p.status in ('POSTED', 'SETTLED') and p.occurred_at >= params.month_start then p.amount else 0 end), 0) as month_total,
  coalesce(count(distinct case when p.status in ('POSTED', 'SETTLED') and p.occurred_at >= params.month_start then p.member_id end), 0) as contributing_members,
  count(distinct case when m.status = 'ACTIVE' then m.id end) as active_member_count,
  max(p.occurred_at) filter (where p.status in ('POSTED', 'SETTLED')) as last_contribution_at,
  max(params.refreshed_at) as refreshed_at
from public.ibimina i
cross join params
left join public.payments p on p.ikimina_id = i.id
left join public.ikimina_members m on m.ikimina_id = i.id
group by i.id, i.sacco_id, i.name, i.code, i.status, i.updated_at, params.month_start;
create unique index if not exists analytics_ikimina_monthly_mv_pk
  on public.analytics_ikimina_monthly_mv (ikimina_id);
create index if not exists analytics_ikimina_monthly_mv_sacco_idx
  on public.analytics_ikimina_monthly_mv (sacco_id, month_total desc);
-- 3) Member last-payment snapshots
create materialized view if not exists public.analytics_member_last_payment_mv as
with params as (
  select timezone('utc', now()) as refreshed_at
)
select
  m.id as member_id,
  i.sacco_id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.msisdn,
  m.status,
  i.name as ikimina_name,
  max(case when p.status in ('POSTED', 'SETTLED') then p.occurred_at end) as last_payment_at,
  coalesce(
    date_part('day', max(params.refreshed_at) - max(case when p.status in ('POSTED', 'SETTLED') then p.occurred_at end)),
    999
  )::int as days_since_last,
  max(params.refreshed_at) as refreshed_at
from public.ikimina_members m
left join public.ibimina i on i.id = m.ikimina_id
left join public.payments p on p.member_id = m.id
cross join params
group by m.id, i.sacco_id, m.ikimina_id, m.member_code, m.full_name, m.msisdn, m.status, i.name;
create unique index if not exists analytics_member_last_payment_mv_pk
  on public.analytics_member_last_payment_mv (member_id);
create index if not exists analytics_member_last_payment_mv_sacco_idx
  on public.analytics_member_last_payment_mv (sacco_id, days_since_last desc);
-- 4) First refresh (safe: ignore errors on empty datasets)
do $$
begin
  begin
    refresh materialized view public.analytics_payment_rollups_mv;
    refresh materialized view public.analytics_ikimina_monthly_mv;
    refresh materialized view public.analytics_member_last_payment_mv;
  exception when others then
    -- allow migration to proceed even if initial refresh hits transient issues
    null;
  end;
end$$;
-- 5) Failure log table for webhook retries
create table if not exists analytics.cache_invalidation_failures (
  id bigserial primary key,
  event text not null,
  sacco_id uuid null,
  error_message text not null,
  occurred_at timestamptz not null default timezone('utc', now())
);
-- 6) Refresh function (CONCURRENTLY requires the unique indexes created above)
create or replace function analytics.refresh_dashboard_materialized_views()
returns void
language plpgsql
security definer
set search_path = public, analytics
as $$
begin
  refresh materialized view concurrently public.analytics_payment_rollups_mv;
  refresh materialized view concurrently public.analytics_ikimina_monthly_mv;
  refresh materialized view concurrently public.analytics_member_last_payment_mv;
end;
$$;
-- 7) Cron job (only if pg_cron exists)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Unschedule if present
    perform cron.unschedule('refresh-dashboard-materialized-views')
    where exists (select 1 from cron.job where jobname = 'refresh-dashboard-materialized-views');

    -- Schedule every 5 minutes
    perform cron.schedule(
      'refresh-dashboard-materialized-views',
      '*/5 * * * *',
      'select analytics.refresh_dashboard_materialized_views();'
    )
    where not exists (select 1 from cron.job where jobname = 'refresh-dashboard-materialized-views');
  end if;
end$$;
-- 8) Webhook emitter + triggers (safe with or without pg_net; stub returns {"status":"stubbed"})
create or replace function analytics.emit_cache_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public, analytics
as $$
declare
  webhook_url   text;
  webhook_token text;
  headers       jsonb;
  sacco_ids     uuid[];
  sacco_id      uuid;
  payload       jsonb;
  tags          text[];
begin
  select value::text into webhook_url
  from public.configuration
  where key = 'analytics_cache_webhook_url';

  if webhook_url is null or length(trim(webhook_url)) = 0 then
    return null;
  end if;

  select value::text into webhook_token
  from public.configuration
  where key = 'analytics_cache_webhook_token';

  headers := jsonb_build_object('content-type', 'application/json');
  if webhook_token is not null then
    headers := headers || jsonb_build_object('authorization', 'Bearer ' || webhook_token);
  end if;

  if TG_OP = 'INSERT' then
    execute 'select array_agg(distinct sacco_id) from new_rows' into sacco_ids;
  elsif TG_OP = 'DELETE' then
    execute 'select array_agg(distinct sacco_id) from old_rows' into sacco_ids;
  else
    execute '
      select array_agg(distinct sacco_id)
      from (
        select sacco_id from new_rows
        union
        select sacco_id from old_rows
      ) scoped
    ' into sacco_ids;
  end if;

  if sacco_ids is null or array_length(sacco_ids, 1) is null then
    sacco_ids := array[null::uuid];
  else
    sacco_ids := array_append(sacco_ids, null::uuid); -- include global/all tag
  end if;

  foreach sacco_id in array sacco_ids loop
    tags := array['dashboard:summary', 'analytics:executive:' || coalesce(sacco_id::text, 'all')];
    if sacco_id is not null then
      tags := array_append(tags, 'sacco:' || sacco_id::text);
    end if;

    payload := jsonb_build_object(
      'event', TG_ARGV[0],
      'saccoId', sacco_id,
      'tags', tags
    );

    begin
      perform net.http_post(
        url := webhook_url,
        headers := headers,
        body := payload,
        timeout_msec := 750
      );
    exception when others then
      insert into analytics.cache_invalidation_failures(event, sacco_id, error_message)
      values (TG_ARGV[0], sacco_id, sqlerrm);
    end;
  end loop;

  return null;
end;
$$;
-- 9) Triggers on payments and recon_exceptions
drop trigger if exists payments_cache_invalidation on public.payments;
drop trigger if exists payments_cache_invalidation_insert on public.payments;
drop trigger if exists payments_cache_invalidation_update on public.payments;
drop trigger if exists payments_cache_invalidation_delete on public.payments;
create trigger payments_cache_invalidation_insert
  after insert on public.payments
  referencing new table as new_rows
  for each statement execute function analytics.emit_cache_invalidation('payments_changed');
create trigger payments_cache_invalidation_update
  after update on public.payments
  referencing new table as new_rows old table as old_rows
  for each statement execute function analytics.emit_cache_invalidation('payments_changed');
create trigger payments_cache_invalidation_delete
  after delete on public.payments
  referencing old table as old_rows
  for each statement execute function analytics.emit_cache_invalidation('payments_changed');
do $$
begin
  if to_regclass('public.recon_exceptions') is not null then
    drop trigger if exists recon_cache_invalidation on public.recon_exceptions;
    drop trigger if exists recon_cache_invalidation_insert on public.recon_exceptions;
    drop trigger if exists recon_cache_invalidation_update on public.recon_exceptions;
    drop trigger if exists recon_cache_invalidation_delete on public.recon_exceptions;

    create trigger recon_cache_invalidation_insert
      after insert on public.recon_exceptions
      referencing new table as new_rows
      for each statement execute function analytics.emit_cache_invalidation('recon_exceptions_changed');

    create trigger recon_cache_invalidation_update
      after update on public.recon_exceptions
      referencing new table as new_rows old table as old_rows
      for each statement execute function analytics.emit_cache_invalidation('recon_exceptions_changed');

    create trigger recon_cache_invalidation_delete
      after delete on public.recon_exceptions
      referencing old table as old_rows
      for each statement execute function analytics.emit_cache_invalidation('recon_exceptions_changed');
  end if;
end;
$$;


-- From: 20251011154000_fix_consume_rate_limit.sql

DROP FUNCTION IF EXISTS public.consume_rate_limit(
  TEXT,
  INTEGER,
  INTEGER
);

CREATE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_max_hits INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $function$
DECLARE
  existing public.rate_limit_counters%ROWTYPE;
  max_allowed INTEGER := COALESCE(p_max_hits, 5);
  window_seconds INTEGER := GREATEST(COALESCE(p_window_seconds, 300), 1);
BEGIN
  SELECT * INTO existing
  FROM public.rate_limit_counters
  WHERE key = p_key;

  IF NOT FOUND OR existing.window_expires < NOW() THEN
    INSERT INTO public.rate_limit_counters(key, hits, window_expires)
    VALUES (p_key, 1, NOW() + make_interval(secs => window_seconds))
    ON CONFLICT (key) DO UPDATE
      SET hits = EXCLUDED.hits,
          window_expires = EXCLUDED.window_expires;
    RETURN TRUE;
  END IF;

  IF existing.hits >= max_allowed THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limit_counters
    SET hits = existing.hits + 1,
        window_expires = existing.window_expires
  WHERE key = p_key;

  RETURN TRUE;
END;
$function$;


-- From: 20251012120000_sacco_plus_schema.sql

-- SACCO+ greenfield schema, security, and job orchestration
-- Creates SACCO-scoped application schema, operational helpers, RLS policies,
-- and scheduled procedures for nightly reconciliation and monthly close.

-- 1. Extensions and schemas ---------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
do $$
begin
  if current_database() = 'postgres'
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
end;
$$;

create schema if not exists app;
create schema if not exists ops;

-- 2. Core entities ------------------------------------------------------------
create table if not exists app.saccos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  sector_code text not null,
  merchant_code text not null,
  status text not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists saccos_touch_updated_at on app.saccos;
create trigger saccos_touch_updated_at
before update on app.saccos
for each row
execute function public.set_updated_at();

create table if not exists app.ikimina (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid not null references app.saccos(id) on delete cascade,
  code text not null unique,
  name text not null,
  type text not null default 'ASCA',
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists ikimina_touch_updated_at on app.ikimina;
create trigger ikimina_touch_updated_at
before update on app.ikimina
for each row
execute function public.set_updated_at();

create table if not exists app.members (
  id uuid primary key default gen_random_uuid(),
  ikimina_id uuid not null references app.ikimina(id) on delete cascade,
  sacco_id uuid not null references app.saccos(id) on delete cascade,
  member_code text,
  full_name text not null,
  national_id text,
  national_id_encrypted text,
  national_id_hash text,
  national_id_masked text,
  msisdn text not null,
  msisdn_encrypted text,
  msisdn_hash text,
  msisdn_masked text,
  joined_at timestamptz not null default timezone('UTC', now()),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now()),
  unique (ikimina_id, member_code)
);

create index if not exists idx_members_sacco on app.members(sacco_id);
create index if not exists idx_members_msisdn_hash on app.members(msisdn_hash);
create index if not exists idx_members_national_hash on app.members(national_id_hash);

drop trigger if exists members_touch_updated_at on app.members;
create trigger members_touch_updated_at
before update on app.members
for each row
execute function public.set_updated_at();

create table if not exists app.accounts (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id) on delete set null,
  owner_type text not null, -- IKIMINA|SACCO|MOMO_CLEARING|MOMO_SETTLEMENT|FEE|AWARD
  owner_id uuid,
  currency text not null default 'RWF',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_accounts_owner on app.accounts(owner_type, owner_id);
create index if not exists idx_accounts_sacco on app.accounts(sacco_id);

create table if not exists app.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id) on delete set null,
  debit_id uuid not null references app.accounts(id),
  credit_id uuid not null references app.accounts(id),
  amount bigint not null check (amount > 0),
  currency text not null default 'RWF',
  value_date date not null default current_date,
  external_id text,
  memo text,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_ledger_created on app.ledger_entries(created_at desc);
create index if not exists idx_ledger_external on app.ledger_entries(external_id);

create table if not exists app.import_files (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id),
  type text not null check (type in ('STATEMENT','SMS')),
  filename text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default timezone('UTC', now()),
  status text not null default 'RECEIVED',
  error text
);

create table if not exists app.sms_inbox (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id),
  raw_text text not null,
  msisdn text,
  msisdn_encrypted text,
  msisdn_hash text,
  msisdn_masked text,
  received_at timestamptz not null,
  vendor_meta jsonb,
  parsed_json jsonb,
  parse_source text,
  confidence numeric,
  status text not null default 'NEW',
  error text,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_sms_sacco_status on app.sms_inbox(sacco_id, status);
create index if not exists idx_sms_received_at on app.sms_inbox(received_at desc);
create index if not exists idx_sms_msisdn_hash on app.sms_inbox(msisdn_hash);

create table if not exists app.payments (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'SMS',
  sacco_id uuid not null references app.saccos(id),
  ikimina_id uuid references app.ikimina(id),
  member_id uuid references app.members(id),
  msisdn text not null,
  msisdn_encrypted text,
  msisdn_hash text,
  msisdn_masked text,
  amount bigint not null,
  currency text not null default 'RWF',
  txn_id text not null,
  reference text,
  occurred_at timestamptz not null,
  status text not null default 'PENDING',
  source_id uuid references app.sms_inbox(id),
  ai_version text,
  confidence numeric,
  created_at timestamptz not null default timezone('UTC', now()),
  unique (txn_id, amount, occurred_at)
);

create index if not exists idx_payments_sacco_status on app.payments(sacco_id, status);
create index if not exists idx_payments_msisdn_hash on app.payments(msisdn_hash);
create index if not exists idx_payments_txn_id on app.payments(txn_id);
create index if not exists idx_payments_reference on app.payments(reference);
create index if not exists idx_payments_occurred_at on app.payments(occurred_at desc);

create table if not exists app.recon_exceptions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references app.payments(id) on delete cascade,
  reason text not null,
  status text not null default 'OPEN',
  note text,
  created_at timestamptz not null default timezone('UTC', now()),
  resolved_at timestamptz
);

create index if not exists idx_recon_payment on app.recon_exceptions(payment_id);
create index if not exists idx_recon_status on app.recon_exceptions(status);

create table if not exists app.audit_logs (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id),
  actor uuid,
  action text not null,
  entity text,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_audit_entity on app.audit_logs(entity, entity_id);
create index if not exists idx_audit_actor on app.audit_logs(actor);

create table if not exists app.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sacco_id uuid references app.saccos(id),
  role text not null default 'SACCO_STAFF',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists user_profiles_touch_updated_at on app.user_profiles;
create trigger user_profiles_touch_updated_at
before update on app.user_profiles
for each row
execute function public.set_updated_at();

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  insert into app.user_profiles(user_id, role, sacco_id)
  values (new.id, 'SACCO_STAFF', null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists app_on_auth_user_created on auth.users;
create trigger app_on_auth_user_created
after insert on auth.users
for each row
execute function app.handle_new_auth_user();

create table if not exists app.devices_trusted (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null,
  device_label text,
  last_seen_at timestamptz not null default timezone('UTC', now()),
  expires_at timestamptz not null default timezone('UTC', now()) + interval '90 days',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  unique (user_id, device_hash)
);

-- 3. Operational helpers ------------------------------------------------------
create table if not exists ops.rate_limits (
  bucket_key text not null,
  route text not null,
  window_started timestamptz not null,
  count integer not null default 0,
  primary key (bucket_key, route, window_started)
);

create index if not exists idx_rate_limits_expiry on ops.rate_limits(window_started);

create or replace function ops.consume_rate_limit(
  bucket_key_raw text,
  route text,
  max_hits integer,
  window_seconds integer
)
returns boolean
language plpgsql
as $$
declare
  span integer := greatest(window_seconds, 1);
  now_utc timestamptz := timezone('UTC', now());
  window_start timestamptz := now_utc - make_interval(secs => mod(floor(extract(epoch from now_utc))::int, span));
  bucket_key text := coalesce(nullif(trim(bucket_key_raw), ''), 'anonymous');
  new_count integer;
begin
  insert into ops.rate_limits(bucket_key, route, window_started, count)
  values (bucket_key, route, window_start, 1)
  on conflict (bucket_key, route, window_started)
  do update set count = ops.rate_limits.count + 1
  returning count into new_count;

  delete from ops.rate_limits
  where window_started < now_utc - make_interval(secs => span * 2);

  return new_count <= max_hits;
end;
$$;

create or replace function public.consume_route_rate_limit(
  bucket_key text,
  route text,
  max_hits integer,
  window_seconds integer
)
returns boolean
language sql
stable
security definer
set search_path = public, ops
as $$
  select ops.consume_rate_limit(bucket_key, route, max_hits, window_seconds);
$$;

create table if not exists ops.idempotency (
  user_id uuid not null,
  key text not null,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  expires_at timestamptz not null,
  primary key (user_id, key)
);

create index if not exists idx_idempotency_expires on ops.idempotency(expires_at);

-- 4. Utility functions --------------------------------------------------------
create or replace function app.current_sacco()
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select sacco_id
  from app.user_profiles
  where user_id = auth.uid()
$$;

create or replace function app.current_role()
returns text
language sql
stable
security definer
set search_path = app, public
as $$
  select role
  from app.user_profiles
  where user_id = auth.uid()
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SYSTEM_ADMIN',
    false
  )
  or coalesce(app.current_role() = 'SYSTEM_ADMIN', false)
$$;

create or replace function app.member_sacco(member_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select sacco_id
  from app.members
  where id = member_id
$$;

create or replace function app.payment_sacco(payment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select sacco_id
  from app.payments
  where id = payment_id
$$;

create or replace function app.account_sacco(account_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select sacco_id
  from app.accounts
  where id = account_id
$$;

create or replace function app.account_balance(account_id uuid)
returns numeric
language sql
stable
security definer
set search_path = app, public
as $$
  with movements as (
    select
      sum(case when credit_id = account_id then amount else 0 end) as credits,
      sum(case when debit_id = account_id then amount else 0 end) as debits
    from app.ledger_entries
    where debit_id = account_id or credit_id = account_id
  )
  select coalesce(credits, 0) - coalesce(debits, 0)
  from movements;
$$;

create or replace function public.account_balance(account_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, app
as $$
  select app.account_balance(account_id);
$$;

-- 5. Row level security -------------------------------------------------------
alter table app.user_profiles enable row level security;
alter table app.user_profiles force row level security;
alter table app.saccos enable row level security;
alter table app.saccos force row level security;
alter table app.ikimina enable row level security;
alter table app.ikimina force row level security;
alter table app.members enable row level security;
alter table app.members force row level security;
alter table app.payments enable row level security;
alter table app.payments force row level security;
alter table app.recon_exceptions enable row level security;
alter table app.recon_exceptions force row level security;
alter table app.accounts enable row level security;
alter table app.accounts force row level security;
alter table app.ledger_entries enable row level security;
alter table app.ledger_entries force row level security;
alter table app.sms_inbox enable row level security;
alter table app.sms_inbox force row level security;
alter table app.import_files enable row level security;
alter table app.audit_logs enable row level security;
alter table app.audit_logs force row level security;
alter table app.devices_trusted enable row level security;
alter table ops.rate_limits enable row level security;
alter table ops.idempotency enable row level security;

-- user_profiles
create policy user_self_read
  on app.user_profiles
  for select
  using (auth.uid() = user_id);

create policy admin_manage_profiles
  on app.user_profiles
  for all
  using (app.is_admin());

-- saccos
create policy sacco_select_admin
  on app.saccos
  for select
  using (app.is_admin());

create policy sacco_select_staff
  on app.saccos
  for select
  using (id = app.current_sacco());

create policy sacco_manage_admin
  on app.saccos
  for all
  using (app.is_admin());

-- ikimina
create policy ikimina_select
  on app.ikimina
  for select
  using (app.is_admin() or sacco_id = app.current_sacco());

create policy ikimina_modify
  on app.ikimina
  for all
  using (app.is_admin() or sacco_id = app.current_sacco());

-- members
create policy members_select
  on app.members
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy members_modify
  on app.members
  for all
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

-- payments
create policy payments_select
  on app.payments
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy payments_insert
  on app.payments
  for insert
  with check (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy payments_update
  on app.payments
  for update
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

-- recon exceptions
create policy recon_select
  on app.recon_exceptions
  for select
  using (
    app.is_admin()
    or app.payment_sacco(payment_id) = app.current_sacco()
  );

create policy recon_modify
  on app.recon_exceptions
  for all
  using (
    app.is_admin()
    or app.payment_sacco(payment_id) = app.current_sacco()
  );

-- accounts
create policy accounts_select
  on app.accounts
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy accounts_modify_admin
  on app.accounts
  for all
  using (app.is_admin());

-- ledger entries
create policy ledger_select
  on app.ledger_entries
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy ledger_modify_admin
  on app.ledger_entries
  for all
  using (app.is_admin());

-- sms inbox
create policy sms_select
  on app.sms_inbox
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy sms_modify
  on app.sms_inbox
  for all
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

-- import files
create policy import_select
  on app.import_files
  for select
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

create policy import_modify
  on app.import_files
  for all
  using (
    app.is_admin()
    or sacco_id = app.current_sacco()
  );

-- audit logs
create policy audit_select
  on app.audit_logs
  for select
  using (
    app.is_admin()
    or actor = auth.uid()
  );

create policy audit_insert
  on app.audit_logs
  for insert
  with check (true);

-- devices trusted
create policy devices_self_manage
  on app.devices_trusted
  for all
  using (
    auth.uid() = user_id
    or app.is_admin()
  )
  with check (
    auth.uid() = user_id
    or app.is_admin()
  );

-- ops.rate_limits
create policy rate_limits_admin
  on ops.rate_limits
  for all
  using (app.is_admin())
  with check (app.is_admin());

-- ops.idempotency
create policy idempotency_user_access
  on ops.idempotency
  for select
  using (auth.uid() = user_id or app.is_admin());

create policy idempotency_user_write
  on ops.idempotency
  for insert
  with check (auth.uid() = user_id or app.is_admin());

create policy idempotency_user_update
  on ops.idempotency
  for update
  using (auth.uid() = user_id or app.is_admin());

-- 6. Stored procedures --------------------------------------------------------
-- Stored Procedure: Nightly Reconciliation
-- Reopens all closed reconciliation exceptions for review
-- This procedure runs nightly at 2 AM via pg_cron to ensure that any
-- previously closed exceptions are re-examined. This helps catch cases where
-- payments may have been incorrectly matched or need additional review.
-- 
-- Schedule: Daily at 2:00 AM UTC (via cron job 00-nightly-recon)
-- Impact: Reopens all non-OPEN exceptions by setting status to OPEN and clearing resolved_at
create or replace procedure ops.sp_nightly_recon()
language plpgsql
as $$
begin
  -- Widen matching window for potential duplicates and reopen unresolved items.
  update app.recon_exceptions re
    set status = 'OPEN',
        resolved_at = null
  where re.status <> 'OPEN';
end;
$$;

-- Stored Procedure: Monthly Close
-- Creates an immutable audit log entry marking the end of a monthly period
-- This procedure runs on the 1st of each month at 2:10 AM to create a
-- checkpoint in the audit trail. Used for regulatory reporting and ensures
-- a clear audit trail of monthly accounting periods.
-- 
-- Schedule: Monthly on the 1st at 2:10 AM UTC (via cron job 01-monthly-close)
-- Impact: Inserts a MONTHLY_CLOSE audit log entry with UTC timestamp
create or replace procedure ops.sp_monthly_close()
language plpgsql
as $$
begin
  insert into app.audit_logs(action, entity, diff, created_at)
  values (
    'MONTHLY_CLOSE',
    'SYSTEM',
    jsonb_build_object('timestamp', timezone('UTC', now())),
    timezone('UTC', now())
  );
end;
$$;

-- 7. Scheduling ---------------------------------------------------------------
do $$
declare
  nightly_id int;
begin
  if current_database() = 'postgres'
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into nightly_id from cron.job where jobname = '00-nightly-recon';
    if nightly_id is null then
      select cron.schedule('00-nightly-recon', '0 2 * * *', 'call ops.sp_nightly_recon();') into nightly_id;
    else
      perform cron.unschedule('00-nightly-recon');
      select cron.schedule('00-nightly-recon', '0 2 * * *', 'call ops.sp_nightly_recon();') into nightly_id;
    end if;
  end if;
end;
$$;

do $$
declare
  monthly_id int;
begin
  if current_database() = 'postgres'
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into monthly_id from cron.job where jobname = '01-monthly-close';
    if monthly_id is null then
      select cron.schedule('01-monthly-close', '10 2 1 * *', 'call ops.sp_monthly_close();') into monthly_id;
    else
      perform cron.unschedule('01-monthly-close');
      select cron.schedule('01-monthly-close', '10 2 1 * *', 'call ops.sp_monthly_close();') into monthly_id;
    end if;
  end if;
end;
$$;

-- 8. Housekeeping helpers -----------------------------------------------------
comment on table app.saccos is 'Registered SACCOs participating in SACCO+ system.';
comment on table app.ikimina is 'Local savings groups belonging to a SACCO.';
comment on table app.members is 'Members enrolled under a SACCO/Ikimina pair.';
comment on table app.accounts is 'Ledger accounts for double-entry bookkeeping.';
comment on table app.ledger_entries is 'Ledger movements with debit/credit enforcement.';
comment on table app.payments is 'Inbound payments derived from SMS or reconciliations.';
comment on table app.sms_inbox is 'Inbound SMS payloads awaiting parsing and mapping.';
comment on table app.recon_exceptions is 'Payments requiring manual resolution.';
comment on table app.audit_logs is 'Immutable audit trail for privileged actions.';
comment on table app.import_files is 'Uploaded files (statements, SMS dumps) for ingestion.';
comment on table app.user_profiles is 'SACCO-scoped roles mapped to auth.users.';
comment on table app.devices_trusted is 'Trusted device fingerprints for MFA bypass.';
comment on table ops.rate_limits is 'Per-route rate limiter buckets (ip/user/service).';
comment on table ops.idempotency is 'Idempotent request ledger for Edge functions.';


-- From: 20251012183000_add_passkeys_mfa.sql

-- Passkey (WebAuthn) storage and MFA recovery codes

create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credential_id text not null,
  credential_public_key bytea not null,
  sign_count bigint not null default 0,
  transports text[] not null default array[]::text[],
  backed_up boolean not null default false,
  device_type text,
  friendly_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists webauthn_credentials_credential_id_idx
  on public.webauthn_credentials (credential_id);

alter table public.webauthn_credentials enable row level security;

create policy webauthn_credentials_self_manage
  on public.webauthn_credentials
  for all
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

alter table public.users
  add column if not exists mfa_passkey_enrolled boolean not null default false;

create table if not exists public.mfa_recovery_codes (
  user_id uuid primary key references public.users(id) on delete cascade,
  codes text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_mfa_recovery_codes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_mfa_recovery_codes_touch on public.mfa_recovery_codes;
create trigger trg_mfa_recovery_codes_touch
  before update on public.mfa_recovery_codes
  for each row
  execute function public.touch_mfa_recovery_codes();

alter table public.mfa_recovery_codes enable row level security;

create policy mfa_recovery_codes_self_manage
  on public.mfa_recovery_codes
  for all
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'SYSTEM_ADMIN'));


-- From: 20251013100000_add_mfa_email_codes.sql

-- Email-based MFA support
create table if not exists app.mfa_email_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempt_count int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_mfa_email_codes_user_active
  on app.mfa_email_codes (user_id, expires_at)
  where consumed_at is null;

create index if not exists idx_mfa_email_codes_created
  on app.mfa_email_codes (created_at);

comment on table app.mfa_email_codes is 'One-time email verification codes for MFA channel.';


-- From: 20251015000000_client_app.sql

-- Deprecated legacy client app bootstrap.
-- The real runtime now lives in app.* with public views recreated later.
-- This migration is intentionally left as a no-op so historical records remain
-- in supabase_migrations while replays on upgraded databases do not fail.

do $$
begin
  raise notice 'Skipping 20251015_client_app (deprecated legacy bootstrap).';
end;
$$;


-- From: 20251015190000_member_app_tables.sql

-- Member app tables and policies
CREATE TYPE public.member_id_type AS ENUM ('NID', 'DL', 'PASSPORT');
CREATE TYPE public.join_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.group_invite_status AS ENUM ('sent', 'accepted', 'expired');
CREATE TYPE public.notification_type AS ENUM ('new_member', 'payment_confirmed', 'invite_accepted');

CREATE TABLE IF NOT EXISTS public.members_app_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_msisdn TEXT NOT NULL,
  momo_msisdn TEXT NOT NULL,
  id_type public.member_id_type,
  id_number TEXT,
  id_files JSONB,
  ocr_json JSONB,
  lang TEXT DEFAULT 'en',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_saccos (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sacco_id UUID NOT NULL REFERENCES public.saccos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, sacco_id)
);

CREATE TABLE IF NOT EXISTS public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sacco_id UUID NOT NULL REFERENCES public.saccos(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.ibimina(id) ON DELETE CASCADE,
  note TEXT,
  status public.join_request_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.ibimina(id) ON DELETE CASCADE,
  invitee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_msisdn TEXT,
  token TEXT NOT NULL UNIQUE,
  status public.group_invite_status DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ON public.members_app_profiles (user_id);
CREATE INDEX IF NOT EXISTS ON public.user_saccos (user_id);
CREATE INDEX IF NOT EXISTS ON public.user_saccos (sacco_id);
CREATE INDEX IF NOT EXISTS ON public.join_requests (user_id);
CREATE INDEX IF NOT EXISTS ON public.join_requests (group_id);
CREATE INDEX IF NOT EXISTS ON public.group_invites (token);
CREATE INDEX IF NOT EXISTS ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.members_app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saccos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own profile" ON public.members_app_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Members can insert own profile" ON public.members_app_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update own profile" ON public.members_app_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members manage their SACCO list" ON public.user_saccos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members view their join requests" ON public.join_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Members create join requests" ON public.join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can manage join requests" ON public.join_requests
  FOR ALL USING (
    public.has_role(auth.uid(), 'SYSTEM_ADMIN') OR
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.sacco_id = join_requests.sacco_id
    )
  );

CREATE POLICY "Members view their invites" ON public.group_invites
  FOR SELECT USING (
    (invitee_user_id IS NOT NULL AND invitee_user_id = auth.uid())
    OR token = COALESCE(current_setting('request.jwt.claims', true), '{}')::json->>'invite_token'
  );

CREATE POLICY "Members accept their invites" ON public.group_invites
  FOR UPDATE USING (
    invitee_user_id = auth.uid()
    OR token = COALESCE(current_setting('request.jwt.claims', true), '{}')::json->>'invite_token'
  )
  WITH CHECK (
    invitee_user_id = auth.uid()
    OR token = COALESCE(current_setting('request.jwt.claims', true), '{}')::json->>'invite_token'
  );

CREATE POLICY "Service role manages invites" ON public.group_invites
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Members view their notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Members update their notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow members to view SACCOs they added
CREATE POLICY "Members view linked SACCOs" ON public.saccos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_saccos us
      WHERE us.sacco_id = saccos.id AND us.user_id = auth.uid()
    )
  );

-- Allow members to view ibimina in their SACCOs
CREATE POLICY "Members view ibimina via membership" ON public.ibimina
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_saccos us
      WHERE us.sacco_id = ibimina.sacco_id AND us.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  );

-- Notifications insert by service role only
CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');


-- From: 20251016090000_add_report_subscriptions.sql

set search_path = app, public, auth;

create table if not exists app.report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid not null references app.saccos(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  email text not null,
  frequency text not null check (frequency in ('DAILY','WEEKLY','MONTHLY')),
  format text not null check (format in ('PDF','CSV')),
  delivery_hour smallint not null default 6 check (delivery_hour between 0 and 23),
  delivery_day smallint,
  filters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz not null default timezone('UTC', now()),
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists report_subscriptions_touch_updated_at on app.report_subscriptions;
create trigger report_subscriptions_touch_updated_at
before update on app.report_subscriptions
for each row
execute function public.set_updated_at();

create index if not exists idx_report_subscriptions_sacco_active
  on app.report_subscriptions (sacco_id, is_active);

create index if not exists idx_report_subscriptions_next_run
  on app.report_subscriptions (next_run_at);

alter table app.report_subscriptions enable row level security;

drop policy if exists report_subscriptions_select on app.report_subscriptions;
create policy report_subscriptions_select
  on app.report_subscriptions
  for select
  using (app.is_admin() or sacco_id = app.current_sacco());

drop policy if exists report_subscriptions_insert on app.report_subscriptions;
create policy report_subscriptions_insert
  on app.report_subscriptions
  for insert
  with check (app.is_admin() or sacco_id = app.current_sacco());

drop policy if exists report_subscriptions_update on app.report_subscriptions;
create policy report_subscriptions_update
  on app.report_subscriptions
  for update
  using (app.is_admin() or sacco_id = app.current_sacco())
  with check (app.is_admin() or sacco_id = app.current_sacco());

drop policy if exists report_subscriptions_delete on app.report_subscriptions;
create policy report_subscriptions_delete
  on app.report_subscriptions
  for delete
  using (app.is_admin() or sacco_id = app.current_sacco());

comment on table app.report_subscriptions is 'Scheduled SACCO report exports managed from the Ibimina reports workspace.';
comment on column app.report_subscriptions.filters is 'JSON filter payload (saccoId, from, to).';
comment on column app.report_subscriptions.delivery_hour is 'Hour of day (UTC) to queue the export.';
comment on column app.report_subscriptions.delivery_day is 'For WEEKLY (0-6 Sunday-Saturday) or MONTHLY (1-28) schedules.';


-- From: 20251018010458_remote_schema.sql

set check_function_bodies = off;

create schema if not exists app_helpers;

CREATE OR REPLACE FUNCTION analytics.emit_cache_invalidation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'analytics'
AS $function$
declare
  webhook_url   text;
  webhook_token text;
  headers       jsonb;
  sacco_ids     uuid[];
  sacco_id      uuid;
  payload       jsonb;
  tags          text[];
begin
  select value::text into webhook_url
  from public.configuration
  where key = 'analytics_cache_webhook_url';

  if webhook_url is null or length(trim(webhook_url)) = 0 then
    return null;
  end if;

  select value::text into webhook_token
  from public.configuration
  where key = 'analytics_cache_webhook_token';

  headers := jsonb_build_object('content-type', 'application/json');
  if webhook_token is not null then
    headers := headers || jsonb_build_object('authorization', 'Bearer ' || webhook_token);
  end if;

  if TG_OP = 'INSERT' then
    execute 'select array_agg(distinct sacco_id) from new_rows' into sacco_ids;
  elsif TG_OP = 'DELETE' then
    execute 'select array_agg(distinct sacco_id) from old_rows' into sacco_ids;
  else
    execute '
      select array_agg(distinct sacco_id)
      from (
        select sacco_id from new_rows
        union
        select sacco_id from old_rows
      ) scoped
    ' into sacco_ids;
  end if;

  if sacco_ids is null or array_length(sacco_ids, 1) is null then
    sacco_ids := array[null::uuid];
  else
    sacco_ids := array_append(sacco_ids, null::uuid); -- include global/all tag
  end if;

  foreach sacco_id in array sacco_ids loop
    tags := array['dashboard:summary', 'analytics:executive:' || coalesce(sacco_id::text, 'all')];
    if sacco_id is not null then
      tags := array_append(tags, 'sacco:' || sacco_id::text);
    end if;

    payload := jsonb_build_object(
      'event', TG_ARGV[0],
      'saccoId', sacco_id,
      'tags', tags
    );

    begin
      perform net.http_post(
        url := webhook_url,
        headers := headers,
        body := payload,
        timeout_msec := 750
      );
    exception when others then
      insert into analytics.cache_invalidation_failures(event, sacco_id, error_message)
      values (TG_ARGV[0], sacco_id, sqlerrm);
    end;
  end loop;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION analytics.refresh_dashboard_materialized_views()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'analytics'
AS $function$
begin
  refresh materialized view concurrently public.analytics_payment_rollups_mv;
  refresh materialized view concurrently public.analytics_ikimina_monthly_mv;
  refresh materialized view concurrently public.analytics_member_last_payment_mv;
end;
$function$
;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION app.account_balance(account_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  with movements as (
    select
      sum(case when credit_id = account_id then amount else 0 end) as credits,
      sum(case when debit_id = account_id then amount else 0 end) as debits
    from app.ledger_entries
    where debit_id = account_id or credit_id = account_id
  )
  select coalesce(credits, 0) - coalesce(debits, 0)
  from movements;
$function$
;

CREATE OR REPLACE FUNCTION app.account_sacco(account_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.accounts
  where id = account_id
$function$
;

CREATE OR REPLACE FUNCTION app."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select role
  from app.user_profiles
  where user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION app.current_sacco()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.user_profiles
  where user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION app.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
begin
  insert into app.user_profiles(user_id, role, sacco_id)
  values (new.id, 'SACCO_STAFF', null)
  on conflict (user_id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION app.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SYSTEM_ADMIN',
    false
  )
  or coalesce(app.current_role() = 'SYSTEM_ADMIN', false)
$function$
;

CREATE OR REPLACE FUNCTION app.member_sacco(member_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.members
  where id = member_id
$function$
;

CREATE OR REPLACE FUNCTION app.payment_sacco(payment_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.payments
  where id = payment_id
$function$
;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION app_helpers.slugify(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(
    trim(both '-' from regexp_replace(
      regexp_replace(lower(coalesce($1, '')), '[^[:alnum:]]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )),
    ''
  );
$function$
;

CREATE OR REPLACE FUNCTION app_helpers.sync_sacco_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.search_slug := app_helpers.slugify(new.name);
  return new;
end;
$function$
;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION ops.consume_rate_limit(bucket_key_raw text, route text, max_hits integer, window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare
  span integer := greatest(window_seconds, 1);
  now_utc timestamptz := timezone('UTC', now());
  window_start timestamptz := now_utc - make_interval(secs => mod(floor(extract(epoch from now_utc))::int, span));
  bucket_key text := coalesce(nullif(trim(bucket_key_raw), ''), 'anonymous');
  new_count integer;
begin
  insert into ops.rate_limits(bucket_key, route, window_started, count)
  values (bucket_key, route, window_start, 1)
  on conflict (bucket_key, route, window_started)
  do update set count = ops.rate_limits.count + 1
  returning count into new_count;

  delete from ops.rate_limits
  where window_started < now_utc - make_interval(secs => span * 2);

  return new_count <= max_hits;
end;
$function$
;

CREATE OR REPLACE PROCEDURE ops.sp_monthly_close()
 LANGUAGE plpgsql
AS $procedure$
begin
  insert into app.audit_logs(action, entity, diff, created_at)
  values (
    'MONTHLY_CLOSE',
    'SYSTEM',
    jsonb_build_object('timestamp', timezone('UTC', now())),
    timezone('UTC', now())
  );
end;
$procedure$
;

CREATE OR REPLACE PROCEDURE ops.sp_nightly_recon()
 LANGUAGE plpgsql
AS $procedure$
begin
  -- Widen matching window for potential duplicates and reopen unresolved items.
  update app.recon_exceptions re
    set status = 'OPEN',
        resolved_at = null
  where re.status <> 'OPEN';
end;
$procedure$
;


do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;

  execute 'create schema if not exists net';
  execute $func$
    create or replace function net.http_post(
      url text,
      headers jsonb default '{}'::jsonb,
      body jsonb default '{}'::jsonb,
      timeout_msec integer default null
    )
    returns jsonb
    language sql
    as $body$
      select jsonb_build_object('status', 'stubbed');
    $body$;
  $func$;
  raise notice 'pg_net stub installed via remote_schema migration';
end;
$do$;

create type "public"."invite_status" as enum ('sent', 'accepted', 'expired');

create type "public"."join_status" as enum ('pending', 'approved', 'rejected');

create type "public"."notify_type" as enum ('new_member', 'payment_confirmed', 'invite_accepted');

create type "public"."payment_status" as enum ('pending', 'completed', 'failed');

revoke delete on table "public"."agent_events" from "anon";

revoke insert on table "public"."agent_events" from "anon";

revoke references on table "public"."agent_events" from "anon";

revoke select on table "public"."agent_events" from "anon";

revoke trigger on table "public"."agent_events" from "anon";

revoke truncate on table "public"."agent_events" from "anon";

revoke update on table "public"."agent_events" from "anon";

revoke delete on table "public"."agent_events" from "authenticated";

revoke insert on table "public"."agent_events" from "authenticated";

revoke references on table "public"."agent_events" from "authenticated";

revoke select on table "public"."agent_events" from "authenticated";

revoke trigger on table "public"."agent_events" from "authenticated";

revoke truncate on table "public"."agent_events" from "authenticated";

revoke update on table "public"."agent_events" from "authenticated";

revoke delete on table "public"."agent_events" from "service_role";

revoke insert on table "public"."agent_events" from "service_role";

revoke references on table "public"."agent_events" from "service_role";

revoke select on table "public"."agent_events" from "service_role";

revoke trigger on table "public"."agent_events" from "service_role";

revoke truncate on table "public"."agent_events" from "service_role";

revoke update on table "public"."agent_events" from "service_role";

revoke delete on table "public"."configuration" from "anon";

revoke insert on table "public"."configuration" from "anon";

revoke references on table "public"."configuration" from "anon";

revoke select on table "public"."configuration" from "anon";

revoke trigger on table "public"."configuration" from "anon";

revoke truncate on table "public"."configuration" from "anon";

revoke update on table "public"."configuration" from "anon";

revoke delete on table "public"."configuration" from "authenticated";

revoke insert on table "public"."configuration" from "authenticated";

revoke references on table "public"."configuration" from "authenticated";

revoke select on table "public"."configuration" from "authenticated";

revoke trigger on table "public"."configuration" from "authenticated";

revoke truncate on table "public"."configuration" from "authenticated";

revoke update on table "public"."configuration" from "authenticated";

revoke delete on table "public"."configuration" from "service_role";

revoke insert on table "public"."configuration" from "service_role";

revoke references on table "public"."configuration" from "service_role";

revoke select on table "public"."configuration" from "service_role";

revoke trigger on table "public"."configuration" from "service_role";

revoke truncate on table "public"."configuration" from "service_role";

revoke update on table "public"."configuration" from "service_role";

revoke delete on table "public"."group_invites" from "anon";

revoke insert on table "public"."group_invites" from "anon";

revoke references on table "public"."group_invites" from "anon";

revoke select on table "public"."group_invites" from "anon";

revoke trigger on table "public"."group_invites" from "anon";

revoke truncate on table "public"."group_invites" from "anon";

revoke update on table "public"."group_invites" from "anon";

revoke delete on table "public"."group_invites" from "authenticated";

revoke insert on table "public"."group_invites" from "authenticated";

revoke references on table "public"."group_invites" from "authenticated";

revoke select on table "public"."group_invites" from "authenticated";

revoke trigger on table "public"."group_invites" from "authenticated";

revoke truncate on table "public"."group_invites" from "authenticated";

revoke update on table "public"."group_invites" from "authenticated";

revoke delete on table "public"."group_invites" from "service_role";

revoke insert on table "public"."group_invites" from "service_role";

revoke references on table "public"."group_invites" from "service_role";

revoke select on table "public"."group_invites" from "service_role";

revoke trigger on table "public"."group_invites" from "service_role";

revoke truncate on table "public"."group_invites" from "service_role";

revoke update on table "public"."group_invites" from "service_role";

revoke delete on table "public"."items" from "anon";

revoke insert on table "public"."items" from "anon";

revoke references on table "public"."items" from "anon";

revoke select on table "public"."items" from "anon";

revoke trigger on table "public"."items" from "anon";

revoke truncate on table "public"."items" from "anon";

revoke update on table "public"."items" from "anon";

revoke delete on table "public"."items" from "authenticated";

revoke insert on table "public"."items" from "authenticated";

revoke references on table "public"."items" from "authenticated";

revoke select on table "public"."items" from "authenticated";

revoke trigger on table "public"."items" from "authenticated";

revoke truncate on table "public"."items" from "authenticated";

revoke update on table "public"."items" from "authenticated";

revoke delete on table "public"."items" from "service_role";

revoke insert on table "public"."items" from "service_role";

revoke references on table "public"."items" from "service_role";

revoke select on table "public"."items" from "service_role";

revoke trigger on table "public"."items" from "service_role";

revoke truncate on table "public"."items" from "service_role";

revoke update on table "public"."items" from "service_role";

revoke delete on table "public"."join_requests" from "anon";

revoke insert on table "public"."join_requests" from "anon";

revoke references on table "public"."join_requests" from "anon";

revoke select on table "public"."join_requests" from "anon";

revoke trigger on table "public"."join_requests" from "anon";

revoke truncate on table "public"."join_requests" from "anon";

revoke update on table "public"."join_requests" from "anon";

revoke delete on table "public"."join_requests" from "authenticated";

revoke insert on table "public"."join_requests" from "authenticated";

revoke references on table "public"."join_requests" from "authenticated";

revoke select on table "public"."join_requests" from "authenticated";

revoke trigger on table "public"."join_requests" from "authenticated";

revoke truncate on table "public"."join_requests" from "authenticated";

revoke update on table "public"."join_requests" from "authenticated";

revoke delete on table "public"."join_requests" from "service_role";

revoke insert on table "public"."join_requests" from "service_role";

revoke references on table "public"."join_requests" from "service_role";

revoke select on table "public"."join_requests" from "service_role";

revoke trigger on table "public"."join_requests" from "service_role";

revoke truncate on table "public"."join_requests" from "service_role";

revoke update on table "public"."join_requests" from "service_role";

revoke delete on table "public"."locations" from "anon";

revoke insert on table "public"."locations" from "anon";

revoke references on table "public"."locations" from "anon";

revoke select on table "public"."locations" from "anon";

revoke trigger on table "public"."locations" from "anon";

revoke truncate on table "public"."locations" from "anon";

revoke update on table "public"."locations" from "anon";

revoke delete on table "public"."locations" from "authenticated";

revoke insert on table "public"."locations" from "authenticated";

revoke references on table "public"."locations" from "authenticated";

revoke select on table "public"."locations" from "authenticated";

revoke trigger on table "public"."locations" from "authenticated";

revoke truncate on table "public"."locations" from "authenticated";

revoke update on table "public"."locations" from "authenticated";

revoke delete on table "public"."locations" from "service_role";

revoke insert on table "public"."locations" from "service_role";

revoke references on table "public"."locations" from "service_role";

revoke select on table "public"."locations" from "service_role";

revoke trigger on table "public"."locations" from "service_role";

revoke truncate on table "public"."locations" from "service_role";

revoke update on table "public"."locations" from "service_role";

revoke delete on table "public"."members_app_profiles" from "anon";

revoke insert on table "public"."members_app_profiles" from "anon";

revoke references on table "public"."members_app_profiles" from "anon";

revoke select on table "public"."members_app_profiles" from "anon";

revoke trigger on table "public"."members_app_profiles" from "anon";

revoke truncate on table "public"."members_app_profiles" from "anon";

revoke update on table "public"."members_app_profiles" from "anon";

revoke delete on table "public"."members_app_profiles" from "authenticated";

revoke insert on table "public"."members_app_profiles" from "authenticated";

revoke references on table "public"."members_app_profiles" from "authenticated";

revoke select on table "public"."members_app_profiles" from "authenticated";

revoke trigger on table "public"."members_app_profiles" from "authenticated";

revoke truncate on table "public"."members_app_profiles" from "authenticated";

revoke update on table "public"."members_app_profiles" from "authenticated";

revoke delete on table "public"."members_app_profiles" from "service_role";

revoke insert on table "public"."members_app_profiles" from "service_role";

revoke references on table "public"."members_app_profiles" from "service_role";

revoke select on table "public"."members_app_profiles" from "service_role";

revoke trigger on table "public"."members_app_profiles" from "service_role";

revoke truncate on table "public"."members_app_profiles" from "service_role";

revoke update on table "public"."members_app_profiles" from "service_role";

revoke delete on table "public"."mfa_recovery_codes" from "anon";

revoke insert on table "public"."mfa_recovery_codes" from "anon";

revoke references on table "public"."mfa_recovery_codes" from "anon";

revoke select on table "public"."mfa_recovery_codes" from "anon";

revoke trigger on table "public"."mfa_recovery_codes" from "anon";

revoke truncate on table "public"."mfa_recovery_codes" from "anon";

revoke update on table "public"."mfa_recovery_codes" from "anon";

revoke delete on table "public"."mfa_recovery_codes" from "authenticated";

revoke insert on table "public"."mfa_recovery_codes" from "authenticated";

revoke references on table "public"."mfa_recovery_codes" from "authenticated";

revoke select on table "public"."mfa_recovery_codes" from "authenticated";

revoke trigger on table "public"."mfa_recovery_codes" from "authenticated";

revoke truncate on table "public"."mfa_recovery_codes" from "authenticated";

revoke update on table "public"."mfa_recovery_codes" from "authenticated";

revoke delete on table "public"."mfa_recovery_codes" from "service_role";

revoke insert on table "public"."mfa_recovery_codes" from "service_role";

revoke references on table "public"."mfa_recovery_codes" from "service_role";

revoke select on table "public"."mfa_recovery_codes" from "service_role";

revoke trigger on table "public"."mfa_recovery_codes" from "service_role";

revoke truncate on table "public"."mfa_recovery_codes" from "service_role";

revoke update on table "public"."mfa_recovery_codes" from "service_role";

revoke delete on table "public"."notification_queue" from "anon";

revoke insert on table "public"."notification_queue" from "anon";

revoke references on table "public"."notification_queue" from "anon";

revoke select on table "public"."notification_queue" from "anon";

revoke trigger on table "public"."notification_queue" from "anon";

revoke truncate on table "public"."notification_queue" from "anon";

revoke update on table "public"."notification_queue" from "anon";

revoke delete on table "public"."notification_queue" from "authenticated";

revoke insert on table "public"."notification_queue" from "authenticated";

revoke references on table "public"."notification_queue" from "authenticated";

revoke select on table "public"."notification_queue" from "authenticated";

revoke trigger on table "public"."notification_queue" from "authenticated";

revoke truncate on table "public"."notification_queue" from "authenticated";

revoke update on table "public"."notification_queue" from "authenticated";

revoke delete on table "public"."notification_queue" from "service_role";

revoke insert on table "public"."notification_queue" from "service_role";

revoke references on table "public"."notification_queue" from "service_role";

revoke select on table "public"."notification_queue" from "service_role";

revoke trigger on table "public"."notification_queue" from "service_role";

revoke truncate on table "public"."notification_queue" from "service_role";

revoke update on table "public"."notification_queue" from "service_role";

revoke delete on table "public"."notifications" from "anon";

revoke insert on table "public"."notifications" from "anon";

revoke references on table "public"."notifications" from "anon";

revoke select on table "public"."notifications" from "anon";

revoke trigger on table "public"."notifications" from "anon";

revoke truncate on table "public"."notifications" from "anon";

revoke update on table "public"."notifications" from "anon";

revoke delete on table "public"."notifications" from "authenticated";

revoke insert on table "public"."notifications" from "authenticated";

revoke references on table "public"."notifications" from "authenticated";

revoke select on table "public"."notifications" from "authenticated";

revoke trigger on table "public"."notifications" from "authenticated";

revoke truncate on table "public"."notifications" from "authenticated";

revoke update on table "public"."notifications" from "authenticated";

revoke delete on table "public"."notifications" from "service_role";

revoke insert on table "public"."notifications" from "service_role";

revoke references on table "public"."notifications" from "service_role";

revoke select on table "public"."notifications" from "service_role";

revoke trigger on table "public"."notifications" from "service_role";

revoke truncate on table "public"."notifications" from "service_role";

revoke update on table "public"."notifications" from "service_role";

revoke delete on table "public"."orders" from "anon";

revoke insert on table "public"."orders" from "anon";

revoke references on table "public"."orders" from "anon";

revoke select on table "public"."orders" from "anon";

revoke trigger on table "public"."orders" from "anon";

revoke truncate on table "public"."orders" from "anon";

revoke update on table "public"."orders" from "anon";

revoke delete on table "public"."orders" from "authenticated";

revoke insert on table "public"."orders" from "authenticated";

revoke references on table "public"."orders" from "authenticated";

revoke select on table "public"."orders" from "authenticated";

revoke trigger on table "public"."orders" from "authenticated";

revoke truncate on table "public"."orders" from "authenticated";

revoke update on table "public"."orders" from "authenticated";

revoke delete on table "public"."orders" from "service_role";

revoke insert on table "public"."orders" from "service_role";

revoke references on table "public"."orders" from "service_role";

revoke select on table "public"."orders" from "service_role";

revoke trigger on table "public"."orders" from "service_role";

revoke truncate on table "public"."orders" from "service_role";

revoke update on table "public"."orders" from "service_role";

revoke delete on table "public"."rate_limit_counters" from "anon";

revoke insert on table "public"."rate_limit_counters" from "anon";

revoke references on table "public"."rate_limit_counters" from "anon";

revoke select on table "public"."rate_limit_counters" from "anon";

revoke trigger on table "public"."rate_limit_counters" from "anon";

revoke truncate on table "public"."rate_limit_counters" from "anon";

revoke update on table "public"."rate_limit_counters" from "anon";

revoke delete on table "public"."rate_limit_counters" from "authenticated";

revoke insert on table "public"."rate_limit_counters" from "authenticated";

revoke references on table "public"."rate_limit_counters" from "authenticated";

revoke select on table "public"."rate_limit_counters" from "authenticated";

revoke trigger on table "public"."rate_limit_counters" from "authenticated";

revoke truncate on table "public"."rate_limit_counters" from "authenticated";

revoke update on table "public"."rate_limit_counters" from "authenticated";

revoke delete on table "public"."rate_limit_counters" from "service_role";

revoke insert on table "public"."rate_limit_counters" from "service_role";

revoke references on table "public"."rate_limit_counters" from "service_role";

revoke select on table "public"."rate_limit_counters" from "service_role";

revoke trigger on table "public"."rate_limit_counters" from "service_role";

revoke truncate on table "public"."rate_limit_counters" from "service_role";

revoke update on table "public"."rate_limit_counters" from "service_role";

revoke delete on table "public"."sms_templates" from "anon";

revoke insert on table "public"."sms_templates" from "anon";

revoke references on table "public"."sms_templates" from "anon";

revoke select on table "public"."sms_templates" from "anon";

revoke trigger on table "public"."sms_templates" from "anon";

revoke truncate on table "public"."sms_templates" from "anon";

revoke update on table "public"."sms_templates" from "anon";

revoke delete on table "public"."sms_templates" from "authenticated";

revoke insert on table "public"."sms_templates" from "authenticated";

revoke references on table "public"."sms_templates" from "authenticated";

revoke select on table "public"."sms_templates" from "authenticated";

revoke trigger on table "public"."sms_templates" from "authenticated";

revoke truncate on table "public"."sms_templates" from "authenticated";

revoke update on table "public"."sms_templates" from "authenticated";

revoke delete on table "public"."sms_templates" from "service_role";

revoke insert on table "public"."sms_templates" from "service_role";

revoke references on table "public"."sms_templates" from "service_role";

revoke select on table "public"."sms_templates" from "service_role";

revoke trigger on table "public"."sms_templates" from "service_role";

revoke truncate on table "public"."sms_templates" from "service_role";

revoke update on table "public"."sms_templates" from "service_role";

revoke delete on table "public"."system_metrics" from "anon";

revoke insert on table "public"."system_metrics" from "anon";

revoke references on table "public"."system_metrics" from "anon";

revoke select on table "public"."system_metrics" from "anon";

revoke trigger on table "public"."system_metrics" from "anon";

revoke truncate on table "public"."system_metrics" from "anon";

revoke update on table "public"."system_metrics" from "anon";

revoke delete on table "public"."system_metrics" from "authenticated";

revoke insert on table "public"."system_metrics" from "authenticated";

revoke references on table "public"."system_metrics" from "authenticated";

revoke select on table "public"."system_metrics" from "authenticated";

revoke trigger on table "public"."system_metrics" from "authenticated";

revoke truncate on table "public"."system_metrics" from "authenticated";

revoke update on table "public"."system_metrics" from "authenticated";

revoke delete on table "public"."system_metrics" from "service_role";

revoke insert on table "public"."system_metrics" from "service_role";

revoke references on table "public"."system_metrics" from "service_role";

revoke select on table "public"."system_metrics" from "service_role";

revoke trigger on table "public"."system_metrics" from "service_role";

revoke truncate on table "public"."system_metrics" from "service_role";

revoke update on table "public"."system_metrics" from "service_role";

revoke delete on table "public"."tenants" from "anon";

revoke insert on table "public"."tenants" from "anon";

revoke references on table "public"."tenants" from "anon";

revoke select on table "public"."tenants" from "anon";

revoke trigger on table "public"."tenants" from "anon";

revoke truncate on table "public"."tenants" from "anon";

revoke update on table "public"."tenants" from "anon";

revoke delete on table "public"."tenants" from "authenticated";

revoke insert on table "public"."tenants" from "authenticated";

revoke references on table "public"."tenants" from "authenticated";

revoke select on table "public"."tenants" from "authenticated";

revoke trigger on table "public"."tenants" from "authenticated";

revoke truncate on table "public"."tenants" from "authenticated";

revoke update on table "public"."tenants" from "authenticated";

revoke delete on table "public"."tenants" from "service_role";

revoke insert on table "public"."tenants" from "service_role";

revoke references on table "public"."tenants" from "service_role";

revoke select on table "public"."tenants" from "service_role";

revoke trigger on table "public"."tenants" from "service_role";

revoke truncate on table "public"."tenants" from "service_role";

revoke update on table "public"."tenants" from "service_role";

revoke delete on table "public"."trusted_devices" from "anon";

revoke insert on table "public"."trusted_devices" from "anon";

revoke references on table "public"."trusted_devices" from "anon";

revoke select on table "public"."trusted_devices" from "anon";

revoke trigger on table "public"."trusted_devices" from "anon";

revoke truncate on table "public"."trusted_devices" from "anon";

revoke update on table "public"."trusted_devices" from "anon";

revoke delete on table "public"."trusted_devices" from "authenticated";

revoke insert on table "public"."trusted_devices" from "authenticated";

revoke references on table "public"."trusted_devices" from "authenticated";

revoke select on table "public"."trusted_devices" from "authenticated";

revoke trigger on table "public"."trusted_devices" from "authenticated";

revoke truncate on table "public"."trusted_devices" from "authenticated";

revoke update on table "public"."trusted_devices" from "authenticated";

revoke delete on table "public"."trusted_devices" from "service_role";

revoke insert on table "public"."trusted_devices" from "service_role";

revoke references on table "public"."trusted_devices" from "service_role";

revoke select on table "public"."trusted_devices" from "service_role";

revoke trigger on table "public"."trusted_devices" from "service_role";

revoke truncate on table "public"."trusted_devices" from "service_role";

revoke update on table "public"."trusted_devices" from "service_role";

revoke delete on table "public"."user_saccos" from "anon";

revoke insert on table "public"."user_saccos" from "anon";

revoke references on table "public"."user_saccos" from "anon";

revoke select on table "public"."user_saccos" from "anon";

revoke trigger on table "public"."user_saccos" from "anon";

revoke truncate on table "public"."user_saccos" from "anon";

revoke update on table "public"."user_saccos" from "anon";

revoke delete on table "public"."user_saccos" from "authenticated";

revoke insert on table "public"."user_saccos" from "authenticated";

revoke references on table "public"."user_saccos" from "authenticated";

revoke select on table "public"."user_saccos" from "authenticated";

revoke trigger on table "public"."user_saccos" from "authenticated";

revoke truncate on table "public"."user_saccos" from "authenticated";

revoke update on table "public"."user_saccos" from "authenticated";

revoke delete on table "public"."user_saccos" from "service_role";

revoke insert on table "public"."user_saccos" from "service_role";

revoke references on table "public"."user_saccos" from "service_role";

revoke select on table "public"."user_saccos" from "service_role";

revoke trigger on table "public"."user_saccos" from "service_role";

revoke truncate on table "public"."user_saccos" from "service_role";

revoke update on table "public"."user_saccos" from "service_role";

revoke delete on table "public"."users" from "anon";

revoke insert on table "public"."users" from "anon";

revoke references on table "public"."users" from "anon";

revoke select on table "public"."users" from "anon";

revoke trigger on table "public"."users" from "anon";

revoke truncate on table "public"."users" from "anon";

revoke update on table "public"."users" from "anon";

revoke delete on table "public"."users" from "authenticated";

revoke insert on table "public"."users" from "authenticated";

revoke references on table "public"."users" from "authenticated";

revoke select on table "public"."users" from "authenticated";

revoke trigger on table "public"."users" from "authenticated";

revoke truncate on table "public"."users" from "authenticated";

revoke update on table "public"."users" from "authenticated";

revoke delete on table "public"."users" from "service_role";

revoke insert on table "public"."users" from "service_role";

revoke references on table "public"."users" from "service_role";

revoke select on table "public"."users" from "service_role";

revoke trigger on table "public"."users" from "service_role";

revoke truncate on table "public"."users" from "service_role";

revoke update on table "public"."users" from "service_role";

revoke delete on table "public"."webauthn_credentials" from "anon";

revoke insert on table "public"."webauthn_credentials" from "anon";

revoke references on table "public"."webauthn_credentials" from "anon";

revoke select on table "public"."webauthn_credentials" from "anon";

revoke trigger on table "public"."webauthn_credentials" from "anon";

revoke truncate on table "public"."webauthn_credentials" from "anon";

revoke update on table "public"."webauthn_credentials" from "anon";

revoke delete on table "public"."webauthn_credentials" from "authenticated";

revoke insert on table "public"."webauthn_credentials" from "authenticated";

revoke references on table "public"."webauthn_credentials" from "authenticated";

revoke select on table "public"."webauthn_credentials" from "authenticated";

revoke trigger on table "public"."webauthn_credentials" from "authenticated";

revoke truncate on table "public"."webauthn_credentials" from "authenticated";

revoke update on table "public"."webauthn_credentials" from "authenticated";

revoke delete on table "public"."webauthn_credentials" from "service_role";

revoke insert on table "public"."webauthn_credentials" from "service_role";

revoke references on table "public"."webauthn_credentials" from "service_role";

revoke select on table "public"."webauthn_credentials" from "service_role";

revoke trigger on table "public"."webauthn_credentials" from "service_role";

revoke truncate on table "public"."webauthn_credentials" from "service_role";

revoke update on table "public"."webauthn_credentials" from "service_role";

alter table "public"."items" drop constraint "items_location_id_fkey";

alter table "public"."items" drop constraint "items_tenant_id_fkey";

alter table "public"."locations" drop constraint "locations_region_check";

alter table "public"."locations" drop constraint "locations_tenant_id_fkey";

alter table "public"."orders" drop constraint "orders_location_id_fkey";

alter table "public"."orders" drop constraint "orders_tenant_id_fkey";

alter table "public"."tenants" drop constraint "tenants_region_check";

do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname = 'ledger_entries'
  ) then
    execute 'drop view public.ledger_entries';
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname = 'payments'
  ) then
    execute 'drop view public.payments';
  end if;
end$$;

alter table "public"."agent_events" drop constraint "agent_events_pkey";

alter table "public"."items" drop constraint "items_pkey";

alter table "public"."locations" drop constraint "locations_pkey";

alter table "public"."orders" drop constraint "orders_pkey";

alter table "public"."tenants" drop constraint "tenants_pkey";

drop index if exists "public"."agent_events_pkey";

drop index if exists "public"."idx_items_location";

drop index if exists "public"."idx_locations_tenant";

drop index if exists "public"."idx_orders_location";

drop index if exists "public"."items_pkey";

drop index if exists "public"."locations_pkey";

drop index if exists "public"."orders_pkey";

drop index if exists "public"."tenants_pkey";

drop table "public"."agent_events";

drop table "public"."items";

drop table "public"."locations";

drop table "public"."orders";

drop table "public"."tenants";

create table "public"."ikimina" (
    "id" uuid not null default gen_random_uuid(),
    "sacco_id" uuid not null,
    "code" text not null,
    "name" text not null,
    "type" text not null default 'ASCA'::text,
    "settings" jsonb not null default '{}'::jsonb,
    "status" text not null default 'ACTIVE'::text,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."ikimina" enable row level security;

create table "public"."members" (
    "id" uuid not null default gen_random_uuid(),
    "ikimina_id" uuid not null,
    "user_id" uuid,
    "member_code" text,
    "full_name" text,
    "national_id" text,
    "msisdn" text,
    "joined_at" timestamp with time zone not null default now(),
    "status" text not null default 'ACTIVE'::text
);


alter table "public"."members" enable row level security;

CREATE INDEX IF NOT EXISTS idx_group_invites_token ON public.group_invites USING btree (token);

CREATE INDEX IF NOT EXISTS idx_ikimina_sacco ON public.ikimina USING btree (sacco_id);

CREATE INDEX IF NOT EXISTS idx_join_requests_user ON public.join_requests USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_members_msisdn ON public.members USING btree (msisdn);

CREATE INDEX IF NOT EXISTS idx_members_nid ON public.members USING btree (national_id);

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id);

CREATE UNIQUE INDEX ikimina_pkey ON public.ikimina USING btree (id);

CREATE UNIQUE INDEX ikimina_sacco_id_code_key ON public.ikimina USING btree (sacco_id, code);

CREATE UNIQUE INDEX members_ikimina_id_member_code_key ON public.members USING btree (ikimina_id, member_code);

CREATE UNIQUE INDEX members_pkey ON public.members USING btree (id);

alter table "public"."ikimina" add constraint "ikimina_pkey" PRIMARY KEY using index "ikimina_pkey";

alter table "public"."members" add constraint "members_pkey" PRIMARY KEY using index "members_pkey";

alter table "public"."ikimina" add constraint "ikimina_sacco_id_code_key" UNIQUE using index "ikimina_sacco_id_code_key";

alter table "public"."members" add constraint "members_ikimina_id_fkey" FOREIGN KEY (ikimina_id) REFERENCES ikimina(id) ON DELETE CASCADE not valid;

alter table "public"."members" validate constraint "members_ikimina_id_fkey";

alter table "public"."members" add constraint "members_ikimina_id_member_code_key" UNIQUE using index "members_ikimina_id_member_code_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_member_of_group(gid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.members m
    where m.ikimina_id = gid and (m.user_id = auth.uid())
  );
$function$
;

CREATE OR REPLACE FUNCTION public.search_saccos_trgm(q text)
 RETURNS TABLE(id uuid, name text, district text, sector_code text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    s.id,
    s.name,
    s.district,
    s.sector_code,
    greatest(similarity(s.name, q), similarity(s.sector_code, q)) as similarity
  from public.saccos s
  where coalesce(trim(q), '') <> ''
  order by similarity desc, s.name
  limit 20
$function$
;

CREATE OR REPLACE FUNCTION public.sum_group_deposits(gid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'amount', coalesce(sum(p.amount), 0),
    'currency', coalesce(nullif(max(p.currency), ''), 'RWF')
  )
  from public.payments p
  where p.ikimina_id = gid and p.status = 'completed';
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.account_balance(account_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
  select app.account_balance(account_id);
$function$
;

CREATE OR REPLACE FUNCTION public.can_user_access_account(_account_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = _account_id
      AND (
        public.has_role(_user_id, 'SYSTEM_ADMIN')
        OR (
          a.owner_type = 'SACCO'
          AND a.owner_id = public.get_user_sacco(_user_id)
        )
        OR (
          a.owner_type = 'IKIMINA'
          AND EXISTS (
            SELECT 1
            FROM public.ibimina i
            WHERE i.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'MEMBER'
          AND EXISTS (
            SELECT 1
            FROM public.ikimina_members m
            JOIN public.ibimina i ON i.id = m.ikimina_id
            WHERE m.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'USER'
          AND a.owner_id = _user_id
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_max_hits integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  existing public.rate_limit_counters%ROWTYPE;
  max_allowed INTEGER := COALESCE(p_max_hits, 5);
  window_seconds INTEGER := GREATEST(COALESCE(p_window_seconds, 300), 1);
BEGIN
  SELECT * INTO existing
  FROM public.rate_limit_counters
  WHERE key = p_key;

  IF NOT FOUND OR existing.window_expires < NOW() THEN
    INSERT INTO public.rate_limit_counters(key, hits, window_expires)
    VALUES (p_key, 1, NOW() + make_interval(secs => window_seconds))
    ON CONFLICT (key) DO UPDATE
      SET hits = EXCLUDED.hits,
          window_expires = EXCLUDED.window_expires;
    RETURN TRUE;
  END IF;

  IF existing.hits >= max_allowed THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limit_counters
    SET hits = existing.hits + 1,
        window_expires = existing.window_expires
  WHERE key = p_key;

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_route_rate_limit(bucket_key text, route text, max_hits integer, window_seconds integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'ops'
AS $function$
  select ops.consume_rate_limit(bucket_key, route, max_hits, window_seconds);
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_sacco(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT sacco_id FROM public.users WHERE id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is the admin email and set role accordingly
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.email = 'info@ikanisa.com' THEN 'SYSTEM_ADMIN'::app_role
      ELSE 'SACCO_STAFF'::app_role
    END
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.increment_metric(event_name text, delta integer, meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.system_metrics(event, total, last_occurred, meta)
  VALUES (event_name, delta, NOW(), COALESCE(meta, '{}'::jsonb))
  ON CONFLICT (event) DO UPDATE
    SET total = public.system_metrics.total + GREATEST(delta, 0),
        last_occurred = NOW(),
        meta = CASE
          WHEN meta = '{}'::jsonb THEN public.system_metrics.meta
          ELSE meta
        END;
END;
$function$
;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ledger_entries'
  ) then
    -- table still present; skip view creation here (later migrations replace it)
    return;
  end if;
  execute 'create or replace view public.ledger_entries as
    select id, sacco_id, debit_id, credit_id, amount, currency, value_date, external_id, memo, created_at
    from app.ledger_entries';
end$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'payments'
  ) then
    -- table still present; later migrations convert it to a view
    return;
  end if;
  execute 'create or replace view public.payments as
    select id, channel, sacco_id, ikimina_id, member_id, msisdn, msisdn_encrypted, msisdn_hash,
           msisdn_masked, amount, currency, txn_id, reference, occurred_at, status, source_id,
           ai_version, confidence, created_at
    from app.payments';
end$$;


CREATE OR REPLACE FUNCTION public.search_saccos(query text, limit_count integer DEFAULT 20, district_filter text DEFAULT NULL::text, province_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, sector text, district text, province text, email text, category text, similarity_score numeric, rank_score numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  WITH params AS (
    SELECT
      NULLIF(trim(query), '') AS sanitized_query,
      NULLIF(trim(district_filter), '') AS district_like,
      NULLIF(trim(province_filter), '') AS province_like,
      LEAST(GREATEST(COALESCE(limit_count, 20), 1), 100) AS limit_size
  ), expanded AS (
    SELECT
      params.limit_size,
      params.district_like,
      params.province_like,
      params.sanitized_query,
      CASE
        WHEN params.sanitized_query IS NULL THEN NULL
        ELSE websearch_to_tsquery('simple', params.sanitized_query)
      END AS ts_query
    FROM params
  ), ranked AS (
    SELECT
      s.id,
      s.name,
      s.sector,
      s.district,
      s.province,
      s.email,
      s.category,
      expanded.sanitized_query,
      expanded.ts_query,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(s.name, expanded.sanitized_query)
      END AS trigram_name,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query)
      END AS trigram_location,
      CASE
        WHEN expanded.ts_query IS NULL THEN 0
        ELSE ts_rank(s.search_document, expanded.ts_query)
      END AS ts_rank_score
    FROM public.saccos s
    CROSS JOIN expanded
    WHERE (
      expanded.sanitized_query IS NULL
      OR (
        (expanded.ts_query IS NOT NULL AND s.search_document @@ expanded.ts_query)
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(s.name, expanded.sanitized_query) > 0.1
        )
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query) > 0.1
        )
      )
    )
      AND (expanded.district_like IS NULL OR s.district ILIKE expanded.district_like)
      AND (expanded.province_like IS NULL OR s.province ILIKE expanded.province_like)
  )
  SELECT
    id,
    name,
    sector,
    district,
    province,
    email,
    category,
    GREATEST(trigram_name, trigram_location) AS similarity_score,
    ts_rank_score + GREATEST(trigram_name, trigram_location) AS rank_score
  FROM ranked
  ORDER BY rank_score DESC, similarity_score DESC, name ASC
  LIMIT (SELECT limit_size FROM expanded LIMIT 1)
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_mfa_recovery_codes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_configuration_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

create policy "gi_select_limited"
on "public"."group_invites"
as permissive
for select
to public
using (((invitee_user_id = auth.uid()) OR (auth.role() = 'service_role'::text)));


create policy "gi_update_accept"
on "public"."group_invites"
as permissive
for update
to public
using (((invitee_user_id = auth.uid()) OR (auth.role() = 'service_role'::text)))
with check (((invitee_user_id = auth.uid()) OR (auth.role() = 'service_role'::text)));


create policy "ikimina_select_all_auth"
on "public"."ikimina"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "jr_insert_self"
on "public"."join_requests"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "jr_select_self"
on "public"."join_requests"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "members_select_guarded"
on "public"."members"
as permissive
for select
to public
using ((is_user_member_of_group(ikimina_id) OR (auth.role() = 'service_role'::text)));


create policy "prof_insert_self"
on "public"."members_app_profiles"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "prof_select_self"
on "public"."members_app_profiles"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "prof_update_self"
on "public"."members_app_profiles"
as permissive
for update
to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


create policy "notif_insert_service"
on "public"."notifications"
as permissive
for insert
to public
with check (((user_id = auth.uid()) OR (auth.role() = 'service_role'::text)));


create policy "notif_select_self"
on "public"."notifications"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "notif_update_self"
on "public"."notifications"
as permissive
for update
to public
using ((user_id = auth.uid()));


create policy "us_insert_self"
on "public"."user_saccos"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "us_select_self"
on "public"."user_saccos"
as permissive
for select
to public
using ((user_id = auth.uid()));


CREATE TRIGGER trg_members_app_profiles_touch BEFORE UPDATE ON public.members_app_profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- From: 20251020120000_align_app_schema.sql

-- Align app schema with legacy public tables and seed existing data

begin;

do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname in ('ledger_entries', 'payments')
  ) then
    execute 'drop view if exists public.ledger_entries cascade';
    execute 'drop view if exists public.payments cascade';
  end if;
end$$;
-- Allow merchant_code to be null so we can migrate legacy rows without values
alter table if exists app.saccos
  alter column merchant_code drop not null;
-- Add extended profile columns to app.saccos
alter table if exists app.saccos
  add column if not exists province text,
  add column if not exists email text,
  add column if not exists category text default 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)',
  add column if not exists logo_url text,
  add column if not exists sector text,
  add column if not exists brand_color text;
-- Remove old search helpers if present so we can recreate them as generated columns
alter table if exists app.saccos
  drop column if exists search_slug cascade,
  drop column if exists search_document cascade;
alter table if exists app.saccos
  add column search_slug text generated always as (
    trim(both '-' from lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '-', 'g')))
  ) stored,
  add column search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(district, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(sector, '')), 'C')
  ) stored;
create index if not exists app_saccos_search_document_idx
  on app.saccos using gin (search_document);
-- Ensure ikimina settings column matches legacy naming
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'app'
      and table_name = 'ikimina'
      and column_name = 'settings'
  ) then
    alter table app.ikimina
      rename column settings to settings_json;
  end if;
end;
$$;
alter table if exists app.ikimina
  alter column settings_json set default '{}'::jsonb;
-- Align ledger/account/payment/sms types with legacy expectations
alter table if exists app.accounts
  add column if not exists balance integer default 0,
  add column if not exists updated_at timestamptz not null default timezone('UTC', now());
alter table if exists app.ledger_entries
  alter column amount type integer using amount::integer,
  alter column value_date type timestamptz using timezone('UTC', value_date::timestamp),
  alter column value_date set default timezone('UTC', now());
alter table if exists app.payments
  alter column amount type integer using amount::integer,
  alter column confidence type double precision using confidence::double precision,
  alter column created_at set default timezone('UTC', now());
alter table if exists app.sms_inbox
  alter column confidence type double precision using confidence::double precision;
-- Seed data from public tables where present
insert into app.saccos (
  id,
  name,
  district,
  sector_code,
  merchant_code,
  status,
  metadata,
  created_at,
  updated_at,
  province,
  email,
  category,
  logo_url,
  sector,
  brand_color
)
select
  id,
  name,
  district,
  sector_code,
  null,
  status,
  '{}'::jsonb,
  coalesce(created_at, timezone('UTC', now())),
  coalesce(updated_at, timezone('UTC', now())),
  province,
  email,
  category,
  logo_url,
  sector,
  brand_color
from public.saccos
on conflict (id) do update
  set
    name = excluded.name,
    district = excluded.district,
    sector_code = excluded.sector_code,
    status = excluded.status,
    province = excluded.province,
    email = excluded.email,
    category = excluded.category,
    logo_url = excluded.logo_url,
    sector = excluded.sector,
    brand_color = excluded.brand_color,
    updated_at = excluded.updated_at;
insert into app.ikimina (
  id,
  sacco_id,
  code,
  name,
  type,
  settings_json,
  status,
  created_at,
  updated_at
)
select
  id,
  sacco_id,
  code,
  name,
  type,
  settings_json,
  status,
  coalesce(created_at, timezone('UTC', now())),
  coalesce(updated_at, timezone('UTC', now()))
from public.ibimina
on conflict (id) do nothing;
insert into app.members (
  id,
  ikimina_id,
  sacco_id,
  member_code,
  full_name,
  national_id,
  national_id_encrypted,
  national_id_hash,
  national_id_masked,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  joined_at,
  status,
  created_at,
  updated_at
)
select
  id,
  ikimina_id,
  (select sacco_id from public.ibimina where public.ibimina.id = ikimina_members.ikimina_id),
  member_code,
  full_name,
  national_id,
  national_id_encrypted,
  national_id_hash,
  national_id_masked,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  coalesce(joined_at, timezone('UTC', now())),
  status,
  coalesce(created_at, timezone('UTC', now())),
  coalesce(updated_at, timezone('UTC', now()))
from public.ikimina_members
on conflict (id) do nothing;
insert into app.sms_inbox (
  id,
  sacco_id,
  raw_text,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  received_at,
  vendor_meta,
  parsed_json,
  parse_source,
  confidence,
  status,
  error,
  created_at
)
select
  id,
  sacco_id,
  raw_text,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  received_at,
  vendor_meta,
  parsed_json,
  parse_source,
  confidence,
  status,
  error,
  coalesce(created_at, timezone('UTC', now()))
from public.sms_inbox
on conflict (id) do nothing;
insert into app.payments (
  id,
  channel,
  sacco_id,
  ikimina_id,
  member_id,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  amount,
  currency,
  txn_id,
  reference,
  occurred_at,
  status,
  source_id,
  ai_version,
  confidence,
  created_at
)
select
  id,
  channel,
  sacco_id,
  ikimina_id,
  member_id,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  amount,
  currency,
  txn_id,
  reference,
  occurred_at,
  status,
  source_id,
  ai_version,
  confidence,
  coalesce(created_at, timezone('UTC', now()))
from public.payments
on conflict (id) do nothing;
insert into app.accounts (
  id,
  sacco_id,
  owner_type,
  owner_id,
  currency,
  status,
  balance,
  created_at,
  updated_at
)
select
  id,
  null,
  owner_type,
  owner_id,
  currency,
  status,
  coalesce(balance, 0),
  coalesce(created_at, timezone('UTC', now())),
  coalesce(updated_at, timezone('UTC', now()))
from public.accounts
on conflict (id) do nothing;
insert into app.ledger_entries (
  id,
  sacco_id,
  debit_id,
  credit_id,
  amount,
  currency,
  value_date,
  external_id,
  memo,
  created_at
)
select
  id,
  null,
  debit_id,
  credit_id,
  amount,
  currency,
  coalesce(value_date, timezone('UTC', now())),
  external_id,
  memo,
  coalesce(created_at, timezone('UTC', now()))
from public.ledger_entries
on conflict (id) do nothing;
do $$
declare
  has_sacco boolean;
begin
  if to_regclass('public.audit_logs') is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'audit_logs'
        and column_name = 'sacco_id'
    ) into has_sacco;

    if has_sacco then
      insert into app.audit_logs (
        id,
        sacco_id,
        actor,
        action,
        entity,
        entity_id,
        diff,
        created_at
      )
      select
        id,
        sacco_id,
        actor_id,
        action,
        entity,
        entity_id,
        diff_json,
        coalesce(created_at, timezone('UTC', now()))
      from public.audit_logs
      on conflict (id) do nothing;
    else
      insert into app.audit_logs (
        id,
        sacco_id,
        actor,
        action,
        entity,
        entity_id,
        diff,
        created_at
      )
      select
        id,
        null,
        actor_id,
        action,
        entity,
        entity_id,
        diff_json,
        coalesce(created_at, timezone('UTC', now()))
      from public.audit_logs
      on conflict (id) do nothing;
    end if;
  end if;
end;
$$;
do $$
begin
  if to_regclass('public.import_files') is not null then
    insert into app.import_files (
      id,
      sacco_id,
      type,
      filename,
      uploaded_by,
      uploaded_at,
      status,
      error
    )
    select
      id,
      sacco_id,
      type,
      filename,
      uploaded_by,
      coalesce(uploaded_at, timezone('UTC', now())),
      status,
      error
    from public.import_files
    on conflict (id) do nothing;
  end if;
end;
$$;
do $$
begin
  if to_regclass('public.recon_exceptions') is not null then
    insert into app.recon_exceptions (
      id,
      payment_id,
      reason,
      status,
      note,
      created_at,
      resolved_at
    )
    select
      id,
      payment_id,
      reason,
      status,
      note,
      coalesce(created_at, timezone('UTC', now())),
      resolved_at
    from public.recon_exceptions
    on conflict (id) do nothing;
  end if;
end;
$$;
commit;


-- From: 20251020130000_public_views_app.sql

-- Replace duplicated public tables with updatable views backed by app schema

begin;
-- Drop dependent view before replacing base tables
drop view if exists public.ikimina_members_public;
-- Drop foreign keys that previously referenced public tables
alter table if exists public.users drop constraint if exists users_sacco_id_fkey;
alter table if exists public.sms_templates drop constraint if exists sms_templates_sacco_id_fkey;
-- Remove legacy duplicates (data already copied into app.*)
drop table if exists public.ikimina_members cascade;
drop table if exists public.payments cascade;
drop table if exists public.sms_inbox cascade;
drop table if exists public.accounts cascade;
drop table if exists public.ledger_entries cascade;
drop table if exists public.ibimina cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.saccos cascade;
-- Recreate public objects as thin views over app schema
create view public.saccos as
select
  id,
  name,
  district,
  sector_code,
  status,
  created_at,
  updated_at,
  province,
  email,
  category,
  logo_url,
  sector,
  search_slug,
  search_document,
  brand_color
from app.saccos;
alter view public.saccos set (security_barrier = true);
create view public.ibimina as
select
  id,
  sacco_id,
  code,
  name,
  type,
  settings_json,
  status,
  created_at,
  updated_at
from app.ikimina;
alter view public.ibimina set (security_barrier = true);
create view public.ikimina_members as
select
  id,
  ikimina_id,
  member_code,
  full_name,
  national_id,
  msisdn,
  joined_at,
  status,
  created_at,
  updated_at,
  msisdn_encrypted,
  msisdn_masked,
  msisdn_hash,
  national_id_encrypted,
  national_id_masked,
  national_id_hash
from app.members;
alter view public.ikimina_members set (security_barrier = true);
create view public.sms_inbox as
select
  id,
  sacco_id,
  raw_text,
  msisdn,
  received_at,
  vendor_meta,
  parsed_json,
  parse_source,
  confidence,
  status,
  error,
  created_at,
  msisdn_encrypted,
  msisdn_masked,
  msisdn_hash
from app.sms_inbox;
alter view public.sms_inbox set (security_barrier = true);
create view public.payments as
select
  id,
  channel,
  sacco_id,
  ikimina_id,
  member_id,
  msisdn,
  amount,
  currency,
  txn_id,
  reference,
  occurred_at,
  status,
  source_id,
  ai_version,
  confidence,
  created_at,
  msisdn_encrypted,
  msisdn_masked,
  msisdn_hash
from app.payments;
alter view public.payments set (security_barrier = true);
create view public.accounts as
select
  id,
  owner_type,
  owner_id,
  currency,
  status,
  balance,
  created_at,
  updated_at
from app.accounts;
alter view public.accounts set (security_barrier = true);
create view public.ledger_entries as
select
  id,
  debit_id,
  credit_id,
  amount,
  currency,
  value_date,
  external_id,
  memo,
  created_at
from app.ledger_entries;
alter view public.ledger_entries set (security_barrier = true);
create view public.audit_logs as
select
  id,
  action,
  actor as actor_id,
  created_at,
  diff as diff_json,
  entity,
  entity_id,
  sacco_id
from app.audit_logs;
alter view public.audit_logs set (security_barrier = true);
-- Recreate helper view with new sources
create view public.ikimina_members_public
with (security_barrier = true) as
select
  m.id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.status,
  m.joined_at,
  m.msisdn_masked as msisdn,
  m.national_id_masked as national_id,
  i.name as ikimina_name,
  i.sacco_id
from app.members m
join app.ikimina i on i.id = m.ikimina_id
where public.has_role(auth.uid(), 'SYSTEM_ADMIN'::app_role)
  or i.sacco_id = public.get_user_sacco(auth.uid());
-- Restore grants required by PostgREST
grant select, insert, update, delete on public.saccos to anon, authenticated, service_role;
grant select, insert, update, delete on public.ibimina to anon, authenticated, service_role;
grant select, insert, update, delete on public.ikimina_members to anon, authenticated, service_role;
grant select, insert, update, delete on public.sms_inbox to anon, authenticated, service_role;
grant select, insert, update, delete on public.payments to anon, authenticated, service_role;
grant select, insert, update, delete on public.accounts to anon, authenticated, service_role;
grant select, insert, update, delete on public.ledger_entries to anon, authenticated, service_role;
grant select, insert, update, delete on public.audit_logs to anon, authenticated, service_role;
grant select on public.ikimina_members_public to anon, authenticated, service_role;
-- Recreate foreign keys referencing the new canonical tables
alter table if exists public.users
  add constraint users_sacco_id_fkey
  foreign key (sacco_id)
  references app.saccos(id)
  on delete set null;
alter table if exists public.sms_templates
  add constraint sms_templates_sacco_id_fkey
  foreign key (sacco_id)
  references app.saccos(id)
  on delete cascade;
commit;


-- From: 20251020134500_fix_search_slug.sql

-- Normalize SACCO slugs using helper schema and triggers.

begin;

create schema if not exists app_helpers;

create or replace function app_helpers.slugify(input text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      regexp_replace(lower(coalesce($1, '')), '[^[:alnum:]]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )),
    ''
  );
$$;

grant usage on schema app_helpers to anon, authenticated, service_role;
grant execute on function app_helpers.slugify(text) to anon, authenticated, service_role;

create or replace function app_helpers.sync_sacco_slug()
returns trigger
language plpgsql
as $$
begin
  new.search_slug := app_helpers.slugify(new.name);
  return new;
end;
$$;

alter table if exists app.saccos
  alter column search_slug drop expression;

update app.saccos
set search_slug = app_helpers.slugify(name);

drop trigger if exists app_saccos_set_slug on app.saccos;

create trigger app_saccos_set_slug
before insert or update on app.saccos
for each row
execute function app_helpers.sync_sacco_slug();

commit;


-- From: 20251020153000_seed_fixups.sql

-- Align seeded app schema data with legacy sources without overwriting existing customisations

begin;

-- Ensure merchant_code and metadata from legacy records persist in app.saccos
DO $$
DECLARE
  has_merchant boolean;
  has_metadata boolean;
BEGIN
  IF to_regclass('public.saccos') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saccos'
      AND column_name = 'merchant_code'
  ) INTO has_merchant;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saccos'
      AND column_name = 'metadata'
  ) INTO has_metadata;

  IF has_merchant THEN
    UPDATE app.saccos s
    SET merchant_code = src.merchant_code,
        updated_at = timezone('UTC', now())
    FROM public.saccos src
    WHERE s.id = src.id
      AND src.merchant_code IS NOT NULL
      AND src.merchant_code <> s.merchant_code;
  END IF;

  IF has_metadata THEN
    UPDATE app.saccos s
    SET metadata = coalesce(src.metadata, '{}'::jsonb),
        updated_at = timezone('UTC', now())
    FROM public.saccos src
    WHERE s.id = src.id
      AND src.metadata IS NOT NULL
      AND src.metadata <> s.metadata;
  END IF;
END;
$$;

-- Back-fill sacco relationships on app.accounts when the legacy table exposes them
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'sacco_id'
  ) then
    update app.accounts a
    set sacco_id = src.sacco_id,
        updated_at = timezone('UTC', now())
    from public.accounts src
    where a.id = src.id
      and src.sacco_id is not null
      and (
        a.sacco_id is distinct from src.sacco_id
        or a.sacco_id is null
      );
  end if;
end;
$$;

-- Propagate sacco context into ledger entries where possible
with account_map as (
  select id, sacco_id
  from app.accounts
  where sacco_id is not null
)
update app.ledger_entries le
set sacco_id = acc.sacco_id
from account_map acc
where le.debit_id = acc.id
  and (
    le.sacco_id is distinct from acc.sacco_id
    or le.sacco_id is null
  );

with credit_account_map as (
  select id, sacco_id
  from app.accounts
  where sacco_id is not null
)
update app.ledger_entries le
set sacco_id = acc.sacco_id
from credit_account_map acc
where le.sacco_id is null
  and le.credit_id = acc.id;

commit;


-- From: 20251020160000_fix_auth_confirmation_token.sql

-- Ensure Supabase Auth token columns never store NULL values

begin;

update auth.users
set confirmation_token = ''
where confirmation_token is null;

update auth.users
set email_change_token_current = ''
where email_change_token_current is null;

update auth.users
set email_change_token_new = ''
where email_change_token_new is null;

-- Defaults remain managed by GoTrue; ensure future manual inserts supply blanks.

commit;


-- From: 20251020160500_fix_auth_recovery_token.sql

-- Ensure recovery tokens are never NULL for Supabase Auth compatibility

begin;

update auth.users
set recovery_token = ''
where recovery_token is null;

commit;


-- From: 20251020161000_debug_auth_users.sql

-- Temporary view to inspect auth.users token columns

begin;

create or replace view public.debug_auth_users as
select
  id,
  email,
  confirmation_token,
  email_change_token_current,
  email_change_token_new,
  recovery_token
from auth.users;

grant select on public.debug_auth_users to anon, authenticated, service_role;

commit;


-- From: 20251020161500_debug_auth_users_rpc.sql

-- Helper RPC to inspect auth.users token values (temporary for debugging)

begin;

create or replace function public.debug_auth_users_tokens()
returns table (
  id uuid,
  email text,
  confirmation_token text,
  email_change_token_current text,
  email_change_token_new text,
  recovery_token text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = auth, public
as $$
  select
    u.id,
    u.email,
    u.confirmation_token,
    u.email_change_token_current,
    u.email_change_token_new,
    u.recovery_token,
    u.created_at,
    u.updated_at
  from auth.users u;
$$;

grant execute on function public.debug_auth_users_tokens() to anon, authenticated, service_role;

commit;


-- From: 20251020162000_debug_auth_users_columns.sql

-- Helper RPC to inspect auth.users column definitions

begin;

create or replace function public.debug_auth_users_columns()
returns table (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
)
language sql
security definer
set search_path = information_schema
as $$
  select
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
  from information_schema.columns c
  where c.table_schema = 'auth'
    and c.table_name = 'users'
  order by c.ordinal_position;
$$;

grant execute on function public.debug_auth_users_columns() to anon, authenticated, service_role;

commit;


-- From: 20251020163000_debug_null_tokens.sql

begin;

create or replace function public.debug_null_tokens()
returns jsonb
language sql
security definer
set search_path = auth, public
as $$
  select jsonb_build_object(
    'null_confirmation_token', (select count(*) from auth.users where confirmation_token is null),
    'null_email_change_token_current', (select count(*) from auth.users where email_change_token_current is null),
    'null_email_change_token_new', (select count(*) from auth.users where email_change_token_new is null),
    'null_recovery_token', (select count(*) from auth.users where recovery_token is null)
  );
$$;

grant execute on function public.debug_null_tokens() to anon, authenticated, service_role;

commit;


-- From: 20251020163500_fix_auth_remaining_tokens.sql

begin;

update auth.users
set phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '');

commit;


-- From: 20251020164000_fix_auth_tokens.sql

begin;

update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    recovery_token = coalesce(recovery_token, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '');

commit;


-- From: 20251020164500_debug_null_text_columns.sql

begin;

create or replace function public.debug_null_text_columns()
returns jsonb
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  result jsonb := '{}'::jsonb;
  rec record;
  cnt bigint;
begin
  for rec in
    select column_name
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and data_type in ('text', 'character varying')
  loop
    execute format('select count(*) from auth.users where %I is null', rec.column_name) into cnt;
    result := result || jsonb_build_object(rec.column_name, cnt);
  end loop;
  return result;
end;
$$;

grant execute on function public.debug_null_text_columns() to anon, authenticated, service_role;

commit;


-- From: 20251020165000_fix_auth_phone_email.sql

begin;

update auth.users
set email_change = coalesce(email_change, '');

update auth.users
set phone = concat('pending-', id::text)
where phone is null;

commit;


-- From: 20251020165500_secure_debug_rpcs.sql

begin;

revoke execute on function public.debug_auth_users_tokens() from anon, authenticated;
revoke execute on function public.debug_auth_users_columns() from anon, authenticated;
revoke execute on function public.debug_null_tokens() from anon, authenticated;
revoke execute on function public.debug_null_text_columns() from anon, authenticated;
-- service_role retains access

grant execute on function public.debug_auth_users_tokens() to service_role;
grant execute on function public.debug_auth_users_columns() to service_role;
grant execute on function public.debug_null_tokens() to service_role;
grant execute on function public.debug_null_text_columns() to service_role;

commit;


-- From: 20251021150502_remote_schema.sql

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION analytics.emit_cache_invalidation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'analytics'
AS $function$
declare
  webhook_url   text;
  webhook_token text;
  headers       jsonb;
  sacco_ids     uuid[];
  sacco_id      uuid;
  payload       jsonb;
  tags          text[];
begin
  select value::text into webhook_url
  from public.configuration
  where key = 'analytics_cache_webhook_url';

  if webhook_url is null or length(trim(webhook_url)) = 0 then
    return null;
  end if;

  select value::text into webhook_token
  from public.configuration
  where key = 'analytics_cache_webhook_token';

  headers := jsonb_build_object('content-type', 'application/json');
  if webhook_token is not null then
    headers := headers || jsonb_build_object('authorization', 'Bearer ' || webhook_token);
  end if;

  if TG_OP = 'INSERT' then
    execute 'select array_agg(distinct sacco_id) from new_rows' into sacco_ids;
  elsif TG_OP = 'DELETE' then
    execute 'select array_agg(distinct sacco_id) from old_rows' into sacco_ids;
  else
    execute '
      select array_agg(distinct sacco_id)
      from (
        select sacco_id from new_rows
        union
        select sacco_id from old_rows
      ) scoped
    ' into sacco_ids;
  end if;

  if sacco_ids is null or array_length(sacco_ids, 1) is null then
    sacco_ids := array[null::uuid];
  else
    sacco_ids := array_append(sacco_ids, null::uuid); -- include global/all tag
  end if;

  foreach sacco_id in array sacco_ids loop
    tags := array['dashboard:summary', 'analytics:executive:' || coalesce(sacco_id::text, 'all')];
    if sacco_id is not null then
      tags := array_append(tags, 'sacco:' || sacco_id::text);
    end if;

    payload := jsonb_build_object(
      'event', TG_ARGV[0],
      'saccoId', sacco_id,
      'tags', tags
    );

    begin
      perform net.http_post(
        url := webhook_url,
        headers := headers,
        body := payload,
        timeout_msec := 750
      );
    exception when others then
      insert into analytics.cache_invalidation_failures(event, sacco_id, error_message)
      values (TG_ARGV[0], sacco_id, sqlerrm);
    end;
  end loop;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION analytics.refresh_dashboard_materialized_views()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'analytics'
AS $function$
begin
  refresh materialized view concurrently public.analytics_payment_rollups_mv;
  refresh materialized view concurrently public.analytics_ikimina_monthly_mv;
  refresh materialized view concurrently public.analytics_member_last_payment_mv;
end;
$function$
;


create table "app"."mfa_codes" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "code" text not null,
    "expires_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "consumed" boolean not null default false
);


alter table "app"."mfa_codes" enable row level security;

alter table "app"."mfa_email_codes" enable row level security;

drop view if exists "public"."saccos";

alter table "app"."saccos" drop column "search_slug";

alter table "app"."saccos" add column "search_slug" text generated always as (TRIM(BOTH '-'::text FROM lower(regexp_replace(COALESCE(name, ''::text), '[^a-z0-9]+'::text, '-'::text, 'g'::text)))) stored;

CREATE INDEX IF NOT EXISTS idx_mfa_codes_code ON app.mfa_codes USING btree (code);

CREATE INDEX IF NOT EXISTS idx_mfa_codes_user_id ON app.mfa_codes USING btree (user_id);

CREATE UNIQUE INDEX mfa_codes_pkey ON app.mfa_codes USING btree (id);

alter table "app"."mfa_codes" add constraint "mfa_codes_pkey" PRIMARY KEY using index "mfa_codes_pkey";

alter table "app"."mfa_codes" add constraint "mfa_codes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "app"."mfa_codes" validate constraint "mfa_codes_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION app.account_balance(account_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  with movements as (
    select
      sum(case when credit_id = account_id then amount else 0 end) as credits,
      sum(case when debit_id = account_id then amount else 0 end) as debits
    from app.ledger_entries
    where debit_id = account_id or credit_id = account_id
  )
  select coalesce(credits, 0) - coalesce(debits, 0)
  from movements;
$function$
;

CREATE OR REPLACE FUNCTION app.account_sacco(account_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.accounts
  where id = account_id
$function$
;

CREATE OR REPLACE FUNCTION app."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select role
  from app.user_profiles
  where user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION app.current_sacco()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.user_profiles
  where user_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION app.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
begin
  insert into app.user_profiles(user_id, role, sacco_id)
  values (new.id, 'SACCO_STAFF', null)
  on conflict (user_id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION app.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SYSTEM_ADMIN',
    false
  )
  or coalesce(app.current_role() = 'SYSTEM_ADMIN', false)
$function$
;

CREATE OR REPLACE FUNCTION app.member_sacco(member_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.members
  where id = member_id
$function$
;

CREATE OR REPLACE FUNCTION app.payment_sacco(payment_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select sacco_id
  from app.payments
  where id = payment_id
$function$
;

CREATE OR REPLACE FUNCTION app.sync_financial_institution_from_saccos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'DELETE' then
    delete from app.financial_institutions where sacco_id = old.id;
    return old;
  end if;

  insert into app.financial_institutions (name, kind, district, sacco_id)
  values (new.name, 'SACCO', new.district, new.id)
  on conflict (sacco_id)
  do update set
    name = excluded.name,
    district = excluded.district,
    updated_at = timezone('UTC', now());

  return new;
end;
$function$
;

create policy "mfa_codes_insert_own"
on "app"."mfa_codes"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "mfa_codes_select_own"
on "app"."mfa_codes"
as permissive
for select
to public
using (((auth.uid() = user_id) OR (auth.role() = 'service_role'::text)));


create policy "mfa_codes_update_service_role"
on "app"."mfa_codes"
as permissive
for update
to public
using ((auth.role() = 'service_role'::text));


create policy "mfa_email_codes_self_manage"
on "app"."mfa_email_codes"
as permissive
for all
to public
using (((auth.uid() = user_id) OR app.is_admin()))
with check (((auth.uid() = user_id) OR app.is_admin()));



set check_function_bodies = off;

CREATE OR REPLACE FUNCTION app_helpers.slugify(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(
    trim(both '-' from regexp_replace(
      regexp_replace(lower(coalesce($1, '')), '[^[:alnum:]]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )),
    ''
  );
$function$
;

CREATE OR REPLACE FUNCTION app_helpers.sync_sacco_slug()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.search_slug := app_helpers.slugify(new.name);
  return new;
end;
$function$
;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION ops.consume_rate_limit(bucket_key_raw text, route text, max_hits integer, window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare
  span integer := greatest(window_seconds, 1);
  now_utc timestamptz := timezone('UTC', now());
  window_start timestamptz := now_utc - make_interval(secs => mod(floor(extract(epoch from now_utc))::int, span));
  bucket_key text := coalesce(nullif(trim(bucket_key_raw), ''), 'anonymous');
  new_count integer;
begin
  insert into ops.rate_limits(bucket_key, route, window_started, count)
  values (bucket_key, route, window_start, 1)
  on conflict (bucket_key, route, window_started)
  do update set count = ops.rate_limits.count + 1
  returning count into new_count;

  delete from ops.rate_limits
  where window_started < now_utc - make_interval(secs => span * 2);

  return new_count <= max_hits;
end;
$function$
;

CREATE OR REPLACE PROCEDURE ops.sp_monthly_close()
 LANGUAGE plpgsql
AS $procedure$
begin
  insert into app.audit_logs(action, entity, diff, created_at)
  values (
    'MONTHLY_CLOSE',
    'SYSTEM',
    jsonb_build_object('timestamp', timezone('UTC', now())),
    timezone('UTC', now())
  );
end;
$procedure$
;

CREATE OR REPLACE PROCEDURE ops.sp_nightly_recon()
 LANGUAGE plpgsql
AS $procedure$
begin
  -- Widen matching window for potential duplicates and reopen unresolved items.
  update app.recon_exceptions re
    set status = 'OPEN',
        resolved_at = null
  where re.status <> 'OPEN';
end;
$procedure$
;


do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;

  execute 'create schema if not exists net';
  execute $func$
    create or replace function net.http_post(
      url text,
      headers jsonb default '{}'::jsonb,
      body jsonb default '{}'::jsonb,
      timeout_msec integer default null
    )
    returns jsonb
    language sql
    as $body$
      select jsonb_build_object('status', 'stubbed');
    $body$;
  $func$;
end;
$do$;

revoke delete on table "public"."ikimina" from "anon";

revoke insert on table "public"."ikimina" from "anon";

revoke references on table "public"."ikimina" from "anon";

revoke select on table "public"."ikimina" from "anon";

revoke trigger on table "public"."ikimina" from "anon";

revoke truncate on table "public"."ikimina" from "anon";

revoke update on table "public"."ikimina" from "anon";

revoke delete on table "public"."ikimina" from "authenticated";

revoke insert on table "public"."ikimina" from "authenticated";

revoke references on table "public"."ikimina" from "authenticated";

revoke select on table "public"."ikimina" from "authenticated";

revoke trigger on table "public"."ikimina" from "authenticated";

revoke truncate on table "public"."ikimina" from "authenticated";

revoke update on table "public"."ikimina" from "authenticated";

revoke delete on table "public"."ikimina" from "service_role";

revoke insert on table "public"."ikimina" from "service_role";

revoke references on table "public"."ikimina" from "service_role";

revoke select on table "public"."ikimina" from "service_role";

revoke trigger on table "public"."ikimina" from "service_role";

revoke truncate on table "public"."ikimina" from "service_role";

revoke update on table "public"."ikimina" from "service_role";

revoke delete on table "public"."members" from "anon";

revoke insert on table "public"."members" from "anon";

revoke references on table "public"."members" from "anon";

revoke select on table "public"."members" from "anon";

revoke trigger on table "public"."members" from "anon";

revoke truncate on table "public"."members" from "anon";

revoke update on table "public"."members" from "anon";

revoke delete on table "public"."members" from "authenticated";

revoke insert on table "public"."members" from "authenticated";

revoke references on table "public"."members" from "authenticated";

revoke select on table "public"."members" from "authenticated";

revoke trigger on table "public"."members" from "authenticated";

revoke truncate on table "public"."members" from "authenticated";

revoke update on table "public"."members" from "authenticated";

revoke delete on table "public"."members" from "service_role";

revoke insert on table "public"."members" from "service_role";

revoke references on table "public"."members" from "service_role";

revoke select on table "public"."members" from "service_role";

revoke trigger on table "public"."members" from "service_role";

revoke truncate on table "public"."members" from "service_role";

revoke update on table "public"."members" from "service_role";

alter table "public"."members" drop constraint "members_ikimina_id_fkey";

drop view if exists "public"."saccos";

drop view if exists "public"."ledger_entries";

drop view if exists "public"."payments";

drop view if exists "public"."sms_inbox";

alter table "public"."rate_limit_counters" enable row level security;

alter table "public"."sms_templates" enable row level security;

alter table "public"."members" add constraint "members_ikimina_id_fkey" FOREIGN KEY (ikimina_id) REFERENCES ikimina(id) ON DELETE CASCADE not valid;

alter table "public"."members" validate constraint "members_ikimina_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.debug_seed_counts()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
  select jsonb_build_object(
    'saccos', (select count(*) from app.saccos),
    'ikimina', (select count(*) from app.ikimina),
    'members', (select count(*) from app.members),
    'accounts', (select count(*) from app.accounts),
    'ledger_entries', (select count(*) from app.ledger_entries),
    'payments', (select count(*) from app.payments),
    'sms_inbox', (select count(*) from app.sms_inbox),
    'import_files', (select count(*) from app.import_files),
    'audit_logs', (select count(*) from app.audit_logs)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.account_balance(account_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
  select app.account_balance(account_id);
$function$
;

CREATE OR REPLACE FUNCTION public.can_user_access_account(_account_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = _account_id
      AND (
        public.has_role(_user_id, 'SYSTEM_ADMIN')
        OR (
          a.owner_type = 'SACCO'
          AND a.owner_id = public.get_user_sacco(_user_id)
        )
        OR (
          a.owner_type = 'IKIMINA'
          AND EXISTS (
            SELECT 1
            FROM public.ibimina i
            WHERE i.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'MEMBER'
          AND EXISTS (
            SELECT 1
            FROM public.ikimina_members m
            JOIN public.ibimina i ON i.id = m.ikimina_id
            WHERE m.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'USER'
          AND a.owner_id = _user_id
        )
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_max_hits integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  existing public.rate_limit_counters%ROWTYPE;
  max_allowed INTEGER := COALESCE(p_max_hits, 5);
  window_seconds INTEGER := GREATEST(COALESCE(p_window_seconds, 300), 1);
BEGIN
  SELECT * INTO existing
  FROM public.rate_limit_counters
  WHERE key = p_key;

  IF NOT FOUND OR existing.window_expires < NOW() THEN
    INSERT INTO public.rate_limit_counters(key, hits, window_expires)
    VALUES (p_key, 1, NOW() + make_interval(secs => window_seconds))
    ON CONFLICT (key) DO UPDATE
      SET hits = EXCLUDED.hits,
          window_expires = EXCLUDED.window_expires;
    RETURN TRUE;
  END IF;

  IF existing.hits >= max_allowed THEN
    RETURN FALSE;
  END IF;

  UPDATE public.rate_limit_counters
    SET hits = existing.hits + 1,
        window_expires = existing.window_expires
  WHERE key = p_key;

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_route_rate_limit(bucket_key text, route text, max_hits integer, window_seconds integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'ops'
AS $function$
  select ops.consume_rate_limit(bucket_key, route, max_hits, window_seconds);
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.debug_auth_users_columns()
 RETURNS TABLE(column_name text, data_type text, is_nullable text, column_default text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'information_schema'
AS $function$
  select
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
  from information_schema.columns c
  where c.table_schema = 'auth'
    and c.table_name = 'users'
  order by c.ordinal_position;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_auth_users_tokens()
 RETURNS TABLE(id uuid, email text, confirmation_token text, email_change_token_current text, email_change_token_new text, recovery_token text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
  select
    u.id,
    u.email,
    u.confirmation_token,
    u.email_change_token_current,
    u.email_change_token_new,
    u.recovery_token,
    u.created_at,
    u.updated_at
  from auth.users u;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_null_text_columns()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
declare
  result jsonb := '{}'::jsonb;
  rec record;
  cnt bigint;
begin
  for rec in
    select column_name
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and data_type in ('text', 'character varying')
  loop
    execute format('select count(*) from auth.users where %I is null', rec.column_name) into cnt;
    result := result || jsonb_build_object(rec.column_name, cnt);
  end loop;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_null_tokens()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
  select jsonb_build_object(
    'null_confirmation_token', (select count(*) from auth.users where confirmation_token is null),
    'null_email_change_token_current', (select count(*) from auth.users where email_change_token_current is null),
    'null_email_change_token_new', (select count(*) from auth.users where email_change_token_new is null),
    'null_recovery_token', (select count(*) from auth.users where recovery_token is null)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_sacco(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT sacco_id FROM public.users WHERE id = _user_id
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is the admin email and set role accordingly
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.email = 'info@ikanisa.com' THEN 'SYSTEM_ADMIN'::app_role
      ELSE 'SACCO_STAFF'::app_role
    END
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.increment_metric(event_name text, delta integer, meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.system_metrics(event, total, last_occurred, meta)
  VALUES (event_name, delta, NOW(), COALESCE(meta, '{}'::jsonb))
  ON CONFLICT (event) DO UPDATE
    SET total = public.system_metrics.total + GREATEST(delta, 0),
        last_occurred = NOW(),
        meta = CASE
          WHEN meta = '{}'::jsonb THEN public.system_metrics.meta
          ELSE meta
        END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_member_of_group(gid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.members m
    where m.ikimina_id = gid and (m.user_id = auth.uid())
  );
$function$
;

create or replace view "public"."ledger_entries" as  SELECT id,
    sacco_id,
    debit_id,
    credit_id,
    amount,
    currency,
    value_date,
    external_id,
    memo,
    created_at
   FROM app.ledger_entries;


create or replace view "public"."payments" as  SELECT id,
    channel,
    sacco_id,
    ikimina_id,
    member_id,
    msisdn,
    msisdn_encrypted,
    msisdn_hash,
    msisdn_masked,
    amount,
    currency,
    txn_id,
    reference,
    occurred_at,
    status,
    source_id,
    ai_version,
    confidence,
    created_at
   FROM app.payments;


CREATE OR REPLACE FUNCTION public.search_saccos(query text, limit_count integer DEFAULT 20, district_filter text DEFAULT NULL::text, province_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, sector text, district text, province text, email text, category text, similarity_score numeric, rank_score numeric)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  WITH params AS (
    SELECT
      NULLIF(trim(query), '') AS sanitized_query,
      NULLIF(trim(district_filter), '') AS district_like,
      NULLIF(trim(province_filter), '') AS province_like,
      LEAST(GREATEST(COALESCE(limit_count, 20), 1), 100) AS limit_size
  ), expanded AS (
    SELECT
      params.limit_size,
      params.district_like,
      params.province_like,
      params.sanitized_query,
      CASE
        WHEN params.sanitized_query IS NULL THEN NULL
        ELSE websearch_to_tsquery('simple', params.sanitized_query)
      END AS ts_query
    FROM params
  ), ranked AS (
    SELECT
      s.id,
      s.name,
      s.sector,
      s.district,
      s.province,
      s.email,
      s.category,
      expanded.sanitized_query,
      expanded.ts_query,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(s.name, expanded.sanitized_query)
      END AS trigram_name,
      CASE
        WHEN expanded.sanitized_query IS NULL THEN 0
        ELSE similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query)
      END AS trigram_location,
      CASE
        WHEN expanded.ts_query IS NULL THEN 0
        ELSE ts_rank(s.search_document, expanded.ts_query)
      END AS ts_rank_score
    FROM public.saccos s
    CROSS JOIN expanded
    WHERE (
      expanded.sanitized_query IS NULL
      OR (
        (expanded.ts_query IS NOT NULL AND s.search_document @@ expanded.ts_query)
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(s.name, expanded.sanitized_query) > 0.1
        )
        OR (
          expanded.sanitized_query IS NOT NULL
          AND similarity(COALESCE(s.sector, '') || ' ' || COALESCE(s.district, ''), expanded.sanitized_query) > 0.1
        )
      )
    )
      AND (expanded.district_like IS NULL OR s.district ILIKE expanded.district_like)
      AND (expanded.province_like IS NULL OR s.province ILIKE expanded.province_like)
  )
  SELECT
    id,
    name,
    sector,
    district,
    province,
    email,
    category,
    GREATEST(trigram_name, trigram_location) AS similarity_score,
    ts_rank_score + GREATEST(trigram_name, trigram_location) AS rank_score
  FROM ranked
  ORDER BY rank_score DESC, similarity_score DESC, name ASC
  LIMIT (SELECT limit_size FROM expanded LIMIT 1)
$function$
;

CREATE OR REPLACE FUNCTION public.search_saccos_trgm(q text)
 RETURNS TABLE(id uuid, name text, district text, sector_code text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    s.id,
    s.name,
    s.district,
    s.sector_code,
    greatest(similarity(s.name, q), similarity(s.sector_code, q)) as similarity
  from public.saccos s
  where coalesce(trim(q), '') <> ''
  order by similarity desc, s.name
  limit 20
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

create or replace view "public"."sms_inbox" as  SELECT id,
    sacco_id,
    raw_text,
    msisdn,
    msisdn_encrypted,
    msisdn_hash,
    msisdn_masked,
    received_at,
    vendor_meta,
    parsed_json,
    parse_source,
    confidence,
    status,
    error,
    created_at
   FROM app.sms_inbox;


CREATE OR REPLACE FUNCTION public.sum_group_deposits(gid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select jsonb_build_object(
    'amount', coalesce(sum(p.amount), 0),
    'currency', coalesce(nullif(max(p.currency), ''), 'RWF')
  )
  from public.payments p
  where p.ikimina_id = gid and p.status = 'completed';
$function$
;

CREATE OR REPLACE FUNCTION public.touch_mfa_recovery_codes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_configuration_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

create policy "rate_limit_counters_admin"
on "public"."rate_limit_counters"
as permissive
for all
to public
using (app.is_admin())
with check (app.is_admin());


create policy "sms_templates_admin"
on "public"."sms_templates"
as permissive
for all
to public
using (app.is_admin())
with check (app.is_admin());




  create policy "Authenticated delete statements"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated insert statements"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated read statements"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated update statements"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)))
with check (((bucket_id = 'statements'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1va6avm_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'uploads'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1va6avm_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'uploads'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1va6avm_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'uploads'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1va6avm_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'uploads'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder i3p58f_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder i3p58f_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder i3p58f_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder i3p58f_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'reports'::text) AND (auth.role() = 'authenticated'::text)));


-- From: 20251022120000_set_analytics_cache_webhook.sql

-- Ensure analytics cache webhook configuration matches deployed admin app
insert into public.configuration as config (key, description, value)
values (
  'analytics_cache_webhook_url',
  'Webhook endpoint invoked after analytics changes to trigger Next.js cache revalidation',
  '"https://ibimina-admin.vercel.app/api/cache/revalidate"'::jsonb
)
on conflict (key) do update
set
  description = excluded.description,
  value = excluded.value;

insert into public.configuration as config (key, description, value)
values (
  'analytics_cache_webhook_token',
  'Bearer token expected by the analytics cache revalidation webhook',
  'null'::jsonb
)
on conflict (key) do update
set
  description = excluded.description,
  value = excluded.value;


-- From: 20251023120000_momo_codes_and_institutions.sql

-- District MoMo codes and financial institution registry

-- 1. Financial institution kind enum
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'financial_institution_kind'
      and n.nspname = 'app'
  ) then
    create type app.financial_institution_kind as enum ('SACCO', 'MICROFINANCE', 'INSURANCE', 'OTHER');
  end if;
end;
$$;

-- 2. Financial institutions table and helpers
create table if not exists app.financial_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind app.financial_institution_kind not null,
  district text not null,
  sacco_id uuid unique references app.saccos(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

drop trigger if exists financial_institutions_touch_updated_at on app.financial_institutions;
create trigger financial_institutions_touch_updated_at
before update on app.financial_institutions
for each row
execute function public.set_updated_at();

create index if not exists idx_financial_institutions_district on app.financial_institutions(district);
create index if not exists idx_financial_institutions_kind on app.financial_institutions(kind, district);

-- Keep institutions synced with SACCO registry
create or replace function app.sync_financial_institution_from_saccos()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from app.financial_institutions where sacco_id = old.id;
    return old;
  end if;

  insert into app.financial_institutions (name, kind, district, sacco_id)
  values (new.name, 'SACCO', new.district, new.id)
  on conflict (sacco_id)
  do update set
    name = excluded.name,
    district = excluded.district,
    updated_at = timezone('UTC', now());

  return new;
end;
$$;

drop trigger if exists trig_sync_financial_institution_insert on app.saccos;
create trigger trig_sync_financial_institution_insert
after insert or update on app.saccos
for each row
execute function app.sync_financial_institution_from_saccos();

drop trigger if exists trig_sync_financial_institution_delete on app.saccos;
create trigger trig_sync_financial_institution_delete
after delete on app.saccos
for each row
execute function app.sync_financial_institution_from_saccos();

-- Backfill existing SACCOs into the registry
insert into app.financial_institutions (name, kind, district, sacco_id)
select s.name, 'SACCO', s.district, s.id
from app.saccos s
on conflict (sacco_id)
do update set
  name = excluded.name,
  district = excluded.district,
  updated_at = timezone('UTC', now());

alter table app.financial_institutions enable row level security;

create policy financial_institutions_select
  on app.financial_institutions
  for select
  using (app.is_admin());

create policy financial_institutions_manage
  on app.financial_institutions
  for all
  using (app.is_admin())
  with check (app.is_admin());

-- 3. MoMo codes per district/provider
create table if not exists app.momo_codes (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'MTN' check (provider in ('MTN', 'AIRTEL', 'OTHER')),
  district text not null,
  code text not null,
  account_name text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now()),
  unique (provider, district)
);

drop trigger if exists momo_codes_touch_updated_at on app.momo_codes;
create trigger momo_codes_touch_updated_at
before update on app.momo_codes
for each row
execute function public.set_updated_at();

-- Seed placeholder codes for every district on file (to be updated with real merchant numbers)
insert into app.momo_codes (provider, district, code, account_name)
select 'MTN', district, 'TO_ASSIGN', max(name)
from app.saccos
group by district
on conflict (provider, district) do nothing;

alter table app.momo_codes enable row level security;

create policy momo_codes_read
  on app.momo_codes
  for select
  using (true);

create policy momo_codes_manage
  on app.momo_codes
  for all
  using (app.is_admin())
  with check (app.is_admin());


-- From: 20251023123000_seed_momo_codes.sql

-- Generate deterministic MoMo codes for each district (MTN) and backfill account names.
with ranked as (
  select
    id,
    district,
    row_number() over (partition by upper(provider) order by upper(district)) as rn
  from app.momo_codes
  where upper(provider) = 'MTN'
),
updated as (
  update app.momo_codes mc
  set
    code = format('182%03s', ranked.rn),
    account_name = coalesce(
      mc.account_name,
      format('Ibimina %s MoMo', initcap(ranked.district))
    ),
    provider = upper(mc.provider)
  from ranked
  where mc.id = ranked.id
  returning mc.*
)
select count(*) as mtn_momo_codes_updated from updated;


-- From: 20251023230000_grant_app_schema_access.sql

-- Ensure PostgREST roles can introspect and query the app schema
begin;

grant usage on schema app to anon, authenticated, service_role;
grant usage on schema app_helpers to anon, authenticated, service_role;

grant select on all tables in schema app to anon, authenticated, service_role;

alter default privileges in schema app
  grant select on tables to anon, authenticated, service_role;
alter default privileges in schema app
  grant select on sequences to anon, authenticated, service_role;
alter default privileges in schema app
  grant usage on sequences to anon, authenticated, service_role;

commit;


-- From: 20251023231000_reload_postgrest_schema.sql

-- Trigger PostgREST to reload schema cache after privilege updates
select pg_notify('pgrst', 'reload schema');


-- From: 20251023233000_app_alias_analytics_views.sql

begin;

do $$
begin
  if exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'analytics_payment_rollups_mv') then
    execute 'create or replace view app.analytics_payment_rollups_mv as select * from public.analytics_payment_rollups_mv';
    execute 'grant select on app.analytics_payment_rollups_mv to anon, authenticated, service_role';
    execute 'grant select on app.analytics_payment_rollups_mv to supabase_authenticator, supabase_auth_admin';
  end if;

  if exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'analytics_ikimina_monthly_mv') then
    execute 'create or replace view app.analytics_ikimina_monthly_mv as select * from public.analytics_ikimina_monthly_mv';
    execute 'grant select on app.analytics_ikimina_monthly_mv to anon, authenticated, service_role';
    execute 'grant select on app.analytics_ikimina_monthly_mv to supabase_authenticator, supabase_auth_admin';
  end if;

  if exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'analytics_member_last_payment_mv') then
    execute 'create or replace view app.analytics_member_last_payment_mv as select * from public.analytics_member_last_payment_mv';
    execute 'grant select on app.analytics_member_last_payment_mv to anon, authenticated, service_role';
    execute 'grant select on app.analytics_member_last_payment_mv to supabase_authenticator, supabase_auth_admin';
  end if;
end;
$$;

commit;


-- From: 20251024003000_restore_public_views_and_analytics.sql

begin;

-- Ensure app.user_profiles contains data from legacy public.users table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND table_type = 'BASE TABLE'
  ) THEN
    INSERT INTO app.user_profiles (user_id, role, sacco_id)
    SELECT
      id,
      COALESCE(role::text, 'SACCO_STAFF')::public.app_role,
      sacco_id
    FROM public.users
    ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role,
          sacco_id = EXCLUDED.sacco_id;

    ALTER TABLE public.users RENAME TO users_legacy_20251024;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    DROP VIEW public.users;
  END IF;
END
$$;

-- Helper to drop existing public projections if they are tables/views
DO $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('saccos','ibimina','ikimina_members','sms_inbox','payments','accounts','ledger_entries','audit_logs')
  LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', obj.table_name, obj.table_name || '_legacy_20251024');
  END LOOP;

  FOR obj IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name IN ('saccos','ibimina','ikimina_members','sms_inbox','payments','accounts','ledger_entries','audit_logs','ikimina_members_public')
  LOOP
    EXECUTE format('DROP VIEW public.%I CASCADE', obj.table_name);
  END LOOP;
END
$$;

-- Recreate core public views pointing to app schema -----------------------------------
create view public.users
with (security_barrier = true) as
select
  p.user_id as id,
  auth_users.email,
  coalesce(p.role, 'SACCO_STAFF')::public.app_role as role,
  p.sacco_id,
  auth_users.created_at,
  auth_users.updated_at,
  coalesce((auth_users.raw_user_meta_data ->> 'mfa_enabled')::boolean, false) as mfa_enabled,
  (auth_users.raw_user_meta_data ->> 'mfa_enrolled_at')::timestamptz as mfa_enrolled_at,
  coalesce((auth_users.raw_user_meta_data ->> 'mfa_passkey_enrolled')::boolean, false) as mfa_passkey_enrolled,
  coalesce((auth_users.raw_user_meta_data -> 'mfa_methods')::jsonb, '[]'::jsonb) as mfa_methods,
  coalesce((auth_users.raw_user_meta_data -> 'mfa_backup_hashes')::jsonb, '[]'::jsonb) as mfa_backup_hashes,
  coalesce((auth_users.raw_user_meta_data ->> 'failed_mfa_count')::int, 0) as failed_mfa_count,
  (auth_users.raw_user_meta_data ->> 'last_mfa_success_at')::timestamptz as last_mfa_success_at,
  (auth_users.raw_user_meta_data ->> 'last_mfa_step')::int as last_mfa_step,
  (auth_users.raw_user_meta_data ->> 'mfa_secret_enc') as mfa_secret_enc
from app.user_profiles p
join auth.users auth_users on auth_users.id = p.user_id;

alter view public.users set (security_barrier = true);
grant select on public.users to anon, authenticated, service_role;

create view public.saccos as
select
  id,
  name,
  district,
  sector_code,
  merchant_code,
  status,
  metadata,
  created_at,
  updated_at,
  coalesce(metadata->>'province', null::text) as province,
  coalesce(metadata->>'category', null::text) as category,
  coalesce(metadata->>'email', null::text) as email,
  coalesce(metadata->>'logo_url', null::text) as logo_url,
  coalesce(metadata->>'sector', null::text) as sector,
  coalesce(metadata->>'brand_color', null::text) as brand_color
from app.saccos;

alter view public.saccos set (security_barrier = true);
grant select on public.saccos to anon, authenticated, service_role;

create view public.ibimina as
select
  id,
  sacco_id,
  code,
  name,
  type,
  settings_json,
  status,
  created_at,
  updated_at
from app.ikimina;

alter view public.ibimina set (security_barrier = true);
grant select on public.ibimina to anon, authenticated, service_role;

create view public.ikimina_members as
select
  id,
  ikimina_id,
  member_code,
  full_name,
  national_id,
  msisdn,
  joined_at,
  status,
  created_at,
  updated_at,
  national_id_encrypted,
  national_id_hash,
  national_id_masked,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  sacco_id
from app.members;

alter view public.ikimina_members set (security_barrier = true);
grant select on public.ikimina_members to anon, authenticated, service_role;

create view public.sms_inbox as
select
  id,
  sacco_id,
  raw_text,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  received_at,
  vendor_meta,
  parsed_json,
  parse_source,
  confidence,
  status,
  error,
  created_at
from app.sms_inbox;

alter view public.sms_inbox set (security_barrier = true);
grant select on public.sms_inbox to anon, authenticated, service_role;

create view public.payments as
select
  id,
  channel,
  sacco_id,
  ikimina_id,
  member_id,
  msisdn,
  msisdn_encrypted,
  msisdn_hash,
  msisdn_masked,
  amount,
  currency,
  txn_id,
  reference,
  occurred_at,
  status,
  source_id,
  ai_version,
  confidence,
  created_at
from app.payments;

alter view public.payments set (security_barrier = true);
grant select on public.payments to anon, authenticated, service_role;

create view public.accounts as
select
  id,
  sacco_id,
  owner_type,
  owner_id,
  currency,
  status,
  created_at
from app.accounts;

alter view public.accounts set (security_barrier = true);
grant select on public.accounts to anon, authenticated, service_role;

create view public.ledger_entries as
select
  id,
  sacco_id,
  debit_id,
  credit_id,
  amount,
  currency,
  value_date,
  external_id,
  memo,
  created_at
from app.ledger_entries;

alter view public.ledger_entries set (security_barrier = true);
grant select on public.ledger_entries to anon, authenticated, service_role;

create view public.audit_logs as
select
  id,
  sacco_id,
  actor,
  action,
  entity,
  entity_id,
  diff,
  created_at
from app.audit_logs;

alter view public.audit_logs set (security_barrier = true);
grant select on public.audit_logs to anon, authenticated, service_role;

create view public.ikimina_members_public
with (security_barrier = true) as
select
  m.id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.status,
  m.joined_at,
  m.msisdn_masked as msisdn,
  m.national_id_masked as national_id,
  i.name as ikimina_name,
  i.sacco_id
from app.members m
join app.ikimina i on i.id = m.ikimina_id;

grant select on public.ikimina_members_public to anon, authenticated, service_role;

-- Restore helper function for SACCO search ------------------------------------------------
DROP FUNCTION IF EXISTS public.search_saccos(text, integer, text, text);
CREATE FUNCTION public.search_saccos(
  query text default null,
  limit_count integer default 20,
  district_filter text default null,
  sector_filter text default null
)
returns table (
  id uuid,
  name text,
  district text,
  sector_code text,
  merchant_code text,
  province text,
  category text
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.district,
    s.sector_code,
    s.merchant_code,
    coalesce(s.province, null::text) as province,
    coalesce(s.category, null::text) as category
  from public.saccos s
  where (
    query is null
    or s.name ilike '%' || query || '%'
    or s.merchant_code ilike '%' || query || '%'
    or s.sector_code ilike '%' || query || '%'
  )
  and (district_filter is null or s.district = district_filter)
  and (sector_filter is null or s.sector_code = sector_filter)
  order by s.name asc
  limit greatest(coalesce(limit_count, 20), 1);
$$;

grant execute on function public.search_saccos(text, integer, text, text) to anon, authenticated, service_role;

-- Recreate analytics materialized views if missing ----------------------------------------
create materialized view if not exists public.analytics_payment_rollups_mv as
with params as (
  select
    timezone('utc', current_date)::timestamp as today_start,
    timezone('utc', current_date - interval '7 days')::timestamp as week_start,
    date_trunc('month', timezone('utc', current_date)) as month_start,
    timezone('utc', now()) as refreshed_at
),
scoped as (
  select
    p.sacco_id,
    p.amount,
    p.status,
    p.occurred_at,
    params.today_start,
    params.week_start,
    params.month_start,
    params.refreshed_at
  from public.payments p
  cross join params
)
select
  sacco_id,
  sum(case when status in ('POSTED','SETTLED') and occurred_at >= month_start then amount else 0 end) as month_total,
  sum(case when status in ('POSTED','SETTLED') and occurred_at >= week_start then amount else 0 end) as week_total,
  sum(case when status in ('POSTED','SETTLED') and occurred_at >= today_start then amount else 0 end) as today_total,
  count(*) filter (where status = 'UNALLOCATED') as unallocated_count,
  max(occurred_at) filter (where status in ('POSTED','SETTLED')) as latest_payment_at,
  max(refreshed_at) as refreshed_at
from scoped
group by rollup(sacco_id);

create unique index if not exists analytics_payment_rollups_mv_sacco_idx
  on public.analytics_payment_rollups_mv ((coalesce(sacco_id::text, '00000000-0000-0000-0000-000000000000')));

create materialized view if not exists public.analytics_ikimina_monthly_mv as
with params as (
  select
    date_trunc('month', timezone('utc', current_date)) as month_start,
    timezone('utc', now()) as refreshed_at
)
select
  i.id as ikimina_id,
  i.sacco_id,
  i.name,
  i.code,
  i.status,
  i.updated_at,
  coalesce(sum(case when p.status in ('POSTED','SETTLED') and p.occurred_at >= params.month_start then p.amount else 0 end), 0) as month_total,
  coalesce(count(distinct case when p.status in ('POSTED','SETTLED') and p.occurred_at >= params.month_start then p.member_id end), 0) as contributing_members,
  count(distinct case when m.status = 'ACTIVE' then m.id end) as active_member_count,
  max(p.occurred_at) filter (where p.status in ('POSTED','SETTLED')) as last_contribution_at,
  max(params.refreshed_at) as refreshed_at
from public.ibimina i
cross join params
left join public.payments p on p.ikimina_id = i.id
left join public.ikimina_members m on m.ikimina_id = i.id
where i.status = 'ACTIVE'
group by i.id, i.sacco_id, i.name, i.code, i.status, i.updated_at, params.month_start;

create unique index if not exists analytics_ikimina_monthly_mv_pk
  on public.analytics_ikimina_monthly_mv (ikimina_id);

create index if not exists analytics_ikimina_monthly_mv_sacco_idx
  on public.analytics_ikimina_monthly_mv (sacco_id, month_total desc);

create materialized view if not exists public.analytics_member_last_payment_mv as
with params as (
  select timezone('utc', now()) as refreshed_at
)
select
  m.id as member_id,
  i.sacco_id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.msisdn,
  m.status,
  i.name as ikimina_name,
  max(case when p.status in ('POSTED','SETTLED') then p.occurred_at end) as last_payment_at,
  coalesce(
    date_part('day', max(params.refreshed_at) - max(case when p.status in ('POSTED','SETTLED') then p.occurred_at end)),
    999
  )::int as days_since_last,
  max(params.refreshed_at) as refreshed_at
from public.ikimina_members m
left join public.ibimina i on i.id = m.ikimina_id
left join public.payments p on p.member_id = m.id
cross join params
where m.status = 'ACTIVE'
group by m.id, i.sacco_id, m.ikimina_id, m.member_code, m.full_name, m.msisdn, m.status, i.name;

create unique index if not exists analytics_member_last_payment_mv_pk
  on public.analytics_member_last_payment_mv (member_id);

create index if not exists analytics_member_last_payment_mv_sacco_idx
  on public.analytics_member_last_payment_mv (sacco_id, days_since_last desc);

create or replace function public.analytics_refresh_dashboard_materialized_views()
returns void
language sql
security definer
set search_path = public, analytics
as $$
  select analytics.refresh_dashboard_materialized_views();
$$;

grant execute on function public.analytics_refresh_dashboard_materialized_views() to service_role;

commit;


-- From: 20251024083940_cleanup_legacy_public_tables.sql

begin;

do $$
declare r record;
begin
  for r in
    select table_schema, table_name, table_type
    from information_schema.tables
    where table_schema = 'public'
      and table_name like '%\_legacy\_20251024'
  loop
    if r.table_type = 'BASE TABLE' then
      execute format('DROP TABLE IF EXISTS %I.%I CASCADE', r.table_schema, r.table_name);
    else
      execute format('DROP VIEW IF EXISTS %I.%I CASCADE', r.table_schema, r.table_name);
    end if;
  end loop;
end; $$;

commit;



-- From: 20251025113000_public_users_insert_trigger.sql

begin;

create or replace function public.handle_public_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public, app
as $$
declare
  desired_role app_role := coalesce(new.role, 'SACCO_STAFF'::app_role);
begin
  insert into app.user_profiles(user_id, role, sacco_id)
  values (new.id, desired_role, new.sacco_id)
  on conflict (user_id) do update
    set role = desired_role,
        sacco_id = coalesce(new.sacco_id, app.user_profiles.sacco_id),
        updated_at = timezone('UTC', now());
  return new;
end;
$$;

drop trigger if exists on_public_users_insert on public.users;
create trigger on_public_users_insert
instead of insert on public.users
for each row execute function public.handle_public_user_insert();

commit;


-- From: 20251026231500_add_users_suspended.sql

-- Add suspended flag to staff users (soft suspension)
-- Note: public.users is a view; the actual column is in app.user_profiles
-- This migration is superseded by 20251031193000_live_hotfixes.sql which recreates
-- the view with suspended_at and suspended_by columns.

do $$
begin
  -- Try to add column to app.user_profiles if it's a table
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'app' and table_name = 'user_profiles'
  ) then
    execute 'alter table app.user_profiles add column if not exists suspended_at timestamptz';
    execute 'alter table app.user_profiles add column if not exists suspended_by uuid';
    execute 'alter table app.user_profiles add column if not exists notes text';
  end if;
  
  -- If public.users is a table (older schema), add to it
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    execute 'alter table public.users add column if not exists suspended boolean not null default false';
  end if;
exception
  when others then
    raise notice 'Could not add suspended columns: %', sqlerrm;
end;
$$;



-- From: 20251026232500_add_orgs_and_memberships.sql

-- Organizations and memberships (Phase 2 scaffolding)
-- Enum for organization types
do $$ begin
  create type app.org_type as enum ('SACCO','MFI','DISTRICT');
exception when duplicate_object then null; end $$;

-- Extend app_role for future roles (safe if already added)
do $$ begin
  alter type public.app_role add value if not exists 'DISTRICT_MANAGER';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.app_role add value if not exists 'MFI_MANAGER';
exception when duplicate_object then null; end $$;
do $$ begin
  alter type public.app_role add value if not exists 'MFI_STAFF';
exception when duplicate_object then null; end $$;

-- Organizations table
create table if not exists app.organizations (
  id uuid primary key default gen_random_uuid(),
  type app.org_type not null,
  name text not null,
  district_code text,
  parent_id uuid null references app.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table app.organizations is 'Generic organizations: SACCO, MFI, DISTRICT.';

-- Org memberships table
create table if not exists app.org_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references app.organizations(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create index if not exists org_memberships_user_idx on app.org_memberships(user_id);
create index if not exists org_memberships_org_idx on app.org_memberships(org_id);
create index if not exists org_memberships_role_idx on app.org_memberships(role);

comment on table app.org_memberships is 'User assignments to organizations with roles per org.';

-- RLS scaffolding (service role bypasses RLS)
alter table app.organizations enable row level security;
alter table app.org_memberships enable row level security;

-- Deny all by default; reads/writes are currently done via service role APIs
do $$ begin
  create policy orgs_admin_only on app.organizations for all using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy org_memberships_admin_only on app.org_memberships for all using (false) with check (false);
exception when duplicate_object then null; end $$;



-- From: 20251027003000_add_sacco_district_org_link.sql

-- Add formal district organization link to saccos
alter table app.saccos
  add column if not exists district_org_id uuid null references app.organizations(id) on delete set null;

create index if not exists saccos_district_org_idx on app.saccos(district_org_id);

-- Attempt backfill: match organizations by name (case-insensitive) and type DISTRICT
update app.saccos s
set district_org_id = o.id
from app.organizations o
where o.type = 'DISTRICT'
  and upper(coalesce(s.district, '')) = upper(o.name)
  and s.district_org_id is null;

-- Note: After manual verification, consider enforcing NOT NULL:
-- alter table app.saccos alter column district_org_id set not null;



-- From: 20251027004500_rls_org_memberships.sql

-- Helper to determine if current user can access a given SACCO
create or replace function app.can_access_sacco(target_sacco uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select
    -- System admin bypass
    exists(select 1 from public.users u where u.id = auth.uid() and u.role = 'SYSTEM_ADMIN')
    or
    -- Direct SACCO membership
    exists(
      select 1 from app.org_memberships m
      where m.user_id = auth.uid()
        and m.org_id = target_sacco
        and m.role in ('SACCO_MANAGER','SACCO_STAFF','SACCO_VIEWER')
    )
    or
    -- District manager can access all SACCOs under their district
    exists(
      select 1
      from app.org_memberships m
      join app.organizations d on d.id = m.org_id and d.type = 'DISTRICT'
      join app.saccos s on s.id = target_sacco and s.district_org_id = d.id
      where m.user_id = auth.uid()
        and m.role = 'DISTRICT_MANAGER'
    );
$$;

-- Update policies for tenant-scoped tables to use can_access_sacco

-- saccos (read-only for staff, admin manages)
drop policy if exists sacco_select_staff on app.saccos;
create policy sacco_select_staff
  on app.saccos
  for select
  using (app.can_access_sacco(id));

-- ikimina
drop policy if exists ikimina_select on app.ikimina;
create policy ikimina_select
  on app.ikimina
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists ikimina_modify on app.ikimina;
create policy ikimina_modify
  on app.ikimina
  for all
  using (app.can_access_sacco(sacco_id));

-- members
drop policy if exists members_select on app.members;
create policy members_select
  on app.members
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists members_modify on app.members;
create policy members_modify
  on app.members
  for all
  using (app.can_access_sacco(sacco_id));

-- payments
drop policy if exists payments_select on app.payments;
create policy payments_select
  on app.payments
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists payments_insert on app.payments;
create policy payments_insert
  on app.payments
  for insert
  with check (app.can_access_sacco(sacco_id));

drop policy if exists payments_update on app.payments;
create policy payments_update
  on app.payments
  for update
  using (app.can_access_sacco(sacco_id));

-- recon exceptions (by payment linkage)
drop policy if exists recon_select on app.recon_exceptions;
create policy recon_select
  on app.recon_exceptions
  for select
  using (app.can_access_sacco(app.payment_sacco(payment_id)::uuid));

drop policy if exists recon_modify on app.recon_exceptions;
create policy recon_modify
  on app.recon_exceptions
  for all
  using (app.can_access_sacco(app.payment_sacco(payment_id)::uuid));

-- accounts
drop policy if exists accounts_select on app.accounts;
create policy accounts_select
  on app.accounts
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists accounts_modify_admin on app.accounts;
create policy accounts_modify_admin
  on app.accounts
  for all
  using (app.is_admin());

-- ledger entries
drop policy if exists ledger_select on app.ledger_entries;
create policy ledger_select
  on app.ledger_entries
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists ledger_modify_admin on app.ledger_entries;
create policy ledger_modify_admin
  on app.ledger_entries
  for all
  using (app.is_admin());

-- sms inbox
drop policy if exists sms_select on app.sms_inbox;
create policy sms_select
  on app.sms_inbox
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists sms_modify on app.sms_inbox;
create policy sms_modify
  on app.sms_inbox
  for all
  using (app.can_access_sacco(sacco_id));

-- import files
drop policy if exists import_select on app.import_files;
create policy import_select
  on app.import_files
  for select
  using (app.can_access_sacco(sacco_id));

drop policy if exists import_modify on app.import_files;
create policy import_modify
  on app.import_files
  for all
  using (app.can_access_sacco(sacco_id));



-- From: 20251027200000_web_push_subscriptions.sql

-- Web Push Subscriptions
-- Stores user push subscription endpoints for web push notifications with topic-based subscriptions

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  -- Topics this subscription is interested in (e.g., ["all", "sacco:uuid", "ikimina:uuid"])
  topics JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_push_subscriptions_user_id ON public.user_push_subscriptions(user_id);

-- Index for topic-based queries (GIN index for JSONB array containment)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_push_subscriptions_topics ON public.user_push_subscriptions USING GIN(topics);

-- Enable RLS
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY user_push_subscriptions_owner_policy
  ON public.user_push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System admins can view all subscriptions
CREATE POLICY user_push_subscriptions_admin_policy
  ON public.user_push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'SYSTEM_ADMIN'
    )
  );

COMMENT ON TABLE public.user_push_subscriptions IS 'Web Push subscription endpoints with topic-based filtering for user notifications';
COMMENT ON COLUMN public.user_push_subscriptions.topics IS 'JSON array of topic strings for filtering notifications (e.g., ["all", "sacco:uuid", "ikimina:uuid"])';


-- From: 20251027200001_staff_management.sql

-- Staff management: Add fields for password reset, account status, and staff metadata
-- Supports E1: Staff Directory + Add/Invite Staff
-- Note: This migration is deprecated - use staff_members table instead

-- Create enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_account_status') THEN
    CREATE TYPE public.user_account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
  END IF;
END $$;

-- Skip user table modifications if public.users is a view
-- Staff data is handled by staff_members and user_profiles tables
DO $$
BEGIN
  RAISE NOTICE 'Staff management fields are handled by staff_members and user_profiles tables';
END $$;


-- From: 20251027200100_analytics_event_logging.sql

-- Analytics Event Logging
-- Extends the existing system_metrics table with structured event logging for business metrics

-- Add new event types to track join requests, approvals, and exception resolution
-- This migration enhances telemetry tracking for operational analytics

-- Create analytics_events table for detailed event tracking with timing metrics
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  -- Entity references (using UUID without foreign keys for flexibility)
  sacco_id UUID,
  ikimina_id UUID,
  user_id UUID,
  payment_id UUID,
  -- Event metadata and timing
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- For tracking time between related events (e.g., request created -> approved)
  related_event_id UUID,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_analytics_events_sacco_id ON public.analytics_events(sacco_id) WHERE sacco_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_analytics_events_ikimina_id ON public.analytics_events(ikimina_id) WHERE ikimina_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_analytics_events_occurred_at ON public.analytics_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_analytics_events_related ON public.analytics_events(related_event_id) WHERE related_event_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Staff can view events for their assigned SACCO
CREATE POLICY analytics_events_staff_policy
  ON public.analytics_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (
          users.role = 'SYSTEM_ADMIN'
          OR users.sacco_id = analytics_events.sacco_id
        )
    )
  );

-- Service role can insert events
CREATE POLICY analytics_events_service_policy
  ON public.analytics_events
  FOR ALL
  USING (auth.uid() IS NULL OR auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.uid() IS NULL OR auth.jwt()->>'role' = 'service_role');

-- Helper function to log an analytics event
CREATE OR REPLACE FUNCTION public.log_analytics_event(
  p_event_type TEXT,
  p_sacco_id UUID DEFAULT NULL,
  p_ikimina_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_payment_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_related_event_id UUID DEFAULT NULL,
  p_duration_seconds INTEGER DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.analytics_events (
    event_type,
    sacco_id,
    ikimina_id,
    user_id,
    payment_id,
    metadata,
    related_event_id,
    duration_seconds,
    occurred_at
  ) VALUES (
    p_event_type,
    p_sacco_id,
    p_ikimina_id,
    p_user_id,
    p_payment_id,
    p_metadata,
    p_related_event_id,
    p_duration_seconds,
    NOW()
  ) RETURNING id INTO v_event_id;

  -- Also increment the system_metrics counter for backwards compatibility
  PERFORM public.increment_system_metric(p_event_type, 1, p_metadata);

  RETURN v_event_id;
END;
$$;

-- Helper function to calculate and log completion time for a workflow
CREATE OR REPLACE FUNCTION public.log_analytics_completion(
  p_event_type TEXT,
  p_initial_event_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_duration_seconds INTEGER;
  v_initial_occurred_at TIMESTAMPTZ;
BEGIN
  -- Get the initial event timestamp
  SELECT occurred_at INTO v_initial_occurred_at
  FROM public.analytics_events
  WHERE id = p_initial_event_id;

  IF v_initial_occurred_at IS NULL THEN
    RAISE EXCEPTION 'Initial event not found: %', p_initial_event_id;
  END IF;

  -- Calculate duration in seconds
  v_duration_seconds := EXTRACT(EPOCH FROM (NOW() - v_initial_occurred_at))::INTEGER;

  -- Insert completion event
  INSERT INTO public.analytics_events (
    event_type,
    sacco_id,
    ikimina_id,
    user_id,
    payment_id,
    metadata,
    related_event_id,
    duration_seconds,
    occurred_at
  )
  SELECT
    p_event_type,
    sacco_id,
    ikimina_id,
    user_id,
    payment_id,
    p_metadata || jsonb_build_object('duration_seconds', v_duration_seconds),
    p_initial_event_id,
    v_duration_seconds,
    NOW()
  FROM public.analytics_events
  WHERE id = p_initial_event_id
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Seed some initial event type metadata for documentation
INSERT INTO public.system_metrics (event, total, last_occurred, meta)
VALUES
  ('join_request_created', 0, NOW(), '{"description": "Member join request initiated"}'::jsonb),
  ('join_request_approved', 0, NOW(), '{"description": "Member join request approved", "tracks_duration": true}'::jsonb),
  ('join_request_rejected', 0, NOW(), '{"description": "Member join request rejected", "tracks_duration": true}'::jsonb),
  ('exception_created', 0, NOW(), '{"description": "Payment exception flagged for review"}'::jsonb),
  ('exception_resolved', 0, NOW(), '{"description": "Payment exception resolved", "tracks_duration": true}'::jsonb),
  ('exception_escalated', 0, NOW(), '{"description": "Payment exception escalated", "tracks_duration": true}'::jsonb)
ON CONFLICT (event) DO NOTHING;

COMMENT ON TABLE public.analytics_events IS 'Detailed event tracking for business metrics and operational analytics';
COMMENT ON COLUMN public.analytics_events.duration_seconds IS 'Time elapsed from related_event to this event, for workflow timing analytics';
COMMENT ON FUNCTION public.log_analytics_event IS 'Logs an analytics event with optional entity references and metadata';
COMMENT ON FUNCTION public.log_analytics_completion IS 'Logs a completion event with calculated duration from an initial event';


-- From: 20251030000000_pre_organizations_helper.sql

-- Helper migration to create placeholder for migrations that reference organizations
-- This allows migrations dated before 20251110 (when organizations is created) to work

-- Create a temporary placeholder organizations table if it doesn't exist
-- The real organizations table will be created in 20251110100000_multitenancy.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    CREATE TABLE IF NOT EXISTS public.organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    COMMENT ON TABLE public.organizations IS 'Temporary placeholder - will be replaced by 20251110100000_multitenancy.sql';
  END IF;
  
  -- Also create org_memberships placeholder
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_memberships') THEN
    CREATE TABLE IF NOT EXISTS public.org_memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(org_id, user_id)
    );
    
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);
    
    COMMENT ON TABLE public.org_memberships IS 'Temporary placeholder - will be replaced by multitenancy migration';
  END IF;
END $$;



-- From: 20251031000000_enhanced_feature_flags.sql

-- Migration: Enhanced feature flags for African fintech supa app
-- Description: Add feature toggle matrix with org-level and partner-level configurations
-- Date: 2025-10-31

-- Extend configuration table to support feature flag metadata
COMMENT ON TABLE public.configuration IS 'Key-value configuration store for feature flags and operational settings';

-- Insert enhanced feature flag schema with regulatory tiers
INSERT INTO public.configuration (key, description, value)
VALUES (
  'client_feature_matrix',
  'Feature toggle matrix for client app with regulatory tiers (P0=no licenses, P1=partnered, P2=licensed)',
  '{
    "savings": {
      "enabled": true,
      "tier": "P0",
      "features": {
        "ussd_deposit_reference": true,
        "allocation_evidence": true,
        "group_vault_proxy": false,
        "direct_account_api": false
      }
    },
    "loans": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "digital_applications": false,
        "doc_collection": false,
        "pre_scoring": false,
        "offer_accept_disburse": false
      }
    },
    "wallet": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "proxy_wallet": false,
        "transaction_evidence": false,
        "light_custodial": false,
        "full_custodial": false
      }
    },
    "tokens": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "voucher_tokens_offchain": false,
        "stablecoin_onramp": false,
        "multi_chain_settlement": false
      }
    },
    "nfc": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "ndef_tag_reference": false,
        "hce_vouchers": false,
        "card_emulation_closed_loop": false
      }
    },
    "kyc": {
      "enabled": true,
      "tier": "P0",
      "features": {
        "ocr_selfie_capture": true,
        "third_party_screening": false,
        "full_kyc_account_opening": false
      }
    },
    "ai_agent": {
      "enabled": false,
      "tier": "P0",
      "features": {
        "faq_ussd_help": false,
        "whatsapp_bot": false,
        "voice_ivr_ticketing": false
      }
    }
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;

-- Add org-specific feature overrides table
CREATE TABLE IF NOT EXISTS public.org_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,  -- Note: organizations table may not exist yet
  feature_domain TEXT NOT NULL CHECK (feature_domain IN ('savings', 'loans', 'wallet', 'tokens', 'nfc', 'kyc', 'ai_agent')),
  tier TEXT NOT NULL CHECK (tier IN ('P0', 'P1', 'P2')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  feature_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  partner_agreement_ref TEXT,
  risk_signoff_by UUID REFERENCES auth.users(id),
  risk_signoff_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, feature_domain)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_feature_overrides_org_id ON public.org_feature_overrides(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_feature_overrides_domain ON public.org_feature_overrides(feature_domain);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_feature_overrides_enabled ON public.org_feature_overrides(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE public.org_feature_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "System admins manage org feature overrides"
  ON public.org_feature_overrides
  FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

-- Only create this policy if org_memberships table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_memberships') THEN
    EXECUTE '
      CREATE POLICY "Staff can read their org feature overrides"
        ON public.org_feature_overrides
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.org_memberships
            WHERE org_id = org_feature_overrides.org_id
            AND user_id = auth.uid()
          )
        )';
  ELSE
    -- Fallback: allow authenticated users to read (can be tightened later)
    EXECUTE '
      CREATE POLICY "Staff can read their org feature overrides"
        ON public.org_feature_overrides
        FOR SELECT
        USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_org_feature_overrides_updated_at ON public.org_feature_overrides;
CREATE TRIGGER update_org_feature_overrides_updated_at
  BEFORE UPDATE ON public.org_feature_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.org_feature_overrides TO authenticated;
GRANT ALL ON public.org_feature_overrides TO service_role;

-- Add comments
COMMENT ON TABLE public.org_feature_overrides IS 'Organization-specific feature flag overrides with regulatory tier tracking';
COMMENT ON COLUMN public.org_feature_overrides.tier IS 'Regulatory tier: P0=no licenses, P1=partnered, P2=licensed';
COMMENT ON COLUMN public.org_feature_overrides.partner_agreement_ref IS 'Reference to partnership agreement document or ID';
COMMENT ON COLUMN public.org_feature_overrides.risk_signoff_by IS 'User who approved the risk assessment';


-- From: 20251031010000_ai_agent_infrastructure.sql

-- Migration: AI Agent Infrastructure (Autonomous Multi-tenant Customer Support)
-- Description: Knowledge bases, tickets, and conversation management for AI agent
-- Date: 2025-10-31

-- Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Organization-specific knowledge base (SACCO-specific help articles)
-- Note: org_id references are conditional - table will be created properly after organizations table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS public.org_kb (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT[] DEFAULT ''{}''::text[],
        embedding vector(1536),
        policy_tag TEXT,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )';
  ELSE
    -- Create without FK constraint; will be added by later migration
    EXECUTE '
      CREATE TABLE IF NOT EXISTS public.org_kb (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT[] DEFAULT ''{}''::text[],
        embedding vector(1536),
        policy_tag TEXT,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )';
  END IF;
END $$;

-- Ensure embedding column exists (in case table was created without it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_kb' AND column_name = 'embedding') THEN
    ALTER TABLE public.org_kb ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- Create vector index for similarity search
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_kb' AND column_name = 'embedding') THEN
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_kb_embedding ON public.org_kb USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_kb_org_id ON public.org_kb(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_kb_tags ON public.org_kb USING GIN(tags);

-- Global knowledge base (system-wide policies, USSD best practices, etc.)
CREATE TABLE IF NOT EXISTS public.global_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  embedding vector(1536),
  policy_tag TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_global_kb_embedding ON public.global_kb USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_global_kb_tags ON public.global_kb USING GIN(tags);

-- FAQ table (common Q&A)
CREATE TABLE IF NOT EXISTS public.faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL = global FAQ
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  embedding vector(1536),
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_faq_embedding ON public.faq USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_faq_org_id ON public.faq(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_faq_tags ON public.faq USING GIN(tags);

-- Tickets table (multi-channel support tickets)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT CHECK (channel IN ('in_app', 'whatsapp', 'email', 'ivr')) NOT NULL,
  subject TEXT NOT NULL,
  status TEXT CHECK (status IN ('open', 'pending', 'resolved', 'closed')) NOT NULL DEFAULT 'open',
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  meta JSONB DEFAULT '{}'::jsonb, -- e.g., {"reference_token": "...", "group_id": "...", "whatsapp_number": "..."}
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tickets_org_id ON public.tickets(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tickets_channel ON public.tickets(channel);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);

-- Ticket messages (conversation history)
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender TEXT CHECK (sender IN ('user', 'agent', 'staff')) NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb, -- Array of signed URLs
  metadata JSONB DEFAULT '{}'::jsonb, -- Agent metadata, tool calls, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ticket_messages_sender ON public.ticket_messages(sender);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ticket_messages_created_at ON public.ticket_messages(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.org_kb ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_kb ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for org_kb
CREATE POLICY "Staff can manage their org KB"
  ON public.org_kb
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = org_kb.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for global_kb (admin only for write, read-only for authenticated)
CREATE POLICY "Admins manage global KB"
  ON public.global_kb
  FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "Authenticated users can read global KB"
  ON public.global_kb
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for FAQ
CREATE POLICY "Staff can manage their org FAQ"
  ON public.faq
  FOR ALL
  USING (
    org_id IS NULL AND public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    OR EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = faq.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can read FAQ"
  ON public.faq
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for tickets
CREATE POLICY "Users can view their own tickets"
  ON public.tickets
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets"
  ON public.tickets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view their org tickets"
  ON public.tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = tickets.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update their org tickets"
  ON public.tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = tickets.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for ticket_messages
CREATE POLICY "Users can view messages for their tickets"
  ON public.ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_messages.ticket_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add messages to their tickets"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_messages.ticket_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view messages for org tickets"
  ON public.ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      INNER JOIN public.org_memberships om ON om.org_id = t.org_id
      WHERE t.id = ticket_messages.ticket_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can add messages to org tickets"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      INNER JOIN public.org_memberships om ON om.org_id = t.org_id
      WHERE t.id = ticket_messages.ticket_id
      AND om.user_id = auth.uid()
    )
  );

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_org_kb_updated_at ON public.org_kb;
CREATE TRIGGER update_org_kb_updated_at
  BEFORE UPDATE ON public.org_kb
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_kb_updated_at ON public.global_kb;
CREATE TRIGGER update_global_kb_updated_at
  BEFORE UPDATE ON public.global_kb
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_faq_updated_at ON public.faq;
CREATE TRIGGER update_faq_updated_at
  BEFORE UPDATE ON public.faq
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.org_kb TO authenticated;
GRANT SELECT ON public.global_kb TO authenticated;
GRANT SELECT ON public.faq TO authenticated;
GRANT ALL ON public.tickets TO authenticated;
GRANT ALL ON public.ticket_messages TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Comments
COMMENT ON TABLE public.org_kb IS 'Organization-specific knowledge base for AI agent RAG';
COMMENT ON TABLE public.global_kb IS 'Global knowledge base with system-wide policies and best practices';
COMMENT ON TABLE public.faq IS 'Frequently asked questions with embeddings for semantic search';
COMMENT ON TABLE public.tickets IS 'Multi-channel support tickets (in-app, WhatsApp, email, IVR)';
COMMENT ON TABLE public.ticket_messages IS 'Conversation history for support tickets';
COMMENT ON COLUMN public.org_kb.embedding IS 'Vector embedding for RAG similarity search (OpenAI text-embedding-3-large)';
COMMENT ON COLUMN public.tickets.meta IS 'Ticket metadata: reference_token, group_id, whatsapp_number, etc.';
COMMENT ON COLUMN public.ticket_messages.metadata IS 'Agent metadata: tool calls, confidence scores, citations, etc.';


-- From: 20251031030000_wallet_tokens.sql

-- Migration: Wallet and Token Infrastructure (Non-Custodial, Evidence Only)
-- Description: Voucher tokens off-chain, transaction evidence, NO funds handling
-- Date: 2025-10-31

-- Wallet tokens table (vouchers, loyalty points, closed-loop tokens)
CREATE TABLE IF NOT EXISTS public.wallet_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Token metadata
  token_type TEXT CHECK (token_type IN ('VOUCHER', 'LOYALTY_POINT', 'ATTENDANCE_CREDIT', 'CLOSED_LOOP_TOKEN')) NOT NULL,
  token_code TEXT NOT NULL, -- JWT or EdDSA signed token
  token_signature TEXT NOT NULL, -- Digital signature for verification
  
  -- Token details
  display_name TEXT NOT NULL, -- e.g., "Market Day Voucher", "Group Meeting Credit"
  description TEXT,
  value_amount NUMERIC(15,2), -- Nominal value (informational only)
  value_currency TEXT DEFAULT 'RWF',
  
  -- Validity
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id), -- Staff who processed redemption
  redeemed_location TEXT, -- e.g., "SACCO Office", "Group Meeting"
  
  -- Status
  status TEXT CHECK (status IN ('ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED')) NOT NULL DEFAULT 'ACTIVE',
  
  -- Redemption evidence
  redemption_reference TEXT,
  redemption_notes TEXT,
  redemption_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- NFC support
  nfc_enabled BOOLEAN DEFAULT false,
  nfc_data TEXT, -- NDEF payload for tap-to-redeem
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(token_code) -- Prevent duplicate tokens
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_tokens_org_id ON public.wallet_tokens(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_tokens_user_id ON public.wallet_tokens(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_tokens_status ON public.wallet_tokens(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_tokens_token_type ON public.wallet_tokens(token_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_tokens_expires_at ON public.wallet_tokens(expires_at) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_tokens_token_code ON public.wallet_tokens(token_code);

-- Wallet transaction evidence table (proof of external transactions, not ledger)
CREATE TABLE IF NOT EXISTS public.wallet_transaction_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction reference
  external_reference TEXT NOT NULL, -- MoMo transaction ID, bank reference, etc.
  transaction_type TEXT CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'VOUCHER_REDEMPTION')) NOT NULL,
  
  -- Amount and currency
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  
  -- Parties
  from_party TEXT, -- e.g., "User's MoMo Account", "SACCO Merchant Account"
  to_party TEXT,
  
  -- Evidence metadata
  evidence_type TEXT CHECK (evidence_type IN ('SMS', 'EMAIL', 'API_CALLBACK', 'MANUAL_UPLOAD', 'ALLOCATION')) NOT NULL,
  evidence_url TEXT, -- Signed URL to evidence document/screenshot
  evidence_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Verification
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  
  -- Timestamps
  transaction_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_transaction_evidence_org_id ON public.wallet_transaction_evidence(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_transaction_evidence_user_id ON public.wallet_transaction_evidence(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_transaction_evidence_external_ref ON public.wallet_transaction_evidence(external_reference);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_transaction_evidence_transaction_type ON public.wallet_transaction_evidence(transaction_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_wallet_transaction_evidence_verified ON public.wallet_transaction_evidence(verified);

-- Stablecoin transfer metadata table (P2 tier only, metadata tracking)
CREATE TABLE IF NOT EXISTS public.stablecoin_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transfer details
  direction TEXT CHECK (direction IN ('ON_RAMP', 'OFF_RAMP', 'TRANSFER')) NOT NULL,
  chain TEXT NOT NULL, -- e.g., 'celo', 'polygon', 'ethereum'
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL, -- e.g., 'cUSD', 'USDC'
  amount NUMERIC(30,18) NOT NULL, -- High precision for crypto amounts
  
  -- Blockchain references (metadata only, no private keys)
  transaction_hash TEXT,
  block_number BIGINT,
  from_address TEXT,
  to_address TEXT,
  
  -- Partner integration
  partner_name TEXT, -- On/off-ramp partner
  partner_reference TEXT,
  partner_fee NUMERIC(15,2),
  
  -- Fiat equivalent
  fiat_amount NUMERIC(15,2),
  fiat_currency TEXT DEFAULT 'RWF',
  exchange_rate NUMERIC(15,6),
  
  -- Status
  status TEXT CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED')) NOT NULL DEFAULT 'PENDING',
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Risk and compliance
  kyc_verified BOOLEAN DEFAULT false,
  kyc_level TEXT, -- e.g., 'BASIC', 'ENHANCED', 'FULL'
  aml_check_passed BOOLEAN,
  risk_score NUMERIC(3,2), -- 0.00 to 1.00
  risk_notes TEXT,
  
  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_stablecoin_transfers_org_id ON public.stablecoin_transfers(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_stablecoin_transfers_user_id ON public.stablecoin_transfers(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_stablecoin_transfers_transaction_hash ON public.stablecoin_transfers(transaction_hash);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_stablecoin_transfers_status ON public.stablecoin_transfers(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_stablecoin_transfers_direction ON public.stablecoin_transfers(direction);

-- Enable RLS
ALTER TABLE public.wallet_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transaction_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stablecoin_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallet_tokens
CREATE POLICY "Users can view their own tokens"
  ON public.wallet_tokens
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view org tokens"
  ON public.wallet_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = wallet_tokens.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can issue tokens to org members"
  ON public.wallet_tokens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = wallet_tokens.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update org tokens"
  ON public.wallet_tokens
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = wallet_tokens.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for wallet_transaction_evidence
CREATE POLICY "Users can view their own transaction evidence"
  ON public.wallet_transaction_evidence
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can submit transaction evidence"
  ON public.wallet_transaction_evidence
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view org transaction evidence"
  ON public.wallet_transaction_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = wallet_transaction_evidence.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can verify org transaction evidence"
  ON public.wallet_transaction_evidence
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = wallet_transaction_evidence.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for stablecoin_transfers
CREATE POLICY "Users can view their own stablecoin transfers"
  ON public.stablecoin_transfers
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can initiate stablecoin transfers"
  ON public.stablecoin_transfers
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view org stablecoin transfers"
  ON public.stablecoin_transfers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = stablecoin_transfers.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update org stablecoin transfers"
  ON public.stablecoin_transfers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = stablecoin_transfers.org_id
      AND user_id = auth.uid()
    )
  );

-- Function to auto-expire tokens
CREATE OR REPLACE FUNCTION expire_wallet_tokens()
RETURNS void AS $$
BEGIN
  UPDATE public.wallet_tokens
  SET status = 'EXPIRED'
  WHERE status = 'ACTIVE'
  AND expires_at IS NOT NULL
  AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_wallet_tokens_updated_at ON public.wallet_tokens;
CREATE TRIGGER update_wallet_tokens_updated_at
  BEFORE UPDATE ON public.wallet_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallet_transaction_evidence_updated_at ON public.wallet_transaction_evidence;
CREATE TRIGGER update_wallet_transaction_evidence_updated_at
  BEFORE UPDATE ON public.wallet_transaction_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stablecoin_transfers_updated_at ON public.stablecoin_transfers;
CREATE TRIGGER update_stablecoin_transfers_updated_at
  BEFORE UPDATE ON public.stablecoin_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT ON public.wallet_tokens TO authenticated;
GRANT SELECT, INSERT ON public.wallet_transaction_evidence TO authenticated;
GRANT SELECT, INSERT ON public.stablecoin_transfers TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Comments
COMMENT ON TABLE public.wallet_tokens IS 'Non-custodial voucher tokens and loyalty points (evidence only, no fund handling)';
COMMENT ON TABLE public.wallet_transaction_evidence IS 'Proof of external wallet transactions (not a ledger)';
COMMENT ON TABLE public.stablecoin_transfers IS 'Stablecoin on/off-ramp metadata tracking (P2 tier, requires licensing)';
COMMENT ON COLUMN public.wallet_tokens.token_code IS 'JWT or EdDSA signed token for redemption';
COMMENT ON COLUMN public.wallet_tokens.nfc_enabled IS 'Whether token can be redeemed via NFC tap';
COMMENT ON COLUMN public.wallet_transaction_evidence.evidence_type IS 'Source of transaction proof: SMS, EMAIL, API_CALLBACK, MANUAL_UPLOAD, ALLOCATION';
COMMENT ON COLUMN public.stablecoin_transfers.transaction_hash IS 'Blockchain transaction hash (metadata only, we do not hold private keys)';


-- From: 20251031040000_nfc_references.sql

-- Migration: NFC Reference Management
-- Description: NDEF tag data for group reference tokens, tap-to-copy, offline support
-- Date: 2025-10-31

-- NFC tag registrations (for NDEF tags with group references)
CREATE TABLE IF NOT EXISTS public.nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE, -- NULL if member-specific
  group_member_id UUID REFERENCES public.group_members(id) ON DELETE CASCADE, -- NULL if group-level
  
  -- Tag metadata
  tag_uid TEXT UNIQUE, -- NFC tag unique identifier
  tag_type TEXT CHECK (tag_type IN ('NDEF', 'HCE', 'CARD_EMULATION')) NOT NULL,
  
  -- NDEF payload
  ndef_message TEXT NOT NULL, -- Full reference token or payment URL
  ndef_format TEXT DEFAULT 'text/plain', -- MIME type
  
  -- Display information
  display_name TEXT NOT NULL, -- e.g., "Abishyizehamwe Group Tag", "Marie's Member Card"
  description TEXT,
  
  -- Status and lifecycle
  status TEXT CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOST', 'REPLACED')) NOT NULL DEFAULT 'ACTIVE',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES auth.users(id),
  deactivation_reason TEXT,
  
  -- Write protection
  locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  
  -- Audit trail
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tags_org_id ON public.nfc_tags(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tags_group_id ON public.nfc_tags(group_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tags_group_member_id ON public.nfc_tags(group_member_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tags_tag_uid ON public.nfc_tags(tag_uid);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tags_status ON public.nfc_tags(status);

-- NFC tap events (for analytics and security monitoring)
CREATE TABLE IF NOT EXISTS public.nfc_tap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID REFERENCES public.nfc_tags(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event metadata
  event_type TEXT CHECK (event_type IN ('READ', 'WRITE', 'REDEEM', 'VERIFY')) NOT NULL,
  tag_uid TEXT,
  
  -- Device information
  device_info JSONB DEFAULT '{}'::jsonb, -- User agent, device model, OS version
  
  -- Location (optional)
  location_name TEXT, -- e.g., "SACCO Office", "Group Meeting"
  location_coordinates JSONB, -- {lat, lng}
  
  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  -- Timestamps
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tap_events_tag_id ON public.nfc_tap_events(tag_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tap_events_user_id ON public.nfc_tap_events(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tap_events_event_type ON public.nfc_tap_events(event_type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tap_events_event_timestamp ON public.nfc_tap_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_nfc_tap_events_tag_uid ON public.nfc_tap_events(tag_uid);

-- Enable RLS
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tap_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nfc_tags
CREATE POLICY "Authenticated users can view active NFC tags"
  ON public.nfc_tags
  FOR SELECT
  USING (status = 'ACTIVE' AND auth.role() = 'authenticated');

CREATE POLICY "Staff can manage their org NFC tags"
  ON public.nfc_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = nfc_tags.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for nfc_tap_events
CREATE POLICY "Users can view their own tap events"
  ON public.nfc_tap_events
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can log tap events"
  ON public.nfc_tap_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL); -- Allow anonymous taps

CREATE POLICY "Staff can view org tap events"
  ON public.nfc_tap_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.nfc_tags nt
      INNER JOIN public.org_memberships om ON om.org_id = nt.org_id
      WHERE nt.id = nfc_tap_events.tag_id
      AND om.user_id = auth.uid()
    )
  );

-- Function to validate NDEF message format
CREATE OR REPLACE FUNCTION validate_ndef_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure NDEF message is not empty
  IF NEW.ndef_message IS NULL OR trim(NEW.ndef_message) = '' THEN
    RAISE EXCEPTION 'NDEF message cannot be empty';
  END IF;
  
  -- For group tags, ensure group_id is set
  IF NEW.tag_type = 'NDEF' AND NEW.group_id IS NULL AND NEW.group_member_id IS NULL THEN
    RAISE EXCEPTION 'NFC tag must be associated with a group or group member';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_nfc_tag_ndef ON public.nfc_tags;
CREATE TRIGGER validate_nfc_tag_ndef
  BEFORE INSERT OR UPDATE ON public.nfc_tags
  FOR EACH ROW
  EXECUTE FUNCTION validate_ndef_message();

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_nfc_tags_updated_at ON public.nfc_tags;
CREATE TRIGGER update_nfc_tags_updated_at
  BEFORE UPDATE ON public.nfc_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.nfc_tags TO authenticated;
GRANT INSERT ON public.nfc_tap_events TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Comments
COMMENT ON TABLE public.nfc_tags IS 'NFC tag registrations for group reference tokens and member cards';
COMMENT ON TABLE public.nfc_tap_events IS 'NFC tap event log for analytics and security monitoring';
COMMENT ON COLUMN public.nfc_tags.tag_uid IS 'NFC tag unique identifier (UID) from hardware';
COMMENT ON COLUMN public.nfc_tags.ndef_message IS 'NDEF payload: reference token, payment URL, or voucher code';
COMMENT ON COLUMN public.nfc_tags.tag_type IS 'Tag type: NDEF (physical tag), HCE (Host Card Emulation), CARD_EMULATION (closed loop)';
COMMENT ON COLUMN public.nfc_tags.locked IS 'Whether tag is write-protected (prevents tampering)';
COMMENT ON COLUMN public.nfc_tap_events.event_type IS 'Tap event type: READ (view reference), WRITE (program tag), REDEEM (voucher), VERIFY (check authenticity)';


-- From: 20251031080000_device_auth_system.sql

-- Device-bound authentication system for staff mobile app
-- Implements WebAuthn/FIDO-style challenge-response authentication

-- Device registry: stores public keys for registered staff devices
CREATE TABLE IF NOT EXISTS public.device_auth_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, -- Unique device identifier
  device_label TEXT, -- User-friendly device name (e.g., "Pixel 6 Pro")
  public_key TEXT NOT NULL, -- EC P-256 or Ed25519 public key (PEM format)
  key_algorithm TEXT NOT NULL DEFAULT 'ES256', -- ES256 (EC P-256) or Ed25519
  device_info JSONB, -- {model, os_version, manufacturer}
  
  -- Device attestation from Play Integrity API
  integrity_verdict JSONB, -- Latest integrity check result
  integrity_status TEXT CHECK (integrity_status IN ('MEETS_DEVICE_INTEGRITY', 'MEETS_BASIC_INTEGRITY', 'MEETS_STRONG_INTEGRITY', 'FAILED')),
  last_integrity_check_at TIMESTAMPTZ,
  
  -- Key lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revocation_reason TEXT,
  
  CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_auth_keys_user_id_idx ON public.device_auth_keys(user_id);
CREATE INDEX IF NOT EXISTS device_auth_keys_device_id_idx ON public.device_auth_keys(device_id);
CREATE INDEX IF NOT EXISTS device_auth_keys_active_idx ON public.device_auth_keys(user_id, revoked_at) WHERE revoked_at IS NULL;

-- Challenge store: temporary storage for login challenges
CREATE TABLE IF NOT EXISTS public.device_auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE, -- Web session identifier
  nonce TEXT NOT NULL UNIQUE, -- One-time random value (128-bit hex)
  origin TEXT NOT NULL, -- Expected web origin (e.g., https://admin.example.com)
  challenge_data JSONB NOT NULL, -- Full challenge payload for verification
  
  -- Challenge lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Short TTL: 30-60 seconds
  used_at TIMESTAMPTZ, -- Set when challenge is successfully verified
  verified_by_device UUID REFERENCES public.device_auth_keys(id),
  
  -- Audit trail
  ip_address TEXT,
  user_agent TEXT,
  
  CONSTRAINT not_used_and_verified CHECK (
    (used_at IS NULL AND verified_by_device IS NULL) OR 
    (used_at IS NOT NULL AND verified_by_device IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS device_auth_challenges_session_id_idx ON public.device_auth_challenges(session_id);
CREATE INDEX IF NOT EXISTS device_auth_challenges_nonce_idx ON public.device_auth_challenges(nonce);
CREATE INDEX IF NOT EXISTS device_auth_challenges_expires_at_idx ON public.device_auth_challenges(expires_at);

-- Audit log for device authentication events
CREATE TABLE IF NOT EXISTS public.device_auth_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'DEVICE_ENROLLED',
    'DEVICE_REVOKED',
    'CHALLENGE_CREATED',
    'CHALLENGE_VERIFIED',
    'CHALLENGE_FAILED',
    'INTEGRITY_CHECK_PASSED',
    'INTEGRITY_CHECK_FAILED'
  )),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_key_id UUID REFERENCES public.device_auth_keys(id) ON DELETE SET NULL,
  challenge_id UUID REFERENCES public.device_auth_challenges(id) ON DELETE SET NULL,
  
  -- Event details
  success BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT,
  metadata JSONB, -- Additional context (IP, location, device info, etc.)
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_auth_audit_user_id_idx ON public.device_auth_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS device_auth_audit_device_key_id_idx ON public.device_auth_audit(device_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS device_auth_audit_event_type_idx ON public.device_auth_audit(event_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.device_auth_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_auth_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device_auth_keys
CREATE POLICY "Users can view their own devices"
  ON public.device_auth_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices during enrollment"
  ON public.device_auth_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices (revoke, update last_used)"
  ON public.device_auth_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System admins can view all devices"
  ON public.device_auth_keys
  FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "System admins can revoke any device"
  ON public.device_auth_keys
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

-- RLS Policies for device_auth_challenges
-- Note: Challenges are managed by API endpoints, not directly by users
-- Service role key is used for challenge creation/verification
CREATE POLICY "Service role can manage challenges"
  ON public.device_auth_challenges
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for device_auth_audit
CREATE POLICY "Users can view their own audit logs"
  ON public.device_auth_audit
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System admins can view all audit logs"
  ON public.device_auth_audit
  FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "Service role can insert audit logs"
  ON public.device_auth_audit
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Cleanup function: remove expired challenges (run via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_device_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.device_auth_challenges
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Add cleanup to pg_cron (if available) - run every 5 minutes
-- Note: This assumes pg_cron extension is enabled
-- SELECT cron.schedule('cleanup-device-challenges', '*/5 * * * *', 'SELECT public.cleanup_expired_device_challenges()');


-- From: 20251031102310_fix_increment_metric_meta_ambiguity.sql

-- Fix: remove ambiguity in public.increment_metric by using EXCLUDED values in the upsert
-- Safer and clearer than referencing the function parameter inside DO UPDATE

CREATE OR REPLACE FUNCTION public.increment_metric(
  event_name text,
  delta integer,
  meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.system_metrics (event, total, last_occurred, meta)
  VALUES (event_name, delta, NOW(), COALESCE(meta, '{}'::jsonb))
  ON CONFLICT (event) DO UPDATE
    SET total = public.system_metrics.total + GREATEST(EXCLUDED.total, 0),
        last_occurred = NOW(),
        meta = CASE
          WHEN EXCLUDED.meta = '{}'::jsonb THEN public.system_metrics.meta
          ELSE EXCLUDED.meta
        END;
END;
$function$;


-- From: 20251031193000_live_hotfixes.sql

-- === ENUMS =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE n.nspname='public' AND t.typname='notification_channel') THEN
    EXECUTE 'CREATE TYPE public.notification_channel AS ENUM (''IN_APP'',''EMAIL'',''WHATSAPP'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE n.nspname='public' AND t.typname='notification_type') THEN
    EXECUTE 'CREATE TYPE public.notification_type AS ENUM (''invite_accepted'',''new_member'',''payment_confirmed'')';
  END IF;
END $$;

-- === USERS VIEW ===============================================
DO $$
DECLARE
  view_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_views
    WHERE schemaname = 'public' AND viewname = 'users'
  )
  INTO view_exists;

  IF view_exists THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.users
        (id,email,role,sacco_id,status,pw_reset_required,last_login_at,suspended_at,
         suspended_by,notes,created_at,updated_at,mfa_enabled,mfa_enrolled_at,
         mfa_passkey_enrolled,mfa_methods,mfa_backup_hashes,failed_mfa_count,
         last_mfa_success_at,last_mfa_step,mfa_secret_enc)
      WITH (security_barrier = true) AS
      SELECT
        p.user_id AS id,
        au.email,
        COALESCE(p.role,'SACCO_STAFF')::public.app_role AS role,
        p.sacco_id,
        p.status,
        p.pw_reset_required,
        p.last_login_at,
        p.suspended_at,
        p.suspended_by,
        p.notes,
        au.created_at,
        au.updated_at,
        COALESCE((au.raw_user_meta_data ->> 'mfa_enabled')::boolean,false) AS mfa_enabled,
        (au.raw_user_meta_data ->> 'mfa_enrolled_at')::timestamptz         AS mfa_enrolled_at,
        COALESCE((au.raw_user_meta_data ->> 'mfa_passkey_enrolled')::boolean,false) AS mfa_passkey_enrolled,
        COALESCE( au.raw_user_meta_data -> 'mfa_methods', '[]'::jsonb)     AS mfa_methods,
        COALESCE( au.raw_user_meta_data -> 'mfa_backup_hashes','[]'::jsonb)AS mfa_backup_hashes,
        COALESCE((au.raw_user_meta_data ->> 'failed_mfa_count')::int,0)    AS failed_mfa_count,
        (au.raw_user_meta_data ->> 'last_mfa_success_at')::timestamptz     AS last_mfa_success_at,
        (au.raw_user_meta_data ->> 'last_mfa_step')::int                   AS last_mfa_step,
        (au.raw_user_meta_data ->> 'mfa_secret_enc')                       AS mfa_secret_enc
      FROM app.user_profiles p
      JOIN auth.users au ON au.id = p.user_id;
    $view$;
  ELSE
    EXECUTE $view$
      CREATE VIEW public.users
        (id,email,role,sacco_id,status,pw_reset_required,last_login_at,suspended_at,
         suspended_by,notes,created_at,updated_at,mfa_enabled,mfa_enrolled_at,
         mfa_passkey_enrolled,mfa_methods,mfa_backup_hashes,failed_mfa_count,
         last_mfa_success_at,last_mfa_step,mfa_secret_enc)
      WITH (security_barrier = true) AS
      SELECT
        p.user_id AS id,
        au.email,
        COALESCE(p.role,'SACCO_STAFF')::public.app_role AS role,
        p.sacco_id,
        p.status,
        p.pw_reset_required,
        p.last_login_at,
        p.suspended_at,
        p.suspended_by,
        p.notes,
        au.created_at,
        au.updated_at,
        COALESCE((au.raw_user_meta_data ->> 'mfa_enabled')::boolean,false) AS mfa_enabled,
        (au.raw_user_meta_data ->> 'mfa_enrolled_at')::timestamptz         AS mfa_enrolled_at,
        COALESCE((au.raw_user_meta_data ->> 'mfa_passkey_enrolled')::boolean,false) AS mfa_passkey_enrolled,
        COALESCE( au.raw_user_meta_data -> 'mfa_methods', '[]'::jsonb)     AS mfa_methods,
        COALESCE( au.raw_user_meta_data -> 'mfa_backup_hashes','[]'::jsonb)AS mfa_backup_hashes,
        COALESCE((au.raw_user_meta_data ->> 'failed_mfa_count')::int,0)    AS failed_mfa_count,
        (au.raw_user_meta_data ->> 'last_mfa_success_at')::timestamptz     AS last_mfa_success_at,
        (au.raw_user_meta_data ->> 'last_mfa_step')::int                   AS last_mfa_step,
        (au.raw_user_meta_data ->> 'mfa_secret_enc')                       AS mfa_secret_enc
      FROM app.user_profiles p
      JOIN auth.users au ON au.id = p.user_id;
    $view$;
  END IF;
END $$;
ALTER VIEW public.users SET (security_barrier = true);

-- === OTP: one active code per phone ===========================
CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_otp_active
  ON app.whatsapp_otp_codes (phone_number)
  WHERE consumed_at IS NULL;

-- === Telco timestamps + unique ================================
ALTER TABLE public.telco_providers
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  c.contype='u' AND n.nspname='public' AND t.relname='telco_providers'
           AND pg_get_constraintdef(c.oid) ILIKE 'UNIQUE (country_id, name)%'
  ) THEN
    ALTER TABLE public.telco_providers
      ADD CONSTRAINT telco_providers_country_name_key UNIQUE (country_id, name);
  END IF;
END $$;

-- === Helper: is_platform_admin() ==============================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role = 'SYSTEM_ADMIN'
  );
$$;


-- From: 20251101090000_notification_queue_channels.sql

-- Notification queue channel support and delivery telemetry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'notification_channel'
  ) THEN
    CREATE TYPE public.notification_channel AS ENUM ('WHATSAPP', 'EMAIL');
  END IF;
END
$$;

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS channel public.notification_channel NOT NULL DEFAULT 'WHATSAPP',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ;

-- Ensure existing rows have a concrete channel value
UPDATE public.notification_queue
SET channel = COALESCE(channel, 'WHATSAPP'::public.notification_channel);


-- From: 20251101090500_notification_channel_in_app.sql

-- Extend notification_channel enum with IN_APP and require explicit values on notification_queue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'notification_channel'
      AND pg_type.typnamespace = 'public'::regnamespace
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = 'public.notification_channel'::regtype
        AND enumlabel = 'IN_APP'
    ) THEN
      ALTER TYPE public.notification_channel ADD VALUE 'IN_APP';
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.notification_queue
  ALTER COLUMN channel DROP DEFAULT;


-- From: 20251101120000_update_notification_channel_enum.sql

-- Update notification_channel enum and enforce explicit channel selection
ALTER TYPE public.notification_channel
  ADD VALUE IF NOT EXISTS 'IN_APP';

-- Align existing queue entries with the new in-app channel option
UPDATE public.notification_queue
SET channel = 'IN_APP'::public.notification_channel
WHERE channel = 'WHATSAPP'::public.notification_channel;

-- Require callers to provide a channel explicitly going forward
ALTER TABLE public.notification_queue
  ALTER COLUMN channel DROP DEFAULT;


-- From: 20251103161327_tapmomo_schema.sql

-- TapMoMo Merchant Management
CREATE TABLE IF NOT EXISTS public.tapmomo_merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
    merchant_code TEXT NOT NULL UNIQUE,
    secret_key TEXT NOT NULL, -- Base64 encoded secret for HMAC
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tapmomo_merchants_user_id ON public.tapmomo_merchants(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tapmomo_merchants_merchant_code ON public.tapmomo_merchants(merchant_code);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tapmomo_merchants_network ON public.tapmomo_merchants(network);

-- TapMoMo Transactions
CREATE TABLE IF NOT EXISTS public.tapmomo_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.tapmomo_merchants(id) ON DELETE CASCADE,
    nonce UUID NOT NULL UNIQUE,
    amount INTEGER,
    currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency IN ('RWF', 'USD', 'EUR')),
    ref TEXT,
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending', 'settled', 'failed', 'cancelled')),
    payer_hint TEXT, -- Phone number or identifier if available
    payment_method TEXT DEFAULT 'NFC', -- 'NFC', 'USSD', 'QR'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tapmomo_tx_merchant_id ON public.tapmomo_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tapmomo_tx_nonce ON public.tapmomo_transactions(nonce);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tapmomo_tx_created_at ON public.tapmomo_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_tapmomo_tx_status ON public.tapmomo_transactions(status);

-- RLS Policies for tapmomo_merchants
ALTER TABLE public.tapmomo_merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own merchants"
    ON public.tapmomo_merchants FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own merchants"
    ON public.tapmomo_merchants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own merchants"
    ON public.tapmomo_merchants FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own merchants"
    ON public.tapmomo_merchants FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for tapmomo_transactions
ALTER TABLE public.tapmomo_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions for their merchants"
    ON public.tapmomo_transactions FOR SELECT
    USING (
        merchant_id IN (
            SELECT id FROM public.tapmomo_merchants WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create transactions for their merchants"
    ON public.tapmomo_transactions FOR INSERT
    WITH CHECK (
        merchant_id IN (
            SELECT id FROM public.tapmomo_merchants WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their merchant transactions"
    ON public.tapmomo_transactions FOR UPDATE
    USING (
        merchant_id IN (
            SELECT id FROM public.tapmomo_merchants WHERE user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tapmomo_merchants_updated_at
    BEFORE UPDATE ON public.tapmomo_merchants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tapmomo_transactions_updated_at
    BEFORE UPDATE ON public.tapmomo_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample merchant data (for development)
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT 1 FROM public.tapmomo_merchants LIMIT 1) THEN
--         INSERT INTO public.tapmomo_merchants (user_id, display_name, network, merchant_code, secret_key)
--         VALUES (
--             (SELECT id FROM auth.users LIMIT 1),
--             'Demo Merchant',
--             'MTN',
--             '123456',
--             encode(gen_random_bytes(32), 'base64')
--         );
--     END IF;
-- END $$;

COMMENT ON TABLE public.tapmomo_merchants IS 'TapMoMo merchants registered for NFC/USSD payments';
COMMENT ON TABLE public.tapmomo_transactions IS 'TapMoMo payment transactions';


-- From: 20251103175923_fix_user_profiles_extension.sql

-- Fix user profiles: Create extension table instead of modifying auth.users view
-- This migration creates a separate user_profiles table for extended user data
-- that complements the auth.users table without trying to alter the view

-- 1. Create enum for account status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_account_status') THEN
    CREATE TYPE public.user_account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
  END IF;
END $$;

-- 2. Create user_profiles extension table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_status public.user_account_status NOT NULL DEFAULT 'ACTIVE',
  pw_reset_required BOOLEAN NOT NULL DEFAULT false,
  full_name TEXT,
  phone TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_account_status ON public.user_profiles(account_status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_pw_reset ON public.user_profiles(pw_reset_required) WHERE pw_reset_required = true;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_last_login ON public.user_profiles(last_login_at);

-- 4. Add helpful comments
COMMENT ON TABLE public.user_profiles IS 'Extended user profile data complementing auth.users';
COMMENT ON COLUMN public.user_profiles.pw_reset_required IS 'Forces password reset on next login for newly invited staff';
COMMENT ON COLUMN public.user_profiles.account_status IS 'Account status: ACTIVE, SUSPENDED, or INACTIVE';
COMMENT ON COLUMN public.user_profiles.full_name IS 'Staff member full name';
COMMENT ON COLUMN public.user_profiles.phone IS 'Staff member phone number';
COMMENT ON COLUMN public.user_profiles.last_login_at IS 'Timestamp of last successful login';

-- 5. Create trigger to auto-create profile on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_profile_updated ON public.user_profiles;
CREATE TRIGGER on_user_profile_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Create comprehensive view joining auth.users + user_profiles
CREATE OR REPLACE VIEW public.users_complete AS
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data,
  u.created_at as auth_created_at,
  u.updated_at as auth_updated_at,
  u.email_confirmed_at,
  u.last_sign_in_at,
  COALESCE(p.account_status, 'ACTIVE'::user_account_status) as account_status,
  COALESCE(p.pw_reset_required, false) as pw_reset_required,
  p.full_name,
  p.phone,
  p.last_login_at,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.user_id;

COMMENT ON VIEW public.users_complete IS 'Complete user view combining auth.users and user_profiles';

-- 8. Create helper function to check if user account is active
CREATE OR REPLACE FUNCTION public.is_user_account_active(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  status public.user_account_status;
BEGIN
  SELECT account_status INTO status
  FROM public.user_profiles
  WHERE user_id = user_uuid;
  
  -- If no profile exists yet, consider active
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;
  
  RETURN status = 'ACTIVE';
END;
$$;

COMMENT ON FUNCTION public.is_user_account_active IS 'Check if user account is in ACTIVE status';

-- 9. Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile (except account_status and pw_reset_required)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin users can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('Admin', 'Super Admin')
    )
  );

-- Admin users can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('Admin', 'Super Admin')
    )
  );

-- Admin users can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('Admin', 'Super Admin')
    )
  );

-- 11. Backfill existing users (create profiles for users without them)
INSERT INTO public.user_profiles (user_id)
SELECT id
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles WHERE user_id = auth.users.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 12. Grant necessary permissions
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.users_complete TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_account_active TO authenticated;


-- From: 20251103205632_group_contribution_functions.sql

-- Function to increment member balance
CREATE OR REPLACE FUNCTION increment_member_balance(
  p_group_id UUID,
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE group_members
  SET balance = COALESCE(balance, 0) + p_amount,
      updated_at = NOW()
  WHERE group_id = p_group_id
    AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment group total balance
CREATE OR REPLACE FUNCTION increment_group_balance(
  p_group_id UUID,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE groups
  SET total_balance = COALESCE(total_balance, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create loan_applications table if not exists
CREATE TABLE IF NOT EXISTS loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  purpose TEXT NOT NULL,
  term_months INTEGER NOT NULL CHECK (term_months > 0),
  collateral TEXT,
  monthly_income NUMERIC,
  employment_status TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed', 'repaid')),
  monthly_payment NUMERIC,
  total_interest NUMERIC,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies for loan_applications
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own loan applications"
  ON loan_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create loan applications"
  ON loan_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create push tokens table
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- RLS for push tokens
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_loan_applications_user_id ON loan_applications(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_loan_applications_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);


-- From: 20251103214736_push_tokens.sql

-- Push tokens for Expo Push Notifications (Supabase-only, no Firebase)
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

-- RLS Policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can insert/update their own tokens
CREATE POLICY "Users can manage their own push tokens"
ON push_tokens
FOR ALL
USING (auth.uid() = user_id);

-- Service role can read all tokens (for sending notifications)
CREATE POLICY "Service role can read all tokens"
ON push_tokens
FOR SELECT
USING (auth.role() = 'service_role');

-- Cleanup old tokens (7 days inactive)
CREATE OR REPLACE FUNCTION cleanup_old_push_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM push_tokens
  WHERE updated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE push_tokens IS 'Expo push notification tokens for client mobile app (Supabase-only, no Firebase)';


-- From: 20251104100000_momo_polling_and_gsm_heartbeat.sql

-- Automation scaffolding for MoMo statement polling and GSM heartbeats
set search_path = app, public;

create table if not exists app.momo_statement_pollers (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references app.saccos(id) on delete set null,
  provider text not null default 'MTN',
  display_name text not null default 'Default MoMo Poller',
  endpoint_url text not null,
  auth_header text,
  cursor text,
  polling_interval_seconds integer not null default 900,
  status text not null default 'ACTIVE',
  last_polled_at timestamptz,
  last_latency_ms integer,
  last_polled_count integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.momo_statement_pollers is 'Configuration for automated MoMo statement polling workers.';
comment on column app.momo_statement_pollers.cursor is 'Provider issued cursor for incremental polling.';
comment on column app.momo_statement_pollers.last_latency_ms is 'Average latency, in milliseconds, for the last polling batch.';
comment on column app.momo_statement_pollers.last_polled_count is 'Number of statements discovered in the last poll.';

create index if not exists idx_momo_statement_pollers_status on app.momo_statement_pollers(status);
create index if not exists idx_momo_statement_pollers_sacco on app.momo_statement_pollers(sacco_id);

create table if not exists app.momo_statement_staging (
  id uuid primary key default gen_random_uuid(),
  poller_id uuid not null references app.momo_statement_pollers(id) on delete cascade,
  external_id text not null,
  sacco_id uuid references app.saccos(id) on delete set null,
  payload jsonb not null,
  statement_date date,
  status text not null default 'PENDING',
  latency_ms integer,
  error text,
  queued_job_id uuid,
  polled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table app.momo_statement_staging is 'Raw statements fetched from MoMo integrations awaiting reconciliation jobs.';
comment on column app.momo_statement_staging.latency_ms is 'End-to-end latency between statement timestamp and polling time.';

create unique index if not exists uq_momo_statement_staging_external on app.momo_statement_staging(poller_id, external_id);
create index if not exists idx_momo_statement_staging_status on app.momo_statement_staging(status);

create table if not exists app.reconciliation_jobs (
  id uuid primary key default gen_random_uuid(),
  staging_id uuid references app.momo_statement_staging(id) on delete set null,
  sacco_id uuid references app.saccos(id) on delete set null,
  job_type text not null default 'STATEMENT_SYNC',
  status text not null default 'PENDING',
  attempts integer not null default 0,
  last_error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  latency_ms integer,
  meta jsonb default '{}'::jsonb
);

comment on table app.reconciliation_jobs is 'Queue of reconciliation automation tasks created from MoMo polling.';

create index if not exists idx_reconciliation_jobs_status on app.reconciliation_jobs(status);
create index if not exists idx_reconciliation_jobs_type on app.reconciliation_jobs(job_type);

alter table if exists app.momo_statement_staging
  add constraint fk_momo_statement_staging_job
  foreign key (queued_job_id)
  references app.reconciliation_jobs(id)
  on delete set null;

create table if not exists app.sms_gateway_endpoints (
  id uuid primary key default gen_random_uuid(),
  gateway text not null default 'primary',
  display_name text not null default 'Primary GSM Modem',
  health_url text not null,
  auth_header text,
  expected_keyword text,
  status text not null default 'ACTIVE',
  last_status text,
  last_heartbeat_at timestamptz,
  last_latency_ms integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app.sms_gateway_endpoints is 'Configured GSM/SMS gateway heartbeat targets.';

create index if not exists idx_sms_gateway_endpoints_status on app.sms_gateway_endpoints(status);
create unique index if not exists uq_sms_gateway_endpoint_gateway on app.sms_gateway_endpoints(gateway);

create table if not exists app.sms_gateway_heartbeats (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references app.sms_gateway_endpoints(id) on delete cascade,
  status text not null,
  latency_ms integer,
  checked_at timestamptz not null default now(),
  error text,
  meta jsonb default '{}'::jsonb
);

comment on table app.sms_gateway_heartbeats is 'Historical log of GSM heartbeat probes.';

create index if not exists idx_sms_gateway_heartbeats_endpoint on app.sms_gateway_heartbeats(endpoint_id);
create index if not exists idx_sms_gateway_heartbeats_checked on app.sms_gateway_heartbeats(checked_at desc);

alter table app.momo_statement_pollers enable row level security;
alter table app.momo_statement_staging enable row level security;
alter table app.reconciliation_jobs enable row level security;
alter table app.sms_gateway_endpoints enable row level security;
alter table app.sms_gateway_heartbeats enable row level security;

alter table app.momo_statement_pollers force row level security;
alter table app.momo_statement_staging force row level security;
alter table app.reconciliation_jobs force row level security;
alter table app.sms_gateway_endpoints force row level security;
alter table app.sms_gateway_heartbeats force row level security;

-- Service role bypasses RLS, no additional policies required for automation prototypes.


-- From: 20251105100000_trigram_search.sql

-- Migration: Trigram Search RPC for SACCOs
-- Description: Creates optimized RPC function for fast SACCO search using trigram similarity
-- Dependencies: pg_trgm extension (enabled in 20251010223000_enable_trigram_extension.sql)

-- Create trigram indexes on saccos table for fast similarity search
-- These indexes enable efficient trigram-based search on name and sector_code columns
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_saccos_name_trgm ON public.saccos USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_saccos_sector_code_trgm ON public.saccos USING gin (sector_code gin_trgm_ops);

-- Create or replace the search_saccos_trgm function
-- This function leverages trigram indexing for fast fuzzy search on SACCO names and sector codes
-- Returns top 20 matches ordered by similarity score
CREATE OR REPLACE FUNCTION public.search_saccos_trgm(q text)
RETURNS TABLE(
  id uuid,
  name text,
  district text,
  sector_code text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Search SACCOs using trigram similarity on name and sector_code
  -- Returns top 20 results ordered by similarity score
  -- Filters out results with very low similarity (<= 0.05) for performance
  WITH input AS (
    SELECT
      trim(q) AS query_text,
      set_limit(0.05) AS similarity_threshold
  )
  SELECT
    s.id,
    s.name,
    s.district,
    s.sector_code,
    greatest(
      similarity(s.name, input.query_text),
      similarity(s.sector_code, input.query_text)
    ) AS similarity
  FROM input
  JOIN public.saccos s ON true
  WHERE input.query_text <> ''
    AND (
      s.name % input.query_text
      OR s.sector_code % input.query_text
    )
  ORDER BY similarity DESC, s.name ASC
  LIMIT 20
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.search_saccos_trgm(text) IS 
'Fast trigram-based search for SACCOs by name or sector code. Returns top 20 matches ordered by similarity score.';


-- From: 20251105100100_aggregates_rpc.sql

-- Migration: Aggregates RPC for Group Deposits
-- Description: Creates optimized RPC function for aggregating deposits by group (ikimina)
-- Dependencies: payments and ibimina tables (created in bootstrap migrations)

-- Create index on payments.ikimina_id for efficient group deposit aggregation
-- This index significantly improves performance when summing deposits by group
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payments_ikimina_id ON public.payments(ikimina_id);

-- Create composite index on ikimina_id and status for even faster aggregation
-- This covers the WHERE clause in sum_group_deposits function
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payments_ikimina_status ON public.payments(ikimina_id, status);

-- Create or replace the sum_group_deposits function
-- This function efficiently aggregates all completed payments (deposits) for a specific group
-- Returns a JSON object with total amount and currency
CREATE OR REPLACE FUNCTION public.sum_group_deposits(gid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Aggregate all completed deposits for the specified group (ikimina)
  -- Returns JSON with total amount and currency (defaults to RWF if no deposits)
  SELECT jsonb_build_object(
    'amount', coalesce(sum(p.amount), 0),
    'currency', coalesce(nullif(max(p.currency), ''), 'RWF'),
    'count', count(p.id)
  )
  FROM public.payments p
  WHERE p.ikimina_id = gid 
    AND p.status = 'completed';
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.sum_group_deposits(uuid) IS 
'Aggregates all completed deposits for a specific group (ikimina). Returns JSON with total amount, currency, and count of deposits.';


-- From: 20251110100000_multitenancy.sql

-- Multi-tenancy: Organizations & Memberships with Row-Level Security (RLS)
-- Creates organization hierarchy (District -> SACCO/MFI) with proper tenant isolation

-- 1. Create organization type enum ---------------------------------------------
CREATE TYPE public.organization_type AS ENUM ('SACCO', 'MFI', 'DISTRICT');

-- 2. Create organizations table ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.organization_type NOT NULL,
  name TEXT NOT NULL,
  district_code TEXT,
  parent_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  
  -- Constraints: district_code required for DISTRICT type
  CONSTRAINT organizations_district_code_check 
    CHECK (
      (type = 'DISTRICT' AND district_code IS NOT NULL) OR
      (type IN ('SACCO', 'MFI'))
    ),
  
  -- Constraints: parent_id should reference DISTRICT for SACCO/MFI
  CONSTRAINT organizations_parent_hierarchy_check
    CHECK (
      (type = 'DISTRICT' AND parent_id IS NULL) OR
      (type IN ('SACCO', 'MFI') AND parent_id IS NOT NULL)
    )
);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS organizations_touch_updated_at ON public.organizations;
CREATE TRIGGER organizations_touch_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organizations_parent ON public.organizations(parent_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organizations_type ON public.organizations(type);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organizations_district_code ON public.organizations(district_code);

-- 3. Extend role enum to support new organizational roles ---------------------
-- First check if the enum exists and needs updating
DO $$
BEGIN
  -- Add new role values if they don't exist
  BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'DISTRICT_MANAGER';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'MFI_MANAGER';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'MFI_STAFF';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 4. Create org_memberships table ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_memberships (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  
  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);

-- 5. Add org_id columns to tenant tables --------------------------------------

-- Add org_id to app.saccos (link SACCO to its organization)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'saccos' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app.saccos ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_saccos_org ON app.saccos(org_id);
  END IF;
END $$;

-- Add org_id to app.ikimina
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'ikimina' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app.ikimina ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ikimina_org ON app.ikimina(org_id);
  END IF;
END $$;

-- Add org_id to app.members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'members' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app.members ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_members_org ON app.members(org_id);
  END IF;
END $$;

-- Add org_id to app.payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'payments' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app.payments ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payments_org ON app.payments(org_id);
  END IF;
END $$;

-- Add org_id to public.join_requests (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'join_requests'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'join_requests' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.join_requests ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_join_requests_org ON public.join_requests(org_id);
  END IF;
END $$;

-- Add org_id to public.notifications (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notifications_org ON public.notifications(org_id);
  END IF;
END $$;

-- 6. Create helper functions for multi-tenant RLS -----------------------------

-- Check if user is a platform admin (SYSTEM_ADMIN)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SYSTEM_ADMIN',
    FALSE
  ) OR COALESCE(
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid() AND role = 'SYSTEM_ADMIN'
    ),
    FALSE
  ) OR COALESCE(
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_id = auth.uid() AND role = 'SYSTEM_ADMIN'
    ),
    FALSE
  )
$$;

-- Get user's organization memberships
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
$$;

-- Get all organizations accessible by user (including children via hierarchy)
CREATE OR REPLACE FUNCTION public.user_accessible_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE org_hierarchy AS (
    -- Base case: user's direct organization memberships
    SELECT o.id, o.parent_id, om.role
    FROM public.organizations o
    JOIN public.org_memberships om ON om.org_id = o.id
    WHERE om.user_id = auth.uid()
    
    UNION
    
    -- Recursive case: child organizations (for district managers)
    SELECT o.id, o.parent_id, oh.role
    FROM public.organizations o
    JOIN org_hierarchy oh ON o.parent_id = oh.id
    WHERE oh.role = 'DISTRICT_MANAGER'
  )
  SELECT DISTINCT id FROM org_hierarchy
$$;

-- Check if user has access to a specific org_id
CREATE OR REPLACE FUNCTION public.user_can_access_org(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin() 
    OR target_org_id IN (SELECT public.user_accessible_org_ids())
$$;

-- 7. Update RLS policies for tenant tables ------------------------------------

-- Drop existing policies that will be replaced
DROP POLICY IF EXISTS sacco_select_staff ON app.saccos;
DROP POLICY IF EXISTS sacco_select_admin ON app.saccos;
DROP POLICY IF EXISTS sacco_manage_admin ON app.saccos;

DROP POLICY IF EXISTS ikimina_select ON app.ikimina;
DROP POLICY IF EXISTS ikimina_modify ON app.ikimina;

DROP POLICY IF EXISTS members_select ON app.members;
DROP POLICY IF EXISTS members_modify ON app.members;

DROP POLICY IF EXISTS payments_select ON app.payments;
DROP POLICY IF EXISTS payments_insert ON app.payments;
DROP POLICY IF EXISTS payments_update ON app.payments;

-- New RLS policies for app.saccos
CREATE POLICY sacco_select_multitenancy
  ON app.saccos
  FOR SELECT
  USING (
    public.is_platform_admin() 
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND id = app.current_sacco())
  );

CREATE POLICY sacco_modify_multitenancy
  ON app.saccos
  FOR ALL
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND app.is_admin())
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND app.is_admin())
  );

-- New RLS policies for app.ikimina
CREATE POLICY ikimina_select_multitenancy
  ON app.ikimina
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

CREATE POLICY ikimina_modify_multitenancy
  ON app.ikimina
  FOR ALL
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

-- New RLS policies for app.members
CREATE POLICY members_select_multitenancy
  ON app.members
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

CREATE POLICY members_modify_multitenancy
  ON app.members
  FOR ALL
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

-- New RLS policies for app.payments
CREATE POLICY payments_select_multitenancy
  ON app.payments
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

CREATE POLICY payments_insert_multitenancy
  ON app.payments
  FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

CREATE POLICY payments_update_multitenancy
  ON app.payments
  FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (org_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

-- RLS policies for public.join_requests (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'join_requests'
  ) THEN
    -- Drop old policies that might conflict
    DROP POLICY IF EXISTS "Staff can manage join requests" ON public.join_requests;
    DROP POLICY IF EXISTS join_requests_staff_manage ON public.join_requests;
    
    -- Create new policy
    EXECUTE 'CREATE POLICY join_requests_multitenancy
      ON public.join_requests
      FOR ALL
      USING (
        auth.uid() = user_id
        OR public.is_platform_admin()
        OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
        OR (org_id IS NULL AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.sacco_id = join_requests.sacco_id
        ))
      )';
  END IF;
END $$;

-- RLS policies for public.notifications (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    -- Drop old policies that might conflict
    DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
    DROP POLICY IF EXISTS notifications_service_insert ON public.notifications;
    
    -- Create new policy for org-based access
    EXECUTE 'CREATE POLICY notifications_multitenancy
      ON public.notifications
      FOR SELECT
      USING (
        auth.uid() = user_id
        OR public.is_platform_admin()
        OR (org_id IS NOT NULL AND public.user_can_access_org(org_id))
      )';
  END IF;
END $$;

-- 8. Enable RLS on new tables -------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships FORCE ROW LEVEL SECURITY;

-- RLS policies for organizations
CREATE POLICY organizations_select
  ON public.organizations
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR id IN (SELECT public.user_accessible_org_ids())
  );

CREATE POLICY organizations_modify
  ON public.organizations
  FOR ALL
  USING (public.is_platform_admin());

-- RLS policies for org_memberships
CREATE POLICY org_memberships_select_own
  ON public.org_memberships
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_platform_admin()
  );

CREATE POLICY org_memberships_manage_admin
  ON public.org_memberships
  FOR ALL
  USING (public.is_platform_admin());

-- 9. Add helpful comments ------------------------------------------------------
COMMENT ON TABLE public.organizations IS 'Multi-tenant organization hierarchy (District -> SACCO/MFI)';
COMMENT ON TABLE public.org_memberships IS 'User membership in organizations with roles';
COMMENT ON COLUMN public.organizations.parent_id IS 'References parent organization (DISTRICT for SACCOs/MFIs)';
COMMENT ON COLUMN public.organizations.district_code IS 'District code, required for DISTRICT type organizations';
COMMENT ON FUNCTION public.is_platform_admin() IS 'Returns true if current user is SYSTEM_ADMIN';
COMMENT ON FUNCTION public.user_org_ids() IS 'Returns all organization IDs the current user is a member of';
COMMENT ON FUNCTION public.user_accessible_org_ids() IS 'Returns all organization IDs accessible by user including hierarchy';
COMMENT ON FUNCTION public.user_can_access_org(UUID) IS 'Checks if user can access a specific organization';


-- From: 20251115100000_optimize_indexes_and_queries.sql

-- Migration: Optimize Indexes and Queries for Performance
-- Description: Adds missing indexes on ledger_entries and other frequently queried tables
-- to improve performance of account balance calculations and other queries.
-- Part of backend refactoring initiative.

-- Add indexes on ledger_entries for debit_id and credit_id
-- These indexes significantly improve the account_balance function performance
-- by enabling efficient lookups on both debit and credit sides
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ledger_entries_debit_id 
  ON app.ledger_entries(debit_id);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ledger_entries_credit_id 
  ON app.ledger_entries(credit_id);

-- Add composite index for common query patterns
-- This covers queries that filter by account and need to aggregate amounts
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ledger_entries_debit_amount 
  ON app.ledger_entries(debit_id, amount);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ledger_entries_credit_amount 
  ON app.ledger_entries(credit_id, amount);

-- Add index on user_profiles.user_id if not exists
-- This optimizes lookups in current_sacco, current_role, and other user profile queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_user_id 
  ON app.user_profiles(user_id);

-- Add composite index for sacco-scoped queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ledger_entries_sacco_created 
  ON app.ledger_entries(sacco_id, created_at DESC) 
  WHERE sacco_id IS NOT NULL;

-- Add index on accounts.sacco_id for efficient sacco-scoped account queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_accounts_sacco_id 
  ON app.accounts(sacco_id) 
  WHERE sacco_id IS NOT NULL;

-- Add index on members.sacco_id for efficient member lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_members_sacco_id 
  ON app.members(sacco_id) 
  WHERE sacco_id IS NOT NULL;

-- Add index on payments.sacco_id for efficient payment lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payments_sacco_id 
  ON app.payments(sacco_id) 
  WHERE sacco_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON INDEX app.idx_ledger_entries_debit_id IS 
  'Optimizes account_balance queries by enabling efficient lookups of debit transactions';

COMMENT ON INDEX app.idx_ledger_entries_credit_id IS 
  'Optimizes account_balance queries by enabling efficient lookups of credit transactions';

COMMENT ON INDEX app.idx_user_profiles_user_id IS 
  'Optimizes user profile lookups in current_sacco, current_role, and related functions';

-- Analyze tables to update statistics after index creation
ANALYZE app.ledger_entries;
ANALYZE app.user_profiles;
ANALYZE app.accounts;
ANALYZE app.members;
ANALYZE app.payments;


-- From: 20251115100100_optimize_account_balance_function.sql

-- Migration: Optimize account_balance Function
-- Description: Refactors the account_balance function to use more efficient query patterns
-- with explicit index hints and better aggregation logic.
-- Part of backend refactoring initiative.

-- Drop the old function first
DROP FUNCTION IF EXISTS app.account_balance(uuid);

-- Create optimized version of account_balance function
-- This version uses a more efficient query pattern that better utilizes indexes
CREATE OR REPLACE FUNCTION app.account_balance(account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'app', 'public'
AS $function$
  -- Optimized query using UNION ALL and filtering to leverage indexes
  -- This approach allows PostgreSQL to use the debit_id and credit_id indexes separately
  SELECT COALESCE(SUM(amount_signed), 0)
  FROM (
    -- Credits (positive balance)
    SELECT amount AS amount_signed
    FROM app.ledger_entries
    WHERE credit_id = account_id
    
    UNION ALL
    
    -- Debits (negative balance)
    SELECT -amount AS amount_signed
    FROM app.ledger_entries
    WHERE debit_id = account_id
  ) AS movements;
$function$;

-- Add comment for documentation
COMMENT ON FUNCTION app.account_balance(uuid) IS 
  'Optimized function to calculate account balance by summing credits and debits. Uses UNION ALL pattern to leverage separate indexes on credit_id and debit_id.';

-- Also update the public schema version if it exists
DROP FUNCTION IF EXISTS public.account_balance(uuid);

CREATE OR REPLACE FUNCTION public.account_balance(account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
  SELECT app.account_balance(account_id);
$function$;

COMMENT ON FUNCTION public.account_balance(uuid) IS 
  'Wrapper function that delegates to app.account_balance for backward compatibility.';


-- From: 20251115100200_simplify_triggers.sql

-- Migration: Simplify and Optimize Triggers
-- Description: Refactors triggers to simplify logic and improve maintainability
-- Part of backend refactoring initiative.

-- Optimize handle_public_user_insert trigger function
-- Simplify the logic and add better error handling
CREATE OR REPLACE FUNCTION public.handle_public_user_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  desired_role app_role;
BEGIN
  -- Use COALESCE with explicit default
  desired_role := COALESCE(NEW.role, 'SACCO_STAFF'::app_role);
  
  -- Insert or update user profile
  INSERT INTO app.user_profiles(user_id, role, sacco_id)
  VALUES (NEW.id, desired_role, NEW.sacco_id)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    role = EXCLUDED.role,
    sacco_id = COALESCE(EXCLUDED.sacco_id, app.user_profiles.sacco_id),
    updated_at = timezone('UTC', now());
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise it
    RAISE WARNING 'Error in handle_public_user_insert for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.handle_public_user_insert() IS 
  'Simplified trigger function to handle user inserts into public.users view. Includes error handling and logging.';

-- Optimize set_updated_at trigger function
-- Add IMMUTABLE timestamp function for better performance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('UTC', now());
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS 
  'Simple trigger function to set updated_at timestamp on record updates.';

-- Optimize app.handle_new_auth_user trigger function
-- Add error handling and better conflict resolution
CREATE OR REPLACE FUNCTION app.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app', 'public'
AS $$
BEGIN
  -- Insert new user profile with default role
  INSERT INTO app.user_profiles(user_id, role, sacco_id)
  VALUES (NEW.id, 'SACCO_STAFF', NULL)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth operation
    RAISE WARNING 'Error in handle_new_auth_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app.handle_new_auth_user() IS 
  'Simplified trigger function to create user profile on auth.users insert. Includes error handling to prevent auth failures.';


-- From: 20251126125320_android_sms_gateway.sql

-- Android SMS Bridge Gateway Integration
-- This migration creates tables for managing Android SMS bridge devices,
-- tracking gateway health via heartbeats, and storing raw SMS logs with parsing metadata.

-- Table: gateway_devices (tracks Android bridge phones)
CREATE TABLE IF NOT EXISTS app.gateway_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  device_name TEXT,
  sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE,
  sim_carrier TEXT, -- e.g., "MTN", "Airtel"
  last_heartbeat_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- Index for active device queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_gateway_devices_last_heartbeat 
  ON app.gateway_devices(last_heartbeat_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_gateway_devices_sacco 
  ON app.gateway_devices(sacco_id);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS gateway_devices_touch_updated_at ON app.gateway_devices;
CREATE TRIGGER gateway_devices_touch_updated_at
  BEFORE UPDATE ON app.gateway_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Table: gateway_heartbeats (health monitoring)
CREATE TABLE IF NOT EXISTS app.gateway_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES app.gateway_devices(device_id) ON DELETE CASCADE,
  battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100), -- 0-100
  network_type TEXT, -- "WIFI", "4G", "3G"
  signal_strength INTEGER,
  pending_sms_count INTEGER DEFAULT 0,
  ip_address INET,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- Index for performance on device heartbeat queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_gateway_heartbeats_device_created 
  ON app.gateway_heartbeats(device_id, created_at DESC);

-- Table: raw_sms_logs (audit trail of all received SMS)
CREATE TABLE IF NOT EXISTS app.raw_sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  parse_source TEXT, -- "REGEX", "GEMINI", "OPENAI", "MANUAL"
  parse_confidence NUMERIC(3,2) CHECK (parse_confidence >= 0 AND parse_confidence <= 1),
  parsed_json JSONB,
  payment_id UUID REFERENCES app.payments(id),
  status TEXT DEFAULT 'PENDING', -- PENDING, PARSED, FAILED, DUPLICATE
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_raw_sms_logs_status 
  ON app.raw_sms_logs(status) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_raw_sms_logs_device 
  ON app.raw_sms_logs(device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_raw_sms_logs_payment 
  ON app.raw_sms_logs(payment_id);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_raw_sms_logs_received_at 
  ON app.raw_sms_logs(received_at DESC);

-- RLS Policies
ALTER TABLE app.gateway_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.gateway_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.raw_sms_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Staff can view gateway devices" ON app.gateway_devices;
DROP POLICY IF EXISTS "Staff can view heartbeats" ON app.gateway_heartbeats;
DROP POLICY IF EXISTS "Staff can view SMS logs" ON app.raw_sms_logs;

-- Staff can view all gateway data for their SACCO
CREATE POLICY "Staff can view gateway devices" ON app.gateway_devices
  FOR SELECT USING (
    sacco_id IN (
      SELECT sacco_id FROM app.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view heartbeats" ON app.gateway_heartbeats
  FOR SELECT USING (
    device_id IN (
      SELECT device_id FROM app.gateway_devices 
      WHERE sacco_id IN (
        SELECT sacco_id FROM app.user_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can view SMS logs" ON app.raw_sms_logs
  FOR SELECT USING (
    device_id IN (
      SELECT device_id FROM app.gateway_devices 
      WHERE sacco_id IN (
        SELECT sacco_id FROM app.user_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Database triggers for real-time notifications
-- Notify when new SMS log is inserted
CREATE OR REPLACE FUNCTION app.notify_new_sms_log()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('new_sms_log', json_build_object(
    'id', NEW.id,
    'device_id', NEW.device_id,
    'status', NEW.status,
    'received_at', NEW.received_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_sms_log ON app.raw_sms_logs;
CREATE TRIGGER trigger_notify_new_sms_log
  AFTER INSERT ON app.raw_sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION app.notify_new_sms_log();

-- Notify when SMS-sourced payment is created
CREATE OR REPLACE FUNCTION app.notify_sms_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.channel = 'SMS' THEN
    PERFORM pg_notify('new_sms_payment', json_build_object(
      'id', NEW.id,
      'sacco_id', NEW.sacco_id,
      'amount', NEW.amount,
      'status', NEW.status,
      'occurred_at', NEW.occurred_at
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_sms_payment ON app.payments;
CREATE TRIGGER trigger_notify_sms_payment
  AFTER INSERT ON app.payments
  FOR EACH ROW
  EXECUTE FUNCTION app.notify_sms_payment();

-- Comment documentation
COMMENT ON TABLE app.gateway_devices IS 'Tracks Android bridge devices that forward SMS to the platform';
COMMENT ON TABLE app.gateway_heartbeats IS 'Health monitoring data from Android bridge devices';
COMMENT ON TABLE app.raw_sms_logs IS 'Audit trail of all SMS received from Android bridge devices';
COMMENT ON COLUMN app.gateway_devices.device_id IS 'Unique identifier from Android device';
COMMENT ON COLUMN app.gateway_devices.sim_carrier IS 'Mobile carrier of the SIM card (MTN, Airtel, etc.)';
COMMENT ON COLUMN app.raw_sms_logs.parse_source IS 'AI/parsing method used: REGEX, GEMINI, OPENAI, or MANUAL';
COMMENT ON COLUMN app.raw_sms_logs.status IS 'Processing status: PENDING, PARSED, FAILED, or DUPLICATE';


-- From: 20251126152600_momo_sms_inbox.sql

-- MoMo SMS Webhook Infrastructure
-- Creates tables, indexes, RLS policies, and auto-matching logic for
-- receiving and processing Mobile Money SMS relayed from MomoTerminal Android app.

-- Table: momo_webhook_config
-- Stores configuration for each registered MomoTerminal device
CREATE TABLE IF NOT EXISTS app.momo_webhook_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  momo_phone_number TEXT NOT NULL UNIQUE,
  webhook_secret TEXT NOT NULL,
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('UTC', now())
);

COMMENT ON TABLE app.momo_webhook_config IS 'Configuration for MomoTerminal devices that relay SMS';
COMMENT ON COLUMN app.momo_webhook_config.momo_phone_number IS 'Mobile Money phone number receiving SMS';
COMMENT ON COLUMN app.momo_webhook_config.webhook_secret IS 'HMAC secret for signature verification';
COMMENT ON COLUMN app.momo_webhook_config.device_id IS 'Unique device identifier';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS momo_webhook_config_touch_updated_at ON app.momo_webhook_config;
CREATE TRIGGER momo_webhook_config_touch_updated_at
BEFORE UPDATE ON app.momo_webhook_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Table: momo_sms_inbox
-- Stores all incoming MoMo SMS with parsed data
CREATE TABLE IF NOT EXISTS app.momo_sms_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  sender TEXT,
  raw_message TEXT NOT NULL,
  parsed_amount DECIMAL(15,2),
  parsed_sender_name TEXT,
  parsed_transaction_id TEXT,
  parsed_provider TEXT,              -- 'mtn', 'vodafone', 'airteltigo'
  received_at TIMESTAMPTZ DEFAULT timezone('UTC', now()),
  processed BOOLEAN DEFAULT FALSE,
  matched_payment_id UUID REFERENCES app.payments(id),
  match_confidence DECIMAL(3,2),     -- 0.00 to 1.00
  signature TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('UTC', now())
);

COMMENT ON TABLE app.momo_sms_inbox IS 'Inbox for Mobile Money SMS relayed from Android devices';
COMMENT ON COLUMN app.momo_sms_inbox.phone_number IS 'Phone number that received the SMS';
COMMENT ON COLUMN app.momo_sms_inbox.sender IS 'SMS sender (e.g., MTN MoMo)';
COMMENT ON COLUMN app.momo_sms_inbox.raw_message IS 'Original SMS content';
COMMENT ON COLUMN app.momo_sms_inbox.parsed_amount IS 'Extracted payment amount';
COMMENT ON COLUMN app.momo_sms_inbox.parsed_sender_name IS 'Extracted sender name from SMS';
COMMENT ON COLUMN app.momo_sms_inbox.parsed_transaction_id IS 'Extracted transaction ID';
COMMENT ON COLUMN app.momo_sms_inbox.parsed_provider IS 'Detected mobile money provider';
COMMENT ON COLUMN app.momo_sms_inbox.processed IS 'Whether SMS has been processed';
COMMENT ON COLUMN app.momo_sms_inbox.matched_payment_id IS 'Reference to matched payment record';
COMMENT ON COLUMN app.momo_sms_inbox.match_confidence IS 'Confidence score for auto-matching (0-1)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_momo_sms_inbox_phone ON app.momo_sms_inbox(phone_number);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_momo_sms_inbox_processed ON app.momo_sms_inbox(processed);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_momo_sms_inbox_received ON app.momo_sms_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_momo_sms_inbox_transaction ON app.momo_sms_inbox(parsed_transaction_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_momo_sms_inbox_payment ON app.momo_sms_inbox(matched_payment_id);

-- RLS policies
ALTER TABLE app.momo_sms_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.momo_webhook_config ENABLE ROW LEVEL SECURITY;

-- Staff can view all SMS
CREATE POLICY "Staff can view momo_sms_inbox" ON app.momo_sms_inbox
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('ADMIN', 'SACCO_STAFF', 'DISTRICT_MANAGER')
    )
  );

-- Only service role can insert (from webhook)
CREATE POLICY "Service role can insert momo_sms_inbox" ON app.momo_sms_inbox
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Service role can update for matching
CREATE POLICY "Service role can update momo_sms_inbox" ON app.momo_sms_inbox
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- Staff can view webhook config
CREATE POLICY "Staff can view momo_webhook_config" ON app.momo_webhook_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('ADMIN', 'SACCO_STAFF', 'DISTRICT_MANAGER')
    )
  );

-- Admin can manage webhook config
CREATE POLICY "Admin can manage momo_webhook_config" ON app.momo_webhook_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'ADMIN'
    )
  );

-- Function to auto-match payments
-- Attempts to match incoming SMS to pending payments based on amount and timing
CREATE OR REPLACE FUNCTION app.match_momo_to_payment()
RETURNS TRIGGER AS $$
DECLARE
  matched_id UUID;
  confidence_score DECIMAL(3,2);
BEGIN
  -- Only attempt matching if we successfully parsed an amount
  IF NEW.parsed_amount IS NULL THEN
    RETURN NEW;
  END IF;

  -- Try to find a pending payment matching amount and approximate time
  -- Look for payments within the last 24 hours
  SELECT p.id INTO matched_id
  FROM app.payments p
  WHERE p.amount = (NEW.parsed_amount * 100)::bigint  -- Convert to cents/minor units
    AND p.status = 'PENDING'
    AND p.occurred_at > timezone('UTC', now()) - INTERVAL '24 hours'
    AND p.occurred_at <= NEW.received_at
  ORDER BY p.occurred_at DESC
  LIMIT 1;
  
  IF matched_id IS NOT NULL THEN
    -- Calculate confidence based on time proximity
    -- Higher confidence if payment was very recent
    confidence_score := 0.80;  -- Base confidence for amount match
    
    -- Update the SMS record with match
    NEW.matched_payment_id := matched_id;
    NEW.processed := TRUE;
    NEW.match_confidence := confidence_score;
    
    -- Update the payment status
    UPDATE app.payments
    SET status = 'VERIFIED',
        confidence = confidence_score
    WHERE id = matched_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.match_momo_to_payment() IS 'Auto-matches incoming MoMo SMS to pending payments';

-- Trigger for auto-matching
DROP TRIGGER IF EXISTS trigger_match_momo_payment ON app.momo_sms_inbox;
CREATE TRIGGER trigger_match_momo_payment
  BEFORE INSERT ON app.momo_sms_inbox
  FOR EACH ROW
  EXECUTE FUNCTION app.match_momo_to_payment();


-- From: 20251127160000_add_staff_management_fields.sql

-- Adds status, pw_reset_required, last_login_at, suspended_at, suspended_by

-- Add status column (ACTIVE, SUSPENDED, INACTIVE)
ALTER TABLE app.user_profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Add password reset required flag
ALTER TABLE app.user_profiles
  ADD COLUMN IF NOT EXISTS pw_reset_required BOOLEAN NOT NULL DEFAULT false;

-- Add last login timestamp
ALTER TABLE app.user_profiles
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add suspension tracking
ALTER TABLE app.user_profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE app.user_profiles
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add notes/comments field for admin use
ALTER TABLE app.user_profiles
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_status ON app.user_profiles(status);

-- Create index for pw_reset_required filtering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_pw_reset_required ON app.user_profiles(pw_reset_required) WHERE pw_reset_required = true;

-- Expose the new fields through the public.users security-barrier view
CREATE OR REPLACE VIEW public.users
WITH (security_barrier = true) AS
SELECT
  p.user_id AS id,
  auth_users.email,
  COALESCE(p.role, 'SACCO_STAFF')::public.app_role AS role,
  p.sacco_id,
  p.status,
  p.pw_reset_required,
  p.last_login_at,
  p.suspended_at,
  p.suspended_by,
  p.notes,
  auth_users.created_at,
  auth_users.updated_at,
  COALESCE((auth_users.raw_user_meta_data ->> 'mfa_enabled')::boolean, false) AS mfa_enabled,
  (auth_users.raw_user_meta_data ->> 'mfa_enrolled_at')::timestamptz AS mfa_enrolled_at,
  COALESCE((auth_users.raw_user_meta_data ->> 'mfa_passkey_enrolled')::boolean, false) AS mfa_passkey_enrolled,
  COALESCE((auth_users.raw_user_meta_data -> 'mfa_methods')::jsonb, '[]'::jsonb) AS mfa_methods,
  COALESCE((auth_users.raw_user_meta_data -> 'mfa_backup_hashes')::jsonb, '[]'::jsonb) AS mfa_backup_hashes,
  COALESCE((auth_users.raw_user_meta_data ->> 'failed_mfa_count')::int, 0) AS failed_mfa_count,
  (auth_users.raw_user_meta_data ->> 'last_mfa_success_at')::timestamptz AS last_mfa_success_at,
  (auth_users.raw_user_meta_data ->> 'last_mfa_step')::int AS last_mfa_step,
  (auth_users.raw_user_meta_data ->> 'mfa_secret_enc') AS mfa_secret_enc
FROM app.user_profiles p
JOIN auth.users auth_users ON auth_users.id = p.user_id;

ALTER VIEW public.users SET (security_barrier = true);


-- From: 20251127200000_notification_templates_and_prefs.sql

-- Notification templates and user preferences for event-driven notifications
-- Supports bilingual templates (en/rw) and per-user channel toggles

-- Notification templates table for event-driven notifications
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  channel public.notification_channel NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  sacco_id UUID REFERENCES public.saccos(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  tokens JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event, channel, locale, sacco_id)
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS notification_templates_event_idx ON public.notification_templates(event, is_active);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS notification_templates_sacco_id_idx ON public.notification_templates(sacco_id);

-- User notification preferences - per-user, per-channel toggles
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger for notification_templates
DROP TRIGGER IF EXISTS notification_templates_set_updated_at ON public.notification_templates;
CREATE TRIGGER notification_templates_set_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Updated_at trigger for user_notification_preferences
DROP TRIGGER IF EXISTS user_notification_preferences_set_updated_at ON public.user_notification_preferences;
CREATE TRIGGER user_notification_preferences_set_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Helper function to get user's locale preference
CREATE OR REPLACE FUNCTION public.get_user_locale(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locale TEXT;
BEGIN
  SELECT locale INTO v_locale
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_locale, 'en');
END;
$$;

-- Helper function to check if user has channel enabled
CREATE OR REPLACE FUNCTION public.is_channel_enabled(p_user_id UUID, p_channel TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  IF p_channel = 'IN_APP' THEN
    SELECT COALESCE(in_app_enabled, TRUE) INTO v_enabled
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id;
    RETURN COALESCE(v_enabled, TRUE);
  ELSIF p_channel = 'EMAIL' THEN
    SELECT COALESCE(email_enabled, FALSE) INTO v_enabled
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id;
    RETURN COALESCE(v_enabled, FALSE);
  ELSIF p_channel = 'WHATSAPP' THEN
    SELECT COALESCE(whatsapp_enabled, FALSE) INTO v_enabled
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id;
    RETURN COALESCE(v_enabled, FALSE);
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Event bus function to dispatch notifications
CREATE OR REPLACE FUNCTION public.dispatch_notification_event(
  p_event TEXT,
  p_user_id UUID,
  p_sacco_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locale TEXT;
  v_template RECORD;
  v_in_app_enabled BOOLEAN;
  v_email_enabled BOOLEAN;
  v_whatsapp_enabled BOOLEAN;
  v_email TEXT;
  v_msisdn TEXT;
BEGIN
  -- Get user locale and preferences
  SELECT 
    COALESCE(locale, 'en'),
    COALESCE(in_app_enabled, TRUE),
    COALESCE(email_enabled, FALSE),
    COALESCE(whatsapp_enabled, FALSE)
  INTO v_locale, v_in_app_enabled, v_email_enabled, v_whatsapp_enabled
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id;
  
  -- Default to 'en' if no preferences found
  v_locale := COALESCE(v_locale, 'en');
  v_in_app_enabled := COALESCE(v_in_app_enabled, TRUE);
  v_email_enabled := COALESCE(v_email_enabled, FALSE);
  v_whatsapp_enabled := COALESCE(v_whatsapp_enabled, FALSE);
  
  -- Create in-app notification if enabled
  IF v_in_app_enabled THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      p_user_id,
      CASE p_event
        WHEN 'INVITE_ACCEPTED' THEN 'invite_accepted'::public.notification_type
        WHEN 'JOIN_APPROVED' THEN 'new_member'::public.notification_type
        WHEN 'PAYMENT_CONFIRMED' THEN 'payment_confirmed'::public.notification_type
        ELSE 'new_member'::public.notification_type
      END,
      p_payload
    );
  END IF;
  
  -- Queue email notification if enabled and user has email
  IF v_email_enabled THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    
    IF v_email IS NOT NULL THEN
      -- Find template for this event and locale
      SELECT * INTO v_template
      FROM public.notification_templates
      WHERE event = p_event
        AND channel = 'EMAIL'
        AND locale = v_locale
        AND (sacco_id IS NULL OR sacco_id = p_sacco_id)
        AND is_active = TRUE
      ORDER BY sacco_id DESC NULLS LAST
      LIMIT 1;
      
      IF v_template.id IS NOT NULL THEN
        INSERT INTO public.notification_queue (
          event,
          channel,
          sacco_id,
          template_id,
          status,
          scheduled_for,
          payload
        ) VALUES (
          p_event,
          'EMAIL',
          p_sacco_id,
          v_template.id,
          'PENDING',
          NOW(),
          jsonb_build_object(
            'email', v_email,
            'subject', v_template.subject,
            'body', v_template.body,
            'tokens', p_payload
          )
        );
      END IF;
    END IF;
  END IF;
  
  -- Queue WhatsApp notification if enabled and user has msisdn
  IF v_whatsapp_enabled THEN
    -- Try to get msisdn from members_app_profiles
    SELECT whatsapp_msisdn INTO v_msisdn
    FROM public.members_app_profiles
    WHERE user_id = p_user_id;
    
    IF v_msisdn IS NOT NULL THEN
      -- Find template for this event and locale
      SELECT * INTO v_template
      FROM public.notification_templates
      WHERE event = p_event
        AND channel = 'WHATSAPP'
        AND locale = v_locale
        AND (sacco_id IS NULL OR sacco_id = p_sacco_id)
        AND is_active = TRUE
      ORDER BY sacco_id DESC NULLS LAST
      LIMIT 1;
      
      IF v_template.id IS NOT NULL THEN
        INSERT INTO public.notification_queue (
          event,
          channel,
          sacco_id,
          template_id,
          status,
          scheduled_for,
          payload
        ) VALUES (
          p_event,
          'WHATSAPP',
          p_sacco_id,
          v_template.id,
          'PENDING',
          NOW(),
          jsonb_build_object(
            'to', v_msisdn,
            'tokens', p_payload
          )
        );
      END IF;
    END IF;
  END IF;
END;
$$;

-- Trigger function for invite_accepted event
CREATE OR REPLACE FUNCTION public.on_invite_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_name TEXT;
  v_sacco_id UUID;
BEGIN
  -- Only fire when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Get group name and sacco_id
    SELECT i.name, i.sacco_id
    INTO v_group_name, v_sacco_id
    FROM public.ibimina i
    WHERE i.id = NEW.group_id;
    
    -- Dispatch notification to invitee
    IF NEW.invitee_user_id IS NOT NULL THEN
      PERFORM public.dispatch_notification_event(
        'INVITE_ACCEPTED',
        NEW.invitee_user_id,
        v_sacco_id,
        jsonb_build_object(
          'group_name', v_group_name,
          'group_id', NEW.group_id,
          'accepted_at', NEW.accepted_at
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for join_approved event
CREATE OR REPLACE FUNCTION public.on_join_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_name TEXT;
  v_sacco_id UUID;
BEGIN
  -- Only fire when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get group name and sacco_id
    SELECT i.name, i.sacco_id
    INTO v_group_name, v_sacco_id
    FROM public.ibimina i
    WHERE i.id = NEW.group_id;
    
    -- Dispatch notification to user
    PERFORM public.dispatch_notification_event(
      'JOIN_APPROVED',
      NEW.user_id,
      v_sacco_id,
      jsonb_build_object(
        'group_name', v_group_name,
        'group_id', NEW.group_id,
        'decided_at', NEW.decided_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for payment_confirmed event
CREATE OR REPLACE FUNCTION public.on_payment_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_user_id UUID;
  v_group_name TEXT;
  v_amount_formatted TEXT;
BEGIN
  -- Only fire when status changes to 'CONFIRMED'
  IF NEW.status = 'CONFIRMED' AND (OLD.status IS NULL OR OLD.status != 'CONFIRMED') THEN
    -- Try to find the member's user_id
    SELECT m.user_id
    INTO v_member_user_id
    FROM public.ikimina_members m
    WHERE m.id = NEW.member_id;
    
    -- Also try to get group name
    SELECT i.name
    INTO v_group_name
    FROM public.ibimina i
    WHERE i.id = NEW.ikimina_id;
    
    -- Format amount
    v_amount_formatted := CONCAT(NEW.currency, ' ', (NEW.amount / 100.0)::TEXT);
    
    -- Dispatch notification if we found a user
    IF v_member_user_id IS NOT NULL THEN
      PERFORM public.dispatch_notification_event(
        'PAYMENT_CONFIRMED',
        v_member_user_id,
        NEW.sacco_id,
        jsonb_build_object(
          'amount', v_amount_formatted,
          'currency', NEW.currency,
          'reference', NEW.reference,
          'group_name', v_group_name,
          'occurred_at', NEW.occurred_at,
          'payment_id', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_invite_accepted ON public.group_invites;
CREATE TRIGGER trigger_invite_accepted
  AFTER UPDATE ON public.group_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.on_invite_accepted();

DROP TRIGGER IF EXISTS trigger_join_approved ON public.join_requests;
CREATE TRIGGER trigger_join_approved
  AFTER UPDATE ON public.join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.on_join_approved();

DROP TRIGGER IF EXISTS trigger_payment_confirmed ON public.payments;
CREATE TRIGGER trigger_payment_confirmed
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.on_payment_confirmed();

-- Seed default templates (English)
INSERT INTO public.notification_templates (event, channel, locale, subject, body, tokens) VALUES
  -- INVITE_ACCEPTED - Email (EN)
  ('INVITE_ACCEPTED', 'EMAIL', 'en', 
   'Welcome to {group_name}!',
   E'Hello,\n\nYou have successfully joined {group_name}. Welcome to the group!\n\nYou can now participate in group activities and view group information in the app.\n\nBest regards,\nSACCO+ Team',
   '["group_name"]'::jsonb),
  
  -- INVITE_ACCEPTED - WhatsApp (EN)
  ('INVITE_ACCEPTED', 'WHATSAPP', 'en',
   NULL,
   'Welcome to {group_name}! You have successfully joined the group. You can now participate in group activities.',
   '["group_name"]'::jsonb),
  
  -- JOIN_APPROVED - Email (EN)
  ('JOIN_APPROVED', 'EMAIL', 'en',
   'Your request to join {group_name} has been approved',
   E'Hello,\n\nGreat news! Your request to join {group_name} has been approved.\n\nYou can now access the group and participate in all activities.\n\nBest regards,\nSACCO+ Team',
   '["group_name"]'::jsonb),
  
  -- JOIN_APPROVED - WhatsApp (EN)
  ('JOIN_APPROVED', 'WHATSAPP', 'en',
   NULL,
   'Good news! Your request to join {group_name} has been approved. You can now access the group.',
   '["group_name"]'::jsonb),
  
  -- PAYMENT_CONFIRMED - Email (EN)
  ('PAYMENT_CONFIRMED', 'EMAIL', 'en',
   'Payment confirmed: {amount}',
   E'Hello,\n\nYour payment of {amount} has been confirmed and recorded.\n\nReference: {reference}\nGroup: {group_name}\nDate: {occurred_at}\n\nThank you for your contribution!\n\nBest regards,\nSACCO+ Team',
   '["amount", "reference", "group_name", "occurred_at"]'::jsonb),
  
  -- PAYMENT_CONFIRMED - WhatsApp (EN)
  ('PAYMENT_CONFIRMED', 'WHATSAPP', 'en',
   NULL,
   'Payment confirmed! {amount} received for {group_name}. Reference: {reference}. Thank you!',
   '["amount", "reference", "group_name"]'::jsonb)
ON CONFLICT (event, channel, locale, sacco_id) DO NOTHING;

-- Seed default templates (Kinyarwanda)
INSERT INTO public.notification_templates (event, channel, locale, subject, body, tokens) VALUES
  -- INVITE_ACCEPTED - Email (RW)
  ('INVITE_ACCEPTED', 'EMAIL', 'rw',
   'Murakaza neza muri {group_name}!',
   E'Muraho,\n\nMwiyunze neza muri {group_name}. Murakaza neza muri itsinda!\n\nUbu mushobora kugira uruhare mu bikorwa by''itsinda no kureba amakuru y''itsinda muri porogaramu.\n\nMurakoze,\nIkipe ya SACCO+',
   '["group_name"]'::jsonb),
  
  -- INVITE_ACCEPTED - WhatsApp (RW)
  ('INVITE_ACCEPTED', 'WHATSAPP', 'rw',
   NULL,
   'Murakaza neza muri {group_name}! Mwiyunze neza muri itsinda. Ubu mushobora kugira uruhare mu bikorwa.',
   '["group_name"]'::jsonb),
  
  -- JOIN_APPROVED - Email (RW)
  ('JOIN_APPROVED', 'EMAIL', 'rw',
   'Icyifuzo cyanyu cyo kwinjira muri {group_name} cyemewe',
   E'Muraho,\n\nAmakuru meza! Icyifuzo cyanyu cyo kwinjira muri {group_name} cyemewe.\n\nUbu mushobora kubona itsinda no kugira uruhare mu bikorwa byose.\n\nMurakoze,\nIkipe ya SACCO+',
   '["group_name"]'::jsonb),
  
  -- JOIN_APPROVED - WhatsApp (RW)
  ('JOIN_APPROVED', 'WHATSAPP', 'rw',
   NULL,
   'Amakuru meza! Icyifuzo cyanyu cyo kwinjira muri {group_name} cyemewe. Ubu mushobora kubona itsinda.',
   '["group_name"]'::jsonb),
  
  -- PAYMENT_CONFIRMED - Email (RW)
  ('PAYMENT_CONFIRMED', 'EMAIL', 'rw',
   'Ubwishyu bwemejwe: {amount}',
   E'Muraho,\n\nUbwishyu bwanyu bwa {amount} bwemejwe kandi bwanditswe.\n\nReferensi: {reference}\nItsinda: {group_name}\nItariki: {occurred_at}\n\nMurakoze cyane kubw''umusanzu wanyu!\n\nMurakoze,\nIkipe ya SACCO+',
   '["amount", "reference", "group_name", "occurred_at"]'::jsonb),
  
  -- PAYMENT_CONFIRMED - WhatsApp (RW)
  ('PAYMENT_CONFIRMED', 'WHATSAPP', 'rw',
   NULL,
   'Ubwishyu bwemejwe! {amount} byakiriwe kuri {group_name}. Referensi: {reference}. Murakoze!',
   '["amount", "reference", "group_name"]'::jsonb)
ON CONFLICT (event, channel, locale, sacco_id) DO NOTHING;


-- From: 20251128000000_add_client_app_tables.sql

-- Migration: Add push_subscriptions and members_app_profiles tables
-- Description: Support for web push notifications and client app OCR/onboarding
-- Date: 2025-10-28

-- Create push_subscriptions table for web push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_push_subscriptions_topics ON public.push_subscriptions USING GIN(topics);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create or update members_app_profiles table for client app data
CREATE TABLE IF NOT EXISTS public.members_app_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identity verification
  id_type TEXT CHECK (id_type IN ('NID', 'DL', 'PASSPORT')),
  id_number TEXT,
  id_document_url TEXT,
  id_document_path TEXT,
  ocr_json JSONB,
  ocr_confidence NUMERIC(3,2),
  
  -- Onboarding status
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step TEXT,
  
  -- Profile data
  preferred_language TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_members_app_profiles_user_id ON public.members_app_profiles(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_members_app_profiles_id_number ON public.members_app_profiles(id_number) WHERE id_number IS NOT NULL;

-- Enable RLS
ALTER TABLE public.members_app_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members_app_profiles
CREATE POLICY "Users can view their own profile"
  ON public.members_app_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.members_app_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.members_app_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for ID documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-documents', 'id-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for id-documents bucket
CREATE POLICY "Users can upload their own ID documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'id-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own ID documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own ID documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add updated_at trigger for push_subscriptions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_members_app_profiles_updated_at ON public.members_app_profiles;
CREATE TRIGGER update_members_app_profiles_updated_at
  BEFORE UPDATE ON public.members_app_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.members_app_profiles TO authenticated;

-- Comments
COMMENT ON TABLE public.push_subscriptions IS 'Web push notification subscriptions for client app';
COMMENT ON TABLE public.members_app_profiles IS 'Client app member profiles with identity verification data';
COMMENT ON COLUMN public.members_app_profiles.ocr_json IS 'Raw OCR extraction results from ID document processing';
COMMENT ON COLUMN public.members_app_profiles.ocr_confidence IS 'OCR confidence score between 0 and 1';


-- From: 20251128120000_add_performance_indexes.sql

-- Performance Index Optimization Migration
-- Based on audit findings for high-traffic query patterns

-- ============================================
-- PAYMENTS TABLE INDEXES
-- ============================================

-- Index for filtering payments by SACCO and creation date (common dashboard query)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payments_sacco_created_at
ON public.payments (sacco_id, created_at DESC);

-- ============================================
-- SMS INBOX TABLE INDEXES
-- ============================================

-- Index for filtering SMS by parse source (AI vs REGEX analytics)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sms_inbox_parse_source
ON public.sms_inbox (parse_source);

-- ============================================
-- ADDITIONAL INDEXES
-- ============================================

-- Ensure foreign keys are indexed for join performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_users_sacco_id ON public.users(sacco_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_members_sacco_id ON public.members(sacco_id);


-- From: 20251128130000_standardize_schema.sql

-- Schema Standardization Migration
--
-- ⚠️ WARNING: This is a BREAKING CHANGE migration
-- DO NOT apply this migration without careful planning and coordination
--
-- This migration moves application tables from the 'public' schema to the 'app' schema
-- for consistency with the existing architecture.
--
-- BEFORE APPLYING:
-- 1. Review all code that references these tables
-- 2. Update all queries to use the 'app' schema prefix
-- 3. Test thoroughly in a staging environment
-- 4. Plan for downtime or use a blue-green deployment strategy
-- 5. Have a rollback plan ready
--
-- TABLES TO MIGRATE (if they exist in public schema):
-- - notifications (if not already in app schema)
-- - Any other application-specific tables currently in public
--
-- RECOMMENDED APPROACH:
-- Instead of moving tables, consider:
-- 1. Creating views in the app schema that point to public tables
-- 2. Gradually migrating code to use app schema
-- 3. Eventually moving tables when all code is updated
--
-- Example view-based approach:
-- CREATE OR REPLACE VIEW app.notifications AS SELECT * FROM public.notifications;
--
-- This allows gradual migration without breaking changes.

-- Uncomment and modify as needed:
-- BEGIN;
--
-- -- Move notifications table (example)
-- -- ALTER TABLE public.notifications SET SCHEMA app;
--
-- -- Update RLS policies
-- -- ALTER POLICY "policy_name" ON app.notifications RENAME TO "policy_name";
--
-- COMMIT;

-- For now, this migration file serves as documentation only.
-- Actual schema changes should be planned and executed carefully.


-- From: 20251130075500_remove_mfa_system.sql

-- Migration: Remove MFA System
-- This migration removes all MFA-related tables, columns, and functions
-- to simplify authentication to Supabase native email/password only

-- Drop MFA-related tables (CASCADE will handle associated triggers)
DROP TABLE IF EXISTS public.trusted_devices CASCADE;
DROP TABLE IF EXISTS public.webauthn_credentials CASCADE;
DROP TABLE IF EXISTS public.mfa_recovery_codes CASCADE;
DROP TABLE IF EXISTS app.mfa_email_codes CASCADE;
DROP TABLE IF EXISTS app.mfa_codes CASCADE;

-- Remove MFA columns from users table
ALTER TABLE public.users 
  DROP COLUMN IF EXISTS mfa_enabled,
  DROP COLUMN IF EXISTS mfa_secret_enc,
  DROP COLUMN IF EXISTS mfa_enrolled_at,
  DROP COLUMN IF EXISTS mfa_methods,
  DROP COLUMN IF EXISTS mfa_backup_hashes,
  DROP COLUMN IF EXISTS last_mfa_success_at,
  DROP COLUMN IF EXISTS failed_mfa_count,
  DROP COLUMN IF EXISTS last_mfa_step,
  DROP COLUMN IF EXISTS mfa_passkey_enrolled;

-- Drop MFA-related functions if they exist
DROP FUNCTION IF EXISTS public.touch_mfa_recovery_codes() CASCADE;


-- From: 20251201000000_add_whatsapp_otp_auth.sql

-- Migration: Add WhatsApp OTP authentication for client app members
-- Description: Tables and functions for WhatsApp-based OTP authentication
-- Date: 2025-12-01

-- Create table for WhatsApp OTP codes
CREATE TABLE IF NOT EXISTS app.whatsapp_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  
  -- Prevent multiple active codes for same phone
  CONSTRAINT unique_active_otp 
    UNIQUE NULLS NOT DISTINCT (phone_number, consumed_at)
    WHERE consumed_at IS NULL
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_whatsapp_otp_phone ON app.whatsapp_otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_whatsapp_otp_expires ON app.whatsapp_otp_codes(expires_at);

-- Enable RLS
ALTER TABLE app.whatsapp_otp_codes ENABLE ROW LEVEL SECURITY;

-- Service role can manage OTP codes
CREATE POLICY "Service role can manage OTP codes"
  ON app.whatsapp_otp_codes
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Add authentication fields to members_app_profiles
DO $$
BEGIN
  -- Add WhatsApp verification fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'whatsapp_verified'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN whatsapp_verified BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'whatsapp_verified_at'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN whatsapp_verified_at TIMESTAMPTZ;
  END IF;

  -- Add biometric authentication fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'biometric_enabled'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN biometric_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'biometric_enrolled_at'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN biometric_enrolled_at TIMESTAMPTZ;
  END IF;

  -- Add last login timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'members_app_profiles' 
      AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE public.members_app_profiles 
      ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create permission types enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_permission') THEN
    CREATE TYPE public.member_permission AS ENUM (
      'VIEW_BALANCE',
      'VIEW_TRANSACTIONS',
      'MAKE_PAYMENTS',
      'VIEW_GROUPS',
      'JOIN_GROUPS',
      'MANAGE_PROFILE'
    );
  END IF;
END $$;

-- Create member permissions table
CREATE TABLE IF NOT EXISTS public.member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.member_permission NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  
  -- Unique constraint to prevent duplicate permissions
  UNIQUE (user_id, permission)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_member_permissions_user ON public.member_permissions(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_member_permissions_permission ON public.member_permissions(permission);

-- Enable RLS
ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

-- Members can view their own permissions
CREATE POLICY "Members can view own permissions"
  ON public.member_permissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage permissions
CREATE POLICY "Service role can manage permissions"
  ON public.member_permissions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Staff can manage member permissions
CREATE POLICY "Staff can manage member permissions"
  ON public.member_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('SYSTEM_ADMIN', 'SACCO_MANAGER', 'SACCO_STAFF')
    )
  );

-- Create function to check if user has permission
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _permission public.member_permission
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.member_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND (expires_at IS NULL OR expires_at > timezone('UTC', now()))
  );
END;
$$;

-- Grant default permissions to new members
CREATE OR REPLACE FUNCTION public.grant_default_member_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Grant basic permissions to new members
  INSERT INTO public.member_permissions (user_id, permission)
  VALUES 
    (NEW.user_id, 'VIEW_BALANCE'),
    (NEW.user_id, 'VIEW_TRANSACTIONS'),
    (NEW.user_id, 'VIEW_GROUPS'),
    (NEW.user_id, 'MANAGE_PROFILE')
  ON CONFLICT (user_id, permission) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to grant default permissions on profile creation
DROP TRIGGER IF EXISTS grant_default_permissions_on_profile ON public.members_app_profiles;
CREATE TRIGGER grant_default_permissions_on_profile
  AFTER INSERT ON public.members_app_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_default_member_permissions();

-- Add cleanup function for expired OTP codes
CREATE OR REPLACE FUNCTION app.cleanup_expired_otp_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app
AS $$
BEGIN
  DELETE FROM app.whatsapp_otp_codes
  WHERE expires_at < timezone('UTC', now()) - interval '1 day';
END;
$$;

-- Create scheduled job to cleanup expired OTP codes (runs daily at 2 AM)
DO $$
BEGIN
  -- Only create cron job if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-expired-otp-codes',
      '0 2 * * *',
      'SELECT app.cleanup_expired_otp_codes()'
    );
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON app.whatsapp_otp_codes TO authenticated;
GRANT ALL ON public.member_permissions TO authenticated;

-- Comments
COMMENT ON TABLE app.whatsapp_otp_codes IS 'WhatsApp OTP codes for member authentication';
COMMENT ON TABLE public.member_permissions IS 'Member permissions for granular access control';
COMMENT ON COLUMN public.members_app_profiles.whatsapp_verified IS 'Whether WhatsApp number has been verified via OTP';
COMMENT ON COLUMN public.members_app_profiles.biometric_enabled IS 'Whether biometric authentication is enabled for this user';
COMMENT ON FUNCTION public.has_permission IS 'Check if a user has a specific permission';


-- From: 20251201100000_multicountry_intermediation.sql

-- =============================================================================
-- MULTI-COUNTRY INTERMEDIATION PRIMITIVES
-- =============================================================================

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
-- Optional: pgvector if you use embeddings elsewhere
-- create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- COUNTRIES & TELCO PROVIDERS
-- -----------------------------------------------------------------------------

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 char(2) not null,          -- 'RW', 'SN', 'CI', 'GH', ...
  iso3 char(3) not null,          -- 'RWA', 'SEN', 'CIV', ...
  name text not null,
  default_locale text not null,   -- 'rw-RW', 'fr-SN', 'en-GH', ...
  currency_code char(3) not null, -- 'RWF', 'XOF', 'GHS', ...
  timezone text not null,         -- 'Africa/Kigali'
  is_active boolean not null default true,
  unique (iso2),
  unique (iso3),
  unique (name)
);

create table if not exists public.telco_providers (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name text not null,              -- 'MTN', 'Airtel', 'Orange', etc.
  ussd_pattern text not null,      -- e.g. '*182#'
  merchant_field_name text not null default 'merchant',
  reference_field_name text not null default 'reference',
  notes text
);
create index if not exists idx_telco_country on public.telco_providers(country_id);

-- -----------------------------------------------------------------------------
-- CONFIG BY COUNTRY & PARTNER (ORG)
-- -----------------------------------------------------------------------------

create table if not exists public.country_config (
  country_id uuid primary key references public.countries(id) on delete cascade,
  languages text[] not null,                   -- e.g. '{ "rw-RW","en-RW","fr-RW" }'
  enabled_features text[] not null,            -- e.g. '{ "USSD","OCR","SMS_INGEST","NFC" }'
  kyc_required_docs jsonb not null,            -- { "NID": true, "Passport": false, "Selfie": true }
  legal_pages jsonb not null,                  -- { "terms": "...", "privacy": "..." } localized urls
  telco_ids uuid[] not null,                   -- telco_providers.ids used in this country
  reference_format text not null default 'C3.D3.S3.G4.M3',  -- COUNTRY.DISTRICT.SACCO.GROUP.MEMBER
  number_format jsonb,
  settlement_notes text
);

create table if not exists public.partner_config (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  enabled_features text[],
  merchant_code text,              -- partner's MoMo merchant code
  telco_ids uuid[],
  language_pack text[],
  reference_prefix text,           -- override if needed (e.g., 'RWA.NYA.GAS.TWIZ')
  contact jsonb                    -- { "phone": "...", "email": "...", "hours": "..." }
);

-- -----------------------------------------------------------------------------
-- MAKE ORGANIZATIONS COUNTRY-AWARE
-- -----------------------------------------------------------------------------

-- For existing rows, add column nullable then backfill, then set NOT NULL.
alter table public.organizations add column if not exists country_id uuid;
-- Backfill example (set Rwanda by default if you only have RW initially):
-- update public.organizations set country_id = (select id from public.countries where iso2='RW') where country_id is null;

-- Enforce foreign key and NOT NULL for new rows:
alter table public.organizations
  add constraint org_country_fk foreign key (country_id) references public.countries(id);

-- You can set NOT NULL after backfill:
-- alter table public.organizations alter column country_id set not null;

-- -----------------------------------------------------------------------------
-- TENANT TABLES: ADD COUNTRY_ID + TRIGGERS TO PROPAGATE FROM ORG
-- -----------------------------------------------------------------------------

-- Groups (ibimina)
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid,
  name text not null,
  code text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

alter table if exists public.groups
  add constraint groups_country_fk foreign key (country_id) references public.countries(id);

create index if not exists idx_groups_org on public.groups(org_id);
create index if not exists idx_groups_country on public.groups(country_id);

create or replace function public.set_group_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_groups_country on public.groups;
create trigger trg_groups_country
before insert on public.groups
for each row execute function public.set_group_country();

-- Group members
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  country_id uuid,
  member_name text not null,
  member_code text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

alter table if exists public.group_members
  add constraint gm_country_fk foreign key (country_id) references public.countries(id);

create index if not exists idx_group_members_group on public.group_members(group_id);
create index if not exists idx_group_members_country on public.group_members(country_id);

create or replace function public.set_group_member_country()
returns trigger language plpgsql as $$
declare
  v_country uuid;
begin
  if new.country_id is null then
    select g.country_id into v_country from public.groups g where g.id = new.group_id;
    new.country_id := v_country;
  end if;
  return new;
end$$;

drop trigger if exists trg_group_members_country on public.group_members;
create trigger trg_group_members_country
before insert on public.group_members
for each row execute function public.set_group_member_country();

-- Uploads (staff OCR/CSV)
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid,
  file_name text not null,
  file_type text not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

alter table if exists public.uploads
  add constraint uploads_country_fk foreign key (country_id) references public.countries(id);

create index if not exists idx_uploads_org on public.uploads(org_id);
create index if not exists idx_uploads_country on public.uploads(country_id);

create or replace function public.set_upload_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_uploads_country on public.uploads;
create trigger trg_uploads_country
before insert on public.uploads
for each row execute function public.set_upload_country();

-- Allocations (MoMo evidence)
create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid,
  sacco_name text,
  momo_txn_id text not null,
  payer_msisdn text,
  amount integer not null,
  ts timestamptz not null,
  raw_ref text,
  decoded_district text,
  decoded_sacco text,
  decoded_group text,
  decoded_member text,
  match_status text not null default 'UNALLOCATED',
  notes text,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

alter table if exists public.allocations
  add constraint allocations_country_fk foreign key (country_id) references public.countries(id);

create index if not exists idx_allocations_org on public.allocations(org_id);
create index if not exists idx_allocations_country on public.allocations(country_id);
create index if not exists idx_allocations_txn on public.allocations(momo_txn_id);

create or replace function public.set_allocation_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_allocations_country on public.allocations;
create trigger trg_allocations_country
before insert on public.allocations
for each row execute function public.set_allocation_country();

-- Optional: org knowledge base / tickets if you use AI/ticketing
-- org_kb
create table if not exists public.org_kb (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid references public.countries(id),
  title text not null,
  content text not null,
  tags text[],
  created_at timestamptz default now()
);
create index if not exists idx_org_kb_org on public.org_kb(org_id);
create index if not exists idx_org_kb_country on public.org_kb(country_id);

create or replace function public.set_org_kb_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_org_kb_country on public.org_kb;
create trigger trg_org_kb_country
before insert on public.org_kb
for each row execute function public.set_org_kb_country();

-- tickets
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  channel text check (channel in ('in_app','whatsapp','email','ivr')) not null,
  subject text not null,
  status text check (status in ('open','pending','resolved','closed')) not null default 'open',
  priority text check (priority in ('low','normal','high','urgent')) default 'normal',
  meta jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tickets_org on public.tickets(org_id);
create index if not exists idx_tickets_country on public.tickets(country_id);
create index if not exists idx_tickets_user on public.tickets(user_id);

create or replace function public.set_ticket_country()
returns trigger language plpgsql as $$
begin
  if new.country_id is null then
    select country_id into new.country_id from public.organizations where id = new.org_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_tickets_country on public.tickets;
create trigger trg_tickets_country
before insert on public.tickets
for each row execute function public.set_ticket_country();

-- -----------------------------------------------------------------------------
-- RLS HELPERS
-- -----------------------------------------------------------------------------

create or replace function public.user_org_ids()
returns setof uuid language sql stable as $$
  select org_id from public.org_memberships where user_id = auth.uid()
$$;

create or replace function public.user_country_ids()
returns setof uuid language sql stable as $$
  select distinct o.country_id
  from public.organizations o
  join public.org_memberships m on m.org_id = o.id
  where m.user_id = auth.uid()
$$;

create or replace function public.is_system_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.org_memberships
    where user_id = auth.uid() and role = 'SYSTEM_ADMIN'
  )
$$;

-- Enable RLS
alter table public.countries enable row level security;
alter table public.telco_providers enable row level security;
alter table public.country_config enable row level security;
alter table public.partner_config enable row level security;
alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.uploads enable row level security;
alter table public.allocations enable row level security;
alter table public.org_kb enable row level security;
alter table public.tickets enable row level security;

-- Countries readable to admins and anyone who belongs to any org within that country
create policy countries_read on public.countries
for select using (
  public.is_system_admin()
  or id in (select public.user_country_ids())
);

create policy telcos_read on public.telco_providers
for select using (
  public.is_system_admin()
  or country_id in (select public.user_country_ids())
);

create policy country_config_read on public.country_config
for select using (
  public.is_system_admin()
  or country_id in (select public.user_country_ids())
);

-- Organizations: read if admin or you belong to the org or its parent (district)
create policy orgs_read on public.organizations
for select using (
  public.is_system_admin()
  or id in (select public.user_org_ids())
  or id in (
    select parent_id from public.organizations o2
    where o2.id in (select public.user_org_ids())
  )
);

-- org_memberships: visible to admin or self or same org
create policy om_read on public.org_memberships
for select using (
  public.is_system_admin()
  or user_id = auth.uid()
  or org_id in (select public.user_org_ids())
);

-- Groups: only within your org or district scope and country
create policy groups_select on public.groups
for select using (
  country_id in (select public.user_country_ids())
  and (
    org_id in (select public.user_org_ids())
    or org_id in (
      -- child SACCOs of your district orgs
      select o.id from public.organizations o
      join public.organizations d on o.parent_id = d.id
      where d.id in (select public.user_org_ids())
    )
  )
);

-- Group members: same visibility as groups
create policy group_members_select on public.group_members
for select using (
  country_id in (select public.user_country_ids())
  and group_id in (
    select id from public.groups
    where org_id in (select public.user_org_ids())
      or org_id in (
        select o.id from public.organizations o
        join public.organizations d on o.parent_id = d.id
        where d.id in (select public.user_org_ids())
      )
  )
);

-- Uploads: staff RW within own org & country
create policy uploads_rw on public.uploads
for all using (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
) with check (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
);

-- Allocations: staff RW within own org & country; district managers read across child orgs
create policy allocations_staff_rw on public.allocations
for all using (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
) with check (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
);

create policy allocations_district_r on public.allocations
for select using (
  country_id in (select public.user_country_ids())
  and org_id in (
    select o.id from public.organizations o
    join public.organizations d on o.parent_id = d.id
    where d.id in (select public.user_org_ids())
  )
);

-- org_kb: read by same org/country (and admin)
create policy org_kb_read on public.org_kb
for select using (
  public.is_system_admin()
  or (country_id in (select public.user_country_ids())
      and org_id in (select public.user_org_ids()))
);

-- tickets: staff RW own org/country; users R their tickets
create policy tickets_staff_rw on public.tickets
for all using (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
) with check (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
);

create policy tickets_user_r on public.tickets
for select using (user_id = auth.uid());

-- Partner config readable to admin and partner staff
create policy partner_config_read on public.partner_config
for select using (
  public.is_system_admin()
  or org_id in (select public.user_org_ids())
);

-- Backfill note: run a one-time script to set country_id on existing organizations (e.g., to Rwanda),
-- then on groups, group_members, uploads, allocations using the triggers or direct updates.


-- From: 20251215093000_add_whatsapp_otp_event_logging.sql

-- Add append-only event log and counters for WhatsApp OTP flows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'app'::regnamespace AND typname = 'whatsapp_otp_event_type'
  ) THEN
    CREATE TYPE app.whatsapp_otp_event_type AS ENUM (
      'send_success',
      'send_throttled',
      'send_failed',
      'verify_success',
      'verify_invalid',
      'verify_throttled',
      'verify_expired',
      'verify_max_attempts'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.whatsapp_otp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  event_type app.whatsapp_otp_event_type NOT NULL,
  attempts_remaining INTEGER,
  ip_address TEXT,
  device_fingerprint TEXT,
  device_id TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_whatsapp_otp_events_phone_created
  ON app.whatsapp_otp_events (phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_whatsapp_otp_events_event_created
  ON app.whatsapp_otp_events (event_type, created_at DESC);

ALTER TABLE app.whatsapp_otp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role manages whatsapp otp events"
  ON app.whatsapp_otp_events
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE TABLE IF NOT EXISTS app.whatsapp_otp_stats (
  phone_number TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_ip TEXT,
  last_device_fingerprint TEXT,
  last_device_id TEXT
);

ALTER TABLE app.whatsapp_otp_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role manages whatsapp otp stats"
  ON app.whatsapp_otp_stats
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE OR REPLACE FUNCTION app.record_whatsapp_otp_event(
  phone_number TEXT,
  event_type app.whatsapp_otp_event_type,
  attempts_remaining INTEGER DEFAULT NULL,
  ip_address TEXT DEFAULT NULL,
  device_fingerprint TEXT DEFAULT NULL,
  device_id TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  metadata JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'app', 'public'
AS $$
DECLARE
  now_ts TIMESTAMPTZ := timezone('UTC', now());
  failure_inc INTEGER := CASE
    WHEN event_type IN ('send_throttled', 'send_failed', 'verify_invalid', 'verify_throttled', 'verify_expired', 'verify_max_attempts') THEN 1
    ELSE 0
  END;
  success_inc INTEGER := CASE
    WHEN event_type = 'verify_success' THEN 1
    ELSE 0
  END;
BEGIN
  INSERT INTO app.whatsapp_otp_events (
    phone_number,
    event_type,
    attempts_remaining,
    ip_address,
    device_fingerprint,
    device_id,
    user_agent,
    metadata,
    created_at
  )
  VALUES (
    phone_number,
    event_type,
    attempts_remaining,
    ip_address,
    device_fingerprint,
    device_id,
    user_agent,
    metadata,
    now_ts
  );

  INSERT INTO app.whatsapp_otp_stats (
    phone_number,
    failure_count,
    success_count,
    last_event_at,
    last_failure_at,
    last_success_at,
    last_ip,
    last_device_fingerprint,
    last_device_id
  )
  VALUES (
    phone_number,
    failure_inc,
    success_inc,
    now_ts,
    CASE WHEN failure_inc > 0 THEN now_ts ELSE NULL END,
    CASE WHEN success_inc > 0 THEN now_ts ELSE NULL END,
    ip_address,
    device_fingerprint,
    device_id
  )
  ON CONFLICT (phone_number) DO UPDATE
  SET
    failure_count = CASE
      WHEN EXCLUDED.success_count > 0 THEN 0
      ELSE app.whatsapp_otp_stats.failure_count + EXCLUDED.failure_count
    END,
    success_count = app.whatsapp_otp_stats.success_count + EXCLUDED.success_count,
    last_event_at = now_ts,
    last_failure_at = CASE
      WHEN EXCLUDED.failure_count > 0 THEN now_ts
      ELSE app.whatsapp_otp_stats.last_failure_at
    END,
    last_success_at = CASE
      WHEN EXCLUDED.success_count > 0 THEN now_ts
      ELSE app.whatsapp_otp_stats.last_success_at
    END,
    last_ip = COALESCE(EXCLUDED.last_ip, app.whatsapp_otp_stats.last_ip),
    last_device_fingerprint = COALESCE(EXCLUDED.last_device_fingerprint, app.whatsapp_otp_stats.last_device_fingerprint),
    last_device_id = COALESCE(EXCLUDED.last_device_id, app.whatsapp_otp_stats.last_device_id);
END;
$$;

GRANT EXECUTE ON FUNCTION app.record_whatsapp_otp_event(
  TEXT,
  app.whatsapp_otp_event_type,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO service_role;

COMMENT ON TABLE app.whatsapp_otp_events IS 'Append-only log of WhatsApp OTP send/verify events for fraud analytics.';
COMMENT ON TABLE app.whatsapp_otp_stats IS 'Aggregated counters tracking WhatsApp OTP verification outcomes per phone number.';


-- From: 20251231100000_multinational_expansion.sql

-- Multi-Country Expansion Infrastructure
-- Adds country-aware tenancy, telco providers, country configs, and reference token v2
-- Enables expansion to any Sub-Saharan African market via configuration

-- =============================================================================
-- 1. COUNTRIES CATALOG
-- =============================================================================

-- Countries table: activate markets here
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2 CHAR(2) NOT NULL UNIQUE,           -- e.g., 'RW', 'SN', 'CI', 'GH', 'ZM'
  iso3 CHAR(3) NOT NULL UNIQUE,           -- 'RWA', 'SEN', 'CIV', 'GHA', 'ZMW'
  name TEXT NOT NULL UNIQUE,              -- Full country name
  default_locale TEXT NOT NULL,           -- 'rw-RW', 'fr-SN', 'en-GH'
  currency_code CHAR(3) NOT NULL,         -- 'RWF', 'XOF', 'GHS', 'ZMW'
  timezone TEXT NOT NULL,                 -- IANA TZ e.g., 'Africa/Kigali'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_countries_active ON public.countries(is_active);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_countries_iso2 ON public.countries(iso2);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_countries_iso3 ON public.countries(iso3);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS countries_touch_updated_at ON public.countries;
CREATE TRIGGER countries_touch_updated_at
  BEFORE UPDATE ON public.countries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.countries IS 'Catalog of supported countries for multi-country expansion';
COMMENT ON COLUMN public.countries.iso2 IS 'ISO 3166-1 alpha-2 country code';
COMMENT ON COLUMN public.countries.iso3 IS 'ISO 3166-1 alpha-3 country code (used in reference tokens)';
COMMENT ON COLUMN public.countries.default_locale IS 'Default locale/language for this country';
COMMENT ON COLUMN public.countries.currency_code IS 'ISO 4217 currency code';
COMMENT ON COLUMN public.countries.timezone IS 'IANA timezone identifier';

-- =============================================================================
-- 2. TELECOM PROVIDERS (per country)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.telco_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- 'MTN', 'Airtel', 'Orange', etc.
  ussd_pattern TEXT NOT NULL,             -- Documentation pattern e.g. '*182#'
  merchant_field_name TEXT NOT NULL DEFAULT 'merchant',
  reference_field_name TEXT NOT NULL DEFAULT 'reference',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  UNIQUE(country_id, name)
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_telco_country ON public.telco_providers(country_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_telco_active ON public.telco_providers(is_active);

DROP TRIGGER IF EXISTS telco_providers_touch_updated_at ON public.telco_providers;
CREATE TRIGGER telco_providers_touch_updated_at
  BEFORE UPDATE ON public.telco_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.telco_providers IS 'Mobile money providers per country with USSD patterns';
COMMENT ON COLUMN public.telco_providers.ussd_pattern IS 'USSD code pattern for documentation (e.g., *182#)';
COMMENT ON COLUMN public.telco_providers.merchant_field_name IS 'Field name used for merchant code in statements';
COMMENT ON COLUMN public.telco_providers.reference_field_name IS 'Field name used for reference in statements';

-- =============================================================================
-- 3. COUNTRY CONFIGURATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.country_config (
  country_id UUID PRIMARY KEY REFERENCES public.countries(id) ON DELETE CASCADE,
  languages TEXT[] NOT NULL DEFAULT '{}',               -- e.g., '{"rw-RW","en-RW","fr-RW"}'
  enabled_features TEXT[] NOT NULL DEFAULT '{}',        -- e.g., '{"USSD","OCR","SMS_INGEST","NFC"}'
  kyc_required_docs JSONB NOT NULL DEFAULT '{}',        -- {"NID": true, "Passport": false, "Selfie": true}
  legal_pages JSONB NOT NULL DEFAULT '{}',              -- {terms_url, privacy_url, etc. per locale}
  telco_ids UUID[] NOT NULL DEFAULT '{}',               -- Provider IDs used in this country
  reference_format TEXT NOT NULL DEFAULT 'C3.D3.S3.G4.M3', -- Format: COUNTRY3.DISTRICT3.SACCO3.GROUP4.MEMBER3
  number_format JSONB,                                  -- MSISDN normalization rules
  settlement_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

DROP TRIGGER IF EXISTS country_config_touch_updated_at ON public.country_config;
CREATE TRIGGER country_config_touch_updated_at
  BEFORE UPDATE ON public.country_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.country_config IS 'Country-level policy and content toggles';
COMMENT ON COLUMN public.country_config.languages IS 'Supported locales for this country';
COMMENT ON COLUMN public.country_config.enabled_features IS 'Feature flags enabled at country level';
COMMENT ON COLUMN public.country_config.kyc_required_docs IS 'Required KYC documents for this country';
COMMENT ON COLUMN public.country_config.reference_format IS 'Reference token format pattern (e.g., C3.D3.S3.G4.M3)';

-- =============================================================================
-- 4. PARTNER CONFIGURATION (org-specific overrides)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.partner_config (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled_features TEXT[],                              -- Override/additive to country config
  merchant_code TEXT,                                   -- SACCO/MFI merchant code
  telco_ids UUID[],                                     -- Specific telcos used by partner
  language_pack TEXT[],                                 -- Force specific languages
  reference_prefix TEXT,                                -- Override reference prefix if needed
  contact JSONB,                                        -- {helpline, email, office_hours}
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

DROP TRIGGER IF EXISTS partner_config_touch_updated_at ON public.partner_config;
CREATE TRIGGER partner_config_touch_updated_at
  BEFORE UPDATE ON public.partner_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.partner_config IS 'Per-organization configuration overrides';
COMMENT ON COLUMN public.partner_config.enabled_features IS 'Feature flags enabled for this partner (additive to country config)';
COMMENT ON COLUMN public.partner_config.merchant_code IS 'Merchant code for this SACCO/MFI';

-- =============================================================================
-- 5. ADD country_id TO organizations
-- =============================================================================

-- Add country_id to organizations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN country_id UUID REFERENCES public.countries(id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organizations_country ON public.organizations(country_id);
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.country_id IS 'Country where this organization operates';

-- =============================================================================
-- 6. PROPAGATE country_id TO TENANT TABLES
-- =============================================================================

-- Helper function to set country_id from parent organization
CREATE OR REPLACE FUNCTION public.set_country_from_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  -- If country_id not set and org_id exists, copy from organization
  IF NEW.country_id IS NULL AND NEW.org_id IS NOT NULL THEN
    SELECT country_id INTO NEW.country_id 
    FROM public.organizations 
    WHERE id = NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_country_from_org() IS 'Trigger function to propagate country_id from organization';

-- Add country_id to app.saccos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'saccos' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE app.saccos ADD COLUMN country_id UUID REFERENCES public.countries(id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_saccos_country ON app.saccos(country_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_saccos_set_country ON app.saccos;
CREATE TRIGGER trg_saccos_set_country 
  BEFORE INSERT ON app.saccos
  FOR EACH ROW EXECUTE FUNCTION public.set_country_from_org();

-- Add country_id to app.ikimina
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'ikimina' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE app.ikimina ADD COLUMN country_id UUID REFERENCES public.countries(id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_ikimina_country ON app.ikimina(country_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_ikimina_set_country ON app.ikimina;
CREATE TRIGGER trg_ikimina_set_country 
  BEFORE INSERT ON app.ikimina
  FOR EACH ROW EXECUTE FUNCTION public.set_country_from_org();

-- Add country_id to app.members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'members' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE app.members ADD COLUMN country_id UUID REFERENCES public.countries(id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_members_country ON app.members(country_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_members_set_country ON app.members;
CREATE TRIGGER trg_members_set_country 
  BEFORE INSERT ON app.members
  FOR EACH ROW EXECUTE FUNCTION public.set_country_from_org();

-- Add country_id to app.payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'payments' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE app.payments ADD COLUMN country_id UUID REFERENCES public.countries(id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_payments_country ON app.payments(country_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_payments_set_country ON app.payments;
CREATE TRIGGER trg_payments_set_country 
  BEFORE INSERT ON app.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_country_from_org();

-- Add country_id to app.import_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'import_files' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE app.import_files ADD COLUMN country_id UUID REFERENCES public.countries(id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_import_files_country ON app.import_files(country_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_import_files_set_country ON app.import_files;
CREATE TRIGGER trg_import_files_set_country 
  BEFORE INSERT ON app.import_files
  FOR EACH ROW EXECUTE FUNCTION public.set_country_from_org();

-- Add country_id to app.sms_inbox
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'sms_inbox' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE app.sms_inbox ADD COLUMN country_id UUID REFERENCES public.countries(id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sms_inbox_country ON app.sms_inbox(country_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sms_inbox_set_country ON app.sms_inbox;
CREATE TRIGGER trg_sms_inbox_set_country 
  BEFORE INSERT ON app.sms_inbox
  FOR EACH ROW EXECUTE FUNCTION public.set_country_from_org();

-- Add country_id to app.recon_exceptions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'app' AND table_name = 'recon_exceptions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'app' AND table_name = 'recon_exceptions' AND column_name = 'country_id'
  ) THEN
    ALTER TABLE app.recon_exceptions ADD COLUMN country_id UUID REFERENCES public.countries(id);
    CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_recon_exceptions_country ON app.recon_exceptions(country_id);
  END IF;
END $$;

-- =============================================================================
-- 7. COUNTRY-AWARE RLS HELPER FUNCTIONS
-- =============================================================================

-- Get user's accessible country IDs
CREATE OR REPLACE FUNCTION public.user_country_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT o.country_id 
  FROM public.organizations o
  JOIN public.org_memberships om ON om.org_id = o.id
  WHERE om.user_id = auth.uid() AND o.country_id IS NOT NULL
$$;

COMMENT ON FUNCTION public.user_country_ids() IS 'Returns all country IDs accessible by current user';

-- Check if user can access a specific country
CREATE OR REPLACE FUNCTION public.user_can_access_country(target_country_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin() 
    OR target_country_id IN (SELECT public.user_country_ids())
$$;

COMMENT ON FUNCTION public.user_can_access_country(UUID) IS 'Checks if user can access a specific country';

-- =============================================================================
-- 8. UPDATE RLS POLICIES WITH COUNTRY GUARDS
-- =============================================================================

-- Note: RLS policies are already in place from multitenancy migration
-- We extend them to include country_id checks where applicable

-- Update app.saccos RLS to include country check
DROP POLICY IF EXISTS sacco_select_multitenancy_country ON app.saccos;
CREATE POLICY sacco_select_multitenancy_country
  ON app.saccos
  FOR SELECT
  USING (
    public.is_platform_admin() 
    OR (
      country_id IS NOT NULL 
      AND public.user_can_access_country(country_id)
      AND (org_id IS NULL OR public.user_can_access_org(org_id))
    )
    OR (country_id IS NULL AND org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (country_id IS NULL AND org_id IS NULL AND id = app.current_sacco())
  );

DROP POLICY IF EXISTS sacco_modify_multitenancy_country ON app.saccos;
CREATE POLICY sacco_modify_multitenancy_country
  ON app.saccos
  FOR ALL
  USING (
    public.is_platform_admin()
    OR (
      country_id IS NOT NULL 
      AND public.user_can_access_country(country_id)
      AND (org_id IS NULL OR public.user_can_access_org(org_id))
    )
    OR (country_id IS NULL AND org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (country_id IS NULL AND org_id IS NULL AND app.is_admin())
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (
      country_id IS NOT NULL 
      AND public.user_can_access_country(country_id)
      AND (org_id IS NULL OR public.user_can_access_org(org_id))
    )
    OR (country_id IS NULL AND org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (country_id IS NULL AND org_id IS NULL AND app.is_admin())
  );

-- Similar updates for other tenant tables would go here
-- For brevity, showing pattern for ikimina only

DROP POLICY IF EXISTS ikimina_select_multitenancy_country ON app.ikimina;
CREATE POLICY ikimina_select_multitenancy_country
  ON app.ikimina
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR (
      country_id IS NOT NULL 
      AND public.user_can_access_country(country_id)
      AND (org_id IS NULL OR public.user_can_access_org(org_id))
    )
    OR (country_id IS NULL AND org_id IS NOT NULL AND public.user_can_access_org(org_id))
    OR (country_id IS NULL AND (app.is_admin() OR sacco_id = app.current_sacco()))
  );

-- =============================================================================
-- 9. RLS FOR NEW TABLES
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.telco_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telco_providers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.country_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_config FORCE ROW LEVEL SECURITY;

ALTER TABLE public.partner_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_config FORCE ROW LEVEL SECURITY;

-- RLS policies for countries (readable by all authenticated users, writable by admins)
CREATE POLICY countries_select
  ON public.countries
  FOR SELECT
  USING (is_active = true OR public.is_platform_admin());

CREATE POLICY countries_modify
  ON public.countries
  FOR ALL
  USING (public.is_platform_admin());

-- RLS policies for telco_providers
CREATE POLICY telco_providers_select
  ON public.telco_providers
  FOR SELECT
  USING (
    is_active = true 
    AND (
      public.is_platform_admin() 
      OR country_id IN (SELECT public.user_country_ids())
    )
  );

CREATE POLICY telco_providers_modify
  ON public.telco_providers
  FOR ALL
  USING (public.is_platform_admin());

-- RLS policies for country_config
CREATE POLICY country_config_select
  ON public.country_config
  FOR SELECT
  USING (
    public.is_platform_admin() 
    OR country_id IN (SELECT public.user_country_ids())
  );

CREATE POLICY country_config_modify
  ON public.country_config
  FOR ALL
  USING (public.is_platform_admin());

-- RLS policies for partner_config
CREATE POLICY partner_config_select
  ON public.partner_config
  FOR SELECT
  USING (
    public.is_platform_admin() 
    OR public.user_can_access_org(org_id)
  );

CREATE POLICY partner_config_modify
  ON public.partner_config
  FOR ALL
  USING (
    public.is_platform_admin() 
    OR public.user_can_access_org(org_id)
  );

-- =============================================================================
-- 10. FEATURE FLAGS EXTENSION
-- =============================================================================

-- Extend existing feature_flags table to support country and partner scoping
DO $$
BEGIN
  -- Add country_id to feature_flags if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'feature_flags'
  ) THEN
    -- Add country_id column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'feature_flags' AND column_name = 'country_id'
    ) THEN
      ALTER TABLE public.feature_flags ADD COLUMN country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_feature_flags_country ON public.feature_flags(country_id);
    END IF;
    
    -- Add org_id column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'feature_flags' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE public.feature_flags ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_feature_flags_org ON public.feature_flags(org_id);
    END IF;
  END IF;
END $$;

-- Function to check if feature is enabled for country/org
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  feature_key TEXT,
  check_country_id UUID DEFAULT NULL,
  check_org_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enabled BOOLEAN;
  country_enabled BOOLEAN;
  org_enabled BOOLEAN;
BEGIN
  -- Check org-level override first (most specific)
  IF check_org_id IS NOT NULL THEN
    SELECT is_enabled INTO org_enabled
    FROM public.feature_flags
    WHERE key = feature_key 
      AND org_id = check_org_id
    ORDER BY updated_at DESC
    LIMIT 1;
    
    IF org_enabled IS NOT NULL THEN
      RETURN org_enabled;
    END IF;
  END IF;
  
  -- Check country-level config
  IF check_country_id IS NOT NULL THEN
    SELECT feature_key = ANY(enabled_features) INTO country_enabled
    FROM public.country_config
    WHERE country_id = check_country_id;
    
    IF country_enabled IS NOT NULL THEN
      RETURN country_enabled;
    END IF;
    
    -- Also check feature_flags table
    SELECT is_enabled INTO country_enabled
    FROM public.feature_flags
    WHERE key = feature_key 
      AND country_id = check_country_id
      AND org_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;
    
    IF country_enabled IS NOT NULL THEN
      RETURN country_enabled;
    END IF;
  END IF;
  
  -- Fall back to global feature flag
  SELECT is_enabled INTO enabled
  FROM public.feature_flags
  WHERE key = feature_key 
    AND country_id IS NULL
    AND org_id IS NULL
  ORDER BY updated_at DESC
  LIMIT 1;
  
  RETURN COALESCE(enabled, false);
END;
$$;

COMMENT ON FUNCTION public.is_feature_enabled(TEXT, UUID, UUID) IS 'Check if feature is enabled at org, country, or global level';

-- =============================================================================
-- 11. REFERENCE TOKEN HELPERS
-- =============================================================================

-- Function to generate country-aware reference token
CREATE OR REPLACE FUNCTION public.generate_reference_token(
  p_country_iso3 TEXT,
  p_district_code TEXT,
  p_sacco_code TEXT,
  p_group_code TEXT,
  p_member_seq INT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN format('%s.%s.%s.%s.%s',
    UPPER(SUBSTRING(p_country_iso3, 1, 3)),
    UPPER(SUBSTRING(p_district_code, 1, 3)),
    UPPER(SUBSTRING(p_sacco_code, 1, 3)),
    UPPER(LPAD(p_group_code, 4, '0')),
    LPAD(p_member_seq::TEXT, 3, '0')
  );
END;
$$;

COMMENT ON FUNCTION public.generate_reference_token(TEXT, TEXT, TEXT, TEXT, INT) IS 'Generate reference token in format COUNTRY3.DISTRICT3.SACCO3.GROUP4.MEMBER3';

-- Function to parse reference token
CREATE OR REPLACE FUNCTION public.parse_reference_token(token TEXT)
RETURNS TABLE (
  country_iso3 TEXT,
  district_code TEXT,
  sacco_code TEXT,
  group_code TEXT,
  member_seq INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  parts TEXT[];
BEGIN
  -- Split token by dots
  parts := string_to_array(token, '.');
  
  -- Check if we have 5 parts (country-aware format)
  IF array_length(parts, 1) = 5 THEN
    RETURN QUERY SELECT 
      parts[1]::TEXT,
      parts[2]::TEXT,
      parts[3]::TEXT,
      parts[4]::TEXT,
      parts[5]::INT;
  -- Check if we have 4 parts (legacy format: DISTRICT.SACCO.GROUP.MEMBER)
  ELSIF array_length(parts, 1) = 4 THEN
    RETURN QUERY SELECT 
      NULL::TEXT,  -- No country in legacy format
      parts[1]::TEXT,
      parts[2]::TEXT,
      parts[3]::TEXT,
      parts[4]::INT;
  ELSE
    RAISE EXCEPTION 'Invalid reference token format: %', token;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.parse_reference_token(TEXT) IS 'Parse reference token into components (supports both country-aware and legacy formats)';

-- =============================================================================
-- 12. GRANT PERMISSIONS
-- =============================================================================

-- Grant SELECT on countries to authenticated users
GRANT SELECT ON public.countries TO authenticated;
GRANT SELECT ON public.telco_providers TO authenticated;
GRANT SELECT ON public.country_config TO authenticated;
GRANT SELECT ON public.partner_config TO authenticated;

-- Grant ALL to service role
GRANT ALL ON public.countries TO service_role;
GRANT ALL ON public.telco_providers TO service_role;
GRANT ALL ON public.country_config TO service_role;
GRANT ALL ON public.partner_config TO service_role;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================


-- From: 20251231100100_seed_countries.sql

-- Seed Countries Data
-- Initial country setup with Rwanda as default market
-- Additional countries can be activated via admin interface

-- =============================================================================
-- 1. INSERT INITIAL COUNTRIES
-- =============================================================================

-- Rwanda (Primary/Default Market)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'RW',
  'RWA',
  'Rwanda',
  'rw-RW',
  'RWF',
  'Africa/Kigali',
  true
)
ON CONFLICT (iso2) DO UPDATE SET
  name = EXCLUDED.name,
  default_locale = EXCLUDED.default_locale,
  currency_code = EXCLUDED.currency_code,
  timezone = EXCLUDED.timezone,
  is_active = EXCLUDED.is_active;

-- Senegal (French-speaking West Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'SN',
  'SEN',
  'Senegal',
  'fr-SN',
  'XOF',
  'Africa/Dakar',
  false  -- Not active by default, enable when ready
)
ON CONFLICT (iso2) DO NOTHING;

-- Côte d'Ivoire (French-speaking West Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'CI',
  'CIV',
  'Côte d''Ivoire',
  'fr-CI',
  'XOF',
  'Africa/Abidjan',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Ghana (English-speaking West Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'GH',
  'GHA',
  'Ghana',
  'en-GH',
  'GHS',
  'Africa/Accra',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Zambia (English-speaking Southern Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'ZM',
  'ZMB',
  'Zambia',
  'en-ZM',
  'ZMW',
  'Africa/Lusaka',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Malawi (English-speaking Southern Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'MW',
  'MWI',
  'Malawi',
  'en-MW',
  'MWK',
  'Africa/Blantyre',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Tanzania (English-speaking East Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'TZ',
  'TZA',
  'Tanzania',
  'en-TZ',
  'TZS',
  'Africa/Dar_es_Salaam',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Burundi (French-speaking Central Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'BI',
  'BDI',
  'Burundi',
  'fr-BI',
  'BIF',
  'Africa/Bujumbura',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- Democratic Republic of Congo (French-speaking Central Africa)
INSERT INTO public.countries (iso2, iso3, name, default_locale, currency_code, timezone, is_active)
VALUES (
  'CD',
  'COD',
  'Democratic Republic of Congo',
  'fr-CD',
  'CDF',
  'Africa/Kinshasa',
  false
)
ON CONFLICT (iso2) DO NOTHING;

-- =============================================================================
-- 2. INSERT RWANDA TELECOM PROVIDERS
-- =============================================================================

-- Get Rwanda country_id
DO $$
DECLARE
  rwanda_id UUID;
BEGIN
  SELECT id INTO rwanda_id FROM public.countries WHERE iso2 = 'RW';
  
  -- MTN Rwanda
  INSERT INTO public.telco_providers (country_id, name, ussd_pattern, merchant_field_name, reference_field_name, notes, is_active)
  VALUES (
    rwanda_id,
    'MTN Rwanda',
    '*182*8*1#',
    'merchant',
    'reference',
    'MTN Mobile Money - Primary provider',
    true
  )
  ON CONFLICT (country_id, name) DO UPDATE SET
    ussd_pattern = EXCLUDED.ussd_pattern,
    is_active = EXCLUDED.is_active;
  
  -- Airtel Rwanda
  INSERT INTO public.telco_providers (country_id, name, ussd_pattern, merchant_field_name, reference_field_name, notes, is_active)
  VALUES (
    rwanda_id,
    'Airtel Rwanda',
    '*500#',
    'merchant',
    'reference',
    'Airtel Money',
    true
  )
  ON CONFLICT (country_id, name) DO NOTHING;
END $$;

-- =============================================================================
-- 3. CREATE RWANDA COUNTRY CONFIGURATION
-- =============================================================================

-- Set up Rwanda country config with telco provider IDs
DO $$
DECLARE
  rwanda_id UUID;
  mtn_id UUID;
  airtel_id UUID;
BEGIN
  SELECT id INTO rwanda_id FROM public.countries WHERE iso2 = 'RW';
  SELECT id INTO mtn_id FROM public.telco_providers WHERE country_id = rwanda_id AND name = 'MTN Rwanda';
  SELECT id INTO airtel_id FROM public.telco_providers WHERE country_id = rwanda_id AND name = 'Airtel Rwanda';
  
  INSERT INTO public.country_config (
    country_id,
    languages,
    enabled_features,
    kyc_required_docs,
    legal_pages,
    telco_ids,
    reference_format,
    number_format
  )
  VALUES (
    rwanda_id,
    ARRAY['rw-RW', 'en-RW', 'fr-RW'],
    ARRAY['USSD', 'OCR', 'SMS_INGEST', 'STATEMENT_UPLOAD', 'MANUAL_ENTRY'],
    jsonb_build_object(
      'NID', true,
      'Selfie', true,
      'ProofOfAddress', false,
      'Passport', false
    ),
    jsonb_build_object(
      'terms', jsonb_build_object(
        'rw-RW', '/legal/terms?lang=rw',
        'en-RW', '/legal/terms?lang=en',
        'fr-RW', '/legal/terms?lang=fr'
      ),
      'privacy', jsonb_build_object(
        'rw-RW', '/legal/privacy?lang=rw',
        'en-RW', '/legal/privacy?lang=en',
        'fr-RW', '/legal/privacy?lang=fr'
      )
    ),
    ARRAY[mtn_id, airtel_id],
    'C3.D3.S3.G4.M3',
    jsonb_build_object(
      'pattern', '^(250)?[0-9]{9}$',
      'prefix', '250',
      'format', '+250 XXX XXX XXX'
    )
  )
  ON CONFLICT (country_id) DO UPDATE SET
    languages = EXCLUDED.languages,
    enabled_features = EXCLUDED.enabled_features,
    kyc_required_docs = EXCLUDED.kyc_required_docs,
    legal_pages = EXCLUDED.legal_pages,
    telco_ids = EXCLUDED.telco_ids,
    reference_format = EXCLUDED.reference_format,
    number_format = EXCLUDED.number_format;
END $$;

-- =============================================================================
-- 4. LINK EXISTING DATA TO RWANDA
-- =============================================================================

-- Update existing organizations to link to Rwanda
DO $$
DECLARE
  rwanda_id UUID;
BEGIN
  SELECT id INTO rwanda_id FROM public.countries WHERE iso2 = 'RW';
  
  -- Update organizations without country_id
  UPDATE public.organizations
  SET country_id = rwanda_id
  WHERE country_id IS NULL;
  
  -- Update app.saccos without country_id (via org_id or directly)
  UPDATE app.saccos s
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.ikimina without country_id
  UPDATE app.ikimina i
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.members without country_id
  UPDATE app.members m
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.payments without country_id
  UPDATE app.payments p
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.import_files without country_id
  UPDATE app.import_files f
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
  
  -- Update app.sms_inbox without country_id
  UPDATE app.sms_inbox s
  SET country_id = rwanda_id
  WHERE country_id IS NULL
    AND (org_id IS NULL OR org_id IN (SELECT id FROM public.organizations WHERE country_id = rwanda_id));
END $$;

-- =============================================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.countries IS 'Supported countries - Rwanda is primary market, others are expansion markets';
COMMENT ON TABLE public.country_config IS 'Country-specific configurations - Rwanda config includes MTN and Airtel providers';

-- =============================================================================
-- END OF SEED MIGRATION
-- =============================================================================


-- From: 20251231110000_ai_embeddings_vector_store.sql

-- Migration: AI Embeddings Vector Store
-- Description: Establishes canonical document & chunk storage for AI agent RAG flows
-- Date: 2025-12-31

create extension if not exists vector;

create table if not exists public.ai_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  source_type text not null check (char_length(source_type) > 0),
  source_uri text,
  title text not null,
  checksum text not null,
  metadata jsonb not null default '{}'::jsonb,
  token_count integer,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_documents_org_checksum_idx
  on public.ai_documents (org_id, checksum);
create index if not exists ai_documents_source_idx
  on public.ai_documents (source_type, created_at desc);

create table if not exists public.ai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  token_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_document_chunks_document_index_idx
  on public.ai_document_chunks (document_id, chunk_index);
create index if not exists ai_document_chunks_created_idx
  on public.ai_document_chunks (created_at desc);
create index if not exists ai_document_chunks_embedding_idx
  on public.ai_document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 200);

create table if not exists public.ai_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.ai_documents(id) on delete cascade,
  source_type text not null,
  source_uri text,
  status text not null check (status in ('pending','processing','completed','failed')) default 'pending',
  metrics jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.ai_reindex_events (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid references auth.users(id),
  reason text,
  target_org uuid,
  job_count integer default 0,
  chunk_count integer default 0,
  created_at timestamptz not null default now()
);

alter table public.ai_documents enable row level security;
alter table public.ai_document_chunks enable row level security;
alter table public.ai_ingestion_jobs enable row level security;
alter table public.ai_reindex_events enable row level security;

create policy "Org members manage AI documents"
  on public.ai_documents
  for all
  using (
    org_id is null and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    or exists (
      select 1 from public.org_memberships om
      where om.org_id = ai_documents.org_id
      and om.user_id = auth.uid()
    )
  )
  with check (
    org_id is null and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    or exists (
      select 1 from public.org_memberships om
      where om.org_id = ai_documents.org_id
      and om.user_id = auth.uid()
    )
  );

create policy "Org members read AI chunks"
  on public.ai_document_chunks
  for select
  using (
    exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_document_chunks.document_id
      and om.user_id = auth.uid()
    )
    or (
      exists (
        select 1 from public.ai_documents d
        where d.id = ai_document_chunks.document_id
        and d.org_id is null
      )
      and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    )
  );

create policy "Org members insert AI chunks"
  on public.ai_document_chunks
  for insert
  with check (
    exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_document_chunks.document_id
      and om.user_id = auth.uid()
    )
    or (
      exists (
        select 1 from public.ai_documents d
        where d.id = ai_document_chunks.document_id
        and d.org_id is null
      )
      and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    )
  );

create policy "Org members update AI chunks"
  on public.ai_document_chunks
  for update
  using (
    exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_document_chunks.document_id
      and om.user_id = auth.uid()
    )
    or (
      exists (
        select 1 from public.ai_documents d
        where d.id = ai_document_chunks.document_id
        and d.org_id is null
      )
      and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    )
  )
  with check (
    exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_document_chunks.document_id
      and om.user_id = auth.uid()
    )
    or (
      exists (
        select 1 from public.ai_documents d
        where d.id = ai_document_chunks.document_id
        and d.org_id is null
      )
      and public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    )
  );

create policy "Org members manage AI ingestion jobs"
  on public.ai_ingestion_jobs
  for all
  using (
    document_id is null
    or exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_ingestion_jobs.document_id
      and om.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  )
  with check (
    document_id is null
    or exists (
      select 1 from public.ai_documents d
      join public.org_memberships om on om.org_id = d.org_id
      where d.id = ai_ingestion_jobs.document_id
      and om.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  );

create policy "Admins manage AI reindex events"
  on public.ai_reindex_events
  for all
  using (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  with check (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

drop trigger if exists ai_documents_updated_at on public.ai_documents;
create trigger ai_documents_updated_at
  before update on public.ai_documents
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists ai_document_chunks_updated_at on public.ai_document_chunks;
create trigger ai_document_chunks_updated_at
  before update on public.ai_document_chunks
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists ai_ingestion_jobs_finished_at on public.ai_ingestion_jobs;
create or replace function public.set_finished_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('completed', 'failed') then
    new.finished_at := coalesce(new.finished_at, now());
  elsif new.status = 'processing' then
    new.finished_at := null;
  end if;
  return new;
end;
$$;

create trigger ai_ingestion_jobs_finished_at
  before update on public.ai_ingestion_jobs
  for each row
  execute function public.set_finished_at_timestamp();

create or replace function public.match_ai_document_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold double precision default 0.68,
  filter_org uuid default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  content text,
  similarity double precision,
  title text,
  source_type text,
  source_uri text,
  metadata jsonb
)
language sql
stable
as $$
  select
    d.id as document_id,
    c.id as chunk_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.title,
    d.source_type,
    d.source_uri,
    d.metadata
  from public.ai_document_chunks c
  join public.ai_documents d on d.id = c.document_id
  where (filter_org is null or d.org_id = filter_org)
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding asc
  limit match_count;
$$;

grant select, insert, update, delete on public.ai_documents to authenticated;
grant select, insert, update, delete on public.ai_document_chunks to authenticated;
grant select, insert, update, delete on public.ai_ingestion_jobs to authenticated;
grant select, insert, update, delete on public.ai_reindex_events to authenticated;
grant all on all tables in schema public to service_role;

grant execute on function public.match_ai_document_chunks(vector, int, double precision, uuid) to authenticated;

grant usage on schema public to authenticated;

comment on table public.ai_documents is 'Source documents tracked for AI embeddings (RAG)';
comment on table public.ai_document_chunks is 'Chunked embeddings stored in pgvector for semantic retrieval';
comment on table public.ai_ingestion_jobs is 'Job log for AI document ingestion and embedding generation';
comment on table public.ai_reindex_events is 'Audit trail for AI embedding reindex operations';
comment on function public.match_ai_document_chunks(vector, int, double precision, uuid) is 'Similarity search helper for AI agent knowledge retrieval';


-- From: 20251231120000_ai_agent_sessions_usage.sql

-- AI Agent operational tables: session storage, usage logging, opt-out registry

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (char_length(channel) <= 50),
  metadata jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now()),
  last_interaction_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_agent_sessions_org on public.agent_sessions(org_id);
create index if not exists idx_agent_sessions_user on public.agent_sessions(user_id);
create index if not exists idx_agent_sessions_expiry on public.agent_sessions(expires_at);

alter table public.agent_sessions enable row level security;

create policy "Service role manages agent sessions"
  on public.agent_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.agent_usage_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.agent_sessions(id) on delete set null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (char_length(channel) <= 50),
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_usd numeric(10,4),
  latency_ms integer,
  success boolean not null default true,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_agent_usage_org on public.agent_usage_events(org_id);
create index if not exists idx_agent_usage_session on public.agent_usage_events(session_id);
create index if not exists idx_agent_usage_created on public.agent_usage_events(created_at desc);

alter table public.agent_usage_events enable row level security;

create policy "Service role logs agent usage"
  on public.agent_usage_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.agent_opt_outs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  channel text,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('UTC', now())
);

create unique index if not exists idx_agent_opt_outs_unique
  on public.agent_opt_outs(org_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'), coalesce(channel, ''));

alter table public.agent_opt_outs enable row level security;

create policy "Service role manages agent opt outs"
  on public.agent_opt_outs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Staff manage org opt outs"
  on public.agent_opt_outs
  for all
  using (
    exists (
      select 1 from public.org_memberships
      where org_memberships.org_id = agent_opt_outs.org_id
      and org_memberships.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.org_memberships
      where org_memberships.org_id = agent_opt_outs.org_id
      and org_memberships.user_id = auth.uid()
    )
  );


-- From: 20251231120000_feature_flag_overrides.sql

-- Feature flag override matrix with country and partner scope

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'feature_flags'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.feature_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT false,
      country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
      org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
      updated_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
      scope_fingerprint TEXT GENERATED ALWAYS AS (
        CASE
          WHEN org_id IS NOT NULL THEN 'org:' || org_id::text
          WHEN country_id IS NOT NULL THEN 'country:' || country_id::text
          ELSE 'global'
        END
      ) STORED
    );
  END IF;
END $$;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feature_flags_pkey'
      AND conrelid = 'public.feature_flags'::regclass
  ) THEN
    ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now());

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now());

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS key TEXT;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.feature_flags
  DROP COLUMN IF EXISTS scope_fingerprint;

ALTER TABLE public.feature_flags
  ADD COLUMN scope_fingerprint TEXT GENERATED ALWAYS AS (
    CASE
      WHEN org_id IS NOT NULL THEN 'org:' || org_id::text
      WHEN country_id IS NOT NULL THEN 'country:' || country_id::text
      ELSE 'global'
    END
  ) STORED;

ALTER TABLE public.feature_flags
  ALTER COLUMN key SET NOT NULL;

DROP INDEX IF EXISTS feature_flags_unique_scope_idx;
ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_unique_scope;
ALTER TABLE public.feature_flags
  ADD CONSTRAINT feature_flags_unique_scope UNIQUE (key, scope_fingerprint);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_feature_flags_country ON public.feature_flags(country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_feature_flags_org ON public.feature_flags(org_id) WHERE org_id IS NOT NULL;

DROP TRIGGER IF EXISTS feature_flags_touch_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_touch_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_select ON public.feature_flags;
DROP POLICY IF EXISTS feature_flags_manage ON public.feature_flags;

CREATE POLICY feature_flags_select
  ON public.feature_flags
  FOR SELECT
  USING (true);

CREATE POLICY feature_flags_manage
  ON public.feature_flags
  FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

COMMENT ON TABLE public.feature_flags IS 'Feature flag overrides across global, country, and partner scopes.';
COMMENT ON COLUMN public.feature_flags.scope_fingerprint IS 'Deterministic scope identifier used for uniqueness checks.';

-- Seed global defaults
INSERT INTO public.feature_flags (key, is_enabled)
VALUES
  ('ai_agent', false),
  ('ussd_copy_first', true),
  ('offers_marketplace', false),
  ('statements_insights', false),
  ('group_join_requests', false)
ON CONFLICT ON CONSTRAINT feature_flags_unique_scope DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    updated_at = timezone('UTC', now()),
    updated_by = NULL;

-- Enable marketplace reporting for Rwanda
INSERT INTO public.feature_flags (key, country_id, is_enabled)
SELECT 'offers_marketplace', id, true
FROM public.countries
WHERE iso3 = 'RWA'
ON CONFLICT ON CONSTRAINT feature_flags_unique_scope DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    updated_at = timezone('UTC', now()),
    updated_by = NULL;

-- Pilot ai_agent experiences for launch tenants
INSERT INTO public.feature_flags (key, org_id, is_enabled)
VALUES
  ('ai_agent', 'd781e07d-189d-44f8-bab6-ca60aae0a4cf', true),
  ('ai_agent', '687f4414-c400-4c73-ad41-82da2f6822f9', true),
  ('ai_agent', 'f27b46ee-24cb-4ca2-acf2-38ca857d406b', true)
ON CONFLICT ON CONSTRAINT feature_flags_unique_scope DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    updated_at = timezone('UTC', now()),
    updated_by = NULL;


-- From: 20260101090000_update_kb_embeddings_and_language.sql

-- Migration: Align knowledge base schemas with text-embedding-3-large
-- Description: Increase embedding dimensions, add language metadata, and expose kb.search helper
-- Date: 2026-01-01

BEGIN;

-- Ensure pgvector is available
CREATE EXTENSION IF NOT EXISTS vector;

-- ===== Update org_kb =====
DROP INDEX IF EXISTS idx_org_kb_embedding;

ALTER TABLE public.org_kb
  ALTER COLUMN embedding TYPE vector(3072)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    WHEN COALESCE(array_length(embedding::float4[], 1), 0) = 3072 THEN embedding
    WHEN COALESCE(array_length(embedding::float4[], 1), 0) > 3072 THEN
      vector((embedding::float4[])[1:3072])
    ELSE
      vector(
        array_cat(
          embedding::float4[],
          array_fill(
            0::float4,
            ARRAY[3072 - COALESCE(array_length(embedding::float4[], 1), 0)]
          )
        )
      )
  END;

-- Add language metadata if missing
ALTER TABLE public.org_kb
  ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT 'en';

UPDATE public.org_kb
SET language_code = COALESCE(NULLIF(language_code, ''), 'en');

ALTER TABLE public.org_kb
  ALTER COLUMN language_code SET NOT NULL;

ALTER TABLE public.org_kb
  ALTER COLUMN language_code DROP DEFAULT;

-- Add uniqueness and lookup helpers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_kb_org_lang_title_key'
  ) THEN
    ALTER TABLE public.org_kb
      ADD CONSTRAINT org_kb_org_lang_title_key UNIQUE (org_id, language_code, title);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_kb_language ON public.org_kb(language_code);

-- Recreate vector index with the new dimension
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_kb_embedding
  ON public.org_kb USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);

COMMENT ON COLUMN public.org_kb.language_code IS 'BCP-47 language tag for localized content (e.g., en, rw, fr).';
COMMENT ON COLUMN public.org_kb.embedding IS '3072-d vector embedding for RAG similarity search (text-embedding-3-large).';

-- ===== Update global_kb =====
DROP INDEX IF EXISTS idx_global_kb_embedding;

ALTER TABLE public.global_kb
  ALTER COLUMN embedding TYPE vector(3072)
  USING CASE
    WHEN embedding IS NULL THEN NULL
    WHEN COALESCE(array_length(embedding::float4[], 1), 0) = 3072 THEN embedding
    WHEN COALESCE(array_length(embedding::float4[], 1), 0) > 3072 THEN
      vector((embedding::float4[])[1:3072])
    ELSE
      vector(
        array_cat(
          embedding::float4[],
          array_fill(
            0::float4,
            ARRAY[3072 - COALESCE(array_length(embedding::float4[], 1), 0)]
          )
        )
      )
  END;

ALTER TABLE public.global_kb
  ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT 'en';

UPDATE public.global_kb
SET language_code = COALESCE(NULLIF(language_code, ''), 'en');

ALTER TABLE public.global_kb
  ALTER COLUMN language_code SET NOT NULL;

ALTER TABLE public.global_kb
  ALTER COLUMN language_code DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'global_kb_lang_title_key'
  ) THEN
    ALTER TABLE public.global_kb
      ADD CONSTRAINT global_kb_lang_title_key UNIQUE (language_code, title);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_global_kb_language ON public.global_kb(language_code);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_global_kb_embedding
  ON public.global_kb USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);

COMMENT ON COLUMN public.global_kb.language_code IS 'BCP-47 language tag for localized content (e.g., en, rw, fr).';
COMMENT ON COLUMN public.global_kb.embedding IS '3072-d vector embedding for RAG similarity search (text-embedding-3-large).';

-- ===== Knowledge base search helper =====
CREATE SCHEMA IF NOT EXISTS kb;

CREATE OR REPLACE FUNCTION kb.search(
  query_embedding vector(3072),
  target_org uuid DEFAULT NULL,
  language_filter text DEFAULT NULL,
  match_limit integer DEFAULT 8,
  min_similarity double precision DEFAULT 0.2
)
RETURNS TABLE (
  source text,
  id uuid,
  org_id uuid,
  language_code text,
  title text,
  content text,
  tags text[],
  policy_tag text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM (
    SELECT
      'org_kb'::text AS source,
      o.id,
      o.org_id,
      o.language_code,
      o.title,
      o.content,
      o.tags,
      o.policy_tag,
      1 - (o.embedding <=> query_embedding) AS similarity
    FROM public.org_kb o
    WHERE (target_org IS NULL OR o.org_id = target_org)
      AND (language_filter IS NULL OR o.language_code = language_filter)

    UNION ALL

    SELECT
      'global_kb'::text AS source,
      g.id,
      NULL::uuid AS org_id,
      g.language_code,
      g.title,
      g.content,
      g.tags,
      g.policy_tag,
      1 - (g.embedding <=> query_embedding) AS similarity
    FROM public.global_kb g
    WHERE (language_filter IS NULL OR g.language_code = language_filter)
  ) AS combined
  WHERE combined.similarity >= min_similarity
  ORDER BY combined.similarity DESC
  LIMIT match_limit;
END;
$$;

COMMENT ON FUNCTION kb.search(vector(3072), uuid, text, integer, double precision)
IS 'Perform cosine-similarity RAG search across org and global knowledge bases.';

GRANT USAGE ON SCHEMA kb TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION kb.search(vector(3072), uuid, text, integer, double precision) TO authenticated, service_role;

COMMIT;


-- From: 20260102090000_tapmomo_merchants_transactions.sql

-- Migration: TapMoMo merchants and transactions tables
-- Description: Stores merchant profiles and transaction reconciliation records for TapMoMo feature
-- Date: 2026-01-02

CREATE TABLE IF NOT EXISTS public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
  merchant_code TEXT NOT NULL,
  secret_key BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, network, merchant_code)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  nonce UUID NOT NULL UNIQUE,
  amount INTEGER,
  currency TEXT NOT NULL DEFAULT 'RWF',
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'failed')),
  payer_hint TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_merchants_user_id ON public.merchants(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_merchants_merchant_code ON public.merchants(merchant_code);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_transactions_merchant_id ON public.transactions(merchant_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_transactions_nonce ON public.transactions(nonce);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own merchants"
  ON public.merchants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own merchants"
  ON public.merchants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own merchants"
  ON public.merchants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own merchants"
  ON public.merchants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view transactions for their merchants"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert transactions"
  ON public.transactions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update transactions"
  ON public.transactions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_merchants_updated_at ON public.merchants;
CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.merchants IS 'Mobile money merchants using TapMoMo';
COMMENT ON TABLE public.transactions IS 'Payment transactions initiated via NFC';
COMMENT ON COLUMN public.merchants.secret_key IS 'HMAC secret for payload signing (encrypted at rest)';
COMMENT ON COLUMN public.transactions.nonce IS 'Unique nonce from payment payload for replay protection';
COMMENT ON COLUMN public.transactions.payer_hint IS 'Optional hint about payer (phone number, name, etc)';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchants TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO service_role;
GRANT SELECT ON public.merchants TO service_role;


-- From: 20260105090000_whatsapp_delivery_events.sql

-- Capture WhatsApp webhook delivery statuses for operational insight.

create table if not exists ops.whatsapp_delivery_events (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,
  status text not null,
  message_timestamp timestamptz not null,
  recipient text,
  conversation_id text,
  conversation_origin text,
  error_code text,
  error_title text,
  error_message text,
  failure_reason text,
  raw_payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ux_whatsapp_delivery_events_dedup
  on ops.whatsapp_delivery_events (message_id, status, message_timestamp);

create index if not exists idx_whatsapp_delivery_events_status
  on ops.whatsapp_delivery_events (status, created_at desc);

comment on table ops.whatsapp_delivery_events is 'WhatsApp Business API webhook delivery telemetry and failure diagnostics.';
comment on column ops.whatsapp_delivery_events.message_id is 'WhatsApp Business API message identifier (wamid.*).';
comment on column ops.whatsapp_delivery_events.status is 'Delivery status reported by Meta (sent, delivered, read, failed, etc.).';
comment on column ops.whatsapp_delivery_events.message_timestamp is 'Timestamp from webhook payload indicating when the status occurred.';
comment on column ops.whatsapp_delivery_events.recipient is 'Recipient phone number reported in the webhook payload.';
comment on column ops.whatsapp_delivery_events.conversation_origin is 'Conversation origin type (e.g., business_initiated, user_initiated).';
comment on column ops.whatsapp_delivery_events.failure_reason is 'Concatenated error titles/messages returned by Meta for failed deliveries.';


-- From: 20260106120000_add_deep_link_resolver.sql

create or replace function public.resolve_deep_link(route text, identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result jsonb;
  group_row record;
  invite_row record;
  identifier_uuid uuid;
begin
  if route = 'join' then
    begin
      identifier_uuid := identifier::uuid;
    exception
      when invalid_text_representation then
        return jsonb_build_object('status', 'not_found', 'type', route);
    end;

    select g.id, g.name, g.status
    into group_row
    from public.ibimina g
    where g.id = identifier_uuid;

    if not found then
      return jsonb_build_object('status', 'not_found', 'type', route);
    end if;

    result := jsonb_build_object(
      'status', coalesce(lower(group_row.status::text), 'unknown'),
      'type', 'join',
      'targetId', group_row.id,
      'groupName', group_row.name,
      'scheme', 'ibimina://join/' || group_row.id
    );

    return result;
  elsif route = 'invite' then
    select gi.id, gi.token, gi.status, gi.group_id, ig.name as group_name
    into invite_row
    from public.group_invites gi
    left join public.ibimina ig on ig.id = gi.group_id
    where gi.token = identifier;

    if not found then
      return jsonb_build_object('status', 'not_found', 'type', route);
    end if;

    result := jsonb_build_object(
      'status', coalesce(lower(invite_row.status::text), 'unknown'),
      'type', 'invite',
      'targetId', invite_row.group_id,
      'groupName', invite_row.group_name,
      'token', invite_row.token,
      'scheme', 'ibimina://invite/' || invite_row.token
    );

    return result;
  else
    return jsonb_build_object('status', 'unsupported', 'type', route);
  end if;
end;
$$;

revoke all on function public.resolve_deep_link(text, text) from public;

grant execute on function public.resolve_deep_link(text, text) to anon;
grant execute on function public.resolve_deep_link(text, text) to authenticated;
grant execute on function public.resolve_deep_link(text, text) to service_role;


-- From: 20260106121500_create_allocation_export_requests.sql

create schema if not exists app;

create table if not exists app.allocation_export_requests (
  id uuid primary key default gen_random_uuid(),
  sacco_id uuid references public.saccos(id) on delete set null,
  reference_token text,
  period_label text,
  status text not null default 'queued',
  requested_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  result_url text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

comment on table app.allocation_export_requests is 'Queue of allocation export jobs triggered from the staff workspace.';
comment on column app.allocation_export_requests.reference_token is 'Reference token filter applied to the export, if provided.';
comment on column app.allocation_export_requests.period_label is 'Human readable label for the export window.';

create index if not exists idx_allocation_export_status on app.allocation_export_requests(status);
create index if not exists idx_allocation_export_requested_by on app.allocation_export_requests(requested_by);

alter table app.allocation_export_requests enable row level security;

create policy allocation_export_insert_service
  on app.allocation_export_requests
  for insert
  using (auth.role() = 'service_role')
  with check (true);

create policy allocation_export_select_requester
  on app.allocation_export_requests
  for select
  using (
    auth.role() = 'service_role'
    or (requested_by is not null and requested_by = auth.uid())
  );

create policy allocation_export_update_service
  on app.allocation_export_requests
  for update
  using (auth.role() = 'service_role');


-- From: 20260110090000_ai_agent_sessions_usage.sql

-- AI Agent operational tables: session storage, usage logging, opt-out registry

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (char_length(channel) <= 50),
  metadata jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now()),
  last_interaction_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_agent_sessions_org on public.agent_sessions(org_id);
create index if not exists idx_agent_sessions_user on public.agent_sessions(user_id);
create index if not exists idx_agent_sessions_expiry on public.agent_sessions(expires_at);

alter table public.agent_sessions enable row level security;

create policy "Service role manages agent sessions"
  on public.agent_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.agent_usage_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.agent_sessions(id) on delete set null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  channel text not null check (char_length(channel) <= 50),
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_usd numeric(10,4),
  latency_ms integer,
  success boolean not null default true,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_agent_usage_org on public.agent_usage_events(org_id);
create index if not exists idx_agent_usage_session on public.agent_usage_events(session_id);
create index if not exists idx_agent_usage_created on public.agent_usage_events(created_at desc);

alter table public.agent_usage_events enable row level security;

create policy "Service role logs agent usage"
  on public.agent_usage_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.agent_opt_outs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  channel text,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('UTC', now())
);

create unique index if not exists idx_agent_opt_outs_unique
  on public.agent_opt_outs(org_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'), coalesce(channel, ''));

alter table public.agent_opt_outs enable row level security;

create policy "Service role manages agent opt outs"
  on public.agent_opt_outs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Staff manage org opt outs"
  on public.agent_opt_outs
  for all
  using (
    exists (
      select 1 from public.org_memberships
      where org_memberships.org_id = agent_opt_outs.org_id
      and org_memberships.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.org_memberships
      where org_memberships.org_id = agent_opt_outs.org_id
      and org_memberships.user_id = auth.uid()
    )
  );


-- From: 20260112090000_country_trigger_enhancements.sql

-- Ensure country_id propagation stays in sync when records are updated
create or replace function public.set_group_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select country_id into v_country from public.organizations where id = new.org_id;

  if v_country is null then
    raise exception 'Organization % missing country context for group', new.org_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_groups_country on public.groups;
create trigger trg_groups_country
before insert or update on public.groups
for each row execute function public.set_group_country();

create or replace function public.set_group_member_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select g.country_id into v_country from public.groups g where g.id = new.group_id;

  if v_country is null then
    raise exception 'Group % missing country context for member trigger', new.group_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_group_members_country on public.group_members;
create trigger trg_group_members_country
before insert or update on public.group_members
for each row execute function public.set_group_member_country();

create or replace function public.set_upload_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select country_id into v_country from public.organizations where id = new.org_id;

  if v_country is null then
    raise exception 'Organization % missing country context for upload', new.org_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_uploads_country on public.uploads;
create trigger trg_uploads_country
before insert or update on public.uploads
for each row execute function public.set_upload_country();

create or replace function public.set_allocation_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select country_id into v_country from public.organizations where id = new.org_id;

  if v_country is null then
    raise exception 'Organization % missing country context for allocation', new.org_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_allocations_country on public.allocations;
create trigger trg_allocations_country
before insert or update on public.allocations
for each row execute function public.set_allocation_country();

create or replace function public.set_ticket_country()
returns trigger
language plpgsql
as $$
declare
  v_country uuid;
begin
  select country_id into v_country from public.organizations where id = new.org_id;

  if v_country is null then
    raise exception 'Organization % missing country context for ticket', new.org_id;
  end if;

  new.country_id := v_country;
  return new;
end;
$$;

drop trigger if exists trg_tickets_country on public.tickets;
create trigger trg_tickets_country
before insert or update on public.tickets
for each row execute function public.set_ticket_country();

-- Ticket messages capture threaded communication with the same country/org context as tickets
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  country_id uuid not null references public.countries(id),
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('UTC', now()),
  updated_at timestamptz not null default timezone('UTC', now())
);

create index if not exists idx_ticket_messages_ticket on public.ticket_messages(ticket_id);
create index if not exists idx_ticket_messages_org on public.ticket_messages(org_id);
create index if not exists idx_ticket_messages_country on public.ticket_messages(country_id);
create index if not exists idx_ticket_messages_author on public.ticket_messages(author_id);

create or replace function public.set_ticket_message_context()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
  v_country uuid;
begin
  select org_id, country_id into v_org, v_country from public.tickets where id = new.ticket_id;

  if v_org is null then
    raise exception 'Ticket % missing organization context for message', new.ticket_id;
  end if;

  new.org_id := v_org;
  new.country_id := v_country;

  if new.author_id is null then
    new.author_id := auth.uid();
  end if;

  new.updated_at := timezone('UTC', now());
  return new;
end;
$$;

drop trigger if exists trg_ticket_messages_context on public.ticket_messages;
create trigger trg_ticket_messages_context
before insert or update on public.ticket_messages
for each row execute function public.set_ticket_message_context();

create or replace function public.refresh_ticket_message_context()
returns trigger
language plpgsql
as $$
begin
  if (new.org_id is distinct from old.org_id) or (new.country_id is distinct from old.country_id) then
    update public.ticket_messages
    set
      org_id = new.org_id,
      country_id = new.country_id,
      updated_at = timezone('UTC', now())
    where ticket_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ticket_message_ticket_context on public.tickets;
create trigger trg_ticket_message_ticket_context
after update on public.tickets
for each row execute function public.refresh_ticket_message_context();

alter table public.ticket_messages enable row level security;

create policy ticket_messages_staff_rw on public.ticket_messages
for all using (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
) with check (
  country_id in (select public.user_country_ids())
  and org_id in (select public.user_org_ids())
  and author_id = auth.uid()
);

create policy ticket_messages_user_read on public.ticket_messages
for select using (
  ticket_id in (
    select id from public.tickets where user_id = auth.uid()
  )
);

create policy ticket_messages_user_insert on public.ticket_messages
for insert with check (
  author_id = auth.uid()
  and ticket_id in (
    select id from public.tickets where user_id = auth.uid()
  )
);


-- From: 20260215090000_agent_functions.sql

-- Agent RPC functions for OpenAI Responses integration
-- Provides scoped access to knowledge base, allocations, reference tokens, and ticket creation.

SET search_path TO public;

-- Helper: assert whether a user can access an organisation
CREATE OR REPLACE FUNCTION public.agent_assert_org_access(p_user UUID, p_org UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  has_membership BOOLEAN := FALSE;
BEGIN
  IF p_org IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT TRUE
    INTO has_membership
  FROM public.org_memberships om
  WHERE om.user_id = p_user
    AND om.org_id = p_org
  LIMIT 1;

  IF has_membership THEN
    RETURN TRUE;
  END IF;

  SELECT TRUE
    INTO has_membership
  FROM public.user_saccos us
  JOIN public.saccos s
    ON s.id = us.sacco_id
  WHERE us.user_id = p_user
    AND s.org_id = p_org
  LIMIT 1;

  RETURN COALESCE(has_membership, FALSE);
END;
$$;

COMMENT ON FUNCTION public.agent_assert_org_access IS 'Return true when the user has membership to the provided organisation.';

-- Resolve effective organisation scope for a user
CREATE OR REPLACE FUNCTION public.agent_resolve_org_scope(p_user UUID, p_org UUID)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  country_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  target_org UUID;
BEGIN
  IF p_org IS NOT NULL AND public.agent_assert_org_access(p_user, p_org) THEN
    target_org := p_org;
  ELSE
    SELECT om.org_id
      INTO target_org
    FROM public.org_memberships om
    WHERE om.user_id = p_user
    ORDER BY om.created_at
    LIMIT 1;

    IF target_org IS NULL THEN
      SELECT s.org_id
        INTO target_org
      FROM public.user_saccos us
      JOIN public.saccos s
        ON s.id = us.sacco_id
      WHERE us.user_id = p_user
      ORDER BY us.created_at
      LIMIT 1;
    END IF;
  END IF;

  IF target_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT o.id,
         o.name,
         COALESCE(c.iso2, c.iso3, 'RW')
  FROM public.organizations o
  LEFT JOIN public.countries c
    ON c.id = o.country_id
  WHERE o.id = target_org;
END;
$$;

COMMENT ON FUNCTION public.agent_resolve_org_scope IS 'Resolve the organisation (and country) a user is scoped to for agent requests.';

-- Knowledge base semantic search (org + global)
CREATE OR REPLACE FUNCTION public.agent_kb_search(
  p_user UUID,
  query_embedding vector,
  query_text TEXT,
  target_org UUID DEFAULT NULL,
  language_filter TEXT DEFAULT NULL,
  match_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  source TEXT,
  record_id UUID,
  org_id UUID,
  title TEXT,
  content TEXT,
  language_code TEXT,
  similarity DOUBLE PRECISION,
  tags TEXT[],
  policy_tag TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_org UUID;
  limit_rows INTEGER := GREATEST(1, LEAST(COALESCE(match_limit, 5), 20));
BEGIN
  IF query_embedding IS NULL THEN
    RAISE EXCEPTION 'query_embedding is required';
  END IF;

  SELECT scope.org_id
    INTO effective_org
  FROM public.agent_resolve_org_scope(p_user, target_org) AS scope
  LIMIT 1;

  RETURN QUERY
  WITH org_matches AS (
    SELECT
      'org_kb'::TEXT AS source,
      o.id AS record_id,
      o.org_id,
      o.title,
      o.content,
      o.language_code,
      1 - (o.embedding <=> query_embedding) AS similarity,
      o.tags,
      o.policy_tag
    FROM public.org_kb o
    WHERE o.embedding IS NOT NULL
      AND effective_org IS NOT NULL
      AND o.org_id = effective_org
      AND (language_filter IS NULL OR o.language_code = language_filter)
    ORDER BY o.embedding <=> query_embedding
    LIMIT limit_rows
  ),
  global_matches AS (
    SELECT
      'global_kb'::TEXT AS source,
      g.id AS record_id,
      NULL::UUID AS org_id,
      g.title,
      g.content,
      g.language_code,
      1 - (g.embedding <=> query_embedding) AS similarity,
      g.tags,
      g.policy_tag
    FROM public.global_kb g
    WHERE g.embedding IS NOT NULL
      AND (language_filter IS NULL OR g.language_code = language_filter)
    ORDER BY g.embedding <=> query_embedding
    LIMIT limit_rows
  ),
  lexical_matches AS (
    SELECT
      'org_kb'::TEXT AS source,
      o.id AS record_id,
      o.org_id,
      o.title,
      o.content,
      o.language_code,
      LEAST(0.75, ts_rank_cd(to_tsvector('simple', o.content), plainto_tsquery('simple', query_text))) AS similarity,
      o.tags,
      o.policy_tag
    FROM public.org_kb o
    WHERE effective_org IS NOT NULL
      AND o.org_id = effective_org
      AND query_text IS NOT NULL
      AND query_text <> ''
    ORDER BY similarity DESC
    LIMIT 3
  ),
  combined AS (
    SELECT * FROM org_matches
    UNION ALL
    SELECT * FROM global_matches
    UNION ALL
    SELECT * FROM lexical_matches
  )
  SELECT
    source,
    record_id,
    org_id,
    title,
    content,
    language_code,
    similarity,
    tags,
    policy_tag
  FROM combined
  ORDER BY similarity DESC
  LIMIT limit_rows;
END;
$$;

COMMENT ON FUNCTION public.agent_kb_search IS 'Return the most relevant knowledge base articles for an agent prompt.';

-- Ensure member_reference_tokens exists for reference generation
CREATE TABLE IF NOT EXISTS public.member_reference_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id UUID,
  token TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'app',
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_member_reference_tokens_user ON public.member_reference_tokens(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_member_reference_tokens_org ON public.member_reference_tokens(org_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_member_reference_tokens_expires ON public.member_reference_tokens(expires_at);

ALTER TABLE public.member_reference_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'member_reference_tokens'
      AND policyname = 'members_can_read_own_reference_tokens'
  ) THEN
    CREATE POLICY members_can_read_own_reference_tokens
      ON public.member_reference_tokens
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allocation lookup for the authenticated user
CREATE OR REPLACE FUNCTION public.agent_allocations_read_mine(
  p_user UUID,
  p_reference_token TEXT,
  p_org UUID DEFAULT NULL,
  p_include_pending BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  allocation_id UUID,
  org_id UUID,
  amount NUMERIC,
  status TEXT,
  allocated_at TIMESTAMPTZ,
  group_name TEXT,
  reference TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  effective_org UUID;
  limit_rows INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
  normalized_ref TEXT := NULLIF(trim(p_reference_token), '');
  is_authorized BOOLEAN;
BEGIN
  IF normalized_ref IS NULL THEN
    RAISE EXCEPTION 'reference_token is required';
  END IF;

  SELECT scope.org_id
    INTO effective_org
  FROM public.agent_resolve_org_scope(p_user, p_org) AS scope
  LIMIT 1;

  IF effective_org IS NULL THEN
    RAISE EXCEPTION 'org_scope_not_found';
  END IF;

  is_authorized := public.agent_assert_org_access(p_user, effective_org);
  IF NOT is_authorized THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  RETURN QUERY
  SELECT
    a.id AS allocation_id,
    a.org_id,
    a.amount,
    a.match_status AS status,
    a.ts AS allocated_at,
    COALESCE(a.decoded_group, a.sacco_name, 'Unknown group') AS group_name,
    COALESCE(a.raw_ref, a.decoded_member, normalized_ref) AS reference
  FROM public.allocations a
  WHERE a.org_id = effective_org
    AND (
      a.raw_ref = normalized_ref
      OR a.decoded_member = normalized_ref
      OR a.decoded_group = normalized_ref
    )
    AND (
      p_include_pending
      OR LOWER(COALESCE(a.match_status, '')) IN ('allocated', 'posted', 'confirmed', 'matched')
    )
  ORDER BY a.ts DESC
  LIMIT limit_rows;
END;
$$;

COMMENT ON FUNCTION public.agent_allocations_read_mine IS 'Fetch allocation rows for the member reference token within the scoped organisation.';

-- Generate reference token scoped to organisation and country
CREATE OR REPLACE FUNCTION public.agent_reference_generate(
  p_user UUID,
  p_org UUID,
  p_channel TEXT DEFAULT 'app',
  p_purpose TEXT,
  p_member_id UUID DEFAULT NULL,
  p_expires_in_minutes INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  token TEXT,
  expires_at TIMESTAMPTZ,
  channel TEXT,
  purpose TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  effective_org UUID;
  country_id UUID;
  country_iso3 TEXT := 'RWA';
  district_code TEXT := 'GEN';
  sacco_code TEXT := 'ORG';
  group_code TEXT;
  member_seq INT;
  expires TIMESTAMPTZ;
  cleaned_name TEXT;
  parent_org UUID;
  attempt INT := 0;
  new_token TEXT;
BEGIN
  IF p_purpose IS NULL OR trim(p_purpose) = '' THEN
    RAISE EXCEPTION 'purpose is required';
  END IF;

  SELECT scope.org_id
    INTO effective_org
  FROM public.agent_resolve_org_scope(p_user, p_org) AS scope
  LIMIT 1;

  IF effective_org IS NULL THEN
    RAISE EXCEPTION 'org_scope_not_found';
  END IF;

  IF NOT public.agent_assert_org_access(p_user, effective_org) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  SELECT o.country_id, o.parent_id, o.name
    INTO country_id, parent_org, cleaned_name
  FROM public.organizations o
  LEFT JOIN public.countries c
    ON c.id = o.country_id
  WHERE o.id = effective_org;

  IF country_id IS NOT NULL THEN
    SELECT COALESCE(c.iso3, 'RWA')
      INTO country_iso3
    FROM public.countries c
    WHERE c.id = country_id
    LIMIT 1;
  END IF;

  IF parent_org IS NOT NULL THEN
    SELECT LEFT(COALESCE(parent.district_code, 'GEN'), 3)
      INTO district_code
    FROM public.organizations parent
    WHERE parent.id = parent_org;
  END IF;

  cleaned_name := REGEXP_REPLACE(COALESCE(cleaned_name, 'ORG'), '[^A-Za-z0-9]', '', 'g');
  sacco_code := UPPER(LPAD(SUBSTRING(cleaned_name FROM 1 FOR 3), 3, 'X'));

  expires := timezone('UTC', now())
    + COALESCE(
      CASE
        WHEN p_expires_in_minutes IS NULL THEN NULL
        ELSE make_interval(mins => p_expires_in_minutes)
      END,
      interval '240 minutes'
    );

  LOOP
    attempt := attempt + 1;
    group_code := LPAD(SUBSTRING(md5(random()::TEXT) FROM 1 FOR 4), 4, '0');
    member_seq := FLOOR(random() * 900)::INT + 100;

    new_token := public.generate_reference_token(
      country_iso3,
      UPPER(SUBSTRING(district_code FROM 1 FOR 3)),
      sacco_code,
      group_code,
      member_seq
    );

    BEGIN
      INSERT INTO public.member_reference_tokens (
        org_id,
        user_id,
        member_id,
        token,
        channel,
        purpose,
        expires_at,
        notes,
        metadata,
        created_by
      )
      VALUES (
        effective_org,
        p_user,
        p_member_id,
        new_token,
        LOWER(COALESCE(p_channel, 'app')),
        p_purpose,
        expires,
        p_notes,
        jsonb_build_object('generated_by_agent', TRUE),
        p_user
      );
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        EXIT WHEN attempt > 5;
    END;
  END LOOP;

  IF attempt > 5 THEN
    RAISE EXCEPTION 'reference_token_generation_failed';
  END IF;

  RETURN QUERY SELECT new_token, expires, LOWER(COALESCE(p_channel, 'app')), p_purpose;
END;
$$;

COMMENT ON FUNCTION public.agent_reference_generate IS 'Generate a scoped reference token and persist it for the member.';

-- Ticket creation helper for the agent
CREATE OR REPLACE FUNCTION public.agent_tickets_create(
  p_user UUID,
  p_org UUID,
  p_subject TEXT,
  p_summary TEXT,
  p_channel TEXT DEFAULT 'in_app',
  p_priority TEXT DEFAULT 'normal',
  p_reference_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  ticket_id UUID,
  org_id UUID,
  reference TEXT,
  status TEXT,
  submitted_at TIMESTAMPTZ,
  summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  effective_org UUID;
  created_ticket UUID;
  status_value TEXT;
  created_at_ts TIMESTAMPTZ;
BEGIN
  IF p_subject IS NULL OR trim(p_subject) = '' THEN
    RAISE EXCEPTION 'subject is required';
  END IF;
  IF p_summary IS NULL OR trim(p_summary) = '' THEN
    RAISE EXCEPTION 'summary is required';
  END IF;

  SELECT scope.org_id
    INTO effective_org
  FROM public.agent_resolve_org_scope(p_user, p_org) AS scope
  LIMIT 1;

  IF effective_org IS NULL THEN
    RAISE EXCEPTION 'org_scope_not_found';
  END IF;

  IF NOT public.agent_assert_org_access(p_user, effective_org) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  INSERT INTO public.tickets (
    org_id,
    user_id,
    channel,
    subject,
    priority,
    status,
    meta
  )
  VALUES (
    effective_org,
    p_user,
    LOWER(COALESCE(p_channel, 'in_app')),
    p_subject,
    LOWER(COALESCE(p_priority, 'normal')),
    'open',
    jsonb_build_object('reference_token', p_reference_token)
  )
  RETURNING id, status, created_at INTO created_ticket, status_value, created_at_ts;

  RETURN QUERY
  SELECT
    created_ticket,
    effective_org,
    COALESCE(p_reference_token, created_ticket::TEXT),
    status_value,
    created_at_ts,
    p_summary;
END;
$$;

COMMENT ON FUNCTION public.agent_tickets_create IS 'Create a ticket for the scoped organisation on behalf of the authenticated user.';

GRANT EXECUTE ON FUNCTION public.agent_resolve_org_scope(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_kb_search(UUID, vector, TEXT, UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_allocations_read_mine(UUID, TEXT, UUID, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_reference_generate(UUID, UUID, TEXT, TEXT, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_tickets_create(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- From: 20260301000000_tapmomo_system.sql

-- TapMoMo NFC Payment System
-- Schema for merchants, transactions, and reconciliation

-- Merchants table (stores merchant configurations and HMAC keys)
CREATE TABLE IF NOT EXISTS app.tapmomo_merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- staff member who registered this merchant
    merchant_code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
    secret_key BYTEA NOT NULL, -- HMAC secret key for payload signing
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Transactions table (tracks all TapMoMo payment attempts)
CREATE TABLE IF NOT EXISTS app.tapmomo_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES app.tapmomo_merchants(id) ON DELETE CASCADE,
    sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
    nonce UUID NOT NULL UNIQUE, -- From payload; prevents replay attacks
    amount INTEGER, -- In minor units (e.g., 2500 = 25.00 RWF)
    currency TEXT NOT NULL DEFAULT 'RWF',
    ref TEXT, -- Optional reference from merchant
    network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (
        status IN ('initiated', 'pending', 'settled', 'failed', 'expired')
    ),
    payer_hint TEXT, -- Phone number or identifier of payer
    error_message TEXT,
    payload_ts TIMESTAMPTZ NOT NULL, -- Timestamp from the NFC payload
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL, -- Based on TTL in payload
    payment_id UUID REFERENCES app.payments(id), -- Link to reconciled payment
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_merchants_sacco_idx ON app.tapmomo_merchants(sacco_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_merchants_code_idx ON app.tapmomo_merchants(merchant_code);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_merchants_network_idx ON app.tapmomo_merchants(network) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_merchant_idx ON app.tapmomo_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_sacco_idx ON app.tapmomo_transactions(sacco_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_status_idx ON app.tapmomo_transactions(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_created_idx ON app.tapmomo_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_nonce_idx ON app.tapmomo_transactions(nonce);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_payment_idx ON app.tapmomo_transactions(payment_id) WHERE payment_id IS NOT NULL;

-- Function to auto-expire old transactions
CREATE OR REPLACE FUNCTION app.expire_tapmomo_transactions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE app.tapmomo_transactions
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'initiated'
        AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule expiration job (runs every 5 minutes)
SELECT cron.schedule(
    'expire-tapmomo-transactions',
    '*/5 * * * *',
    $$
    SELECT app.expire_tapmomo_transactions();
    $$
);

-- Function to generate merchant secret key
CREATE OR REPLACE FUNCTION app.generate_merchant_secret()
RETURNS BYTEA AS $$
BEGIN
    RETURN gen_random_bytes(32);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a TapMoMo transaction
CREATE OR REPLACE FUNCTION app.create_tapmomo_transaction(
    p_merchant_id UUID,
    p_nonce UUID,
    p_amount INTEGER,
    p_currency TEXT,
    p_ref TEXT,
    p_network TEXT,
    p_payload_ts TIMESTAMPTZ,
    p_ttl_seconds INTEGER DEFAULT 120
)
RETURNS UUID AS $$
DECLARE
    v_sacco_id UUID;
    v_transaction_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Get sacco_id from merchant
    SELECT sacco_id INTO v_sacco_id
    FROM app.tapmomo_merchants
    WHERE id = p_merchant_id AND is_active = true;
    
    IF v_sacco_id IS NULL THEN
        RAISE EXCEPTION 'Merchant not found or inactive';
    END IF;
    
    v_expires_at := p_payload_ts + (p_ttl_seconds || ' seconds')::INTERVAL;
    
    -- Create transaction
    INSERT INTO app.tapmomo_transactions (
        merchant_id,
        sacco_id,
        nonce,
        amount,
        currency,
        ref,
        network,
        status,
        payload_ts,
        expires_at
    ) VALUES (
        p_merchant_id,
        v_sacco_id,
        p_nonce,
        p_amount,
        p_currency,
        p_ref,
        p_network,
        'initiated',
        p_payload_ts,
        v_expires_at
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE app.tapmomo_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tapmomo_transactions ENABLE ROW LEVEL SECURITY;

-- Merchants: staff can view merchants for their SACCO
CREATE POLICY tapmomo_merchants_select_policy ON app.tapmomo_merchants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND (sp.sacco_id = tapmomo_merchants.sacco_id OR sp.role = 'admin')
        )
    );

-- Merchants: admin staff can insert merchants
CREATE POLICY tapmomo_merchants_insert_policy ON app.tapmomo_merchants
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_merchants.sacco_id
                AND sp.role IN ('admin', 'manager')
        )
    );

-- Merchants: admin staff can update merchants
CREATE POLICY tapmomo_merchants_update_policy ON app.tapmomo_merchants
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_merchants.sacco_id
                AND sp.role IN ('admin', 'manager')
        )
    );

-- Transactions: staff can view transactions for their SACCO
CREATE POLICY tapmomo_transactions_select_policy ON app.tapmomo_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND (sp.sacco_id = tapmomo_transactions.sacco_id OR sp.role = 'admin')
        )
    );

-- Transactions: staff can insert transactions
CREATE POLICY tapmomo_transactions_insert_policy ON app.tapmomo_transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_transactions.sacco_id
        )
    );

-- Transactions: staff can update transactions for their SACCO
CREATE POLICY tapmomo_transactions_update_policy ON app.tapmomo_transactions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_transactions.sacco_id
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON app.tapmomo_merchants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app.tapmomo_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION app.expire_tapmomo_transactions() TO service_role;
GRANT EXECUTE ON FUNCTION app.generate_merchant_secret() TO authenticated;
GRANT EXECUTE ON FUNCTION app.create_tapmomo_transaction(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) TO authenticated;

-- Create view for transaction summary
CREATE OR REPLACE VIEW app.tapmomo_transaction_summary AS
SELECT
    t.id,
    t.merchant_id,
    t.sacco_id,
    t.nonce,
    t.amount,
    t.currency,
    t.ref,
    t.network,
    t.status,
    t.payer_hint,
    t.payload_ts,
    t.initiated_at,
    t.settled_at,
    t.expires_at,
    t.payment_id,
    m.merchant_code,
    m.display_name AS merchant_name,
    p.reference AS payment_reference,
    p.status AS payment_status,
    s.name AS sacco_name
FROM app.tapmomo_transactions t
JOIN app.tapmomo_merchants m ON t.merchant_id = m.id
LEFT JOIN app.payments p ON t.payment_id = p.id
LEFT JOIN app.saccos s ON t.sacco_id = s.id;

GRANT SELECT ON app.tapmomo_transaction_summary TO authenticated;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION app.update_tapmomo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tapmomo_merchants_updated_at
    BEFORE UPDATE ON app.tapmomo_merchants
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

CREATE TRIGGER tapmomo_transactions_updated_at
    BEFORE UPDATE ON app.tapmomo_transactions
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

-- Comments for documentation
COMMENT ON TABLE app.tapmomo_merchants IS 'TapMoMo merchant configurations with HMAC keys for NFC payment validation';
COMMENT ON TABLE app.tapmomo_transactions IS 'TapMoMo payment transactions initiated via NFC tap';
COMMENT ON FUNCTION app.expire_tapmomo_transactions() IS 'Automatically expire TapMoMo transactions past their TTL';
COMMENT ON FUNCTION app.create_tapmomo_transaction(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) IS 'Create a new TapMoMo transaction with validation';


-- From: 20260303000000_apply_tapmomo_conditional.sql

-- Conditional TapMoMo System Application
-- Only applies if tables don't exist

-- Merchants table (stores merchant configurations and HMAC keys)
CREATE TABLE IF NOT EXISTS app.tapmomo_merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- staff member who registered this merchant
    merchant_code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
    secret_key BYTEA NOT NULL, -- HMAC secret key for payload signing
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Transactions table (tracks all TapMoMo payment attempts)
CREATE TABLE IF NOT EXISTS app.tapmomo_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES app.tapmomo_merchants(id) ON DELETE CASCADE,
    sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
    nonce UUID NOT NULL UNIQUE, -- From payload; prevents replay attacks
    amount INTEGER, -- In minor units (e.g., 2500 = 25.00 RWF)
    currency TEXT NOT NULL DEFAULT 'RWF',
    ref TEXT, -- Optional reference from merchant
    network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (
        status IN ('initiated', 'pending', 'settled', 'failed', 'expired')
    ),
    payer_hint TEXT, -- Phone number or identifier of payer
    error_message TEXT,
    payload_ts TIMESTAMPTZ NOT NULL, -- Timestamp from the NFC payload
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL, -- Based on TTL in payload
    payment_id UUID REFERENCES app.payments(id), -- Link to reconciled payment
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_merchants_sacco_idx ON app.tapmomo_merchants(sacco_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_merchants_code_idx ON app.tapmomo_merchants(merchant_code);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_merchants_network_idx ON app.tapmomo_merchants(network) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_merchant_idx ON app.tapmomo_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_sacco_idx ON app.tapmomo_transactions(sacco_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_status_idx ON app.tapmomo_transactions(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_created_idx ON app.tapmomo_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_nonce_idx ON app.tapmomo_transactions(nonce);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS tapmomo_transactions_payment_idx ON app.tapmomo_transactions(payment_id) WHERE payment_id IS NOT NULL;

-- Function to auto-expire old transactions
CREATE OR REPLACE FUNCTION app.expire_tapmomo_transactions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE app.tapmomo_transactions
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'initiated'
        AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule expiration job (runs every 5 minutes) - conditional
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'expire-tapmomo-transactions'
    ) THEN
        PERFORM cron.schedule(
            'expire-tapmomo-transactions',
            '*/5 * * * *',
            $$
            SELECT app.expire_tapmomo_transactions();
            $$
        );
    END IF;
END$$;

-- Function to generate merchant secret key
CREATE OR REPLACE FUNCTION app.generate_merchant_secret()
RETURNS BYTEA AS $$
BEGIN
    RETURN gen_random_bytes(32);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a TapMoMo transaction
CREATE OR REPLACE FUNCTION app.create_tapmomo_transaction(
    p_merchant_id UUID,
    p_nonce UUID,
    p_amount INTEGER,
    p_currency TEXT,
    p_ref TEXT,
    p_network TEXT,
    p_payload_ts TIMESTAMPTZ,
    p_ttl_seconds INTEGER DEFAULT 120
)
RETURNS UUID AS $$
DECLARE
    v_sacco_id UUID;
    v_transaction_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Get sacco_id from merchant
    SELECT sacco_id INTO v_sacco_id
    FROM app.tapmomo_merchants
    WHERE id = p_merchant_id AND is_active = true;
    
    IF v_sacco_id IS NULL THEN
        RAISE EXCEPTION 'Merchant not found or inactive';
    END IF;
    
    v_expires_at := p_payload_ts + (p_ttl_seconds || ' seconds')::INTERVAL;
    
    -- Create transaction
    INSERT INTO app.tapmomo_transactions (
        merchant_id,
        sacco_id,
        nonce,
        amount,
        currency,
        ref,
        network,
        status,
        payload_ts,
        expires_at
    ) VALUES (
        p_merchant_id,
        v_sacco_id,
        p_nonce,
        p_amount,
        p_currency,
        p_ref,
        p_network,
        'initiated',
        p_payload_ts,
        v_expires_at
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE app.tapmomo_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tapmomo_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tapmomo_merchants_select_policy ON app.tapmomo_merchants;
DROP POLICY IF EXISTS tapmomo_merchants_insert_policy ON app.tapmomo_merchants;
DROP POLICY IF EXISTS tapmomo_merchants_update_policy ON app.tapmomo_merchants;
DROP POLICY IF EXISTS tapmomo_transactions_select_policy ON app.tapmomo_transactions;
DROP POLICY IF EXISTS tapmomo_transactions_insert_policy ON app.tapmomo_transactions;
DROP POLICY IF EXISTS tapmomo_transactions_update_policy ON app.tapmomo_transactions;

-- Merchants: staff can view merchants for their SACCO
CREATE POLICY tapmomo_merchants_select_policy ON app.tapmomo_merchants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND (sp.sacco_id = tapmomo_merchants.sacco_id OR sp.role = 'admin')
        )
    );

-- Merchants: admin staff can insert merchants
CREATE POLICY tapmomo_merchants_insert_policy ON app.tapmomo_merchants
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_merchants.sacco_id
                AND sp.role IN ('admin', 'manager')
        )
    );

-- Merchants: admin staff can update merchants
CREATE POLICY tapmomo_merchants_update_policy ON app.tapmomo_merchants
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_merchants.sacco_id
                AND sp.role IN ('admin', 'manager')
        )
    );

-- Transactions: staff can view transactions for their SACCO
CREATE POLICY tapmomo_transactions_select_policy ON app.tapmomo_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND (sp.sacco_id = tapmomo_transactions.sacco_id OR sp.role = 'admin')
        )
    );

-- Transactions: staff can insert transactions
CREATE POLICY tapmomo_transactions_insert_policy ON app.tapmomo_transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_transactions.sacco_id
        )
    );

-- Transactions: staff can update transactions for their SACCO
CREATE POLICY tapmomo_transactions_update_policy ON app.tapmomo_transactions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_transactions.sacco_id
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON app.tapmomo_merchants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app.tapmomo_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION app.expire_tapmomo_transactions() TO service_role;
GRANT EXECUTE ON FUNCTION app.generate_merchant_secret() TO authenticated;
GRANT EXECUTE ON FUNCTION app.create_tapmomo_transaction(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) TO authenticated;

-- Create view for transaction summary
CREATE OR REPLACE VIEW app.tapmomo_transaction_summary AS
SELECT
    t.id,
    t.merchant_id,
    t.sacco_id,
    t.nonce,
    t.amount,
    t.currency,
    t.ref,
    t.network,
    t.status,
    t.payer_hint,
    t.payload_ts,
    t.initiated_at,
    t.settled_at,
    t.expires_at,
    t.payment_id,
    m.merchant_code,
    m.display_name AS merchant_name,
    p.reference AS payment_reference,
    p.status AS payment_status,
    s.name AS sacco_name
FROM app.tapmomo_transactions t
JOIN app.tapmomo_merchants m ON t.merchant_id = m.id
LEFT JOIN app.payments p ON t.payment_id = p.id
LEFT JOIN app.saccos s ON t.sacco_id = s.id;

GRANT SELECT ON app.tapmomo_transaction_summary TO authenticated;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION app.update_tapmomo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tapmomo_merchants_updated_at ON app.tapmomo_merchants;
DROP TRIGGER IF EXISTS tapmomo_transactions_updated_at ON app.tapmomo_transactions;

CREATE TRIGGER tapmomo_merchants_updated_at
    BEFORE UPDATE ON app.tapmomo_merchants
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

CREATE TRIGGER tapmomo_transactions_updated_at
    BEFORE UPDATE ON app.tapmomo_transactions
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

-- Comments for documentation
COMMENT ON TABLE app.tapmomo_merchants IS 'TapMoMo merchant configurations with HMAC keys for NFC payment validation';
COMMENT ON TABLE app.tapmomo_transactions IS 'TapMoMo payment transactions initiated via NFC tap';
COMMENT ON FUNCTION app.expire_tapmomo_transactions() IS 'Automatically expire TapMoMo transactions past their TTL';
COMMENT ON FUNCTION app.create_tapmomo_transaction(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) IS 'Create a new TapMoMo transaction with validation';


-- From: 20260305000000_whatsapp_otp_auth.sql

-- WhatsApp OTP Authentication System
-- Enables passwordless authentication via WhatsApp OTP for client mobile app

-- ============================================================================
-- 1. OTP Codes Table
-- ============================================================================

create table if not exists auth_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  otp_code_hash text not null, -- SHA256 hash of OTP
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified bool not null default false,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  
  constraint valid_phone_number check (phone_number ~* '^\+250[0-9]{9}$'),
  constraint valid_attempts check (attempts >= 0 and attempts <= 10),
  constraint valid_expiry check (expires_at > created_at)
);

-- Indexes for performance
create index if not exists auth_otp_codes_phone_idx 
  on auth_otp_codes(phone_number, created_at desc);
create index if not exists auth_otp_codes_expires_idx 
  on auth_otp_codes(expires_at) 
  where not verified;
create index if not exists auth_otp_codes_verified_idx 
  on auth_otp_codes(verified, created_at desc);

comment on table auth_otp_codes is 'Stores OTP codes for WhatsApp-based authentication';
comment on column auth_otp_codes.phone_number is 'Rwanda phone number in E.164 format (+250...)';
comment on column auth_otp_codes.otp_code_hash is 'SHA256 hash of the 6-digit OTP code';
comment on column auth_otp_codes.expires_at is 'OTP expiry timestamp (typically 5 minutes from creation)';
comment on column auth_otp_codes.attempts is 'Number of failed verification attempts';

-- ============================================================================
-- 2. OTP Rate Limiting Table
-- ============================================================================

create table if not exists auth_otp_rate_limits (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  attempts int not null default 1,
  window_start timestamptz not null default now(),
  last_attempt timestamptz not null default now(),
  blocked_until timestamptz,
  
  constraint valid_phone_number check (phone_number ~* '^\+250[0-9]{9}$')
);

create unique index if not exists auth_otp_rate_limits_phone_idx 
  on auth_otp_rate_limits(phone_number);

comment on table auth_otp_rate_limits is 'Rate limiting for OTP requests per phone number';
comment on column auth_otp_rate_limits.attempts is 'Number of OTP requests in current window';
comment on column auth_otp_rate_limits.window_start is 'Start of rate limit window (15 min)';
comment on column auth_otp_rate_limits.blocked_until is 'Phone number blocked until this time';

-- ============================================================================
-- 3. User Phone Numbers (extends auth.users)
-- ============================================================================

-- Add phone_number column to user_profiles if not exists
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'user_profiles' and column_name = 'phone_number'
  ) then
    alter table user_profiles add column phone_number text unique;
    alter table user_profiles add constraint valid_phone_number 
      check (phone_number is null or phone_number ~* '^\+250[0-9]{9}$');
    
    create index if not exists user_profiles_phone_idx 
      on user_profiles(phone_number) where phone_number is not null;
      
    comment on column user_profiles.phone_number is 'Verified WhatsApp number for passwordless auth';
  end if;
end $$;

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Function to check rate limits
create or replace function check_otp_rate_limit(p_phone_number text)
returns jsonb as $$
declare
  v_rate_limit record;
  v_window_minutes int := 15;
  v_max_attempts int := 3;
  v_block_minutes int := 15;
begin
  -- Get or create rate limit record
  select * into v_rate_limit
  from auth_otp_rate_limits
  where phone_number = p_phone_number;
  
  -- If no record, create one
  if not found then
    insert into auth_otp_rate_limits (phone_number)
    values (p_phone_number);
    
    return jsonb_build_object('allowed', true, 'attempts', 1, 'max_attempts', v_max_attempts);
  end if;
  
  -- Check if blocked
  if v_rate_limit.blocked_until is not null and v_rate_limit.blocked_until > now() then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'blocked',
      'blocked_until', v_rate_limit.blocked_until,
      'wait_seconds', extract(epoch from (v_rate_limit.blocked_until - now()))::int
    );
  end if;
  
  -- Check if window has expired
  if now() - v_rate_limit.window_start > (v_window_minutes || ' minutes')::interval then
    -- Reset window
    update auth_otp_rate_limits
    set attempts = 1, window_start = now(), last_attempt = now(), blocked_until = null
    where phone_number = p_phone_number;
    
    return jsonb_build_object('allowed', true, 'attempts', 1, 'max_attempts', v_max_attempts);
  end if;
  
  -- Check if max attempts reached
  if v_rate_limit.attempts >= v_max_attempts then
    -- Block for 15 minutes
    update auth_otp_rate_limits
    set blocked_until = now() + (v_block_minutes || ' minutes')::interval
    where phone_number = p_phone_number;
    
    return jsonb_build_object(
      'allowed', false,
      'reason', 'max_attempts',
      'attempts', v_rate_limit.attempts,
      'max_attempts', v_max_attempts,
      'blocked_until', now() + (v_block_minutes || ' minutes')::interval,
      'wait_seconds', v_block_minutes * 60
    );
  end if;
  
  -- Increment attempts
  update auth_otp_rate_limits
  set attempts = attempts + 1, last_attempt = now()
  where phone_number = p_phone_number;
  
  return jsonb_build_object(
    'allowed', true,
    'attempts', v_rate_limit.attempts + 1,
    'max_attempts', v_max_attempts
  );
end;
$$ language plpgsql security definer;

comment on function check_otp_rate_limit is 'Check if phone number can request another OTP';

-- Function to cleanup expired OTPs
create or replace function cleanup_expired_otps()
returns void as $$
begin
  -- Delete OTPs older than 24 hours
  delete from auth_otp_codes
  where created_at < now() - interval '24 hours';
  
  -- Reset rate limits older than 1 hour
  delete from auth_otp_rate_limits
  where window_start < now() - interval '1 hour'
    and (blocked_until is null or blocked_until < now());
    
  -- Log cleanup
  raise notice 'Cleaned up expired OTPs and rate limits';
end;
$$ language plpgsql security definer;

comment on function cleanup_expired_otps is 'Cleanup expired OTPs and old rate limits (run daily)';

-- Function to verify OTP
create or replace function verify_otp_code(
  p_phone_number text,
  p_otp_code text
)
returns jsonb as $$
declare
  v_otp_record record;
  v_otp_hash text;
  v_user_id uuid;
begin
  -- Hash the provided OTP
  v_otp_hash := encode(digest(p_otp_code, 'sha256'), 'hex');
  
  -- Find valid OTP
  select * into v_otp_record
  from auth_otp_codes
  where phone_number = p_phone_number
    and otp_code_hash = v_otp_hash
    and expires_at > now()
    and not verified
    and attempts < 3
  order by created_at desc
  limit 1;
  
  -- If not found, check for expired or wrong code
  if not found then
    -- Increment attempts on any non-verified recent OTP
    update auth_otp_codes
    set attempts = attempts + 1
    where phone_number = p_phone_number
      and not verified
      and created_at > now() - interval '10 minutes'
      and id = (
        select id from auth_otp_codes
        where phone_number = p_phone_number and not verified
        order by created_at desc limit 1
      );
    
    return jsonb_build_object(
      'success', false,
      'error', 'invalid_otp',
      'message', 'Invalid or expired OTP code'
    );
  end if;
  
  -- Mark as verified
  update auth_otp_codes
  set verified = true, verified_at = now()
  where id = v_otp_record.id;
  
  -- Check if user exists with this phone number
  select id into v_user_id
  from user_profiles
  where phone_number = p_phone_number;
  
  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'is_new_user', v_user_id is null,
    'phone_number', p_phone_number
  );
end;
$$ language plpgsql security definer;

comment on function verify_otp_code is 'Verify OTP code and return user info';

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

-- Enable RLS
alter table auth_otp_codes enable row level security;
alter table auth_otp_rate_limits enable row level security;

-- No direct access to OTP tables (only through functions)
create policy "No direct access to OTP codes"
  on auth_otp_codes for all
  using (false);

create policy "No direct access to rate limits"
  on auth_otp_rate_limits for all
  using (false);

-- ============================================================================
-- 6. Scheduled Cleanup (pg_cron)
-- ============================================================================

-- Run cleanup daily at 2 AM
-- Note: Requires pg_cron extension
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup-expired-otps',
      '0 2 * * *', -- Daily at 2 AM
      $$select cleanup_expired_otps()$$
    );
  end if;
exception when others then
  raise notice 'pg_cron not available, skipping scheduled cleanup';
end $$;

-- ============================================================================
-- 7. Monitoring View
-- ============================================================================

create or replace view auth_otp_stats as
select
  date_trunc('day', created_at) as date,
  count(*) as total_otps_sent,
  count(*) filter (where verified) as total_verified,
  count(*) filter (where not verified and expires_at < now()) as total_expired,
  count(*) filter (where attempts >= 3) as total_max_attempts,
  round(
    100.0 * count(*) filter (where verified) / nullif(count(*), 0),
    2
  ) as verification_rate_pct,
  avg(extract(epoch from (verified_at - created_at))) filter (where verified) as avg_verify_time_seconds
from auth_otp_codes
group by date_trunc('day', created_at)
order by date desc;

comment on view auth_otp_stats is 'Daily OTP authentication statistics';

-- ============================================================================
-- 8. Grant Permissions
-- ============================================================================

-- Grant execute on functions to authenticated and anon users (for Edge Functions)
grant execute on function check_otp_rate_limit to authenticated, anon;
grant execute on function verify_otp_code to authenticated, anon;
grant execute on function cleanup_expired_otps to postgres;

-- Grant select on stats view to authenticated users
grant select on auth_otp_stats to authenticated;

-- ============================================================================
-- Done
-- ============================================================================

-- Log migration
do $$
begin
  raise notice 'WhatsApp OTP authentication system installed successfully';
  raise notice 'Tables: auth_otp_codes, auth_otp_rate_limits';
  raise notice 'Functions: check_otp_rate_limit, verify_otp_code, cleanup_expired_otps';
  raise notice 'View: auth_otp_stats';
end $$;


-- From: 20260401000000_add_missing_rls_policies.sql

-- Add missing RLS policies for tables that were missing them
-- Issue: Tables without RLS enabled or policies

-- Enable RLS for notification_templates
-- This table stores notification templates, should be readable by authenticated users
-- but only writable by service role
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_templates_read" ON public.notification_templates
  FOR SELECT
  TO authenticated
  USING (
    -- Users can read templates for their SACCO or global templates
    sacco_id IS NULL OR EXISTS (
      SELECT 1 FROM public.org_memberships om
      JOIN public.organizations o ON om.org_id = o.id
      JOIN public.saccos s ON s.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND s.id = notification_templates.sacco_id
    )
  );

CREATE POLICY "notification_templates_write_service" ON public.notification_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS for rate_limit_counters
-- This is a system table, should only be accessible to service role
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_counters_service_only" ON public.rate_limit_counters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable RLS for sms_templates
-- SMS templates should be readable by staff of the SACCO
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_templates_read" ON public.sms_templates
  FOR SELECT
  TO authenticated
  USING (
    -- Users can read templates for SACCOs they belong to
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      JOIN public.organizations o ON om.org_id = o.id
      JOIN public.saccos s ON s.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND s.id = sms_templates.sacco_id
    )
  );

CREATE POLICY "sms_templates_write" ON public.sms_templates
  FOR ALL
  TO authenticated
  USING (
    -- Staff and above can manage templates
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      JOIN public.organizations o ON om.org_id = o.id
      JOIN public.saccos s ON s.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND s.id = sms_templates.sacco_id
        AND om.role IN ('STAFF', 'MANAGER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      JOIN public.organizations o ON om.org_id = o.id
      JOIN public.saccos s ON s.org_id = o.id
      WHERE om.user_id = auth.uid()
        AND s.id = sms_templates.sacco_id
        AND om.role IN ('STAFF', 'MANAGER', 'ADMIN')
    )
  );

-- Enable RLS for user_notification_preferences
-- Users can only read/write their own preferences
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_notification_preferences_own" ON public.user_notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Also allow service role full access for system operations
CREATE POLICY "user_notification_preferences_service" ON public.user_notification_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE public.notification_templates IS 'Notification templates for event-driven notifications. RLS enforced.';
COMMENT ON TABLE public.rate_limit_counters IS 'System rate limiting counters. Service role only.';
COMMENT ON TABLE public.sms_templates IS 'SMS message templates scoped to SACCOs. RLS enforced.';
COMMENT ON TABLE public.user_notification_preferences IS 'User notification channel preferences. Users can only access their own.';


-- From: 20260401000000_fix_users_table_for_staff.sql

-- Fix users table staff management columns
-- This migration handles the case where public.users might be a view

-- Create enum types if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_account_status') THEN
    CREATE TYPE public.user_account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
  END IF;
END $$;

-- Check if public.users is a table or view
DO $$
DECLARE
  v_is_table boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'users'
  ) INTO v_is_table;

  IF v_is_table THEN
    -- It's a table, add columns directly
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'pw_reset_required'
    ) THEN
      ALTER TABLE public.users ADD COLUMN pw_reset_required BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'account_status'
    ) THEN
      ALTER TABLE public.users ADD COLUMN account_status public.user_account_status NOT NULL DEFAULT 'ACTIVE';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
    ) THEN
      ALTER TABLE public.users ADD COLUMN full_name TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone_number'
    ) THEN
      ALTER TABLE public.users ADD COLUMN phone_number TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_login'
    ) THEN
      ALTER TABLE public.users ADD COLUMN last_login TIMESTAMPTZ;
    END IF;
  ELSE
    RAISE NOTICE 'public.users is a view or does not exist as a table. Staff columns should be in user_profiles or staff_members tables instead.';
  END IF;
END $$;


-- From: 20260401000100_fix_increment_metric_function_name.sql

-- Fix function name mismatch in analytics event logging
-- Issue: log_analytics_event calls increment_system_metric but function is named increment_metric

-- Create alias function to maintain compatibility
CREATE OR REPLACE FUNCTION public.increment_system_metric(
  event_name text,
  delta integer,
  meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call the actual function
  PERFORM public.increment_metric(event_name, delta, meta);
END;
$$;

COMMENT ON FUNCTION public.increment_system_metric IS 'Alias for increment_metric for backwards compatibility';


-- From: 20260401000200_wallet_and_checkin_system.sql

-- Wallet & Token System + Visitor Check-in
-- Double-entry ledger with non-negative balance constraints
-- NFC-based visitor registration

-- ============================================================
-- WALLET SYSTEM: Token Management (non-custodial)
-- ============================================================

-- Wallet accounts (one per user, optional merchant wallets)
CREATE TABLE IF NOT EXISTS app.wallet_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES app.tapmomo_merchants(id) ON DELETE CASCADE,
    label TEXT,
    currency TEXT NOT NULL DEFAULT 'USDt' CHECK (char_length(currency) <= 10),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallet_account_owner_or_merchant CHECK (
        (owner_user IS NOT NULL AND merchant_id IS NULL) OR
        (owner_user IS NULL AND merchant_id IS NOT NULL)
    )
);

-- Journal entries (transaction metadata)
CREATE TABLE IF NOT EXISTS app.wallet_journal (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ref TEXT UNIQUE NOT NULL, -- Idempotency key
    op TEXT NOT NULL CHECK (op IN ('mint', 'buy', 'transfer', 'spend', 'burn')),
    memo TEXT,
    initiated_by UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger entries (double-entry accounting)
CREATE TABLE IF NOT EXISTS app.wallet_entries (
    id BIGSERIAL PRIMARY KEY,
    journal_id BIGINT NOT NULL REFERENCES app.wallet_journal(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES app.wallet_accounts(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) NOT NULL, -- Positive = credit, Negative = debit
    currency TEXT NOT NULL DEFAULT 'USDt',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Balance view (aggregated from entries)
CREATE OR REPLACE VIEW app.wallet_balances AS
SELECT 
    account_id,
    currency,
    COALESCE(SUM(amount), 0) as balance,
    COUNT(*) as entry_count,
    MAX(created_at) as last_transaction_at
FROM app.wallet_entries
GROUP BY account_id, currency;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS wallet_accounts_owner_idx ON app.wallet_accounts(owner_user);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS wallet_accounts_merchant_idx ON app.wallet_accounts(merchant_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS wallet_journal_ref_idx ON app.wallet_journal(ref);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS wallet_journal_ts_idx ON app.wallet_journal(ts DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS wallet_entries_journal_idx ON app.wallet_entries(journal_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS wallet_entries_account_idx ON app.wallet_entries(account_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS wallet_entries_created_idx ON app.wallet_entries(created_at DESC);

-- ============================================================
-- WALLET CONSTRAINTS & VALIDATION
-- ============================================================

-- Enforce balanced journal entries (sum of amounts = 0)
CREATE OR REPLACE FUNCTION app.enforce_balanced_journal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    journal_sum NUMERIC(18,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO journal_sum
    FROM app.wallet_entries
    WHERE journal_id = NEW.journal_id;
    
    IF journal_sum <> 0 THEN
        RAISE EXCEPTION 'Unbalanced journal %. Sum: %', NEW.journal_id, journal_sum;
    END IF;
    
    RETURN NEW;
END $$;

-- Trigger after entries are inserted
CREATE TRIGGER trg_wallet_entries_balanced
AFTER INSERT ON app.wallet_entries
FOR EACH ROW
EXECUTE FUNCTION app.enforce_balanced_journal();

-- Prevent negative balances
CREATE OR REPLACE FUNCTION app.check_wallet_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    current_balance NUMERIC(18,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM app.wallet_entries
    WHERE account_id = NEW.account_id AND currency = NEW.currency;
    
    IF current_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient balance in account %. Balance: %', NEW.account_id, current_balance;
    END IF;
    
    RETURN NEW;
END $$;

CREATE TRIGGER trg_wallet_entries_non_negative
AFTER INSERT ON app.wallet_entries
FOR EACH ROW
EXECUTE FUNCTION app.check_wallet_balance();

-- ============================================================
-- VISITOR CHECK-IN SYSTEM
-- ============================================================

-- Offices/kiosks for visitor registration
CREATE TABLE IF NOT EXISTS app.visitor_offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    nfc_token TEXT UNIQUE, -- Short-lived token for NFC tap
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Visitor check-ins
CREATE TABLE IF NOT EXISTS app.visitor_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID NOT NULL REFERENCES app.visitor_offices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id), -- May be NULL for anonymous visitors
    visitor_name TEXT,
    visitor_phone TEXT,
    visitor_id_type TEXT, -- 'NID', 'PASSPORT', etc.
    visitor_id_number TEXT,
    purpose TEXT,
    device_fingerprint JSONB,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_out_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS IF NOT EXISTS visitor_offices_sacco_idx ON app.visitor_offices(sacco_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS visitor_offices_token_idx ON app.visitor_offices(nfc_token) WHERE nfc_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS visitor_checkins_office_idx ON app.visitor_checkins(office_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS visitor_checkins_user_idx ON app.visitor_checkins(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS visitor_checkins_date_idx ON app.visitor_checkins(checked_in_at DESC);

-- ============================================================
-- WALLET OPERATIONS (Server-Authoritative)
-- ============================================================

-- Transfer tokens between accounts
CREATE OR REPLACE FUNCTION app.wallet_transfer(
    p_from_account UUID,
    p_to_account UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_journal_id BIGINT;
    v_ref TEXT;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be positive';
    END IF;
    
    -- Generate or use provided idempotency key
    v_ref := COALESCE(p_idempotency_key, 'transfer-' || gen_random_uuid()::TEXT);
    
    -- Create journal entry
    INSERT INTO app.wallet_journal (ref, op, memo, initiated_by)
    VALUES (v_ref, 'transfer', p_memo, auth.uid())
    RETURNING id INTO v_journal_id;
    
    -- Debit from sender
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_from_account, -p_amount, p_currency);
    
    -- Credit to receiver
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_to_account, p_amount, p_currency);
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buy tokens with MoMo top-up (linked to payment)
CREATE OR REPLACE FUNCTION app.wallet_buy_tokens(
    p_account_id UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_payment_id UUID DEFAULT NULL,
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_journal_id BIGINT;
    v_ref TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Buy amount must be positive';
    END IF;
    
    v_ref := COALESCE(p_idempotency_key, 'buy-' || gen_random_uuid()::TEXT);
    
    -- Create journal entry
    INSERT INTO app.wallet_journal (ref, op, memo, initiated_by, metadata)
    VALUES (v_ref, 'buy', p_memo, auth.uid(), 
            jsonb_build_object('payment_id', p_payment_id))
    RETURNING id INTO v_journal_id;
    
    -- Credit user account (from system/SACCO reserve)
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_account_id, p_amount, p_currency);
    
    -- Debit is implicit (external MoMo payment, not tracked in ledger)
    -- Or could debit a system reserve account if needed
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mint tokens (promotional credits, admin only)
CREATE OR REPLACE FUNCTION app.wallet_mint_tokens(
    p_account_id UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_journal_id BIGINT;
    v_ref TEXT;
    v_is_admin BOOLEAN;
BEGIN
    -- Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM app.staff_profiles
        WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only admins can mint tokens';
    END IF;
    
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Mint amount must be positive';
    END IF;
    
    v_ref := COALESCE(p_idempotency_key, 'mint-' || gen_random_uuid()::TEXT);
    
    INSERT INTO app.wallet_journal (ref, op, memo, initiated_by)
    VALUES (v_ref, 'mint', p_memo, auth.uid())
    RETURNING id INTO v_journal_id;
    
    -- Credit user account (from thin air)
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_account_id, p_amount, p_currency);
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Burn tokens (withdraw to MoMo)
CREATE OR REPLACE FUNCTION app.wallet_burn_tokens(
    p_account_id UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_momo_txn_id TEXT DEFAULT NULL,
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_journal_id BIGINT;
    v_ref TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Burn amount must be positive';
    END IF;
    
    v_ref := COALESCE(p_idempotency_key, 'burn-' || gen_random_uuid()::TEXT);
    
    INSERT INTO app.wallet_journal (ref, op, memo, initiated_by, metadata)
    VALUES (v_ref, 'burn', p_memo, auth.uid(),
            jsonb_build_object('momo_txn_id', p_momo_txn_id))
    RETURNING id INTO v_journal_id;
    
    -- Debit user account
    INSERT INTO app.wallet_entries (journal_id, account_id, amount, currency)
    VALUES (v_journal_id, p_account_id, -p_amount, p_currency);
    
    RETURN v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Spend tokens at merchant
CREATE OR REPLACE FUNCTION app.wallet_spend_tokens(
    p_payer_account UUID,
    p_merchant_account UUID,
    p_amount NUMERIC(18,2),
    p_currency TEXT DEFAULT 'USDt',
    p_memo TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
BEGIN
    -- Use transfer function (same mechanics)
    RETURN app.wallet_transfer(
        p_payer_account,
        p_merchant_account,
        p_amount,
        p_currency,
        p_memo,
        p_idempotency_key
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE app.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.wallet_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.visitor_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.visitor_checkins ENABLE ROW LEVEL SECURITY;

-- Wallet accounts: users can see their own accounts
CREATE POLICY wallet_accounts_select_policy ON app.wallet_accounts
    FOR SELECT
    USING (owner_user = auth.uid());

-- Wallet accounts: users can insert their own accounts (one-time setup)
CREATE POLICY wallet_accounts_insert_policy ON app.wallet_accounts
    FOR INSERT
    WITH CHECK (owner_user = auth.uid());

-- Wallet journal: users can see their own transactions
CREATE POLICY wallet_journal_select_policy ON app.wallet_journal
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.wallet_entries we
            JOIN app.wallet_accounts wa ON we.account_id = wa.id
            WHERE we.journal_id = wallet_journal.id
                AND wa.owner_user = auth.uid()
        )
    );

-- Wallet entries: users can see entries for their accounts
CREATE POLICY wallet_entries_select_policy ON app.wallet_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.wallet_accounts wa
            WHERE wa.id = wallet_entries.account_id
                AND wa.owner_user = auth.uid()
        )
    );

-- Visitor offices: staff can view offices for their SACCO
CREATE POLICY visitor_offices_select_policy ON app.visitor_offices
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND (sp.sacco_id = visitor_offices.sacco_id OR sp.role = 'admin')
        )
    );

-- Visitor offices: admin staff can manage offices
CREATE POLICY visitor_offices_manage_policy ON app.visitor_offices
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = visitor_offices.sacco_id
                AND sp.role IN ('admin', 'manager')
        )
    );

-- Visitor check-ins: users can see their own check-ins
CREATE POLICY visitor_checkins_user_select_policy ON app.visitor_checkins
    FOR SELECT
    USING (user_id = auth.uid());

-- Visitor check-ins: staff can view check-ins for their SACCO
CREATE POLICY visitor_checkins_staff_select_policy ON app.visitor_checkins
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            JOIN app.visitor_offices vo ON vo.sacco_id = sp.sacco_id
            WHERE sp.user_id = auth.uid()
                AND vo.id = visitor_checkins.office_id
                AND (sp.sacco_id = vo.sacco_id OR sp.role = 'admin')
        )
    );

-- Visitor check-ins: anyone can insert (public kiosk)
CREATE POLICY visitor_checkins_insert_policy ON app.visitor_checkins
    FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT, INSERT ON app.wallet_accounts TO authenticated;
GRANT SELECT ON app.wallet_journal TO authenticated;
GRANT SELECT ON app.wallet_entries TO authenticated;
GRANT SELECT ON app.wallet_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app.visitor_offices TO authenticated;
GRANT SELECT, INSERT ON app.visitor_checkins TO authenticated;

GRANT EXECUTE ON FUNCTION app.wallet_transfer(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app.wallet_buy_tokens(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app.wallet_mint_tokens(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app.wallet_burn_tokens(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app.wallet_spend_tokens(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER wallet_accounts_updated_at
    BEFORE UPDATE ON app.wallet_accounts
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

CREATE TRIGGER visitor_offices_updated_at
    BEFORE UPDATE ON app.visitor_offices
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE app.wallet_accounts IS 'Token wallet accounts for users and merchants';
COMMENT ON TABLE app.wallet_journal IS 'Transaction journal for wallet operations (double-entry)';
COMMENT ON TABLE app.wallet_entries IS 'Ledger entries for wallet transactions';
COMMENT ON VIEW app.wallet_balances IS 'Aggregated wallet balances by account and currency';
COMMENT ON TABLE app.visitor_offices IS 'Office/kiosk locations for NFC visitor check-in';
COMMENT ON TABLE app.visitor_checkins IS 'Visitor check-in records';
COMMENT ON FUNCTION app.wallet_transfer(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) IS 'Transfer tokens between accounts';
COMMENT ON FUNCTION app.wallet_buy_tokens(UUID, NUMERIC, TEXT, UUID, TEXT, TEXT) IS 'Buy tokens with MoMo payment';
COMMENT ON FUNCTION app.wallet_mint_tokens(UUID, NUMERIC, TEXT, TEXT, TEXT) IS 'Mint promotional tokens (admin only)';
COMMENT ON FUNCTION app.wallet_burn_tokens(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) IS 'Burn tokens and withdraw to MoMo';
COMMENT ON FUNCTION app.wallet_spend_tokens(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) IS 'Spend tokens at merchant';


COMMIT;
