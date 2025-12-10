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

CREATE INDEX IF NOT EXISTS idx_wallet_tokens_org_id ON public.wallet_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tokens_user_id ON public.wallet_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tokens_status ON public.wallet_tokens(status);
CREATE INDEX IF NOT EXISTS idx_wallet_tokens_token_type ON public.wallet_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_wallet_tokens_expires_at ON public.wallet_tokens(expires_at) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_wallet_tokens_token_code ON public.wallet_tokens(token_code);

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

CREATE INDEX IF NOT EXISTS idx_wallet_transaction_evidence_org_id ON public.wallet_transaction_evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transaction_evidence_user_id ON public.wallet_transaction_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transaction_evidence_external_ref ON public.wallet_transaction_evidence(external_reference);
CREATE INDEX IF NOT EXISTS idx_wallet_transaction_evidence_transaction_type ON public.wallet_transaction_evidence(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transaction_evidence_verified ON public.wallet_transaction_evidence(verified);

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

CREATE INDEX IF NOT EXISTS idx_stablecoin_transfers_org_id ON public.stablecoin_transfers(org_id);
CREATE INDEX IF NOT EXISTS idx_stablecoin_transfers_user_id ON public.stablecoin_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_stablecoin_transfers_transaction_hash ON public.stablecoin_transfers(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_stablecoin_transfers_status ON public.stablecoin_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stablecoin_transfers_direction ON public.stablecoin_transfers(direction);

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
