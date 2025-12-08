-- RPCs for insurance token allocation: list eligible policies and mark allocated
-- Created: 2025-11-23

BEGIN;

-- List eligible insurance policies (active and not yet tokens_allocated)
CREATE OR REPLACE FUNCTION public.wallet_insurance_eligible(
  p_user_id uuid DEFAULT NULL,
  p_whatsapp text DEFAULT NULL
)
RETURNS TABLE(policy_id uuid, user_id uuid, policy_number text, insurer text, valid_until timestamptz)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT ip.id, ip.user_id, ip.policy_number, ip.insurer, ip.valid_until
  FROM public.insurance_policies ip
  LEFT JOIN public.profiles p ON p.user_id = ip.user_id
  WHERE ip.status = 'active'
    AND COALESCE(ip.tokens_allocated, false) = false
    AND (p_user_id IS NULL OR ip.user_id = p_user_id)
    AND (p_whatsapp IS NULL OR p.whatsapp_e164 = p_whatsapp)
  ORDER BY ip.valid_until DESC NULLS LAST, ip.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.wallet_insurance_eligible(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_insurance_eligible(uuid, text) TO authenticated;

-- Simple marker to flip tokens_allocated after awarding via transfer
CREATE OR REPLACE FUNCTION public.allocate_insurance_tokens_simple(
  p_policy_id uuid
)
RETURNS TABLE(success boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT tokens_allocated INTO v_exists FROM public.insurance_policies WHERE id = p_policy_id;
  IF v_exists IS NULL THEN
    RETURN QUERY SELECT false, 'policy_not_found'; RETURN;
  END IF;
  IF v_exists = true THEN
    RETURN QUERY SELECT false, 'already_allocated'; RETURN;
  END IF;
  UPDATE public.insurance_policies SET tokens_allocated = true, updated_at = now() WHERE id = p_policy_id;
  RETURN QUERY SELECT true, 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_insurance_tokens_simple(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.allocate_insurance_tokens_simple(uuid) TO authenticated;

COMMIT;

