BEGIN;
CREATE OR REPLACE FUNCTION public.wallet_apply_delta(
  _user_id uuid,
  _delta integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance_tokens)
  VALUES (_user_id, COALESCE(_delta, 0))
  ON CONFLICT (user_id)
  DO UPDATE SET balance_tokens = public.wallets.balance_tokens + COALESCE(_delta, 0), updated_at = timezone('utc', now());
END;
$$;
COMMIT;
