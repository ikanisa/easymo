BEGIN;

-- Migration: Transaction and Payment Infrastructure
-- Purpose: Comprehensive transaction tracking and payment method management
-- Complements existing wallet_transactions with detailed transaction lifecycle

-- ============================================================================
-- TRANSACTIONS TABLE (Partitioned for high volume)
-- ============================================================================

-- Comprehensive transaction table for all financial operations
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_ref text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wallet_id uuid, -- References wallet_accounts if applicable
  type text NOT NULL CHECK (type IN ('debit', 'credit', 'transfer', 'payment', 'refund', 'fee', 'commission')),
  category text, -- 'mobility', 'marketplace', 'wallet', 'insurance', etc.
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'RWF' NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed')),
  payment_method_id uuid,
  source_id text, -- Source account/wallet
  destination_id text, -- Destination account/wallet
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  correlation_id text,
  idempotency_key text,
  error_code text,
  error_message text,
  initiated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  PRIMARY KEY (id, created_at),
  UNIQUE (transaction_ref, created_at),
  UNIQUE (idempotency_key, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions for transactions
CREATE TABLE IF NOT EXISTS public.transactions_2026_04 PARTITION OF public.transactions
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS public.transactions_2026_05 PARTITION OF public.transactions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
  ON public.transactions_2026_04 (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status 
  ON public.transactions_2026_04 (status, created_at DESC) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_transactions_ref 
  ON public.transactions_2026_04 (transaction_ref);

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency 
  ON public.transactions_2026_04 (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_correlation 
  ON public.transactions_2026_04 (correlation_id) 
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_created_05 
  ON public.transactions_2026_05 (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status_05 
  ON public.transactions_2026_05 (status, created_at DESC) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_transactions_ref_05 
  ON public.transactions_2026_05 (transaction_ref);

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_05 
  ON public.transactions_2026_05 (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_correlation_05 
  ON public.transactions_2026_05 (correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- RLS policies for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_transactions" ON public.transactions;
CREATE POLICY "service_role_full_access_transactions" 
  ON public.transactions 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_read_own_transactions" ON public.transactions;
CREATE POLICY "users_read_own_transactions" 
  ON public.transactions 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

-- ============================================================================
-- PAYMENT METHODS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('card', 'mobile_money', 'bank_account', 'wallet', 'cash')),
  provider text NOT NULL, -- 'mtn_momo', 'airtel_money', 'visa', 'mastercard', etc.
  provider_account_id text, -- External provider reference
  account_name text,
  account_number_masked text, -- Last 4 digits or masked version
  account_details_encrypted text, -- Encrypted full details
  is_default boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  verification_method text,
  verified_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'blocked')),
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for payment methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_user 
  ON public.payment_methods (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_default 
  ON public.payment_methods (user_id) 
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_payment_methods_type_provider 
  ON public.payment_methods (type, provider);

-- RLS policies for payment methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_payment_methods" ON public.payment_methods;
CREATE POLICY "service_role_full_access_payment_methods" 
  ON public.payment_methods 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_manage_own_payment_methods" ON public.payment_methods;
CREATE POLICY "users_manage_own_payment_methods" 
  ON public.payment_methods 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

-- ============================================================================
-- TRANSACTION EVENTS TABLE (Audit trail for transaction lifecycle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL,
  event_type text NOT NULL, -- 'created', 'updated', 'completed', 'failed', 'reversed'
  previous_status text,
  new_status text,
  triggered_by text, -- 'user', 'system', 'service', 'webhook'
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Indexes for transaction events
CREATE INDEX IF NOT EXISTS idx_transaction_events_txn_created 
  ON public.transaction_events (transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_events_type 
  ON public.transaction_events (event_type, created_at DESC);

-- RLS policies
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_txn_events" ON public.transaction_events;
CREATE POLICY "service_role_full_access_txn_events" 
  ON public.transaction_events 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_txn_events" ON public.transaction_events;
CREATE POLICY "authenticated_read_txn_events" 
  ON public.transaction_events 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant permissions
GRANT SELECT ON public.transaction_events TO authenticated;
GRANT ALL ON public.transaction_events TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create a transaction with idempotency
CREATE OR REPLACE FUNCTION public.create_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_currency text DEFAULT 'RWF',
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_transaction_ref text;
  v_existing_txn uuid;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_txn
    FROM public.transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF v_existing_txn IS NOT NULL THEN
      RETURN v_existing_txn;
    END IF;
  END IF;
  
  -- Generate unique transaction reference
  v_transaction_ref := 'TXN-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  
  -- Create transaction
  INSERT INTO public.transactions (
    transaction_ref,
    user_id,
    type,
    amount,
    currency,
    idempotency_key,
    metadata
  ) VALUES (
    v_transaction_ref,
    p_user_id,
    p_type,
    p_amount,
    p_currency,
    p_idempotency_key,
    p_metadata
  ) RETURNING id INTO v_transaction_id;
  
  -- Log creation event
  INSERT INTO public.transaction_events (
    transaction_id,
    event_type,
    new_status,
    triggered_by
  ) VALUES (
    v_transaction_id,
    'created',
    'pending',
    'system'
  );
  
  RETURN v_transaction_id;
END;
$$;

-- Function to update transaction status
CREATE OR REPLACE FUNCTION public.update_transaction_status(
  p_transaction_id uuid,
  p_new_status text,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_status text;
BEGIN
  -- Get current status
  SELECT status INTO v_previous_status
  FROM public.transactions
  WHERE id = p_transaction_id;
  
  IF v_previous_status IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update transaction
  UPDATE public.transactions
  SET 
    status = p_new_status,
    error_message = p_error_message,
    completed_at = CASE WHEN p_new_status IN ('completed', 'failed', 'cancelled') THEN timezone('utc', now()) ELSE completed_at END,
    updated_at = timezone('utc', now())
  WHERE id = p_transaction_id;
  
  -- Log status change event
  INSERT INTO public.transaction_events (
    transaction_id,
    event_type,
    previous_status,
    new_status,
    triggered_by,
    metadata
  ) VALUES (
    p_transaction_id,
    'updated',
    v_previous_status,
    p_new_status,
    'system',
    CASE WHEN p_error_message IS NOT NULL THEN jsonb_build_object('error', p_error_message) ELSE '{}'::jsonb END
  );
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_transaction(uuid, text, numeric, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_transaction_status(uuid, text, text) TO service_role;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for transaction summary by status
CREATE OR REPLACE VIEW public.transaction_summary AS
SELECT 
  status,
  type,
  currency,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(created_at) as oldest_transaction,
  MAX(created_at) as newest_transaction
FROM public.transactions
WHERE created_at > now() - interval '24 hours'
GROUP BY status, type, currency
ORDER BY status, type;

-- View for user transaction history (last 30 days)
CREATE OR REPLACE VIEW public.user_recent_transactions AS
SELECT 
  user_id,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_credits,
  MAX(created_at) as last_transaction_at
FROM public.transactions
WHERE created_at > now() - interval '30 days'
GROUP BY user_id;

-- Grant view access
GRANT SELECT ON public.transaction_summary TO authenticated;
GRANT SELECT ON public.user_recent_transactions TO authenticated;

COMMIT;
