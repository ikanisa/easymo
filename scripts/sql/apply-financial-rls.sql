-- Enable RLS on all financial tables

-- Wallet Accounts
ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet accounts" ON wallet_accounts;
CREATE POLICY "Users can view own wallet accounts"
  ON wallet_accounts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all wallets" ON wallet_accounts;
CREATE POLICY "Service role can manage all wallets"
  ON wallet_accounts FOR ALL
  USING (auth.role() = 'service_role');

-- Wallet Entries (Double-entry bookkeeping)
ALTER TABLE wallet_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own entries" ON wallet_entries;
CREATE POLICY "Users can view own entries"
  ON wallet_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wallet_accounts wa 
      WHERE wa.id = wallet_entries.account_id 
        AND wa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Only service role can create entries" ON wallet_entries;
CREATE POLICY "Only service role can create entries"
  ON wallet_entries FOR INSERT
  USING (auth.role() = 'service_role');

-- Wallet Transactions
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  USING (
    source_user_id = auth.uid() OR 
    destination_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Only service role can create transactions" ON wallet_transactions;
CREATE POLICY "Only service role can create transactions"
  ON wallet_transactions FOR INSERT
  USING (auth.role() = 'service_role');

-- Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages payments" ON payments;
CREATE POLICY "Service role manages payments"
  ON payments FOR ALL
  USING (auth.role() = 'service_role');
