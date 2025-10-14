-- Basket invite tokens for shareable deep links

BEGIN;

CREATE TABLE IF NOT EXISTS public.basket_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT timezone('utc', now()) + interval '14 days',
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_basket_invite_tokens_basket
  ON public.basket_invite_tokens (basket_id);

COMMIT;
