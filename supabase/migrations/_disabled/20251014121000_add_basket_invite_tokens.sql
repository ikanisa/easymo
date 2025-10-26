-- Basket invite tokens for shareable deep links
BEGIN;

CREATE TABLE IF NOT EXISTS public.basket_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.baskets(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT timezone('utc', now()) + interval '14 days',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_basket_invite_tokens_basket
  ON public.basket_invite_tokens (basket_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    EXECUTE 'ALTER TABLE public.basket_invite_tokens
             ADD CONSTRAINT fk_basket_invite_tokens_created_by
             FOREIGN KEY (created_by) REFERENCES public.users(id)';
  END IF;
END $$;

COMMIT;
