-- Migration: Create SACCO schema foundation
-- Description: Sets up the app schema for SACCO entities including SACCOs, Ikimina groups, members, payments, and SMS inbox

BEGIN;

-- Create app schema if not exists
CREATE SCHEMA IF NOT EXISTS app;

-- Grant access to PostgREST roles
GRANT USAGE ON SCHEMA app TO anon, authenticated, service_role;

-- SACCOs table
CREATE TABLE IF NOT EXISTS app.saccos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  sector TEXT,
  sector_code TEXT NOT NULL,
  merchant_code TEXT,
  province TEXT,
  email TEXT,
  category TEXT DEFAULT 'Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)',
  logo_url TEXT,
  brand_color TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ikimina (savings groups) table
CREATE TABLE IF NOT EXISTS app.ikimina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ASCA',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Members table
CREATE TABLE IF NOT EXISTS app.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ikimina_id UUID NOT NULL REFERENCES app.ikimina(id) ON DELETE CASCADE,
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  member_code TEXT,
  full_name TEXT NOT NULL,
  national_id TEXT,
  national_id_encrypted TEXT,
  national_id_hash TEXT,
  national_id_masked TEXT,
  msisdn TEXT NOT NULL,
  msisdn_encrypted TEXT,
  msisdn_hash TEXT,
  msisdn_masked TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ikimina_id, member_code)
);

-- Accounts table
CREATE TABLE IF NOT EXISTS app.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE,
  ikimina_id UUID REFERENCES app.ikimina(id) ON DELETE CASCADE,
  member_id UUID REFERENCES app.members(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL,
  balance INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS app.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE,
  ikimina_id UUID REFERENCES app.ikimina(id) ON DELETE CASCADE,
  member_id UUID REFERENCES app.members(id) ON DELETE CASCADE,
  account_id UUID REFERENCES app.accounts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  payment_method TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  confidence DOUBLE PRECISION,
  sms_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- SMS Inbox for SACCO payments
CREATE TABLE IF NOT EXISTS app.sms_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_data JSONB,
  confidence DOUBLE PRECISION,
  matched_member_id UUID REFERENCES app.members(id),
  matched_payment_id UUID REFERENCES app.payments(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger entries for double-entry accounting
CREATE TABLE IF NOT EXISTS app.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID REFERENCES app.saccos(id) ON DELETE CASCADE,
  debit_id UUID REFERENCES app.accounts(id),
  credit_id UUID REFERENCES app.accounts(id),
  amount INTEGER NOT NULL,
  value_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_members_sacco ON app.members(sacco_id);
CREATE INDEX IF NOT EXISTS idx_members_msisdn_hash ON app.members(msisdn_hash);
CREATE INDEX IF NOT EXISTS idx_members_national_hash ON app.members(national_id_hash);
CREATE INDEX IF NOT EXISTS idx_payments_sacco ON app.payments(sacco_id);
CREATE INDEX IF NOT EXISTS idx_payments_member ON app.payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON app.payments(status);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_sacco ON app.sms_inbox(sacco_id);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_status ON app.sms_inbox(status);

-- Enable RLS
ALTER TABLE app.saccos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ikimina ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sms_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Service role policies (for edge functions)
CREATE POLICY "Service role full access to saccos" ON app.saccos FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access to ikimina" ON app.ikimina FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access to members" ON app.members FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access to accounts" ON app.accounts FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access to payments" ON app.payments FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access to sms_inbox" ON app.sms_inbox FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access to ledger_entries" ON app.ledger_entries FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Grant table access
GRANT ALL ON ALL TABLES IN SCHEMA app TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO authenticated;

COMMIT;
