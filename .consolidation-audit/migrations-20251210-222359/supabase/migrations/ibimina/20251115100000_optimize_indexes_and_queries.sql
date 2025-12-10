-- Migration: Optimize Indexes and Queries for Performance
-- Description: Adds missing indexes on ledger_entries and other frequently queried tables
-- to improve performance of account balance calculations and other queries.
-- Part of backend refactoring initiative.

-- Add indexes on ledger_entries for debit_id and credit_id
-- These indexes significantly improve the account_balance function performance
-- by enabling efficient lookups on both debit and credit sides
CREATE INDEX IF NOT EXISTS idx_ledger_entries_debit_id 
  ON app.ledger_entries(debit_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_credit_id 
  ON app.ledger_entries(credit_id);

-- Add composite index for common query patterns
-- This covers queries that filter by account and need to aggregate amounts
CREATE INDEX IF NOT EXISTS idx_ledger_entries_debit_amount 
  ON app.ledger_entries(debit_id, amount);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_credit_amount 
  ON app.ledger_entries(credit_id, amount);

-- Add index on user_profiles.user_id if not exists
-- This optimizes lookups in current_sacco, current_role, and other user profile queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
  ON app.user_profiles(user_id);

-- Add composite index for sacco-scoped queries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_sacco_created 
  ON app.ledger_entries(sacco_id, created_at DESC) 
  WHERE sacco_id IS NOT NULL;

-- Add index on accounts.sacco_id for efficient sacco-scoped account queries
CREATE INDEX IF NOT EXISTS idx_accounts_sacco_id 
  ON app.accounts(sacco_id) 
  WHERE sacco_id IS NOT NULL;

-- Add index on members.sacco_id for efficient member lookups
CREATE INDEX IF NOT EXISTS idx_members_sacco_id 
  ON app.members(sacco_id) 
  WHERE sacco_id IS NOT NULL;

-- Add index on payments.sacco_id for efficient payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_sacco_id 
  ON app.payments(sacco_id) 
  WHERE sacco_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON INDEX app.idx_ledger_entries_debit_id IS 
  'Optimizes account_balance queries by enabling efficient lookups of debit transactions';

COMMENT ON INDEX app.idx_ledger_entries_credit_id IS 
  'Optimizes account_balance queries by enabling efficient lookups of credit transactions';

COMMENT ON INDEX app.idx_user_profiles_user_id IS 
  'Optimizes user profile lookups in current_sacco, current_role, and related functions';

-- Analyze tables to update statistics after index creation
ANALYZE app.ledger_entries;
ANALYZE app.user_profiles;
ANALYZE app.accounts;
ANALYZE app.members;
ANALYZE app.payments;
