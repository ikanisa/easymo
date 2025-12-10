-- Migration: Referral System V2 with Token Rewards
-- Description: Complete referral system with token credits and WhatsApp notifications
-- Date: 2025-12-10

BEGIN;

-- ============================================================
-- REFERRAL SYSTEM V2: Token Rewards for Invitations
-- ============================================================

-- Create promo_rules table if it doesn't exist (stores token rewards config)
CREATE TABLE IF NOT EXISTS public.promo_rules (
    id SERIAL PRIMARY KEY,
    tokens_per_new_user INTEGER NOT NULL DEFAULT 10,
    max_daily_referrals INTEGER DEFAULT 50,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default promo rule if none exists
INSERT INTO public.promo_rules (tokens_per_new_user, description)
SELECT 10, 'Default referral reward: 10 tokens per new user'
WHERE NOT EXISTS (SELECT 1 FROM public.promo_rules LIMIT 1);

-- Create wallet_accounts table if missing
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create wallet_ledger table if missing (for audit trail)
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    delta_tokens INTEGER NOT NULL,
    type TEXT NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure referral_attributions has the credited column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_attributions' 
        AND column_name = 'credited'
    ) THEN
        ALTER TABLE public.referral_attributions ADD COLUMN credited BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_attributions' 
        AND column_name = 'credited_tokens'
    ) THEN
        ALTER TABLE public.referral_attributions ADD COLUMN credited_tokens INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'referral_attributions' 
        AND column_name = 'reason'
    ) THEN
        ALTER TABLE public.referral_attributions ADD COLUMN reason TEXT;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_tokens ON public.wallet_accounts(tokens) WHERE tokens > 0;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_id ON public.wallet_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_links_code ON public.referral_links(code);
CREATE INDEX IF NOT EXISTS idx_referral_links_user_active ON public.referral_links(user_id, active) WHERE active = true;

-- ============================================================
-- REFERRAL_APPLY_CODE_V2 FUNCTION
-- Main function to process referral codes and award tokens
-- ============================================================

