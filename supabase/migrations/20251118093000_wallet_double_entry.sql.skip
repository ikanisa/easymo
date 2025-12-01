BEGIN;

-- Double-entry token ledger
CREATE TABLE IF NOT EXISTS public.wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_profile UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  recipient_profile UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  amount_tokens INTEGER NOT NULL CHECK (amount_tokens > 0),
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'committed',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.wallet_transfers(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount_tokens INTEGER NOT NULL CHECK (amount_tokens <> 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_wallet_entries_profile_time ON public.wallet_entries(profile_id, occurred_at DESC);

ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;

-- Read access: owners can read their own entries and transfers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_transfers' AND policyname='wallet_transfers_read_own'
  ) THEN
    CREATE POLICY "wallet_transfers_read_own" ON public.wallet_transfers
      FOR SELECT TO authenticated
      USING (
        sender_profile = auth.uid() OR recipient_profile = auth.uid()
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_entries' AND policyname='wallet_entries_read_own'
  ) THEN
    CREATE POLICY "wallet_entries_read_own" ON public.wallet_entries
      FOR SELECT TO authenticated
      USING (profile_id = auth.uid());
  END IF;
END $$;

-- service role manage-all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_transfers' AND policyname='wallet_transfers_service'
  ) THEN
    CREATE POLICY "wallet_transfers_service" ON public.wallet_transfers
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_entries' AND policyname='wallet_entries_service'
  ) THEN
    CREATE POLICY "wallet_entries_service" ON public.wallet_entries
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- token-accepting partners
CREATE TABLE IF NOT EXISTS public.token_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  whatsapp_e164 TEXT UNIQUE,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_token_partners_active ON public.token_partners(is_active, created_at DESC);
ALTER TABLE public.token_partners ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='token_partners' AND policyname='token_partners_read'
  ) THEN
    CREATE POLICY "token_partners_read" ON public.token_partners
      FOR SELECT TO authenticated, anon USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='token_partners' AND policyname='token_partners_service'
  ) THEN
    CREATE POLICY "token_partners_service" ON public.token_partners
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- RPC: list active partners
CREATE OR REPLACE FUNCTION public.wallet_list_token_partners(_limit integer DEFAULT 20)
RETURNS SETOF public.token_partners
LANGUAGE sql
AS $$
  SELECT * FROM public.token_partners WHERE is_active = true ORDER BY created_at DESC LIMIT COALESCE(_limit, 20);
$$;

-- RPC: transfer tokens (idempotent, double-entry)
CREATE OR REPLACE FUNCTION public.wallet_transfer_tokens(
  p_sender uuid,
  p_amount integer,
  p_recipient uuid DEFAULT NULL,
  p_recipient_whatsapp text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, reason text, transfer_id uuid, sender_tokens integer, recipient_tokens integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender uuid := p_sender;
  v_recipient uuid := p_recipient;
  v_amount integer := COALESCE(p_amount, 0);
  v_transfer_id uuid;
  v_sender_tokens integer;
  v_recipient_tokens integer;
  v_exists boolean;
  v_has_e164 boolean := false;
BEGIN
  IF v_sender IS NULL OR v_amount <= 0 THEN
    RETURN QUERY SELECT false, 'invalid_args', NULL::uuid, NULL::integer, NULL::integer; RETURN;
  END IF;

  -- Resolve recipient via whatsapp if needed
  IF v_recipient IS NULL AND p_recipient_whatsapp IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name='whatsapp_e164'
    ) INTO v_has_e164;
    IF v_has_e164 THEN
      SELECT user_id INTO v_recipient FROM public.profiles WHERE whatsapp_e164 = p_recipient_whatsapp LIMIT 1;
    ELSE
      SELECT user_id INTO v_recipient FROM public.profiles WHERE wa_id = p_recipient_whatsapp LIMIT 1;
    END IF;
  END IF;

  IF v_recipient IS NULL OR v_recipient = v_sender THEN
    RETURN QUERY SELECT false, 'invalid_recipient', NULL::uuid, NULL::integer, NULL::integer; RETURN;
  END IF;

  -- Idempotency: return existing transfer if idempotency_key already used
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transfer_id FROM public.wallet_transfers WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_transfer_id IS NOT NULL THEN
      -- Fetch balances to return best-effort
      SELECT tokens INTO v_sender_tokens FROM public.wallet_accounts WHERE profile_id = v_sender;
      SELECT tokens INTO v_recipient_tokens FROM public.wallet_accounts WHERE profile_id = v_recipient;
      RETURN QUERY SELECT true, 'duplicate', v_transfer_id, v_sender_tokens, v_recipient_tokens; RETURN;
    END IF;
  END IF;

  -- Ensure accounts exist
  INSERT INTO public.wallet_accounts(profile_id) VALUES (v_sender)
    ON CONFLICT (profile_id) DO NOTHING;
  INSERT INTO public.wallet_accounts(profile_id) VALUES (v_recipient)
    ON CONFLICT (profile_id) DO NOTHING;

  -- Lock rows to prevent races; lock in deterministic order
  IF v_sender < v_recipient THEN
    PERFORM 1 FROM public.wallet_accounts WHERE profile_id = v_sender FOR UPDATE;
    PERFORM 1 FROM public.wallet_accounts WHERE profile_id = v_recipient FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.wallet_accounts WHERE profile_id = v_recipient FOR UPDATE;
    PERFORM 1 FROM public.wallet_accounts WHERE profile_id = v_sender FOR UPDATE;
  END IF;

  -- Sufficient funds
  SELECT tokens INTO v_sender_tokens FROM public.wallet_accounts WHERE profile_id = v_sender;
  IF COALESCE(v_sender_tokens, 0) < v_amount THEN
    RETURN QUERY SELECT false, 'insufficient_tokens', NULL::uuid, v_sender_tokens, NULL::integer; RETURN;
  END IF;

  -- Create transfer
  INSERT INTO public.wallet_transfers(sender_profile, recipient_profile, amount_tokens, idempotency_key)
  VALUES (v_sender, v_recipient, v_amount, p_idempotency_key)
  RETURNING id INTO v_transfer_id;

  -- Double-entry entries
  INSERT INTO public.wallet_entries(transfer_id, profile_id, amount_tokens, description)
  VALUES (v_transfer_id, v_sender, -v_amount, 'token_transfer')
  ,      (v_transfer_id, v_recipient,  v_amount, 'token_transfer');

  -- Apply balances
  UPDATE public.wallet_accounts SET tokens = tokens - v_amount, updated_at = timezone('utc', now())
  WHERE profile_id = v_sender RETURNING tokens INTO v_sender_tokens;
  UPDATE public.wallet_accounts SET tokens = tokens + v_amount, updated_at = timezone('utc', now())
  WHERE profile_id = v_recipient RETURNING tokens INTO v_recipient_tokens;

  RETURN QUERY SELECT true, 'ok', v_transfer_id, v_sender_tokens, v_recipient_tokens;
END;
$$;

COMMENT ON TABLE public.wallet_transfers IS 'Double-entry token transfer journal with idempotency';
COMMENT ON TABLE public.wallet_entries IS 'Ledger entries per transfer; entries sum to zero per transfer';
COMMENT ON TABLE public.token_partners IS 'Directory of partners accepting tokens as payment';

COMMIT;
