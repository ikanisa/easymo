-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Create app.* schema for SACCO/Ibimina system
-- ═══════════════════════════════════════════════════════════════════════════
-- Creates core SACCO tables with proper relationships to existing momo infrastructure
-- Links to public.momo_transactions via foreign keys (no duplication)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Create app schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: app.saccos
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app.saccos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  sector TEXT,
  sector_code TEXT NOT NULL,
  merchant_code TEXT,
  province TEXT,
  email TEXT,
  category TEXT,
  logo_url TEXT,
  brand_color TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saccos_district ON app.saccos(district);
CREATE INDEX IF NOT EXISTS idx_saccos_status ON app.saccos(status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_saccos_sector_code ON app.saccos(sector_code);

COMMENT ON TABLE app.saccos IS 'SACCO/MFI institutions (Deposit-Taking Microfinance Cooperatives)';
COMMENT ON COLUMN app.saccos.sector_code IS 'Rwanda administrative sector code';
COMMENT ON COLUMN app.saccos.merchant_code IS 'MoMo merchant code for payment matching';

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: app.ikimina (Savings Groups)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app.ikimina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT DEFAULT 'savings' CHECK (type IN ('savings', 'credit', 'investment')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sacco_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ikimina_sacco_id ON app.ikimina(sacco_id);
CREATE INDEX IF NOT EXISTS idx_ikimina_status ON app.ikimina(status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_ikimina_code ON app.ikimina(sacco_id, code);

COMMENT ON TABLE app.ikimina IS 'Savings groups within a SACCO';
COMMENT ON COLUMN app.ikimina.code IS 'Unique group code within SACCO';

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: app.members
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  ikimina_id UUID REFERENCES app.ikimina(id) ON DELETE SET NULL,
  member_code TEXT,
  full_name TEXT NOT NULL,
  msisdn_masked TEXT,
  msisdn_hash TEXT,
  national_id_masked TEXT,
  national_id_hash TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sacco_id, member_code)
);

CREATE INDEX IF NOT EXISTS idx_members_sacco_id ON app.members(sacco_id);
CREATE INDEX IF NOT EXISTS idx_members_ikimina_id ON app.members(ikimina_id);
CREATE INDEX IF NOT EXISTS idx_members_msisdn_hash ON app.members(msisdn_hash) WHERE msisdn_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_national_id_hash ON app.members(national_id_hash) WHERE national_id_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_status ON app.members(status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_members_full_name ON app.members USING gin(to_tsvector('simple', full_name));

COMMENT ON TABLE app.members IS 'SACCO members with PII protected via hashing';
COMMENT ON COLUMN app.members.msisdn_hash IS 'SHA-256 hash of last 9 digits of phone number';
COMMENT ON COLUMN app.members.msisdn_masked IS 'Partially masked phone number for display';
COMMENT ON COLUMN app.members.national_id_hash IS 'SHA-256 hash of national ID';

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: app.accounts
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  ikimina_id UUID REFERENCES app.ikimina(id) ON DELETE SET NULL,
  member_id UUID NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL DEFAULT 'savings' CHECK (account_type IN ('savings', 'loan', 'shares')),
  balance INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'FROZEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, account_type)
);

CREATE INDEX IF NOT EXISTS idx_accounts_sacco_id ON app.accounts(sacco_id);
CREATE INDEX IF NOT EXISTS idx_accounts_member_id ON app.accounts(member_id);
CREATE INDEX IF NOT EXISTS idx_accounts_ikimina_id ON app.accounts(ikimina_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON app.accounts(status) WHERE status = 'ACTIVE';

COMMENT ON TABLE app.accounts IS 'Member accounts (savings, loans, shares)';
COMMENT ON COLUMN app.accounts.balance IS 'Balance in smallest currency unit (Rwandan Francs)';

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: app.sms_inbox (Links to public.momo_transactions)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app.sms_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  momo_transaction_id UUID REFERENCES public.momo_transactions(id) ON DELETE SET NULL,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'unmatched', 'error')),
  matched_member_id UUID REFERENCES app.members(id) ON DELETE SET NULL,
  matched_payment_id UUID,
  confidence DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_inbox_sacco_id ON app.sms_inbox(sacco_id);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_status ON app.sms_inbox(status);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_received_at ON app.sms_inbox(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_momo_txn ON app.sms_inbox(momo_transaction_id) WHERE momo_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_inbox_unmatched ON app.sms_inbox(sacco_id, received_at DESC) WHERE status = 'unmatched';

COMMENT ON TABLE app.sms_inbox IS 'SACCO SMS inbox linked to momo_transactions for audit trail';
COMMENT ON COLUMN app.sms_inbox.momo_transaction_id IS 'Links to public.momo_transactions (generic SMS record)';
COMMENT ON COLUMN app.sms_inbox.confidence IS 'Matching confidence score (0-1)';

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: app.payments
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  ikimina_id UUID REFERENCES app.ikimina(id) ON DELETE SET NULL,
  member_id UUID REFERENCES app.members(id) ON DELETE SET NULL,
  account_id UUID REFERENCES app.accounts(id) ON DELETE SET NULL,
  sms_id UUID REFERENCES app.sms_inbox(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  payment_method TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('matched', 'pending', 'failed', 'unmatched')),
  confidence DOUBLE PRECISION,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_sacco_id ON app.payments(sacco_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON app.payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_account_id ON app.payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_sms_id ON app.payments(sms_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON app.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON app.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON app.payments(reference) WHERE reference IS NOT NULL;

COMMENT ON TABLE app.payments IS 'SACCO payment transactions matched from SMS';
COMMENT ON COLUMN app.payments.amount IS 'Amount in smallest currency unit (Rwandan Francs)';
COMMENT ON COLUMN app.payments.sms_id IS 'Links to SMS that triggered this payment';

-- ═══════════════════════════════════════════════════════════════════════════
-- Table: app.ledger_entries (Double-entry bookkeeping)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  debit_id UUID REFERENCES app.accounts(id) ON DELETE SET NULL,
  credit_id UUID REFERENCES app.accounts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  value_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_sacco_id ON app.ledger_entries(sacco_id);
CREATE INDEX IF NOT EXISTS idx_ledger_debit_id ON app.ledger_entries(debit_id);
CREATE INDEX IF NOT EXISTS idx_ledger_credit_id ON app.ledger_entries(credit_id);
CREATE INDEX IF NOT EXISTS idx_ledger_value_date ON app.ledger_entries(value_date DESC);

COMMENT ON TABLE app.ledger_entries IS 'Double-entry ledger for account movements';

-- ═══════════════════════════════════════════════════════════════════════════
-- Updated_at triggers
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_saccos ON app.saccos;
CREATE TRIGGER set_updated_at_saccos BEFORE UPDATE ON app.saccos FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_ikimina ON app.ikimina;
CREATE TRIGGER set_updated_at_ikimina BEFORE UPDATE ON app.ikimina FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_members ON app.members;
CREATE TRIGGER set_updated_at_members BEFORE UPDATE ON app.members FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_accounts ON app.accounts;
CREATE TRIGGER set_updated_at_accounts BEFORE UPDATE ON app.accounts FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE app.saccos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ikimina ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sms_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY service_role_all ON app.saccos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON app.ikimina FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON app.members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON app.accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON app.sms_inbox FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON app.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON app.ledger_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read (will be restricted by SACCO membership in app logic)
CREATE POLICY authenticated_read ON app.saccos FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON app.ikimina FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON app.members FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON app.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON app.payments FOR SELECT TO authenticated USING (true);

COMMIT;
