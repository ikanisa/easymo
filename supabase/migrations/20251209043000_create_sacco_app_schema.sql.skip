-- SACCO Application Schema and Core Tables
-- Creates app schema with tables for SACCO operations: members, accounts, payments, etc.

BEGIN;

-- =====================================================
-- Create app schema
-- =====================================================
CREATE SCHEMA IF NOT EXISTS app;

-- =====================================================
-- Table: app.saccos
-- SACCO organizations
-- =====================================================
CREATE TABLE IF NOT EXISTS app.saccos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  whatsapp_number TEXT,
  registration_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.saccos IS 'SACCO organizations registered in the system';

-- =====================================================
-- Table: app.members
-- SACCO members
-- =====================================================
CREATE TABLE IF NOT EXISTS app.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  member_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT,
  phone_hash TEXT, -- SHA256 hash of phone for privacy-preserving matching
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sacco_id, member_number)
);

COMMENT ON TABLE app.members IS 'SACCO members who can make payments';
COMMENT ON COLUMN app.members.phone_hash IS 'SHA256 hash of phone number for privacy-preserving matching';

-- =====================================================
-- Table: app.accounts
-- Member account balances
-- =====================================================
CREATE TABLE IF NOT EXISTS app.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL DEFAULT 'savings' CHECK (account_type IN ('savings', 'shares', 'loan')),
  balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sacco_id, member_id, account_type)
);

COMMENT ON TABLE app.accounts IS 'Member account balances by type';

-- =====================================================
-- Table: app.sms_inbox
-- Raw SMS messages received for SACCO
-- =====================================================
CREATE TABLE IF NOT EXISTS app.sms_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  raw_message TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  sender_name TEXT,
  amount DECIMAL(15,2),
  transaction_id TEXT,
  provider TEXT,
  matched_member_id UUID REFERENCES app.members(id),
  match_confidence DECIMAL(3,2),
  match_method TEXT, -- 'phone_hash', 'name', 'manual'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'unmatched', 'error')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.sms_inbox IS 'Inbox for MoMo SMS messages for SACCO members';
COMMENT ON COLUMN app.sms_inbox.match_method IS 'How the member was matched: phone_hash, name, or manual';

-- =====================================================
-- Table: app.payments
-- Processed payments linked to members
-- =====================================================
CREATE TABLE IF NOT EXISTS app.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  sms_inbox_id UUID REFERENCES app.sms_inbox(id),
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  transaction_id TEXT,
  provider TEXT,
  payment_type TEXT DEFAULT 'deposit' CHECK (payment_type IN ('deposit', 'withdrawal', 'loan_payment', 'share_purchase')),
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE app.payments IS 'Processed payments from members';

-- =====================================================
-- Table: app.ledger_entries
-- Audit trail for all account changes
-- =====================================================
CREATE TABLE IF NOT EXISTS app.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES app.accounts(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES app.payments(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.ledger_entries IS 'Immutable audit trail of all account balance changes';

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_members_sacco_id ON app.members(sacco_id);
CREATE INDEX IF NOT EXISTS idx_members_phone_hash ON app.members(phone_hash) WHERE phone_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_status ON app.members(status);

CREATE INDEX IF NOT EXISTS idx_accounts_sacco_id ON app.accounts(sacco_id);
CREATE INDEX IF NOT EXISTS idx_accounts_member_id ON app.accounts(member_id);

CREATE INDEX IF NOT EXISTS idx_sms_inbox_sacco_id ON app.sms_inbox(sacco_id);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_status ON app.sms_inbox(status);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_member_id ON app.sms_inbox(matched_member_id);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_received_at ON app.sms_inbox(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_sacco_id ON app.payments(sacco_id);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON app.payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_sms_inbox_id ON app.payments(sms_inbox_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON app.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON app.payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id ON app.ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_payment_id ON app.ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON app.ledger_entries(created_at DESC);

-- =====================================================
-- Updated_at triggers
-- =====================================================
CREATE OR REPLACE FUNCTION app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_saccos_updated_at
  BEFORE UPDATE ON app.saccos
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_at_column();

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON app.members
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON app.accounts
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_at_column();

-- =====================================================
-- Row Level Security
-- =====================================================
ALTER TABLE app.saccos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sms_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY service_role_all_saccos ON app.saccos
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_members ON app.members
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_accounts ON app.accounts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_sms_inbox ON app.sms_inbox
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_payments ON app.payments
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_ledger_entries ON app.ledger_entries
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users can read their SACCO data (based on whatsapp_number in JWT)
CREATE POLICY authenticated_read_saccos ON app.saccos
  FOR SELECT TO authenticated
  USING (whatsapp_number = current_setting('request.jwt.claims', true)::json->>'whatsapp_number');

CREATE POLICY authenticated_read_members ON app.members
  FOR SELECT TO authenticated
  USING (
    sacco_id IN (
      SELECT id FROM app.saccos
      WHERE whatsapp_number = current_setting('request.jwt.claims', true)::json->>'whatsapp_number'
    )
  );

CREATE POLICY authenticated_read_accounts ON app.accounts
  FOR SELECT TO authenticated
  USING (
    sacco_id IN (
      SELECT id FROM app.saccos
      WHERE whatsapp_number = current_setting('request.jwt.claims', true)::json->>'whatsapp_number'
    )
  );

CREATE POLICY authenticated_read_sms_inbox ON app.sms_inbox
  FOR SELECT TO authenticated
  USING (
    sacco_id IN (
      SELECT id FROM app.saccos
      WHERE whatsapp_number = current_setting('request.jwt.claims', true)::json->>'whatsapp_number'
    )
  );

CREATE POLICY authenticated_read_payments ON app.payments
  FOR SELECT TO authenticated
  USING (
    sacco_id IN (
      SELECT id FROM app.saccos
      WHERE whatsapp_number = current_setting('request.jwt.claims', true)::json->>'whatsapp_number'
    )
  );

CREATE POLICY authenticated_read_ledger_entries ON app.ledger_entries
  FOR SELECT TO authenticated
  USING (
    sacco_id IN (
      SELECT id FROM app.saccos
      WHERE whatsapp_number = current_setting('request.jwt.claims', true)::json->>'whatsapp_number'
    )
  );

COMMIT;
