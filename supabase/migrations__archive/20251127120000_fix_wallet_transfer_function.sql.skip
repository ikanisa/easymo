-- Migration: Fix Wallet Transfer Function
-- Created: 2025-11-27
-- Purpose: Revert broken wallet_transfer_tokens and restore working implementation
-- Issue: 20251123152000 introduced a function that calls non-existent wallet_transfer()
-- Solution: Restore the working implementation from 20251118093000

BEGIN;

-- Drop the broken version
DROP FUNCTION IF EXISTS public.wallet_transfer_tokens(uuid, text, integer, text, uuid);

-- Restore working implementation with correct signature
CREATE OR REPLACE FUNCTION public.wallet_transfer_tokens(
  p_sender uuid,
  p_amount integer,
  p_recipient uuid DEFAULT NULL,
  p_recipient_whatsapp text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, reason text, transfer_id uuid, sender_tokens integer, recipient_tokens integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender uuid := p_sender;
  v_recipient uuid := p_recipient;
  v_amount integer := COALESCE(p_amount, 0);
  v_transfer_id uuid;
  v_sender_tokens integer;
  v_recipient_tokens integer;
  v_exists boolean;
  v_has_e164 boolean := false;
BEGIN
  IF v_sender IS NULL OR v_amount <= 0 THEN
    RETURN QUERY SELECT false, 'invalid_args', NULL::uuid, NULL::integer, NULL::integer; RETURN;
  END IF;

  -- Resolve recipient via whatsapp if needed
  IF v_recipient IS NULL AND p_recipient_whatsapp IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name='whatsapp_e164'
    ) INTO v_has_e164;
    IF v_has_e164 THEN
      SELECT user_id INTO v_recipient FROM public.profiles WHERE whatsapp_e164 = p_recipient_whatsapp LIMIT 1;
    ELSE
      SELECT user_id INTO v_recipient FROM public.profiles WHERE wa_id = p_recipient_whatsapp LIMIT 1;
    END IF;
  END IF;

  IF v_recipient IS NULL OR v_recipient = v_sender THEN
    RETURN QUERY SELECT false, 'invalid_recipient', NULL::uuid, NULL::integer, NULL::integer; RETURN;
  END IF;

  -- Idempotency: return existing transfer if idempotency_key already used
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transfer_id FROM public.wallet_transfers WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_transfer_id IS NOT NULL THEN
      -- Fetch balances to return best-effort
      SELECT tokens INTO v_sender_tokens FROM public.wallet_accounts WHERE profile_id = v_sender;
      SELECT tokens INTO v_recipient_tokens FROM public.wallet_accounts WHERE profile_id = v_recipient;
      RETURN QUERY SELECT true, 'duplicate', v_transfer_id, v_sender_tokens, v_recipient_tokens; RETURN;
    END IF;
  END IF;

  -- Ensure accounts exist
  INSERT INTO public.wallet_accounts(profile_id) VALUES (v_sender)
    ON CONFLICT (profile_id) DO NOTHING;
  INSERT INTO public.wallet_accounts(profile_id) VALUES (v_recipient)
    ON CONFLICT (profile_id) DO NOTHING;

  -- Lock rows to prevent races; lock in deterministic order
  IF v_sender < v_recipient THEN
    PERFORM 1 FROM public.wallet_accounts WHERE profile_id = v_sender FOR UPDATE;
    PERFORM 1 FROM public.wallet_accounts WHERE profile_id = v_recipient FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.wallet_accounts WHERE profile_id = v_recipient FOR UPDATE;
    PERFORM 1 FROM public.wallet_accounts WHERE profile_id = v_sender FOR UPDATE;
  END IF;

  -- Sufficient funds
  SELECT tokens INTO v_sender_tokens FROM public.wallet_accounts WHERE profile_id = v_sender;
  IF COALESCE(v_sender_tokens, 0) < v_amount THEN
    RETURN QUERY SELECT false, 'insufficient_tokens', NULL::uuid, v_sender_tokens, NULL::integer; RETURN;
  END IF;

  -- Create transfer
  INSERT INTO public.wallet_transfers(sender_profile, recipient_profile, amount_tokens, idempotency_key)
  VALUES (v_sender, v_recipient, v_amount, p_idempotency_key)
  RETURNING id INTO v_transfer_id;

  -- Double-entry entries
  INSERT INTO public.wallet_entries(transfer_id, profile_id, amount_tokens, description)
  VALUES (v_transfer_id, v_sender, -v_amount, 'token_transfer')
  ,      (v_transfer_id, v_recipient,  v_amount, 'token_transfer');

  -- Apply balances
  UPDATE public.wallet_accounts SET tokens = tokens - v_amount, updated_at = timezone('utc', now())
  WHERE profile_id = v_sender RETURNING tokens INTO v_sender_tokens;
  UPDATE public.wallet_accounts SET tokens = tokens + v_amount, updated_at = timezone('utc', now())
  WHERE profile_id = v_recipient RETURNING tokens INTO v_recipient_tokens;

  RETURN QUERY SELECT true, 'ok', v_transfer_id, v_sender_tokens, v_recipient_tokens;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.wallet_transfer_tokens(uuid, integer, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_transfer_tokens(uuid, integer, uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.wallet_transfer_tokens IS 'Transfer tokens between users with idempotency support. Returns single row with success status and updated balances.';

COMMIT;
