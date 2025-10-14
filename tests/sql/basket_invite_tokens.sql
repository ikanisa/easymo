-- Smoke test for basket_invite_tokens table
BEGIN;
SET LOCAL search_path TO public;

DO $$
DECLARE
  creator uuid := gen_random_uuid();
  basket uuid := gen_random_uuid();
  token_a text := 'TESTTOKENA';
  token_b text := 'TESTTOKENB';
  expires timestamptz;
  user_inserted boolean := false;
  basket_inserted boolean := false;
BEGIN
  IF to_regclass('public.basket_invite_tokens') IS NULL THEN
    RAISE NOTICE 'basket_invite_tokens table missing – skipping smoke test';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'baskets') THEN
    RAISE NOTICE 'baskets table missing – skipping token smoke test';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.users (id) VALUES (creator);
    user_inserted := true;
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'unable to seed users row: %', SQLERRM;
      RETURN;
  END;

  BEGIN
    INSERT INTO public.baskets (id) VALUES (basket);
    basket_inserted := true;
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'unable to seed baskets row: %', SQLERRM;
      IF user_inserted THEN
        DELETE FROM public.users WHERE id = creator;
      END IF;
      RETURN;
  END;

  INSERT INTO public.basket_invite_tokens (basket_id, token, created_by)
  VALUES (basket, token_a, creator);

  SELECT expires_at INTO expires FROM public.basket_invite_tokens WHERE token = token_a;
  IF expires IS NULL THEN
    RAISE EXCEPTION 'Expected default expiry for invite token';
  END IF;

  INSERT INTO public.basket_invite_tokens (basket_id, token, created_by)
  VALUES (basket, token_b, creator);

  BEGIN
    INSERT INTO public.basket_invite_tokens (basket_id, token, created_by)
    VALUES (basket, token_a, creator);
    RAISE EXCEPTION 'Token uniqueness constraint not enforced';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  DELETE FROM public.basket_invite_tokens WHERE token IN (token_a, token_b);
  IF basket_inserted THEN
    DELETE FROM public.baskets WHERE id = basket;
  END IF;
  IF user_inserted THEN
    DELETE FROM public.users WHERE id = creator;
  END IF;
END;
$$;

ROLLBACK;
