-- Migration: Optimize account_balance Function
-- Description: Refactors the account_balance function to use more efficient query patterns
-- with explicit index hints and better aggregation logic.
-- Part of backend refactoring initiative.

-- Drop the old function first
DROP FUNCTION IF EXISTS app.account_balance(uuid);

-- Create optimized version of account_balance function
-- This version uses a more efficient query pattern that better utilizes indexes
CREATE OR REPLACE FUNCTION app.account_balance(account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'app', 'public'
AS $function$
  -- Optimized query using UNION ALL and filtering to leverage indexes
  -- This approach allows PostgreSQL to use the debit_id and credit_id indexes separately
  SELECT COALESCE(SUM(amount_signed), 0)
  FROM (
    -- Credits (positive balance)
    SELECT amount AS amount_signed
    FROM app.ledger_entries
    WHERE credit_id = account_id
    
    UNION ALL
    
    -- Debits (negative balance)
    SELECT -amount AS amount_signed
    FROM app.ledger_entries
    WHERE debit_id = account_id
  ) AS movements;
$function$;

-- Add comment for documentation
COMMENT ON FUNCTION app.account_balance(uuid) IS 
  'Optimized function to calculate account balance by summing credits and debits. Uses UNION ALL pattern to leverage separate indexes on credit_id and debit_id.';

-- Also update the public schema version if it exists
DROP FUNCTION IF EXISTS public.account_balance(uuid);

CREATE OR REPLACE FUNCTION public.account_balance(account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
  SELECT app.account_balance(account_id);
$function$;

COMMENT ON FUNCTION public.account_balance(uuid) IS 
  'Wrapper function that delegates to app.account_balance for backward compatibility.';
