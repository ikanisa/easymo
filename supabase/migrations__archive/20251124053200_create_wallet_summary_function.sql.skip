-- Create wallet_summary function
-- Migration: 20251124053200_create_wallet_summary_function.sql
-- Purpose: Return wallet balance and token summary for a user

BEGIN;

CREATE OR REPLACE FUNCTION wallet_summary(_profile_id UUID)
RETURNS TABLE (
  balance_minor INTEGER,
  pending_minor INTEGER,
  currency TEXT,
  tokens INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    0 AS balance_minor,  -- Reserved for future use (fiat balance in minor units)
    0 AS pending_minor,  -- Reserved for future use (pending transactions)
    'RWF'::TEXT AS currency,  -- Default currency
    COALESCE(wa.tokens, 0) AS tokens
  FROM wallet_accounts wa
  WHERE wa.profile_id = _profile_id
  LIMIT 1;
  
  -- If no wallet account exists, return zeros
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      0 AS balance_minor,
      0 AS pending_minor,
      'RWF'::TEXT AS currency,
      0 AS tokens;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION wallet_summary IS 'Returns wallet balance and token summary for a profile';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION wallet_summary TO authenticated, anon, service_role;

COMMIT;
