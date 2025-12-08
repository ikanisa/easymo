-- Transaction wrapper for production safety
BEGIN;

-- Add RPC function to get expiring policies
-- This function returns policies that expire in exactly N days from today

CREATE OR REPLACE FUNCTION get_expiring_policies(days_ahead INTEGER)
RETURNS TABLE (
  lead_id UUID,
  user_id UUID,
  wa_id TEXT,
  policy_expiry DATE,
  days_until_expiry INTEGER,
  insurer_name TEXT
) 
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT
    id AS lead_id,
    user_id,
    whatsapp AS wa_id,
    (extracted->>'policy_expiry')::DATE AS policy_expiry,
    ((extracted->>'policy_expiry')::DATE - CURRENT_DATE)::INTEGER AS days_until_expiry,
    extracted->>'insurer_name' AS insurer_name
  FROM insurance_leads
  WHERE status = 'ocr_ok'
    AND extracted IS NOT NULL
    AND extracted->>'policy_expiry' IS NOT NULL
    AND (extracted->>'policy_expiry')::DATE = CURRENT_DATE + days_ahead
    AND whatsapp IS NOT NULL
  ORDER BY policy_expiry ASC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_expiring_policies(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_expiring_policies(INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_expiring_policies IS 'Returns insurance policies expiring in exactly N days from today';

COMMIT;
