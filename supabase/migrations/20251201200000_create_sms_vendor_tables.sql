-- SMS Parsing Vendor Management System
-- Creates tables for vendor registration, SMS transactions, and payer ledgers

BEGIN;

-- ============================================================================
-- 1. SMS Parsing Vendors Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sms_parsing_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  payee_momo_number TEXT NOT NULL UNIQUE,
  whatsapp_e164 TEXT NOT NULL,
  terminal_device_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'pending' CHECK (subscription_status IN ('pending', 'active', 'suspended', 'expired')),
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  api_key TEXT NOT NULL,
  hmac_secret TEXT NOT NULL,
  webhook_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);

COMMENT ON TABLE public.sms_parsing_vendors IS 'Vendors registered for SMS parsing service via MomoTerminal';
COMMENT ON COLUMN public.sms_parsing_vendors.payee_momo_number IS 'SIM card number receiving payments';
COMMENT ON COLUMN public.sms_parsing_vendors.whatsapp_e164 IS 'WhatsApp number for MomoTerminal registration and portal login';
COMMENT ON COLUMN public.sms_parsing_vendors.terminal_device_id IS 'Links to MomoTerminal device';
COMMENT ON COLUMN public.sms_parsing_vendors.api_key IS 'Auto-generated 32 bytes hex for API authentication';
COMMENT ON COLUMN public.sms_parsing_vendors.hmac_secret IS 'Auto-generated 32 bytes hex for webhook signature verification';

-- Indexes for sms_parsing_vendors
CREATE INDEX IF NOT EXISTS idx_sms_vendors_whatsapp ON public.sms_parsing_vendors(whatsapp_e164);
CREATE INDEX IF NOT EXISTS idx_sms_vendors_status ON public.sms_parsing_vendors(subscription_status);
CREATE INDEX IF NOT EXISTS idx_sms_vendors_created_at ON public.sms_parsing_vendors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_vendors_payee_momo ON public.sms_parsing_vendors(payee_momo_number);

-- ============================================================================
-- 2. Vendor SMS Transactions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_sms_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.sms_parsing_vendors(id) ON DELETE CASCADE,
  raw_sms TEXT NOT NULL,
  sender_address TEXT,
  received_at TIMESTAMPTZ,
  payer_name TEXT,
  payer_phone TEXT,
  amount DECIMAL(15,2),
  currency TEXT DEFAULT 'RWF',
  txn_id TEXT,
  txn_timestamp TIMESTAMPTZ,
  provider TEXT CHECK (provider IS NULL OR provider IN ('mtn', 'vodafone', 'airteltigo')),
  ai_confidence DECIMAL(3,2) CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
  parsed_json JSONB,
  status TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN ('raw', 'parsed', 'matched', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendor_sms_transactions IS 'SMS transactions parsed from MomoTerminal for each vendor';
COMMENT ON COLUMN public.vendor_sms_transactions.raw_sms IS 'Original SMS message content';
COMMENT ON COLUMN public.vendor_sms_transactions.ai_confidence IS 'AI parsing confidence score (0-1)';
COMMENT ON COLUMN public.vendor_sms_transactions.parsed_json IS 'Full parsed SMS data as JSON';

-- Indexes for vendor_sms_transactions
CREATE INDEX IF NOT EXISTS idx_vendor_txns_vendor_id ON public.vendor_sms_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_txns_created_at ON public.vendor_sms_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_txns_payer_phone ON public.vendor_sms_transactions(payer_phone);
CREATE INDEX IF NOT EXISTS idx_vendor_txns_txn_id ON public.vendor_sms_transactions(txn_id);
CREATE INDEX IF NOT EXISTS idx_vendor_txns_status ON public.vendor_sms_transactions(status);
CREATE INDEX IF NOT EXISTS idx_vendor_txns_vendor_created ON public.vendor_sms_transactions(vendor_id, created_at DESC);

-- ============================================================================
-- 3. Vendor Payer Ledgers Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_payer_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.sms_parsing_vendors(id) ON DELETE CASCADE,
  payer_phone TEXT NOT NULL,
  payer_name TEXT,
  total_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  payment_count INTEGER NOT NULL DEFAULT 0,
  first_payment_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, payer_phone)
);

COMMENT ON TABLE public.vendor_payer_ledgers IS 'Aggregated payment ledgers per payer for each vendor';
COMMENT ON COLUMN public.vendor_payer_ledgers.total_paid IS 'Running total of all payments from this payer';
COMMENT ON COLUMN public.vendor_payer_ledgers.payment_count IS 'Number of payments from this payer';

-- Indexes for vendor_payer_ledgers
CREATE INDEX IF NOT EXISTS idx_vendor_ledgers_vendor_id ON public.vendor_payer_ledgers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ledgers_payer_phone ON public.vendor_payer_ledgers(payer_phone);
CREATE INDEX IF NOT EXISTS idx_vendor_ledgers_total_paid ON public.vendor_payer_ledgers(total_paid DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_ledgers_last_payment ON public.vendor_payer_ledgers(last_payment_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_ledgers_vendor_total ON public.vendor_payer_ledgers(vendor_id, total_paid DESC);

-- ============================================================================
-- 4. Updated_at Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sms_vendors_updated_at ON public.sms_parsing_vendors;
DROP TRIGGER IF EXISTS update_sms_vendors_updated_at ON ; -- FIXME: add table name
CREATE TRIGGER update_sms_vendors_updated_at
  BEFORE UPDATE ON public.sms_parsing_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_ledgers_updated_at ON public.vendor_payer_ledgers;
DROP TRIGGER IF EXISTS update_vendor_ledgers_updated_at ON ; -- FIXME: add table name
CREATE TRIGGER update_vendor_ledgers_updated_at
  BEFORE UPDATE ON public.vendor_payer_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.sms_parsing_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_sms_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payer_ledgers ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DROP POLICY IF EXISTS sms_vendors_service_role_all ON public.sms_parsing_vendors;
CREATE POLICY sms_vendors_service_role_all ON public.sms_parsing_vendors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS vendor_txns_service_role_all ON public.vendor_sms_transactions;
CREATE POLICY vendor_txns_service_role_all ON public.vendor_sms_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS vendor_ledgers_service_role_all ON public.vendor_payer_ledgers;
CREATE POLICY vendor_ledgers_service_role_all ON public.vendor_payer_ledgers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Vendors can view their own data via whatsapp_e164 JWT claim
DROP POLICY IF EXISTS sms_vendors_own_read ON public.sms_parsing_vendors;
CREATE POLICY sms_vendors_own_read ON public.sms_parsing_vendors
  FOR SELECT
  TO authenticated
  USING (whatsapp_e164 = current_setting('request.jwt.claims', true)::json->>'whatsapp_e164');

DROP POLICY IF EXISTS vendor_txns_own_read ON public.vendor_sms_transactions;
CREATE POLICY vendor_txns_own_read ON public.vendor_sms_transactions
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.sms_parsing_vendors
      WHERE whatsapp_e164 = current_setting('request.jwt.claims', true)::json->>'whatsapp_e164'
    )
  );

DROP POLICY IF EXISTS vendor_ledgers_own_read ON public.vendor_payer_ledgers;
CREATE POLICY vendor_ledgers_own_read ON public.vendor_payer_ledgers
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.sms_parsing_vendors
      WHERE whatsapp_e164 = current_setting('request.jwt.claims', true)::json->>'whatsapp_e164'
    )
  );

COMMIT;