CREATE OR REPLACE FUNCTION public.referral_apply_code_v2(
    _joiner_profile_id UUID,
    _joiner_whatsapp TEXT,
    _code TEXT,
    _idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(
    applied BOOLEAN,
    promoter_profile_id UUID,
    promoter_whatsapp TEXT,
    tokens_awarded INTEGER,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT := UPPER(TRIM(COALESCE(_code, '')));
    v_promoter UUID;
    v_tokens INTEGER;
    v_promoter_whatsapp TEXT;
    v_joiner_created TIMESTAMPTZ;
    v_existing_wallet UUID;
    v_idempotency TEXT := COALESCE(_idempotency_key, gen_random_uuid()::TEXT);
BEGIN
    -- Initialize return values
    applied := false;
    promoter_profile_id := NULL;
    promoter_whatsapp := NULL;
    tokens_awarded := 0;
    reason := NULL;

    -- Validate code
    IF v_code = '' OR LENGTH(v_code) < 4 THEN
        reason := 'invalid_code';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Strip REF: prefix if present
    IF v_code LIKE 'REF:%' THEN
        v_code := SUBSTRING(v_code FROM 5);
    END IF;

    -- Find the promoter by referral code
    SELECT rl.user_id INTO v_promoter
    FROM public.referral_links rl
    WHERE rl.code = v_code
      AND rl.active = true
    LIMIT 1;

    IF v_promoter IS NULL THEN
        reason := 'invalid_code';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check for self-referral
    IF v_promoter = _joiner_profile_id THEN
        reason := 'self_referral';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check if joiner already has an attribution
    IF EXISTS (
        SELECT 1 FROM public.referral_attributions
        WHERE joiner_user_id = _joiner_profile_id
    ) THEN
        reason := 'already_attributed';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check if joiner profile is old (created more than 24 hours ago)
    SELECT created_at INTO v_joiner_created
    FROM public.profiles
    WHERE user_id = _joiner_profile_id
    LIMIT 1;

    IF v_joiner_created IS NOT NULL AND
       v_joiner_created < (NOW() AT TIME ZONE 'utc') - INTERVAL '24 hours' THEN
        reason := 'existing_user';
        
        -- Record attribution without crediting
        INSERT INTO public.referral_attributions (
            code,
            sharer_user_id,
            joiner_user_id,
            first_message_at,
            credited,
            credited_tokens,
            reason
        )
        VALUES (
            v_code,
            v_promoter,
            _joiner_profile_id,
            NOW() AT TIME ZONE 'utc',
            false,
            0,
            reason
        )
        ON CONFLICT DO NOTHING;
        
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check if joiner already has a wallet (indicates existing user)
    SELECT profile_id INTO v_existing_wallet
    FROM public.wallet_accounts
    WHERE profile_id = _joiner_profile_id;

    IF v_existing_wallet IS NOT NULL THEN
        reason := 'existing_user';
        
        -- Record attribution without crediting
        INSERT INTO public.referral_attributions (
            code,
            sharer_user_id,
            joiner_user_id,
            first_message_at,
            credited,
            credited_tokens,
            reason
        )
        VALUES (
            v_code,
            v_promoter,
            _joiner_profile_id,
            NOW() AT TIME ZONE 'utc',
            false,
            0,
            reason
        )
        ON CONFLICT DO NOTHING;
        
        RETURN NEXT;
        RETURN;
    END IF;

    -- Get tokens to award from promo rules
    SELECT tokens_per_new_user INTO v_tokens
    FROM public.promo_rules
    WHERE is_active = true
    ORDER BY id
    LIMIT 1;

    IF v_tokens IS NULL OR v_tokens <= 0 THEN
        v_tokens := 10; -- Default reward
    END IF;

    -- Create wallet for joiner if not exists
    INSERT INTO public.wallet_accounts (profile_id, tokens)
    VALUES (_joiner_profile_id, 0)
    ON CONFLICT (profile_id) DO NOTHING;

    -- Create/update wallet for promoter and add tokens
    INSERT INTO public.wallet_accounts (profile_id, tokens)
    VALUES (v_promoter, v_tokens)
    ON CONFLICT (profile_id) 
    DO UPDATE SET 
        tokens = wallet_accounts.tokens + v_tokens,
        updated_at = NOW() AT TIME ZONE 'utc';

    -- Record in wallet ledger for audit trail
    INSERT INTO public.wallet_ledger (user_id, delta_tokens, type, meta)
    VALUES (
        v_promoter,
        v_tokens,
        'referral_credit',
        jsonb_build_object(
            'code', v_code, 
            'joiner_whatsapp', _joiner_whatsapp,
            'joiner_profile_id', _joiner_profile_id,
            'idempotency_key', v_idempotency
        )
    );

    -- Record in wallet_transactions if table exists
    BEGIN
        INSERT INTO public.wallet_transactions (
            profile_id,
            amount_minor,
            currency,
            direction,
            description,
            occurred_at
        )
        VALUES (
            v_promoter,
            v_tokens,
            'TOK',
            'credit',
            'Referral bonus for inviting ' || LEFT(_joiner_whatsapp, 6) || '***',
            NOW() AT TIME ZONE 'utc'
        );
    EXCEPTION WHEN undefined_table THEN
        -- Table doesn't exist, skip
        NULL;
    END;

    -- Record the attribution with credit
    INSERT INTO public.referral_attributions (
        code,
        sharer_user_id,
        joiner_user_id,
        first_message_at,
        credited,
        credited_tokens,
        reason
    )
    VALUES (
        v_code,
        v_promoter,
        _joiner_profile_id,
        NOW() AT TIME ZONE 'utc',
        true,
        v_tokens,
        'credited'
    );

    -- Get promoter's WhatsApp number for notification
    SELECT whatsapp_e164 INTO v_promoter_whatsapp
    FROM public.profiles
    WHERE user_id = v_promoter;

    -- Set return values
    applied := true;
    promoter_profile_id := v_promoter;
    promoter_whatsapp := v_promoter_whatsapp;
    tokens_awarded := v_tokens;
    reason := 'credited';
    
    RETURN NEXT;
END;
$$;

-- ============================================================
-- GENERATE_REFERRAL_CODE FUNCTION
-- Generate a unique referral code for a profile
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_referral_code(p_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
    v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_attempt INTEGER := 0;
    v_max_attempts INTEGER := 10;
BEGIN
    -- Check if user already has a referral code
    SELECT code INTO v_code
    FROM public.referral_links
    WHERE user_id = p_profile_id AND active = true
    LIMIT 1;
    
    IF v_code IS NOT NULL THEN
        RETURN v_code;
    END IF;
    
    -- Generate new unique code
    WHILE v_attempt < v_max_attempts LOOP
        -- Generate 8-character code
        v_code := '';
        FOR i IN 1..8 LOOP
            v_code := v_code || SUBSTR(v_alphabet, (FLOOR(RANDOM() * LENGTH(v_alphabet))::INTEGER + 1), 1);
        END LOOP;
        
        -- Check if code is unique
        IF NOT EXISTS (SELECT 1 FROM public.referral_links WHERE code = v_code) THEN
            -- Insert the new referral link
            INSERT INTO public.referral_links (user_id, code, active, short_url)
            VALUES (
                p_profile_id, 
                v_code, 
                true,
                'https://easy.mo/r/' || v_code
            )
            ON CONFLICT (user_id) DO UPDATE SET 
                code = v_code,
                active = true,
                short_url = 'https://easy.mo/r/' || v_code;
            
            -- Also update profile's referral_code for backward compatibility
            UPDATE public.profiles 
            SET referral_code = v_code 
            WHERE user_id = p_profile_id;
            
            RETURN v_code;
        END IF;
        
        v_attempt := v_attempt + 1;
    END LOOP;
    
    -- Fallback: use profile ID prefix
    v_code := UPPER(SUBSTRING(p_profile_id::TEXT, 1, 8));
    INSERT INTO public.referral_links (user_id, code, active, short_url)
    VALUES (p_profile_id, v_code, true, 'https://easy.mo/r/' || v_code)
    ON CONFLICT (user_id) DO UPDATE SET code = v_code, active = true;
    
    RETURN v_code;
END;
$$;

-- ============================================================
-- WALLET_SUMMARY FUNCTION UPDATE
-- Ensure it returns tokens correctly
-- ============================================================

CREATE OR REPLACE FUNCTION public.wallet_summary(_profile_id UUID)
RETURNS TABLE(balance_minor INTEGER, pending_minor INTEGER, currency TEXT, tokens INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        0 AS balance_minor,
        0 AS pending_minor,
        'RWF'::TEXT AS currency,
        COALESCE(wa.tokens, 0) AS tokens
    FROM public.profiles p
    LEFT JOIN public.wallet_accounts wa ON wa.profile_id = p.user_id
    WHERE p.user_id = _profile_id;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE public.promo_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

-- Promo rules: service role only
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'promo_rules' AND policyname = 'service_role_only') THEN
        CREATE POLICY "service_role_only" ON public.promo_rules 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Wallet accounts: users can view their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_accounts' AND policyname = 'users_view_own_wallet') THEN
        CREATE POLICY "users_view_own_wallet" ON public.wallet_accounts 
            FOR SELECT USING (profile_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_accounts' AND policyname = 'service_role_manage_wallets') THEN
        CREATE POLICY "service_role_manage_wallets" ON public.wallet_accounts 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Wallet ledger: users can view their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_ledger' AND policyname = 'users_view_own_ledger') THEN
        CREATE POLICY "users_view_own_ledger" ON public.wallet_ledger 
            FOR SELECT USING (user_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_ledger' AND policyname = 'service_role_manage_ledger') THEN
        CREATE POLICY "service_role_manage_ledger" ON public.wallet_ledger 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT ON public.promo_rules TO authenticated;
GRANT SELECT ON public.wallet_accounts TO authenticated;
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT EXECUTE ON FUNCTION public.referral_apply_code_v2(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_summary(UUID) TO authenticated;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION public.referral_apply_code_v2 IS 'Process referral code: validate, credit tokens to promoter, record attribution, return promoter WhatsApp for notification';
COMMENT ON FUNCTION public.generate_referral_code IS 'Generate unique 8-character referral code for a profile';
COMMENT ON TABLE public.promo_rules IS 'Configuration for referral rewards (tokens per new user)';
COMMENT ON TABLE public.wallet_accounts IS 'Token wallet accounts linked to profiles';
COMMENT ON TABLE public.wallet_ledger IS 'Audit trail for all token transactions';

COMMIT;
