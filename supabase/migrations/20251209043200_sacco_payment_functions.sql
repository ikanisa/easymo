-- SACCO Payment Processing Functions
-- Functions for matching SMS to members and processing payments

BEGIN;

-- =====================================================
-- Function: app.match_sms_to_member
-- Matches sender phone to a SACCO member by phone hash
-- =====================================================
CREATE OR REPLACE FUNCTION app.match_sms_to_member(
  p_sacco_id UUID,
  p_sender_phone TEXT
)
RETURNS TABLE(
  member_id UUID,
  confidence DECIMAL(3,2),
  match_method TEXT
) AS $$
DECLARE
  v_phone_hash TEXT;
BEGIN
  -- Create SHA256 hash of phone number (normalize first: remove spaces, dashes, plus)
  v_phone_hash := encode(
    digest(
      regexp_replace(p_sender_phone, '[^0-9]', '', 'g'),
      'sha256'
    ),
    'hex'
  );

  -- Try exact phone hash match
  RETURN QUERY
  SELECT 
    m.id,
    0.95::DECIMAL(3,2) AS confidence,
    'phone_hash'::TEXT AS match_method
  FROM app.members m
  WHERE m.sacco_id = p_sacco_id
    AND m.phone_hash = v_phone_hash
    AND m.status = 'active'
  LIMIT 1;
  
  -- If no hash match found, return empty
  IF NOT FOUND THEN
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.match_sms_to_member IS 'Matches SMS sender phone to SACCO member by phone hash';

-- =====================================================
-- Function: app.match_sms_to_member_by_name
-- Matches sender name to a SACCO member (fuzzy matching)
-- =====================================================
CREATE OR REPLACE FUNCTION app.match_sms_to_member_by_name(
  p_sacco_id UUID,
  p_sender_name TEXT
)
RETURNS TABLE(
  member_id UUID,
  confidence DECIMAL(3,2),
  match_method TEXT
) AS $$
DECLARE
  v_normalized_name TEXT;
BEGIN
  -- Normalize name: lowercase, remove extra spaces
  v_normalized_name := lower(trim(regexp_replace(p_sender_name, '\s+', ' ', 'g')));

  -- Try exact match on first_name last_name
  RETURN QUERY
  SELECT 
    m.id,
    0.80::DECIMAL(3,2) AS confidence,
    'name'::TEXT AS match_method
  FROM app.members m
  WHERE m.sacco_id = p_sacco_id
    AND lower(trim(m.first_name || ' ' || m.last_name)) = v_normalized_name
    AND m.status = 'active'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN;
  END IF;

  -- Try partial match on last name
  RETURN QUERY
  SELECT 
    m.id,
    0.60::DECIMAL(3,2) AS confidence,
    'name'::TEXT AS match_method
  FROM app.members m
  WHERE m.sacco_id = p_sacco_id
    AND lower(m.last_name) = ANY(string_to_array(v_normalized_name, ' '))
    AND m.status = 'active'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.match_sms_to_member_by_name IS 'Matches SMS sender name to SACCO member by name fuzzy matching';

-- =====================================================
-- Function: app.process_sacco_payment
-- Processes a payment: creates payment record, updates balance, creates ledger entry
-- =====================================================
CREATE OR REPLACE FUNCTION app.process_sacco_payment(
  p_sacco_id UUID,
  p_member_id UUID,
  p_amount DECIMAL(15,2),
  p_reference TEXT,
  p_transaction_id TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_sms_inbox_id UUID DEFAULT NULL,
  p_account_type TEXT DEFAULT 'savings'
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_account_id UUID;
  v_balance_before DECIMAL(15,2);
  v_balance_after DECIMAL(15,2);
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive: %', p_amount;
  END IF;

  -- Verify member exists and belongs to SACCO
  IF NOT EXISTS (
    SELECT 1 FROM app.members 
    WHERE id = p_member_id 
      AND sacco_id = p_sacco_id 
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Member not found or inactive: %', p_member_id;
  END IF;

  -- Get or create account
  SELECT id, balance INTO v_account_id, v_balance_before
  FROM app.accounts
  WHERE sacco_id = p_sacco_id
    AND member_id = p_member_id
    AND account_type = p_account_type;

  IF v_account_id IS NULL THEN
    -- Create new account
    INSERT INTO app.accounts (sacco_id, member_id, account_type, balance)
    VALUES (p_sacco_id, p_member_id, p_account_type, 0)
    RETURNING id, balance INTO v_account_id, v_balance_before;
  END IF;

  -- Create payment record
  INSERT INTO app.payments (
    sacco_id,
    member_id,
    sms_inbox_id,
    amount,
    transaction_id,
    provider,
    payment_type,
    reference,
    status,
    completed_at
  )
  VALUES (
    p_sacco_id,
    p_member_id,
    p_sms_inbox_id,
    p_amount,
    p_transaction_id,
    p_provider,
    'deposit',
    p_reference,
    'completed',
    now()
  )
  RETURNING id INTO v_payment_id;

  -- Update account balance
  v_balance_after := v_balance_before + p_amount;
  
  UPDATE app.accounts
  SET balance = v_balance_after,
      updated_at = now()
  WHERE id = v_account_id;

  -- Create ledger entry (credit - money coming in)
  INSERT INTO app.ledger_entries (
    sacco_id,
    account_id,
    payment_id,
    entry_type,
    amount,
    balance_before,
    balance_after,
    description
  )
  VALUES (
    p_sacco_id,
    v_account_id,
    v_payment_id,
    'credit',
    p_amount,
    v_balance_before,
    v_balance_after,
    COALESCE(p_reference, 'Payment via MoMo')
  );

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app.process_sacco_payment IS 'Processes a SACCO payment: creates payment, updates balance, creates ledger entry';

COMMIT;
