-- Create wallet_purchases table for tracking token purchases

CREATE TABLE IF NOT EXISTS wallet_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  user_wa_id TEXT NOT NULL,
  token_amount NUMERIC NOT NULL CHECK (token_amount >= 100),
  rwf_amount NUMERIC NOT NULL CHECK (rwf_amount > 0),
  payment_method TEXT DEFAULT 'momo',
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
  momo_transaction_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallet_purchases_user ON wallet_purchases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_purchases_status ON wallet_purchases(status, created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_purchases_momo_tx ON wallet_purchases(momo_transaction_id) WHERE momo_transaction_id IS NOT NULL;

-- Enable RLS
ALTER TABLE wallet_purchases ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON wallet_purchases TO service_role;
GRANT SELECT ON wallet_purchases TO authenticated;

-- Add updated_at trigger
CREATE TRIGGER set_wallet_purchases_updated_at
  BEFORE UPDATE ON wallet_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE wallet_purchases IS 'Tracks token purchase transactions via MoMo';
