BEGIN;

CREATE OR REPLACE FUNCTION public.wallet_transfer_tokens(
  p_sender uuid,
  p_recipient_whatsapp text,
  p_amount integer
)
RETURNS TABLE(success boolean, reason text) AS $$
DECLARE
  v_to_profile uuid;
  v_sender_tokens int;
BEGIN
  success := false; reason := NULL;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    reason := 'invalid_amount'; RETURN NEXT; RETURN;
  END IF;

  SELECT user_id INTO v_to_profile FROM public.profiles
  WHERE whatsapp_e164 = p_recipient_whatsapp LIMIT 1;
  IF v_to_profile IS NULL THEN
    reason := 'recipient_not_found'; RETURN NEXT; RETURN;
  END IF;
  IF v_to_profile = p_sender THEN
    reason := 'self_transfer_not_allowed'; RETURN NEXT; RETURN;
  END IF;

  -- Ensure accounts exist
  INSERT INTO public.wallet_accounts (profile_id, tokens)
  VALUES (p_sender, 0) ON CONFLICT (profile_id) DO NOTHING;
  INSERT INTO public.wallet_accounts (profile_id, tokens)
  VALUES (v_to_profile, 0) ON CONFLICT (profile_id) DO NOTHING;

  -- Lock and check balance
  SELECT tokens INTO v_sender_tokens FROM public.wallet_accounts
  WHERE profile_id = p_sender FOR UPDATE;
  IF v_sender_tokens IS NULL OR v_sender_tokens < p_amount THEN
    reason := 'insufficient_tokens'; RETURN NEXT; RETURN;
  END IF;

  -- Debit sender, credit recipient
  UPDATE public.wallet_accounts SET tokens = tokens - p_amount, updated_at = timezone('utc', now())
  WHERE profile_id = p_sender;
  UPDATE public.wallet_accounts SET tokens = tokens + p_amount, updated_at = timezone('utc', now())
  WHERE profile_id = v_to_profile;

  INSERT INTO public.wallet_ledger (user_id, delta_tokens, type, meta)
  VALUES (p_sender, -p_amount, 'transfer_out', jsonb_build_object('to', v_to_profile));
  INSERT INTO public.wallet_ledger (user_id, delta_tokens, type, meta)
  VALUES (v_to_profile, p_amount, 'transfer_in', jsonb_build_object('from', p_sender));

  INSERT INTO public.wallet_transactions (profile_id, amount_minor, currency, direction, description, occurred_at)
  VALUES (p_sender, p_amount, 'TOK', 'debit', 'Token transfer', timezone('utc', now()));
  INSERT INTO public.wallet_transactions (profile_id, amount_minor, currency, direction, description, occurred_at)
  VALUES (v_to_profile, p_amount, 'TOK', 'credit', 'Token transfer', timezone('utc', now()));

  success := true; reason := 'ok'; RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

