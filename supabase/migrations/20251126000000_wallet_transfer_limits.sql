-- Add RPC functions for wallet transfer security

-- Get total tokens transferred out today
CREATE OR REPLACE FUNCTION get_daily_transfer_total(p_user_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount_tokens), 0)
  FROM wallet_transfers
  WHERE sender_profile = p_user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
$$ LANGUAGE sql SECURITY DEFINER;

-- Get count of transfers in the last hour
CREATE OR REPLACE FUNCTION get_hourly_transfer_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM wallet_transfers
  WHERE sender_profile = p_user_id
    AND created_at >= NOW() - INTERVAL '1 hour'
$$ LANGUAGE sql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_daily_transfer_total(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_daily_transfer_total(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_hourly_transfer_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_hourly_transfer_count(UUID) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_daily_transfer_total IS 'Returns total tokens transferred out by user today';
COMMENT ON FUNCTION get_hourly_transfer_count IS 'Returns count of transfers made by user in last hour';
