-- Final MoMo tables creation - simplified policies

BEGIN;

-- Drop existing tables
DROP TABLE IF EXISTS momo_transactions CASCADE;
DROP TABLE IF EXISTS momo_webhook_endpoints CASCADE;

-- Create momo_webhook_endpoints
CREATE TABLE momo_webhook_endpoints (
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

-- Create momo_transactions
CREATE TABLE momo_transactions (
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

-- Indexes
CREATE INDEX idx_momo_transactions_phone ON momo_transactions(phone_number);
CREATE INDEX idx_momo_transactions_status ON momo_transactions(status);
CREATE INDEX idx_momo_transactions_service ON momo_transactions(service_type);
CREATE INDEX idx_momo_transactions_received ON momo_transactions(received_at DESC);
CREATE INDEX idx_momo_transactions_txn_id ON momo_transactions(transaction_id);
CREATE INDEX idx_momo_webhook_endpoints_phone ON momo_webhook_endpoints(momo_phone_number);

-- RLS
ALTER TABLE momo_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE momo_webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- Simplified policies - service_role only (will add admin later)
CREATE POLICY "Service role full access" ON momo_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON momo_webhook_endpoints FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger
CREATE OR REPLACE FUNCTION update_momo_webhook_endpoints_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_momo_webhook_endpoints_updated_at
  BEFORE UPDATE ON momo_webhook_endpoints FOR EACH ROW EXECUTE FUNCTION update_momo_webhook_endpoints_updated_at();

COMMIT;
