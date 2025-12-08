-- Migration: Wallet & Insurance Token Fixes
-- Created: 2025-11-23
-- Purpose: 
-- 1. Create insurance_policies table to track active policies.
-- 2. Create RPC to allocate tokens for insurance policies.
-- 3. Ensure wallet logic has necessary support.

BEGIN;

-- 1. Create insurance_policies table
CREATE TABLE IF NOT EXISTS public.insurance_policies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    policy_number text NOT NULL,
    insurer text,
    status text DEFAULT 'active', -- active, expired, cancelled
    valid_from timestamptz DEFAULT now(),
    valid_until timestamptz,
    tokens_allocated boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.insurance_policies TO service_role;

-- 2. RPC to allocate tokens for a policy
CREATE OR REPLACE FUNCTION public.insurance_allocate_tokens(
    p_policy_id uuid,
    p_admin_id uuid -- Optional, for audit if needed
)
RETURNS TABLE(success boolean, message text, tokens_added int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy record;
    v_system_profile uuid;
    v_transfer_id uuid;
BEGIN
    -- Get policy
    SELECT * INTO v_policy FROM public.insurance_policies WHERE id = p_policy_id;
    
    IF v_policy IS NULL THEN
        RETURN QUERY SELECT false, 'Policy not found', 0;
        RETURN;
    END IF;

    IF v_policy.tokens_allocated THEN
        RETURN QUERY SELECT false, 'Tokens already allocated for this policy', 0;
        RETURN;
    END IF;

    IF v_policy.user_id IS NULL THEN
        RETURN QUERY SELECT false, 'Policy has no associated user', 0;
        RETURN;
    END IF;

    -- Get system wallet
    SELECT public.wallet_system_profile() INTO v_system_profile;
    IF v_system_profile IS NULL THEN
        RETURN QUERY SELECT false, 'System wallet not configured', 0;
        RETURN;
    END IF;

    -- Transfer 2000 tokens
    -- We use a specific idempotency key to prevent double allocation even if flag fails (though we set flag in same tx)
    -- Key format: insurance:policy_id
    
    WITH t AS (
        SELECT * FROM public.wallet_transfer_tokens(
            p_sender := v_system_profile,
            p_amount := 2000,
            p_recipient := v_policy.user_id,
            p_recipient_whatsapp := NULL,
            p_idempotency_key := 'insurance:' || p_policy_id::text
        )
    )
    SELECT transfer_id INTO v_transfer_id FROM t;

    IF v_transfer_id IS NULL THEN
        RETURN QUERY SELECT false, 'Token transfer failed', 0;
        RETURN;
    END IF;

    -- Mark as allocated
    UPDATE public.insurance_policies 
    SET tokens_allocated = true, updated_at = now() 
    WHERE id = p_policy_id;

    RETURN QUERY SELECT true, 'Tokens allocated successfully', 2000;
END;
$$;

-- 3. Helper to check balance (optional, but useful for frontend/bot)
CREATE OR REPLACE FUNCTION public.wallet_get_balance(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(tokens, 0) FROM public.wallet_accounts WHERE profile_id = p_user_id;
$$;

COMMIT;
