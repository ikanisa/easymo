BEGIN;

DROP FUNCTION IF EXISTS public.mobility_buy_subscription(uuid);

CREATE OR REPLACE FUNCTION public.mobility_buy_subscription(_user_id uuid)
RETURNS TABLE(success boolean, message text, expires_at timestamptz, wallet_balance integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_price numeric(10,2) := 4;
  v_tokens integer := 4;
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

  v_tokens := COALESCE(CEILING(v_price)::integer, 4);
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
      ) AS wa
      LIMIT 1;
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
