-- Migration: Add wallet_get_balance RPC
-- Created: 2025-11-23
-- Purpose: Add RPC function to get user's token balance.

CREATE OR REPLACE FUNCTION public.wallet_get_balance(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Calculate balance from wallet_entries
  SELECT COALESCE(SUM(amount_tokens), 0)
  INTO v_balance
  FROM public.wallet_entries
  WHERE profile_id = p_user_id;
  
  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_get_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_get_balance(uuid) TO authenticated;
