-- Referral application helper to credit promoters for new joiners.

CREATE OR REPLACE FUNCTION public.referral_apply_code(
  _joiner_profile_id uuid,
  _joiner_whatsapp text,
  _code text
)
RETURNS TABLE(
  applied boolean,
  promoter_profile_id uuid,
  promoter_whatsapp text,
  tokens_awarded int,
  reason text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text := trim(coalesce(_code, ''));
  v_promoter uuid;
  v_tokens int;
  v_promoter_whatsapp text;
  v_attr_id uuid;
  v_joiner_inserted uuid;
  v_joiner_created timestamptz;
BEGIN
  applied := false;
  promoter_profile_id := NULL;
  promoter_whatsapp := NULL;
  tokens_awarded := 0;
  reason := NULL;

  IF v_code = '' THEN
    reason := 'missing_code';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT rl.user_id INTO v_promoter
  FROM public.referral_links rl
  WHERE rl.code = v_code
    AND rl.active = true
  LIMIT 1;

  IF v_promoter IS NULL THEN
    reason := 'invalid_code';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_promoter = _joiner_profile_id THEN
    reason := 'self_referral';
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.referral_attributions
    WHERE joiner_user_id = _joiner_profile_id
  ) THEN
    reason := 'already_attributed';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT created_at INTO v_joiner_created
  FROM public.profiles
  WHERE user_id = _joiner_profile_id
  LIMIT 1;

  IF v_joiner_created IS NOT NULL AND
    v_joiner_created < timezone('utc', now()) - interval '1 day' THEN
    reason := 'existing_user';
    INSERT INTO public.referral_attributions (
      code,
      sharer_user_id,
      joiner_user_id,
      first_message_at,
      credited,
      credited_tokens,
      reason
    )
    VALUES (
      v_code,
      v_promoter,
      _joiner_profile_id,
      timezone('utc', now()),
      false,
      0,
      reason
    )
    ON CONFLICT DO NOTHING;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.wallet_accounts (profile_id, tokens)
  VALUES (_joiner_profile_id, 0)
  ON CONFLICT (profile_id) DO NOTHING
  RETURNING profile_id INTO v_joiner_inserted;

  IF v_joiner_inserted IS NULL THEN
    reason := 'existing_user';
    INSERT INTO public.referral_attributions (
      code,
      sharer_user_id,
      joiner_user_id,
      first_message_at,
      credited,
      credited_tokens,
      reason
    )
    VALUES (
      v_code,
      v_promoter,
      _joiner_profile_id,
      timezone('utc', now()),
      false,
      0,
      reason
    )
    ON CONFLICT DO NOTHING;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.wallet_accounts (profile_id, tokens)
  VALUES (v_promoter, 0)
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT tokens_per_new_user INTO v_tokens
  FROM public.promo_rules
  ORDER BY id
  LIMIT 1;

  IF v_tokens IS NULL OR v_tokens <= 0 THEN
    v_tokens := 10;
  END IF;

  UPDATE public.wallet_accounts
  SET tokens = tokens + v_tokens,
      updated_at = timezone('utc', now())
  WHERE profile_id = v_promoter;

  INSERT INTO public.wallet_ledger (user_id, delta_tokens, type, meta)
  VALUES (
    v_promoter,
    v_tokens,
    'referral_credit',
    jsonb_build_object('code', v_code, 'joiner', _joiner_whatsapp)
  );

  INSERT INTO public.wallet_transactions (
    profile_id,
    amount_minor,
    currency,
    direction,
    description,
    occurred_at
  )
  VALUES (
    v_promoter,
    v_tokens,
    'TOK',
    'credit',
    'Referral bonus',
    timezone('utc', now())
  );

  INSERT INTO public.referral_attributions (
    code,
    sharer_user_id,
    joiner_user_id,
    first_message_at,
    credited,
    credited_tokens
  )
  VALUES (
    v_code,
    v_promoter,
    _joiner_profile_id,
    timezone('utc', now()),
    true,
    v_tokens
  )
  RETURNING id INTO v_attr_id;

  SELECT whatsapp_e164 INTO v_promoter_whatsapp
  FROM public.profiles
  WHERE user_id = v_promoter;

  applied := true;
  promoter_profile_id := v_promoter;
  promoter_whatsapp := v_promoter_whatsapp;
  tokens_awarded := v_tokens;
  reason := 'credited';
  RETURN NEXT;
END;
$$;
