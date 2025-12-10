-- Migration: TapMoMo merchants and transactions tables
-- Description: Stores merchant profiles and transaction reconciliation records for TapMoMo feature
-- Date: 2026-01-02

CREATE TABLE IF NOT EXISTS public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
  merchant_code TEXT NOT NULL,
  secret_key BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, network, merchant_code)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  nonce UUID NOT NULL UNIQUE,
  amount INTEGER,
  currency TEXT NOT NULL DEFAULT 'RWF',
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'failed')),
  payer_hint TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON public.merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_merchant_code ON public.merchants(merchant_code);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_id ON public.transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_nonce ON public.transactions(nonce);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own merchants"
  ON public.merchants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own merchants"
  ON public.merchants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own merchants"
  ON public.merchants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own merchants"
  ON public.merchants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view transactions for their merchants"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert transactions"
  ON public.transactions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update transactions"
  ON public.transactions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_merchants_updated_at ON public.merchants;
CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.merchants IS 'Mobile money merchants using TapMoMo';
COMMENT ON TABLE public.transactions IS 'Payment transactions initiated via NFC';
COMMENT ON COLUMN public.merchants.secret_key IS 'HMAC secret for payload signing (encrypted at rest)';
COMMENT ON COLUMN public.transactions.nonce IS 'Unique nonce from payment payload for replay protection';
COMMENT ON COLUMN public.transactions.payer_hint IS 'Optional hint about payer (phone number, name, etc)';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchants TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO service_role;
GRANT SELECT ON public.merchants TO service_role;
