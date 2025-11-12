-- Fix for 20260321090000_performance_indexes.sql
-- Correct table names and add proper indexes

BEGIN;

-- Drop any incorrectly named indexes
DROP INDEX IF EXISTS idx_transactions_timestamp;
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_transactions_status;

-- Create correct indexes on wallet_transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_timestamp 
  ON public.wallet_transactions(occurred_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_profile_id 
  ON public.wallet_transactions(profile_id);
  
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_direction 
  ON public.wallet_transactions(direction);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_currency
  ON public.wallet_transactions(currency);

-- Create index on wallet_accounts
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_profile_id
  ON public.wallet_accounts(profile_id);

COMMIT;
