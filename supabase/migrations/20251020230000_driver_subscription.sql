BEGIN;

ALTER TABLE public.mobility_pro_access
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS last_subscription_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_credit_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.mobility_pro_access
  ALTER COLUMN credits_left SET DEFAULT 30;

UPDATE public.mobility_pro_access
SET credits_left = 30
WHERE credits_left IS NULL;

ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS driver_initial_credits integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS driver_subscription_tokens numeric(10,2) NOT NULL DEFAULT 4;

UPDATE public.app_config
SET driver_initial_credits = COALESCE(driver_initial_credits, 30),
    driver_subscription_tokens = COALESCE(driver_subscription_tokens, 4)
WHERE id IS NOT NULL;

DROP FUNCTION IF EXISTS public.gate_pro_feature(uuid);

CREATE OR REPLACE FUNCTION public.gate_pro_feature(_user_id uuid)
RETURNS TABLE(access boolean, used_credit boolean, credits_left integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_initial integer := 30;
  v_row public.mobility_pro_access;
  v_left integer := 0;
BEGIN
  SELECT COALESCE(driver_initial_credits, 30)
    INTO v_initial
    FROM public.app_config
    ORDER BY id
    LIMIT 1;

  INSERT INTO public.mobility_pro_access (user_id, credits_left, created_at)
  VALUES (_user_id, v_initial, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
    INTO v_row
    FROM public.mobility_pro_access
    WHERE user_id = _user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, 0;
    RETURN;
  END IF;

  v_left := COALESCE(v_row.credits_left, 0);

  IF v_row.granted_until IS NOT NULL AND v_row.granted_until >= v_now THEN
    RETURN QUERY SELECT true, false, v_left;
    RETURN;
  END IF;

  IF v_left > 0 THEN
    UPDATE public.mobility_pro_access
       SET credits_left = GREATEST(credits_left - 1, 0),
           last_credit_used_at = v_now
     WHERE user_id = _user_id
     RETURNING credits_left INTO v_left;
    RETURN QUERY SELECT true, true, COALESCE(v_left, 0);
    RETURN;
  END IF;

  RETURN QUERY SELECT false, false, v_left;
END;
$$;

DROP FUNCTION IF EXISTS public.mobility_buy_subscription(uuid);

CREATE OR REPLACE FUNCTION public.mobility_buy_subscription(_user_id uuid)
RETURNS TABLE(success boolean, message text, expires_at timestamptz, wallet_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_price numeric(10,2) := 4;
  v_tokens integer;
  v_balance integer;
  v_expires timestamptz;
BEGIN
  INSERT INTO public.mobility_pro_access (user_id, credits_left, created_at)
  VALUES (_user_id, 30, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT COALESCE(driver_subscription_tokens, 4)
    INTO v_price
    FROM public.app_config
    ORDER BY id
    LIMIT 1;

  v_tokens := CEILING(v_price);
  IF v_tokens <= 0 THEN
    v_tokens := 4;
  END IF;

  BEGIN
    SELECT wa.balance_tokens
      INTO v_balance
      FROM public.wallet_apply_delta(
        _user_id,
        -v_tokens,
        'driver_subscription',
        jsonb_build_object('months', 1, 'tokens', v_tokens)
      ) AS wa;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%wallet_insufficient_tokens%' THEN
        RETURN QUERY SELECT false, 'insufficient_tokens', NULL::timestamptz, NULL::integer;
        RETURN;
      ELSE
        RAISE;
      END IF;
  END;

  UPDATE public.mobility_pro_access
     SET granted_until = GREATEST(COALESCE(granted_until, v_now), v_now) + interval '30 days',
         last_subscription_paid_at = v_now
   WHERE user_id = _user_id
   RETURNING granted_until INTO v_expires;

  RETURN QUERY SELECT true, 'paid', v_expires, v_balance;
END;
$$;

COMMIT;
