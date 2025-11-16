-- Wallet rework: unify balance mutations, add redemption tracking, and refresh helper RPCs
BEGIN;

CREATE TABLE IF NOT EXISTS public.wallet_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  option_id uuid REFERENCES public.wallet_redeem_options(id),
  cost_tokens integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  processed_at timestamptz,
  processed_by uuid REFERENCES public.profiles(user_id)
);

ALTER TABLE public.wallet_redemptions
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS option_id uuid REFERENCES public.wallet_redeem_options(id),
  ADD COLUMN IF NOT EXISTS cost_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES public.profiles(user_id);

CREATE INDEX IF NOT EXISTS wallet_redemptions_profile_idx
  ON public.wallet_redemptions (profile_id, requested_at DESC);

ALTER TABLE public.wallet_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_redemptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_redemptions_service_all ON public.wallet_redemptions;
DROP POLICY IF EXISTS wallet_redemptions_self_select ON public.wallet_redemptions;

CREATE POLICY wallet_redemptions_service_all
  ON public.wallet_redemptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY wallet_redemptions_self_select
  ON public.wallet_redemptions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = profile_id);

DROP FUNCTION IF EXISTS public.wallet_apply_delta(uuid, integer);
DROP FUNCTION IF EXISTS public.wallet_apply_delta(uuid, integer, text, jsonb);
DROP FUNCTION IF EXISTS public.wallet_summary(uuid);
DROP FUNCTION IF EXISTS public.wallet_top_promoters(integer);

CREATE OR REPLACE FUNCTION public.wallet_apply_delta(
  p_user_id uuid,
  p_delta integer,
  p_type text DEFAULT 'adjust',
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(balance_tokens integer, ledger_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current integer := 0;
  v_new_balance integer := 0;
  v_ledger_id uuid := NULL;
  v_direction text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'wallet_apply_delta_missing_user';
  END IF;

  IF p_delta IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'wallet_apply_delta_missing_delta';
  END IF;

  INSERT INTO public.wallet_accounts (profile_id)
  VALUES (p_user_id)
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance_tokens)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT tokens INTO v_current
  FROM public.wallet_accounts
  WHERE profile_id = p_user_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    v_current := 0;
  END IF;

  IF p_delta < 0 AND v_current + p_delta < 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'wallet_insufficient_tokens';
  END IF;

  v_new_balance := v_current + p_delta;

  UPDATE public.wallet_accounts
  SET tokens = v_new_balance,
      updated_at = timezone('utc', now())
  WHERE profile_id = p_user_id;

  UPDATE public.wallets
  SET balance_tokens = v_new_balance,
      updated_at = timezone('utc', now())
  WHERE user_id = p_user_id;

  IF p_delta <> 0 THEN
    INSERT INTO public.wallet_ledger (user_id, delta_tokens, type, meta)
    VALUES (
      p_user_id,
      p_delta,
      COALESCE(NULLIF(p_type, ''), 'adjust'),
      COALESCE(p_meta, '{}'::jsonb)
    )
    RETURNING id INTO v_ledger_id;

    v_direction := CASE WHEN p_delta >= 0 THEN 'credit' ELSE 'debit' END;

    INSERT INTO public.wallet_transactions (
      profile_id,
      amount_minor,
      currency,
      direction,
      description,
      occurred_at
    )
    VALUES (
      p_user_id,
      ABS(p_delta),
      'TOK',
      v_direction,
      COALESCE(p_meta->>'description', initcap(replace(COALESCE(p_type, 'adjust'), '_', ' '))),
      timezone('utc', now())
    );
  END IF;

  balance_tokens := v_new_balance;
  ledger_id := v_ledger_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_summary(_profile_id uuid)
RETURNS TABLE(balance_minor integer, pending_minor integer, currency text, tokens integer)
LANGUAGE sql
AS $$
  SELECT
    COALESCE(acc.balance_minor, 0) AS balance_minor,
    COALESCE(acc.pending_minor, 0) AS pending_minor,
    COALESCE(acc.currency, 'RWF') AS currency,
    COALESCE(w.balance_tokens, acc.tokens, 0) AS tokens
  FROM public.profiles p
  LEFT JOIN public.wallet_accounts acc ON acc.profile_id = p.user_id
  LEFT JOIN public.wallets w ON w.user_id = p.user_id
  WHERE p.user_id = _profile_id;
$$;

CREATE OR REPLACE FUNCTION public.wallet_top_promoters(_limit integer DEFAULT 9)
RETURNS TABLE(display_name text, whatsapp text, tokens integer)
LANGUAGE sql
AS $$
  SELECT
    COALESCE(
      p.metadata->>'display_name',
      p.metadata->>'name',
      p.whatsapp_e164
    ) AS display_name,
    p.whatsapp_e164 AS whatsapp,
    COALESCE(w.balance_tokens, acc.tokens, 0) AS tokens
  FROM public.profiles p
  LEFT JOIN public.wallet_accounts acc ON acc.profile_id = p.user_id
  LEFT JOIN public.wallets w ON w.user_id = p.user_id
  WHERE COALESCE(w.balance_tokens, acc.tokens, 0) > 0
  ORDER BY COALESCE(w.balance_tokens, acc.tokens, 0) DESC, p.updated_at DESC
  LIMIT COALESCE(_limit, 9);
$$;

CREATE OR REPLACE FUNCTION public.wallet_redeem_execute(
  _profile_id uuid,
  _option_id uuid
)
RETURNS TABLE(success boolean, message text, balance_tokens integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_option public.wallet_redeem_options%ROWTYPE;
  v_balance integer := 0;
  v_ledger uuid := NULL;
  v_cost integer := 0;
BEGIN
  success := false;
  message := NULL;
  balance_tokens := NULL;

  SELECT *
  INTO v_option
  FROM public.wallet_redeem_options
  WHERE id = _option_id
    AND is_active = true;

  IF NOT FOUND THEN
    message := 'reward_not_available';
    RETURN NEXT;
    RETURN;
  END IF;

  v_cost := GREATEST(COALESCE(v_option.cost_tokens, 0), 0);

  BEGIN
    IF v_cost > 0 THEN
      SELECT balance_tokens, ledger_id
      INTO v_balance, v_ledger
      FROM public.wallet_apply_delta(
        _profile_id,
        -v_cost,
        'redeem',
        jsonb_build_object('option_id', _option_id, 'title', v_option.title)
      );
    ELSE
      SELECT balance_tokens, ledger_id
      INTO v_balance, v_ledger
      FROM public.wallet_apply_delta(
        _profile_id,
        0,
        'redeem',
        jsonb_build_object('option_id', _option_id, 'title', v_option.title)
      );
    END IF;
  EXCEPTION
    WHEN others THEN
      IF SQLERRM LIKE '%wallet_insufficient_tokens%' THEN
        message := 'insufficient_tokens';
        RETURN NEXT;
        RETURN;
      ELSE
        RAISE;
      END IF;
  END;

  INSERT INTO public.wallet_redemptions (
    profile_id,
    option_id,
    cost_tokens,
    status,
    metadata
  )
  VALUES (
    _profile_id,
    _option_id,
    v_cost,
    'requested',
    jsonb_build_object(
      'ledger_id', v_ledger,
      'option_title', v_option.title,
      'option_description', v_option.description
    )
  );

  success := true;
  message := 'requested';
  balance_tokens := COALESCE(v_balance, 0);
  RETURN NEXT;
END;
$$;

COMMIT;
