-- Fix for 20251020200000_wallet_rework.sql
-- Add missing columns to wallet tables

BEGIN;

-- Check first error from wallet_rework to see what's missing
-- Adding commonly needed wallet columns

ALTER TABLE public.wallet_accounts
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.wallet_accounts
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.wallet_accounts
ADD COLUMN IF NOT EXISTS kyc_level TEXT DEFAULT 'basic';

ALTER TABLE public.wallet_accounts
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- wallet_transactions enhancements
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS reference_id TEXT;

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_status 
  ON public.wallet_accounts(status);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status 
  ON public.wallet_transactions(status);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference 
  ON public.wallet_transactions(reference_id);

COMMIT;
