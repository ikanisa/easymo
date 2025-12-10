-- Migration: Add Wallet Transfer RPC
-- Created: 2025-11-23
-- Purpose: Enable token transfers between users

BEGIN;

CREATE OR REPLACE FUNCTION public.wallet_transfer_tokens(
    p_sender uuid,
    p_recipient_whatsapp text DEFAULT NULL,
    p_amount integer,
    p_idempotency_key text DEFAULT NULL,
    p_recipient uuid DEFAULT NULL
)
RETURNS TABLE(
    success boolean,
    reason text,
    transfer_id uuid,
    recipient_profile uuid,
    recipient_tokens integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_tokens integer := 0;
    v_sender uuid := p_sender;
    v_recipient_id uuid := p_recipient;
    v_from record;
    v_to record;
    v_exists uuid;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN QUERY SELECT false, 'invalid_amount', NULL::uuid, NULL::uuid, NULL::integer; RETURN;
    END IF;

    -- Resolve system sender if not provided
    IF v_sender IS NULL THEN
      SELECT public.wallet_system_profile() INTO v_sender;
    END IF;
    IF v_sender IS NULL THEN
      RETURN QUERY SELECT false, 'system_not_configured', NULL::uuid, NULL::uuid, NULL::integer; RETURN;
    END IF;

    -- Resolve recipient by WhatsApp if needed
    IF v_recipient_id IS NULL AND p_recipient_whatsapp IS NOT NULL THEN
      SELECT user_id INTO v_recipient_id FROM public.profiles WHERE whatsapp_e164 = p_recipient_whatsapp LIMIT 1;
    END IF;
    IF v_recipient_id IS NULL THEN
      RETURN QUERY SELECT false, 'recipient_not_found', NULL::uuid, NULL::uuid, NULL::integer; RETURN;
    END IF;
    IF v_recipient_id = p_sender THEN
      RETURN QUERY SELECT false, 'cannot_transfer_to_self', NULL::uuid, v_recipient_id, NULL::integer; RETURN;
    END IF;

    -- Check sender tokens via wallet_accounts
    SELECT COALESCE(tokens, 0) INTO v_sender_tokens FROM public.wallet_accounts WHERE profile_id = v_sender;
    IF v_sender_tokens < 2000 THEN
      RETURN QUERY SELECT false, 'insufficient_balance_minimum', NULL::uuid, v_recipient_id, v_sender_tokens; RETURN;
    END IF;
    IF v_sender_tokens < p_amount THEN
      RETURN QUERY SELECT false, 'insufficient_balance', NULL::uuid, v_recipient_id, v_sender_tokens; RETURN;
    END IF;

    -- Idempotency best-effort by meta key in wallet entries ledger via wallet_transfer meta
    PERFORM 1;
    SELECT id INTO v_exists FROM public.wallet_transactions
      WHERE profile_id = p_sender AND description ilike concat('%', coalesce(p_idempotency_key,''), '%')
      ORDER BY occurred_at DESC LIMIT 1;
    IF v_exists IS NOT NULL THEN
      RETURN QUERY SELECT false, 'duplicate_transfer', v_exists, v_recipient_id, v_sender_tokens; RETURN;
    END IF;

    -- Apply transfer via core engine
    WITH res AS (
      SELECT * FROM public.wallet_transfer(
        p_from := v_sender,
        p_to := v_recipient_id,
        p_amount := p_amount,
        p_reason := 'transfer',
        p_meta := jsonb_build_object('idempotency_key', coalesce(p_idempotency_key, gen_random_uuid()::text))
      )
    )
    SELECT * FROM res INTO v_from;

    -- Return updated recipient tokens
    SELECT COALESCE(tokens, 0) FROM public.wallet_accounts WHERE profile_id = v_recipient_id INTO STRICT recipient_tokens;

    RETURN QUERY SELECT true, 'success', NULL::uuid, v_recipient_id, recipient_tokens;
END;
$$;

-- Create wallet_transfers table if it doesn't exist
GRANT EXECUTE ON FUNCTION public.wallet_transfer_tokens(uuid, text, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_transfer_tokens(uuid, text, integer, text, uuid) TO authenticated;

COMMIT;
