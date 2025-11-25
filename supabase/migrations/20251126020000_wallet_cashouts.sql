-- Create wallet_cashouts table for tracking token withdrawals

CREATE TABLE IF NOT EXISTS wallet_cashouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_wa_id TEXT NOT NULL,
  token_amount NUMERIC NOT NULL CHECK (token_amount >= 1000),
  fee_amount NUMERIC NOT NULL CHECK (fee_amount >= 0),
  net_tokens NUMERIC NOT NULL CHECK (net_tokens > 0),
  rwf_amount NUMERIC NOT NULL CHECK (rwf_amount > 0),
  momo_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  momo_transaction_id TEXT,
  admin_notes TEXT,
  processed_by UUID REFERENCES profiles(user_id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallet_cashouts_user ON wallet_cashouts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_cashouts_status ON wallet_cashouts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_cashouts_pending ON wallet_cashouts(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_wallet_cashouts_momo_tx ON wallet_cashouts(momo_transaction_id) WHERE momo_transaction_id IS NOT NULL;

-- Enable RLS
ALTER TABLE wallet_cashouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own cashouts
CREATE POLICY wallet_cashouts_select_own ON wallet_cashouts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY wallet_cashouts_service_all ON wallet_cashouts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON wallet_cashouts TO service_role;
GRANT SELECT ON wallet_cashouts TO authenticated;

-- Add updated_at trigger
CREATE TRIGGER set_wallet_cashouts_updated_at
  BEFORE UPDATE ON wallet_cashouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE wallet_cashouts IS 'Tracks token cash-out/withdrawal requests to MoMo';
COMMENT ON COLUMN wallet_cashouts.token_amount IS 'Total tokens requested for withdrawal';
COMMENT ON COLUMN wallet_cashouts.fee_amount IS 'Fee charged (2% of token_amount)';
COMMENT ON COLUMN wallet_cashouts.net_tokens IS 'Net tokens after fee (token_amount - fee_amount)';
COMMENT ON COLUMN wallet_cashouts.rwf_amount IS 'Cash amount to disburse (net_tokens * 0.5)';
