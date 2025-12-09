-- Migration: Aggregates RPC for Group Deposits
-- Description: Creates optimized RPC function for aggregating deposits by group (ikimina)
-- Dependencies: payments and ibimina tables (created in bootstrap migrations)

-- Create index on payments.ikimina_id for efficient group deposit aggregation
-- This index significantly improves performance when summing deposits by group
CREATE INDEX IF NOT EXISTS idx_payments_ikimina_id ON public.payments(ikimina_id);

-- Create composite index on ikimina_id and status for even faster aggregation
-- This covers the WHERE clause in sum_group_deposits function
CREATE INDEX IF NOT EXISTS idx_payments_ikimina_status ON public.payments(ikimina_id, status);

-- Create or replace the sum_group_deposits function
-- This function efficiently aggregates all completed payments (deposits) for a specific group
-- Returns a JSON object with total amount and currency
CREATE OR REPLACE FUNCTION public.sum_group_deposits(gid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Aggregate all completed deposits for the specified group (ikimina)
  -- Returns JSON with total amount and currency (defaults to RWF if no deposits)
  SELECT jsonb_build_object(
    'amount', coalesce(sum(p.amount), 0),
    'currency', coalesce(nullif(max(p.currency), ''), 'RWF'),
    'count', count(p.id)
  )
  FROM public.payments p
  WHERE p.ikimina_id = gid 
    AND p.status = 'completed';
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.sum_group_deposits(uuid) IS 
'Aggregates all completed deposits for a specific group (ikimina). Returns JSON with total amount, currency, and count of deposits.';
