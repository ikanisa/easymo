-- Ensure legacy wallet index is renamed to avoid collisions with new transactions indexes
-- This migration addresses deployments that already created idx_transactions_user_created
-- on wallet_transactions via earlier migrations.

BEGIN;

DO $$
DECLARE
  wallet_idx_oid oid;
BEGIN
  SELECT c.oid
    INTO wallet_idx_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_class t ON t.oid = i.indrelid
   WHERE n.nspname = 'public'
     AND c.relname = 'idx_transactions_user_created'
     AND t.relname = 'wallet_transactions'
   LIMIT 1;

  IF wallet_idx_oid IS NOT NULL THEN
    ALTER INDEX public.idx_transactions_user_created RENAME TO idx_wallet_transactions_user_created;
  END IF;
END;
$$;

COMMIT;
