-- Migration: Add wallet_top_promoters RPC function
-- Date: 2025-11-24
-- Purpose: Show referral leaderboard for wallet

BEGIN;

CREATE OR REPLACE FUNCTION public.wallet_top_promoters(
  _limit integer DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  phone text,
  referral_count bigint,
  tokens_earned bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ur.referrer_id as user_id,
    p.whatsapp_e164 as phone,
    COUNT(ur.id)::bigint as referral_count,
    COALESCE(SUM(ur.reward_amount), 0)::bigint as tokens_earned
  FROM user_referrals ur
  LEFT JOIN profiles p ON p.user_id = ur.referrer_id
  WHERE ur.status = 'completed'
  GROUP BY ur.referrer_id, p.whatsapp_e164
  ORDER BY referral_count DESC, tokens_earned DESC
  LIMIT _limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.wallet_top_promoters(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_top_promoters(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_top_promoters(integer) TO anon;

COMMENT ON FUNCTION public.wallet_top_promoters IS 'Returns top referrers by successful referral count';

COMMIT;
