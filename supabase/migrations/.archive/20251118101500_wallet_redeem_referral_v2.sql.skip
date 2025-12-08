BEGIN;

-- Optional sink: system settings for wallet operations
CREATE TABLE IF NOT EXISTS public.wallet_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_settings' AND policyname='wallet_settings_service'
  ) THEN
    CREATE POLICY "wallet_settings_service" ON public.wallet_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Ensure redeem options can optionally target a recipient profile directly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wallet_redeem_options' AND column_name='recipient_profile'
  ) THEN
    ALTER TABLE public.wallet_redeem_options ADD COLUMN recipient_profile UUID REFERENCES public.profiles(user_id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Helper to resolve system profile id from settings
CREATE OR REPLACE FUNCTION public.wallet_system_profile()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT NULLIF(value, '')::uuid FROM public.wallet_settings WHERE key = 'wallet_system_profile_id' LIMIT 1;
$$;

-- RPC to redeem tokens by debiting user and crediting system/recipient
CREATE OR REPLACE FUNCTION public.wallet_redeem_request(
  p_profile uuid,
  p_option_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, reason text, transfer_id uuid, tokens_left integer)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_cost integer;
  v_recipient uuid;
  v_tid uuid;
  v_sender_tokens integer;
BEGIN
  IF p_profile IS NULL OR p_option_id IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_args', NULL::uuid, NULL::integer; RETURN;
  END IF;
  SELECT cost_tokens, recipient_profile INTO v_cost, v_recipient FROM public.wallet_redeem_options WHERE id = p_option_id AND is_active = true LIMIT 1;
  IF v_cost IS NULL OR v_cost <= 0 THEN
    RETURN QUERY SELECT false, 'invalid_option', NULL::uuid, NULL::integer; RETURN;
  END IF;
  IF v_recipient IS NULL THEN
    SELECT public.wallet_system_profile() INTO v_recipient;
  END IF;
  IF v_recipient IS NULL THEN
    RETURN QUERY SELECT false, 'system_not_configured', NULL::uuid, NULL::integer; RETURN;
  END IF;
  -- Use transfer engine
  PERFORM 1; -- boundary
  WITH t AS (
    SELECT * FROM public.wallet_transfer_tokens(
      p_sender := p_profile,
      p_amount := v_cost,
      p_recipient := v_recipient,
      p_recipient_whatsapp := NULL,
      p_idempotency_key := p_idempotency_key
    )
  )
  SELECT transfer_id, sender_tokens FROM t LIMIT 1 INTO v_tid, v_sender_tokens;
  IF v_tid IS NULL THEN
    RETURN QUERY SELECT false, 'transfer_failed', NULL::uuid, NULL::integer; RETURN;
  END IF;
  RETURN QUERY SELECT true, 'ok', v_tid, v_sender_tokens;
END;
$$;

-- Referral v2: use transfer engine to credit promoter
CREATE OR REPLACE FUNCTION public.referral_apply_code_v2(
  _joiner_profile_id uuid,
  _joiner_whatsapp text,
  _code text,
  _idempotency_key text DEFAULT NULL
)
RETURNS TABLE(applied boolean, promoter_profile_id uuid, promoter_whatsapp text, tokens_awarded int, reason text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_code text := trim(coalesce(_code, ''));
  v_promoter uuid;
  v_tokens int;
  v_promoter_whatsapp text;
  v_joiner_created timestamptz;
  v_system uuid;
  v_tid uuid;
BEGIN
  applied := false; promoter_profile_id := NULL; promoter_whatsapp := NULL; tokens_awarded := 0; reason := NULL;
  IF v_code = '' THEN reason := 'missing_code'; RETURN NEXT; RETURN; END IF;

  SELECT rl.user_id INTO v_promoter FROM public.referral_links rl WHERE rl.code = v_code AND rl.active = true LIMIT 1;
  IF v_promoter IS NULL THEN reason := 'invalid_code'; RETURN NEXT; RETURN; END IF;
  IF v_promoter = _joiner_profile_id THEN reason := 'self_referral'; RETURN NEXT; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_attributions WHERE joiner_user_id = _joiner_profile_id) THEN reason := 'already_attributed'; RETURN NEXT; RETURN; END IF;

  SELECT created_at INTO v_joiner_created FROM public.profiles WHERE user_id = _joiner_profile_id LIMIT 1;
  IF v_joiner_created IS NOT NULL AND v_joiner_created < timezone('utc', now()) - interval '1 day' THEN
    reason := 'existing_user'; RETURN NEXT; RETURN;
  END IF;

  -- Defaults and system
  SELECT tokens_per_new_user INTO v_tokens FROM public.promo_rules ORDER BY id LIMIT 1;
  IF v_tokens IS NULL OR v_tokens <= 0 THEN v_tokens := 10; END IF;
  SELECT public.wallet_system_profile() INTO v_system; IF v_system IS NULL THEN reason := 'system_not_configured'; RETURN NEXT; RETURN; END IF;

  -- Idempotent credit: system -> promoter
  WITH t AS (
    SELECT * FROM public.wallet_transfer_tokens(
      p_sender := v_system,
      p_amount := v_tokens,
      p_recipient := v_promoter,
      p_recipient_whatsapp := NULL,
      p_idempotency_key := coalesce(_idempotency_key, concat('ref:', v_code, ':', _joiner_profile_id))
    )
  )
  SELECT transfer_id FROM t LIMIT 1 INTO v_tid;
  IF v_tid IS NULL THEN reason := 'transfer_failed'; RETURN NEXT; RETURN; END IF;

  SELECT whatsapp_e164 INTO v_promoter_whatsapp FROM public.profiles WHERE user_id = v_promoter;
  applied := true; promoter_profile_id := v_promoter; promoter_whatsapp := v_promoter_whatsapp; tokens_awarded := v_tokens; reason := 'credited';
  RETURN NEXT;
END;
$$;

COMMIT;

