-- Wallet & Token System Security Fixes
-- Date: 2025-12-03
-- Purpose: Add balance validation, transaction limits, audit trails, and fraud detection

BEGIN;

-- ============================================================================
-- PART 1: TABLE MODIFICATIONS
-- ============================================================================

-- Add constraints and status to wallet_accounts
ALTER TABLE wallet_accounts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended')),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'RWF',
  ADD CONSTRAINT wallet_accounts_tokens_non_negative CHECK (tokens >= 0);

-- Add balance snapshots to wallet_entries
ALTER TABLE wallet_entries
  ADD COLUMN IF NOT EXISTS balance_before INTEGER,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_entries_reference ON wallet_entries(reference_table, reference_id);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'wallet_entries' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wallet_entries_created_at ON wallet_entries(created_at DESC)';
  ELSE
    RAISE NOTICE 'wallet_entries.created_at missing; skipping idx_wallet_entries_created_at';
  END IF;
END$$;

-- Add status and expiry to token_allocations
ALTER TABLE token_allocations
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'failed')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(user_id),
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_token_allocations_status ON token_allocations(status);
CREATE INDEX IF NOT EXISTS idx_token_allocations_idempotency ON token_allocations(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- PART 2: NEW TABLES
-- ============================================================================

-- Transaction limits per user
CREATE TABLE IF NOT EXISTS wallet_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  max_transfer_per_transaction INTEGER DEFAULT 10000,
  max_transfer_per_day INTEGER DEFAULT 50000,
  max_allocations_per_day INTEGER DEFAULT 5,
  max_redemptions_per_day INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_limits_profile ON wallet_limits(profile_id);

COMMENT ON TABLE wallet_limits IS 'Transaction limits per user to prevent abuse';

-- Fraud detection alerts
CREATE TABLE IF NOT EXISTS wallet_fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('rapid_transfers', 'large_amount', 'unusual_pattern', 'negative_balance_attempt', 'limit_exceeded')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  assigned_to UUID REFERENCES profiles(user_id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON wallet_fraud_alerts(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_profile ON wallet_fraud_alerts(profile_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created ON wallet_fraud_alerts(created_at DESC);

COMMENT ON TABLE wallet_fraud_alerts IS 'Fraud detection alerts for suspicious wallet activity';

-- Daily reconciliation reports
CREATE TABLE IF NOT EXISTS wallet_reconciliation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  total_accounts INTEGER,
  total_balance INTEGER,
  discrepancies_found INTEGER DEFAULT 0,
  discrepancy_details JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'clean', 'issues_found', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_date ON wallet_reconciliation_reports(report_date DESC);

COMMENT ON TABLE wallet_reconciliation_reports IS 'Daily wallet balance reconciliation reports';

-- ============================================================================
-- PART 3: RPC FUNCTIONS
-- ============================================================================

-- Enhanced wallet_delta_fn with balance validation
CREATE OR REPLACE FUNCTION wallet_delta_fn(
  p_profile_id UUID,
  p_amount_tokens INTEGER,
  p_entry_type TEXT,
  p_reference_table TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error TEXT) AS $$
DECLARE
  v_account_id UUID;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_account_status TEXT;
BEGIN
  -- Get account with lock
  SELECT id, tokens, status
  INTO v_account_id, v_current_balance, v_account_status
  FROM wallet_accounts
  WHERE profile_id = p_profile_id
  FOR UPDATE;
  
  -- Create account if doesn't exist
  IF v_account_id IS NULL THEN
    INSERT INTO wallet_accounts (profile_id, tokens)
    VALUES (p_profile_id, 0)
    RETURNING id, tokens INTO v_account_id, v_current_balance;
    v_account_status := 'active';
  END IF;
  
  -- Check account status
  IF v_account_status != 'active' THEN
    RETURN QUERY SELECT FALSE, v_current_balance, 'Account is ' || v_account_status;
    RETURN;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount_tokens;
  
  -- Validate balance won't go negative (for debits)
  IF v_new_balance < 0 THEN
    -- Log fraud alert
    INSERT INTO wallet_fraud_alerts (profile_id, alert_type, severity, details)
    VALUES (
      p_profile_id,
      'negative_balance_attempt',
      'high',
      jsonb_build_object(
        'current_balance', v_current_balance,
        'attempted_debit', p_amount_tokens,
        'entry_type', p_entry_type
      )
    );
    
    RETURN QUERY SELECT FALSE, v_current_balance, 'Insufficient balance';
    RETURN;
  END IF;
  
  -- Update balance
  UPDATE wallet_accounts
  SET tokens = v_new_balance,
      updated_at = NOW()
  WHERE id = v_account_id;
  
  -- Create entry with balance snapshots
  INSERT INTO wallet_entries (
    wallet_account_id,
    amount,
    entry_type,
    reference_table,
    reference_id,
    balance_before,
    balance_after,
    status
  ) VALUES (
    v_account_id,
    p_amount_tokens,
    p_entry_type,
    p_reference_table,
    p_reference_id,
    v_current_balance,
    v_new_balance,
    'completed'
  );
  
  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION wallet_delta_fn IS 'Add or subtract tokens with balance validation and audit trail';

-- Check transfer limits
CREATE OR REPLACE FUNCTION check_transfer_limits(
  p_profile_id UUID,
  p_amount INTEGER
) RETURNS TABLE(allowed BOOLEAN, reason TEXT) AS $$
DECLARE
  v_daily_total INTEGER;
  v_max_per_tx INTEGER;
  v_max_per_day INTEGER;
BEGIN
  -- Get limits (create default if doesn't exist)
  SELECT max_transfer_per_transaction, max_transfer_per_day
  INTO v_max_per_tx, v_max_per_day
  FROM wallet_limits
  WHERE profile_id = p_profile_id;
  
  IF v_max_per_tx IS NULL THEN
    -- Create default limits
    INSERT INTO wallet_limits (profile_id)
    VALUES (p_profile_id)
    RETURNING max_transfer_per_transaction, max_transfer_per_day
    INTO v_max_per_tx, v_max_per_day;
  END IF;
  
  -- Check per-transaction limit
  IF p_amount > v_max_per_tx THEN
    RETURN QUERY SELECT FALSE, 'Transfer exceeds per-transaction limit of ' || v_max_per_tx || ' tokens';
    RETURN;
  END IF;
  
  -- Check daily limit
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO v_daily_total
  FROM wallet_entries we
  JOIN wallet_accounts wa ON wa.id = we.wallet_account_id
  WHERE wa.profile_id = p_profile_id
    AND we.entry_type IN ('transfer_out', 'p2p_transfer')
    AND we.created_at >= CURRENT_DATE
    AND we.status = 'completed';
  
  IF v_daily_total + p_amount > v_max_per_day THEN
    RETURN QUERY SELECT FALSE, 'Daily transfer limit of ' || v_max_per_day || ' tokens exceeded';
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_transfer_limits IS 'Validate transfer against user limits';

-- Verify wallet balance (audit function)
CREATE OR REPLACE FUNCTION verify_wallet_balance(p_profile_id UUID DEFAULT NULL)
RETURNS TABLE(
  profile_id UUID,
  expected_balance INTEGER,
  actual_balance INTEGER,
  discrepancy INTEGER,
  entry_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wa.profile_id,
    COALESCE(SUM(we.amount), 0)::INTEGER as expected_balance,
    wa.tokens as actual_balance,
    (wa.tokens - COALESCE(SUM(we.amount), 0))::INTEGER as discrepancy,
    COUNT(we.id)::INTEGER as entry_count
  FROM wallet_accounts wa
  LEFT JOIN wallet_entries we ON we.wallet_account_id = wa.id
  WHERE p_profile_id IS NULL OR wa.profile_id = p_profile_id
  GROUP BY wa.id, wa.profile_id, wa.tokens
  HAVING wa.tokens != COALESCE(SUM(we.amount), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_wallet_balance IS 'Audit wallet balances for discrepancies';

-- Detect fraud patterns
CREATE OR REPLACE FUNCTION detect_fraud_patterns()
RETURNS INTEGER AS $$
DECLARE
  v_alerts_created INTEGER := 0;
BEGIN
  -- Rapid transfers (>5 in 1 hour)
  INSERT INTO wallet_fraud_alerts (profile_id, alert_type, severity, details)
  SELECT 
    wa.profile_id,
    'rapid_transfers',
    'medium',
    jsonb_build_object(
      'count', COUNT(*),
      'window', '1 hour',
      'total_amount', SUM(ABS(we.amount))
    )
  FROM wallet_entries we
  JOIN wallet_accounts wa ON wa.id = we.wallet_account_id
  WHERE we.created_at > NOW() - INTERVAL '1 hour'
    AND we.entry_type IN ('transfer_out', 'p2p_transfer')
    AND we.status = 'completed'
  GROUP BY wa.profile_id
  HAVING COUNT(*) > 5
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_alerts_created = ROW_COUNT;
  
  RETURN v_alerts_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION detect_fraud_patterns IS 'Detect suspicious wallet activity patterns';

-- Run daily reconciliation
CREATE OR REPLACE FUNCTION run_daily_reconciliation()
RETURNS UUID AS $$
DECLARE
  v_report_id UUID;
  v_discrepancies INTEGER := 0;
  v_details JSONB := '[]'::JSONB;
  v_total_accounts INTEGER;
  v_total_balance INTEGER;
  r RECORD;
BEGIN
  -- Get totals
  SELECT COUNT(*), COALESCE(SUM(tokens), 0)
  INTO v_total_accounts, v_total_balance
  FROM wallet_accounts;
  
  -- Create report
  INSERT INTO wallet_reconciliation_reports (
    report_date,
    total_accounts,
    total_balance
  ) VALUES (
    CURRENT_DATE,
    v_total_accounts,
    v_total_balance
  )
  ON CONFLICT (report_date) DO UPDATE
  SET total_accounts = EXCLUDED.total_accounts,
      total_balance = EXCLUDED.total_balance
  RETURNING id INTO v_report_id;
  
  -- Check for discrepancies
  FOR r IN (SELECT * FROM verify_wallet_balance()) LOOP
    v_discrepancies := v_discrepancies + 1;
    v_details := v_details || jsonb_build_object(
      'profile_id', r.profile_id,
      'expected', r.expected_balance,
      'actual', r.actual_balance,
      'discrepancy', r.discrepancy,
      'entry_count', r.entry_count
    );
  END LOOP;
  
  -- Update report
  UPDATE wallet_reconciliation_reports
  SET discrepancies_found = v_discrepancies,
      discrepancy_details = v_details,
      status = CASE WHEN v_discrepancies = 0 THEN 'clean' ELSE 'issues_found' END,
      completed_at = NOW()
  WHERE id = v_report_id;
  
  RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION run_daily_reconciliation IS 'Run daily wallet balance reconciliation';

-- Get wallet statistics (for admin dashboard)
CREATE OR REPLACE FUNCTION get_wallet_statistics()
RETURNS TABLE(
  total_accounts INTEGER,
  total_balance BIGINT,
  total_allocated_today INTEGER,
  total_transferred_today INTEGER,
  avg_balance NUMERIC,
  median_balance INTEGER,
  fraud_alerts_open INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM wallet_accounts),
    (SELECT COALESCE(SUM(tokens), 0) FROM wallet_accounts),
    (SELECT COALESCE(SUM(amount), 0)::INTEGER FROM token_allocations WHERE created_at >= CURRENT_DATE),
    (SELECT COALESCE(SUM(ABS(amount)), 0)::INTEGER FROM wallet_entries WHERE entry_type = 'p2p_transfer' AND created_at >= CURRENT_DATE),
    (SELECT COALESCE(AVG(tokens), 0) FROM wallet_accounts),
    (SELECT COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tokens), 0)::INTEGER FROM wallet_accounts),
    (SELECT COUNT(*)::INTEGER FROM wallet_fraud_alerts WHERE status = 'open');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_wallet_statistics IS 'Get wallet system statistics for admin dashboard';

-- ============================================================================
-- PART 4: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on token tables (if not already enabled)
DO $$ BEGIN
  ALTER TABLE token_allocations ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE token_rewards ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE token_partners ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS token_allocations_select_own ON token_allocations;
DROP POLICY IF EXISTS token_allocations_insert_service ON token_allocations;

-- Users can only see their own allocations
CREATE POLICY token_allocations_select_own
  ON token_allocations FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert allocations
CREATE POLICY token_allocations_insert_service
  ON token_allocations FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Enable RLS on wallet tables
DO $$ BEGIN
  ALTER TABLE wallet_limits ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE wallet_fraud_alerts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Users can see their own limits
DROP POLICY IF EXISTS wallet_limits_select_own ON wallet_limits;
CREATE POLICY wallet_limits_select_own
  ON wallet_limits FOR SELECT
  USING (auth.uid() = profile_id);

-- Service role can manage limits
DROP POLICY IF EXISTS wallet_limits_all_service ON wallet_limits;
CREATE POLICY wallet_limits_all_service
  ON wallet_limits FOR ALL
  USING (auth.role() = 'service_role');

-- Only admins can see fraud alerts
DROP POLICY IF EXISTS wallet_fraud_alerts_select_admin ON wallet_fraud_alerts;
CREATE POLICY wallet_fraud_alerts_select_admin
  ON wallet_fraud_alerts FOR SELECT
  USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 5: GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON wallet_accounts TO authenticated;
GRANT SELECT ON wallet_entries TO authenticated;
GRANT SELECT ON token_allocations TO authenticated;
GRANT SELECT ON token_redemptions TO authenticated;
GRANT SELECT ON token_rewards TO authenticated, anon;
GRANT SELECT ON token_partners TO authenticated, anon;
GRANT SELECT ON wallet_limits TO authenticated;

GRANT EXECUTE ON FUNCTION wallet_delta_fn TO service_role;
GRANT EXECUTE ON FUNCTION check_transfer_limits TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION verify_wallet_balance TO service_role;
GRANT EXECUTE ON FUNCTION detect_fraud_patterns TO service_role;
GRANT EXECUTE ON FUNCTION run_daily_reconciliation TO service_role;
GRANT EXECUTE ON FUNCTION get_wallet_statistics TO service_role;

COMMIT;
