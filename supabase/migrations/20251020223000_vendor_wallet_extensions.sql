-- Vendor wallet extensions: commissions, wallet transfers, MoMo top-ups
BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  broker_profile_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  referral_id uuid,
  amount_tokens integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'due',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS vendor_commissions_vendor_idx
  ON public.vendor_commissions (vendor_profile_id, status, created_at DESC);

ALTER TABLE public.vendor_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_commissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_commissions_service_all ON public.vendor_commissions;
DROP POLICY IF EXISTS vendor_commissions_self_select ON public.vendor_commissions;

CREATE POLICY vendor_commissions_service_all
  ON public.vendor_commissions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY vendor_commissions_self_select
  ON public.vendor_commissions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = vendor_profile_id);

CREATE TABLE IF NOT EXISTS public.wallet_topups_momo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount_tokens integer NOT NULL DEFAULT 0,
  momo_reference text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS wallet_topups_momo_vendor_idx
  ON public.wallet_topups_momo (vendor_profile_id, status, created_at DESC);

ALTER TABLE public.wallet_topups_momo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_topups_momo FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_topups_momo_service_all ON public.wallet_topups_momo;
DROP POLICY IF EXISTS wallet_topups_momo_self_select ON public.wallet_topups_momo;

CREATE POLICY wallet_topups_momo_service_all
  ON public.wallet_topups_momo
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY wallet_topups_momo_self_select
  ON public.wallet_topups_momo
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = vendor_profile_id);

DROP FUNCTION IF EXISTS public.wallet_transfer(uuid, uuid, integer, text, jsonb);

CREATE OR REPLACE FUNCTION public.wallet_transfer(
  p_from uuid,
  p_to uuid,
  p_amount integer,
  p_reason text DEFAULT 'transfer',
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(from_balance integer, to_balance integer, ledger_from uuid, ledger_to uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_from record;
  v_to record;
  v_reason text := COALESCE(NULLIF(p_reason, ''), 'transfer');
  v_meta jsonb := COALESCE(p_meta, '{}'::jsonb);
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'wallet_transfer_missing_actor';
  END IF;
  IF p_from = p_to THEN
    RAISE EXCEPTION USING MESSAGE = 'wallet_transfer_same_actor';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'wallet_transfer_invalid_amount';
  END IF;

  SELECT *
  INTO v_from
  FROM public.wallet_apply_delta(
    p_from,
    -p_amount,
    v_reason,
    v_meta || jsonb_build_object('direction', 'out', 'target_profile_id', p_to)
  );

  SELECT *
  INTO v_to
  FROM public.wallet_apply_delta(
    p_to,
    p_amount,
    v_reason,
    v_meta || jsonb_build_object('direction', 'in', 'source_profile_id', p_from)
  );

  from_balance := v_from.balance_tokens;
  to_balance := v_to.balance_tokens;
  ledger_from := v_from.ledger_id;
  ledger_to := v_to.ledger_id;
  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.wallet_vendor_summary(uuid);

CREATE OR REPLACE FUNCTION public.wallet_vendor_summary(_vendor_id uuid)
RETURNS TABLE(
  tokens integer,
  pending_commissions_tokens integer,
  pending_commissions_count integer,
  recent jsonb
)
LANGUAGE sql
AS $$
  SELECT
    COALESCE(w.balance_tokens, acc.tokens, 0) AS tokens,
    COALESCE(comm.total_tokens, 0) AS pending_commissions_tokens,
    COALESCE(comm.pending_count, 0) AS pending_commissions_count,
    COALESCE(tx.recent, '[]'::jsonb) AS recent
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.user_id
  LEFT JOIN public.wallet_accounts acc ON acc.profile_id = p.user_id
LEFT JOIN LATERAL (
  SELECT
    SUM(vc.amount_tokens) AS total_tokens,
    COUNT(*) AS pending_count
  FROM public.vendor_commissions vc
  WHERE vc.vendor_profile_id = p.user_id
    AND vc.status = 'due'
) comm ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
      'id', t.id,
      'amount', t.amount_minor,
      'currency', t.currency,
      'direction', t.direction,
      'description', t.description,
      'occurred_at', t.occurred_at
    )) AS recent
  FROM (
    SELECT
      wt.id,
      wt.amount_minor,
      wt.currency,
      wt.direction,
      wt.description,
      wt.occurred_at
    FROM public.wallet_transactions wt
    WHERE wt.profile_id = p.user_id
    ORDER BY wt.occurred_at DESC
    LIMIT 5
  ) t
) tx ON true
  WHERE p.user_id = _vendor_id;
