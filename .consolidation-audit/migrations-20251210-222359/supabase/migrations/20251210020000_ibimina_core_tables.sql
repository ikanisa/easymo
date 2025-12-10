-- Ibimina SACCO Platform - Core Tables
-- Date: 2025-12-09
-- Adds only ibimina-specific tables (no conflicts)
--
-- EXCLUDED (already in easymo): audit_logs, countries, merchants, notifications, transactions

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- AUTHENTICATION & QR CODE TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.auth_qr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code TEXT UNIQUE NOT NULL,
  staff_id UUID,
  device_info JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  trusted BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- SMS PROCESSING TABLES  
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.sms_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  org_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_parsed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_id UUID REFERENCES public.sms_inbox(id),
  parsed_data JSONB,
  confidence DECIMAL(3,2),
  parser_version TEXT,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewer_id UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  variables JSONB,
  org_id UUID,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_id UUID REFERENCES public.sms_inbox(id),
  reason TEXT,
  priority INTEGER DEFAULT 0,
  assigned_to UUID,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- RECONCILIATION TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  run_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  total_items INTEGER DEFAULT 0,
  matched_items INTEGER DEFAULT 0,
  unmatched_items INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  started_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reconciliation_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.reconciliation_runs(id),
  item_type TEXT,
  item_data JSONB,
  reason TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  member_id UUID,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT,
  reference TEXT,
  status TEXT DEFAULT 'pending',
  reconciled BOOLEAN DEFAULT FALSE,
  reconciliation_run_id UUID REFERENCES public.reconciliation_runs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_run_id UUID REFERENCES public.reconciliation_runs(id),
  total_amount DECIMAL(15,2),
  currency TEXT DEFAULT 'RWF',
  settled_at TIMESTAMPTZ,
  settlement_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- MEMBER & ORGANIZATION TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  type TEXT,
  country_code TEXT,
  settings JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  member_number TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  email TEXT,
  id_number TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, member_number)
);

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  group_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id),
  member_id UUID REFERENCES public.members(id),
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, member_id)
);

-- =====================================================================
-- SHARES & ALLOCATIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.share_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  member_id UUID REFERENCES public.members(id),
  shares DECIMAL(15,2) NOT NULL,
  allocation_date DATE,
  fiscal_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.allocation_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  requested_by UUID,
  fiscal_year INTEGER,
  status TEXT DEFAULT 'pending',
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- WALLET TABLES (ibimina-specific)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wallet_accounts_ibimina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id),
  balance DECIMAL(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'RWF',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions_ibimina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_account_id UUID REFERENCES public.wallet_accounts_ibimina(id),
  type TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reference TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- CONFIGURATION & SYSTEM TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  key TEXT NOT NULL,
  value JSONB,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, key)
);

CREATE TABLE IF NOT EXISTS public.org_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  feature_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, feature_key)
);

CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value DECIMAL,
  labels JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(key, window_start)
);

-- =====================================================================
-- ANALYTICS & EVENTS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id UUID,
  org_id UUID,
  properties JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID,
  channel TEXT NOT NULL,
  template TEXT,
  data JSONB,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- PUSH NOTIFICATIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT,
  device_id TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- CREATE INDEXES
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_sms_inbox_org_id ON public.sms_inbox(org_id);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_processed ON public.sms_inbox(processed);
CREATE INDEX IF NOT EXISTS idx_sms_parsed_sms_id ON public.sms_parsed(sms_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_org_id ON public.reconciliation_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON public.payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_reconciled ON public.payments(reconciled);
CREATE INDEX IF NOT EXISTS idx_members_org_id ON public.members(org_id);
CREATE INDEX IF NOT EXISTS idx_share_allocations_member_id ON public.share_allocations(member_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_org_id ON public.analytics_events(org_id);

COMMIT;
