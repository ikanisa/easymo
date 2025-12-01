-- Migration: Financial Tables RLS Policies
-- Description: Comprehensive Row Level Security for all financial tables
-- Author: Production Readiness Initiative - Phase 1
-- Date: 2025-11-27

BEGIN;

-- =====================================================
-- WALLET ACCOUNTS
-- =====================================================
ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet accounts
DROP POLICY IF EXISTS "Users can view own wallet accounts" ON wallet_accounts;
CREATE POLICY "Users can view own wallet accounts"
  ON wallet_accounts FOR SELECT
  USING (user_id = auth.uid()::TEXT);

-- Service role can manage all wallets
DROP POLICY IF EXISTS "Service role can manage all wallets" ON wallet_accounts;
CREATE POLICY "Service role can manage all wallets"
  ON wallet_accounts FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON POLICY "Users can view own wallet accounts" ON wallet_accounts IS 
  'Users can only see their own wallet balances and information';

-- =====================================================
-- WALLET ENTRIES (Double-entry bookkeeping)
-- =====================================================
ALTER TABLE wallet_entries ENABLE ROW LEVEL SECURITY;

-- Users can view entries related to their accounts
DROP POLICY IF EXISTS "Users can view own entries" ON wallet_entries;
CREATE POLICY "Users can view own entries"
  ON wallet_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wallet_accounts wa 
      WHERE wa.id = wallet_entries.account_id 
        AND wa.user_id = auth.uid()::TEXT
    )
  );

-- Only service role can create/modify entries (integrity protection)
DROP POLICY IF EXISTS "Only service role can create entries" ON wallet_entries;
CREATE POLICY "Only service role can create entries"
  ON wallet_entries FOR INSERT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can update entries" ON wallet_entries;
CREATE POLICY "Only service role can update entries"
  ON wallet_entries FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can delete entries" ON wallet_entries;
CREATE POLICY "Only service role can delete entries"
  ON wallet_entries FOR DELETE
  USING (auth.role() = 'service_role');

COMMENT ON POLICY "Users can view own entries" ON wallet_entries IS 
  'Users can view ledger entries for their accounts but cannot modify them';

-- =====================================================
-- WALLET TRANSACTIONS
-- =====================================================
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view transactions they're involved in
DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  USING (
    source_user_id = auth.uid()::TEXT OR 
    destination_user_id = auth.uid()::TEXT
  );

-- Only service role can create/modify transactions
DROP POLICY IF EXISTS "Only service role can create transactions" ON wallet_transactions;
CREATE POLICY "Only service role can create transactions"
  ON wallet_transactions FOR INSERT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Only service role can update transactions" ON wallet_transactions;
CREATE POLICY "Only service role can update transactions"
  ON wallet_transactions FOR UPDATE
  USING (auth.role() = 'service_role');

COMMENT ON POLICY "Users can view own transactions" ON wallet_transactions IS 
  'Users can see transactions where they are sender or recipient';

-- =====================================================
-- PAYMENTS (if table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own payments" ON payments;
    CREATE POLICY "Users can view own payments"
      ON payments FOR SELECT
      USING (user_id = auth.uid()::TEXT);
    
    DROP POLICY IF EXISTS "Service role manages payments" ON payments;
    CREATE POLICY "Service role manages payments"
      ON payments FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =====================================================
-- PAYMENT INTENTS (if table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_intents') THEN
    ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own payment intents" ON payment_intents;
    CREATE POLICY "Users can view own payment intents"
      ON payment_intents FOR SELECT
      USING (user_id = auth.uid()::TEXT);
    
    DROP POLICY IF EXISTS "Service role manages payment intents" ON payment_intents;
    CREATE POLICY "Service role manages payment intents"
      ON payment_intents FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =====================================================
-- MOMO TRANSACTIONS (if table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'momo_transactions') THEN
    ALTER TABLE momo_transactions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own momo transactions" ON momo_transactions;
    CREATE POLICY "Users can view own momo transactions"
      ON momo_transactions FOR SELECT
      USING (user_id = auth.uid()::TEXT OR phone_number IN (
        SELECT phone FROM user_profiles WHERE id = auth.uid()::TEXT
      ));
    
    DROP POLICY IF EXISTS "Service role manages momo transactions" ON momo_transactions;
    CREATE POLICY "Service role manages momo transactions"
      ON momo_transactions FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =====================================================
-- REVOLUT TRANSACTIONS (if table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revolut_transactions') THEN
    ALTER TABLE revolut_transactions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Service role only for revolut" ON revolut_transactions;
    CREATE POLICY "Service role only for revolut"
      ON revolut_transactions FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =====================================================
-- INVOICES (if table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
    CREATE POLICY "Users can view own invoices"
      ON invoices FOR SELECT
      USING (customer_id = auth.uid()::TEXT OR vendor_id = auth.uid()::TEXT);
    
    DROP POLICY IF EXISTS "Service role manages invoices" ON invoices;
    CREATE POLICY "Service role manages invoices"
      ON invoices FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =====================================================
-- SUBSCRIPTIONS (if table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
    CREATE POLICY "Users can view own subscriptions"
      ON subscriptions FOR SELECT
      USING (user_id = auth.uid()::TEXT);
    
    DROP POLICY IF EXISTS "Service role manages subscriptions" ON subscriptions;
    CREATE POLICY "Service role manages subscriptions"
      ON subscriptions FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =====================================================
-- REFUNDS (if table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refunds') THEN
    ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own refunds" ON refunds;
    CREATE POLICY "Users can view own refunds"
      ON refunds FOR SELECT
      USING (user_id = auth.uid()::TEXT);
    
    DROP POLICY IF EXISTS "Service role manages refunds" ON refunds;
    CREATE POLICY "Service role manages refunds"
      ON refunds FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMIT;
