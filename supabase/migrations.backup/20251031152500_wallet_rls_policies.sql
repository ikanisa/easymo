-- tighten wallet domain access with row-level security and scoped policies
BEGIN;

-- Enable and enforce RLS on wallet tables
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_earn_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_redeem_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_promoters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS wallet_service_all ON public.wallets;
DROP POLICY IF EXISTS wallet_self_select ON public.wallets;
DROP POLICY IF EXISTS wallet_ledger_service_all ON public.wallet_ledger;
DROP POLICY IF EXISTS wallet_ledger_self_select ON public.wallet_ledger;
DROP POLICY IF EXISTS wallet_accounts_service_all ON public.wallet_accounts;
DROP POLICY IF EXISTS wallet_accounts_self_select ON public.wallet_accounts;
DROP POLICY IF EXISTS wallet_transactions_service_all ON public.wallet_transactions;
DROP POLICY IF EXISTS wallet_transactions_self_select ON public.wallet_transactions;
DROP POLICY IF EXISTS wallet_earn_actions_read ON public.wallet_earn_actions;
DROP POLICY IF EXISTS wallet_redeem_options_read ON public.wallet_redeem_options;
DROP POLICY IF EXISTS wallet_promoters_read ON public.wallet_promoters;

-- Wallet balances (aggregate per user)
CREATE POLICY wallet_service_all
  ON public.wallets
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY wallet_self_select
  ON public.wallets
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Wallet ledger entries
CREATE POLICY wallet_ledger_service_all
  ON public.wallet_ledger
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY wallet_ledger_self_select
  ON public.wallet_ledger
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Legacy wallet accounts/transactions tables retain self-read semantics
CREATE POLICY wallet_accounts_service_all
  ON public.wallet_accounts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY wallet_accounts_self_select
  ON public.wallet_accounts
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND auth.uid() = profile_id
  );

CREATE POLICY wallet_transactions_service_all
  ON public.wallet_transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY wallet_transactions_self_select
  ON public.wallet_transactions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = profile_id);

-- Reference data for wallet earn/redeem/promoter leaderboards: readable to authenticated users, mutable by service role only
CREATE POLICY wallet_earn_actions_read
  ON public.wallet_earn_actions
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY wallet_redeem_options_read
  ON public.wallet_redeem_options
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY wallet_promoters_read
  ON public.wallet_promoters
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

COMMIT;
