-- MomoTerminal SMS Integration for easymo-
-- Resolves: Issue #440

BEGIN;

-- ============================================
-- Table: momo_webhook_endpoints
-- Maps MoMo phone numbers to service types
-- ============================================
CREATE TABLE IF NOT EXISTS momo_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  momo_phone_number TEXT NOT NULL UNIQUE,
  service_type TEXT NOT NULL CHECK (service_type IN ('rides', 'marketplace', 'jobs', 'insurance')),
  webhook_secret TEXT NOT NULL,
  device_id TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: momo_transactions
-- Stores all incoming MoMo SMS with routing info
-- ============================================
CREATE TABLE IF NOT EXISTS momo_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  sender TEXT,
  raw_message TEXT NOT NULL,
  amount DECIMAL(15,2),
  sender_name TEXT,
  transaction_id TEXT,
  provider TEXT CHECK (provider IN ('mtn', 'vodafone', 'airteltigo', 'unknown')),
  service_type TEXT CHECK (service_type IN ('rides', 'marketplace', 'jobs', 'insurance')),
  matched_record_id UUID,
  matched_table TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'failed', 'manual_review')),
  match_confidence DECIMAL(3,2),
  error_message TEXT,
  correlation_id TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  device_id TEXT,
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_momo_transactions_phone ON momo_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_momo_transactions_status ON momo_transactions(status);
CREATE INDEX IF NOT EXISTS idx_momo_transactions_service ON momo_transactions(service_type);
CREATE INDEX IF NOT EXISTS idx_momo_transactions_received ON momo_transactions(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_momo_transactions_txn_id ON momo_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_momo_webhook_endpoints_phone ON momo_webhook_endpoints(momo_phone_number);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE momo_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE momo_webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- Service role full access for webhook
CREATE POLICY "Service role manages momo_transactions" ON momo_transactions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages momo_webhook_endpoints" ON momo_webhook_endpoints
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Admins can read transactions
CREATE POLICY "Admins read momo_transactions" ON momo_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Admins can manage webhook endpoints
CREATE POLICY "Admins manage momo_webhook_endpoints" ON momo_webhook_endpoints
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_momo_webhook_endpoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_momo_webhook_endpoints_updated_at
  BEFORE UPDATE ON momo_webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_momo_webhook_endpoints_updated_at();

COMMIT;
