BEGIN;

-- Migration: Complete Wallet & Token System Fix
-- Purpose: Ensure referral tokens work, balance updates, transaction history, and notifications
-- Date: 2025-12-11

-- ============================================================
-- 1. WALLET TRANSACTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TOK',
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    description TEXT,
    reference_table TEXT,
    reference_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meta JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_profile_occurred 
ON public.wallet_transactions(profile_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference 
ON public.wallet_transactions(reference_table, reference_id) 
WHERE reference_table IS NOT NULL;

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_transactions' AND policyname = 'users_view_own_transactions') THEN
        CREATE POLICY "users_view_own_transactions" ON public.wallet_transactions 
            FOR SELECT USING (profile_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_transactions' AND policyname = 'service_role_manage_transactions') THEN
        CREATE POLICY "service_role_manage_transactions" ON public.wallet_transactions 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================================
-- 2. WALLET_DELTA_FN - Core function to adjust wallet balance
-- ============================================================

-- Drop existing function if it exists (handle overloads)
DROP FUNCTION IF EXISTS public.wallet_delta_fn CASCADE;

CREATE OR REPLACE FUNCTION public.wallet_delta_fn(
    p_profile_id UUID,
    p_amount_tokens INTEGER,
    p_entry_type TEXT DEFAULT 'adjustment',
    p_reference_table TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance INTEGER;
    v_direction TEXT;
    v_final_description TEXT;
BEGIN
    -- Determine direction
    IF p_amount_tokens > 0 THEN
        v_direction := 'credit';
    ELSIF p_amount_tokens < 0 THEN
        v_direction := 'debit';
    ELSE
        -- Zero amount, no-op
        RETURN true;
    END IF;
    
    -- Generate description if not provided
    v_final_description := COALESCE(
        p_description,
        CASE p_entry_type
            WHEN 'referral_credit' THEN 'Referral bonus'
            WHEN 'referral_bonus' THEN 'Referral bonus'
            WHEN 'admin_allocation' THEN 'Admin token allocation'
            WHEN 'insurance_bonus' THEN 'Insurance purchase bonus'
            WHEN 'transfer_send' THEN 'Token transfer sent'
            WHEN 'transfer_receive' THEN 'Token transfer received'
            WHEN 'reward_redemption' THEN 'Reward redemption'
            ELSE 'Wallet adjustment'
        END
    );
    
    -- Create/update wallet account
    INSERT INTO public.wallet_accounts (profile_id, tokens, updated_at)
    VALUES (p_profile_id, ABS(p_amount_tokens), NOW())
    ON CONFLICT (profile_id) 
    DO UPDATE SET 
        tokens = CASE 
            WHEN v_direction = 'credit' THEN wallet_accounts.tokens + ABS(p_amount_tokens)
            WHEN v_direction = 'debit' THEN GREATEST(0, wallet_accounts.tokens - ABS(p_amount_tokens))
            ELSE wallet_accounts.tokens
        END,
        updated_at = NOW()
    RETURNING tokens INTO v_new_balance;
    
    -- Record transaction
    INSERT INTO public.wallet_transactions (
        profile_id,
        amount_minor,
        currency,
        direction,
        description,
        reference_table,
        reference_id,
        occurred_at,
        meta
    )
    VALUES (
        p_profile_id,
        ABS(p_amount_tokens),
        'TOK',
        v_direction,
        v_final_description,
        p_reference_table,
        p_reference_id,
        NOW(),
        jsonb_build_object(
            'entry_type', p_entry_type,
            'new_balance', v_new_balance
        )
    );
    
    RETURN true;
END;
$$;

-- ============================================================
-- 3. AUTO-NOTIFICATION TRIGGER FOR TRANSACTIONS
-- ============================================================

-- Create notification queue table
CREATE TABLE IF NOT EXISTS public.wallet_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.wallet_transactions(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    direction TEXT NOT NULL,
    description TEXT,
    new_balance INTEGER,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_notification_queue_pending 
ON public.wallet_notification_queue(profile_id, created_at) 
WHERE sent_at IS NULL;

ALTER TABLE public.wallet_notification_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_notification_queue' AND policyname = 'service_role_only_notifications') THEN
        CREATE POLICY "service_role_only_notifications" ON public.wallet_notification_queue 
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- Trigger function to queue notifications
CREATE OR REPLACE FUNCTION public.trigger_wallet_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- Get current balance
    SELECT tokens INTO v_new_balance
    FROM public.wallet_accounts
    WHERE profile_id = NEW.profile_id;
    
    -- Queue notification
    INSERT INTO public.wallet_notification_queue (
        profile_id,
        transaction_id,
        amount,
        direction,
        description,
        new_balance
    )
    VALUES (
        NEW.profile_id,
        NEW.id,
        NEW.amount_minor,
        NEW.direction,
        NEW.description,
        v_new_balance
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_wallet_transaction_notify ON public.wallet_transactions;
CREATE TRIGGER trg_wallet_transaction_notify
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_wallet_notification();

-- ============================================================
-- 4. GET_WALLET_TRANSACTIONS FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_wallet_transactions(
    p_profile_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    id UUID,
    amount_minor INTEGER,
    currency TEXT,
    direction TEXT,
    description TEXT,
    occurred_at TIMESTAMPTZ,
    reference_table TEXT,
    reference_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        id,
        amount_minor,
        currency,
        direction,
        description,
        occurred_at,
        reference_table,
        reference_id
    FROM public.wallet_transactions
    WHERE profile_id = p_profile_id
    ORDER BY occurred_at DESC
    LIMIT p_limit;
$$;

-- ============================================================
-- 5. UPDATE REFERRAL SYSTEM TO USE wallet_delta_fn
-- ============================================================

-- Already handled in referral_apply_code_v2, but ensure wallet_transactions insert works
-- The function at line 290-312 in 20251210150000_referral_system_v2.sql handles this

-- ============================================================
-- 6. GRANTS
-- ============================================================

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT SELECT ON public.wallet_notification_queue TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_delta_fn(UUID, INTEGER, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_transactions(UUID, INTEGER) TO authenticated;

-- ============================================================
-- 7. COMMENTS
-- ============================================================

COMMENT ON TABLE public.wallet_transactions IS 'Transaction history for all wallet operations (tokens and cash)';
COMMENT ON TABLE public.wallet_notification_queue IS 'Queue for sending WhatsApp notifications about wallet transactions';
COMMENT ON FUNCTION public.wallet_delta_fn(UUID, INTEGER, TEXT, TEXT, UUID, TEXT) IS 'Core function to credit/debit tokens, creates transaction record and triggers notification';
COMMENT ON FUNCTION public.get_wallet_transactions(UUID, INTEGER) IS 'Fetch transaction history for a user';
COMMENT ON TRIGGER trg_wallet_transaction_notify ON public.wallet_transactions IS 'Automatically queues WhatsApp notification for each transaction';

COMMIT;