$$;

DROP FUNCTION IF EXISTS public.wallet_commission_pay(uuid, uuid);

CREATE OR REPLACE FUNCTION public.wallet_commission_pay(
  _commission_id uuid,
  _actor_vendor uuid
)
RETURNS TABLE(success boolean, message text, vendor_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_commission public.vendor_commissions%ROWTYPE;
  v_transfer record;
BEGIN
  success := false;
  message := NULL;
  vendor_balance := NULL;

  SELECT *
  INTO v_commission
  FROM public.vendor_commissions
  WHERE id = _commission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    message := 'commission_not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_commission.vendor_profile_id IS DISTINCT FROM _actor_vendor THEN
    message := 'not_owner';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_commission.status <> 'due' THEN
    message := 'commission_not_due';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_commission.broker_profile_id IS NULL THEN
    message := 'missing_broker';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_transfer
  FROM public.wallet_transfer(
    v_commission.vendor_profile_id,
    v_commission.broker_profile_id,
    v_commission.amount_tokens,
    'commission',
    v_commission.metadata || jsonb_build_object('commission_id', v_commission.id)
  );

  UPDATE public.vendor_commissions
  SET status = 'paid',
      paid_at = timezone('utc', now()),
      metadata = metadata || jsonb_build_object(
        'ledger_from', v_transfer.ledger_from,
        'ledger_to', v_transfer.ledger_to
      )
  WHERE id = v_commission.id;

  success := true;
  message := 'paid';
  vendor_balance := v_transfer.from_balance;
  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.wallet_momo_topup_credit(uuid, integer, text, jsonb);

CREATE OR REPLACE FUNCTION public.wallet_momo_topup_credit(
  _vendor_id uuid,
  _amount integer,
  _reference text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(success boolean, message text, vendor_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_topup_id uuid;
  v_transfer record;
BEGIN
  success := false;
  message := NULL;
  vendor_balance := NULL;

  IF _amount IS NULL OR _amount <= 0 THEN
    message := 'invalid_amount';
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.wallet_topups_momo (
    vendor_profile_id,
    amount_tokens,
    momo_reference,
    status,
    metadata
  )
  VALUES (
    _vendor_id,
    _amount,
    NULLIF(_reference, ''),
    'completed',
    COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (momo_reference) DO UPDATE
    SET vendor_profile_id = EXCLUDED.vendor_profile_id,
        amount_tokens = EXCLUDED.amount_tokens,
        status = 'completed',
        metadata = EXCLUDED.metadata,
        completed_at = timezone('utc', now())
  RETURNING id INTO v_topup_id;

  SELECT *
  INTO v_transfer
  FROM public.wallet_apply_delta(
    _vendor_id,
    _amount,
    'topup_momo',
    COALESCE(_metadata, '{}'::jsonb) || jsonb_build_object(
      'topup_id', v_topup_id,
      'reference', NULLIF(_reference, '')
    )
  );

  UPDATE public.wallet_topups_momo
  SET completed_at = timezone('utc', now()),
      metadata = metadata || jsonb_build_object('ledger_id', v_transfer.ledger_id)
  WHERE id = v_topup_id;

  success := true;
  message := 'credited';
  vendor_balance := v_transfer.balance_tokens;
  RETURN NEXT;
END;
$$;

COMMIT;
