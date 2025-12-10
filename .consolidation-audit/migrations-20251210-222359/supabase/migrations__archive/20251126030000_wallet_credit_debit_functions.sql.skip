BEGIN;

-- wallet_credit_tokens: Add tokens to user's wallet
-- Used for: purchases, earnings, rewards, referral bonuses
CREATE OR REPLACE FUNCTION public.wallet_credit_tokens(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance NUMERIC,
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::NUMERIC, NULL::UUID;
    RETURN;
  END IF;

  -- Get or create wallet
  INSERT INTO wallets (user_id, balance, lifetime_earned)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::NUMERIC, NULL::UUID;
    RETURN;
  END IF;

  -- Update wallet balance and lifetime_earned
  UPDATE wallets
  SET 
    balance = balance + p_amount,
    lifetime_earned = lifetime_earned + p_amount,
    updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    'credit',
    p_amount,
    v_new_balance,
    p_reference_type,
    p_reference_id,
    COALESCE(p_description, 'Token credit')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;

-- wallet_debit_tokens: Deduct tokens from user's wallet
-- Used for: cash-outs, transfers, redemptions
CREATE OR REPLACE FUNCTION public.wallet_debit_tokens(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance NUMERIC,
  transaction_id UUID,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::NUMERIC, NULL::UUID, 'invalid_args'::TEXT;
    RETURN;
  END IF;

  -- Get wallet and current balance
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE; -- Lock row to prevent race conditions

  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::NUMERIC, NULL::UUID, 'wallet_not_found'::TEXT;
    RETURN;
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, NULL::UUID, 'insufficient_balance'::TEXT;
    RETURN;
  END IF;

  -- Update wallet balance and lifetime_spent
  UPDATE wallets
  SET 
    balance = balance - p_amount,
    lifetime_spent = lifetime_spent + p_amount,
    updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description
  )
  VALUES (
    v_wallet_id,
    p_user_id,
    'debit',
    -p_amount, -- Negative for debit
    v_new_balance,
    p_reference_type,
    p_reference_id,
    COALESCE(p_description, 'Token debit')
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id, NULL::TEXT;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION wallet_credit_tokens TO service_role;
GRANT EXECUTE ON FUNCTION wallet_debit_tokens TO service_role;

-- Add comments
COMMENT ON FUNCTION wallet_credit_tokens IS 'Credits tokens to user wallet with transaction logging';
COMMENT ON FUNCTION wallet_debit_tokens IS 'Debits tokens from user wallet with balance check and transaction logging';

COMMIT;
