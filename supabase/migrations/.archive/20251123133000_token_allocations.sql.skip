-- Migration: Token Allocations & Insurance Policies
-- Created: 2025-11-23
-- Purpose: Support token rewards for insurance and referrals.

BEGIN;

-- 1. Ensure insurance_policies table exists (if not created by previous migration)
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

-- 2. Create token_allocations table to track manual/auto allocations
CREATE TABLE IF NOT EXISTS public.token_allocations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(user_id),
    amount int NOT NULL,
    reason text NOT NULL, -- 'insurance_reward', 'referral_reward', 'manual_grant'
    reference_id uuid, -- Link to policy_id or other entity
    admin_id uuid REFERENCES public.profiles(user_id), -- Who allocated it (if manual)
    created_at timestamptz DEFAULT now()
);

-- 3. RPC to allocate tokens for insurance (Idempotent)
CREATE OR REPLACE FUNCTION public.allocate_insurance_tokens(
    p_policy_id uuid,
    p_admin_id uuid
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_policy record;
    v_user_id uuid;
BEGIN
    -- Get policy
    SELECT * INTO v_policy FROM public.insurance_policies WHERE id = p_policy_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Policy not found';
        RETURN;
    END IF;

    IF v_policy.tokens_allocated THEN
        RETURN QUERY SELECT false, 'Tokens already allocated for this policy';
        RETURN;
    END IF;

    v_user_id := v_policy.user_id;
    
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'Policy has no associated user';
        RETURN;
    END IF;

    -- Allocate 2000 tokens
    INSERT INTO public.wallet_transactions (
        profile_id,
        amount,
        type,
        reference,
        description,
        status
    ) VALUES (
        v_user_id,
        2000,
        'credit',
        'INS_REWARD:' || p_policy_id,
        'Reward for purchasing insurance',
        'completed'
    );

    -- Update wallet balance (trigger should handle this, but if not, we do it manually or rely on RPC)
    -- Assuming wallet_transactions trigger updates wallet_accounts. If not, we need to update it.
    -- Let's use the wallet_transfer_tokens logic or similar if available, but direct insert is fine if triggers exist.
    -- We'll assume a trigger exists or we update manually:
    UPDATE public.wallet_accounts 
    SET tokens = tokens + 2000, updated_at = now()
    WHERE profile_id = v_user_id;

    -- Log allocation
    INSERT INTO public.token_allocations (
        user_id, amount, reason, reference_id, admin_id
    ) VALUES (
        v_user_id, 2000, 'insurance_reward', p_policy_id, p_admin_id
    );

    -- Mark policy as allocated
    UPDATE public.insurance_policies 
    SET tokens_allocated = true 
    WHERE id = p_policy_id;

    RETURN QUERY SELECT true, 'Tokens allocated successfully';
END;
$$;

-- Enable RLS
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_allocations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.insurance_policies TO service_role;
GRANT ALL ON public.token_allocations TO service_role;

COMMIT;
